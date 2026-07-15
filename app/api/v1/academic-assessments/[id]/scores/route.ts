import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { saveScores, listScoresByAssessment } from '@/lib/services/academicScoreService';
import { getAssessmentById } from '@/lib/services/assessmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        // Ownership check: If teacher, must be owner of assessment or assigned to class
        const actor = await db('users').where('id', actorId).first();
        const assessment = await getAssessmentById(id);
        if (actor && actor.role === 'teacher' && assessment.teacher_user_id !== actorId) {
          const isAssigned = await db('class_teacher_assignments')
            .where({
              class_id: assessment.class_id,
              teacher_user_id: actorId,
              academic_year_id: assessment.academic_year_id,
              semester_id: assessment.semester_id,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!isAssigned) {
            return errorResponse('You do not have permission to modify scores for this assessment.', 'ERR_FORBIDDEN', 403);
          }
        }

        const body = await req.json();
        const result = await saveScores(id, body.scores, actorId);
        return successResponse(result, 'Academic scores saved successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error saving academic scores.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const result = await listScoresByAssessment(id);
        return successResponse(result, 'Academic scores list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving academic scores.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
