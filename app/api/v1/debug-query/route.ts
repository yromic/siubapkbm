import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [r] = await db.raw(`
    SELECT
      id,
      enrolled_at,
      DATE(enrolled_at) AS d_enroll,
      DATE(enrolled_at) <= '2026-07-15T17:00:00.000Z' AS passes_iso_utc,
      DATE(enrolled_at) <= '2026-07-15' AS passes_date_utc,
      DATE(enrolled_at) <= '2026-07-16' AS passes_date_wib,
      @@session.time_zone AS session_tz,
      @@global.time_zone AS global_tz
    FROM student_enrollments
    WHERE lifecycle_status != 'soft_deleted'
      AND class_id = '25345b5c-28e0-442c-9591-6922a2db405a'
  `);
  return NextResponse.json({ rows: r });
}
