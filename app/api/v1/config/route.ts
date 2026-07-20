import { NextRequest } from 'next/server';
import { getWebsiteConfig } from '@/lib/services/websiteConfigService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const config = await getWebsiteConfig();
    return successResponse(config, 'Website configuration retrieved successfully.');
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Database error retrieving configuration.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
