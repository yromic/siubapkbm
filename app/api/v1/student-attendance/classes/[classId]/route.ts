import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import {
  getClassAttendance,
  saveClassAttendance,
} from '@/lib/services/studentAttendanceService';
import { getSchoolTodayDate } from '@/lib/utils/schoolDate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/student-attendance/classes/[classId]?date=YYYY-MM-DD
 *
 * Retrieves attendance detail and reconciled temporal roster for a class and date.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const { classId } = await params;
        const user = (req as any).user as { id: string; role: string };
        const url = new URL(req.url);
        const dateParam = url.searchParams.get('date') || getSchoolTodayDate();

        const result = await getClassAttendance(classId, dateParam, user);

        return successResponse(result, 'Data presensi kelas berhasil dimuat.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal memuat data presensi kelas.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

/**
 * POST /api/v1/student-attendance/classes/[classId]
 *
 * Atomically creates or updates attendance for an entire class.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const { classId } = await params;
        const user = (req as any).user as { id: string; role: string; name?: string };
        const body = await req.json();

        const ip =
          req.headers.get('x-forwarded-for') ||
          (req as any).ip ||
          undefined;
        const userAgent = req.headers.get('user-agent') || undefined;

        const result = await saveClassAttendance(classId, body, {
          id: user.id,
          role: user.role,
          name: user.name,
          ip: typeof ip === 'string' ? ip.split(',')[0].trim() : undefined,
          userAgent,
        });

        return successResponse(result, 'Presensi kelas berhasil disimpan.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal menyimpan presensi kelas.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
