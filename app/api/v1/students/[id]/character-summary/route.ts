import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { calculateAndGetSemesterSummary } from '@/lib/services/characterSummaryService';
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
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const academic_year_id = searchParams.get('academic_year_id');
        const semester_id = searchParams.get('semester_id');
        const refresh = searchParams.get('refresh') === 'true';
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!academic_year_id || !semester_id) {
          return errorResponse('academic_year_id and semester_id query parameters are required.', 'ERR_VALIDATION', 400);
        }

        // Trigger calculations first to make sure tables are updated
        const result = await calculateAndGetSemesterSummary(id, academic_year_id, semester_id, refresh);

        if (monthStr && yearStr) {
          const month = parseInt(monthStr, 10);
          const year = parseInt(yearStr, 10);
          const monthlySummary = await db('character_monthly_summaries')
            .where({
              student_id: id,
              summary_month: month,
              summary_year: year
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          const responseData = {
            f: monthlySummary && monthlySummary.f_score !== null ? parseFloat(monthlySummary.f_score) : null,
            i: monthlySummary && monthlySummary.i_score !== null ? parseFloat(monthlySummary.i_score) : null,
            t: monthlySummary && monthlySummary.t_score !== null ? parseFloat(monthlySummary.t_score) : null,
            r: monthlySummary && monthlySummary.r_score !== null ? parseFloat(monthlySummary.r_score) : null,
            a: monthlySummary && monthlySummary.a_score !== null ? parseFloat(monthlySummary.a_score) : null,
            h: monthlySummary && monthlySummary.h_score !== null ? parseFloat(monthlySummary.h_score) : null,
            days_counted: monthlySummary ? Number(monthlySummary.days_counted) || 0 : 0,
            period_information: `${monthStr}/${yearStr}`
          };

          return successResponse(responseData, 'Student character monthly summary retrieved.');
        }

        const responseData = {
          f: result && result.f_score !== null ? parseFloat(result.f_score) : null,
          i: result && result.i_score !== null ? parseFloat(result.i_score) : null,
          t: result && result.t_score !== null ? parseFloat(result.t_score) : null,
          r: result && result.r_score !== null ? parseFloat(result.r_score) : null,
          a: result && result.a_score !== null ? parseFloat(result.a_score) : null,
          h: result && result.h_score !== null ? parseFloat(result.h_score) : null,
          days_counted: result ? Number(result.days_counted) || 0 : 0,
          period_information: 'Semester'
        };

        return successResponse(responseData, 'Student character semester summary retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving character summary.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
