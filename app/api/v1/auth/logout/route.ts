import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { logoutStaff } from '@/lib/auth/staffAuth';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const token = req.cookies.get('staff_session_token')?.value || '';
      
      await logoutStaff(token);
      
      const response = successResponse(null, 'Logged out successfully.');
      response.cookies.set({
        name: 'staff_session_token',
        value: '',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });
      return response;
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'An unexpected error occurred during logout.',
        'ERR_INTERNAL_SERVER',
        500
      );
    }
  });
}
