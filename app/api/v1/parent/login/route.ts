import { NextRequest } from 'next/server';
import { loginParent, loginParentByStudentId } from '@/lib/services/parentService';
import { checkRateLimit, resetRateLimit } from '@/lib/middleware/rateLimiter';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { 
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
    const { student_id, nisn, birth_date, pin, parent_pin, altchaPayload } = body;
    const actualPin = pin || parent_pin;

    if (!actualPin || (!student_id && (!nisn || !birth_date))) {
      return errorResponse(
        'Harap pilih nama anak dan masukkan PIN 4 digit.',
        'ERR_VALIDATION',
        400
      );
    }

    const rateIdentifier = student_id || nisn || ip;

    // 1. IP + Identifier Composite Rate Limiter
    const isAllowed = await checkRateLimit(ip, '/api/v1/parent/login', rateIdentifier);
    if (!isAllowed) {
      const windowMinutes = await getSecuritySettingNum('RATE_LIMIT_WINDOW', 15);
      return errorResponse(
        `Terlalu banyak percobaan login. Silakan coba lagi setelah ${windowMinutes} menit.`,
        'ERR_RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // 2. Fetch current failed attempts
    const rateLimitKey = `${ip}:${rateIdentifier.trim().toLowerCase()}`;
    const attemptRecord = await db('rate_limit_attempts')
      .where({ identifier: rateLimitKey, endpoint: '/api/v1/parent/login' })
      .first();
    const attempts = attemptRecord ? attemptRecord.attempts : 0;

    // 3. ALTCHA Verification (only if excessive attempts threshold reached)
    const altchaEnabled = await getSecuritySettingBool('ALTCHA_ENABLED', true);
    const altchaThreshold = await getSecuritySettingNum('ALTCHA_THRESHOLD', 5);
    
    if (altchaEnabled && attempts >= altchaThreshold) {
      const hmacKey = process.env.ALTCHA_HMAC_KEY;
      if (hmacKey) {
        const difficulty = await getSecuritySettingNum('ALTCHA_DIFFICULTY', 50000);
        const maxAge = await getSecuritySettingNum('ALTCHA_MAX_AGE_SECONDS', 300);
        
        if (!altchaPayload) {
          const challenge = generateAltchaChallenge(hmacKey, difficulty, maxAge);
          return errorResponse(
            'Verifikasi keamanan diperlukan.',
            'ERR_ALTCHA_REQUIRED',
            400,
            { challenge }
          );
        }
        
        const isAltchaValid = await verifyAltchaChallenge(altchaPayload, hmacKey);
        if (!isAltchaValid) {
          const challenge = generateAltchaChallenge(hmacKey, difficulty, maxAge);
          return errorResponse(
            'Verifikasi keamanan gagal. Silakan coba lagi.',
            'ERR_ALTCHA_REQUIRED',
            400,
            { challenge }
          );
        }
      }
    }

    // 4. Progressive Delay
    const delayMs = await getProgressiveDelayMs(attempts);
    await applyDelay(delayMs);

    // 5. Authenticate parent credentials
    let result;
    if (student_id) {
      result = await loginParentByStudentId(student_id, actualPin, ip, userAgent);
    } else {
      result = await loginParent(nisn, birth_date, actualPin, ip, userAgent);
    }

    // 6. Reset Rate Limit on success
    await resetRateLimit(ip, '/api/v1/parent/login', rateIdentifier);

    // 7. Return 365-day persistent cookie and response
    const response = successResponse(result, 'Login berhasil.');
    response.cookies.set({
      name: 'parent_session_token',
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 365 days (1 year)
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat login orang tua.',
      'ERR_INTERNAL',
      500
    );
  }
}

