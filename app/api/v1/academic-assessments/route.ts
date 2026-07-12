import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listAssessments, createAssessment } from '@/lib/services/assessmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get('class_id') || undefined;
        const subject_id = searchParams.get('subject_id') || undefined;
        const academic_year_id = searchParams.get('academic_year_id') || undefined;
        const semester_id = searchParams.get('semester_id') || undefined;
        const status = searchParams.get('status') as any || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const actorId = (req as any).user?.id;
        const actor = await db('users').where('id', actorId).first();
        
        let teacher_user_id = undefined;
        if (actor && actor.role === 'teacher') {
          teacher_user_id = actorId;
        } else {
          teacher_user_id = searchParams.get('teacher_user_id') || undefined;
        }

        const result = await listAssessments(
          { class_id, subject_id, academic_year_id, semester_id, status, teacher_user_id },
          page,
          limit
        );
        return successResponse(result, 'Academic assessments list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing academic assessments.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'teacher'], req, async () => {
      try {
        const body = await req.json();
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const actor = await db('users').where('id', actorId).first();
        if (actor && actor.role === 'teacher') {
          body.teacher_user_id = actorId; // Force ownership for teacher
        }

        const result = await createAssessment(body, actorId);
        return successResponse(result, 'Academic assessment created successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating academic assessment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
