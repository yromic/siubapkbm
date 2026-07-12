import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/response';

export async function withRole(
  roles: string[],
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const userId = (req as any).user?.id;
  if (!userId) {
    return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
  }

  try {
    const user = await db('users')
      .select('role')
      .where('id', userId)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!user) {
      return errorResponse('User not found', 'ERR_USER_NOT_FOUND', 404);
    }

    if (!roles.includes(user.role)) {
      return errorResponse('Forbidden: Insufficient permissions', 'ERR_FORBIDDEN', 403);
    }

    return handler();
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Database error checking permissions',
      'ERR_DATABASE',
      500
    );
  }
}
