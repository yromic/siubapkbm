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

    // SPP Chart & Rate Calculations
    const sppList = await db('spp_payments').whereNot('lifecycle_status', 'soft_deleted');
    const sppByMonth: Record<string, { Lunas: number; Belum: number }> = {};
    for (const item of sppList) {
      const key = `${item.payment_year ?? "?"}-${String(item.payment_month ?? "?").padStart(2, "0")}`;
      if (!sppByMonth[key]) sppByMonth[key] = { Lunas: 0, Belum: 0 };
      if (item.payment_status === "paid") sppByMonth[key].Lunas++;
      else sppByMonth[key].Belum++;
    }
    const sppChartData = Object.entries(sppByMonth).slice(-6).map(([name, v]) => ({ name, ...v }));

    const totalSpp = sppList.length;
    const paidSpp = sppList.filter((s: any) => s.payment_status === "paid").length;
    const sppCompletionRate = totalSpp > 0 ? Math.round((paidSpp / totalSpp) * 100) : 0;
    const unpaidSppPercent = totalSpp > 0 ? Math.round(((totalSpp - paidSpp) / totalSpp) * 100) : 0;

    // --- REAL EXECUTIVE STATS CALCULATIONS ---

    // 1. Teacher Attendance Rate
    const totalAttendance = await db('teacher_attendance')
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();
    const totalAttendanceCount = Number(totalAttendance?.count || 0);

    const presentAttendance = await db('teacher_attendance')
      .whereNot('lifecycle_status', 'soft_deleted')
      .whereIn('status', ['present', 'late'])
      .count('id as count')
      .first();
    const presentAttendanceCount = Number(presentAttendance?.count || 0);
    const teacherAttendanceRate = totalAttendanceCount > 0 ? Math.round((presentAttendanceCount / totalAttendanceCount) * 100) : 100;

    // 2. Document Completion Rate
    const totalActiveStudentsRes = await db('students')
      .where('status', 'Aktif')
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();
    const totalActive = Number(totalActiveStudentsRes?.count || 0);

    const studentsWithDocsRes = await db('students')
      .where('status', 'Aktif')
      .whereNot('lifecycle_status', 'soft_deleted')
      .whereExists(function() {
        this.select('*')
          .from('student_files')
          .whereRaw('student_files.student_id = students.id')
          .whereNot('student_files.lifecycle_status', 'soft_deleted');
      })
      .count('id as count')
      .first();
    const withDocs = Number(studentsWithDocsRes?.count || 0);
    const docCompletionRate = totalActive > 0 ? Math.round((withDocs / totalActive) * 100) : 0;
    const docPieChartData = [
      { name: "Lengkap", value: withDocs },
      { name: "Belum Lengkap", value: totalActive - withDocs }
    ];

    // 3. FITRAH Radar Data
    let fitrahRadarData = [
      { subject: "Fathonah", A: 0, fullMark: 4 },
      { subject: "Istiqamah", A: 0, fullMark: 4 },
      { subject: "Tanggung Jawab", A: 0, fullMark: 4 },
      { subject: "Ramah", A: 0, fullMark: 4 },
      { subject: "Amanah", A: 0, fullMark: 4 },
      { subject: "Harmonis", A: 0, fullMark: 4 }
    ];

    if (activeSemester) {
      const averages = await db('character_semester_summaries')
        .where({ semester_id: activeSemester.id })
        .whereNot('lifecycle_status', 'soft_deleted')
        .select(
          db.raw('AVG(f_score) as f'),
          db.raw('AVG(i_score) as i'),
          db.raw('AVG(t_score) as t'),
          db.raw('AVG(r_score) as r'),
          db.raw('AVG(a_score) as a'),
          db.raw('AVG(h_score) as h')
        )
        .first();

      if (averages) {
        fitrahRadarData = [
          { subject: "Fathonah", A: parseFloat(Number(averages.f || 0).toFixed(2)), fullMark: 4 },
          { subject: "Istiqamah", A: parseFloat(Number(averages.i || 0).toFixed(2)), fullMark: 4 },
          { subject: "Tanggung Jawab", A: parseFloat(Number(averages.t || 0).toFixed(2)), fullMark: 4 },
          { subject: "Ramah", A: parseFloat(Number(averages.r || 0).toFixed(2)), fullMark: 4 },
          { subject: "Amanah", A: parseFloat(Number(averages.a || 0).toFixed(2)), fullMark: 4 },
          { subject: "Harmonis", A: parseFloat(Number(averages.h || 0).toFixed(2)), fullMark: 4 }
        ];
      }
    }

    // 4. Class Academic Averages
    const classAcademicAverages: Array<{ name: string; RataRata: number }> = [];
    const activeClasses = await db('classes').where('lifecycle_status', 'active');
    
    if (activeSemester) {
      for (const cls of activeClasses) {
        const avg = await db('academic_scores')
          .join('student_enrollments', 'academic_scores.student_id', 'student_enrollments.student_id')
          .join('academic_assessments', 'academic_scores.assessment_id', 'academic_assessments.id')
          .where('student_enrollments.class_id', cls.id)
          .where('student_enrollments.status', 'active')
          .where('student_enrollments.semester_id', activeSemester.id)
          .where('academic_assessments.semester_id', activeSemester.id)
          .whereNot('academic_scores.lifecycle_status', 'soft_deleted')
          .whereNot('academic_assessments.lifecycle_status', 'soft_deleted')
          .avg('academic_scores.score as avgScore')
          .first();
        classAcademicAverages.push({
          name: cls.name,
          RataRata: parseFloat(Number(avg?.avgScore || 0).toFixed(2))
        });
      }
    }

    // 5. Best Class Academic
    let bestClassAcademicName = "N/A";
    let bestClassAcademicAvg = "0.0";
    if (classAcademicAverages.length > 0) {
      const sorted = [...classAcademicAverages].sort((a, b) => b.RataRata - a.RataRata);
      if (sorted[0] && sorted[0].RataRata > 0) {
        bestClassAcademicName = sorted[0].name;
        bestClassAcademicAvg = sorted[0].RataRata.toFixed(1);
      }
    }

    // 6. Best Class Culture
    let bestCultureClassName = "N/A";
    let bestCultureClassAvg = "0.0";
    if (activeSemester && activeClasses.length > 0) {
      const classCultureAverages = [];
      for (const cls of activeClasses) {
        const avg = await db('character_semester_summaries')
          .join('student_enrollments', 'character_semester_summaries.student_enrollment_id', 'student_enrollments.id')
          .where('student_enrollments.class_id', cls.id)
          .where('student_enrollments.status', 'active')
          .where('student_enrollments.semester_id', activeSemester.id)
          .whereNot('character_semester_summaries.lifecycle_status', 'soft_deleted')
          .avg('character_semester_summaries.f_score as f')
          .avg('character_semester_summaries.i_score as i')
          .avg('character_semester_summaries.t_score as t')
          .avg('character_semester_summaries.r_score as r')
          .avg('character_semester_summaries.a_score as a')
          .avg('character_semester_summaries.h_score as h')
          .first();

        const sum = Number(avg?.f || 0) + Number(avg?.i || 0) + Number(avg?.t || 0) + Number(avg?.r || 0) + Number(avg?.a || 0) + Number(avg?.h || 0);
        const classAvg = sum > 0 ? parseFloat((sum / 6).toFixed(2)) : 0;
        classCultureAverages.push({ name: cls.name, avg: classAvg });
      }
      const sorted = classCultureAverages.sort((a, b) => b.avg - a.avg);
      if (sorted[0] && sorted[0].avg > 0) {
        bestCultureClassName = sorted[0].name;
        bestCultureClassAvg = sorted[0].avg.toFixed(1);
      }
    }

    // 7. Most Active Teacher
    let mostActiveTeacherName = "N/A";
    let mostActiveTeacherDesc = "Data tidak tersedia";
    if (activeSemester) {
      const activeTeacher = await db('academic_assessments')
        .join('users', 'academic_assessments.teacher_user_id', 'users.id')
        .where('academic_assessments.semester_id', activeSemester.id)
        .whereNot('academic_assessments.lifecycle_status', 'soft_deleted')
        .select('users.name')
        .count('academic_assessments.id as count')
        .groupBy('users.id', 'users.name')
        .orderBy('count', 'desc')
        .first();

      if (activeTeacher) {
        mostActiveTeacherName = String(activeTeacher.name);
        mostActiveTeacherDesc = `Telah mengunci ${activeTeacher.count} evaluasi belajar.`;
      }
    }

    // 8. Classes Without Wali
    let classesWithoutWali: string[] = [];
    if (activeSemester) {
      const classesWithWali = await db('class_teacher_assignments')
        .where({ semester_id: activeSemester.id, status: 'active' })
        .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
        .select('class_id');
      const classIdsWithWali = new Set(classesWithWali.map(c => c.class_id));
      classesWithoutWali = activeClasses
        .filter(c => !classIdsWithWali.has(c.id))
        .map(c => c.name);
    }

    // 9. Orphan Students Count
    let orphanStudentsCount = 0;
    if (activeSemester) {
      const enrolledStudentIds = await db('student_enrollments')
        .where({ semester_id: activeSemester.id, status: 'active' })
        .whereNot('lifecycle_status', 'soft_deleted')
        .select('student_id');
      const enrolledSet = new Set(enrolledStudentIds.map(e => e.student_id));

      const activeStudents = await db('students')
        .where('status', 'Aktif')
        .whereNot('lifecycle_status', 'soft_deleted')
        .select('id');

      orphanStudentsCount = activeStudents.filter(s => !enrolledSet.has(s.id)).length;
    }

    // 10. Failed Logins Count
    const failedLoginsRes = await db('users').sum('failed_login_attempts as count').first();
    const failedLoginsCount = Number(failedLoginsRes?.count || 0);

    return {
      total_students: totalStudents,
      total_teachers: totalTeachers,
      total_classes: totalClasses,
      active_year: activeYear ? activeYear.name : null,
      active_semester: activeSemester ? activeSemester.name : null,
      spp_this_month: sppStats,
      sppChartData,
      sppCompletionRate,
      unpaidSppPercent,
      teacherAttendanceRate,
      docCompletionRate,
      docPieChartData,
      fitrahRadarData,
      classAcademicAverages,
      bestClassAcademicName,
      bestClassAcademicAvg,
      mostActiveTeacherName,
      mostActiveTeacherDesc,
      bestCultureClassName,
      bestCultureClassAvg,
      classesWithoutWali,
      orphanStudentsCount,
      failedLoginsCount,
      lastIntegrityCheckTime: "N/A",
      lastIntegrityCheckStatus: "unknown"
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

export async function getStudentWatchlist(limit = 50) {
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
      .groupBy('students.id', 'students.full_name', 'students.nisn')
      .limit(limit);

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
      .groupBy('students.id', 'students.full_name', 'students.nisn')
      .limit(limit);

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
