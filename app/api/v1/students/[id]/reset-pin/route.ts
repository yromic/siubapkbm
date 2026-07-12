import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { resetParentPin } from '@/lib/services/studentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        const body = await req.json();
        const { parent_access_pin } = body;

        if (!parent_access_pin) {
          return errorResponse('Parent access PIN is required.', 'ERR_VALIDATION', 400);
        }

        await resetParentPin(id, parent_access_pin);
        return successResponse(null, 'Parent access PIN reset successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error resetting parent PIN.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
