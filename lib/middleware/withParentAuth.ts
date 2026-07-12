import { NextRequest, NextResponse } from 'next/server';
import { verifyParentToken } from '@/lib/services/parentService';
import { errorResponse } from '@/lib/response';

export async function withParentAuth(
  req: NextRequest,
  handler: (req: NextRequest, studentId: string) => Promise<NextResponse>
) {
  const token = req.cookies.get('parent_session_token')?.value;
  if (!token) {
    return errorResponse('Session expired', 'SESSION_EXPIRED', 401);
  }
  const session = await verifyParentToken(token);
  if (!session) {
    return errorResponse('Session expired', 'SESSION_EXPIRED', 401);
  }

  (req as any).parentSession = session;
  return handler(req, session.student_id);
}
