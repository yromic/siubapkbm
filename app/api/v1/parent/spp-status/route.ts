import { NextRequest } from 'next/server';
import { withParentAuth } from '@/lib/middleware/withParentAuth';
import { getParentSppStatus } from '@/lib/services/parentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withParentAuth(req, async (req, studentId) => {
    try {
      const data = await getParentSppStatus(studentId);
      return successResponse(data, 'SPP status retrieved.');
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
      return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
    }
  });
}
