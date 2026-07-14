import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listPayments } from '@/lib/services/sppService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'operator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const student_id = searchParams.get('student_id') || undefined;
        const class_id = searchParams.get('class_id') || undefined;
        const payment_status = searchParams.get('status') || undefined;
        const payment_month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
        const payment_year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const result = await listPayments(
          { student_id, class_id, payment_month, payment_year, payment_status },
          page,
          limit
        );
        return successResponse(result, 'SPP payments list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing SPP payments.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
