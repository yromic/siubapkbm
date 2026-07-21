import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import bcrypt from 'bcrypt';
import { generateSessionToken, hashToken } from '@/lib/auth/tokenUtils';
import { getStudentAcademicSummary } from './academicScoreService';
import { calculateAndGetSemesterSummary } from './characterSummaryService';
import { getSecuritySettingNum } from '@/lib/auth/securityUtils';
import { logAuthenticationEvent } from './auditService';

const PARENT_SESSION_HOURS = 2;

export async function loginParent(
  nisn: string,
  birthDate: string,
  pin: string,
  ip?: string,
  userAgent?: string
) {
  if (!nisn || !birthDate || !pin) {
    throw new AppError('nisn, birth_date, and parent_pin are required.', 'ERR_VALIDATION', 400);
  }

  // Normalize date format to YYYY-MM-DD
  const birthDateObj = new Date(birthDate);
  if (isNaN(birthDateObj.getTime())) {
    throw new AppError('Invalid birth date format.', 'ERR_VALIDATION', 400);
  }
  const formattedBirthDate = birthDateObj.toISOString().split('T')[0];

  const student = await db('students')
    .where('nisn', nisn)
    .whereRaw('DATE(birth_date) = ?', [formattedBirthDate])
    .whereNotIn('status', ['soft_deleted', 'archived'])
    .first();

  if (!student) {
    // Log attempt
    await logParentAccess(null, 'login_failed_no_student', false, ip, userAgent);
    await logAuthenticationEvent(nisn, 'parent', 'login_failed', false, ip, userAgent, 'Student/Parent credentials not found.');
    throw new AppError('Invalid NISN, birth date, or PIN.', 'ERR_UNAUTHORIZED', 401);
  }

  // Check for PIN lockout
  if (student.parent_access_pin_locked_until && new Date(student.parent_access_pin_locked_until) > new Date()) {
    const remainingMs = new Date(student.parent_access_pin_locked_until).getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    await logParentAccess(student.id, 'login_locked', false, ip, userAgent);
    await logAuthenticationEvent(nisn, 'parent', 'login_failed', false, ip, userAgent, 'Attempt to login on locked parent account.');
    throw new AppError(`Account is temporarily locked. Try again in ${remainingMins} minutes.`, 'ERR_ACCOUNT_LOCKED', 403);
  }

  // Check PIN hash
  const pinHash = student.parent_access_pin_hash;
  if (!pinHash) {
    await logAuthenticationEvent(nisn, 'parent', 'login_failed', false, ip, userAgent, 'Parent PIN is not configured.');
    throw new AppError('Parent access PIN is not configured. Please contact school admin.', 'ERR_NO_PIN', 403);
  }

  const isPinValid = await bcrypt.compare(pin, pinHash);
  if (!isPinValid) {
    const attempts = (student.parent_access_pin_failed_attempts || 0) + 1;
    const patch: any = { parent_access_pin_failed_attempts: attempts, updated_at: new Date() };
    
    const maxFailedLogin = await getSecuritySettingNum('MAX_FAILED_LOGIN', 5);
    const lockDuration = await getSecuritySettingNum('LOCK_DURATION', 15);
    
    if (attempts >= maxFailedLogin) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + lockDuration);
      patch.parent_access_pin_locked_until = lockUntil;
      
      await db('students').where('id', student.id).update(patch);
      await logParentAccess(student.id, 'login_locked', false, ip, userAgent);
      await logAuthenticationEvent(nisn, 'parent', 'account_locked', false, ip, userAgent, `Parent PIN locked for ${lockDuration} minutes due to ${attempts} failed attempts.`);
    } else {
      await db('students').where('id', student.id).update(patch);
      await logParentAccess(student.id, 'login_failed_invalid_pin', false, ip, userAgent);
      await logAuthenticationEvent(nisn, 'parent', 'login_failed', false, ip, userAgent, `Incorrect PIN. Failed attempts: ${attempts}.`);
    }
    throw new AppError('Invalid NISN, birth date, or PIN.', 'ERR_UNAUTHORIZED', 401);
  }

  // Reset failed attempts
  await db('students').where('id', student.id).update({
    parent_access_pin_failed_attempts: 0,
    parent_access_pin_locked_until: null,
    updated_at: new Date()
  });

  // Generate session token
  const { rawToken, hash } = generateSessionToken();
  const sessionId = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PARENT_SESSION_HOURS);

  // Revoke previous sessions for this student (Session Rotation)
  await db('parent_sessions')
    .where('student_id', student.id)
    .delete();

  await db('parent_sessions').insert({
    id: sessionId,
    student_id: student.id,
    token_hash: hash,
    issued_at: new Date(),
    expires_at: expiresAt,
    last_seen_at: new Date(),
    ip_address: ip || null,
    user_agent: userAgent || null,
    created_at: new Date(),
    updated_at: new Date()
  });

  await logParentAccess(student.id, 'login_success', true, ip, userAgent);
  await logAuthenticationEvent(nisn, 'parent', 'login_success', true, ip, userAgent);

  const { parent_access_pin_hash, parent_access_pin_failed_attempts, parent_access_pin_locked_until, ...safeStudent } = student;

  return {
    token: rawToken,
    student: safeStudent,
    expires_at: expiresAt
  };
}


