import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getBackupPreview } from '@/lib/services/backupService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const { id } = await params;
        const result = await getBackupPreview(id);
        return successResponse(result, 'Backup preview retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
