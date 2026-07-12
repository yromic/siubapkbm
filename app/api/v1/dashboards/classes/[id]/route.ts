import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getClassDashboard } from '@/lib/services/dashboardService';
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
        const { searchParams } = new URL(req.url);
        const academic_year_id = searchParams.get('academic_year_id') || undefined;
        const semester_id = searchParams.get('semester_id') || undefined;

        const result = await getClassDashboard(id, academic_year_id, semester_id);
        return successResponse(result, 'Class dashboard stats retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error getting class dashboard.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
