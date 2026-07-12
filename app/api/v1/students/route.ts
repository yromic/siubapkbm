import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listStudents, createStudent } from '@/lib/services/studentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || undefined;
        const search = searchParams.get('search') || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const result = await listStudents({ status, search }, page, limit);
        return successResponse(result, 'Students list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing students.',
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
        const result = await createStudent(body);
        return successResponse(result, 'Student created successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating student.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