export async function logoutParent(rawToken: string) {
  if (!rawToken) return;
  const hash = hashToken(rawToken);
  await db('parent_sessions').where('token_hash', hash).delete();
}

export async function verifyParentToken(rawToken: string): Promise<any> {
  if (!rawToken) return null;
  const hash = hashToken(rawToken);

  const session = await db('parent_sessions')
    .where('token_hash', hash)
    .andWhere('expires_at', '>', new Date())
    .first();

  if (!session) return null;

  await db('parent_sessions')
    .where('id', session.id)
    .update({ last_seen_at: new Date(), updated_at: new Date() });

  return session;
}

async function logParentAccess(
  studentId: string | null,
  action: string,
  success: boolean,
  ip?: string,
  userAgent?: string
) {
  try {
    if (!studentId) return;
    await db('parent_access_logs').insert({
      id: uuidv4(),
      student_id: studentId,
      action,
      success: success ? 1 : 0,
      ip_address: ip || null,
      user_agent: userAgent || null,
      attempted_at: new Date()
    });
  } catch (e) {
    // non-critical, ignore
  }
}

export async function getParentStudentData(studentId: string) {
  const student = await db('students')
    .where('id', studentId)
    .first();

  if (!student) throw new AppError('Student not found.', 'ERR_VALIDATION', 404);

  const { parent_access_pin_hash, ...safeStudent } = student;
  return safeStudent;
}

