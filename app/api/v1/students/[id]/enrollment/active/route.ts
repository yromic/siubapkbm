import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { getActiveEnrollmentByStudent } from '@/lib/services/enrollmentService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        
        // Find active semester
        const activeSem = await db('semesters')
          .where('is_active', 1)
          .whereNot('lifecycle_status', 'soft_deleted')
          .first();
        
        if (!activeSem) {
          return successResponse(null, 'No active semester found.');
        }

        const enrollment = await getActiveEnrollmentByStudent(id, activeSem.id);
        
        if (enrollment) {
          const classItem = await db('classes').where('id', enrollment.class_id).first();
          const academicYear = await db('academic_years').where('id', enrollment.academic_year_id).first();
          const semester = await db('semesters').where('id', enrollment.semester_id).first();
          
          const responseData = {
            ...enrollment,
            class_name: classItem?.name || '',
            class_code: classItem?.code || '',
            academic_year_name: academicYear?.name || '',
            semester_name: semester?.name || ''
          };
          return successResponse(responseData, 'Active student enrollment retrieved.');
        }

        return successResponse(null, 'No active enrollment found.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving student active enrollment.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
