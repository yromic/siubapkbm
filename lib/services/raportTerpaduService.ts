import { db } from "@/lib/db";
import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { resolvePhaseByClassLevel } from "@/lib/utils/academicUtils";
import { getActiveAcademicYear } from "@/lib/services/academicYearService";
import { getActiveSemester } from "@/lib/services/semesterService";
import { getAppSettings } from "@/lib/services/appSettingsService";
import {
  calculateSubjectScore,
  getKKTPPredicate,
  type KKTPPredicateResult,
} from "@/lib/utils/kktpCalculationUtils";
import {
  calculateAcademicOverallAverage,
  getAcademicCategory,
  generateRaportDocumentNumber,
  type RaportCategoryResult,
} from "@/lib/utils/raportCalculationUtils";

export interface RaportSubjectItem {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  assessment_id: string | null;
  scored_tp_count: number;
  total_tp_count: number;
  is_complete: boolean;
  provisional_average: number | null;
  final_score: number | null;
  predicate: KKTPPredicateResult | null;
  competency_description: string | null;
  subject_tutor_note: string | null;
}

export interface RaportAcademicSummary {
  completed_subject_count: number;
  total_subject_count: number;
  is_complete: boolean;
  overall_average: number | null;
  category: RaportCategoryResult | null;
}

export interface RaportStudentIdentity {
  id: string;
  name: string;
  nisn: string | null;
  gender: string | null;
}

export interface RaportPeriodIdentity {
  academic_year_id: string;
  academic_year_name: string;
  semester_id: string;
  semester_name: string;
}

export interface RaportClassIdentity {
  id: string;
  name: string;
  code: string;
  level: number;
  fase: string;
}

export interface RaportTutorIdentity {
  id: string | null;
  name: string;
  nip?: string | null;
}

export interface RaportSchoolIdentity {
  name: string;
  address?: string | null;
  headmaster_name: string;
  headmaster_nip?: string | null;
  letterhead_url?: string | null;
}

export interface RaportSemesterTutorNote {
  id: string | null;
  content: string;
  updated_at?: string | null;
  teacher_name?: string | null;
}

export interface RaportReadinessInfo {
  is_ready: boolean;
  status: "READY" | "INCOMPLETE";
  missing_assessments_count: number;
  incomplete_assessments_count: number;
  reasons: string[];
}

export interface RaportAcademicSummaryReport {
  student: RaportStudentIdentity;
  period: RaportPeriodIdentity;
  class: RaportClassIdentity;
  tutor: RaportTutorIdentity;
  school: RaportSchoolIdentity;
  subjects: RaportSubjectItem[];
  academic_summary: RaportAcademicSummary;
  semester_tutor_note: RaportSemesterTutorNote;
  readiness: RaportReadinessInfo;
  document_number: string;
}

export interface StudentClassReadinessItem {
  student_id: string;
  student_name: string;
  nisn: string | null;
  completed_subject_count: number;
  total_subject_count: number;
  is_ready: boolean;
  status: "READY" | "INCOMPLETE";
  overall_average: number | null;
  category: RaportCategoryResult | null;
}

export interface ClassRaportReadinessResponse {
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  semester_id: string;
  semester_name: string;
  total_students: number;
  ready_students_count: number;
  incomplete_students_count: number;
  class_completion_percentage: number;
  students: StudentClassReadinessItem[];
}

/**
 * Discovers all applicable subjects for a class in a given period.
 * Strategy:
 * 1. Primary: Configured rows in `class_subjects` for class_id.
 * 2. Fallback: If `class_subjects` has no entries for this class, use active rows from `subjects`.
 * 3. Union: Any subjects that already have active `kktp_assessments` for this class + period.
 */
