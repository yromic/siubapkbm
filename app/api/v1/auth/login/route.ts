import { NextRequest, NextResponse } from 'next/server';
import { loginStaff } from '@/lib/auth/staffAuth';
import { checkRateLimit } from '@/lib/middleware/rateLimiter';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || undefined;

  // Rate Limiter
  if (!(await checkRateLimit(ip, '/api/v1/auth/login'))) {
    return errorResponse(
      'Too many requests. Please try again after 15 minutes.',
      'ERR_RATE_LIMIT_EXCEEDED',
      429
    );
  }

  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return errorResponse(
        'Missing username/email or password.',
        'ERR_VALIDATION',
        400
      );
    }

    const result = await loginStaff(identifier, password, ip, userAgent);

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
