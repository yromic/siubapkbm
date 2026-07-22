import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getTeacherCompleteness } from '@/lib/services/completenessService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const academic_year_id = searchParams.get('academic_year_id');
        const semester_id = searchParams.get('semester_id');
        const class_id = searchParams.get('class_id') || undefined;
        const period_mode = (searchParams.get('period_mode') as 'week' | 'month' | 'semester') || 'semester';

        if (!academic_year_id || !semester_id) {
          return errorResponse('academic_year_id and semester_id are required.', 'ERR_VALIDATION', 400);
        }

        const result = await getTeacherCompleteness(academic_year_id, semester_id, class_id, period_mode);
        return successResponse(result, 'Teacher input completeness stats retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error getting teacher completeness.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
