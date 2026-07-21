import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { resetUserPassword } from '@/lib/services/userService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        const body = await req.json();
        const { new_password } = body;

        if (!new_password) {
          return errorResponse('New password is required.', 'ERR_VALIDATION', 400);
        }

        const ip = req.headers.get('x-forwarded-for') || (req as any).ip || undefined;
        const userAgent = req.headers.get('user-agent') || undefined;

        await resetUserPassword(id, new_password, 'session_revoked_password_reset', ip, userAgent);
        return successResponse(null, 'User password reset successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error resetting user password.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
