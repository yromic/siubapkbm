import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getClassAcademicSummary } from '@/lib/services/academicScoreService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const academic_year_id = searchParams.get('academic_year_id');
        const semester_id = searchParams.get('semester_id');

        if (!academic_year_id || !semester_id) {
          return errorResponse('academic_year_id and semester_id query parameters are required.', 'ERR_VALIDATION', 400);
        }

        // Authorization check for teachers: must be assigned to requested class in this period
        const user = (req as unknown as { user?: { id: string; role: string } }).user;
        if (user && (user.role === 'teacher' || user.role === 'guru')) {
          const assignment = await db('class_teacher_assignments')
            .where({
              class_id: id,
              teacher_user_id: user.id,
              academic_year_id,
              semester_id,
              status: 'active',
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!assignment) {
            return errorResponse(
              'You do not have permission to view the academic summary for this class.',
              'ERR_FORBIDDEN',
              403
            );
          }
        }

        const result = await getClassAcademicSummary(id, academic_year_id, semester_id);
        return successResponse(result, 'Class academic summary retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving class academic summary.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
