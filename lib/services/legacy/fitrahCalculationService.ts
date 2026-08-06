/**
 * LEGACY SERVICE
 *
 * Replaced by:
 * - utsmanCalculationService
 * - fitrahSummary API
 *
 * Kept for historical reference.
 */
import { db } from "@/lib/db";
import { SAHABAT_TO_FITRAH, FitrahResult, SahabatScores } from "@/lib/config/characterRuleConfig";

function roundHalfUp(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates FITRAH character dimensions on-demand for a student in a semester
 * based on weekly SAHABAT assessments in `culture_scores`.
 */
export async function calculateFitrah(
  studentId: string,
  semesterId: string
): Promise<FitrahResult> {
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

  const rawFitrah = {
    fathonah: SAHABAT_TO_FITRAH.fathonah(avgScores),
    istiqamah: SAHABAT_TO_FITRAH.istiqamah(avgScores),
    tanggungJawab: SAHABAT_TO_FITRAH.tanggungJawab(avgScores),
    rahmah: SAHABAT_TO_FITRAH.rahmah(avgScores),
    amanah: SAHABAT_TO_FITRAH.amanah(avgScores),
    harmonis: SAHABAT_TO_FITRAH.harmonis(avgScores),
  };

  return {
    fathonah: roundHalfUp(rawFitrah.fathonah, 2),
    istiqamah: roundHalfUp(rawFitrah.istiqamah, 2),
    tanggungJawab: roundHalfUp(rawFitrah.tanggungJawab, 2),
    rahmah: roundHalfUp(rawFitrah.rahmah, 2),
    amanah: roundHalfUp(rawFitrah.amanah, 2),
    harmonis: roundHalfUp(rawFitrah.harmonis, 2),
  };
}
