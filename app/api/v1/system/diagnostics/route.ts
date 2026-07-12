import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

const TABLES_TO_CHECK = [
  'users', 'students', 'teachers', 'academic_years', 'semesters',
  'classes', 'subjects', 'class_subjects', 'spp_payments', 'audit_logs'
];

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const start = Date.now();

        const tableStats: Record<string, number> = {};
        for (const table of TABLES_TO_CHECK) {
          try {
            const res = await (db as any)(table).count('* as count').first();
            tableStats[table] = Number(res?.count || 0);
          } catch (e) {
            tableStats[table] = -1;
          }
        }

        const responseTime = Date.now() - start;

        return successResponse({
          app_status: 'healthy',
          database_status: 'connected',
          response_time_ms: responseTime,
          table_record_counts: tableStats,
          memory_usage: process.memoryUsage(),
          uptime_seconds: process.uptime(),
          node_version: process.version,
          platform: process.platform
        }, 'System diagnostics retrieved.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
