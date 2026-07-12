import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { recordAttendance } from '@/lib/services/attendanceService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['teacher', 'administrator'], req, async () => {
      try {
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const body = await req.json();
        const result = await recordAttendance(actorId, body.lat, body.lng);
        return successResponse(result, 'Attendance recorded successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error recording attendance.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
