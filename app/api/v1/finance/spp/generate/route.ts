import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { generateSppRecordsForStudent } from '@/lib/services/sppService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const enrollments = await db('student_enrollments')
          .where('status', 'active')
          .whereNot('lifecycle_status', 'soft_deleted')
          .select('student_id', 'academic_year_id');

        let generated = 0;
        for (const e of enrollments) {
          await generateSppRecordsForStudent(e.student_id, e.academic_year_id);
          generated++;
        }

        return successResponse(
          { processed_enrollments: generated },
          `SPP records generated for ${generated} active enrollments.`
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Error generating SPP records.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
