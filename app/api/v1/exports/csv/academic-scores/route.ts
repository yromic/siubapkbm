import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { exportAcademicScoresCsvService } from '@/lib/services/csvExportService';

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
        const subjectId = searchParams.get('subject_id') || undefined;

        if (!classId || !academicYearId || !semesterId || !subjectId) {
          return errorResponse(
            'class_id, academic_year_id, semester_id, and subject_id are required.',
            'ERR_VALIDATION',
            400
          );
        }

        const result = await exportAcademicScoresCsvService({ classId, academicYearId, semesterId, subjectId, actorId });
        return successResponse(result, 'Academic scores CSV export generated.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        console.error('[export/csv/academic-scores] Error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Error generating academic scores CSV export.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
