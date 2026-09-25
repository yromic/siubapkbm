import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  getAcademicCompleteness,
  getCultureCompleteness,
} from "./completenessService";
import {
  getStudentAcademicSummary,
  getClassAcademicAverages,
  getStudentWatchlistEntries,
  getClassAcademicSummary,
} from "./academicScoreService";

// --- Domain service imports for orchestration ---
import { countActiveStudents, countOrphanStudents, getStudentsDataQualityStats } from "./studentService";
import { getAttendanceRate, getTeacherAttendanceSummary } from "./attendanceService";
import { getDocumentCompletionStats } from "./studentFileService";
import { getSppDashboardStats } from "./sppService";
import {
  getFitrahRadarDataForSemester,
  getBestCultureClassAverage,
} from "./characterSummaryService";
import { getFailedLoginCount } from "./auditService";
import { countTeachers } from "./userService";
import { countActiveClasses } from "./classService";
import { getActiveAcademicYear } from "./academicYearService";
import { getActiveSemester } from "./semesterService";
import { getAdminDashboardOverview } from "./studentAttendanceService";
import { getSchoolTodayDate } from "@/lib/utils/schoolDate";

export async function getSchoolDashboard() {
  try {
    // ── Basic KPIs ─────────────────────────────────────────────────────────
    const totalStudents = await countActiveStudents();
    const totalTeachers = await countTeachers();
    const totalClasses = await countActiveClasses();

    // ── Active academic period ─────────────────────────────────────────────
    const activeYear = await getActiveAcademicYear();
    const activeSemester = activeYear
      ? await getActiveSemester(activeYear.id)
      : null;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // ── D. SPP Statistics — delegated to sppService ────────────────────────
    // paid + verified both count as paid; chart uses SQL GROUP BY (no full-table load)
    const sppStats = await getSppDashboardStats(currentMonth, currentYear);
    const sppThisMonth = sppStats.this_month;
    const sppChartData = sppStats.chart_data;
    const sppCompletionRate = sppStats.completion_rate;
    const unpaidSppPercent = sppStats.unpaid_percent;

    // ── B. Teacher Attendance Rate — delegated to attendanceService ────────
    // Scoped to current calendar month; present+late rule lives in attendanceService
    const attendanceResult = await getAttendanceRate(currentMonth, currentYear);
    const teacherAttendanceRate = attendanceResult.rate;

    // ── C. Document Completion — delegated to studentFileService ───────────
    // Mandatory doc types + active status filter live in studentFileService
    const docStats = await getDocumentCompletionStats();
    const docCompletionRate = docStats.completion_rate;
    const docPieChartData = docStats.pie_data;

    // ── F. FITRAH Radar — delegated to characterSummaryService ────────────
    // Fallback (all zeros) lives in characterSummaryService
    const fitrahRadarData = await getFitrahRadarDataForSemester(
      activeSemester?.id ?? "",
    );

    // ── Active classes ────────────────────────────────────────────────────
    const activeClasses: Array<{ id: string; name: string }> = await db(
      "classes",
    )
      .where("lifecycle_status", "active")
      .select("id", "name");

    // ── E. Class Academic Averages — delegated to academicScoreService ─────
    // Uses canonical enrollment_id join; temporal rule lives there
    const classAcademicAverages = activeSemester
      ? await getClassAcademicAverages(activeSemester.id, activeClasses)
      : [];

    // 5. Best Class Academic
    let bestClassAcademicName = "N/A";
    let bestClassAcademicAvg = "0.0";
    if (classAcademicAverages.length > 0) {
      const sorted = [...classAcademicAverages].sort(
        (a, b) => b.RataRata - a.RataRata,
      );
      if (sorted[0] && sorted[0].RataRata > 0) {
        bestClassAcademicName = sorted[0].name;
        bestClassAcademicAvg = sorted[0].RataRata.toFixed(1);
      }
    }

    // ── 6. Best Class Culture — delegated to characterSummaryService ───────
    let bestCultureClassName = "N/A";
    let bestCultureClassAvg = "0.0";
    if (activeSemester && activeClasses.length > 0) {
      const best = await getBestCultureClassAverage(
        activeSemester.id,
        activeClasses,
      );
      if (best) {
        bestCultureClassName = best.name;
        bestCultureClassAvg = best.avg.toFixed(1);
      }
    }

    // ── 7. Most Active Teacher (academic scores count — Rule #6) ──
    let mostActiveTeacherName = "N/A";
    let mostActiveTeacherDesc = "Data tidak tersedia";
    if (activeSemester) {
      const activeTeacher = await db("academic_scores")
        .join("academic_assessments", "academic_scores.assessment_id", "academic_assessments.id")
        .join("users", "academic_assessments.teacher_user_id", "users.id")
        .where("academic_assessments.semester_id", activeSemester.id)
        .whereNot("academic_scores.lifecycle_status", "soft_deleted")
        .whereNot("academic_assessments.lifecycle_status", "soft_deleted")
        .select("users.name")
        .count("academic_scores.id as count")
        .groupBy("users.id", "users.name")
        .orderBy("count", "desc")
        .first();

      if (activeTeacher) {
        mostActiveTeacherName = String(activeTeacher.name);
        mostActiveTeacherDesc = `Telah menginput ${activeTeacher.count} nilai siswa.`;
      }
    }

    // ── 8. Classes Without Wali (structural check) ────────────────────────
    let classesWithoutWali: string[] = [];
    if (activeSemester) {
      const classesWithWali = await db("class_teacher_assignments")
        .where({ semester_id: activeSemester.id, status: "active" })
        .whereNot("class_teacher_assignments.lifecycle_status", "soft_deleted")
        .select("class_id");
      const classIdsWithWali = new Set(classesWithWali.map((c: any) => c.class_id));
      classesWithoutWali = activeClasses
        .filter((c: any) => !classIdsWithWali.has(c.id))
        .map((c: any) => c.name);
    }

    // ── 9. Orphan Students Count (structural check) ───────────────────────
    // ── H. Failed Logins — delegated to auditService ──────────────────────
    // 24-hour rolling window from audit_logs; not the transient failed_login_attempts counter
    const failedLoginsCount = await getFailedLoginCount(24);

    // ── Structural orphan-student count — delegated to studentService ────
    // ── Structural orphan-student count — delegated to studentService ────
    const orphanStudentsCount = activeSemester ? await countOrphanStudents(activeSemester.id) : 0;

    // ── 10. Health Scores & Data Quality ───────────────────────────────────
    let academicCompletion: number | null = null;
    if (activeSemester) {
      const [totalAssessmentsRes, lockedAssessmentsRes] = await Promise.all([
        db("academic_assessments")
          .where({ semester_id: activeSemester.id })
          .whereNot("lifecycle_status", "soft_deleted")
          .count("id as count")
          .first(),
        db("academic_assessments")
          .where({ semester_id: activeSemester.id, status: "locked" })
          .whereNot("lifecycle_status", "soft_deleted")
          .count("id as count")
          .first(),
      ]);
      const totalAssessments = Number(totalAssessmentsRes?.count || 0);
      const lockedAssessments = Number(lockedAssessmentsRes?.count || 0);
      academicCompletion = totalAssessments > 0 ? Math.round((lockedAssessments / totalAssessments) * 100) : null;
    }

    let characterCompletion = 0;
    if (activeYear && activeSemester && activeClasses.length > 0) {
      let lengkapCount = 0;
      for (const cls of activeClasses) {
        const completeness = await getCultureCompleteness(cls.id, activeYear.id, activeSemester.id);
        if (completeness >= 100) {
          lengkapCount++;
        }
      }
      characterCompletion = Math.round((lengkapCount / activeClasses.length) * 100);
    }

    const overallHealthScore = Math.round(
      ((academicCompletion ?? 0) + characterCompletion + (teacherAttendanceRate ?? 0) + sppCompletionRate + docCompletionRate) / 5
    );

    let healthCategory: "Sangat Baik" | "Baik" | "Perlu Perhatian" | "Kritis" = "Baik";
    if (overallHealthScore >= 90) healthCategory = "Sangat Baik";
    else if (overallHealthScore >= 75) healthCategory = "Baik";
    else if (overallHealthScore >= 50) healthCategory = "Perlu Perhatian";
    else healthCategory = "Kritis";

    let academicStatusStats = { final: 0, belumFinal: 0, belumIsi: 0 };
    if (activeSemester) {
      const activeClassSubjects = await db("class_subjects")
        .where({ semester_id: activeSemester.id, status: "active" })
        .whereNot("lifecycle_status", "soft_deleted")
        .select("class_id", "subject_id");

      const assessments = await db("academic_assessments")
        .where({ semester_id: activeSemester.id })
        .whereNot("lifecycle_status", "soft_deleted")
        .select("class_id", "subject_id", "status");

      const assessmentGroup: Record<string, string[]> = {};
      assessments.forEach((a: any) => {
        const key = `${a.class_id}-${a.subject_id}`;
        if (!assessmentGroup[key]) {
          assessmentGroup[key] = [];
        }
        assessmentGroup[key].push(a.status);
      });

      activeClassSubjects.forEach((cs: any) => {
        const key = `${cs.class_id}-${cs.subject_id}`;
        const statuses = assessmentGroup[key];
        if (!statuses || statuses.length === 0) {
          academicStatusStats.belumIsi++;
        } else {
          const allLocked = statuses.every(s => s === "locked");
          if (allLocked) {
            academicStatusStats.final++;
          } else {
            academicStatusStats.belumFinal++;
          }
        }
      });
    }

    let cultureStatusStats = { lengkap: 0, sebagian: 0, kosong: 0 };
    if (activeYear && activeSemester && activeClasses.length > 0) {
      for (const cls of activeClasses) {
        const completeness = await getCultureCompleteness(cls.id, activeYear.id, activeSemester.id);
        if (completeness >= 100) {
          cultureStatusStats.lengkap++;
        } else if (completeness > 0) {
          cultureStatusStats.sebagian++;
        } else {
          cultureStatusStats.kosong++;
        }
      }
    }

    const qualityStats = await getStudentsDataQualityStats(activeSemester?.id);

    return {
      total_students: totalStudents,
      total_teachers: totalTeachers,
      total_classes: totalClasses,
      active_year: activeYear ? activeYear.name : null,
      active_semester: activeSemester ? activeSemester.name : null,
      spp_this_month: sppThisMonth,
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
      lastIntegrityCheckStatus: "unknown",
      academicCompletion,
      characterCompletion,
      overallHealthScore,
      healthCategory,
      qualityStats,
      academicStatusStats,
      cultureStatusStats,
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Database error getting school dashboard statistics",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function getClassDashboard(
  classId: string,
  academicYearId?: string,
  semesterId?: string,
) {
  if (!classId) {
    throw new AppError("Class ID is required.", "ERR_VALIDATION", 400);
  }

  try {
    let yearId = academicYearId;
    let semId = semesterId;

    // Fallback to active period if not provided
    if (!yearId || !semId) {
      const activeYear = await db("academic_years")
        .where("is_active", 1)
        .first();
      if (activeYear) {
        yearId = yearId || activeYear.id;
        const activeSem = await db("semesters")
          .where({ academic_year_id: activeYear.id, is_active: 1 })
          .first();
        if (activeSem) {
          semId = semId || activeSem.id;
        }
      }
    }

    if (!yearId || !semId) {
      throw new AppError(
        "No active period found in system. Please specify academic_year_id and semester_id.",
        "ERR_VALIDATION",
        400,
      );
    }

    const studentsCountRes = await db("student_enrollments")
      .where({
        class_id: classId,
        academic_year_id: yearId,
        semester_id: semId,
        status: "active",
      })
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as count")
      .first();

    const studentsCount = Number(studentsCountRes?.count || 0);

    const classTeachers = await db("class_teacher_assignments")
      .join("users", "class_teacher_assignments.teacher_user_id", "users.id")
      .where({
        "class_teacher_assignments.class_id": classId,
        "class_teacher_assignments.academic_year_id": yearId,
        "class_teacher_assignments.semester_id": semId,
        "class_teacher_assignments.status": "active",
      })
      .whereNot("class_teacher_assignments.lifecycle_status", "soft_deleted")
      .select("users.id as teacher_id", "users.name as teacher_name");

    // Get completeness stats
    const academicCompleteness = await getAcademicCompleteness(
      classId,
      yearId,
      semId,
    );
    const cultureCompleteness = await getCultureCompleteness(
      classId,
      yearId,
      semId,
    );

    return {
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semId,
      total_students: studentsCount,
      class_teachers: classTeachers,
      academic_completeness: academicCompleteness,
      culture_completeness: cultureCompleteness,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Database error getting class dashboard info",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function getStudentProgressDashboard(studentId: string) {
  if (!studentId)
    throw new AppError("Student ID is required.", "ERR_VALIDATION", 400);

  const student = await db("students")
    .where("id", studentId)
    .whereNot("status", "soft_deleted")
    .first();
  if (!student) throw new AppError("Student not found.", "ERR_VALIDATION", 404);

  const enrollment = await db("student_enrollments")
    .join("classes", "student_enrollments.class_id", "classes.id")
    .join("semesters", "student_enrollments.semester_id", "semesters.id")
    .join(
      "academic_years",
      "student_enrollments.academic_year_id",
      "academic_years.id",
    )
    .where({
      "student_enrollments.student_id": studentId,
      "student_enrollments.status": "active",
    })
    .select(
      "student_enrollments.class_id",
      "classes.name as class_name",
      "student_enrollments.semester_id",
      "semesters.name as semester_name",
      "student_enrollments.academic_year_id",
      "academic_years.name as academic_year_name",
    )
    .first();

  let academicSummary: any[] = [];
  let characterSummary: any = null;

  if (enrollment) {
    try {
      academicSummary = await getStudentAcademicSummary(
        studentId,
        enrollment.academic_year_id,
        enrollment.semester_id,
      );
    } catch (e) {
      /* ignore */
    }
  }

  return {
    student: {
      id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      gender: student.gender,
    },
    current_enrollment: enrollment || null,
    academic_summary: academicSummary,
  };
}

export async function getTeacherDashboard(teacherId: string) {
  if (!teacherId)
    throw new AppError("Teacher ID is required.", "ERR_VALIDATION", 400);

  const teacher = await db("users")
    .where({ id: teacherId, role: "teacher" })
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  if (!teacher) throw new AppError("Teacher not found.", "ERR_VALIDATION", 404);

  const teacherProfile = await db("teacher_profiles")
    .where("user_id", teacherId)
    .first();

  // Classes assigned
  const assignments = await db("class_teacher_assignments")
    .join("classes", "class_teacher_assignments.class_id", "classes.id")
    .join(
      "academic_years",
      "class_teacher_assignments.academic_year_id",
      "academic_years.id",
    )
    .join("semesters", "class_teacher_assignments.semester_id", "semesters.id")
    .where({
      "class_teacher_assignments.teacher_user_id": teacherId,
      "class_teacher_assignments.status": "active",
    })
    .whereNot("class_teacher_assignments.lifecycle_status", "soft_deleted")
    .select(
      "classes.id as class_id",
      "classes.name as class_name",
      "academic_years.name as academic_year_name",
      "semesters.name as semester_name",
    );

  // Assessment count
  const assessmentsRes = await db("academic_assessments")
    .where("teacher_user_id", teacherId)
    .whereNot("lifecycle_status", "soft_deleted")
    .count("id as count")
    .first();

  const assessmentCount = Number(assessmentsRes?.count || 0);

  // Attendance summary (this month) - delegated to attendanceService
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const attendanceStats = await getTeacherAttendanceSummary(teacherId, currentMonth, currentYear);

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
    },
    profile: teacherProfile || null,
    class_assignments: assignments,
    total_assessments: assessmentCount,
    attendance_this_month: attendanceStats,
  };
}

export async function getStudentWatchlist(limit = 50) {
  try {
    // ── G. Watchlist — fully delegated to domain services ─────────────────
    const activeYear = await db("academic_years").where("is_active", 1).first();
    const activeSemester = activeYear
      ? await db("semesters")
          .where({ academic_year_id: activeYear.id, is_active: 1 })
          .first()
      : null;

    const semesterId = activeSemester?.id ?? "";

    return await getStudentWatchlistEntries(semesterId, limit);
  } catch (error) {
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Error getting student watchlist",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function getAdminDashboardAggregate() {
  try {
    const todayStr = getSchoolTodayDate();

    // 1. Context
    const activeYear = await getActiveAcademicYear();
    const activeSemester = activeYear ? await getActiveSemester(activeYear.id) : null;

    // 2. School Overview
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      countActiveStudents(),
      countTeachers(),
      countActiveClasses(),
    ]);

    // 3. Today: Student Attendance
    let studentAttendanceToday = {
      submitted_classes: 0,
      unsubmitted_classes: 0,
      total_classes: totalClasses,
      attendance_rate: null as number | null,
      counts: { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0 },
      total_students_recorded: 0,
      unsubmitted_classes_list: [] as string[],
    };

    try {
      const attendanceOverview = await getAdminDashboardOverview(todayStr);
      studentAttendanceToday = {
        submitted_classes: attendanceOverview.overview.submitted_classes,
        unsubmitted_classes: attendanceOverview.overview.unsubmitted_classes,
        total_classes: attendanceOverview.overview.total_classes,
        attendance_rate: attendanceOverview.overview.attendance_rate,
        counts: attendanceOverview.overview.counts,
        total_students_recorded: attendanceOverview.overview.total_students_recorded,
        unsubmitted_classes_list: attendanceOverview.classes
          .filter((c) => (c.attendance_eligible ?? c.student_count > 0) && !c.has_submitted)
          .map((c) => c.class_name),
      };
    } catch {
      // safe fallback if period not initialized
    }

    // 4. Today: Teacher Attendance
    const teacherRecordsToday = await db("teacher_attendance")
      .where("date", todayStr)
      .whereNot("lifecycle_status", "soft_deleted")
      .select("status");

    let teacherPresentToday = 0;
    let teacherLateToday = 0;
    teacherRecordsToday.forEach((r: any) => {
      if (r.status === "present") teacherPresentToday++;
      else if (r.status === "late") teacherLateToday++;
    });

    const teacherAttendanceTodayRate =
      totalTeachers > 0
        ? Math.round(((teacherPresentToday + teacherLateToday) / totalTeachers) * 100)
        : null;

    // 5. Academic Completeness
    // a. Academic Scores
    let academicScores = {
      final: 0,
      belumFinal: 0,
      belumIsi: 0,
      total_targets: 0,
      completion_percent: null as number | null,
    };

    let unpublishedAssessmentsCount = 0;

    if (activeSemester) {
      const [classSubjects, assessments] = await Promise.all([
        db("class_subjects")
          .where({ semester_id: activeSemester.id, status: "active" })
          .whereNot("lifecycle_status", "soft_deleted")
          .select("class_id", "subject_id"),
        db("academic_assessments")
          .where({ semester_id: activeSemester.id })
          .whereNot("lifecycle_status", "soft_deleted")
          .select("id", "class_id", "subject_id", "status"),
      ]);

      const assessmentGroup: Record<string, string[]> = {};
      assessments.forEach((a: any) => {
        if (a.status !== "locked") unpublishedAssessmentsCount++;
        const key = `${a.class_id}-${a.subject_id}`;
        if (!assessmentGroup[key]) assessmentGroup[key] = [];
        assessmentGroup[key].push(a.status);
      });

      classSubjects.forEach((cs: any) => {
        const key = `${cs.class_id}-${cs.subject_id}`;
        const statuses = assessmentGroup[key];
        if (!statuses || statuses.length === 0) {
          academicScores.belumIsi++;
        } else {
          const allLocked = statuses.every((s) => s === "locked");
          if (allLocked) academicScores.final++;
          else academicScores.belumFinal++;
        }
      });

      academicScores.total_targets = classSubjects.length;
      academicScores.completion_percent =
        classSubjects.length > 0
          ? Math.round((academicScores.final / classSubjects.length) * 100)
          : null;
    }

    // b. Culture Completeness (grouped across active classes)
    let cultureCompleteness = {
      lengkap: 0,
      sebagian: 0,
      kosong: 0,
      total_classes: totalClasses,
      completion_percent: 0,
    };

    const activeClasses: Array<{ id: string; name: string }> = await db("classes")
      .where("lifecycle_status", "active")
      .select("id", "name");

    if (activeYear && activeSemester && activeClasses.length > 0) {
      const classCompletenessList = await Promise.all(
        activeClasses.map((cls) =>
          getCultureCompleteness(cls.id, activeYear.id, activeSemester.id)
        )
      );

      classCompletenessList.forEach((pct) => {
        if (pct >= 100) cultureCompleteness.lengkap++;
        else if (pct > 0) cultureCompleteness.sebagian++;
        else cultureCompleteness.kosong++;
      });

      cultureCompleteness.completion_percent =
        activeClasses.length > 0
          ? Math.round((cultureCompleteness.lengkap / activeClasses.length) * 100)
          : 0;
    }

    // c. KKTP Completeness (existence of created documents)
    let kktpStats = {
      students_with_kktp: 0,
      total_active_students: totalStudents,
      completion_percent: 0,
    };

    const kktpDocs = await db("documents")
      .where("type", "KKTP")
      .whereNot("status", "ARCHIVED")
      .select("content");

    const kktpStudentIds = new Set<string>();
    kktpDocs.forEach((doc: any) => {
      try {
        const content = typeof doc.content === "string" ? JSON.parse(doc.content) : doc.content;
        if (content?.identitas?.studentId) {
          kktpStudentIds.add(content.identitas.studentId);
        }
      } catch {
        // ignore invalid JSON
      }
    });

    kktpStats.students_with_kktp = kktpStudentIds.size;
    kktpStats.completion_percent =
      totalStudents > 0
        ? Math.round((kktpStudentIds.size / totalStudents) * 100)
        : 0;

    // d. RPM Documents count
    const rpmCountRes = await db("documents")
      .where("type", "RPM")
      .whereNot("status", "ARCHIVED")
      .count("id as count")
      .first();
    const rpmTotalDocuments = Number(rpmCountRes?.count || 0);

    // e. Trisula assessments
    let trisulaStats = {
      draft_count: 0,
      in_progress_count: 0,
      finalized_count: 0,
      total_assessments: 0,
    };

    const hasTrisulaTable = await db.schema.hasTable("trisula_assessments");
    if (hasTrisulaTable && activeSemester) {
      const trisulaRows = await db("trisula_assessments")
        .where("semester_id", activeSemester.id)
        .select("status")
        .count("id as count")
        .groupBy("status");

      trisulaRows.forEach((r: any) => {
        const count = Number(r.count || 0);
        if (r.status === "DRAFT") trisulaStats.draft_count += count;
        else if (r.status === "IN_PROGRESS") trisulaStats.in_progress_count += count;
        else if (r.status === "FINALIZED") trisulaStats.finalized_count += count;
      });
      trisulaStats.total_assessments =
        trisulaStats.draft_count + trisulaStats.in_progress_count + trisulaStats.finalized_count;
    }

    // 6. Actionable Alerts
    const alerts: Array<{
      id: string;
      priority: number;
      title: string;
      description: string;
      category: string;
      action_href: string;
    }> = [];

    // Alert: Unsubmitted student attendance today
    if (studentAttendanceToday.unsubmitted_classes > 0) {
      const unsubmittedNames = studentAttendanceToday.unsubmitted_classes_list.slice(0, 3).join(", ");
      const extraCount = studentAttendanceToday.unsubmitted_classes_list.length - 3;
      const extraText = extraCount > 0 ? ` dan ${extraCount} kelas lainnya` : "";
      alerts.push({
        id: "student-attendance-unsubmitted",
        priority: 1,
        title: "Presensi Siswa Belum Dikirim",
        description: `${studentAttendanceToday.unsubmitted_classes} kelas belum mengirim presensi hari ini (${unsubmittedNames}${extraText}).`,
        category: "Kesiswaan",
        action_href: "/student-attendance",
      });
    }

    // Alert: Classes without wali kelas
    let classesWithoutWali: string[] = [];
    if (activeSemester) {
      const assignments = await db("class_teacher_assignments")
        .where({ semester_id: activeSemester.id, status: "active" })
        .whereNot("lifecycle_status", "soft_deleted")
        .select("class_id");
      const assignedIds = new Set(assignments.map((a: any) => a.class_id));
      classesWithoutWali = activeClasses
        .filter((c) => !assignedIds.has(c.id))
        .map((c) => c.name);
    }

    if (classesWithoutWali.length > 0) {
      alerts.push({
        id: "classes-without-wali",
        priority: 2,
        title: "Pendamping Wali Kelas Belum Lengkap",
        description: `${classesWithoutWali.join(", ")} belum memiliki wali kelas pendamping semester ini.`,
        category: "Kepegawaian",
        action_href: "/classes",
      });
    }

    // Alert: Orphan students
    const orphanStudentsCount = activeSemester ? await countOrphanStudents(activeSemester.id) : 0;
    if (orphanStudentsCount > 0) {
      alerts.push({
        id: "students-orphan",
        priority: 3,
        title: "Siswa Belum Masuk Rombel",
        description: `Terdapat ${orphanStudentsCount} anak didik aktif belum terdaftar di rombongan belajar semester ini.`,
        category: "Kesiswaan",
        action_href: "/students",
      });
    }

    // Alert: Unpublished assessments
    if (unpublishedAssessmentsCount > 5) {
      alerts.push({
        id: "assessments-unpublished",
        priority: 4,
        title: "Finalisasi Evaluasi Belajar Tertunda",
        description: `Terdapat ${unpublishedAssessmentsCount} evaluasi belajar yang masih berstatus draf dan belum dikunci oleh guru.`,
        category: "Kurikulum",
        action_href: "/academic-scores",
      });
    }

    // Alert: Incomplete student documents
    const docStats = await getDocumentCompletionStats().catch(() => null);
    const incompleteDocs = docStats?.pie_data?.find((d) => d.name === "Belum Lengkap")?.value || 0;
    if (incompleteDocs > 0) {
      alerts.push({
        id: "docs-incomplete",
        priority: 5,
        title: "Berkas Pendaftaran Belum Lengkap",
        description: `Sebanyak ${incompleteDocs} berkas pokok siswa baru belum terunggah lengkap.`,
        category: "Administrasi",
        action_href: "/students",
      });
    }

    alerts.sort((a, b) => a.priority - b.priority);

    return {
      context: {
        active_academic_year: activeYear ? { id: activeYear.id, name: activeYear.name } : null,
        active_semester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null,
      },
      school_overview: {
        total_students: totalStudents,
        total_teachers: totalTeachers,
        total_classes: totalClasses,
      },
      today: {
        date: todayStr,
        student_attendance: studentAttendanceToday,
        teacher_attendance: {
          attendance_rate: teacherAttendanceTodayRate,
          total_teachers: totalTeachers,
          present_count: teacherPresentToday,
          late_count: teacherLateToday,
        },
      },
      academic_completeness: {
        academic_scores: academicScores,
        culture: cultureCompleteness,
        kktp: kktpStats,
        rpm: {
          total_documents: rpmTotalDocuments,
        },
        trisula: trisulaStats,
      },
      actionable_alerts: alerts,
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "Database error generating admin dashboard aggregate",
      "ERR_DATABASE",
      500
    );
  }
}

export async function getTeacherDashboardAggregate(teacherUserId: string) {
  if (!teacherUserId) {
    throw new AppError("Teacher User ID is required.", "ERR_VALIDATION", 400);
  }

  const teacher = await db("users")
    .where({ id: teacherUserId, role: "teacher" })
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  if (!teacher) {
    throw new AppError("Teacher not found.", "ERR_NOT_FOUND", 404);
  }

  const todayStr = getSchoolTodayDate();

  // 1. Context & Active Period
  const activeYear = await getActiveAcademicYear();
  const activeSemester = activeYear ? await getActiveSemester(activeYear.id) : null;

  // 2. Homeroom / Perwalian Class
  let perwalianClass: any = null;
  if (activeSemester) {
    const assignment = await db("class_teacher_assignments")
      .join("classes", "class_teacher_assignments.class_id", "classes.id")
      .where({
        "class_teacher_assignments.teacher_user_id": teacherUserId,
        "class_teacher_assignments.semester_id": activeSemester.id,
        "class_teacher_assignments.status": "active",
      })
      .whereNot("class_teacher_assignments.lifecycle_status", "soft_deleted")
      .select(
        "classes.id as class_id",
        "classes.name as class_name",
        "classes.code as class_code",
        "classes.level as class_level"
      )
      .first();

    if (assignment) {
      const studentCountRes = await db("student_enrollments")
        .where({
          class_id: assignment.class_id,
          semester_id: activeSemester.id,
          status: "active",
        })
        .whereNot("lifecycle_status", "soft_deleted")
        .count("id as count")
        .first();

      perwalianClass = {
        class_id: assignment.class_id,
        class_name: assignment.class_name,
        class_code: assignment.class_code,
        class_level: assignment.class_level,
        student_count: Number(studentCountRes?.count || 0),
      };
    }
  }

  // 3. Today: Student Attendance for Perwalian Class
  let studentAttendanceToday: any = {
    is_wali_kelas: Boolean(perwalianClass),
    is_submitted: false,
    counts: null as any,
  };

  if (perwalianClass && activeSemester) {
    const session = await db("student_attendance_sessions")
      .where({
        class_id: perwalianClass.class_id,
        semester_id: activeSemester.id,
        attendance_date: todayStr,
      })
      .first();

    if (session) {
      const records = await db("student_attendance_records")
        .where("session_id", session.id)
        .select("status");

      let hadir = 0, sakit = 0, izin = 0, alpa = 0, terlambat = 0;
      records.forEach((r: any) => {
        const s = String(r.status).toLowerCase();
        if (s === "hadir") hadir++;
        else if (s === "sakit") sakit++;
        else if (s === "izin") izin++;
        else if (s === "alpa") alpa++;
        else if (s === "terlambat") terlambat++;
      });

      studentAttendanceToday.is_submitted = true;
      studentAttendanceToday.counts = { hadir, sakit, izin, alpa, terlambat, total: records.length };
    }
  }

  // 4. Today: Teacher's own GPS check-in status
  const teacherAttendanceRecord = await db("teacher_attendance")
    .where({ teacher_id: teacherUserId, date: todayStr })
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  const ownAttendanceToday = {
    checked_in: Boolean(teacherAttendanceRecord),
    status: teacherAttendanceRecord ? teacherAttendanceRecord.status : "not_checked_in",
    time_in: teacherAttendanceRecord ? teacherAttendanceRecord.time_in : null,
  };

  // 5. Today: Culture Completeness for homeroom class
  let classCultureSummary: any = null;
  if (perwalianClass && activeYear && activeSemester) {
    const cultureScoreCountRes = await db("culture_scores")
      .where({
        class_id: perwalianClass.class_id,
        semester_id: activeSemester.id,
      })
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as count")
      .first();

    const uniqueWeeksRes = await db("culture_scores")
      .where({
        class_id: perwalianClass.class_id,
        semester_id: activeSemester.id,
      })
      .whereNot("lifecycle_status", "soft_deleted")
      .distinct("week_start_date");

    const totalWeeks = uniqueWeeksRes.length;
    const actualScores = Number(cultureScoreCountRes?.count || 0);
    const expectedScores = perwalianClass.student_count * (totalWeeks || 1);
    const coverage = expectedScores > 0 ? Math.round((actualScores / expectedScores) * 100) : 0;

    classCultureSummary = {
      coverage_percent: Math.min(coverage, 100),
      weeks_recorded: totalWeeks,
    };
  }

  // 6. Pending Work
  let pendingWork = {
    draft_assessments_count: 0,
    kktp_pending_count: 0,
    rpm_count: 0,
    trisula_draft_count: 0,
  };

  if (activeSemester) {
    const draftRes = await db("academic_assessments")
      .where({
        teacher_user_id: teacherUserId,
        semester_id: activeSemester.id,
        status: "draft",
      })
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as count")
      .first();
    pendingWork.draft_assessments_count = Number(draftRes?.count || 0);

    // RPM documents count for this teacher
    const rpmRes = await db("documents")
      .where({
        type: "RPM",
        author_id: teacherUserId,
      })
      .whereNot("status", "ARCHIVED")
      .count("id as count")
      .first();
    pendingWork.rpm_count = Number(rpmRes?.count || 0);

    // KKTP pending count for perwalian class (supports normalized kktp_assessments with legacy fallback)
    if (perwalianClass) {
      const classEnrollments = await db("student_enrollments")
        .where({
          class_id: perwalianClass.class_id,
          semester_id: activeSemester.id,
          status: "active",
        })
        .whereNot("lifecycle_status", "soft_deleted")
        .select("student_id");

      const studentIds = new Set(classEnrollments.map((e: any) => e.student_id));
      const hasNormalizedKKTP = await db.schema.hasTable("kktp_assessments");

      let normalizedPendingCount: number | null = null;
      if (hasNormalizedKKTP) {
        const classAssessments = await db("kktp_assessments")
          .where({
            class_id: perwalianClass.class_id,
            semester_id: activeSemester.id,
          })
          .select("id");

        if (classAssessments.length > 0) {
          const assessmentIds = classAssessments.map((a: any) => a.id);
          const completedSummaries = await db("kktp_student_summaries")
            .whereIn("assessment_id", assessmentIds)
            .whereIn("student_id", Array.from(studentIds))
            .where("status", "COMPLETED")
            .select("student_id");

          const completedSet = new Set(completedSummaries.map((s: any) => s.student_id));
          normalizedPendingCount = Math.max(studentIds.size - completedSet.size, 0);
        }
      }

      if (normalizedPendingCount !== null) {
        pendingWork.kktp_pending_count = normalizedPendingCount;
      } else {
        const kktpDocs = await db("documents")
          .where({
            type: "KKTP",
            class_id: perwalianClass.class_id,
          })
          .whereNot("status", "ARCHIVED")
          .select("content");

        const createdIds = new Set<string>();
        kktpDocs.forEach((d: any) => {
          try {
            const c = typeof d.content === "string" ? JSON.parse(d.content) : d.content;
            if (c?.identitas?.studentId && studentIds.has(c.identitas.studentId)) {
              createdIds.add(c.identitas.studentId);
            }
          } catch {
            // ignore invalid JSON
          }
        });
        pendingWork.kktp_pending_count = Math.max(studentIds.size - createdIds.size, 0);
      }

      // Trisula draft count for perwalian class
      const hasTrisulaTable = await db.schema.hasTable("trisula_assessments");
      if (hasTrisulaTable) {
        const trisulaDraftRes = await db("trisula_assessments")
          .where({
            class_id: perwalianClass.class_id,
            semester_id: activeSemester.id,
          })
          .whereIn("status", ["DRAFT", "IN_PROGRESS"])
          .count("id as count")
          .first();
        pendingWork.trisula_draft_count = Number(trisulaDraftRes?.count || 0);
      }
    }
  }

  // 7. Class Overview (if perwalian exists)
  let classOverview: any = null;
  if (perwalianClass && activeSemester) {
    // Attendance rate for class this semester
    const classAttendanceRecords = await db("student_attendance_records as sar")
      .join("student_attendance_sessions as sas", "sar.session_id", "sas.id")
      .where({
        "sas.class_id": perwalianClass.class_id,
        "sas.semester_id": activeSemester.id,
      })
      .select("sar.status");

    let h = 0, t = 0, s = 0, i = 0, a = 0;
    classAttendanceRecords.forEach((rec: any) => {
      const st = String(rec.status).toLowerCase();
      if (st === "hadir") h++;
      else if (st === "terlambat") t++;
      else if (st === "sakit") s++;
      else if (st === "izin") i++;
      else if (st === "alpa") a++;
    });
    const totalClassDays = h + t + s + i + a;
    const classAttendanceRate = totalClassDays > 0 ? Math.round(((h + t) / totalClassDays) * 100) : null;

    // Academic progress (locked evaluations)
    const classAssessments = await db("academic_assessments")
      .where({
        class_id: perwalianClass.class_id,
        semester_id: activeSemester.id,
      })
      .whereNot("lifecycle_status", "soft_deleted")
      .select("status");

    const totalAssessments = classAssessments.length;
    const lockedAssessments = classAssessments.filter((a: any) => a.status === "locked").length;
    const academicProgressPercent = totalAssessments > 0 ? Math.round((lockedAssessments / totalAssessments) * 100) : 0;

    // Grade distribution
    const summaryData = await getClassAcademicSummary(
      perwalianClass.class_id,
      activeYear?.id || "",
      activeSemester.id
    ).catch(() => null);

    let countA = 0, countB = 0, countC = 0, countD = 0;
    if (summaryData?.student_summaries) {
      summaryData.student_summaries.forEach((s: any) => {
        if (s.average_score !== null && s.average_score !== undefined) {
          if (s.average_score >= 85) countA++;
          else if (s.average_score >= 75) countB++;
          else if (s.average_score >= 60) countC++;
          else countD++;
        }
      });
    }

    classOverview = {
      student_count: perwalianClass.student_count,
      attendance_rate: classAttendanceRate,
      academic_progress_percent: academicProgressPercent,
      completed_evaluations: lockedAssessments,
      total_evaluations: totalAssessments,
      grade_distribution: [
        { name: "Nilai A (>=85)", count: countA },
        { name: "Nilai B (75-84)", count: countB },
        { name: "Nilai C (60-74)", count: countC },
        { name: "Nilai D (<60)", count: countD },
      ],
    };
  }

  return {
    context: {
      teacher_id: teacher.id,
      teacher_name: teacher.name,
      teacher_email: teacher.email,
      active_academic_year: activeYear ? { id: activeYear.id, name: activeYear.name } : null,
      active_semester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : null,
      perwalian_class: perwalianClass,
    },
    today: {
      date: todayStr,
      student_attendance: studentAttendanceToday,
      teacher_attendance: ownAttendanceToday,
      culture: classCultureSummary,
    },
    pending_work: pendingWork,
    class_overview: classOverview,
  };
}

