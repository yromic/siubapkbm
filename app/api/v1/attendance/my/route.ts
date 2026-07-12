import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getMyAttendance } from '@/lib/services/attendanceService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['teacher', 'administrator'], req, async () => {
      try {
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const { searchParams } = new URL(req.url);
        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
        const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;

        const result = await getMyAttendance(actorId, month, year);
        return successResponse(result, 'Attendance history retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving attendance history.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
