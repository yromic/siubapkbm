import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getDailyRoster } from '@/lib/services/attendanceService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');

        if (!date) {
          return errorResponse('date query parameter is required.', 'ERR_VALIDATION', 400);
        }

        const result = await getDailyRoster(date);
        return successResponse(result, 'Daily attendance roster retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving daily roster.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
