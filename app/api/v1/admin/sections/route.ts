import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { updateSectionDraft, publishSection, updateSectionItems } from '@/lib/services/sectionService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function PATCH(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const body = await req.json();
        const { action, id } = body;
        
        if (!id) {
          return errorResponse('Missing section id.', 'ERR_VALIDATION', 400);
        }
        
        if (action === 'draft') {
          const { draftContent } = body;
          await updateSectionDraft(id, draftContent, actorId);
          return successResponse(null, 'Section draft updated successfully.');
        } else if (action === 'publish') {
          await publishSection(id, actorId);
          return successResponse(null, 'Section published successfully.');
        } else if (action === 'items') {
          const { items } = body;
          if (!Array.isArray(items)) {
            return errorResponse('Items payload must be an array.', 'ERR_VALIDATION', 400);
          }
          await updateSectionItems(id, items);
          return successResponse(null, 'Section items updated successfully.');
        } else {
          return errorResponse('Invalid action specified.', 'ERR_VALIDATION', 400);
        }
        
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error processing section update.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
