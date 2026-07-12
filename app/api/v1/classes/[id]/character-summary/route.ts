import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getClassCharacterSummary } from '@/lib/services/characterSummaryService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id: classId } = await params;
        const { searchParams } = new URL(req.url);
        const academic_year_id = searchParams.get('academic_year_id');
        const semester_id = searchParams.get('semester_id');
        const week_start_date = searchParams.get('week_start_date') || undefined;
        const month_raw = searchParams.get('month');
        const year_raw = searchParams.get('year');

        if (!academic_year_id || !semester_id) {
          throw new AppError('academic_year_id and semester_id are required.', 'ERR_VALIDATION', 400);
        }

        const month = month_raw ? parseInt(month_raw, 10) : undefined;
        const year = year_raw ? parseInt(year_raw, 10) : undefined;

        // Authorization check for teachers: make sure they are assigned to this class
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;
        if (userRole === 'teacher') {
          const assignment = await db('class_teacher_assignments')
            .where({
              class_id: classId,
              teacher_user_id: userId,
              academic_year_id,
              semester_id,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (!assignment) {
            return errorResponse('Forbidden: You are not authorized to view culture summaries for this class.', 'ERR_FORBIDDEN', 403);
          }
        }

        const result = await getClassCharacterSummary(classId, academic_year_id, semester_id, {
          week_start_date,
          month,
          year
        });

        return successResponse(result, 'Class character summary retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving class character summary.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
