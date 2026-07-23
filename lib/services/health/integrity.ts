import { db } from "@/lib/db";
import type { Knex } from "knex";
import { HealthSection } from "./types";
import { HEALTH_CODES } from "./codes";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// 1. ActiveAcademicYearIntegrity
//    Validates that the active academic year has exactly one active semester
//    whose FK back to academic_years is consistent.
// ---------------------------------------------------------------------------
export async function checkActiveAcademicYearIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Active academic years
    const activeYears = await db("academic_years")
      .where({ is_active: 1 })
      .whereNot({ lifecycle_status: "soft_deleted" })
      .select("id", "name");

    details.active_academic_year_count = activeYears.length;

    if (activeYears.length === 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ACADEMIC_YEAR_NO_ACTIVE,
        severity: "critical",
        message: "Tidak ada tahun ajaran aktif yang ditemukan.",
      });
    } else if (activeYears.length > 1) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ACADEMIC_YEAR_MULTIPLE_ACTIVE,
        severity: "critical",
        message: `Ditemukan ${activeYears.length} tahun ajaran aktif secara bersamaan.`,
        technical_details: { ids: activeYears.map((y: { id: string }) => y.id) },
      });
    } else {
      const activeYear = activeYears[0];
      details.active_academic_year_id = activeYear.id;
      details.active_academic_year_name = activeYear.name;

      // Semesters linked to this active year
      const linkedSemesters = await db("semesters")
        .where({ academic_year_id: activeYear.id })
        .whereNot({ lifecycle_status: "soft_deleted" })
        .select("id", "name", "is_active");

      details.semester_count_for_active_year = linkedSemesters.length;

      if (linkedSemesters.length === 0) {
        issues.push({
          code: HEALTH_CODES.INTEGRITY_ACADEMIC_YEAR_NO_SEMESTERS,
          severity: "warning",
          message: "Tahun ajaran aktif tidak memiliki semester yang terdaftar.",
          technical_details: { academic_year_id: activeYear.id },
        });
      }

      // Check for active semesters belonging to a non-active year
      const orphanedActiveSemesters = await db("semesters as s")
        .join("academic_years as ay", "s.academic_year_id", "ay.id")
        .where("s.is_active", 1)
        .where("ay.is_active", 0)
        .whereNot("s.lifecycle_status", "soft_deleted")
        .select("s.id", "s.name", "s.academic_year_id")
        .limit(10);

      details.semesters_active_in_inactive_year = orphanedActiveSemesters.length;

      if (orphanedActiveSemesters.length > 0) {
        issues.push({
          code: HEALTH_CODES.INTEGRITY_SEMESTER_ACTIVE_IN_INACTIVE_YEAR,
          severity: "critical",
          message: `Ditemukan ${orphanedActiveSemesters.length} semester aktif yang berasosiasi dengan tahun ajaran tidak aktif.`,
          technical_details: { samples: orphanedActiveSemesters },
        });
      }
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas tahun ajaran aktif.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_active_academic_year",
    title: "Integritas Tahun Ajaran Aktif",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 2. ActiveSemesterIntegrity
//    Checks that exactly one semester is active and it belongs to the active year.
// ---------------------------------------------------------------------------
export async function checkActiveSemesterIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    const activeSemesters = await db("semesters")
      .where({ is_active: 1 })
      .whereNot({ lifecycle_status: "soft_deleted" })
      .select("id", "name", "academic_year_id");

    details.active_semester_count = activeSemesters.length;

    if (activeSemesters.length === 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_SEMESTER_NO_ACTIVE,
        severity: "critical",
        message: "Tidak ada semester aktif yang ditemukan.",
      });
    } else if (activeSemesters.length > 1) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_SEMESTER_MULTIPLE_ACTIVE,
        severity: "critical",
        message: `Ditemukan ${activeSemesters.length} semester aktif secara bersamaan.`,
        technical_details: { ids: activeSemesters.map((s: { id: string }) => s.id) },
      });
    } else {
      const sem = activeSemesters[0];
      details.active_semester_id = sem.id;
      details.active_semester_name = sem.name;

      // Validate that this semester's academic_year_id is active
      const parentYear = await db("academic_years")
        .where({ id: sem.academic_year_id, is_active: 1 })
        .whereNot({ lifecycle_status: "soft_deleted" })
        .first("id");

      if (!parentYear) {
        issues.push({
          code: HEALTH_CODES.INTEGRITY_SEMESTER_YEAR_MISMATCH,
          severity: "critical",
          message:
            "Semester aktif berasosiasi dengan tahun ajaran yang tidak aktif.",
          technical_details: {
            semester_id: sem.id,
            academic_year_id: sem.academic_year_id,
          },
        });
      }
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas semester aktif.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_active_semester",
    title: "Integritas Semester Aktif",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 3. StudentEnrollmentIntegrity
//    Detects active students without any enrollment in the active semester.
//    Also detects enrollments referencing deleted students or classes.
// ---------------------------------------------------------------------------
export async function checkStudentEnrollmentIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Find active semester
    const activeSemester = await db("semesters")
      .where({ is_active: 1 })
      .whereNot({ lifecycle_status: "soft_deleted" })
      .first("id");

    details.active_semester_found = !!activeSemester;

    if (activeSemester) {
      // Active students without enrollment in this semester
      const unenrolledStudents = await db("students as s")
        .leftJoin("student_enrollments as se", (builder: Knex.JoinClause) => {
          builder
            .on("se.student_id", "s.id")
            .andOn("se.semester_id", db.raw("?", [activeSemester.id]))
            .andOn(
              db.raw("se.lifecycle_status != ?", ["soft_deleted"])
            );
        })
        .where("s.status", "active")
        .whereNull("se.id")
        .count("s.id as cnt")
        .first();

      const unenrolledCount = Number((unenrolledStudents as any)?.cnt ?? 0);
      details.active_students_without_enrollment = unenrolledCount;

      if (unenrolledCount > 0) {
        issues.push({
          code: HEALTH_CODES.INTEGRITY_ENROLLMENT_STUDENT_UNENROLLED,
          severity: "warning",
          message: `${unenrolledCount} siswa aktif tidak memiliki enrollment pada semester aktif.`,
          technical_details: { semester_id: activeSemester.id },
        });
      }
    }

    // Enrollments referencing soft-deleted students
    const orphanedByStudent = await db("student_enrollments as se")
      .join("students as s", "se.student_id", "s.id")
      .where("s.status", "soft_deleted")
      .whereNot("se.lifecycle_status", "soft_deleted")
      .count("se.id as cnt")
      .first();

    const orphanedByStudentCount = Number((orphanedByStudent as any)?.cnt ?? 0);
    details.enrollments_with_deleted_student = orphanedByStudentCount;

    if (orphanedByStudentCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ENROLLMENT_ORPHANED_STUDENT,
        severity: "warning",
        message: `${orphanedByStudentCount} enrollment aktif merujuk ke siswa yang sudah dihapus.`,
      });
    }

    // Enrollments referencing soft-deleted classes
    const orphanedByClass = await db("student_enrollments as se")
      .join("classes as c", "se.class_id", "c.id")
      .where("c.lifecycle_status", "soft_deleted")
      .whereNot("se.lifecycle_status", "soft_deleted")
      .count("se.id as cnt")
      .first();

    const orphanedByClassCount = Number((orphanedByClass as any)?.cnt ?? 0);
    details.enrollments_with_deleted_class = orphanedByClassCount;

    if (orphanedByClassCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ENROLLMENT_ORPHANED_CLASS,
        severity: "warning",
        message: `${orphanedByClassCount} enrollment aktif merujuk ke kelas yang sudah dihapus.`,
      });
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas enrollment siswa.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_student_enrollment",
    title: "Integritas Enrollment Siswa",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 4. AssessmentIntegrity
