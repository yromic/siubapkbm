import { NextRequest, NextResponse } from 'next/server';
// Force rebuild comment
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listEnrollments, createEnrollment } from '@/lib/services/enrollmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const student_id = searchParams.get('student_id') || undefined;
        const class_id = searchParams.get('class_id') || undefined;
        const semester_id = searchParams.get('semester_id') || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const userId = (req as any).user.id;
        if ((req as any).user.role === 'teacher') {
          if (!class_id) {
            return errorResponse('Forbidden: Teacher must specify class_id.', 'ERR_FORBIDDEN', 403);
          }
          const assignment = await db('class_teacher_assignments')
            .where({
              class_id: class_id,
              teacher_user_id: userId,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!assignment) {
            return errorResponse('Forbidden: You are not authorized to view student enrollments for this class.', 'ERR_FORBIDDEN', 403);
          }
        }

        const result = await listEnrollments({ student_id, class_id, semester_id }, page, limit);
        if ((req as any).user.role === 'teacher') {
          const mappedData = result.data.map((item: any) => ({
            ...item,
            id: item.student_id, // ensure student ID is returned as 'id' for profile links
            student_enrollment_id: item.id, // the enrollment ID
            status: item.status === 'active' ? 'Aktif' : item.status === 'inactive' ? 'Tidak aktif' : item.status
          }));
          return successResponse({ ...result, data: mappedData }, 'Enrollments list retrieved.');
        }
        return successResponse(result, 'Enrollments list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing enrollments.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const result = await createEnrollment(body);
        return successResponse(result, 'Student enrolled successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating enrollment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
