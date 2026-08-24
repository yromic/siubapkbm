import { db } from "@/lib/db";
import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import {
  resolvePhaseByClassLevel,
  TrisulaPillar,
  ScoreCategory,
  calculatePillarScore,
  getScoreCategory,
} from "@/lib/utils/academicUtils";
import { getActiveAcademicYear } from "@/lib/services/academicYearService";
import { getActiveSemester } from "@/lib/services/semesterService";

export type { TrisulaPillar, ScoreCategory };
export { calculatePillarScore, getScoreCategory };
export type TrisulaAssessmentStatus = "DRAFT" | "IN_PROGRESS" | "FINALIZED";
export type EvidenceStatus = "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";

export interface TrisulaCurriculumSelectionItem {
  id?: string;
  pillar: TrisulaPillar;
  cp_id?: string | null;
  tp_id: string;
  cp_text_snapshot?: string | null;
  tp_text_snapshot: string;
}

export interface StudentScoreInput {
  student_id: string;
  student_enrollment_id: string;
  scores: {
    literasi?: number | null;
    numerasi?: number | null;
    diniyyah?: number | null;
  };
  observations?: {
    literasi?: string | null;
    numerasi?: string | null;
    diniyyah?: string | null;
  };
  descriptions?: {
    literasi?: string | null;
    numerasi?: string | null;
    diniyyah?: string | null;
  };
  evidenceStatuses?: {
    literasi?: EvidenceStatus | null;
    numerasi?: EvidenceStatus | null;
    diniyyah?: EvidenceStatus | null;
  };
  tpScores?: Array<{
    tp_id: string;
    pillar: TrisulaPillar;
    score: number | null;
    evidence_status?: EvidenceStatus | null;
    observation_text?: string | null;
    achievement_description?: string | null;
  }>;
}

/**
 * ensureTrisulaTablesExist
 * Idempotent table creator ensuring tables exist in MySQL runtime.
 */
export async function ensureTrisulaTablesExist(): Promise<void> {
  const hasAssessments = await db.schema.hasTable("trisula_assessments");
  if (!hasAssessments) {
    await db.schema.createTable("trisula_assessments", (table: Knex.TableBuilder) => {
      table.string("id", 36).primary();
      table.string("title", 255).notNullable();
      table.string("class_id", 36).notNullable();
      table.string("academic_year_id", 36).notNullable();
      table.string("semester_id", 36).notNullable();
      table.string("fase", 50).notNullable();
      table.enum("status", ["DRAFT", "IN_PROGRESS", "FINALIZED"]).notNullable().defaultTo("DRAFT");
      table.string("created_by", 36).nullable();
      table.dateTime("created_at").defaultTo(db.fn.now());
      table.dateTime("updated_at").defaultTo(db.fn.now());

      table.index(["class_id", "academic_year_id", "semester_id"], "idx_trisula_assessment_context");
    });
  }

  const hasCurriculum = await db.schema.hasTable("trisula_assessment_curriculum");
  if (!hasCurriculum) {
    await db.schema.createTable("trisula_assessment_curriculum", (table: Knex.TableBuilder) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.enum("pillar", ["LITERASI", "NUMERASI", "DINIYYAH"]).notNullable();
      table.string("cp_id", 36).nullable();
      table.string("tp_id", 36).notNullable();
      table.text("cp_text_snapshot").nullable();
      table.text("tp_text_snapshot").notNullable();
      table.dateTime("created_at").defaultTo(db.fn.now());

      table.index(["assessment_id", "pillar"], "idx_trisula_curr_ass_pillar");
    });
  }

  const hasScores = await db.schema.hasTable("trisula_student_scores");
  if (!hasScores) {
    await db.schema.createTable("trisula_student_scores", (table: Knex.TableBuilder) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("student_id", 36).notNullable();
      table.string("student_enrollment_id", 36).notNullable();
      table.enum("pillar", ["LITERASI", "NUMERASI", "DINIYYAH"]).notNullable();
      table.string("tp_id", 36).nullable();
      table.decimal("score", 5, 2).nullable();
      table.enum("evidence_status", ["SUFFICIENT", "PARTIAL", "INSUFFICIENT"]).nullable();
      table.text("observation_text").nullable();
      table.text("achievement_description").nullable();
      table.text("recommendation").nullable();
      table.enum("source", ["MANUAL", "AI_ASSISTED"]).notNullable().defaultTo("MANUAL");
      table.dateTime("created_at").defaultTo(db.fn.now());
      table.dateTime("updated_at").defaultTo(db.fn.now());

      table.unique(["assessment_id", "student_id", "pillar", "tp_id"], { indexName: "uq_trisula_student_score" });
    });
  }

  const hasSummaries = await db.schema.hasTable("trisula_student_summaries");
  if (!hasSummaries) {
    await db.schema.createTable("trisula_student_summaries", (table: Knex.TableBuilder) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("student_id", 36).notNullable();
      table.decimal("literasi_score", 5, 2).nullable();
      table.decimal("numerasi_score", 5, 2).nullable();
      table.decimal("diniyyah_score", 5, 2).nullable();
      table.decimal("overall_score", 5, 2).nullable();
      table.text("literasi_description").nullable();
      table.text("numerasi_description").nullable();
      table.text("diniyyah_description").nullable();
      table.text("catatan_rangkuman").nullable();
      table.text("pesan_orang_tua").nullable();
      table.enum("status", ["DRAFT", "COMPLETED"]).notNullable().defaultTo("DRAFT");
      table.dateTime("created_at").defaultTo(db.fn.now());
      table.dateTime("updated_at").defaultTo(db.fn.now());

      table.unique(["assessment_id", "student_id"], { indexName: "uq_trisula_student_summary" });
    });
  }
}

