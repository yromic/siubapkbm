import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getUTSMANSummary, calculateAndSaveUTSMAN } from '@/lib/services/utsmanCalculationService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';
import type { Knex } from 'knex';

/**
 * GET /api/v1/students/:id/character-summary
 *
 * Returns UTSMAN semester summary for a student.
 * semester_id is required. academic_year_id is accepted but not required
 * (UTSMAN table only uses semester_id).
 *
 * ?refresh=true  -> recalculates from culture_scores before returning
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const semester_id = searchParams.get('semester_id');
        const refresh = searchParams.get('refresh') === 'true';

        if (!semester_id) {
          return errorResponse('semester_id query parameter is required.', 'ERR_VALIDATION', 400);
        }

        // Authorization check for teachers: teacher must be assigned to student's class for this semester
        const actor = (req as unknown as { user?: { id: string; role: string } }).user;
        const actorId = actor?.id;
        const actorRole = actor?.role;
        if (actorRole === 'teacher' || actorRole === 'guru') {
          const isAuthorized = await db('student_enrollments')
            .join('class_teacher_assignments', (builder: Knex.JoinClause) => {
              builder.on('student_enrollments.class_id', '=', 'class_teacher_assignments.class_id')
                .andOn('student_enrollments.semester_id', '=', 'class_teacher_assignments.semester_id');
            })
            .where('student_enrollments.student_id', id)
            .where('student_enrollments.semester_id', semester_id)
            .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
            .where('class_teacher_assignments.teacher_user_id', actorId)
            .where('class_teacher_assignments.status', 'active')
            .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
            .first();

          if (!isAuthorized) {
            return errorResponse(
              'You do not have permission to view the character summary for this student.',
              'ERR_FORBIDDEN',
              403
            );
          }
        }

        let result = null;

        if (refresh) {
          // Recalculate from culture_scores and persist
          result = await calculateAndSaveUTSMAN(id, semester_id);
        } else {
          result = await getUTSMANSummary(id, semester_id);
          // If no record exists yet, auto-calculate
          if (!result) {
            result = await calculateAndSaveUTSMAN(id, semester_id);
          }
        }

        const responseData = {
          u: result && result.u_score !== null ? parseFloat(String(result.u_score)) : null,
          t: result && result.t_score !== null ? parseFloat(String(result.t_score)) : null,
          s: result && result.s_score !== null ? parseFloat(String(result.s_score)) : null,
          m: result && result.m_score !== null ? parseFloat(String(result.m_score)) : null,
          a: result && result.a_score !== null ? parseFloat(String(result.a_score)) : null,
          n: result && result.n_score !== null ? parseFloat(String(result.n_score)) : null,
          locked_at: result?.locked_at || null,
          calculation_version: result?.calculation_version || null,
          period_information: 'Semester'
        };

        return successResponse(responseData, 'Student UTSMAN character semester summary retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving character summary.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
