import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getClassArrears } from '@/lib/services/sppService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'operator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get('class_id');

        if (!class_id) {
          return errorResponse('Class ID is required.', 'ERR_VALIDATION', 400);
        }

        const result = await getClassArrears(class_id);
        return successResponse(result, 'Class SPP arrears retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error fetching class SPP arrears.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