/**
 * getOrCreateAssessmentSession
 * Retrieves or creates a class-level Trisula assessment session for the active year/semester.
 */
export async function getOrCreateAssessmentSession(params: {
  class_id: string;
  academic_year_id?: string;
  semester_id?: string;
  title?: string;
  userId?: string;
}): Promise<any> {
  await ensureTrisulaTablesExist();

  let { academic_year_id, semester_id } = params;

  if (!academic_year_id) {
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) throw new AppError("Tidak ada tahun ajaran aktif yang ditemukan.", "ERR_NOT_FOUND", 404);
    academic_year_id = activeYear.id;
  }

  if (!semester_id) {
    const activeSem = await getActiveSemester(academic_year_id!);
    if (!activeSem) throw new AppError("Tidak ada semester aktif yang ditemukan.", "ERR_NOT_FOUND", 404);
    semester_id = activeSem.id;
  }

  const cls = await db("classes").where("id", params.class_id).first();
  if (!cls) throw new AppError("Kelas tidak ditemukan.", "ERR_NOT_FOUND", 404);

  // Use numeric level for accurate phase resolution — class names at BLC may not contain digits
  const fase = resolvePhaseByClassLevel(cls.level || cls.name);

  let assessment = await db("trisula_assessments")
    .where({
      class_id: params.class_id,
      academic_year_id,
      semester_id,
    })
    .first();

  if (!assessment) {
    const id = uuidv4();
    const defaultTitle = params.title || `Asesmen Trisula ${cls.name}`;
    const now = new Date();
    await db("trisula_assessments").insert({
      id,
      title: defaultTitle,
      class_id: params.class_id,
      academic_year_id,
      semester_id,
      fase,
      status: "DRAFT",
      created_by: params.userId || null,
      created_at: now,
      updated_at: now,
    });

    assessment = await db("trisula_assessments").where("id", id).first();
  }

  return assessment;
}

/**
 * saveAssessmentCurriculum
 * Replaces selected curriculum for an assessment session with historical snapshots.
 */
