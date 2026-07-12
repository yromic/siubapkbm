import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { setupStorageFolders } from '@/lib/services/studentFileService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const result = await setupStorageFolders();
        return successResponse(result, 'Storage setup completed.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
