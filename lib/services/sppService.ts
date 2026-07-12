import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export async function generateSppRecordsForStudent(studentId: string, academicYearId: string) {
  const student = await db('students').where('id', studentId).first();
  const year = await db('academic_years').where('id', academicYearId).first();
  if (!student || !year) return;

  const sppAmount = Number(student.spp_amount || 250000.00);

  const start = new Date(year.start_date);
  const end = new Date(year.end_date);
  let current = new Date(start);
  current.setDate(1); // avoid end of month skip issues

  // Loop through 12 months of academic year
  for (let i = 0; i < 12; i++) {
    const m = current.getMonth() + 1;
    const y = current.getFullYear();

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
    const enrollments = await db('student_enrollments')
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted');

    for (const e of enrollments) {
      await generateSppRecordsForStudent(e.student_id, e.academic_year_id);
    }

    const query = db('spp_payments')
      .join('students', 'spp_payments.student_id', 'students.id')
      .leftJoin('student_enrollments', 'students.id', 'student_enrollments.student_id')
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
      query.where('spp_payments.payment_status', filters.payment_status);
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
      .first();

    const activeYear = await db('academic_years').where('is_active', 1).first();
    const yearId = enrollment ? enrollment.academic_year_id : (activeYear ? activeYear.id : null);
    if (!yearId) {
      throw new AppError('No active enrollment or academic year found.', 'ERR_VALIDATION', 400);
    }

    // Ensure SPP records are generated
    await generateSppRecordsForStudent(input.student_id, yearId);

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
      // Find earliest unpaid record in active year
      targetRecord = await db('spp_payments')
        .where({
          student_id: input.student_id,
          academic_year_id: yearId,
          payment_status: 'unpaid'
        })
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
          payment_status: 'unpaid'
        })
        .whereNot('id', targetRecord.id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .orderBy('payment_year', 'asc')
        .orderBy('payment_month', 'asc')
        .limit(advMonths);

      recordsToVerify.push(...nextUnpaid);
    }

    const results: any[] = [];
    await db.transaction(async (trx) => {
      for (const r of recordsToVerify) {
        await trx('spp_payments')
          .where('id', r.id)
          .update({
            payment_status: 'verified',
            amount_paid: r.amount_due, // fully paid
            payment_method: input.payment_method,
            notes: input.notes || null,
            verified_by: actorId,
            paid_at: new Date(),
            updated_at: new Date()
          });

        results.push({
          ...r,
          payment_status: 'verified',
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
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!existing) {
      throw new AppError(`SPP payment record with ID ${id} not found.`, 'ERR_VALIDATION', 404);
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
