import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { getAcademicCompleteness, getCultureCompleteness } from './completenessService';
import { getStudentAcademicSummary } from './academicScoreService';

export async function getSchoolDashboard() {
  try {
    const totalStudentsRes = await db('students').whereNot('status', 'soft_deleted').count('id as count').first();
    const totalStudents = Number(totalStudentsRes?.count || 0);

    const totalTeachersRes = await db('users').where('role', 'teacher').whereNot('lifecycle_status', 'soft_deleted').count('id as count').first();
    const totalTeachers = Number(totalTeachersRes?.count || 0);

    const totalClassesRes = await db('classes').where('lifecycle_status', 'active').count('id as count').first();
    const totalClasses = Number(totalClassesRes?.count || 0);

    const activeYear = await db('academic_years').where('is_active', 1).first();
    const activeSemester = activeYear
      ? await db('semesters').where({ academic_year_id: activeYear.id, is_active: 1 }).first()
      : null;

    // Monthly SPP summary
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const sppSummary = await db('spp_payments')
      .where({ payment_month: currentMonth, payment_year: currentYear })
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('payment_status')
      .count('id as count')
      .groupBy('payment_status');

    const sppStats: Record<string, number> = { unpaid: 0, paid: 0, pending: 0, verified: 0 };
    for (const item of sppSummary) {
      sppStats[item.payment_status] = Number((item as any).count || 0);
    }

    return {
      total_students: totalStudents,
      total_teachers: totalTeachers,
      total_classes: totalClasses,
      active_year: activeYear ? activeYear.name : null,
      active_semester: activeSemester ? activeSemester.name : null,
      spp_this_month: sppStats
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting school dashboard statistics',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getClassDashboard(classId: string, academicYearId?: string, semesterId?: string) {
  if (!classId) {
    throw new AppError('Class ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    let yearId = academicYearId;
    let semId = semesterId;

    // Fallback to active period if not provided
    if (!yearId || !semId) {
      const activeYear = await db('academic_years').where('is_active', 1).first();
      if (activeYear) {
        yearId = yearId || activeYear.id;
        const activeSem = await db('semesters').where({ academic_year_id: activeYear.id, is_active: 1 }).first();
        if (activeSem) {
          semId = semId || activeSem.id;
        }
      }
    }

    if (!yearId || !semId) {
      throw new AppError('No active period found in system. Please specify academic_year_id and semester_id.', 'ERR_VALIDATION', 400);
    }

    const studentsCountRes = await db('student_enrollments')
      .where({ class_id: classId, academic_year_id: yearId, semester_id: semId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const studentsCount = Number(studentsCountRes?.count || 0);

    const classTeachers = await db('class_teacher_assignments')
      .join('users', 'class_teacher_assignments.teacher_user_id', 'users.id')
      .where({
        'class_teacher_assignments.class_id': classId,
        'class_teacher_assignments.academic_year_id': yearId,
        'class_teacher_assignments.semester_id': semId,
        'class_teacher_assignments.status': 'active'
      })
      .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
      .select('users.id as teacher_id', 'users.name as teacher_name');

    // Get completeness stats
    const academicCompleteness = await getAcademicCompleteness(classId, yearId, semId);
    const cultureCompleteness = await getCultureCompleteness(classId, yearId, semId);

    return {
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semId,
      total_students: studentsCount,
      class_teachers: classTeachers,
      academic_completeness: academicCompleteness,
      culture_completeness: cultureCompleteness
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting class dashboard info',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getStudentProgressDashboard(studentId: string) {
  if (!studentId) throw new AppError('Student ID is required.', 'ERR_VALIDATION', 400);

  const student = await db('students').where('id', studentId).whereNot('status', 'soft_deleted').first();
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

  let academicSummary: any[] = [];
  let characterSummary: any = null;

  if (enrollment) {
    try {
      academicSummary = await getStudentAcademicSummary(studentId, enrollment.academic_year_id, enrollment.semester_id);
    } catch (e) { /* ignore */ }
  }

  return {
    student: {
      id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      gender: student.gender
    },
    current_enrollment: enrollment || null,
    academic_summary: academicSummary
  };
}

export async function getTeacherDashboard(teacherId: string) {
  if (!teacherId) throw new AppError('Teacher ID is required.', 'ERR_VALIDATION', 400);

  const teacher = await db('users')
    .where({ id: teacherId, role: 'teacher' })
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!teacher) throw new AppError('Teacher not found.', 'ERR_VALIDATION', 404);

  const teacherProfile = await db('teacher_profiles').where('user_id', teacherId).first();

  // Classes assigned
  const assignments = await db('class_teacher_assignments')
    .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
    .join('academic_years', 'class_teacher_assignments.academic_year_id', 'academic_years.id')
    .join('semesters', 'class_teacher_assignments.semester_id', 'semesters.id')
    .where({ 'class_teacher_assignments.teacher_user_id': teacherId, 'class_teacher_assignments.status': 'active' })
    .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
    .select(
      'classes.id as class_id',
      'classes.name as class_name',
      'academic_years.name as academic_year_name',
      'semesters.name as semester_name'
    );

  // Assessment count
  const assessmentsRes = await db('academic_assessments')
    .where('teacher_user_id', teacherId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .count('id as count')
    .first();

  const assessmentCount = Number(assessmentsRes?.count || 0);

  // Attendance summary (this month)
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const attendanceRes = await db('teacher_attendance')
    .where('teacher_id', teacherId)
    .where('date', '>=', monthStart)
    .whereNot('lifecycle_status', 'soft_deleted')
    .select('status')
    .count('id as count')
    .groupBy('status');

  const attendanceStats: Record<string, number> = {};
  for (const a of attendanceRes) {
    attendanceStats[a.status] = Number((a as any).count || 0);
  }

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role
    },
    profile: teacherProfile || null,
    class_assignments: assignments,
    total_assessments: assessmentCount,
    attendance_this_month: attendanceStats
  };
}

export async function getStudentWatchlist() {
  try {
    // Students with no academic scores in any active assessment
    const studentsWithNoScores = await db('student_enrollments')
      .leftJoin('academic_scores', 'student_enrollments.student_id', 'academic_scores.student_id')
      .join('students', 'student_enrollments.student_id', 'students.id')
      .where('student_enrollments.status', 'active')
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .whereNull('academic_scores.id')
      .select(
        'students.id',
        'students.full_name',
        'students.nisn',
        db.raw("'no_academic_scores' as reason")
      )
      .groupBy('students.id', 'students.full_name', 'students.nisn');

    // Students with no culture scores
    const studentsWithNoCulture = await db('student_enrollments')
      .leftJoin('culture_scores', 'student_enrollments.student_id', 'culture_scores.student_id')
      .join('students', 'student_enrollments.student_id', 'students.id')
      .where('student_enrollments.status', 'active')
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .whereNull('culture_scores.id')
      .select(
        'students.id',
        'students.full_name',
        'students.nisn',
        db.raw("'no_culture_scores' as reason")
      )
      .groupBy('students.id', 'students.full_name', 'students.nisn');

    // Merge and deduplicate
    const combined: Record<string, any> = {};
    for (const s of [...studentsWithNoScores, ...studentsWithNoCulture]) {
      if (!combined[s.id]) {
        combined[s.id] = { id: s.id, full_name: s.full_name, nisn: s.nisn, reasons: [] };
      }
      combined[s.id].reasons.push(s.reason);
    }

    return Object.values(combined);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Error getting student watchlist',
      'ERR_DATABASE',
      500
    );
  }
}
