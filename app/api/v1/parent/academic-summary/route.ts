import { NextRequest } from 'next/server';
import { withParentAuth } from '@/lib/middleware/withParentAuth';
import { getParentAcademicSummary } from '@/lib/services/parentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withParentAuth(req, async (req, studentId) => {
    try {
      const { searchParams } = new URL(req.url);
      const academicYearId = searchParams.get('academic_year_id') || undefined;
      const semesterId = searchParams.get('semester_id') || undefined;
      const data = await getParentAcademicSummary(studentId, academicYearId, semesterId);
      return successResponse(data, 'Academic summary retrieved.');
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
      return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
    }
  });
}
