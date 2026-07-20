import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { updateNavigationLinks } from '@/lib/services/navigationService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function PATCH(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const { menuId, links } = body;
        
        if (!menuId || !Array.isArray(links)) {
          return errorResponse('Missing menuId or links payload.', 'ERR_VALIDATION', 400);
        }
        
        await updateNavigationLinks(menuId, links);
        return successResponse(null, 'Navigation menu links updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating navigation links.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
