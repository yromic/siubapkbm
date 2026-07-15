import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { executePromotion } from '@/lib/services/promotionService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const body = await req.json();
        const actor = (req as any).user;
        const result = await executePromotion(
          body.source_academic_year_id,
          body.source_semester_id,
          body.target_academic_year_id,
          body.target_semester_id,
          body.overrides || [],
          actor
        );
        return successResponse(result, 'Students promotion executed successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error executing student promotion.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
