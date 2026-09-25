/**
 * lib/utils/kktpCalculationUtils.ts
 *
 * Isomorphic, pure domain calculation logic for KKTP V2.
 * Free of any server/database/Knex dependencies so it can safely be imported
 * by Client Components ("use client") without triggering Node.js module bundling errors (e.g. 'fs').
 */

export type KKTPEvidenceStatus = "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
export type KKTPSourceType = "TP_BANK" | "MANUAL" | "AI_GENERATED" | "LINKED_RPM";
export type KKTPAssessmentStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "LOCKED";
export type KKTPPredicateCode = "SB" | "T" | "C" | "PB" | "BD";

export interface KKTPPredicateResult {
  label: string;
  code: KKTPPredicateCode;
  colorClass: string;
}

/**
 * Pure calculation rule:
 * Subject Score = sum(scored TPs) / count(scored TPs)
 * Unassessed TPs (null or undefined) are strictly excluded.
 * Returns null if no valid scores exist.
 */
export function calculateSubjectScore(scores: (number | null | undefined)[]): number | null {
  const validScores = scores.filter(
    (s): s is number => typeof s === "number" && !isNaN(s) && s >= 0 && s <= 100
  );
  if (validScores.length === 0) return null;
  const sum = validScores.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / validScores.length) * 100) / 100;
}

/**
 * Resolves standard KKTP predicate from score (0-100 scale).
 */
export function getKKTPPredicate(score: number | null | undefined): KKTPPredicateResult {
  if (score === null || score === undefined || isNaN(score)) {
    return { label: "Belum Dinilai", code: "BD", colorClass: "text-zinc-600 bg-zinc-100 border-zinc-200" };
  }
  if (score >= 90) {
    return { label: "Sangat Baik", code: "SB", colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  }
  if (score >= 76) {
    return { label: "Tuntas", code: "T", colorClass: "text-blue-700 bg-blue-50 border-blue-200" };
  }
  if (score >= 60) {
    return { label: "Cukup", code: "C", colorClass: "text-amber-700 bg-amber-50 border-amber-200" };
  }
  return { label: "Perlu Bimbingan", code: "PB", colorClass: "text-rose-700 bg-rose-50 border-rose-200" };
}

/**
 * Generates an authoritative, standard document number for printed KKTP reports.
 * Matches the institutional pattern used by Trisula & RPM.
 */
export function generateKKTPDocumentNumber(
  academicYear?: string,
  semester?: string,
  className?: string,
  subjectCodeOrName?: string,
  studentIdOrNisn?: string
): string {
  const cleanYear = (academicYear || new Date().getFullYear().toString()).replace(/[^a-zA-Z0-9]/g, "");
  const cleanSem = (semester || "SM1").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const cleanClass = (className || "BLC").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const cleanSubj = (subjectCodeOrName || "MAPEL").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const cleanStudent = (studentIdOrNisn || "001").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `BLC/KKTP/${cleanYear}/${cleanSem}/${cleanClass}/${cleanSubj}/${cleanStudent}`;
}

