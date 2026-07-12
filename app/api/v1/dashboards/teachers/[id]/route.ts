import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getTeacherDashboard } from '@/lib/services/dashboardService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const data = await getTeacherDashboard(id);
        return successResponse(data, 'Teacher dashboard retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
