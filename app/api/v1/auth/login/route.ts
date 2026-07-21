import { NextRequest, NextResponse } from 'next/server';
import { loginStaff } from '@/lib/auth/staffAuth';
import { checkRateLimit, resetRateLimit } from '@/lib/middleware/rateLimiter';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { 
  getSecuritySetting,
  getSecuritySettingBool, 
  getSecuritySettingNum, 
  getProgressiveDelayMs, 
  applyDelay, 
  verifyTurnstile, 
  encryptMfaToken 
} from '@/lib/auth/securityUtils';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();
    const { identifier, password, turnstileToken } = body;

    if (!identifier || !password) {
      return errorResponse(
        'Missing username/email or password.',
        'ERR_VALIDATION',
        400
      );
    }

    // 1. IP + Username Composite Rate Limiter
    const isAllowed = await checkRateLimit(ip, '/api/v1/auth/login', identifier);
    if (!isAllowed) {
      const windowMinutes = await getSecuritySettingNum('RATE_LIMIT_WINDOW', 15);
      return errorResponse(
        `Too many requests. Please try again after ${windowMinutes} minutes.`,
        'ERR_RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // 2. Fetch current failed attempts for Turnstile check and progressive delay
    const rateLimitKey = `${ip}:${identifier.trim().toLowerCase()}`;
    const attemptRecord = await db('rate_limit_attempts')
      .where({ identifier: rateLimitKey, endpoint: '/api/v1/auth/login' })
      .first();
    const attempts = attemptRecord ? attemptRecord.attempts : 0;

    // 3. Cloudflare Turnstile Verification (if threshold reached)
    const turnstileEnabled = await getSecuritySettingBool('TURNSTILE_ENABLED', false);
    const turnstileThreshold = await getSecuritySettingNum('TURNSTILE_THRESHOLD', 3);
    
    if (turnstileEnabled && attempts >= turnstileThreshold) {
      const siteKey = await getSecuritySetting('TURNSTILE_SITE_KEY', process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '');
      
      if (!turnstileToken) {
        return errorResponse(
          'Verification is required to login.',
          'ERR_TURNSTILE_REQUIRED',
          400,
          { siteKey }
        );
      }
      
      const isTurnstileValid = await verifyTurnstile(turnstileToken, ip);
      if (!isTurnstileValid) {
        return errorResponse(
          'Verification failed. Please complete the captcha.',
          'ERR_TURNSTILE_REQUIRED',
          400,
          { siteKey }
        );
      }
    }

    // 4. Progressive Delay
    const delayMs = await getProgressiveDelayMs(attempts);
    await applyDelay(delayMs);

    // 5. Authenticate Credentials
    const result = await loginStaff(identifier, password, ip, userAgent);

    // 6. Reset Rate Limit Attempts on Success
    await resetRateLimit(ip, '/api/v1/auth/login', identifier);

    // 7. Check for TOTP MFA
    const mfaEnabledGlobally = await getSecuritySettingBool('MFA_ENABLED', false);
    const userRecord = await db('users').where('id', result.user.id).first();
    
    if (
      mfaEnabledGlobally && 
      (userRecord.role === 'administrator' || userRecord.role === 'admin') && 
      userRecord.mfa_enabled
    ) {
      // Return MFA Challenge state instead of finalizing the session token
      const tempToken = encryptMfaToken(userRecord.id);
      return successResponse({
        mfaRequired: true,
        tempToken,
        user: result.user
      }, 'Multi-factor authentication required.');
    }

    // 8. Normal successful login flow (Set Cookie & return response)
    const response = successResponse(result, 'Login successful.');
    response.cookies.set({
      name: 'staff_session_token',
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60, // 12 hours
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred during login.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
