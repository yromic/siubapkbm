import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listAcademicYears, createAcademicYear } from '@/lib/services/academicYearService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const is_active_raw = searchParams.get('is_active');
        const is_active = is_active_raw !== null ? is_active_raw === 'true' || is_active_raw === '1' : undefined;
        const lifecycle_status = searchParams.get('lifecycle_status') as any || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const result = await listAcademicYears({ is_active, lifecycle_status }, page, limit);
        return successResponse(result, 'Academic years list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing academic years.',
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
        const result = await createAcademicYear(body);
        return successResponse(result, 'Academic year created successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating academic year.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
