import { NextRequest } from 'next/server';
import { getNavigationMenu } from '@/lib/services/navigationService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const menuName = searchParams.get('menu') || 'navbar';
    
    const menu = await getNavigationMenu(menuName);
    if (!menu) {
      return errorResponse('Menu not found', 'ERR_NOT_FOUND', 404);
    }
    
    return successResponse(menu, 'Navigation menu retrieved successfully.');
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Database error retrieving navigation menu.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
