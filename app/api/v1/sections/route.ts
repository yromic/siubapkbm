import { NextRequest } from 'next/server';
import { getActiveSections } from '@/lib/services/sectionService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDrafts = searchParams.get('preview') === 'true';
    
    const sections = await getActiveSections(includeDrafts);
    return successResponse(sections, 'Active sections retrieved successfully.');
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Database error retrieving landing sections.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
