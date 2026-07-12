import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse } from '@/lib/response';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return successResponse({
      app_name: 'SIUBA',
      version: '1.0.0',
      description: 'Sistem Informasi Ujian Berbasis Akademik',
      environment: process.env.NODE_ENV || 'development',
      api_version: 'v1',
      build_date: '2026-07-09'
    }, 'Version info retrieved.');
  });
}
