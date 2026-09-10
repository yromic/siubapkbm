import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { getKKTPClassSubjects } from '@/lib/services/kktpNavigationService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/kktp/classes-summary/[classId]
 *
 * Backwards compatibility route: returns class subjects and summary for classId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const { classId } = await params;

        if (!classId) {
          return errorResponse('Parameter classId wajib diisi.', 'ERR_VALIDATION', 400);
        }

        const data = await getKKTPClassSubjects(classId, user);
        return successResponse(data, 'Ringkasan kelas KKTP berhasil dimuat.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal memuat ringkasan kelas KKTP.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
