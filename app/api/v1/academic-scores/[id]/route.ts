import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { updateScore } from '@/lib/services/academicScoreService';
import { getAssessmentById } from '@/lib/services/assessmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const scoreObj = await db('academic_scores').where('id', id).first();
        if (!scoreObj) {
          return errorResponse('Score not found.', 'ERR_VALIDATION', 404);
        }

        const actor = await db('users').where('id', actorId).first();
        const assessment = await getAssessmentById(scoreObj.assessment_id);
        if (actor && actor.role === 'teacher' && assessment.teacher_user_id !== actorId) {
          return errorResponse('You do not have permission to modify this score.', 'ERR_FORBIDDEN', 403);
        }

        const body = await req.json();
        const result = await updateScore(id, body.score, body.note);
        return successResponse(result, 'Academic score updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating academic score.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
