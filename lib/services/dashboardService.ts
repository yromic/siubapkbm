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