//    Detects assessments that reference soft-deleted teachers, classes, subjects,
//    or academic periods; also finds assessments with score_max < score_min.
// ---------------------------------------------------------------------------
export async function checkAssessmentIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Assessments with inverted score range
    const invertedScores = await db("academic_assessments")
      .whereRaw("score_max < score_min")
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as cnt")
      .first();

    const invertedCount = Number((invertedScores as any)?.cnt ?? 0);
    details.assessments_inverted_score_range = invertedCount;

    if (invertedCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ASSESSMENT_INVALID_SCORE_RANGE,
        severity: "critical",
        message: `${invertedCount} assessment memiliki score_max < score_min.`,
      });
    }

    // Assessments referencing soft-deleted teachers
    const orphanedTeacher = await db("academic_assessments as aa")
      .join("users as u", "aa.teacher_user_id", "u.id")
      .where("u.lifecycle_status", "soft_deleted")
      .whereNot("aa.lifecycle_status", "soft_deleted")
      .count("aa.id as cnt")
      .first();

    const orphanedTeacherCount = Number((orphanedTeacher as any)?.cnt ?? 0);
    details.assessments_with_deleted_teacher = orphanedTeacherCount;

    if (orphanedTeacherCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ASSESSMENT_ORPHANED_TEACHER,
        severity: "warning",
        message: `${orphanedTeacherCount} assessment merujuk ke guru yang sudah dihapus.`,
      });
    }

    // Assessments referencing soft-deleted subjects
    const orphanedSubject = await db("academic_assessments as aa")
      .join("subjects as sub", "aa.subject_id", "sub.id")
      .where("sub.lifecycle_status", "soft_deleted")
      .whereNot("aa.lifecycle_status", "soft_deleted")
      .count("aa.id as cnt")
      .first();

    const orphanedSubjectCount = Number((orphanedSubject as any)?.cnt ?? 0);
    details.assessments_with_deleted_subject = orphanedSubjectCount;

    if (orphanedSubjectCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ASSESSMENT_ORPHANED_SUBJECT,
        severity: "warning",
        message: `${orphanedSubjectCount} assessment merujuk ke mata pelajaran yang sudah dihapus.`,
      });
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas assessment.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_assessment",
    title: "Integritas Data Assessment",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 5. AssessmentScoreIntegrity
