import { db } from "@/lib/db";
import { UTSMAN_FORMULA, SahabatScores, UtsmanResult } from "@/lib/config/characterRuleConfig";
import { CharacterUtsmanSemesterSummaryModel } from "@/types/character";
import { v4 as uuidv4 } from "uuid";

function roundHalfUp(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates UTSMAN semester profile scores and saves (upserts) to `character_utsman_semester_summary`.
 * 
 * Rules:
 * 1. Takes average of each SAHABAT indicator for scores > 0
 * 2. Applies UTSMAN_FORMULA from characterRuleConfig
 * 3. Upserts into character_utsman_semester_summary table with calculation_version='v1.0'
 */
export async function calculateAndSaveUTSMAN(
  studentId: string,
  semesterId: string
): Promise<CharacterUtsmanSemesterSummaryModel> {
  // 1. Calculate SAHABAT indicator averages (only scores > 0)
  const avgResult = await db("culture_scores")
    .where({ student_id: studentId, semester_id: semesterId })
    .whereNot("lifecycle_status", "soft_deleted")
    .select(
      db.raw("AVG(CASE WHEN sss_score > 0 THEN sss_score END) as avg_sss"),
      db.raw("AVG(CASE WHEN am_score > 0 THEN am_score END) as avg_am"),
      db.raw("AVG(CASE WHEN hb_score > 0 THEN hb_score END) as avg_hb"),
      db.raw("AVG(CASE WHEN asm_score > 0 THEN asm_score END) as avg_asm"),
      db.raw("AVG(CASE WHEN br_score > 0 THEN br_score END) as avg_br"),
      db.raw("AVG(CASE WHEN ak_score > 0 THEN ak_score END) as avg_ak"),
      db.raw("AVG(CASE WHEN tm_score > 0 THEN tm_score END) as avg_tm")
    )
    .first();

  const avgScores: SahabatScores = {
    sss: Number(avgResult?.avg_sss ?? 0),
    am: Number(avgResult?.avg_am ?? 0),
    hb: Number(avgResult?.avg_hb ?? 0),
    asm: Number(avgResult?.avg_asm ?? 0),
    br: Number(avgResult?.avg_br ?? 0),
    ak: Number(avgResult?.avg_ak ?? 0),
    tm: Number(avgResult?.avg_tm ?? 0),
  };

  // 2. Calculate UTSMAN scores using formulas
  const utsmanScores: UtsmanResult = {
    u_score: roundHalfUp(UTSMAN_FORMULA.calculateU(avgScores), 2),
    t_score: roundHalfUp(UTSMAN_FORMULA.calculateT(avgScores), 2),
    s_score: roundHalfUp(UTSMAN_FORMULA.calculateS(avgScores), 2),
    m_score: roundHalfUp(UTSMAN_FORMULA.calculateM(avgScores), 2),
    a_score: roundHalfUp(UTSMAN_FORMULA.calculateA(avgScores), 2),
    n_score: roundHalfUp(UTSMAN_FORMULA.calculateN(avgScores), 2),
  };

  // Check existing record to update or insert
  const existing = await db("character_utsman_semester_summary")
    .where({ student_id: studentId, semester_id: semesterId })
    .first();

  let summaryRecord: CharacterUtsmanSemesterSummaryModel;

  if (existing) {
    // DO NOT overwrite if semester is locked
    if (existing.locked_at) {
      return existing as CharacterUtsmanSemesterSummaryModel;
    }
    await db("character_utsman_semester_summary")
      .where({ id: existing.id })
      .update({
        u_score: utsmanScores.u_score,
        t_score: utsmanScores.t_score,
        s_score: utsmanScores.s_score,
        m_score: utsmanScores.m_score,
        a_score: utsmanScores.a_score,
        n_score: utsmanScores.n_score,
        calculation_version: "v1.0",
        updated_at: db.fn.now(),
      });

    summaryRecord = {
      ...existing,
      ...utsmanScores,
      calculation_version: "v1.0",
    };
  } else {
    const newId = uuidv4();
    const newRecordData = {
      id: newId,
      student_id: studentId,
      semester_id: semesterId,
      u_score: utsmanScores.u_score,
      t_score: utsmanScores.t_score,
      s_score: utsmanScores.s_score,
      m_score: utsmanScores.m_score,
      a_score: utsmanScores.a_score,
      n_score: utsmanScores.n_score,
      calculation_version: "v1.0",
    };

    await db("character_utsman_semester_summary").insert(newRecordData);
    summaryRecord = newRecordData as CharacterUtsmanSemesterSummaryModel;
  }

  return summaryRecord;
}

/**
 * Retrieves UTSMAN semester summary for a student
 */
export async function getUTSMANSummary(
  studentId: string,
  semesterId: string
): Promise<CharacterUtsmanSemesterSummaryModel | null> {
  const record = await db("character_utsman_semester_summary")
    .where({ student_id: studentId, semester_id: semesterId })
    .first();

  return record || null;
}