export async function getSubjectsForClassPeriod(
  classId: string,
  academicYearId?: string,
  semesterId?: string
): Promise<Array<{ id: string; name: string; code: string }>> {
  const query = db("class_subjects")
    .join("subjects", "class_subjects.subject_id", "subjects.id")
    .where("class_subjects.class_id", classId)
    .whereNot("class_subjects.lifecycle_status", "soft_deleted")
    .whereNot("subjects.lifecycle_status", "soft_deleted");

  if (semesterId) {
    query.where((builder: Knex.QueryBuilder) => {
      builder.where("class_subjects.semester_id", semesterId).orWhereNull(
        "class_subjects.semester_id"
      );
    });
  }

  const classSubjects = await query.select(
    "subjects.id",
    "subjects.name",
    "subjects.code"
  );

  const subjectMap = new Map<string, { id: string; name: string; code: string }>();
  for (const s of classSubjects) {
    subjectMap.set(s.id, { id: s.id, name: s.name, code: s.code || s.name });
  }

  // Fallback if class_subjects is empty
  if (subjectMap.size === 0) {
    const allSubjects = await db("subjects")
      .where("status", "active")
      .whereNot("lifecycle_status", "soft_deleted")
      .orderBy("code", "asc")
      .select("id", "name", "code");

    for (const s of allSubjects) {
      subjectMap.set(s.id, { id: s.id, name: s.name, code: s.code || s.name });
    }
  }

  // Include any subjects present in kktp_assessments for this class/period
  if (academicYearId && semesterId) {
    const existingAssessments = await db("kktp_assessments")
      .join("subjects", "kktp_assessments.subject_id", "subjects.id")
      .where({
        "kktp_assessments.class_id": classId,
        "kktp_assessments.academic_year_id": academicYearId,
        "kktp_assessments.semester_id": semesterId,
      })
      .whereNot("subjects.lifecycle_status", "soft_deleted")
      .select("subjects.id", "subjects.name", "subjects.code");

    for (const ass of existingAssessments) {
      if (!subjectMap.has(ass.id)) {
        subjectMap.set(ass.id, {
          id: ass.id,
          name: ass.name,
          code: ass.code || ass.name,
        });
      }
    }
  }

  return Array.from(subjectMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Retrieves Lembar 1: Academic Summary for a student in a semester.
 * Consumes normalized KKTP assessments as the single academic source of truth.
 */
export async function getRaportTerpaduAcademicSummary(params: {
  studentId: string;
  academicYearId?: string;
  semesterId?: string;
}): Promise<RaportAcademicSummaryReport> {
  const { studentId } = params;
  if (!studentId) {
    throw new AppError("studentId wajib disertakan.", "ERR_VALIDATION", 400);
  }

  // 1. Verify student
  const student = await db("students").where("id", studentId).first();
  if (!student) {
    throw new AppError("Peserta didik tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  // 2. Resolve Academic Year and Semester
  let academicYearId = params.academicYearId;
  let semesterId = params.semesterId;

  if (!academicYearId) {
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) {
      throw new AppError(
        "Tidak ada tahun ajaran aktif.",
        "ERR_NO_ACTIVE_ACADEMIC_YEAR",
        400
      );
    }
    academicYearId = activeYear.id;
  }

  if (!semesterId) {
    const activeSem = await getActiveSemester(academicYearId!);
    if (!activeSem) {
      throw new AppError(
        "Tidak ada semester aktif.",
        "ERR_NO_ACTIVE_SEMESTER",
        400
      );
    }
    semesterId = activeSem.id;
  }

  const academicYear = await db("academic_years")
    .where("id", academicYearId)
    .first();
  if (!academicYear) {
    throw new AppError("Tahun ajaran tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const semester = await db("semesters").where("id", semesterId).first();
  if (!semester) {
    throw new AppError("Semester tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  // 3. Find active enrollment
  const enrollment = await db("student_enrollments")
    .join("classes", "student_enrollments.class_id", "classes.id")
    .where({
      "student_enrollments.student_id": studentId,
      "student_enrollments.semester_id": semesterId,
      "student_enrollments.status": "active",
    })
    .whereNot("student_enrollments.lifecycle_status", "soft_deleted")
    .select(
      "student_enrollments.id as enrollment_id",
      "classes.id as class_id",
      "classes.name as class_name",
      "classes.code as class_code",
      "classes.level as class_level"
    )
    .first();

  if (!enrollment) {
    throw new AppError(
      "Murid tidak memiliki rombel/kelas aktif di semester ini.",
      "ERR_NOT_ENROLLED",
      400
    );
  }

  const fase = resolvePhaseByClassLevel(
    enrollment.class_level ?? enrollment.class_name
  );

  // 4. Discover subjects for this class and period
  const subjects = await getSubjectsForClassPeriod(
    enrollment.class_id,
    academicYearId,
    semesterId
  );

  // 5. Retrieve all normalized KKTP assessments for (class, academic_year, semester)
  const assessments = await db("kktp_assessments").where({
    class_id: enrollment.class_id,
    academic_year_id: academicYearId,
    semester_id: semesterId,
  });
  const assessmentMap = new Map<string, any>(
    assessments.map((a: any) => [a.subject_id, a])
  );
  const assessmentIds = assessments.map((a: any) => a.id);

  // 6. TP counts per assessment
  const tpCounts =
    assessmentIds.length > 0
      ? await db("kktp_assessment_tps")
          .whereIn("assessment_id", assessmentIds)
          .groupBy("assessment_id")
          .select("assessment_id")
          .count("id as count")
      : [];
  const tpCountMap = new Map<string, number>(
    tpCounts.map((t: any) => [t.assessment_id, Number(t.count)])
  );

  // 7. Student scores across assessments
  const rawScores =
    assessmentIds.length > 0
      ? await db("kktp_student_scores")
          .whereIn("assessment_id", assessmentIds)
          .where("student_id", studentId)
          .select("assessment_id", "score")
      : [];
  const scoreGroupMap = new Map<string, (number | null)[]>();
  for (const s of rawScores) {
    if (!scoreGroupMap.has(s.assessment_id))
      scoreGroupMap.set(s.assessment_id, []);
    scoreGroupMap
      .get(s.assessment_id)!
      .push(s.score !== null ? Number(s.score) : null);
  }

  // 8. Student summaries across assessments (competency description & subject notes)
  const summaries =
    assessmentIds.length > 0
      ? await db("kktp_student_summaries")
          .whereIn("assessment_id", assessmentIds)
          .where("student_id", studentId)
          .select("*")
      : [];
  const summaryMap = new Map<string, any>(
    summaries.map((s: any) => [s.assessment_id, s])
  );

  // 9. Build Subject Rows & Evaluate Completeness
  let missingAssessmentsCount = 0;
  let incompleteAssessmentsCount = 0;
  const readinessReasons: string[] = [];

  const subjectRows: RaportSubjectItem[] = subjects.map((subj) => {
    const ass = assessmentMap.get(subj.id);
    if (!ass) {
      missingAssessmentsCount++;
      readinessReasons.push(
        `Mata pelajaran "${subj.name}" belum memiliki penilaian KKTP.`
      );
      return {
        subject_id: subj.id,
        subject_name: subj.name,
        subject_code: subj.code,
        assessment_id: null,
        scored_tp_count: 0,
        total_tp_count: 0,
        is_complete: false,
        provisional_average: null,
        final_score: null,
        predicate: null,
        competency_description: null,
        subject_tutor_note: null,
      };
    }

    const totalTps = tpCountMap.get(ass.id) || 0;
    const scores = scoreGroupMap.get(ass.id) || [];
    const validScores = scores.filter(
      (s) => s !== null && s !== undefined
    ) as number[];
    const scoredCount = validScores.length;
    const avg = calculateSubjectScore(validScores);
    const pred = getKKTPPredicate(avg);

    // CRITICAL COMPLETION INVARIANT:
    // A subject is reportable ONLY when all required configured TPs have been assessed.
    const isComplete = totalTps > 0 && scoredCount === totalTps;
    if (!isComplete) {
      incompleteAssessmentsCount++;
      if (totalTps === 0) {
        readinessReasons.push(
          `Mata pelajaran "${subj.name}" belum memiliki konfigurasi Tujuan Pembelajaran (TP).`
        );
      } else {
        readinessReasons.push(
          `Mata pelajaran "${subj.name}" baru dinilai ${scoredCount} dari ${totalTps} TP.`
        );
      }
    }

    const sum = summaryMap.get(ass.id);

    return {
      subject_id: subj.id,
      subject_name: subj.name,
      subject_code: subj.code,
      assessment_id: ass.id,
      scored_tp_count: scoredCount,
      total_tp_count: totalTps,
      is_complete: isComplete,
      provisional_average: !isComplete ? avg : null,
      final_score: isComplete ? avg : null,
      predicate: avg !== null ? pred : null,
      competency_description: sum?.competency_description || null,
      subject_tutor_note: sum?.catatan_tutor || null,
    };
  });

  // 10. Academic Summary Overall Aggregation
  const totalSubjectCount = subjectRows.length;
  const completedSubjectCount = subjectRows.filter((s) => s.is_complete).length;
  const isOverallComplete =
    totalSubjectCount > 0 && completedSubjectCount === totalSubjectCount;

  // Only complete/reportable subject scores contribute to final overall average
  const completeScores = subjectRows
    .filter((s) => s.is_complete && s.final_score !== null)
    .map((s) => s.final_score as number);

  const overallAverage = isOverallComplete
    ? calculateAcademicOverallAverage(completeScores)
    : null;
  const category =
    overallAverage !== null ? getAcademicCategory(overallAverage) : null;

  // 11. Retrieve Homeroom Tutor (Tutor Pendamping Kelas)
  const tutorAssignment = await db("class_teacher_assignments")
    .join("users", "class_teacher_assignments.teacher_user_id", "users.id")
    .leftJoin("teacher_profiles", "users.id", "teacher_profiles.user_id")
    .where({
      "class_teacher_assignments.class_id": enrollment.class_id,
      "class_teacher_assignments.semester_id": semesterId,
      "class_teacher_assignments.status": "active",
    })
    .whereNot("class_teacher_assignments.lifecycle_status", "soft_deleted")
    .select(
      "users.id as user_id",
      "users.name as tutor_name",
      "teacher_profiles.nip as tutor_nip"
    )
    .first();

  const tutorInfo: RaportTutorIdentity = {
    id: tutorAssignment?.user_id || null,
    name: tutorAssignment?.tutor_name || "Tutor Pendamping Kelas",
    nip: tutorAssignment?.tutor_nip || null,
  };

  // 12. Retrieve Semester-level Tutor Note (Catatan Tutor Pendamping)
  const semesterNote = await db("teacher_notes")
    .leftJoin("users", "teacher_notes.teacher_user_id", "users.id")
    .where({
      "teacher_notes.student_id": studentId,
      "teacher_notes.academic_year_id": academicYearId,
      "teacher_notes.semester_id": semesterId,
      "teacher_notes.note_type": "raport_terpadu_semester",
    })
    .whereNot("teacher_notes.lifecycle_status", "soft_deleted")
    .select(
      "teacher_notes.id",
      "teacher_notes.content",
      "teacher_notes.updated_at",
      "users.name as teacher_name"
    )
    .orderBy("teacher_notes.updated_at", "desc")
    .first();

  const tutorNoteInfo: RaportSemesterTutorNote = {
    id: semesterNote?.id || null,
    content: semesterNote?.content || "",
    updated_at: semesterNote?.updated_at
      ? new Date(semesterNote.updated_at).toISOString()
      : null,
    teacher_name: semesterNote?.teacher_name || null,
  };

  // 13. Institutional School Profile from app_settings
  const settings = await getAppSettings();
  const schoolInfo: RaportSchoolIdentity = {
    name: settings.school_name || "PKBM Baitusyukur Learning Center",
    address: settings.school_address || null,
    headmaster_name: settings.school_headmaster_name || "Kepala PKBM BLC",
    headmaster_nip: settings.school_headmaster_nip || null,
    letterhead_url: settings.active_letterhead_url || null,
  };

  // 14. Document Number
  const documentNumber = generateRaportDocumentNumber(
    academicYear.name,
    semester.name,
    enrollment.class_name,
    student.nisn || student.id
  );

  return {
    student: {
      id: student.id,
      name: student.full_name,
      nisn: student.nisn || null,
      gender: student.gender || null,
    },
    period: {
      academic_year_id: academicYear.id,
      academic_year_name: academicYear.name,
      semester_id: semester.id,
      semester_name: semester.name,
    },
    class: {
      id: enrollment.class_id,
      name: enrollment.class_name,
      code: enrollment.class_code,
      level: enrollment.class_level,
      fase,
    },
    tutor: tutorInfo,
    school: schoolInfo,
    subjects: subjectRows,
    academic_summary: {
      completed_subject_count: completedSubjectCount,
      total_subject_count: totalSubjectCount,
      is_complete: isOverallComplete,
      overall_average: overallAverage,
      category,
    },
    semester_tutor_note: tutorNoteInfo,
    readiness: {
      is_ready: isOverallComplete,
      status: isOverallComplete ? "READY" : "INCOMPLETE",
      missing_assessments_count: missingAssessmentsCount,
      incomplete_assessments_count: incompleteAssessmentsCount,
      reasons: readinessReasons,
    },
    document_number: documentNumber,
  };
}

/**
 * Evaluates Raport readiness for all students in a class.
 * Executed in batch queries to prevent N+1 performance bottlenecks.
 */
export async function getClassRaportReadiness(params: {
  classId: string;
  academicYearId?: string;
  semesterId?: string;
}): Promise<ClassRaportReadinessResponse> {
  const { classId } = params;
  if (!classId) {
    throw new AppError("classId wajib disertakan.", "ERR_VALIDATION", 400);
  }

  const cls = await db("classes").where("id", classId).first();
  if (!cls) {
    throw new AppError("Kelas tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  let academicYearId = params.academicYearId;
  let semesterId = params.semesterId;

  if (!academicYearId) {
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) throw new AppError("Tidak ada tahun ajaran aktif.", "ERR_NO_ACTIVE_ACADEMIC_YEAR", 400);
    academicYearId = activeYear.id;
  }

  if (!semesterId) {
    const activeSem = await getActiveSemester(academicYearId!);
    if (!activeSem) throw new AppError("Tidak ada semester aktif.", "ERR_NO_ACTIVE_SEMESTER", 400);
    semesterId = activeSem.id;
  }

  const academicYear = await db("academic_years").where("id", academicYearId).first();
  const semester = await db("semesters").where("id", semesterId).first();

  // 1. Get all enrolled students in this class for the semester
  const enrolledStudents = await db("student_enrollments")
    .join("students", "student_enrollments.student_id", "students.id")
    .where({
      "student_enrollments.class_id": classId,
      "student_enrollments.semester_id": semesterId,
      "student_enrollments.status": "active",
    })
    .whereNot("student_enrollments.lifecycle_status", "soft_deleted")
    .select("students.id", "students.full_name", "students.nisn")
    .orderBy("students.full_name", "asc");

  // 2. Discover subjects for this class and period
  const subjects = await getSubjectsForClassPeriod(classId, academicYearId, semesterId);
  const totalSubjects = subjects.length;

  // 3. Get all assessments for this class + period
  const assessments = await db("kktp_assessments").where({
    class_id: classId,
    academic_year_id: academicYearId,
    semester_id: semesterId,
  });
  const assessmentIds = assessments.map((a: any) => a.id);

  // 4. Get TP count per assessment
  const tpCounts =
    assessmentIds.length > 0
      ? await db("kktp_assessment_tps")
          .whereIn("assessment_id", assessmentIds)
          .groupBy("assessment_id")
          .select("assessment_id")
          .count("id as count")
      : [];
  const tpCountMap = new Map<string, number>(
    tpCounts.map((t: any) => [t.assessment_id, Number(t.count)])
  );

  // 5. Get scored TP counts grouped by (student_id, assessment_id)
  const scoreGroupRows =
    assessmentIds.length > 0 && enrolledStudents.length > 0
      ? await db("kktp_student_scores")
          .whereIn("assessment_id", assessmentIds)
          .whereIn("student_id", enrolledStudents.map((s: any) => s.id))
          .whereNotNull("score")
          .groupBy("student_id", "assessment_id")
          .select("student_id", "assessment_id")
          .count("id as scored_count")
          .avg("score as raw_avg")
      : [];

  const studentAssessmentScoreMap = new Map<string, Map<string, { scoredCount: number; avg: number }>>();
  for (const row of scoreGroupRows) {
    if (!studentAssessmentScoreMap.has(row.student_id)) {
      studentAssessmentScoreMap.set(row.student_id, new Map());
    }
    studentAssessmentScoreMap.get(row.student_id)!.set(row.assessment_id, {
      scoredCount: Number(row.scored_count),
      avg: Number(row.raw_avg),
    });
  }

  // 6. Map readiness per student
  let readyCount = 0;
  const studentReadinessList: StudentClassReadinessItem[] = enrolledStudents.map((std: any) => {
    let completedCount = 0;
    const finalScores: number[] = [];
    const studentScores = studentAssessmentScoreMap.get(std.id);

    for (const subj of subjects) {
      const ass = assessments.find((a: any) => a.subject_id === subj.id);
      if (!ass) continue;

      const totalTps = tpCountMap.get(ass.id) || 0;
      const scoredInfo = studentScores?.get(ass.id);
      const scoredCount = scoredInfo?.scoredCount || 0;

      if (totalTps > 0 && scoredCount === totalTps) {
        completedCount++;
        if (scoredInfo?.avg !== undefined && scoredInfo.avg !== null) {
          finalScores.push(Math.round(scoredInfo.avg * 100) / 100);
        }
      }
    }

    const isReady = totalSubjects > 0 && completedCount === totalSubjects;
    if (isReady) readyCount++;

    const overallAvg = isReady ? calculateAcademicOverallAverage(finalScores) : null;
    const category = overallAvg !== null ? getAcademicCategory(overallAvg) : null;

    return {
      student_id: std.id,
      student_name: std.full_name,
      nisn: std.nisn || null,
      completed_subject_count: completedCount,
      total_subject_count: totalSubjects,
      is_ready: isReady,
      status: isReady ? "READY" : "INCOMPLETE",
      overall_average: overallAvg,
      category,
    };
  });

  const totalStudents = enrolledStudents.length;
  const incompleteCount = totalStudents - readyCount;
  const completionPercentage =
    totalStudents > 0 ? Math.round((readyCount / totalStudents) * 100) : 0;

  return {
    class_id: classId,
    class_name: cls.name,
    academic_year_id: academicYearId!,
    academic_year_name: academicYear?.name || "",
    semester_id: semesterId!,
    semester_name: semester.name || "",
    total_students: totalStudents,
    ready_students_count: readyCount,
    incomplete_students_count: incompleteCount,
    class_completion_percentage: completionPercentage,
    students: studentReadinessList,
  };
}

/**
 * Saves or updates the overall semester-level tutor note in `teacher_notes`.
 */
export async function saveSemesterTutorNote(params: {
  studentId: string;
  academicYearId: string;
  semesterId: string;
  content: string;
  teacherUserId?: string;
}): Promise<{ id: string; content: string; updated_at: string }> {
  const { studentId, academicYearId, semesterId, content, teacherUserId } = params;

  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError(
      "studentId, academicYearId, dan semesterId wajib diisi.",
      "ERR_VALIDATION",
      400
    );
  }

  // Find active student enrollment
  const enrollment = await db("student_enrollments")
    .where({
      student_id: studentId,
      semester_id: semesterId,
      status: "active",
    })
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  if (!enrollment) {
    throw new AppError(
      "Murid tidak memiliki enrollment aktif di semester ini.",
      "ERR_NOT_ENROLLED",
      400
    );
  }

  // Resolve teacher user
  let finalTeacherUserId = teacherUserId;
  if (!finalTeacherUserId) {
    const tutorAssignment = await db("class_teacher_assignments")
      .where({
        class_id: enrollment.class_id,
        semester_id: semesterId,
        status: "active",
      })
      .whereNot("lifecycle_status", "soft_deleted")
      .first();
    finalTeacherUserId = tutorAssignment?.teacher_user_id;
  }

  if (!finalTeacherUserId) {
    const adminUser = await db("users")
      .whereIn("role", ["administrator", "admin"])
      .first();
    finalTeacherUserId = adminUser?.id;
  }

  if (!finalTeacherUserId) {
    throw new AppError(
      "Tidak dapat menentukan user tutor untuk mencatat catatan ini.",
      "ERR_NO_TEACHER",
      400
    );
  }

  const existingNote = await db("teacher_notes")
    .where({
      student_id: studentId,
      academic_year_id: academicYearId,
      semester_id: semesterId,
      note_type: "raport_terpadu_semester",
    })
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  const now = new Date();

  if (existingNote) {
    await db("teacher_notes")
      .where("id", existingNote.id)
      .update({
        content: content.trim(),
        teacher_user_id: finalTeacherUserId,
        updated_at: now,
      });

    return {
      id: existingNote.id,
      content: content.trim(),
      updated_at: now.toISOString(),
    };
  } else {
    const newId = uuidv4();
    await db("teacher_notes").insert({
      id: newId,
      student_id: studentId,
      student_enrollment_id: enrollment.id,
      teacher_user_id: finalTeacherUserId,
      note_type: "raport_terpadu_semester",
      title: "Catatan Tutor Pendamping Raport Terpadu",
      content: content.trim(),
      visibility: "parent",
      academic_year_id: academicYearId,
      semester_id: semesterId,
      lifecycle_status: "active",
      created_at: now,
      updated_at: now,
    });

    return {
      id: newId,
      content: content.trim(),
      updated_at: now.toISOString(),
    };
  }
}
