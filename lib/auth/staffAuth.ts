import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { generateSessionToken, hashToken } from './tokenUtils';
import { AppError } from '@/lib/errors';
import { getSecuritySettingNum } from './securityUtils';
import { logAuthenticationEvent } from '@/lib/services/auditService';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'administrator' | 'admin' | 'teacher';
  phone?: string;
  status: 'active' | 'inactive';
  failed_login_attempts: number;
  locked_until?: string | Date;
  last_login_at?: string | Date;
  lifecycle_status: string;
  created_at: string | Date;
  updated_at: string | Date;
  mfa_enabled?: boolean;
  mfa_secret?: string;
  mfa_backup_codes?: string;
}

export async function loginStaff(
  identifier: string,
  password: string,
  ip?: string,
  userAgent?: string
): Promise<{ token: string; user: Omit<User, 'password_hash'> }> {
  // Find user by username or email
  const user = await db('users')
    .where((builder: any) => {
      builder.where('username', identifier).orWhere('email', identifier);
    })
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!user) {
    // Log failure even if user doesn't exist (to track brute force)
    await logAuthenticationEvent(identifier, null, 'login_failed', false, ip, userAgent, 'User not found.');
    throw new AppError('Invalid username, email, or password.', 'ERR_INVALID_CREDENTIALS', 400);
  }

  // Generic message for inactive accounts to prevent user enumeration
  if (user.status !== 'active') {
    await logAuthenticationEvent(identifier, user.role, 'login_failed', false, ip, userAgent, 'Account is inactive.');
    throw new AppError('Invalid username, email, or password.', 'ERR_INVALID_CREDENTIALS', 400);
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainingMs = new Date(user.locked_until).getTime() - new Date().getTime();
    const remainingMins = Math.ceil(remainingMs / 60000);
    await logAuthenticationEvent(identifier, user.role, 'login_failed', false, ip, userAgent, 'Attempt on temporarily locked account.');
    throw new AppError(`Account is temporarily locked. Try again in ${remainingMins} minutes.`, 'ERR_ACCOUNT_LOCKED', 403);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    // Increment failed attempts
    const attempts = (user.failed_login_attempts || 0) + 1;
    const patch: any = { failed_login_attempts: attempts };
    
    // Configurable thresholds
    const maxFailedLogin = await getSecuritySettingNum('MAX_FAILED_LOGIN', 5);
    const lockDuration = await getSecuritySettingNum('LOCK_DURATION', 15);
    
    // Check if lockout threshold is reached
    if (attempts >= maxFailedLogin) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + lockDuration);
      patch.locked_until = lockUntil;
      
      await db('users').where('id', user.id).update(patch);
      await logAuthenticationEvent(identifier, user.role, 'account_locked', false, ip, userAgent, `Account locked for ${lockDuration} minutes due to ${attempts} failed attempts.`);
    } else {
      await db('users').where('id', user.id).update(patch);
      await logAuthenticationEvent(identifier, user.role, 'login_failed', false, ip, userAgent, `Incorrect password. Failed attempts: ${attempts}.`);
    }
    
    throw new AppError('Invalid username, email, or password.', 'ERR_INVALID_CREDENTIALS', 400);
  }

  // Reset failed attempts & Update last login
  await db('users').where('id', user.id).update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: new Date()
  });

  // Log success (Note: We do not log the token or session details here)
  await logAuthenticationEvent(identifier, user.role, 'login_success', true, ip, userAgent);

  // Generate session token
  const { rawToken, hash } = generateSessionToken();
  const sessionId = uuidv4();
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 12);

  // Revoke all previous active sessions for this user (Session Rotation)
  await db('staff_sessions')
    .where('user_id', user.id)
    .where('lifecycle_status', 'active')
    .update({
      revoked_at: new Date(),
      lifecycle_status: 'inactive',
      updated_at: new Date()
    });

  // Save session
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

  // Remove sensitive credentials before returning
  const { password_hash, mfa_secret, mfa_backup_codes, ...sanitizedUser } = user;

  return {
    token: rawToken,
    user: sanitizedUser
  };
}

export async function verifyStaffToken(rawToken: string, ip?: string, userAgent?: string): Promise<any> {
  if (!rawToken) return null;
  const hash = hashToken(rawToken);

  const session = await db('staff_sessions')
    .where('token_hash', hash)
    .first();

  if (!session) return null;

  if (session.lifecycle_status !== 'active') return null;
  if (session.revoked_at !== null) return null;
  
  const isExpired = new Date(session.expires_at) <= new Date();
  if (isExpired) return null;

  // Enforce idle timeout check using SESSION_IDLE_TIMEOUT_MINUTES
  const idleTimeoutMinutes = await getSecuritySettingNum('SESSION_IDLE_TIMEOUT_MINUTES', 30);
  const idleTimeoutMs = idleTimeoutMinutes * 60 * 1000;
  
  const now = new Date();
  const lastSeen = new Date(session.last_seen_at);
  const diffMs = now.getTime() - lastSeen.getTime();
  
  if (diffMs > idleTimeoutMs) {
    // Revoke current session
    await db('staff_sessions')
      .where('id', session.id)
      .update({
        lifecycle_status: 'inactive',
        revoked_at: now,
        updated_at: now
      });

    // Log the expiration audit event
    const user = await db('users').where('id', session.user_id).first();
    if (user) {
      await logAuthenticationEvent(
        user.username,
        user.role,
        'session_expired_idle_timeout',
        true,
        ip,
        userAgent,
        `Session expired due to idle timeout after ${idleTimeoutMinutes} minutes.`
      );
    }

    return null;
  }

  // Update last seen
  await db('staff_sessions')
    .where('id', session.id)
    .update({ last_seen_at: now });

  return session;
}

export async function logoutStaff(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const hash = hashToken(rawToken);

  await db('staff_sessions')
    .where('token_hash', hash)
    .update({
      revoked_at: new Date(),
      lifecycle_status: 'inactive'
    });
}
