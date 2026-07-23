import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

/**
 * Generates monthly SPP payment records for a student in a given academic year.
 *
 * @param studentId       - Target student ID.
 * @param academicYearId  - Target academic year ID.
 * @param enrollmentDate  - (Optional) The date the student was enrolled in this academic year.
 *                          When provided, records will only be generated for months that fall
 *                          ON or AFTER the enrollment month. Earlier months are skipped to
 *                          prevent "ghost arrears" for students who joined mid-year.
 *                          Defaults to the academic year start date (generate all 12 months).
 */
export async function generateSppRecordsForStudent(
  studentId: string,
  academicYearId: string,
  enrollmentDate?: Date
) {
  const student = await db('students').where('id', studentId).first();
  const year = await db('academic_years').where('id', academicYearId).first();
  if (!student || !year) return;

  const sppAmount = Number(student.spp_amount || 250000.00);

  const yearStart = new Date(year.start_date);
  yearStart.setDate(1); // normalise to 1st of month

  // Determine the effective starting month for this student's SPP.
  // If an enrollmentDate is provided, use the later of (yearStart, enrollmentMonth).
  let effectiveStart: Date;
  if (enrollmentDate) {
    const enrollMonth = new Date(enrollmentDate);
    enrollMonth.setDate(1); // normalise to 1st of month
    enrollMonth.setHours(0, 0, 0, 0);
    effectiveStart = enrollMonth > yearStart ? enrollMonth : yearStart;
  } else {
    effectiveStart = yearStart;
  }

  let current = new Date(yearStart);

  // Loop through all 12 months of the academic year
  for (let i = 0; i < 12; i++) {
    const m = current.getMonth() + 1;
    const y = current.getFullYear();

    // Skip months that fall before the student's effective start month
    if (current < effectiveStart) {
      current.setMonth(current.getMonth() + 1);
      continue;
    }

    const existing = await db('spp_payments')
      .where({
        student_id: studentId,
        academic_year_id: academicYearId,
        payment_month: m,
        payment_year: y
      })
      .first();

    if (!existing) {
      await db('spp_payments').insert({
        id: uuidv4(),
        student_id: studentId,
        academic_year_id: academicYearId,
        payment_month: m,
        payment_year: y,
        amount_due: sppAmount,
        amount_paid: 0,
        payment_status: 'unpaid',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    current.setMonth(current.getMonth() + 1);
  }
}

export async function listPayments(
  filters: {
    student_id?: string;
    class_id?: string;
    payment_month?: number;
    payment_year?: number;
    payment_status?: string;
  } = {},
  page = 1,
  limit = 20
) {
  try {
    const query = db('spp_payments')
      .join('students', 'spp_payments.student_id', 'students.id')
      .leftJoin('student_enrollments', function (this: any) {
        this.on('students.id', 'student_enrollments.student_id')
          .andOn('student_enrollments.academic_year_id', 'spp_payments.academic_year_id');
      })
      .whereNot('spp_payments.lifecycle_status', 'soft_deleted');

    if (filters.student_id) {
      query.where('spp_payments.student_id', filters.student_id);
    }
    if (filters.payment_month) {
      query.where('spp_payments.payment_month', filters.payment_month);
    }
    if (filters.payment_year) {
      query.where('spp_payments.payment_year', filters.payment_year);
    }
    if (filters.payment_status) {
      if (filters.payment_status === 'unpaid') {
        // Exclude both 'paid' and 'verified' (legacy)
        query.whereNotIn('spp_payments.payment_status', ['paid', 'verified']);
      } else if (filters.payment_status === 'paid') {
        // Include both 'paid' and 'verified'
        query.whereIn('spp_payments.payment_status', ['paid', 'verified']);
      } else {
        query.where('spp_payments.payment_status', filters.payment_status);
      }
    }
    if (filters.class_id) {
      query.where('student_enrollments.class_id', filters.class_id);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.countDistinct('spp_payments.id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .select(
        'spp_payments.*',
        'students.full_name as student_name',
        'students.nisn as student_nisn'
      )
      .groupBy('spp_payments.id')
      .limit(limit)
      .offset(offset)
      .orderBy('spp_payments.payment_year', 'desc')
      .orderBy('spp_payments.payment_month', 'desc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing SPP payments',
      'ERR_DATABASE',
      500
    );
  }
}

export async function verifyPayment(
  input: {
    student_id: string;
    amount_paid: number;
    payment_method: string;
    notes?: string;
    advance_months?: number;
    payment_month?: number;
    payment_year?: number;
  },
  actorId: string
) {
  if (!input.student_id || !input.amount_paid || !input.payment_method) {
    throw new AppError('Missing required fields: student_id, amount_paid, and payment_method are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const enrollment = await db('student_enrollments')
      .where({ student_id: input.student_id, status: 'active' })
      .orderBy('created_at', 'asc')
      .first();

    const activeYear = await db('academic_years').where('is_active', 1).first();
    const yearId = enrollment ? enrollment.academic_year_id : (activeYear ? activeYear.id : null);
    if (!yearId) {
      throw new AppError('No active enrollment or academic year found.', 'ERR_VALIDATION', 400);
    }

    // Ensure SPP records are generated, respecting the student's enrollment date
    // so that months before enrollment are not created as ghost arrears.
    const enrollmentDate = enrollment?.created_at ? new Date(enrollment.created_at) : undefined;
    await generateSppRecordsForStudent(input.student_id, yearId, enrollmentDate);

    // Find target record:
    let targetRecord: any;
    if (input.payment_month && input.payment_year) {
      targetRecord = await db('spp_payments')
        .where({
          student_id: input.student_id,
          academic_year_id: yearId,
          payment_month: input.payment_month,
          payment_year: input.payment_year
        })
        .first();
    } else {
      // Find earliest unpaid record in active year (exclude 'paid' and 'verified')
      targetRecord = await db('spp_payments')
        .where({
          student_id: input.student_id,
          academic_year_id: yearId,
        })
        .whereNotIn('payment_status', ['paid', 'verified'])
        .whereNot('lifecycle_status', 'soft_deleted')
        .orderBy('payment_year', 'asc')
        .orderBy('payment_month', 'asc')
        .first();
    }

    if (!targetRecord) {
      throw new AppError('No unpaid SPP record found for verification.', 'ERR_VALIDATION', 400);
    }

    const recordsToVerify = [targetRecord];
    const advMonths = Number(input.advance_months || 0);

    if (advMonths > 0) {
      const nextUnpaid = await db('spp_payments')
        .where({
          student_id: input.student_id,
          academic_year_id: yearId,
        })
        .whereNotIn('payment_status', ['paid', 'verified'])
        .whereNot('id', targetRecord.id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .orderBy('payment_year', 'asc')
        .orderBy('payment_month', 'asc')
        .limit(advMonths);

      recordsToVerify.push(...nextUnpaid);
    }

    const results: any[] = [];
    await db.transaction(async (trx: any) => {
      for (const r of recordsToVerify) {
        await trx('spp_payments')
          .where('id', r.id)
          .update({
            payment_status: 'paid',
            amount_paid: r.amount_due, // fully paid
            payment_method: input.payment_method,
            notes: input.notes || null,
            verified_by: actorId,
            paid_at: new Date(),
            updated_at: new Date()
          });

        results.push({
          ...r,
          payment_status: 'paid',
          amount_paid: r.amount_due,
          payment_method: input.payment_method,
          notes: input.notes || null,
          verified_by: actorId,
          paid_at: new Date()
        });
      }
    });

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error verifying SPP payment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function verifyBulkPayments(
  input: {
    student_ids: string[];
    amount_paid: number;
    payment_method: string;
    notes?: string;
    advance_months?: number;
  },
  actorId: string
) {
  if (!input.student_ids || !Array.isArray(input.student_ids) || !input.amount_paid || !input.payment_method) {
    throw new AppError('Missing required fields.', 'ERR_VALIDATION', 400);
  }

  const results: any[] = [];
  for (const studentId of input.student_ids) {
    const res = await verifyPayment(
      {
        student_id: studentId,
        amount_paid: input.amount_paid,
        payment_method: input.payment_method,
        notes: input.notes,
        advance_months: input.advance_months
      },
      actorId
    );
    results.push(...res);
  }
  return results;
}

export async function revertPayment(id: string) {
  if (!id) {
    throw new AppError('Payment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('spp_payments')
      .where('id', id)
      .whereNotIn('lifecycle_status', ['soft_deleted'])
      .first();

    if (!existing) {
      throw new AppError(`SPP payment record with ID ${id} not found.`, 'ERR_VALIDATION', 404);
    }

    // Only allow revert if currently paid or verified
    if (!['paid', 'verified'].includes(existing.payment_status)) {
      throw new AppError('Only paid or verified records can be reverted.', 'ERR_VALIDATION', 400);
    }

    await db('spp_payments')
      .where('id', id)
      .update({
        payment_status: 'unpaid',
        amount_paid: 0,
        payment_method: null,
        notes: null,
        verified_by: null,
        paid_at: null,
        updated_at: new Date()
      });

    return {
      ...existing,
      payment_status: 'unpaid',
      amount_paid: 0,
      payment_method: null,
      notes: null,
      verified_by: null,
      paid_at: null
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error reverting SPP payment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getClassArrears(classId: string) {
  if (!classId) {
    throw new AppError('Class ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const records = await db('spp_payments')
      .join('students', 'spp_payments.student_id', 'students.id')
      .join('student_enrollments', function (this: any) {
        this.on('students.id', 'student_enrollments.student_id')
          .andOn('student_enrollments.academic_year_id', 'spp_payments.academic_year_id');
      })
      .where('student_enrollments.class_id', classId)
      .whereIn('spp_payments.payment_status', ['unpaid', 'partial'])
      .whereNot('spp_payments.lifecycle_status', 'soft_deleted')
      .select(
        'spp_payments.*',
        'students.full_name as student_name',
        'students.nisn as student_nisn'
      )
      .orderBy('students.full_name', 'asc')
      .orderBy('spp_payments.payment_year', 'asc')
      .orderBy('spp_payments.payment_month', 'asc');

    // Group by student
    const studentMap: Record<string, {
      student_id: string;
      student_name: string;
      student_nisn: string;
      total_arrears: number;
      unpaid_months: Array<{
        id: string;
        payment_month: number;
        payment_year: number;
        amount_due: number;
        amount_paid: number;
      }>;
    }> = {};

    for (const r of records) {
      if (!studentMap[r.student_id]) {
        studentMap[r.student_id] = {
          student_id: r.student_id,
          student_name: r.student_name,
          student_nisn: r.student_nisn,
          total_arrears: 0,
          unpaid_months: []
        };
      }

      const remaining = Number(r.amount_due) - Number(r.amount_paid);
      studentMap[r.student_id].total_arrears += remaining;
      studentMap[r.student_id].unpaid_months.push({
        id: r.id,
        payment_month: r.payment_month,
        payment_year: r.payment_year,
        amount_due: Number(r.amount_due),
        amount_paid: Number(r.amount_paid)
      });
    }

    return Object.values(studentMap);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error fetching class arrears',
      'ERR_DATABASE',
      500
    );
  }
}

/**
 * Returns all SPP statistics needed by the dashboard in a single call.
 * Business rules:
 *  - 'paid' and 'verified' both count as paid (same canonical rule as listPayments).
 *  - This-month summary uses payment_month / payment_year columns.
 *  - Chart shows last 6 months, aggregated in SQL (no full-table load).
 *  - Completion rate is computed from all non-deleted records across all time.
 *
 * @param month - current calendar month (1-indexed)
 * @param year  - current calendar year
 */
export async function getSppDashboardStats(
  month: number,
  year: number
): Promise<{
  this_month: Record<string, number>;
  chart_data: Array<{ name: string; Lunas: number; Belum: number }>;
  completion_rate: number;
  unpaid_percent: number;
}> {
  try {
    // --- 1. This-month summary by payment_status ---
    const monthSummary = await db('spp_payments')
      .where({ payment_month: month, payment_year: year })
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('payment_status')
      .count('id as count')
      .groupBy('payment_status');

    const thisMonth: Record<string, number> = { unpaid: 0, paid: 0, pending: 0, verified: 0 };
    for (const item of monthSummary) {
      thisMonth[item.payment_status] = Number((item as any).count || 0);
    }

    // --- 2. Overall completion rate (paid + verified) for the ACTIVE SEMESTER ---
    const activeSemester = await db('semesters')
      .where('is_active', 1)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    const monthsList: Array<{ month: number; year: number }> = [];
    if (activeSemester) {
      const start = new Date(activeSemester.start_date);
      const end = new Date(activeSemester.end_date);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (current <= last) {
        monthsList.push({
          month: current.getMonth() + 1,
          year: current.getFullYear()
        });
        current.setMonth(current.getMonth() + 1);
      }
    }

    const totalQuery = db('spp_payments').whereNot('lifecycle_status', 'soft_deleted');
    const paidQuery = db('spp_payments').whereNot('lifecycle_status', 'soft_deleted').whereIn('payment_status', ['paid', 'verified']);

    if (monthsList.length > 0) {
      totalQuery.where(function (this: any) {
        for (const m of monthsList) {
          this.orWhere({ payment_month: m.month, payment_year: m.year });
        }
      });
      paidQuery.where(function (this: any) {
        for (const m of monthsList) {
          this.orWhere({ payment_month: m.month, payment_year: m.year });
        }
      });
    } else {
      totalQuery.whereRaw('1 = 0');
      paidQuery.whereRaw('1 = 0');
    }

    const totalRes = await totalQuery.count('id as count').first();
    const totalSpp = Number(totalRes?.count || 0);

    const paidRes = await paidQuery.count('id as count').first();
    const paidSpp = Number(paidRes?.count || 0);

    const completionRate = totalSpp > 0 ? Math.round((paidSpp / totalSpp) * 100) : 0;
    const unpaidPercent = totalSpp > 0 ? Math.round(((totalSpp - paidSpp) / totalSpp) * 100) : 0;

    // --- 3. Chart: last 6 months, aggregated in SQL ---
    const monthWindows: Array<{ m: number; y: number; key: string }> = [];
    const cur = new Date(year, month - 1, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
      monthWindows.push({
        m: d.getMonth() + 1,
        y: d.getFullYear(),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      });
    }

    const chartRows = await db('spp_payments')
      .whereNot('lifecycle_status', 'soft_deleted')
      .where(function (this: any) {
        for (const w of monthWindows) {
          this.orWhere({ payment_month: w.m, payment_year: w.y });
        }
      })
      .select('payment_year', 'payment_month', 'payment_status')
      .count('id as count')
      .groupBy('payment_year', 'payment_month', 'payment_status');

    const chartMap: Record<string, { Lunas: number; Belum: number }> = {};
    for (const w of monthWindows) {
      chartMap[w.key] = { Lunas: 0, Belum: 0 };
    }
    for (const row of chartRows) {
      const key = `${row.payment_year}-${String(row.payment_month).padStart(2, '0')}`;
      if (!chartMap[key]) continue;
      const n = Number((row as any).count || 0);
      if (row.payment_status === 'paid' || row.payment_status === 'verified') {
        chartMap[key].Lunas += n;
      } else {
        chartMap[key].Belum += n;
      }
    }

    const chartData = monthWindows.map(w => ({ name: w.key, ...chartMap[w.key] }));

    return {
      this_month: thisMonth,
      chart_data: chartData,
      completion_rate: completionRate,
      unpaid_percent: unpaidPercent
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error calculating SPP dashboard stats',
      'ERR_DATABASE',
      500
    );
  }
}
