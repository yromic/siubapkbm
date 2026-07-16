import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { bulkEnrollment } from '@/lib/services/enrollmentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const result = await bulkEnrollment(body);
        return successResponse(result, 'Bulk enrollment processed successfully.', 200);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error processing bulk enrollment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