export async function getParentDashboard(studentId: string) {
  const student = await db('students').where('id', studentId).first();
  if (!student) throw new AppError('Student not found.', 'ERR_VALIDATION', 404);

  const enrollment = await db('student_enrollments')
    .join('classes', 'student_enrollments.class_id', 'classes.id')
    .join('semesters', 'student_enrollments.semester_id', 'semesters.id')
    .join('academic_years', 'student_enrollments.academic_year_id', 'academic_years.id')
    .where({ 'student_enrollments.student_id': studentId, 'student_enrollments.status': 'active' })
    .select(
      'student_enrollments.class_id',
      'classes.name as class_name',
      'student_enrollments.semester_id',
      'semesters.name as semester_name',
      'student_enrollments.academic_year_id',
      'academic_years.name as academic_year_name'
    )
    .first();

  // SPP status
  let sppStatus = null;
  if (enrollment) {
    const now = new Date();
    const sppRecord = await db('spp_payments')
      .where({
        student_id: studentId,
        academic_year_id: enrollment.academic_year_id,
        payment_month: now.getMonth() + 1,
        payment_year: now.getFullYear()
      })
      .first();
    sppStatus = sppRecord ? sppRecord.payment_status : 'not_generated';
  }

  // Academic Summary calculation
  let academic_summary = {
    average_score: null as number | null,
    completed_assessments: 0,
    total_assessments: 0,
    latest_assessment_date: null as string | null
  };

  if (enrollment) {
    const classAssessments = await db('academic_assessments')
      .where({
        class_id: enrollment.class_id,
        academic_year_id: enrollment.academic_year_id,
        semester_id: enrollment.semester_id
      })
      .whereIn('status', ['published', 'locked'])
      .whereNot('lifecycle_status', 'soft_deleted');

    academic_summary.total_assessments = classAssessments.length;

    if (classAssessments.length > 0) {
      const assessmentIds = classAssessments.map((a: any) => a.id);
      const studentScores = await db('academic_scores')
        .whereIn('assessment_id', assessmentIds)
        .where('student_id', studentId)
        .whereNot('lifecycle_status', 'soft_deleted');

      const validScores = studentScores.filter((s: any) => s.score !== null && s.score !== '');
      academic_summary.completed_assessments = validScores.length;

      if (validScores.length > 0) {
        const sum = validScores.reduce((acc: number, curr: any) => acc + Number(curr.score), 0);
        academic_summary.average_score = parseFloat((sum / validScores.length).toFixed(2));
      }

      const latest = classAssessments.reduce((prev: any, curr: any) => {
        return new Date(prev.assessment_date) > new Date(curr.assessment_date) ? prev : curr;
      });
      academic_summary.latest_assessment_date = latest.assessment_date
        ? new Date(latest.assessment_date).toISOString().split('T')[0]
        : null;
    }
  }

  // Character Summary calculation
  let character_summary = null;
  if (enrollment) {
    const semSummary = await calculateAndGetSemesterSummary(studentId, enrollment.academic_year_id, enrollment.semester_id).catch(() => null);
    if (semSummary) {
      const f = semSummary.f_score !== null ? Number(semSummary.f_score) : null;
      const i = semSummary.i_score !== null ? Number(semSummary.i_score) : null;
      const t = semSummary.t_score !== null ? Number(semSummary.t_score) : null;
      const r = semSummary.r_score !== null ? Number(semSummary.r_score) : null;
      const a = semSummary.a_score !== null ? Number(semSummary.a_score) : null;
      const h = semSummary.h_score !== null ? Number(semSummary.h_score) : null;

      let overall_average = null;
      const validScores = [f, i, t, r, a, h].filter(v => v !== null) as number[];
      if (validScores.length > 0) {
        overall_average = parseFloat((validScores.reduce((sum, val) => sum + val, 0) / validScores.length).toFixed(2));
      }

      character_summary = {
        f,
        i,
        t,
        r,
        a,
        h,
        overall_average,
        days_counted: semSummary.days_counted || 0,
        period_label: enrollment.semester_name || "Semester Aktif"
      };
    }
  }

  return {
    student: {
      id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      gender: student.gender,
      class_name: enrollment?.class_name || null,
      semester_name: enrollment?.semester_name || null,
      academic_year_name: enrollment?.academic_year_name || null
    },
    academic_summary,
    character_summary,
    enrollment,
    spp_this_month: sppStatus
  };
}

export async function getParentAcademicSummary(studentId: string, academicYearId?: string, semesterId?: string) {
  // Get enrollment to find current period
  let yearId = academicYearId;
  let semId = semesterId;

  if (!yearId || !semId) {
    const enrollment = await db('student_enrollments')
      .where({ student_id: studentId, status: 'active' })
      .first();
    if (enrollment) {
      yearId = yearId || enrollment.academic_year_id;
      semId = semId || enrollment.semester_id;
    }
  }

  if (!yearId || !semId) {
    throw new AppError('No active enrollment found.', 'ERR_VALIDATION', 400);
  }

  // Validate student is actually enrolled in requested period
  const validEnrollment = await db('student_enrollments')
    .where({ student_id: studentId, academic_year_id: yearId, semester_id: semId })
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!validEnrollment) {
    throw new AppError('Unauthorized: Student is not enrolled in the requested period.', 'ERR_VALIDATION', 403);
  }

  return await getStudentAcademicSummary(studentId, yearId, semId, true);
}

