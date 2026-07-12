import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getAssessmentById, unlockAssessment } from '@/lib/services/assessmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function POST(
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

        const actor = await db('users').where('id', actorId).first();
        const assessment = await getAssessmentById(id);
        if (actor && actor.role === 'teacher' && assessment.teacher_user_id !== actorId) {
          return errorResponse('You do not have permission to unlock this assessment.', 'ERR_FORBIDDEN', 403);
        }

        const result = await unlockAssessment(id, actorId);
        return successResponse(result, 'Academic assessment unlocked successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error unlocking academic assessment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
