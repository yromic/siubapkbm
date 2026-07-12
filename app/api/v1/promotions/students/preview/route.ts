import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { previewPromotion } from '@/lib/services/promotionService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const body = await req.json();
        const result = await previewPromotion(body.source_class_id, body.target_class_id, body.academic_year_id, body.semester_id);
        return successResponse(result, 'Students promotion preview retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error previewing student promotion.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
