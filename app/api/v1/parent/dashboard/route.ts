import { NextRequest } from 'next/server';
import { withParentAuth } from '@/lib/middleware/withParentAuth';
import { getParentDashboard } from '@/lib/services/parentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withParentAuth(req, async (req, studentId) => {
    try {
      const data = await getParentDashboard(studentId);
      return successResponse(data, 'Dashboard data retrieved.');
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
      return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
    }
  });
}
