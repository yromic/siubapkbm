import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { exportStudentsCsvService } from '@/lib/services/csvExportService';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const actorId = (req as any).user?.id;
        if (!actorId) return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);

        const { searchParams } = new URL(req.url);
        const classId = searchParams.get('class_id') || undefined;
        const academicYearId = searchParams.get('academic_year_id') || undefined;
        const semesterId = searchParams.get('semester_id') || undefined;

        const result = await exportStudentsCsvService({ classId, academicYearId, semesterId, actorId });
        return successResponse(result, 'Students CSV export generated.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        console.error('[export/csv/students] Error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Error generating students CSV export.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
