import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { uploadStudentFile, listStudentFiles } from '@/lib/services/studentFileService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        let files = await listStudentFiles(id);
        const userRole = (req as any).user?.role;
        if (userRole === 'teacher') {
          files = files.filter((f: any) => f.file_type === 'foto' || f.file_type === 'pas_foto');
        }
        return successResponse(files, 'Student files retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        const actorId = (req as any).user.id;
        const body = await req.json();
        const { file_type, file_content_base64, original_filename } = body;
        const result = await uploadStudentFile(id, file_type, file_content_base64, original_filename, actorId);
        return successResponse(result, 'File uploaded successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
