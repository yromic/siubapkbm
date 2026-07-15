import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { saveCultureScores, listCultureScoresByDate } from '@/lib/services/cultureScoreService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'teacher'], req, async () => {
      try {
        const body = await req.json();
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const result = await saveCultureScores(body, actorId);
        return successResponse(result, 'Culture scores saved successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error saving culture scores.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const score_date = searchParams.get('score_date');
        const class_id = searchParams.get('class_id');

        if (!score_date || !class_id) {
          return errorResponse('score_date (YYYY-MM-DD) and class_id query parameters are required.', 'ERR_VALIDATION', 400);
        }

        const actorId = (req as any).user?.id;
        const actor = await db('users').where('id', actorId).first();
        if (!actor) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        if (actor.role === 'teacher') {
          const isAssigned = await db('class_teacher_assignments')
            .where({
              class_id: class_id,
              teacher_user_id: actorId,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!isAssigned) {
            return errorResponse('You do not have permission to view scores for this class.', 'ERR_FORBIDDEN', 403);
          }
        }

        const result = await listCultureScoresByDate(score_date, class_id);
        return successResponse(result, 'Culture scores list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving culture scores.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
