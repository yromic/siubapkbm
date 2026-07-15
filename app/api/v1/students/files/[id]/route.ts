import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { replaceStudentFile, archiveStudentFile, getStudentFileById } from '@/lib/services/studentFileService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import fs from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const file = await getStudentFileById(id);

        const userRole = (req as any).user?.role;
        if (userRole === 'teacher' && (file.file_type === 'kk' || file.file_type === 'akta' || file.file_type === 'dokumen_lain')) {
          return errorResponse('Insufficient permissions to access sensitive documents.', 'ERR_FORBIDDEN', 403);
        }

        const buffer = fs.readFileSync(file.file_path);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': file.mime_type,
            'Content-Disposition': `inline; filename="${file.original_filename}"`,
            'Content-Length': buffer.length.toString()
          }
        });
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { id } = await params;
        const actorId = (req as any).user.id;
        const body = await req.json();
        const { file_content_base64, original_filename } = body;
        const result = await replaceStudentFile(id, file_content_base64, original_filename, actorId);
        return successResponse(result, 'File replaced successfully.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
