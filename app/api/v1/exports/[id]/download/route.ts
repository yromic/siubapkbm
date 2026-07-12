import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';

const EXPORTS_DIR = path.join(process.cwd(), 'storage', 'exports');
const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports');

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const log = await db('report_exports').where('id', id).first();
        if (!log) {
          return errorResponse('Export not found.', 'ERR_NOT_FOUND', 404);
        }

        // Try to locate the file: check storage/exports then storage/reports
        const fileId = log.file_id || id;
        const fileName = log.file_name || `${id}.csv`;

        const candidatePaths = [
          path.join(EXPORTS_DIR, `${fileId}-${fileName}`),
          path.join(EXPORTS_DIR, fileName),
          path.join(REPORTS_DIR, `${fileId}-${fileName}`),
          path.join(REPORTS_DIR, fileName),
        ];

        const filePath = candidatePaths.find(p => fs.existsSync(p));

        if (!filePath) {
          return errorResponse('Export file not found in storage.', 'ERR_FILE_NOT_FOUND', 404);
        }

        const fileBuffer = fs.readFileSync(filePath);
        const base64Content = fileBuffer.toString('base64');

        return successResponse(
          {
            export_id: id,
            file_name: log.file_name || fileName,
            mime_type: log.mime_type || 'text/csv',
            file_size: log.file_size || fileBuffer.length,
            base64_content: base64Content,
          },
          'Export file ready for download.'
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        console.error('[exports/download] Error:', error);
        return errorResponse(
          error instanceof Error ? error.message : 'Database error downloading export.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
