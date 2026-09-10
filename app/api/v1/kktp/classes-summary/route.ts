import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { getKKTPClassesSummary } from '@/lib/services/kktpNavigationService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/kktp/classes-summary
 *
 * Returns role-scoped class cards with subject breakdown for KKTP Level 1 landing.
 * - Admin/Administrator: all active classes
 * - Teacher: assigned classes only (via class_teacher_assignments)
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const items = await getKKTPClassesSummary(user);

        return successResponse(
          { items, total: items.length },
          'Ringkasan kelas KKTP berhasil dimuat.'
        );
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