//    Detects score records outside the allowed score_min–score_max range of
//    their parent assessment; also finds orphaned scores (no valid enrollment).
// ---------------------------------------------------------------------------
export async function checkAssessmentScoreIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Scores outside allowed range
    const outOfRange = await db("academic_scores as asc")
      .join("academic_assessments as aa", "asc.assessment_id", "aa.id")
      .whereRaw("asc.score < aa.score_min OR asc.score > aa.score_max")
      .whereNot("asc.lifecycle_status", "soft_deleted")
      .count("asc.id as cnt")
      .first();

    const outOfRangeCount = Number((outOfRange as any)?.cnt ?? 0);
    details.scores_out_of_range = outOfRangeCount;

    if (outOfRangeCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_SCORE_OUT_OF_RANGE,
        severity: "critical",
        message: `${outOfRangeCount} skor akademik berada di luar rentang yang diizinkan assessment.`,
      });
    }

    // Scores referencing soft-deleted students
    const orphanedStudent = await db("academic_scores as asc")
      .join("students as s", "asc.student_id", "s.id")
      .where("s.status", "soft_deleted")
      .whereNot("asc.lifecycle_status", "soft_deleted")
      .count("asc.id as cnt")
      .first();

    const orphanedStudentCount = Number((orphanedStudent as any)?.cnt ?? 0);
    details.scores_with_deleted_student = orphanedStudentCount;

    if (orphanedStudentCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_SCORE_ORPHANED_STUDENT,
        severity: "warning",
        message: `${orphanedStudentCount} skor akademik merujuk ke siswa yang sudah dihapus.`,
      });
    }

    // Scores whose enrollment has been soft-deleted
    const orphanedEnrollment = await db("academic_scores as asc")
      .join(
        "student_enrollments as se",
        "asc.student_enrollment_id",
        "se.id"
      )
      .where("se.lifecycle_status", "soft_deleted")
      .whereNot("asc.lifecycle_status", "soft_deleted")
      .count("asc.id as cnt")
      .first();

    const orphanedEnrollmentCount = Number((orphanedEnrollment as any)?.cnt ?? 0);
    details.scores_with_deleted_enrollment = orphanedEnrollmentCount;

    if (orphanedEnrollmentCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_SCORE_ORPHANED_ENROLLMENT,
        severity: "warning",
        message: `${orphanedEnrollmentCount} skor akademik merujuk ke enrollment yang sudah dihapus.`,
      });
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas skor assessment.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_assessment_score",
    title: "Integritas Skor Assessment",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 6. AttendanceIntegrity
