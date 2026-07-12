import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getCultureCompleteness } from '@/lib/services/completenessService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get('class_id');
        const academic_year_id = searchParams.get('academic_year_id');
        const semester_id = searchParams.get('semester_id');

        if (!class_id || !academic_year_id || !semester_id) {
          return errorResponse('class_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
        }

        const percentage = await getCultureCompleteness(class_id, academic_year_id, semester_id);
        return successResponse({ percentage }, 'Culture completeness calculated.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error calculating completeness.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
