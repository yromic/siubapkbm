import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getTeacherDashboard } from '@/lib/services/dashboardService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (authenticatedReq) => {
    return withRole(['administrator', 'admin', 'teacher'], authenticatedReq, async () => {
      try {
        const { id } = await params;
        const currentUser = (authenticatedReq as any).user;

        // Security check (SEC-DASH-01): Teachers can only access their own dashboard
        if (currentUser?.role === 'teacher' && currentUser?.id !== id) {
          return errorResponse(
            'Anda tidak memiliki akses untuk melihat dashboard guru lain.',
            'ERR_FORBIDDEN',
            403
          );
        }

        const data = await getTeacherDashboard(id);
        return successResponse(data, 'Teacher dashboard retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
