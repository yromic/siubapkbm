import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getStudentFileById } from '@/lib/services/studentFileService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import fs from 'fs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const file = await getStudentFileById(id);

        if (!fs.existsSync(file.file_path)) {
          return errorResponse('File not found on disk.', 'ERR_NOT_FOUND', 404);
        }

        const buffer = fs.readFileSync(file.file_path);
        const base64Content = buffer.toString('base64');

        return successResponse({
          file_id: file.id,
          file_name: file.original_filename,
          mime_type: file.mime_type,
          base64_content: base64Content
        }, 'File access retrieved successfully.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