//    Detects teacher attendance records referencing soft-deleted users.
//    Also flags any attendance record with a future date (data anomaly).
// ---------------------------------------------------------------------------
export async function checkAttendanceIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Attendance referencing soft-deleted teachers
    const orphanedTeacher = await db("teacher_attendance as ta")
      .join("users as u", "ta.teacher_id", "u.id")
      .where("u.lifecycle_status", "soft_deleted")
      .whereNot("ta.lifecycle_status", "soft_deleted")
      .count("ta.id as cnt")
      .first();

    const orphanedCount = Number((orphanedTeacher as any)?.cnt ?? 0);
    details.attendance_with_deleted_teacher = orphanedCount;

    if (orphanedCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ATTENDANCE_ORPHANED_TEACHER,
        severity: "warning",
        message: `${orphanedCount} rekaman absensi merujuk ke guru yang sudah dihapus.`,
      });
    }

    // Attendance records with a future date
    const futureAttendance = await db("teacher_attendance")
      .where("date", ">", db.raw("CURDATE()"))
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as cnt")
      .first();

    const futureCount = Number((futureAttendance as any)?.cnt ?? 0);
    details.attendance_with_future_date = futureCount;

    if (futureCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_ATTENDANCE_FUTURE_DATE,
        severity: "warning",
        message: `${futureCount} rekaman absensi memiliki tanggal di masa depan.`,
      });
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas data absensi.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_attendance",
    title: "Integritas Data Absensi",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 7. FinanceIntegrity
//    Detects SPP payment records with amount_paid > amount_due (overpayment),
//    payment_status marked as 'paid' but amount_paid = 0, and payments
//    referencing soft-deleted students.
// ---------------------------------------------------------------------------
export async function checkFinanceIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Overpayment (amount_paid > amount_due)
    const overpaid = await db("spp_payments")
      .whereRaw("amount_paid > amount_due")
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as cnt")
      .first();

    const overpaidCount = Number((overpaid as any)?.cnt ?? 0);
    details.spp_overpaid_count = overpaidCount;

    if (overpaidCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_FINANCE_OVERPAYMENT,
        severity: "warning",
        message: `${overpaidCount} tagihan SPP memiliki amount_paid melebihi amount_due.`,
      });
    }

    // Paid status but zero amount_paid
    const paidZeroAmount = await db("spp_payments")
      .where("payment_status", "paid")
      .where("amount_paid", 0)
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as cnt")
      .first();

    const paidZeroCount = Number((paidZeroAmount as any)?.cnt ?? 0);
    details.spp_paid_status_zero_amount = paidZeroCount;

    if (paidZeroCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_FINANCE_PAID_ZERO_AMOUNT,
        severity: "critical",
        message: `${paidZeroCount} tagihan SPP berstatus "paid" tetapi amount_paid = 0.`,
      });
    }

    // SPP payments referencing soft-deleted students
    const orphanedStudent = await db("spp_payments as sp")
      .join("students as s", "sp.student_id", "s.id")
      .where("s.status", "soft_deleted")
      .whereNot("sp.lifecycle_status", "soft_deleted")
      .count("sp.id as cnt")
      .first();

    const orphanedCount = Number((orphanedStudent as any)?.cnt ?? 0);
    details.spp_with_deleted_student = orphanedCount;

    if (orphanedCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_FINANCE_ORPHANED_STUDENT,
        severity: "warning",
        message: `${orphanedCount} tagihan SPP merujuk ke siswa yang sudah dihapus.`,
      });
    }
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas data keuangan.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_finance",
    title: "Integritas Data Keuangan (SPP)",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 8. AuditLogIntegrity
