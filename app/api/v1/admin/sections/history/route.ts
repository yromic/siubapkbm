import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getSectionHistory, rollbackSection } from '@/lib/services/sectionService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

// GET /api/v1/admin/sections/history?sectionId=... - List history snapshots for a section
export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const sectionId = searchParams.get('sectionId');

        if (!sectionId) {
          return errorResponse('Missing sectionId param.', 'ERR_VALIDATION', 400);
        }

        const history = await getSectionHistory(sectionId);
        return successResponse(history, 'Section history retrieved successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error fetching section history.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

// POST /api/v1/admin/sections/history - Trigger rollback to a version
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const { sectionId, auditLogId } = body;

        if (!sectionId || !auditLogId) {
          return errorResponse('Missing sectionId or auditLogId in payload.', 'ERR_VALIDATION', 400);
        }

        await rollbackSection(sectionId, auditLogId);
        return successResponse(null, 'Section rolled back successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error rolling back section.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
