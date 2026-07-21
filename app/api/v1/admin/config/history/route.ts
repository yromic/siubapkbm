import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getWebsiteConfigHistory, rollbackWebsiteConfig } from '@/lib/services/websiteConfigService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

// GET /api/v1/admin/config/history - List history snapshots
export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const history = await getWebsiteConfigHistory();
        return successResponse(history, 'Website config history retrieved successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error fetching configuration history.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

// POST /api/v1/admin/config/history - Trigger rollback to a version
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const { auditLogId } = body;

        if (!auditLogId) {
          return errorResponse('Missing auditLogId.', 'ERR_VALIDATION', 400);
        }

        const restored = await rollbackWebsiteConfig(auditLogId);
        return successResponse(restored, 'Website config rolled back successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error rolling back configuration.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
