import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { getAdminDashboardOverview } from '@/lib/services/studentAttendanceService';
import { getSchoolTodayDate } from '@/lib/utils/schoolDate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/student-attendance/dashboard?date=YYYY-MM-DD
 *
 * Returns daily school-wide student attendance dashboard for admin/administrator.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const url = new URL(req.url);
        const dateParam = url.searchParams.get('date') || getSchoolTodayDate();

        const result = await getAdminDashboardOverview(dateParam);

        return successResponse(
          result,
          'Ringkasan dashboard presensi harian berhasil dimuat.'
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error
            ? error.message
            : 'Gagal memuat ringkasan dashboard presensi.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
