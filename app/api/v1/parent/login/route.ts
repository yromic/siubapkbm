import { NextRequest, NextResponse } from 'next/server';
import { loginParent } from '@/lib/services/parentService';
import { checkRateLimit, resetRateLimit } from '@/lib/middleware/rateLimiter';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { 
  getSecuritySetting,
  getSecuritySettingBool, 
  getSecuritySettingNum, 
  getProgressiveDelayMs, 
  applyDelay, 
  generateAltchaChallenge,
  verifyAltchaChallenge
} from '@/lib/auth/securityUtils';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();
    const { nisn, birth_date, pin, parent_pin, altchaPayload } = body;
    const actualPin = pin || parent_pin;

    if (!nisn || !birth_date || !actualPin) {
      return errorResponse(
        'Missing NISN, birth date, or PIN.',
        'ERR_VALIDATION',
        400
      );
    }

    // 1. IP + Username Composite Rate Limiter
    const isAllowed = await checkRateLimit(ip, '/api/v1/parent/login', nisn);
    if (!isAllowed) {
      const windowMinutes = await getSecuritySettingNum('RATE_LIMIT_WINDOW', 15);
      return errorResponse(
        `Too many requests. Please try again after ${windowMinutes} minutes.`,
        'ERR_RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // 2. Fetch current failed attempts for Turnstile check and progressive delay
    const rateLimitKey = `${ip}:${nisn.trim().toLowerCase()}`;
    const attemptRecord = await db('rate_limit_attempts')
      .where({ identifier: rateLimitKey, endpoint: '/api/v1/parent/login' })
      .first();
    const attempts = attemptRecord ? attemptRecord.attempts : 0;

    // 3. ALTCHA Verification (if threshold reached)
    const altchaEnabled = await getSecuritySettingBool('ALTCHA_ENABLED', true);
    const altchaThreshold = await getSecuritySettingNum('ALTCHA_THRESHOLD', 3);
    
    if (altchaEnabled && attempts >= altchaThreshold) {
      const hmacKey = process.env.ALTCHA_HMAC_KEY;
      if (!hmacKey) {
        throw new AppError('ALTCHA HMAC key is not configured.', 'ERR_ALTCHA_CONFIG', 500);
      }
      const difficulty = await getSecuritySettingNum('ALTCHA_DIFFICULTY', 50000);
      const maxAge = await getSecuritySettingNum('ALTCHA_MAX_AGE_SECONDS', 300);
      
      if (!altchaPayload) {
        const challenge = generateAltchaChallenge(hmacKey, difficulty, maxAge);
        return errorResponse(
          'Verification is required to login.',
          'ERR_ALTCHA_REQUIRED',
          400,
          { challenge }
        );
      }
      
      const isAltchaValid = await verifyAltchaChallenge(altchaPayload, hmacKey);
      if (!isAltchaValid) {
        const challenge = generateAltchaChallenge(hmacKey, difficulty, maxAge);
        return errorResponse(
          'Verification failed. Please complete the captcha.',
          'ERR_ALTCHA_REQUIRED',
          400,
          { challenge }
        );
      }
    }

    // 4. Progressive Delay
    const delayMs = await getProgressiveDelayMs(attempts);
    await applyDelay(delayMs);

    // 5. Authenticate parent credentials
    const result = await loginParent(nisn, birth_date, actualPin, ip, userAgent);

    // 6. Reset Rate Limit on success
    await resetRateLimit(ip, '/api/v1/parent/login', nisn);

    // 7. Return cookie and response
    const response = successResponse(result, 'Login successful.');
    response.cookies.set({
      name: 'parent_session_token',
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 2 * 60 * 60, // 2 hours
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred during parent login.',
      'ERR_INTERNAL',
      500
    );
  }
}
