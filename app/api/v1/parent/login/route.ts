import { NextRequest, NextResponse } from 'next/server';
import { loginParent } from '@/lib/services/parentService';
import { checkRateLimit } from '@/lib/middleware/rateLimiter';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

  // Rate Limiter
  if (!(await checkRateLimit(ip, '/api/v1/parent/login'))) {
    return errorResponse(
      'Too many requests. Please try again after 15 minutes.',
      'ERR_RATE_LIMIT_EXCEEDED',
      429
    );
  }

  try {
    const body = await req.json();
    const { nisn, birth_date, pin, parent_pin } = body;
    const actualPin = pin || parent_pin;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;
    const result = await loginParent(nisn, birth_date, actualPin, ip, userAgent);
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
    if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
    return errorResponse(error instanceof Error ? error.message : 'Login error', 'ERR_INTERNAL', 500);
  }
}
