import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { terminateAssignment } from '@/lib/services/classTeacherAssignmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        await terminateAssignment(id);
        return successResponse(null, 'Class teacher assignment terminated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error terminating class teacher assignment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
