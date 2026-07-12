import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { getImportDetail } from '@/lib/services/importService';
import { errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import fs from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { id } = await params;
        const log = await getImportDetail(id);

        if (!log.error_report_file_path || !fs.existsSync(log.error_report_file_path)) {
          return errorResponse('Error report file not found.', 'ERR_VALIDATION', 404);
        }

        const fileBuffer = fs.readFileSync(log.error_report_file_path);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="import-error-report.csv"'
          }
        });
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error downloading error report.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