export async function saveAssessmentCurriculum(
  assessment_id: string,
  items: TrisulaCurriculumSelectionItem[]
): Promise<void> {
  await ensureTrisulaTablesExist();

  const assessment = await db("trisula_assessments").where("id", assessment_id).first();
  if (!assessment) throw new AppError("Asesmen Trisula tidak ditemukan.", "ERR_NOT_FOUND", 404);

  await db.transaction(async (trx: Knex.Transaction) => {
    await trx("trisula_assessment_curriculum").where("assessment_id", assessment_id).delete();

    const now = new Date();
    const rows = items.map((item) => ({
      id: uuidv4(),
      assessment_id,
      pillar: item.pillar,
      cp_id: item.cp_id || null,
      tp_id: item.tp_id,
      cp_text_snapshot: item.cp_text_snapshot || null,
      tp_text_snapshot: item.tp_text_snapshot,
      created_at: now,
    }));

    if (rows.length > 0) {
      await trx("trisula_assessment_curriculum").insert(rows);
    }

    await trx("trisula_assessments").where("id", assessment_id).update({
      updated_at: now,
      status: assessment.status === "DRAFT" ? "IN_PROGRESS" : assessment.status,
    });
  });
}

/**
 * getAssessmentDetail
 * Retrieves complete assessment metadata, selected curriculum, enrolled students, and persisted scores.
 */
export async function getAssessmentDetail(assessment_id: string): Promise<any> {
  await ensureTrisulaTablesExist();

  const assessment = await db("trisula_assessments")
    .join("classes", "trisula_assessments.class_id", "classes.id")
    .join("academic_years", "trisula_assessments.academic_year_id", "academic_years.id")
    .join("semesters", "trisula_assessments.semester_id", "semesters.id")
    .where("trisula_assessments.id", assessment_id)
    .select(
      "trisula_assessments.*",
      "classes.name as class_name",
      "academic_years.name as academic_year_name",
      "semesters.name as semester_name"
    )
    .first();

  if (!assessment) throw new AppError("Asesmen Trisula tidak ditemukan.", "ERR_NOT_FOUND", 404);

  // 1. Curriculum
  const curriculum = await db("trisula_assessment_curriculum")
    .where("assessment_id", assessment_id)
    .orderBy("pillar", "asc");

  // 2. Active Enrolled Students in Class — filtered by active status
  const students: any[] = await db("student_enrollments")
    .join("students", "student_enrollments.student_id", "students.id")
    .where("student_enrollments.class_id", assessment.class_id)
    .where("student_enrollments.semester_id", assessment.semester_id)
    .whereNot("student_enrollments.lifecycle_status", "soft_deleted")
    .where("student_enrollments.status", "active")
    .select(
      "student_enrollments.id as enrollment_id",
      "student_enrollments.student_id",
      "students.full_name",
      "students.nisn as student_nisn",
      "students.gender"
    )
    .orderBy("students.full_name", "asc");

  // 3. Summaries
  const summaries: any[] = await db("trisula_student_summaries").where("assessment_id", assessment_id);
  const summariesMap = new Map<string, any>(summaries.map((s: any) => [s.student_id, s]));

  // 4. Raw TP Scores
  const rawScores: any[] = await db("trisula_student_scores").where("assessment_id", assessment_id);
  const rawScoresMap = new Map<string, any[]>();
  for (const s of rawScores) {
    const list = rawScoresMap.get(s.student_id) || [];
    list.push(s);
    rawScoresMap.set(s.student_id, list);
  }

  // Combine student gradebook rows
  const gradebookRows = students.map((std: any) => {
    const sum = summariesMap.get(std.student_id);
    const scores = (rawScoresMap.get(std.student_id) || []).map((s: any) => ({
      ...s,
      score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
    }));

    const litScore = sum?.literasi_score !== null && sum?.literasi_score !== undefined ? Number(sum.literasi_score) : null;
    const numScore = sum?.numerasi_score !== null && sum?.numerasi_score !== undefined ? Number(sum.numerasi_score) : null;
    const dinScore = sum?.diniyyah_score !== null && sum?.diniyyah_score !== undefined ? Number(sum.diniyyah_score) : null;
    const ovScore = sum?.overall_score !== null && sum?.overall_score !== undefined
      ? Number(sum.overall_score)
      : calculatePillarScore([litScore, numScore, dinScore]);

    return {
      student_id: std.student_id,
      student_enrollment_id: std.enrollment_id,
      student_name: std.full_name,
      student_nisn: std.student_nisn,
      gender: std.gender,
      summary_id: sum?.id || null,
      literasi_score: litScore,
      numerasi_score: numScore,
      diniyyah_score: dinScore,
      overall_score: ovScore,
      literasi_description: sum?.literasi_description || "",
      numerasi_description: sum?.numerasi_description || "",
      diniyyah_description: sum?.diniyyah_description || "",
      catatan_rangkuman: sum?.catatan_rangkuman || "",
      pesan_orang_tua: sum?.pesan_orang_tua || "",
      status: sum?.status || (litScore !== null || numScore !== null || dinScore !== null ? "COMPLETED" : "DRAFT"),
      tp_scores: scores,
    };
  });



  return {
    assessment,
    curriculum,
    gradebook: gradebookRows,
  };
}

