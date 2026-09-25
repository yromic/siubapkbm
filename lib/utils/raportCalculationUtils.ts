/**
 * lib/utils/raportCalculationUtils.ts
 *
 * Isomorphic, pure domain calculation logic for Raport Terpadu.
 * Free of any server/database/Knex dependencies so it can safely be imported
 * by Client Components ("use client") without triggering Node.js module bundling errors.
 */

export interface RaportCategoryResult {
  label: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
  short: "SB" | "B" | "C" | "PB";
  colorClass: string;
}

/**
 * Calculates pure arithmetic mean across completed subjects.
 * Strictly excludes unassessed or null scores.
 * Returns null if no valid scores exist.
 */
export function calculateAcademicOverallAverage(
  scores: (number | null | undefined)[]
): number | null {
  const validScores = scores.filter(
    (s): s is number => typeof s === "number" && !isNaN(s) && s >= 0 && s <= 100
  );
  if (validScores.length === 0) return null;
  const sum = validScores.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / validScores.length) * 10) / 10;
}

/**
 * Resolves standard Raport Terpadu academic category (0 - 100 scale).
 * Thresholds aligned with PKBM standard:
 * >= 90: Sangat Baik (SB)
 * >= 75: Baik (B)
 * >= 60: Cukup (C)
 * < 60: Perlu Bimbingan (PB)
 */
export function getAcademicCategory(
  score: number | null | undefined
): RaportCategoryResult | null {
  if (score === null || score === undefined || isNaN(score)) return null;
  if (score >= 90) {
    return {
      label: "Sangat Baik",
      short: "SB",
      colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    };
  }
  if (score >= 75) {
    return {
      label: "Baik",
      short: "B",
      colorClass: "text-blue-700 bg-blue-50 border-blue-200",
    };
  }
  if (score >= 60) {
    return {
      label: "Cukup",
      short: "C",
      colorClass: "text-amber-700 bg-amber-50 border-amber-200",
    };
  }
  return {
    label: "Perlu Bimbingan",
    short: "PB",
    colorClass: "text-rose-700 bg-rose-50 border-rose-200",
  };
}

/**
 * Generates an authoritative document number for printed Raport Terpadu reports.
 * Matches institutional pattern used by Trisula, RPM, and KKTP.
 */
export function generateRaportDocumentNumber(
  academicYear?: string,
  semester?: string,
  className?: string,
  studentIdOrNisn?: string
): string {
  const cleanYear = (academicYear || new Date().getFullYear().toString()).replace(
    /[^a-zA-Z0-9]/g,
    ""
  );
  const cleanSem = (semester || "SM1")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const cleanClass = (className || "BLC")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const cleanStudent = (studentIdOrNisn || "001")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();
  return `BLC/RAPORT/${cleanYear}/${cleanSem}/${cleanClass}/${cleanStudent}`;
}

/**
 * Section contract for modular Raport Terpadu sections.
 * Lembar 1 (Academic Summary) is mandatory.
 * Supporting sections can be independently toggled.
 */
export interface RaportSectionConfig {
  academic: boolean; // LEMBAR 1: Mandatory
  kktp?: boolean; // Supporting: KKTP Detail
  trisula?: boolean; // Supporting: Trisula 3 Pilar
  attendance?: boolean; // Supporting: Presensi
  sahabatUtsman?: boolean; // Supporting: SAHABAT & UTSMAN
  fitrah?: boolean; // Supporting: Fitrah Belajar & Bakat
}

export const DEFAULT_RAPORT_SECTIONS: RaportSectionConfig = {
  academic: true,
  kktp: false,
  trisula: false,
  attendance: false,
  sahabatUtsman: false,
  fitrah: false,
};
