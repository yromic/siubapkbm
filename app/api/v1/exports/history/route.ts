import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const exportType = searchParams.get('export_type') || undefined;
        const status = searchParams.get('status') || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('page_size') || searchParams.get('limit') || '20', 10);

        const query = db('report_exports')
          .whereNot('lifecycle_status', 'soft_deleted')
          .orderBy('created_at', 'desc');

        if (exportType) query.where('report_type', exportType);
        if (status) query.where('status', status);

        const totalRes = await query.clone().count('id as count').first();
        const total = Number(totalRes?.count || 0);

        const offset = (page - 1) * pageSize;
        const rows = await query.limit(pageSize).offset(offset);

        // Map DB rows to ExportHistoryItem shape
        const exports = rows.map((row: any) => ({
          export_id: row.id,
          export_type: row.report_type,
          source_type: row.source_type,
          source_id: row.source_id,
          file_name: row.file_name,
          mime_type: row.mime_type,
          file_size: row.file_size,
          generated_by: row.generated_by,
          generated_at: row.generated_at,
          status: row.status,
          total_rows: row.total_rows,
          download_available: row.status === 'completed' && Boolean(row.file_name),
        }));

        return successResponse({ exports, total, page, page_size: pageSize }, 'Export history retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
