import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { listClasses, createClass } from '@/lib/services/classService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') as any || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        const result = await listClasses({ status }, page, limit);
        return successResponse(result, 'Classes list retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing classes.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const body = await req.json();
        const result = await createClass(body);
        return successResponse(result, 'Class created successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error creating class.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
