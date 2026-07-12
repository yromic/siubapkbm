import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getSnapshot } from '@/lib/services/snapshotService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const student_id = searchParams.get('student_id');
        const academic_year_id = searchParams.get('academic_year_id');
        const semester_id = searchParams.get('semester_id');

        if (!student_id || !academic_year_id || !semester_id) {
          return errorResponse('student_id, academic_year_id, and semester_id query parameters are required.', 'ERR_VALIDATION', 400);
        }

        const result = await getSnapshot(student_id, academic_year_id, semester_id);
        return successResponse(result, 'Report snapshot retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving snapshot.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
