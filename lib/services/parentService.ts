import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import bcrypt from 'bcryptjs';
import { generateSessionToken, hashToken } from '@/lib/auth/tokenUtils';
import { getUTSMANSummary } from './utsmanCalculationService';
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

  // Character Summary calculation (UTSMAN schema)
  let character_summary = null;
  if (enrollment) {
    const utsmanData = await getUTSMANSummary(studentId, enrollment.semester_id).catch(() => null);
    if (utsmanData) {
      const u = utsmanData.u_score !== null ? Number(utsmanData.u_score) : null;
      const t = utsmanData.t_score !== null ? Number(utsmanData.t_score) : null;
      const s = utsmanData.s_score !== null ? Number(utsmanData.s_score) : null;
      const m = utsmanData.m_score !== null ? Number(utsmanData.m_score) : null;
      const a = utsmanData.a_score !== null ? Number(utsmanData.a_score) : null;
      const n = utsmanData.n_score !== null ? Number(utsmanData.n_score) : null;

      const validScores = [u, t, s, m, a, n].filter(v => v !== null) as number[];
      const overall_average = validScores.length > 0
        ? parseFloat((validScores.reduce((sum, val) => sum + val, 0) / validScores.length).toFixed(2))
        : null;

      character_summary = { u, t, s, m, a, n, overall_average, period_label: enrollment.semester_name || 'Semester Aktif' };
    }
  }

  // Student Attendance aggregate calculation (semester-scoped)
  const student_attendance = await getParentStudentAttendanceSummary(studentId, enrollment?.semester_id);

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
    student_attendance,
    enrollment,
    spp_this_month: sppStatus
  };
}

