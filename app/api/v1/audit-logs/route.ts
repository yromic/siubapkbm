import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { searchAuditLogs } from '@/lib/services/auditService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const filters = {
          user_id: searchParams.get('user_id') || undefined,
          action: searchParams.get('action') || undefined,
          entity_type: searchParams.get('entity_type') || undefined,
          entity_id: searchParams.get('entity_id') || undefined,
          date_from: searchParams.get('date_from') || undefined,
          date_to: searchParams.get('date_to') || undefined
        };
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const result = await searchAuditLogs(filters, page, limit);
        return successResponse(result, 'Audit logs retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
