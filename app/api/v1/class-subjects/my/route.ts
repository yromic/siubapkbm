import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['teacher'], req, async () => {
      try {
        const userId = (req as any).user?.id;
        if (!userId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const items = await db('class_subjects')
          .join('classes', 'class_subjects.class_id', 'classes.id')
          .join('subjects', 'class_subjects.subject_id', 'subjects.id')
          .join('class_teacher_assignments', 'class_subjects.class_id', 'class_teacher_assignments.class_id')
          .where('class_teacher_assignments.teacher_user_id', userId)
          .where('class_teacher_assignments.status', 'active')
          .where('class_subjects.status', 'active')
          .whereNot('class_subjects.lifecycle_status', 'soft_deleted')
          .select(
            'class_subjects.*',
            'classes.name as class_name',
            'classes.code as class_code',
            'subjects.name as subject_name',
            'subjects.code as subject_code'
          );

        return successResponse(items, 'Assigned class subjects retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving assigned class subjects.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