export async function getParentCharacterSummary(studentId: string, academicYearId?: string, semesterId?: string) {
  let yearId = academicYearId;
  let semId = semesterId;

  if (!yearId || !semId) {
    const enrollment = await db('student_enrollments')
      .where({ student_id: studentId, status: 'active' })
      .first();
    if (enrollment) {
      yearId = yearId || enrollment.academic_year_id;
      semId = semId || enrollment.semester_id;
    }
  }

  if (!yearId || !semId) {
    throw new AppError('No active enrollment found.', 'ERR_VALIDATION', 400);
  }

  // Validate student is actually enrolled in requested period
  const validEnrollment = await db('student_enrollments')
    .where({ student_id: studentId, academic_year_id: yearId, semester_id: semId })
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!validEnrollment) {
    throw new AppError('Unauthorized: Student is not enrolled in the requested period.', 'ERR_VALIDATION', 403);
  }

  try {
    return await calculateAndGetSemesterSummary(studentId, yearId, semId, false);
  } catch (e) {
    return { message: 'No character summary data yet.', f_score: 0, i_score: 0, t_score: 0, r_score: 0, a_score: 0, h_score: 0 };
  }
}

export async function getParentSppStatus(studentId: string) {
  const enrollments = await db('student_enrollments')
    .where({ student_id: studentId })
    .whereNot('lifecycle_status', 'soft_deleted')
    .orderBy('created_at', 'desc');

  if (enrollments.length === 0) {
    return { current_bill: null, arrears: [], total_arrears_amount: 0, history: [] };
  }

  const latestEnrollment = enrollments[0];
  const rawPayments = await db('spp_payments')
    .where({ student_id: studentId, academic_year_id: latestEnrollment.academic_year_id })
    .whereNot('lifecycle_status', 'soft_deleted')
    .orderBy('payment_year', 'asc')
    .orderBy('payment_month', 'asc');

  // Map DB column names to SppPayment interface field names
  const payments = rawPayments.map((p: any) => ({
    ...p,
    month: p.payment_month,
    year: p.payment_year,
  }));

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const unpaidPayments = payments.filter((p: any) => p.payment_status !== 'paid');

  // current_bill: the unpaid record for the current calendar month, or the oldest unpaid
  let current_bill: any = unpaidPayments.find(
    (p: any) => p.payment_month === currentMonth && p.payment_year === currentYear
  ) || unpaidPayments[0] || null;

  // arrears: all unpaid records BEFORE the current bill
  const arrears = current_bill
    ? unpaidPayments.filter((p: any) => p.id !== current_bill.id &&
        (p.payment_year < current_bill.payment_year ||
          (p.payment_year === current_bill.payment_year && p.payment_month < current_bill.payment_month)))
    : [];

  const total_arrears_amount = arrears.reduce(
    (sum: number, p: any) => sum + (Number(p.amount_due) - Number(p.amount_paid)),
    0
  );

  // history: all payments (paid + unpaid) for display
  return {
    current_bill,
    arrears,
    total_arrears_amount,
    history: payments,
  };
}


export async function getParentAvailablePeriods(studentId: string) {
  const enrollments = await db('student_enrollments')
    .join('semesters', 'student_enrollments.semester_id', 'semesters.id')
    .join('academic_years', 'student_enrollments.academic_year_id', 'academic_years.id')
    .where({ 'student_enrollments.student_id': studentId })
    .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
    .select(
      'student_enrollments.academic_year_id',
      'student_enrollments.semester_id',
      'student_enrollments.status',
      'semesters.name as semester_name',
      'academic_years.name as academic_year_name'
    );

  return enrollments;
}
