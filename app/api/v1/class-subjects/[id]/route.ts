import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { unassignSubjectFromClass, updateClassSubject } from '@/lib/services/classSubjectService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        const body = await req.json();
        const result = await updateClassSubject(id, body);
        return successResponse(result, 'Class subject assignment updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating class subject assignment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        const actorId = (req as any).user?.id;
        await unassignSubjectFromClass(id, actorId);
        return successResponse(null, 'Subject unassigned from class successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error unassigning subject from class.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
