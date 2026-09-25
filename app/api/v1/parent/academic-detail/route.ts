import { NextRequest } from 'next/server';
import { withParentAuth } from '@/lib/middleware/withParentAuth';
import { getParentAcademicDetail } from '@/lib/services/parentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withParentAuth(req, async (authenticatedReq, studentId) => {
    try {
      const url = new URL(authenticatedReq.url);
      const subjectCode = url.searchParams.get('subject_code');

      if (!subjectCode) {
        return errorResponse(
          'Parameter subject_code diperlukan.',
          'ERR_VALIDATION',
          400
        );
      }

      const data = await getParentAcademicDetail(studentId, subjectCode);
      return successResponse(data, 'Rincian nilai akademik berhasil dimuat.');
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'Gagal memuat rincian nilai akademik.',
        'ERR_INTERNAL_SERVER',
        500
      );
    }
  });
}
