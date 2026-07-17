import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getAssessmentRoster } from '@/lib/services/enrollmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;

        if (!id) {
          return errorResponse('Assessment ID is required.', 'ERR_VALIDATION', 400);
        }

        // For teacher role: verify the teacher is assigned to the class that owns
        // this assessment before returning the roster.
        const actorId = (req as any).user?.id;
        const actorRole = (req as any).user?.role;

        if (actorRole === 'teacher') {
          const assessment = await db('academic_assessments')
            .where('id', id)
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!assessment) {
            return errorResponse('Assessment not found.', 'ERR_ASSESSMENT_NOT_FOUND', 404);
          }

          const isAssigned = await db('class_teacher_assignments')
            .where({
              class_id: assessment.class_id,
              teacher_user_id: actorId,
              status: 'active',
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!isAssigned) {
            return errorResponse(
              'You do not have permission to view the roster for this assessment.',
              'ERR_FORBIDDEN',
              403
            );
          }
        }

        const items = await getAssessmentRoster(id);

        // Map items to match the shape expected by the grading page (StudentSummary).
        // student_enrollment_id is kept so saveScores() can reference the enrollment.
        const mapped = items.map((item: any) => ({
          id: item.id,
          student_id: item.id,
          student_enrollment_id: item.student_enrollment_id,
          full_name: item.full_name,
          nisn: item.nisn,
          gender: item.gender,
          birth_date: item.birth_date,
          birth_place: item.birth_place,
          religion: item.religion,
          phone: item.phone,
          status: item.status === 'active' ? 'Aktif' : item.status === 'inactive' ? 'Tidak aktif' : item.status,
          enrolled_at: item.enrolled_at,
          withdrawn_at: item.withdrawn_at,
        }));

        return successResponse(mapped, 'Assessment roster retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving assessment roster.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
