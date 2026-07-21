import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { 
  decryptMfaToken, 
  verifyMfaToken, 
  hashBackupCode, 
  getSecuritySettingNum 
} from '@/lib/auth/securityUtils';
import { generateSessionToken } from '@/lib/auth/tokenUtils';
import { v4 as uuidv4 } from 'uuid';
import { logAuthenticationEvent } from '@/lib/services/auditService';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();
    const { tempToken, code, backupCode } = body;

    if (!tempToken || (!code && !backupCode)) {
      return errorResponse('Missing validation credentials.', 'ERR_VALIDATION', 400);
    }

    // 1. Decrypt temp token and extract userId
    const userId = decryptMfaToken(tempToken);
    if (!userId) {
      return errorResponse('MFA session has expired or is invalid. Please login again.', 'ERR_INVALID_MFA_SESSION', 400);
    }

    // 2. Fetch user
    const user = await db('users')
      .where('id', userId)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!user || user.status !== 'active') {
      return errorResponse('User account is invalid or inactive.', 'ERR_INVALID_CREDENTIALS', 400);
    }

    // 3. Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMs = new Date(user.locked_until).getTime() - new Date().getTime();
      const remainingMins = Math.ceil(remainingMs / 60000);
      return errorResponse(`Account is temporarily locked. Try again in ${remainingMins} minutes.`, 'ERR_ACCOUNT_LOCKED', 403);
    }

    let isCodeValid = false;
    let isBackupUsed = false;
    let updatedBackupCodes: string[] = [];

    if (code) {
      // Verify TOTP token
      if (user.mfa_secret) {
        isCodeValid = verifyMfaToken(code, user.mfa_secret);
      }
    } else if (backupCode) {
      // Verify backup code
      if (user.mfa_backup_codes) {
        try {
          const codesList: string[] = JSON.parse(user.mfa_backup_codes);
          const hashedInput = hashBackupCode(backupCode);
          const index = codesList.indexOf(hashedInput);
          if (index !== -1) {
            isCodeValid = true;
            isBackupUsed = true;
            // Remove the used backup code
            updatedBackupCodes = [...codesList];
            updatedBackupCodes.splice(index, 1);
          }
        } catch (e) {
          console.error('Failed to parse backup codes JSON:', e);
        }
      }
    }

    if (!isCodeValid) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      const patch: any = { failed_login_attempts: attempts };
      
      const maxFailedLogin = await getSecuritySettingNum('MAX_FAILED_LOGIN', 5);
      const lockDuration = await getSecuritySettingNum('LOCK_DURATION', 15);
      
      if (attempts >= maxFailedLogin) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + lockDuration);
        patch.locked_until = lockUntil;
        await db('users').where('id', user.id).update(patch);
        await logAuthenticationEvent(user.username, user.role, 'account_locked', false, ip, userAgent, `Account locked for ${lockDuration} minutes due to ${attempts} failed MFA attempts.`);
      } else {
        await db('users').where('id', user.id).update(patch);
        await logAuthenticationEvent(user.username, user.role, 'login_failed', false, ip, userAgent, `Failed MFA code attempt ${attempts}.`);
      }
      return errorResponse('Invalid verification code.', 'ERR_INVALID_CREDENTIALS', 400);
    }

    // Success! Update DB (reset attempts, update backup codes if used)
    const updatePatch: any = {
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date()
    };
    if (isBackupUsed) {
      updatePatch.mfa_backup_codes = JSON.stringify(updatedBackupCodes);
    }
    await db('users').where('id', user.id).update(updatePatch);

    // Revoke previous active sessions (Session Rotation)
    await db('staff_sessions')
      .where('user_id', user.id)
      .where('lifecycle_status', 'active')
      .update({
        revoked_at: new Date(),
        lifecycle_status: 'inactive',
        updated_at: new Date()
      });

    // Create session
    const { rawToken, hash } = generateSessionToken();
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 12);

    await db('staff_sessions').insert({
      id: sessionId,
      user_id: user.id,
      token_hash: hash,
      issued_at: new Date(),
      expires_at: expiresAt,
      revoked_at: null,
      last_seen_at: new Date(),
      ip_address: ip || null,
      user_agent: userAgent || null,
      lifecycle_status: 'active'
    });

    await logAuthenticationEvent(user.username, user.role, 'login_success', true, ip, userAgent, 'Successfully verified MFA.');

    const { password_hash, mfa_secret, mfa_backup_codes, ...sanitizedUser } = user;

    const response = successResponse({
      token: rawToken,
      user: sanitizedUser
    }, 'MFA verification successful.');

    response.cookies.set({
      name: 'staff_session_token',
      value: rawToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60, // 12 hours
    });

    return response;
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred during MFA verification.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