//    Checks for audit_log records with empty/null action or entity_type —
//    these are required fields that indicate logging pipeline failure.
// ---------------------------------------------------------------------------
export async function checkAuditLogIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Logs with missing action
    const missingAction = await db("audit_logs")
      .where((builder: Knex.QueryBuilder) => {
        builder.whereNull("action").orWhere("action", "");
      })
      .count("id as cnt")
      .first();

    const missingActionCount = Number((missingAction as any)?.cnt ?? 0);
    details.audit_logs_missing_action = missingActionCount;

    if (missingActionCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_AUDIT_MISSING_ACTION,
        severity: "warning",
        message: `${missingActionCount} audit log memiliki kolom action yang kosong.`,
      });
    }

    // Logs with missing entity_type
    const missingEntityType = await db("audit_logs")
      .where((builder: Knex.QueryBuilder) => {
        builder.whereNull("entity_type").orWhere("entity_type", "");
      })
      .count("id as cnt")
      .first();

    const missingEntityTypeCount = Number((missingEntityType as any)?.cnt ?? 0);
    details.audit_logs_missing_entity_type = missingEntityTypeCount;

    if (missingEntityTypeCount > 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_AUDIT_MISSING_ENTITY_TYPE,
        severity: "warning",
        message: `${missingEntityTypeCount} audit log memiliki kolom entity_type yang kosong.`,
      });
    }

    // Total recent logs (last 7 days) as a health indicator
    const recentCount = await db("audit_logs")
      .where("created_at", ">=", db.raw("NOW() - INTERVAL 7 DAY"))
      .count("id as cnt")
      .first();

    details.audit_logs_last_7_days = Number((recentCount as any)?.cnt ?? 0);
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa integritas audit log.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_audit_log",
    title: "Integritas Audit Log",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}

// ---------------------------------------------------------------------------
// 9. DashboardDependencyIntegrity
//    Verifies that the data required by the dashboard is present and consistent:
//    - At least one active class exists
//    - At least one active subject exists
//    - At least one active user with role teacher/admin exists
// ---------------------------------------------------------------------------
export async function checkDashboardDependencyIntegrity(): Promise<HealthSection> {
  const start = Date.now();
  const issues: HealthSection["issues"] = [];
  const details: Record<string, unknown> = {};

  try {
    // Active classes
    const activeClasses = await db("classes")
      .where("lifecycle_status", "active")
      .count("id as cnt")
      .first();

    const activeClassCount = Number((activeClasses as any)?.cnt ?? 0);
    details.active_class_count = activeClassCount;

    if (activeClassCount === 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_DASHBOARD_NO_ACTIVE_CLASS,
        severity: "critical",
        message: "Tidak ada kelas aktif. Dashboard tidak dapat menampilkan data kelas.",
      });
    }

    // Active subjects
    const activeSubjects = await db("subjects")
      .where("lifecycle_status", "active")
      .count("id as cnt")
      .first();

    const activeSubjectCount = Number((activeSubjects as any)?.cnt ?? 0);
    details.active_subject_count = activeSubjectCount;

    if (activeSubjectCount === 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_DASHBOARD_NO_ACTIVE_SUBJECT,
        severity: "warning",
        message:
          "Tidak ada mata pelajaran aktif. Fitur penilaian tidak dapat berfungsi.",
      });
    }

    // Active staff users
    const activeStaff = await db("users")
      .whereIn("role", ["administrator", "admin", "teacher"])
      .where("lifecycle_status", "active")
      .count("id as cnt")
      .first();

    const activeStaffCount = Number((activeStaff as any)?.cnt ?? 0);
    details.active_staff_count = activeStaffCount;

    if (activeStaffCount === 0) {
      issues.push({
        code: HEALTH_CODES.INTEGRITY_DASHBOARD_NO_ACTIVE_STAFF,
        severity: "critical",
        message: "Tidak ada akun staff aktif yang dapat mengoperasikan sistem.",
      });
    }

    // Active students
    const activeStudents = await db("students")
      .where("status", "active")
      .count("id as cnt")
      .first();

    details.active_student_count = Number((activeStudents as any)?.cnt ?? 0);
  } catch (err) {
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "unknown",
      message: "Gagal memeriksa dependensi dashboard.",
      technical_details: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  const status =
    issues.length === 0
      ? "healthy"
      : issues.some((i) => i.severity === "critical")
      ? "critical"
      : "warning";

  return {
    id: "integrity_dashboard_dependency",
    title: "Integritas Dependensi Dashboard",
    category: "integrity",
    status,
    duration_ms: Date.now() - start,
    checked_at: now(),
    issues,
    details,
  };
}
