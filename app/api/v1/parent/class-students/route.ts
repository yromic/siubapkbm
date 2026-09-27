import { NextRequest } from 'next/server';
import { getParentPublicClassStudents } from '@/lib/services/parentService';
import { successResponse, errorResponse } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const data = await getParentPublicClassStudents();
    return successResponse(data, 'Class and student list retrieved successfully.');
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to retrieve class students.',
      'ERR_INTERNAL',
      500
    );
  }
}
