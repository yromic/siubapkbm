import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getAdminDashboardAggregate } from '@/lib/services/dashboardService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const result = await getAdminDashboardAggregate();
        return successResponse(result, 'Admin dashboard aggregate retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error getting admin dashboard.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
