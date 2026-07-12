import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getAppSettings, updateAppSettings } from '@/lib/services/appSettingsService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const result = await getAppSettings();
        return successResponse(result, 'App settings retrieved successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving app settings.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const body = await req.json();
        const result = await updateAppSettings(body, actorId);
        return successResponse(result, 'App settings updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating app settings.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
