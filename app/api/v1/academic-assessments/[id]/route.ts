import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getAssessmentById, updateAssessment, deleteAssessment } from '@/lib/services/assessmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

async function checkAssessmentOwnership(assessmentId: string, actorId: string) {
  const actor = await db('users').where('id', actorId).first();
  if (!actor) {
    throw new AppError('Actor user not found.', 'ERR_UNAUTHORIZED', 401);
  }

  const assessment = await getAssessmentById(assessmentId);
  if (actor.role === 'teacher') {
    if (assessment.teacher_user_id !== actorId) {
      // Check if teacher is assigned to the class for this period
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
        throw new AppError('You do not have permission to access this assessment.', 'ERR_FORBIDDEN', 403);
      }
    }
  }

  return assessment;
}

export async function GET(
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

        const result = await checkAssessmentOwnership(id, actorId);
        return successResponse(result, 'Academic assessment details retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving academic assessment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

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

        await checkAssessmentOwnership(id, actorId);
        const body = await req.json();
        const result = await updateAssessment(id, body);
        return successResponse(result, 'Academic assessment updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating academic assessment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function DELETE(
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

        await checkAssessmentOwnership(id, actorId);
        await deleteAssessment(id, actorId);
        return successResponse(null, 'Academic assessment deleted successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error deleting academic assessment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
