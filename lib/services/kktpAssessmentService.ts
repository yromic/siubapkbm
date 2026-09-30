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
  generateKKTPDocumentNumber,
  type KKTPEvidenceStatus,
  type KKTPSourceType,
  type KKTPAssessmentStatus,
  type KKTPPredicateCode,
  type KKTPPredicateResult,
} from "@/lib/utils/kktpCalculationUtils";

export {
  calculateSubjectScore,
  getKKTPPredicate,
  generateKKTPDocumentNumber,
  type KKTPEvidenceStatus,
  type KKTPSourceType,
  type KKTPAssessmentStatus,
  type KKTPPredicateCode,
  type KKTPPredicateResult,
};

export interface TPConfigInput {
  id?: string;
  tp_id?: string | null;
  tp_code?: string | null;
  tp_text_snapshot: string;
  source_type?: KKTPSourceType;
  order_index?: number;
}

export interface StudentScoreInputItem {
  student_id: string;
  student_enrollment_id?: string | null;
  scores: Record<
    string,
    {
      score: number | null;
      evidence_status?: KKTPEvidenceStatus | null;
      reflection?: string | null;
    }
  >;
  catatan_tutor?: string | null;
  competency_description?: string | null;
}

/**
 * Retrieves or creates a class-level KKTP assessment session for a Class + Subject + Period.
 * Enforces uq_kktp_assessment_scope: unique per (class_id, subject_id, academic_year_id, semester_id).
 */
export async function getOrCreateKKTPAssessment(params: {
  class_id: string;
  subject_id: string;
  academic_year_id?: string;
  semester_id?: string;
  title?: string;
  userId?: string;
}): Promise<any> {
  const { class_id, subject_id } = params;
  if (!class_id || !subject_id) {
    throw new AppError("class_id and subject_id are required.", "ERR_VALIDATION", 400);
  }

  // 1. Verify class and subject existence
  const cls = await db("classes").where("id", class_id).first();
  if (!cls) throw new AppError("Kelas tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const subj = await db("subjects").where("id", subject_id).first();
  if (!subj) throw new AppError("Mata pelajaran tidak ditemukan.", "ERR_NOT_FOUND", 404);

  // 2. Resolve Academic Year and Semester
  let academic_year_id = params.academic_year_id;
  let semester_id = params.semester_id;

  if (!academic_year_id) {
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) throw new AppError("Tidak ada tahun ajaran aktif yang terdaftar.", "ERR_NO_ACTIVE_ACADEMIC_YEAR", 400);
    academic_year_id = activeYear.id;
  }

  if (!semester_id) {
    const activeSem = await getActiveSemester(academic_year_id!);
    if (!activeSem) throw new AppError("Tidak ada semester aktif yang terdaftar.", "ERR_NO_ACTIVE_SEMESTER", 400);
    semester_id = activeSem.id;
  }

  // 3. Resolve fase
  const fase = resolvePhaseByClassLevel(cls.level ?? cls.name);

  // 4. Find existing assessment
  let assessment = await db("kktp_assessments")
    .where({
      class_id,
      subject_id,
      academic_year_id,
      semester_id,
    })
    .first();

  if (!assessment) {
    const id = uuidv4();
    const defaultTitle = params.title || `KKTP ${subj.name} — ${cls.name}`;
    const now = new Date();

    const settings = await getAppSettings().catch(() => ({} as any));
    const activeLetterheadId = settings?.active_letterhead_id || null;

    try {
      await db("kktp_assessments").insert({
        id,
        title: defaultTitle,
        class_id,
        subject_id,
        academic_year_id,
        semester_id,
        fase,
        status: "DRAFT",
        created_by: params.userId || null,
        letterhead_version_id: activeLetterheadId,
        created_at: now,
        updated_at: now,
      });

      assessment = await db("kktp_assessments").where("id", id).first();
    } catch (insertErr: any) {
      // Handle race conditions where another concurrent request created it first
      if (insertErr.code === "ER_DUP_ENTRY" || String(insertErr.message).includes("uq_kktp_assessment_scope")) {
        assessment = await db("kktp_assessments")
          .where({ class_id, subject_id, academic_year_id, semester_id })
          .first();
      } else {
        throw insertErr;
      }
    }
  }

  return assessment;
}

