import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listSemesters, createSemester } from '@/lib/services/semesterService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const academic_year_id = searchParams.get('academic_year_id') || undefined;
        const is_active_raw = searchParams.get('is_active');
        const is_active = is_active_raw !== null ? is_active_raw === 'true' || is_active_raw === '1' : undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const result = await listSemesters({ academic_year_id, is_active }, page, limit);
        return successResponse(result, 'Semesters list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing semesters.',
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
        const result = await createSemester(body);
        return successResponse(result, 'Semester created successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating semester.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
