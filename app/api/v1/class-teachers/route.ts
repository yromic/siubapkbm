import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listAssignments, createAssignment } from '@/lib/services/classTeacherAssignmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get('class_id') || undefined;
        const academic_year_id = searchParams.get('academic_year_id') || undefined;
        const semester_id = searchParams.get('semester_id') || undefined;
        const teacher_user_id = searchParams.get('teacher_user_id') || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const result = await listAssignments({ class_id, academic_year_id, semester_id, teacher_user_id }, page, limit);
        return successResponse(result, 'Class teacher assignments list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing class teacher assignments.',
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
        const result = await createAssignment(body);
        return successResponse(result, 'Teacher assigned to class successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating class teacher assignment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
