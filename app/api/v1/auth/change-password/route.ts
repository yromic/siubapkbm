import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { resetUserPassword } from '@/lib/services/userService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
      }

      const body = await req.json();
      const { old_password, new_password } = body;

      if (!old_password || !new_password) {
        return errorResponse(
          'Missing old password or new password.',
          'ERR_VALIDATION',
          400
        );
      }

      // Fetch user to check password
      const user = await db('users').where('id', userId).first();
      if (!user) {
        return errorResponse('User not found.', 'ERR_USER_NOT_FOUND', 404);
      }

      // Verify old password
      const isPasswordValid = await bcrypt.compare(old_password, user.password_hash);
      if (!isPasswordValid) {
        return errorResponse('Incorrect old password.', 'ERR_INVALID_CREDENTIALS', 400);
      }

      // Update password
      await resetUserPassword(userId, new_password);

      return successResponse(null, 'Password changed successfully.');
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'An unexpected error occurred during password change.',
        'ERR_INTERNAL_SERVER',
        500
      );
    }
  });
}
