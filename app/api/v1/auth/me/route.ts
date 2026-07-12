import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { getUserById } from '@/lib/services/userService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
      }

      const user = await getUserById(userId);
      return successResponse({ user }, 'User profile retrieved.');
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'An unexpected error occurred.',
        'ERR_INTERNAL_SERVER',
        500
      );
    }
  });
}
