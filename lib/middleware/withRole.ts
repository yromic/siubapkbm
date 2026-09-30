import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/response';

export async function withRole(
  roles: string[],
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const cachedUser = (req as any).user;
  if (!cachedUser?.id) {
    return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
  }

  // Fast-path: reuse verified role attached by withAuth on the request context
  if (cachedUser.role) {
    if (!roles.includes(cachedUser.role)) {
      return errorResponse('Forbidden: Insufficient permissions', 'ERR_FORBIDDEN', 403);
    }
    return handler();
  }

  // Fallback query if role is not present on request context
  try {
    const user = await db('users')
      .select('role')
      .where('id', cachedUser.id)
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