/**
 * saveClassGradebookScores
 * Transactionally saves entire class gradebook scores, updates raw TP scores and summaries.
 */
export async function saveClassGradebookScores(
  assessment_id: string,
  studentScores: StudentScoreInput[],
  userId?: string
): Promise<{ savedCount: number }> {
  await ensureTrisulaTablesExist();

  const assessment = await db("trisula_assessments").where("id", assessment_id).first();
  if (!assessment) throw new AppError("Asesmen Trisula tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const now = new Date();

  await db.transaction(async (trx: Knex.Transaction) => {
    for (const item of studentScores) {
      const litScore = item.scores.literasi !== undefined ? item.scores.literasi : null;
      const numScore = item.scores.numerasi !== undefined ? item.scores.numerasi : null;
      const dinScore = item.scores.diniyyah !== undefined ? item.scores.diniyyah : null;

      const overall = calculatePillarScore([litScore, numScore, dinScore]);

      // 1. Upsert Student Summary
      const existingSummary = await trx("trisula_student_summaries")
        .where({ assessment_id, student_id: item.student_id })
        .first();

      const summaryPayload = {
        assessment_id,
        student_id: item.student_id,
        literasi_score: litScore,
        numerasi_score: numScore,
        diniyyah_score: dinScore,
        overall_score: overall,
        literasi_description: item.descriptions?.literasi || null,
        numerasi_description: item.descriptions?.numerasi || null,
        diniyyah_description: item.descriptions?.diniyyah || null,
        status: (litScore !== null && numScore !== null && dinScore !== null ? "COMPLETED" : "DRAFT") as "DRAFT" | "COMPLETED",
        updated_at: now,
      };

      if (existingSummary) {
        await trx("trisula_student_summaries")
          .where("id", existingSummary.id)
          .update(summaryPayload);
      } else {
        await trx("trisula_student_summaries").insert({
          id: uuidv4(),
          ...summaryPayload,
          created_at: now,
        });
      }

      // 2. Upsert Pillar-Level Raw Scores
      const pillars: TrisulaPillar[] = ["LITERASI", "NUMERASI", "DINIYYAH"];
      for (const pillar of pillars) {
        const pillarKey = pillar.toLowerCase() as "literasi" | "numerasi" | "diniyyah";
        const scoreVal = item.scores[pillarKey];
        const obsVal = item.observations?.[pillarKey] || null;
        const descVal = item.descriptions?.[pillarKey] || null;
        const evVal = item.evidenceStatuses?.[pillarKey] || null;

        if (scoreVal !== undefined || obsVal !== null || descVal !== null) {
          const existingScore = await trx("trisula_student_scores")
            .where({
              assessment_id,
              student_id: item.student_id,
              pillar,
            })
            .whereNull("tp_id")
            .first();

          const scorePayload = {
            assessment_id,
            student_id: item.student_id,
            student_enrollment_id: item.student_enrollment_id,
            pillar,
            tp_id: null,
            score: scoreVal !== undefined ? scoreVal : null,
            evidence_status: evVal,
            observation_text: obsVal,
            achievement_description: descVal,
            source: (evVal ? "AI_ASSISTED" : "MANUAL") as "MANUAL" | "AI_ASSISTED",
            updated_at: now,
          };

          if (existingScore) {
            await trx("trisula_student_scores").where("id", existingScore.id).update(scorePayload);
          } else {
            await trx("trisula_student_scores").insert({
              id: uuidv4(),
              ...scorePayload,
              created_at: now,
            });
          }
        }
      }

      // 3. Upsert granular TP scores if provided
      if (Array.isArray(item.tpScores) && item.tpScores.length > 0) {
        for (const tpScore of item.tpScores) {
          const existingTpScore = await trx("trisula_student_scores")
            .where({
              assessment_id,
              student_id: item.student_id,
              pillar: tpScore.pillar,
              tp_id: tpScore.tp_id,
            })
            .first();

          const tpScorePayload = {
            assessment_id,
            student_id: item.student_id,
            student_enrollment_id: item.student_enrollment_id,
            pillar: tpScore.pillar,
            tp_id: tpScore.tp_id,
            score: tpScore.score,
            evidence_status: tpScore.evidence_status || null,
            observation_text: tpScore.observation_text || null,
            achievement_description: tpScore.achievement_description || null,
            source: (tpScore.evidence_status ? "AI_ASSISTED" : "MANUAL") as "MANUAL" | "AI_ASSISTED",
            updated_at: now,
          };

          if (existingTpScore) {
            await trx("trisula_student_scores").where("id", existingTpScore.id).update(tpScorePayload);
          } else {
            await trx("trisula_student_scores").insert({
              id: uuidv4(),
              ...tpScorePayload,
              created_at: now,
            });
          }
        }
      }
    }

    // Update assessment timestamp and status
    await trx("trisula_assessments").where("id", assessment_id).update({
      status: "IN_PROGRESS",
      updated_at: now,
    });
  });

  return { savedCount: studentScores.length };
}

/**
 * getTrisulaMatrixData
 * Retrieves read-model matrix data directly from persisted student summaries.
 */
export async function getTrisulaMatrixData(filters: {
  class_id: string;
  academic_year_id?: string;
  semester_id?: string;
  assessment_id?: string;
}): Promise<any> {
  await ensureTrisulaTablesExist();

  let assessmentId: string | undefined = filters.assessment_id;
  if (!assessmentId) {
    const session = await getOrCreateAssessmentSession({
      class_id: filters.class_id,
      academic_year_id: filters.academic_year_id,
      semester_id: filters.semester_id,
    });
    assessmentId = session?.id;
  }

  if (!assessmentId) {
    throw new AppError("Asesmen Trisula tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const detail = await getAssessmentDetail(assessmentId);

  const matrixRows = detail.gradebook.map((row: any) => {
    const litCat = getScoreCategory(row.literasi_score);
    const numCat = getScoreCategory(row.numerasi_score);
    const dinCat = getScoreCategory(row.diniyyah_score);
    const ovCat = getScoreCategory(row.overall_score);

    return {
      student_id: row.student_id,
      student_enrollment_id: row.student_enrollment_id,
      student_name: row.student_name,
      student_nisn: row.student_nisn,
      gender: row.gender,
      literasi: {
        score: row.literasi_score,
        category: litCat?.label || "-",
        short: litCat?.short || "-",
      },
      numerasi: {
        score: row.numerasi_score,
        category: numCat?.label || "-",
        short: numCat?.short || "-",
      },
      diniyyah: {
        score: row.diniyyah_score,
        category: dinCat?.label || "-",
        short: dinCat?.short || "-",
      },
      overall: {
        score: row.overall_score,
        category: ovCat?.label || "-",
        short: ovCat?.short || "-",
      },
      status: row.status,
    };
  });

  return {
    assessment: detail.assessment,
    curriculum: detail.curriculum,
    matrix: matrixRows,
  };
}

/**
 * getStudentTrisulaReport
 * Retrieves single student report projection for review, narrative editing, and printing.
 */
export async function getStudentTrisulaReport(assessment_id: string, student_id: string): Promise<any> {
  await ensureTrisulaTablesExist();

  const assessment = await db("trisula_assessments")
    .join("classes", "trisula_assessments.class_id", "classes.id")
    .join("academic_years", "trisula_assessments.academic_year_id", "academic_years.id")
    .join("semesters", "trisula_assessments.semester_id", "semesters.id")
    .where("trisula_assessments.id", assessment_id)
    .select(
      "trisula_assessments.*",
      "classes.name as class_name",
      "academic_years.name as academic_year_name",
      "semesters.name as semester_name"
    )
    .first();

  if (!assessment) throw new AppError("Asesmen Trisula tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const student = await db("students").where("id", student_id).first();
  if (!student) throw new AppError("Data siswa tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const summary = await db("trisula_student_summaries")
    .where({ assessment_id, student_id })
    .first();

  const curriculum = await db("trisula_assessment_curriculum")
    .where("assessment_id", assessment_id)
    .orderBy("pillar", "asc");

  const tpScores: any[] = await db("trisula_student_scores")
    .where({ assessment_id, student_id });

  return {
    assessment,
    student,
    summary: summary
      ? {
          ...summary,
          literasi_score: summary.literasi_score !== null && summary.literasi_score !== undefined ? Number(summary.literasi_score) : null,
          numerasi_score: summary.numerasi_score !== null && summary.numerasi_score !== undefined ? Number(summary.numerasi_score) : null,
          diniyyah_score: summary.diniyyah_score !== null && summary.diniyyah_score !== undefined ? Number(summary.diniyyah_score) : null,
          overall_score: summary.overall_score !== null && summary.overall_score !== undefined ? Number(summary.overall_score) : null,
        }
      : {
          literasi_score: null,
          numerasi_score: null,
          diniyyah_score: null,
          overall_score: null,
          literasi_description: "",
          numerasi_description: "",
          diniyyah_description: "",
          catatan_rangkuman: "",
          pesan_orang_tua: "",
        },
    curriculum,
    tpScores: tpScores.map((s: any) => ({
      ...s,
      score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
    })),
  };

}

/**
 * updateStudentTrisulaReport
 * Updates report narrative (catatan rangkuman, pesan orang tua, deskripsi capaian).
 */
export async function updateStudentTrisulaReport(
  assessment_id: string,
  student_id: string,
  data: {
    catatan_rangkuman?: string;
    pesan_orang_tua?: string;
    literasi_description?: string;
    numerasi_description?: string;
    diniyyah_description?: string;
  }
): Promise<any> {
  await ensureTrisulaTablesExist();

  const now = new Date();
  const existing = await db("trisula_student_summaries")
    .where({ assessment_id, student_id })
    .first();

  if (!existing) {
    const id = uuidv4();
    await db("trisula_student_summaries").insert({
      id,
      assessment_id,
      student_id,
      catatan_rangkuman: data.catatan_rangkuman || null,
      pesan_orang_tua: data.pesan_orang_tua || null,
      literasi_description: data.literasi_description || null,
      numerasi_description: data.numerasi_description || null,
      diniyyah_description: data.diniyyah_description || null,
      created_at: now,
      updated_at: now,
    });
  } else {
    await db("trisula_student_summaries")
      .where("id", existing.id)
      .update({
        catatan_rangkuman: data.catatan_rangkuman !== undefined ? data.catatan_rangkuman : existing.catatan_rangkuman,
        pesan_orang_tua: data.pesan_orang_tua !== undefined ? data.pesan_orang_tua : existing.pesan_orang_tua,
        literasi_description: data.literasi_description !== undefined ? data.literasi_description : existing.literasi_description,
        numerasi_description: data.numerasi_description !== undefined ? data.numerasi_description : existing.numerasi_description,
        diniyyah_description: data.diniyyah_description !== undefined ? data.diniyyah_description : existing.diniyyah_description,
        updated_at: now,
      });
  }

  return await db("trisula_student_summaries").where({ assessment_id, student_id }).first();
}
