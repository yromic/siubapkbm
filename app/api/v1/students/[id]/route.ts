import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getStudentById, updateStudent } from '@/lib/services/studentService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const result = await getStudentById(id);
        const userRole = (req as any).user?.role;
        if (userRole === 'teacher') {
          const {
            nik,
            family_card_number,
            family_card_date,
            mother_name,
            mother_nik,
            father_name,
            father_nik,
            guardian_name,
            guardian_nik,
            address_street,
            rt,
            rw,
            hamlet,
            village,
            district,
            city,
            province,
            parent_access_pin_hash,
            ...basicData
          } = result;
          return successResponse(basicData, 'Student details retrieved.');
        }
        return successResponse(result, 'Student details retrieved.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error retrieving student.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        const body = await req.json();
        const result = await updateStudent(id, body);
        return successResponse(result, 'Student updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error updating student.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
