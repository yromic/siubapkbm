import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { deactivateTeacherProfile } from '@/lib/services/teacherService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        await deactivateTeacherProfile(id);
        return successResponse(null, 'Teacher profile deactivated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error deactivating teacher profile.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
