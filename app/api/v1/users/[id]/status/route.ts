import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { setUserStatus } from '@/lib/services/userService';
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
        const { status } = body;
        
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        if (status !== 'active' && status !== 'inactive') {
          return errorResponse('Status must be active or inactive.', 'ERR_VALIDATION', 400);
        }

        await setUserStatus(id, status, actorId);
        return successResponse(null, `User status updated to ${status} successfully.`);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating user status.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