/**
 * Retrieves assessment detail with metadata, configured TPs, and student roster.
 */
export async function getKKTPAssessmentDetail(assessmentId: string): Promise<any> {
  const assessment = await db("kktp_assessments")
    .join("classes", "kktp_assessments.class_id", "classes.id")
    .join("subjects", "kktp_assessments.subject_id", "subjects.id")
    .join("academic_years", "kktp_assessments.academic_year_id", "academic_years.id")
    .join("semesters", "kktp_assessments.semester_id", "semesters.id")
    .leftJoin("users", "kktp_assessments.created_by", "users.id")
    .where("kktp_assessments.id", assessmentId)
    .select(
      "kktp_assessments.*",
      "classes.name as class_name",
      "classes.code as class_code",
      "classes.level as class_level",
      "subjects.name as subject_name",
      "subjects.code as subject_code",
      "academic_years.name as academic_year_name",
      "semesters.name as semester_name",
      "semesters.is_active as is_semester_active",
      "semesters.lifecycle_status as semester_lifecycle_status",
      "users.name as creator_name"
    )
    .first();

  if (!assessment) {
    throw new AppError("Asesmen KKTP tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const tps = await db("kktp_assessment_tps")
    .where("assessment_id", assessmentId)
    .orderBy("order_index", "asc")
    .select(
      "id",
      "assessment_id",
      "tp_id",
      "tp_code",
      "tp_text_snapshot",
      "source_type",
      "order_index",
      "created_at"
    );

  return { assessment, tps };
}

/**
 * Replaces/configures the shared TP set for a KKTP assessment session.
 * Stores text snapshots so historical assessments do not mutate if TP Bank entries change.
 */
export async function configureAssessmentTPs(
  assessmentId: string,
  tps: TPConfigInput[],
  _userId?: string
): Promise<{ configuredCount: number }> {
  if (!tps || !Array.isArray(tps)) {
    throw new AppError("Daftar TP harus berupa array.", "ERR_VALIDATION", 400);
  }

  const assessment = await db("kktp_assessments").where("id", assessmentId).first();
  if (!assessment) throw new AppError("Asesmen KKTP tidak ditemukan.", "ERR_NOT_FOUND", 404);

  // Check semester mutation permission
  const sem = await db("semesters").where("id", assessment.semester_id).first();
  if (sem && (Number(sem.is_active) !== 1 || sem.lifecycle_status === "finalized")) {
    throw new AppError("Semester sudah terkunci atau tidak aktif. Pengubahan TP tidak diizinkan.", "ERR_SEMESTER_LOCKED", 403);
  }

  await db.transaction(async (trx: Knex.Transaction) => {
    // 1. Fetch existing TPs for this assessment to preserve IDs where possible
    const existingTps = await trx("kktp_assessment_tps")
      .where("assessment_id", assessmentId)
      .select("id", "tp_id", "tp_text_snapshot");

    const existingMapByTpId = new Map<string, string>();
    const existingMapByText = new Map<string, string>();
    existingTps.forEach((t) => {
      if (t.tp_id) existingMapByTpId.set(t.tp_id, t.id);
      existingMapByText.set(t.tp_text_snapshot.trim().toLowerCase(), t.id);
    });

    const newRows: any[] = [];
    const retainedIds = new Set<string>();

    tps.forEach((item, index) => {
      const text = (item.tp_text_snapshot || "").trim();
      if (!text) return; // skip blank

      // Determine reuse id
      let targetId = item.id;
      if (!targetId && item.tp_id && existingMapByTpId.has(item.tp_id)) {
        targetId = existingMapByTpId.get(item.tp_id);
      } else if (!targetId && existingMapByText.has(text.toLowerCase())) {
        targetId = existingMapByText.get(text.toLowerCase());
      }
      if (!targetId) {
        targetId = uuidv4();
      }

      retainedIds.add(targetId!);
      newRows.push({
        id: targetId!,
        assessment_id: assessmentId,
        tp_id: item.tp_id || null,
        tp_code: item.tp_code || `TP-${String(index + 1).padStart(2, "0")}`,
        tp_text_snapshot: text,
        source_type: item.source_type || (item.tp_id ? "TP_BANK" : "MANUAL"),
        order_index: item.order_index ?? index + 1,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    // 2. Remove assessment TPs no longer retained (cascades related student scores safely)
    const toDeleteIds = existingTps
      .filter((t) => !retainedIds.has(t.id))
      .map((t) => t.id);

    if (toDeleteIds.length > 0) {
      await trx("kktp_assessment_tps").whereIn("id", toDeleteIds).delete();

      // Re-sync summaries for all students in this assessment to avoid stale averages
      const remainingTps = await trx("kktp_assessment_tps")
        .where("assessment_id", assessmentId)
        .select("id");
      const remainingTpIds = remainingTps.map((t: any) => t.id as string);

      const existingSummaries = await trx("kktp_student_summaries")
        .where("assessment_id", assessmentId)
        .select("id", "student_id");

      for (const sum of existingSummaries) {
        let newAvg: number | null = null;
        let isComplete = false;
        let scoredCount = 0;

        if (remainingTpIds.length > 0) {
          const studentScores = await trx("kktp_student_scores")
            .where({ assessment_id: assessmentId, student_id: sum.student_id })
            .whereIn("assessment_tp_id", remainingTpIds)
            .select("score");

          const nums = studentScores.map((s) => (s.score !== null ? Number(s.score) : null));
          scoredCount = nums.filter((n) => n !== null).length;
          newAvg = calculateSubjectScore(nums);
          isComplete = remainingTpIds.length > 0 && scoredCount === remainingTpIds.length;
        }

        const predicateInfo = getKKTPPredicate(newAvg);
        await trx("kktp_student_summaries").where("id", sum.id).update({
          average_score: newAvg,
          predicate: newAvg !== null ? predicateInfo.label : null,
          status: isComplete ? "COMPLETED" : "DRAFT",
          updated_at: new Date(),
        });
      }
    }

    // 3. Upsert configured TPs
    for (const row of newRows) {
      const existing = await trx("kktp_assessment_tps").where("id", row.id).first();
      if (existing) {
        await trx("kktp_assessment_tps").where("id", row.id).update({
          tp_id: row.tp_id,
          tp_code: row.tp_code,
          tp_text_snapshot: row.tp_text_snapshot,
          source_type: row.source_type,
          order_index: row.order_index,
          updated_at: new Date(),
        });
      } else {
        await trx("kktp_assessment_tps").insert(row);
      }
    }

    // 4. Update assessment updated_at & status
    await trx("kktp_assessments").where("id", assessmentId).update({
      status: newRows.length > 0 ? "IN_PROGRESS" : "DRAFT",
      updated_at: new Date(),
    });
  });

  return { configuredCount: tps.length };
}

/**
 * Returns the Student × TP Gradebook Matrix read model.
 * Avoids N+1 queries by bulk fetching enrollments, TPs, scores, and summaries.
 */
export async function getKKTPMatrixData(filters: {
  class_id: string;
  subject_id: string;
  academic_year_id?: string;
  semester_id?: string;
  assessment_id?: string;
}): Promise<any> {
  let assessmentId = filters.assessment_id;

  if (!assessmentId) {
    const session = await getOrCreateKKTPAssessment({
      class_id: filters.class_id,
      subject_id: filters.subject_id,
      academic_year_id: filters.academic_year_id,
      semester_id: filters.semester_id,
    });
    assessmentId = session.id;
  }

  const { assessment, tps } = await getKKTPAssessmentDetail(assessmentId!);

  // 1. Fetch active students enrolled in this class and semester
  const enrollments = await db("student_enrollments")
    .join("students", "student_enrollments.student_id", "students.id")
    .where("student_enrollments.class_id", assessment.class_id)
    .where("student_enrollments.status", "active")
    .whereNot("student_enrollments.lifecycle_status", "soft_deleted")
    .whereNot("students.status", "soft_deleted")
    .select(
      "students.id as student_id",
      "students.full_name as student_name",
      "students.nisn as student_nisn",
      "students.gender",
      "student_enrollments.id as student_enrollment_id"
    )
    .orderBy("students.full_name", "asc");

  // 2. Fetch all student scores for this assessment
  const rawScores = await db("kktp_student_scores")
    .where("assessment_id", assessmentId)
    .select(
      "student_id",
      "assessment_tp_id",
      "score",
      "evidence_status",
      "reflection"
    );

  // Map scores: student_id -> { [assessment_tp_id]: { score, evidence_status, reflection } }
  const scoreMap = new Map<string, Record<string, any>>();
  for (const s of rawScores) {
    if (!scoreMap.has(s.student_id)) {
      scoreMap.set(s.student_id, {});
    }
    scoreMap.get(s.student_id)![s.assessment_tp_id] = {
      score: s.score !== null ? Number(s.score) : null,
      evidence_status: s.evidence_status,
      reflection: s.reflection,
    };
  }

  // 3. Fetch summaries
  const rawSummaries = await db("kktp_student_summaries")
    .where("assessment_id", assessmentId)
    .select(
      "student_id",
      "average_score",
      "predicate",
      "competency_description",
      "catatan_tutor",
      "status"
    );

  const summaryMap = new Map<string, any>();
  for (const sum of rawSummaries) {
    summaryMap.set(sum.student_id, {
      average_score: sum.average_score !== null ? Number(sum.average_score) : null,
      predicate: sum.predicate,
      competency_description: sum.competency_description,
      catatan_tutor: sum.catatan_tutor,
      status: sum.status,
    });
  }

  // 4. Construct matrix rows
  const matrix = enrollments.map((enr: any) => {
    const rawScores = scoreMap.get(enr.student_id) || {};
    const studentScores: Record<string, any> = {};
    for (const tp of tps) {
      studentScores[tp.id] = rawScores[tp.id] || { score: null, evidence_status: null, reflection: null };
    }
    const existingSummary = summaryMap.get(enr.student_id);

    // Compute live average across configured TPs as canonical source of truth
    const scoreValues = tps.map((tp: any) => studentScores[tp.id]?.score);
    const calculatedAvg = calculateSubjectScore(scoreValues);
    const predicateInfo = getKKTPPredicate(calculatedAvg);

    const totalTpCount = tps.length;
    const scoredTpCount = scoreValues.filter((v: any) => v !== null && v !== undefined).length;
    const isComplete = totalTpCount > 0 && scoredTpCount === totalTpCount;
    const completionPercentage = totalTpCount > 0 ? Math.round((scoredTpCount / totalTpCount) * 100) : 0;
    const displayStatus: "DRAFT" | "IN_PROGRESS" | "COMPLETED" = isComplete
      ? "COMPLETED"
      : scoredTpCount > 0
        ? "IN_PROGRESS"
        : "DRAFT";

    return {
      student_id: enr.student_id,
      student_name: enr.student_name,
      student_nisn: enr.student_nisn || null,
      gender: enr.gender || null,
      student_enrollment_id: enr.student_enrollment_id,
      scores: studentScores,
      summary: {
        average_score: calculatedAvg,
        provisional_average: !isComplete ? calculatedAvg : null,
        final_score: isComplete ? calculatedAvg : null,
        predicate: calculatedAvg !== null ? predicateInfo.label : null,
        predicate_code: predicateInfo.code,
        predicate_color: predicateInfo.colorClass,
        competency_description: existingSummary?.competency_description || null,
        catatan_tutor: existingSummary?.catatan_tutor || null,
        status: displayStatus,
        scored_tp_count: scoredTpCount,
        total_tp_count: totalTpCount,
        completion_percentage: completionPercentage,
        is_complete: isComplete,
      },
    };
  });

  return {
    assessment,
    tps,
    matrix,
    students: matrix,
    total_students: enrollments.length,
    configured_tp_count: tps.length,
  };
}

/**
 * Saves entire class gradebook scores transactionally.
 * Validates assessment ownership, class enrollment, TP membership, and score bounds (0-100).
 */
export async function saveKKTPMatrixScores(
  assessmentId: string,
  studentScores: StudentScoreInputItem[],
  _actor?: { id: string; role: string }
): Promise<{ savedStudentsCount: number; savedScoresCount: number }> {
  if (!studentScores || !Array.isArray(studentScores)) {
    throw new AppError("studentScores harus berupa array.", "ERR_VALIDATION", 400);
  }

  const assessment = await db("kktp_assessments").where("id", assessmentId).first();
  if (!assessment) throw new AppError("Asesmen KKTP tidak ditemukan.", "ERR_NOT_FOUND", 404);

  // Check semester mutation permission
  const sem = await db("semesters").where("id", assessment.semester_id).first();
  if (sem && (Number(sem.is_active) !== 1 || sem.lifecycle_status === "finalized")) {
    throw new AppError("Semester sudah terkunci atau tidak aktif. Pengubahan nilai tidak diizinkan.", "ERR_SEMESTER_LOCKED", 403);
  }

  // 1. Fetch valid TPs for this assessment
  const validTps = await db("kktp_assessment_tps")
    .where("assessment_id", assessmentId)
    .select("id");
  const validTpIds = new Set(validTps.map((t: any) => t.id as string));

  // 2. Fetch valid enrollments for this class
  const classEnrollments = await db("student_enrollments")
    .where("class_id", assessment.class_id)
    .where("status", "active")
    .whereNot("lifecycle_status", "soft_deleted")
    .select("student_id", "id");

  const enrollmentMap = new Map<string, string>();
  classEnrollments.forEach((e: any) => enrollmentMap.set(e.student_id, e.id));

  let totalScoresUpserted = 0;
  const now = new Date();

  await db.transaction(async (trx: Knex.Transaction) => {
    for (const item of studentScores) {
      const studentId = item.student_id;
      if (!studentId) continue;

      // Validate student is enrolled in the class
      if (!enrollmentMap.has(studentId)) {
        throw new AppError(`Siswa dengan ID ${studentId} tidak terdaftar aktif di kelas ini.`, "ERR_STUDENT_NOT_ENROLLED", 400);
      }
      const enrollmentId = item.student_enrollment_id || enrollmentMap.get(studentId);

      const studentScoreEntries = Object.entries(item.scores || {});
      const collectedScoresForStudent: (number | null)[] = [];

      for (const [tpId, scoreObj] of studentScoreEntries) {
        // Validate TP belongs to assessment
        if (!validTpIds.has(tpId)) {
          throw new AppError(`TP ID ${tpId} tidak termasuk dalam konfigurasi asesmen ini.`, "ERR_INVALID_TP", 400);
        }

        const rawVal = scoreObj?.score;
        let scoreVal: number | null = null;
        if (rawVal !== null && rawVal !== undefined && (rawVal as any) !== "") {
          const num = Number(rawVal);
          if (isNaN(num) || num < 0 || num > 100) {
            throw new AppError(`Nilai harus berupa angka antara 0 dan 100. Diterima: ${rawVal}`, "ERR_VALIDATION", 400);
          }
          scoreVal = num;
        }

        collectedScoresForStudent.push(scoreVal);

        // Upsert score record
        const existingScore = await trx("kktp_student_scores")
          .where({
            assessment_id: assessmentId,
            student_id: studentId,
            assessment_tp_id: tpId,
          })
          .first();

        const scorePayload = {
          assessment_id: assessmentId,
          assessment_tp_id: tpId,
          student_id: studentId,
          student_enrollment_id: enrollmentId || null,
          score: scoreVal,
          evidence_status: scoreObj?.evidence_status || (scoreVal !== null ? (scoreVal >= 76 ? "SUFFICIENT" : "PARTIAL") : null),
          reflection: scoreObj?.reflection || null,
          status: "active",
          updated_at: now,
        };

        if (existingScore) {
          await trx("kktp_student_scores").where("id", existingScore.id).update(scorePayload);
        } else {
          await trx("kktp_student_scores").insert({
            id: uuidv4(),
            ...scorePayload,
            created_at: now,
          });
        }
        totalScoresUpserted++;
      }

      // Re-fetch all scores for student in this assessment to compute true subject average
      const allCurrentStudentScores = await trx("kktp_student_scores")
        .where({ assessment_id: assessmentId, student_id: studentId })
        .whereIn("assessment_tp_id", Array.from(validTpIds) as string[])
        .select("score");

      const studentScoreNumbers = allCurrentStudentScores.map((s) => (s.score !== null ? Number(s.score) : null));
      const subjectAvg = calculateSubjectScore(studentScoreNumbers);
      const predicateInfo = getKKTPPredicate(subjectAvg);

      const totalTpCount = validTpIds.size;
      const scoredTpCount = studentScoreNumbers.filter((n) => n !== null).length;
      const isComplete = totalTpCount > 0 && scoredTpCount === totalTpCount;
      const summaryStatus: "DRAFT" | "COMPLETED" = isComplete ? "COMPLETED" : "DRAFT";

      // Upsert summary record
      const existingSummary = await trx("kktp_student_summaries")
        .where({ assessment_id: assessmentId, student_id: studentId })
        .first();

      const summaryPayload = {
        assessment_id: assessmentId,
        student_id: studentId,
        average_score: subjectAvg,
        predicate: subjectAvg !== null ? predicateInfo.label : null,
        competency_description:
          item.competency_description !== undefined
            ? item.competency_description
            : (existingSummary?.competency_description || null),
        catatan_tutor:
          item.catatan_tutor !== undefined
            ? item.catatan_tutor
            : (existingSummary?.catatan_tutor || null),
        status: summaryStatus,
        updated_at: now,
      };

      if (existingSummary) {
        await trx("kktp_student_summaries").where("id", existingSummary.id).update(summaryPayload);
      } else {
        await trx("kktp_student_summaries").insert({
          id: uuidv4(),
          ...summaryPayload,
          created_at: now,
        });
      }
    }

    // Update assessment updated_at
    await trx("kktp_assessments").where("id", assessmentId).update({
      status: "IN_PROGRESS",
      updated_at: now,
    });
  });

  return {
    savedStudentsCount: studentScores.length,
    savedScoresCount: totalScoresUpserted,
  };
}

/**
 * Returns single student KKTP report for printing or reviewing.
 * Dynamically computes average from current TPs ensuring mathematical integrity.
 */
export async function getStudentKKTPReport(
  assessmentId: string,
  studentId: string
): Promise<any> {
  const { assessment, tps } = await getKKTPAssessmentDetail(assessmentId);

  const student = await db("students").where("id", studentId).first();
  if (!student) throw new AppError("Data murid tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const enrollment = await db("student_enrollments")
    .where({ student_id: studentId, class_id: assessment.class_id })
    .first();

  const scores = await db("kktp_student_scores")
    .where({ assessment_id: assessmentId, student_id: studentId })
    .select("assessment_tp_id", "score", "evidence_status", "reflection");

  const scoreMap = new Map<string, any>(scores.map((s: any) => [s.assessment_tp_id, s]));

  const summary = await db("kktp_student_summaries")
    .where({ assessment_id: assessmentId, student_id: studentId })
    .first();

  const tpReports = tps.map((tp: any) => {
    const s = scoreMap.get(tp.id);
    const scoreVal = s?.score !== null && s?.score !== undefined ? Number(s.score) : null;
    return {
      tp_id: tp.id,
      tp_code: tp.tp_code,
      tp_text: tp.tp_text_snapshot,
      score: scoreVal,
      predicate: getKKTPPredicate(scoreVal),
      evidence_status: (s as any)?.evidence_status || null,
      reflection: (s as any)?.reflection || null,
    };
  });

  const scoreVals = tpReports.map((t: any) => t.score);
  const dynamicAvg = calculateSubjectScore(scoreVals);
  const totalTpCount = tps.length;
  const scoredTpCount = scoreVals.filter((v: any) => v !== null && v !== undefined).length;
  const isComplete = totalTpCount > 0 && scoredTpCount === totalTpCount;
  const completionPercentage = totalTpCount > 0 ? Math.round((scoredTpCount / totalTpCount) * 100) : 0;
  const displayStatus: "DRAFT" | "IN_PROGRESS" | "COMPLETED" = isComplete
    ? "COMPLETED"
    : scoredTpCount > 0
      ? "IN_PROGRESS"
      : "DRAFT";

  // Resolve App Settings & Institutional Letterhead
  const settings = await getAppSettings().catch(() => ({} as Record<string, string>));

  let letterheadUrl = settings?.active_letterhead_url || "/branding/school-letterhead.png";
  if (assessment.letterhead_version_id && settings?.letterhead_versions) {
    try {
      const versions = JSON.parse(settings.letterhead_versions);
      if (Array.isArray(versions)) {
        const matched = versions.find((v: any) => v.id === assessment.letterhead_version_id);
        if (matched?.url) {
          letterheadUrl = matched.url;
        }
      }
    } catch { }
  }

  const schoolSettings = {
    school_name: settings?.school_name || "PKBM BAITUSYUKUR LEARNING CENTER (BLC)",
    school_sub_header:
      settings?.school_sub_header ||
      "Pendidikan Kesetaraan Paket A / B / C • Kurikulum Merdeka Terintegrasi BLC\nPusat Kegiatan Belajar Mengajar & Pengembangan Karakter Generasi Qurani",
    school_headmaster_name: settings?.school_headmaster_name || "Kepala PKBM BLC",
    school_headmaster_nip: settings?.school_headmaster_nip || "",
    letterhead_margin_top_mm: settings?.letterhead_margin_top_mm || "0",
    letterhead_margin_right_mm: settings?.letterhead_margin_right_mm || "0",
    letterhead_margin_bottom_mm: settings?.letterhead_margin_bottom_mm || "0",
    letterhead_margin_left_mm: settings?.letterhead_margin_left_mm || "0",
    letterhead_margin_mode: settings?.letterhead_margin_mode || "",
  };

  const documentNumber = generateKKTPDocumentNumber(
    assessment.academic_year_name,
    assessment.semester_name,
    assessment.class_name,
    assessment.subject_code || assessment.subject_name,
    student.nisn || student.id
  );

  return {
    assessment,
    student,
    enrollment,
    tps: tpReports,
    summary: {
      average_score: dynamicAvg,
      provisional_average: !isComplete ? dynamicAvg : null,
      final_score: isComplete ? dynamicAvg : null,
      predicate: getKKTPPredicate(dynamicAvg),
      competency_description: summary?.competency_description || null,
      catatan_tutor: summary?.catatan_tutor || null,
      status: displayStatus,
      scored_tp_count: scoredTpCount,
      total_tp_count: totalTpCount,
      completion_percentage: completionPercentage,
      is_complete: isComplete,
    },
    letterheadUrl,
    schoolSettings,
    documentNumber,
    tutorName: assessment.creator_name || null,
    kepalaName: schoolSettings.school_headmaster_name,
  };
}

/**
 * Raport-ready query primitive:
 * Retrieves all subject assessments, scores, averages, and completion status
 * for a specific student in a specific academic period.
 * Can be directly consumed by Raport Terpadu without parsing legacy JSON documents.
 */
export async function getStudentSemesterKKTPOverview(params: {
  student_id: string;
  academic_year_id: string;
  semester_id: string;
}): Promise<{
  student: any;
  academic_year: any;
  semester: any;
  enrollment: any;
  subjects: Array<{
    subject_id: string;
    subject_name: string;
    subject_code: string;
    assessment_id: string | null;
    average_score: number | null;
    provisional_average: number | null;
    final_subject_score: number | null;
    predicate: string | null;
    predicate_code: string;
    scored_tp_count: number;
    total_tp_count: number;
    completion_percentage: number;
    is_complete: boolean;
    status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "NOT_CONFIGURED";
    catatan_tutor: string | null;
    competency_description: string | null;
  }>;
  overall_completion_percentage: number;
  all_subjects_completed: boolean;
}> {
  const { student_id, academic_year_id, semester_id } = params;

  const student = await db("students").where("id", student_id).first();
  if (!student) throw new AppError("Murid tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const academicYear = await db("academic_years").where("id", academic_year_id).first();
  if (!academicYear) throw new AppError("Tahun ajaran tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const semester = await db("semesters").where("id", semester_id).first();
  if (!semester) throw new AppError("Semester tidak ditemukan.", "ERR_NOT_FOUND", 404);

  // Find active student enrollment for this semester
  const enrollment = await db("student_enrollments")
    .where({ student_id, semester_id, status: "active" })
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  if (!enrollment) {
    throw new AppError("Murid tidak memiliki rombel/kelas aktif di semester ini.", "ERR_NOT_ENROLLED", 400);
  }

  // Fetch all curriculum subjects
  const subjects = await db("subjects")
    .whereNot("lifecycle_status", "soft_deleted")
    .orderBy("name", "asc");

  // Fetch all assessments for this class + period
  const assessments = await db("kktp_assessments").where({
    class_id: enrollment.class_id,
    academic_year_id,
    semester_id,
  });
  const assessmentMap = new Map<string, any>(assessments.map((a: any) => [a.subject_id, a]));
  const assessmentIds = assessments.map((a: any) => a.id);

  // Fetch configured TPs count per assessment
  const tpCounts =
    assessmentIds.length > 0
      ? await db("kktp_assessment_tps")
        .whereIn("assessment_id", assessmentIds)
        .groupBy("assessment_id")
        .select("assessment_id")
        .count("id as count")
      : [];
  const tpCountMap = new Map<string, number>(tpCounts.map((t: any) => [t.assessment_id, Number(t.count)]));

  // Fetch scores for this student across all assessments
  const rawScores =
    assessmentIds.length > 0
      ? await db("kktp_student_scores")
        .whereIn("assessment_id", assessmentIds)
        .where("student_id", student_id)
        .select("assessment_id", "score")
      : [];
  const scoreGroupMap = new Map<string, (number | null)[]>();
  for (const s of rawScores) {
    if (!scoreGroupMap.has(s.assessment_id)) scoreGroupMap.set(s.assessment_id, []);
    scoreGroupMap.get(s.assessment_id)!.push(s.score !== null ? Number(s.score) : null);
  }

  // Fetch summaries
  const summaries =
    assessmentIds.length > 0
      ? await db("kktp_student_summaries")
        .whereIn("assessment_id", assessmentIds)
        .where("student_id", student_id)
        .select("*")
      : [];
  const summaryMap = new Map<string, any>(summaries.map((s: any) => [s.assessment_id, s]));

  const subjectResults = subjects.map((subj: any) => {
    const ass = assessmentMap.get(subj.id);
    if (!ass) {
      return {
        subject_id: subj.id,
        subject_name: subj.name,
        subject_code: subj.code,
        assessment_id: null,
        average_score: null,
        provisional_average: null,
        final_subject_score: null,
        predicate: null,
        predicate_code: "BD",
        scored_tp_count: 0,
        total_tp_count: 0,
        completion_percentage: 0,
        is_complete: false,
        status: "NOT_CONFIGURED" as const,
        catatan_tutor: null,
        competency_description: null,
      };
    }

    const totalTps = tpCountMap.get(ass.id) || 0;
    const scores = scoreGroupMap.get(ass.id) || [];
    const validScores = scores.filter((s) => s !== null && s !== undefined) as number[];
    const scoredCount = validScores.length;
    const avg = calculateSubjectScore(validScores);
    const pred = getKKTPPredicate(avg);
    const isComplete = totalTps > 0 && scoredCount === totalTps;
    const completionPct = totalTps > 0 ? Math.round((scoredCount / totalTps) * 100) : 0;
    const sum = summaryMap.get(ass.id);

    return {
      subject_id: subj.id,
      subject_name: subj.name,
      subject_code: subj.code,
      assessment_id: ass.id,
      average_score: avg,
      provisional_average: !isComplete ? avg : null,
      final_subject_score: isComplete ? avg : null,
      predicate: avg !== null ? pred.label : null,
      predicate_code: pred.code,
      scored_tp_count: scoredCount,
      total_tp_count: totalTps,
      completion_percentage: completionPct,
      is_complete: isComplete,
      status: isComplete ? ("COMPLETED" as const) : scoredCount > 0 ? ("IN_PROGRESS" as const) : ("DRAFT" as const),
      catatan_tutor: sum?.catatan_tutor || null,
      competency_description: sum?.competency_description || null,
    };
  });

  const totalPossible = subjectResults.length;
  const completedSubjects = subjectResults.filter((s: any) => s.is_complete).length;
  const overallPct = totalPossible > 0 ? Math.round((completedSubjects / totalPossible) * 100) : 0;

  return {
    student: {
      id: student.id,
      name: student.full_name,
      nisn: student.nisn,
      gender: student.gender,
    },
    academic_year: academicYear,
    semester,
    enrollment,
    subjects: subjectResults,
    overall_completion_percentage: overallPct,
    all_subjects_completed: totalPossible > 0 && completedSubjects === totalPossible,
  };
}
