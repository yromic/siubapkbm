import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { createImportSession } from '@/lib/services/importService';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const actorId = (req as any).user?.id;
        if (!actorId) {
          return errorResponse('Unauthorized', 'ERR_UNAUTHORIZED', 401);
        }

        const body = await req.json();
        // createImportSession saves file, parses CSV, validates rows, returns ImportSummary
        const result = await createImportSession(
          body.import_type,
          body.file_name,
          body.file_content_base64,
          actorId
        );
        return successResponse(result, 'Import session created and previewed.', 201);
      } catch (error) {
        console.error('[POST /api/v1/imports] ERROR:', error);
        if (error instanceof Error) {
          console.error('[POST /api/v1/imports] Stack:', error.stack);
        }
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Error creating import session.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const importType = searchParams.get('import_type') || undefined;
        const status = searchParams.get('status') || undefined;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('page_size') || '20', 10);

        const query = db('import_logs')
          .leftJoin('users', 'import_logs.uploaded_by', 'users.id')
          .select(
            'import_logs.id',
            'import_logs.import_type',
            'import_logs.file_name',
            'import_logs.uploaded_by',
            db.raw("COALESCE(users.name, 'Unknown') as uploader_name"),
            'import_logs.total_rows',
            'import_logs.success_rows',
            'import_logs.error_rows',
            'import_logs.error_report_file_path',
            'import_logs.status',
            'import_logs.error_summary',
            'import_logs.created_at',
            'import_logs.updated_at'
          )
          .orderBy('import_logs.created_at', 'desc');

        if (importType) query.where('import_logs.import_type', importType);
        if (status) query.where('import_logs.status', status);

        const totalRes = await query.clone().count('import_logs.id as count').first();
        const totalCount = Number(totalRes?.count || 0);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        const offset = (page - 1) * pageSize;
        const logs = await query.limit(pageSize).offset(offset);

        return successResponse(
          { logs, page, page_size: pageSize, total_count: totalCount, total_pages: totalPages },
          'Import history list retrieved.'
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error listing import logs.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
