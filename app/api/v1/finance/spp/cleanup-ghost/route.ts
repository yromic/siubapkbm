import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { db } from '@/lib/db';

/**
 * POST /api/v1/finance/spp/cleanup-ghost
 *
 * Identifies and optionally soft-deletes "ghost arrear" SPP records — unpaid
 * records for months that fall BEFORE the student's enrollment date in that
 * academic year.
 *
 * Request body:
 *   { dry_run?: boolean, student_nisn?: string }
 *
 * - dry_run = true  (default): returns a preview count + affected records only.
 * - dry_run = false          : performs the soft-delete and returns a summary.
 * - student_nisn             : optional filter to scope the cleanup to a single student.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator'], req, async () => {
      try {
        const body = await req.json().catch(() => ({}));
        const dryRun: boolean = body.dry_run !== false; // default true for safety
        const studentNisn: string | undefined = body.student_nisn;

        // --- 1. Build the list of ghost records ---
        // A ghost record is an spp_payments row where:
        //   payment_status = 'unpaid'
        //   lifecycle_status != 'soft_deleted'
        //   AND the (payment_year, payment_month) falls before the student's
        //       earliest active enrollment created_at in the same academic year.

        const enrollmentsQuery = db('student_enrollments as se')
          .join('students as s', 's.id', 'se.student_id')
          .where('se.status', 'active')
          .whereNot('se.lifecycle_status', 'soft_deleted')
          .select(
            'se.student_id',
            'se.academic_year_id',
            'se.created_at as enrollment_created_at',
            's.nisn as student_nisn',
            's.full_name as student_name'
          );

        if (studentNisn) {
          enrollmentsQuery.where('s.nisn', studentNisn);
        }

        // Use the earliest (minimum) enrollment per (student, academic_year)
        // in case of duplicate enrollments.
        const rawEnrollments = await enrollmentsQuery;

        // Deduplicate: keep the earliest enrollment per student+year
        const enrollmentMap: Record<string, {
          student_id: string;
          academic_year_id: string;
          enrollment_created_at: Date;
          student_nisn: string;
          student_name: string;
        }> = {};
        for (const e of rawEnrollments) {
          const key = `${e.student_id}::${e.academic_year_id}`;
          const eDate = new Date(e.enrollment_created_at);
          if (!enrollmentMap[key] || eDate < new Date(enrollmentMap[key].enrollment_created_at)) {
            enrollmentMap[key] = {
              ...e,
              enrollment_created_at: eDate
            };
          }
        }

        const ghostRecords: {
          id: string;
          student_id: string;
          student_nisn: string;
          student_name: string;
          academic_year_id: string;
          payment_month: number;
          payment_year: number;
          amount_due: number;
          enrollment_created_at: Date;
        }[] = [];

        for (const key of Object.keys(enrollmentMap)) {
          const e = enrollmentMap[key];
          const enrollDate = new Date(e.enrollment_created_at);
          enrollDate.setDate(1);
          enrollDate.setHours(0, 0, 0, 0);

          // Enrollment month as integer YYYYMM for easy comparison
          const enrollYYYYMM = enrollDate.getFullYear() * 100 + (enrollDate.getMonth() + 1);

          // Find all unpaid SPP records for this student+year that predate enrollment month
          const candidateRecords = await db('spp_payments')
            .where({
              student_id: e.student_id,
              academic_year_id: e.academic_year_id,
              payment_status: 'unpaid'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .select('id', 'student_id', 'academic_year_id', 'payment_month', 'payment_year', 'amount_due');

          for (const r of candidateRecords) {
            const recordYYYYMM = Number(r.payment_year) * 100 + Number(r.payment_month);
            if (recordYYYYMM < enrollYYYYMM) {
              ghostRecords.push({
                id: r.id,
                student_id: r.student_id,
                student_nisn: e.student_nisn,
                student_name: e.student_name,
                academic_year_id: r.academic_year_id,
                payment_month: Number(r.payment_month),
                payment_year: Number(r.payment_year),
                amount_due: Number(r.amount_due),
                enrollment_created_at: e.enrollment_created_at
              });
            }
          }
        }

        const totalGhosts = ghostRecords.length;

        if (dryRun) {
          // Preview only — do not modify anything
          return successResponse(
            {
              dry_run: true,
              total_ghost_records: totalGhosts,
              preview: ghostRecords.map(r => ({
                spp_payment_id: r.id,
                student_nisn: r.student_nisn,
                student_name: r.student_name,
                ghost_month: r.payment_month,
                ghost_year: r.payment_year,
                amount_due: r.amount_due,
                enrollment_created_at: r.enrollment_created_at
              }))
            },
            `[DRY RUN] Found ${totalGhosts} ghost arrear record(s). Run with dry_run=false to soft-delete them.`
          );
        }

        // --- 2. Execute: soft-delete the ghost records ---
        if (totalGhosts === 0) {
          return successResponse(
            { dry_run: false, total_soft_deleted: 0 },
            'No ghost arrear records found. Nothing to clean up.'
          );
        }

        const ghostIds = ghostRecords.map(r => r.id);
        await db('spp_payments')
          .whereIn('id', ghostIds)
          .update({
            lifecycle_status: 'soft_deleted',
            deleted_at: new Date(),
            updated_at: new Date()
          });

        return successResponse(
          {
            dry_run: false,
            total_soft_deleted: totalGhosts,
            soft_deleted_ids: ghostIds
          },
          `Successfully soft-deleted ${totalGhosts} ghost arrear SPP record(s).`
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Error during SPP ghost cleanup.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
