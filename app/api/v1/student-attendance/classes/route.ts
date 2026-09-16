import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { getClassesAttendanceOverview } from '@/lib/services/studentAttendanceService';
import { getSchoolTodayDate } from '@/lib/utils/schoolDate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/student-attendance/classes?date=YYYY-MM-DD
 *
 * Returns classes for student attendance landing:
 * - Teacher: assigned classes for the active semester
 * - Admin/Administrator: all active classes
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const url = new URL(req.url);
        const dateParam = url.searchParams.get('date') || getSchoolTodayDate();

        const classes = await getClassesAttendanceOverview(user, dateParam);

        return successResponse(
          { classes, total: classes.length, date: dateParam },
          'Daftar kelas presensi berhasil dimuat.'
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal memuat daftar kelas presensi.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
