import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getTeacherProfileByUserId } from '@/lib/services/teacherService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['teacher'], req, async () => {
      try {
        const userId = (req as any).user?.id;
        if (!userId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const result = await getTeacherProfileByUserId(userId);
        return successResponse(result, 'Own teacher profile retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving own teacher profile.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