export async function getParentStudentAttendanceSummary(studentId: string, semesterId?: string) {
  let targetSemesterId = semesterId;
  if (!targetSemesterId) {
    const enrollment = await db('student_enrollments')
      .where({ student_id: studentId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();
    targetSemesterId = enrollment?.semester_id;
  }

  if (!targetSemesterId) {
    return {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
      terlambat: 0,
      total_days: 0,
      attendance_rate: null,
    };
  }

  const records = await db('student_attendance_records as sar')
    .join('student_attendance_sessions as sas', 'sar.session_id', 'sas.id')
    .where('sar.student_id', studentId)
    .where('sas.semester_id', targetSemesterId)
    .select('sar.status');

  let hadir = 0;
  let sakit = 0;
  let izin = 0;
  let alpa = 0;
  let terlambat = 0;

  for (const r of records) {
    const s = String(r.status || '').toLowerCase().trim();
    if (s === 'hadir') hadir++;
    else if (s === 'sakit') sakit++;
    else if (s === 'izin') izin++;
    else if (s === 'alpa') alpa++;
    else if (s === 'terlambat') terlambat++;
  }

  const total_days = hadir + sakit + izin + alpa + terlambat;
  const attendance_rate = total_days > 0 ? Math.round(((hadir + terlambat) / total_days) * 100) : null;

  return {
    hadir,
    sakit,
    izin,
    alpa,
    terlambat,
    total_days,
    attendance_rate,
  };
}

export async function getParentAcademicSummary(studentId: string, academicYearId?: string, semesterId?: string) {
  const student = await db('students')
    .where('id', studentId)
    .whereNot('status', 'soft_deleted')
    .first();

  if (!student) {
    throw new AppError('Student not found.', 'ERR_NOT_FOUND', 404);
  }

  // Get enrollment to find current period
  let yearId = academicYearId;
  let semId = semesterId;

  if (!yearId || !semId) {
    const enrollment = await db('student_enrollments')
      .where({ student_id: studentId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
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

  const year = await db('academic_years').where('id', yearId).first();
  const semester = await db('semesters').where('id', semId).first();

  const classAssessments = await db('academic_assessments')
    .where({
      class_id: validEnrollment.class_id,
      academic_year_id: yearId,
      semester_id: semId,
    })
    .whereIn('status', ['published', 'locked'])
    .whereNot('lifecycle_status', 'soft_deleted');

  const classSubjects = await db('class_subjects')
    .join('subjects', 'class_subjects.subject_id', 'subjects.id')
    .where({
      'class_subjects.class_id': validEnrollment.class_id,
      'class_subjects.semester_id': semId,
    })
    .whereNot('class_subjects.lifecycle_status', 'soft_deleted')
    .whereNot('subjects.lifecycle_status', 'soft_deleted')
    .select(
      'subjects.id as subject_id',
      'subjects.code as subject_code',
      'subjects.name as subject_name'
    );

  const subjectMap = new Map<string, {
    subject_id: string;
    subject_code: string;
    subject_name: string;
    sum: number;
    count: number;
    assessment_count: number;
  }>();

  for (const cs of classSubjects) {
    subjectMap.set(cs.subject_id, {
      subject_id: cs.subject_id,
      subject_code: cs.subject_code,
      subject_name: cs.subject_name,
      sum: 0,
      count: 0,
      assessment_count: 0,
    });
  }

  const missingSubjectIds = classAssessments
    .map((a: any) => a.subject_id)
    .filter((id: string) => !subjectMap.has(id));

  if (missingSubjectIds.length > 0) {
    const extraSubjects = await db('subjects').whereIn('id', missingSubjectIds);
    for (const es of extraSubjects) {
      subjectMap.set(es.id, {
        subject_id: es.id,
        subject_code: es.code,
        subject_name: es.name,
        sum: 0,
        count: 0,
        assessment_count: 0,
      });
    }
  }

  const assessmentIds = classAssessments.map((a: any) => a.id);
  const studentScores = assessmentIds.length > 0
    ? await db('academic_scores')
        .whereIn('assessment_id', assessmentIds)
        .where('student_id', studentId)
        .whereNot('lifecycle_status', 'soft_deleted')
    : [];

  const scoreMap = new Map<string, number>();
  for (const s of studentScores) {
    if (s.score !== null && s.score !== undefined && s.score !== '') {
      scoreMap.set(s.assessment_id, Number(s.score));
    }
  }

  let totalScoreSum = 0;
  let totalScoreCount = 0;

  for (const a of classAssessments) {
    const sSummary = subjectMap.get(a.subject_id);
    if (sSummary) {
      sSummary.assessment_count++;
      const scoreVal = scoreMap.get(a.id);
      if (scoreVal !== undefined && scoreVal !== null) {
        sSummary.sum += scoreVal;
        sSummary.count++;
        totalScoreSum += scoreVal;
        totalScoreCount++;
      }
    }
  }

  const subject_averages = Array.from(subjectMap.values()).map((s) => ({
    subject_code: s.subject_code,
    subject_name: s.subject_name,
    average_score: s.count > 0 ? parseFloat((s.sum / s.count).toFixed(2)) : null,
    assessment_count: s.assessment_count,
  }));

  const overall_average = totalScoreCount > 0
    ? parseFloat((totalScoreSum / totalScoreCount).toFixed(2))
    : null;

  return {
    student: {
      full_name: student.full_name,
      nisn: student.nisn,
    },
    period: {
      academic_year_name: year?.name || '',
      semester_name: semester?.name || '',
    },
    overall_average,
    total_assessments: classAssessments.length,
    completed_assessments: totalScoreCount,
    subject_averages,
  };
}

export async function getParentAcademicDetail(studentId: string, subjectCode: string) {
  if (!subjectCode) {
    throw new AppError('subject_code is required.', 'ERR_VALIDATION', 400);
  }

  const enrollment = await db('student_enrollments')
    .where({ student_id: studentId, status: 'active' })
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!enrollment) {
    throw new AppError('No active enrollment found for this student.', 'ERR_VALIDATION', 400);
  }

  let subject = await db('subjects')
    .where((qb: any) => {
      qb.where('code', subjectCode).orWhere('id', subjectCode).orWhere('name', subjectCode);
    })
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!subject) {
    // Fallback: historical subject definition lookup
    subject = await db('subjects')
      .where((qb: any) => {
        qb.where('code', subjectCode).orWhere('id', subjectCode).orWhere('name', subjectCode);
      })
      .first();
  }

  if (!subject) {
    throw new AppError('Subject not found.', 'ERR_NOT_FOUND', 404);
  }

  const assessments = await db('academic_assessments')
    .where({
      class_id: enrollment.class_id,
      academic_year_id: enrollment.academic_year_id,
      semester_id: enrollment.semester_id,
      subject_id: subject.id,
    })
    .whereIn('status', ['published', 'locked'])
    .whereNot('lifecycle_status', 'soft_deleted')
    .orderBy('assessment_date', 'asc');

  const assessmentIds = assessments.map((a: any) => a.id);
  const scores = assessmentIds.length > 0
    ? await db('academic_scores')
        .whereIn('assessment_id', assessmentIds)
        .where('student_id', studentId)
        .whereNot('lifecycle_status', 'soft_deleted')
    : [];

  const scoreMap = new Map<string, any>(scores.map((s: any) => [s.assessment_id, s.score]));

  const assessmentItems = assessments.map((a: any) => {
    const rawScore = scoreMap.get(a.id);
    const scoreVal = rawScore !== undefined && rawScore !== null && rawScore !== '' ? Number(rawScore) : null;
    return {
      assessment_title: a.title,
      assessment_date: a.assessment_date
        ? new Date(a.assessment_date).toISOString().split('T')[0]
        : '',
      score_min: Number(a.score_min || 0),
      score_max: Number(a.score_max || 100),
      score: scoreVal,
      assessment_status: a.status as 'published' | 'locked',
    };
  });

  return {
    subject_code: subject.code,
    subject_name: subject.name,
    assessments: assessmentItems,
  };
}

export async function getParentCharacterSummary(studentId: string, academicYearId?: string, semesterId?: string) {
  let yearId = academicYearId;
  let semId = semesterId;

  const student = await db('students')
    .where({ id: studentId })
    .whereNot('status', 'soft_deleted')
    .first();

  if (!student) {
    throw new AppError('Student not found.', 'ERR_NOT_FOUND', 404);
  }

  let enrollment = null;

  if (!yearId || !semId) {
    enrollment = await db('student_enrollments')
      .join('classes', 'student_enrollments.class_id', 'classes.id')
      .join('semesters', 'student_enrollments.semester_id', 'semesters.id')
      .join('academic_years', 'student_enrollments.academic_year_id', 'academic_years.id')
      .where({ 'student_enrollments.student_id': studentId, 'student_enrollments.status': 'active' })
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .select(
        'student_enrollments.class_id',
        'classes.name as class_name',
        'student_enrollments.academic_year_id',
        'academic_years.name as academic_year_name',
        'student_enrollments.semester_id',
        'semesters.name as semester_name'
      )
      .first();

    if (enrollment) {
      yearId = enrollment.academic_year_id;
      semId = enrollment.semester_id;
    }
  } else {
    enrollment = await db('student_enrollments')
      .join('classes', 'student_enrollments.class_id', 'classes.id')
      .join('semesters', 'student_enrollments.semester_id', 'semesters.id')
      .join('academic_years', 'student_enrollments.academic_year_id', 'academic_years.id')
      .where({
        'student_enrollments.student_id': studentId,
        'student_enrollments.academic_year_id': yearId,
        'student_enrollments.semester_id': semId,
      })
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .select(
        'student_enrollments.class_id',
        'classes.name as class_name',
        'student_enrollments.academic_year_id',
        'academic_years.name as academic_year_name',
        'student_enrollments.semester_id',
        'semesters.name as semester_name'
      )
      .first();
  }

  if (!yearId || !semId || !enrollment) {
    throw new AppError('No active enrollment found for the requested period.', 'ERR_VALIDATION', 400);
  }

  // Get UTSMAN summary from canonical table
  const utsmanRow = await getUTSMANSummary(studentId, semId).catch(() => null);

  const u = utsmanRow && utsmanRow.u_score !== null ? Number(utsmanRow.u_score) : null;
  const t = utsmanRow && utsmanRow.t_score !== null ? Number(utsmanRow.t_score) : null;
  const s = utsmanRow && utsmanRow.s_score !== null ? Number(utsmanRow.s_score) : null;
  const m = utsmanRow && utsmanRow.m_score !== null ? Number(utsmanRow.m_score) : null;
  const a = utsmanRow && utsmanRow.a_score !== null ? Number(utsmanRow.a_score) : null;
  const n = utsmanRow && utsmanRow.n_score !== null ? Number(utsmanRow.n_score) : null;

  const validScores = [u, t, s, m, a, n].filter((v): v is number => v !== null);
  const overall_average = validScores.length > 0
    ? parseFloat((validScores.reduce((sum, v) => sum + v, 0) / validScores.length).toFixed(2))
    : null;

  const dimensions = [
    {
      code: 'U',
      key: 'u',
      name: 'Ulet & Unggul',
      score: u,
      description: 'Kegigihan belajar, pantang menyerah, dan tekad berprestasi.',
      parent_explanation: 'Menunjukkan seberapa gigih ananda dalam mengaji, belajar, dan menghasilkan karya terbaik.'
    },
    {
      code: 'T',
      key: 't',
      name: "Ta'at & Tangguh",
      score: t,
      description: 'Ketaatan ibadah, kedisiplinan aturan, dan ketangguhan pribadi.',
      parent_explanation: 'Menunjukkan ketertiban ibadah dan ketangguhan sikap ananda saat menghadapi tantangan.'
    },
    {
      code: 'S',
      key: 's',
      name: 'Santun & Empati',
      score: s,
      description: 'Kesantunan bertutur kata, senyum, sapa, dan kepedulian sesama.',
      parent_explanation: 'Menunjukkan adab mulia ananda kepada guru, orang tua, dan teman sebaya.'
    },
    {
      code: 'M',
      key: 'm',
      name: 'Mandiri & Rapi',
      score: m,
      description: 'Kemandirian mengurus diri, kerapian barang, dan menjaga kebersihan.',
      parent_explanation: 'Menunjukkan inisiatif ananda dalam menjaga kebersihan diri dan merapikan perlengkapannya.'
    },
    {
      code: 'A',
      key: 'a',
      name: 'Amanah & Jujur',
      score: a,
      description: 'Kejujuran kata dan perbuatan, amanah terhadap tugas sekolah.',
      parent_explanation: 'Menunjukkan integritas ananda dalam berbicara jujur dan menepati komitmen belajar.'
    },
    {
      code: 'N',
      key: 'n',
      name: 'Nalar & Inisiatif',
      score: n,
      description: 'Daya nalar kritis, gemar bertanya, dan inisiatif tolong menolong.',
      parent_explanation: 'Menunjukkan keaktifan ananda dalam berpikir logis serta suka menolong sesama.'
    },
  ];

  // Determine strongest and strengthening areas from observed dimensions
  let strongest_dimension = null;
  let strengthening_area = null;

  const observedDimensions = dimensions.filter((d) => d.score !== null);
  if (observedDimensions.length > 0) {
    const sorted = [...observedDimensions].sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
    strongest_dimension = {
      code: sorted[0].code,
      name: sorted[0].name,
      score: sorted[0].score as number,
    };
    strengthening_area = {
      code: sorted[sorted.length - 1].code,
      name: sorted[sorted.length - 1].name,
      score: sorted[sorted.length - 1].score as number,
    };
  }

  return {
    student: {
      id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      class_name: enrollment.class_name || null,
      academic_year_name: enrollment.academic_year_name || null,
      semester_name: enrollment.semester_name || null,
    },
    period: {
      academic_year_id: yearId,
      academic_year_name: enrollment.academic_year_name || null,
      semester_id: semId,
      semester_name: enrollment.semester_name || null,
      label: enrollment.semester_name || 'Semester Aktif',
    },
    utsman: {
      u,
      t,
      s,
      m,
      a,
      n,
      overall_average,
    },
    dimensions,
    interpretation: {
      strongest_dimension,
      strengthening_area,
      available_count: observedDimensions.length,
      has_data: observedDimensions.length > 0,
      completeness_notice: observedDimensions.length === 6
        ? 'Semua dimensi karakter telah dinilai lengkap pada semester ini.'
        : observedDimensions.length > 0
        ? `Terdapat ${observedDimensions.length} dari 6 dimensi yang telah terobservasi.`
        : 'Belum ada observasi karakter untuk semester ini.',
    },
  };
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

