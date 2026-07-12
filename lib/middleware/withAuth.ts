import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth/staffAuth';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/response';

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, context: any) => Promise<NextResponse>
) {
  const token = req.cookies.get('staff_session_token')?.value;
  if (!token) {
    return errorResponse('Session expired', 'SESSION_EXPIRED', 401);
  }
  const session = await verifyStaffToken(token);
  if (!session) {
    return errorResponse('Session expired', 'SESSION_EXPIRED', 401);
  }

  // Fetch role from users table
  const user = await db('users')
    .select('id', 'role', 'name', 'email', 'status', 'lifecycle_status')
    .where('id', session.user_id)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!user) {
    return errorResponse('User not found', 'ERR_USER_NOT_FOUND', 401);
  }

  (req as any).user = { id: user.id, role: user.role, name: user.name, email: user.email };
  return handler(req, {});
}
