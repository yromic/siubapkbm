import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getTeacherProfileById, updateTeacherProfile } from '@/lib/services/teacherService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        const result = await getTeacherProfileById(id);
        return successResponse(result, 'Teacher profile details retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving teacher profile.',
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
        const result = await updateTeacherProfile(id, body);
        return successResponse(result, 'Teacher profile updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating teacher profile.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
