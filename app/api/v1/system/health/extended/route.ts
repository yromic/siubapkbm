import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const start = Date.now();

        // DB check
        let dbStatus = 'ok';
        let dbLatencyMs = 0;
        try {
          const dbStart = Date.now();
          await db.raw('SELECT 1');
          dbLatencyMs = Date.now() - dbStart;
        } catch (e) {
          dbStatus = 'error';
        }

        // Storage check
        const storageDir = path.join(process.cwd(), 'storage');
        const storageExists = fs.existsSync(storageDir);
        let storageFreeBytes = 0;
        if (storageExists) {
          // Just check that directory is accessible
          try {
            fs.accessSync(storageDir, fs.constants.R_OK | fs.constants.W_OK);
          } catch (e) { /* noop */ }
        }

        // Table counts sample
        const tableCounts: Record<string, number> = {};
        const coreTables = ['users', 'students', 'academic_years', 'semesters', 'spp_payments', 'audit_logs'];
        for (const t of coreTables) {
          try {
            const res = await (db as any)(t).count('* as c').first();
            tableCounts[t] = Number(res?.c || 0);
          } catch (e) { tableCounts[t] = -1; }
        }

        const totalResponseMs = Date.now() - start;

        return successResponse({
          status: 'healthy',
          checks: {
            database: { status: dbStatus, latency_ms: dbLatencyMs },
            storage: { status: storageExists ? 'ok' : 'missing', path: storageDir }
          },
          table_counts: tableCounts,
          total_response_ms: totalResponseMs,
          server_time: new Date().toISOString(),
          uptime_seconds: Math.floor(process.uptime())
        }, 'Extended health check completed.');
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
