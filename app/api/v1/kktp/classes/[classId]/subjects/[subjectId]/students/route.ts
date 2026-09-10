import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { getKKTPStudentsForClassSubject } from '@/lib/services/kktpNavigationService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/kktp/classes/[classId]/subjects/[subjectId]/students
 *
 * Level 3: Returns students for a Class × Subject with KKTP status and document metadata.
 * Server-side authorization: Teacher must be assigned to this class (403 if unauthorized).
 * Subject Isolation: Status is strictly scoped to this class × subject combination.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; subjectId: string }> }
) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const { classId, subjectId } = await params;

        if (!classId || !subjectId) {
          return errorResponse('Parameter classId dan subjectId wajib diisi.', 'ERR_VALIDATION', 400);
        }

        const data = await getKKTPStudentsForClassSubject(classId, decodeURIComponent(subjectId), user);

        return successResponse(data, 'Daftar murid dan status KKTP berhasil dimuat.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal memuat data murid KKTP.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
