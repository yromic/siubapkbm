import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getClassById, updateClass } from '@/lib/services/classService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        const result = await getClassById(id);

        const { searchParams } = new URL(req.url);
        const yearId = searchParams.get('year') || searchParams.get('academic_year_id') || undefined;
        const semId = searchParams.get('sem') || searchParams.get('semester_id') || undefined;

        let teacher_name = 'Belum ditentukan';
        let academic_year_name = '';
        let semester_name = '';

        if (yearId && semId) {
          const assignment = await db('class_teacher_assignments')
            .join('users', 'class_teacher_assignments.teacher_user_id', 'users.id')
            .join('academic_years', 'class_teacher_assignments.academic_year_id', 'academic_years.id')
            .join('semesters', 'class_teacher_assignments.semester_id', 'semesters.id')
            .where({
              'class_teacher_assignments.class_id': id,
              'class_teacher_assignments.academic_year_id': yearId,
              'class_teacher_assignments.semester_id': semId,
              'class_teacher_assignments.status': 'active'
            })
            .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
            .select(
              'users.name as teacher_name',
              'academic_years.name as academic_year_name',
              'semesters.name as semester_name'
            )
            .first();

          if (assignment) {
            teacher_name = assignment.teacher_name;
            academic_year_name = assignment.academic_year_name;
            semester_name = assignment.semester_name;
          }
        }

        const enriched = {
          ...result,
          teacher_name,
          academic_year_name,
          semester_name,
        };

        return successResponse(enriched, 'Class details retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving class.',
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
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        const body = await req.json();
        const result = await updateClass(id, body);
        return successResponse(result, 'Class updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating class.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
