import { NextRequest, NextResponse } from 'next/server';
import { withParentAuth } from '@/lib/middleware/withParentAuth';
import { logoutParent } from '@/lib/services/parentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('parent_session_token')?.value || '';
  try {
    await logoutParent(token);
    const response = successResponse(null, 'Logged out successfully.');
    response.cookies.set({
      name: 'parent_session_token',
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
    return errorResponse('Logout error', 'ERR_INTERNAL', 500);
  }
}
