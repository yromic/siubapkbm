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

        const items = await db('class_teacher_assignments')
          .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
          .join('academic_years', 'class_teacher_assignments.academic_year_id', 'academic_years.id')
          .join('semesters', 'class_teacher_assignments.semester_id', 'semesters.id')
          .where('class_teacher_assignments.teacher_user_id', userId)
          .where('class_teacher_assignments.status', 'active')
          .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
          .select(
            'class_teacher_assignments.id as assignment_id',
            'class_teacher_assignments.academic_year_id',
            'class_teacher_assignments.semester_id',
            'class_teacher_assignments.effective_from',
            'classes.id as class_id',
            'classes.code as class_code',
            'classes.name as class_name',
            'classes.level as class_level',
            'academic_years.name as academic_year_name',
            'semesters.name as semester_name'
          );

        return successResponse(items, 'Assigned classes retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving assigned classes.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
