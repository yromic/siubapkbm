/**
 * academicUtils.ts
 * Centralized utility for resolving Kurikulum Merdeka educational phases (Fase),
 * class grade mappings, and domain representations for SIUBA (Paket A / SD).
 */

export type KurikulumFase = 'Fase A' | 'Fase B' | 'Fase C';

export const STANDARD_FASES: readonly KurikulumFase[] = ['Fase A', 'Fase B', 'Fase C'] as const;

export const FASE_METADATA: Record<KurikulumFase, { name: KurikulumFase; grades: string; levels: number[]; description: string }> = {
  'Fase A': {
    name: 'Fase A',
    grades: 'Kelas 1 - 2',
    levels: [1, 2],
    description: 'Fondasi awal literasi, numerasi dasar, dan pembiasaan adab.',
  },
  'Fase B': {
    name: 'Fase B',
    grades: 'Kelas 3 - 4',
    levels: [3, 4],
    description: 'Pengembangan pemahaman konseptual, penalaran logis, dan kemandirian.',
  },
  'Fase C': {
    name: 'Fase C',
    grades: 'Kelas 5 - 6',
    levels: [5, 6],
    description: 'Penguatan penalaran kritis, pemecahan masalah kompleks, dan kepemimpinan.',
  },
};

/**
 * Resolves Kurikulum Merdeka Phase from numeric class level (e.g. 1, 2 -> Fase A; 3, 4 -> Fase B; 5, 6 -> Fase C).
 * Safe against string numbers, null, undefined. Default fallback is 'Fase C'.
 */
export function resolvePhaseByClassLevel(level: number | string | null | undefined): KurikulumFase {
  if (level === null || level === undefined || level === '') {
    return 'Fase C';
  }

  const num = typeof level === 'number' ? level : parseInt(String(level).replace(/\D/g, ''), 10);
  if (isNaN(num)) {
    return 'Fase C';
  }

  if (num <= 2) return 'Fase A';
  if (num <= 4) return 'Fase B';
  return 'Fase C';
}

/**
 * Resolves Kurikulum Merdeka Phase from class name string (e.g. "Kelas 1A" -> Fase A, "Kelas 4" -> Fase B).
 */
export function resolvePhaseByClassName(className: string | null | undefined): KurikulumFase {
  if (!className) return 'Fase C';

  const match = className.match(/(\d+)/);
  if (match) {
    const level = parseInt(match[1], 10);
    return resolvePhaseByClassLevel(level);
  }

  const lower = className.toLowerCase();
  if (lower.includes('fase a') || lower.includes('kelas 1') || lower.includes('kelas 2') || lower.includes('k1') || lower.includes('k2')) {
    return 'Fase A';
  }
  if (lower.includes('fase b') || lower.includes('kelas 3') || lower.includes('kelas 4') || lower.includes('k3') || lower.includes('k4')) {
    return 'Fase B';
  }
  return 'Fase C';
}

/**
 * Returns list of standard phase options for UI selectors.
 */
export function getStandardPhaseOptions(): Array<{ value: KurikulumFase; label: string; grades: string }> {
  return STANDARD_FASES.map((fase) => ({
    value: fase,
    label: `${fase} (${FASE_METADATA[fase].grades})`,
    grades: FASE_METADATA[fase].grades,
  }));
}

/**
 * Standard Trisula Domains
 */
export const TRISULA_DOMAINS = ['Literasi', 'Numerasi', 'Diniyyah'] as const;
export type TrisulaDomain = typeof TRISULA_DOMAINS[number];
export type TrisulaPillar = "LITERASI" | "NUMERASI" | "DINIYYAH";

export interface ScoreCategory {
  label: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
  short: "SB" | "B" | "C" | "PB";
  colorClass: string;
}

/**
 * Checks if a subject name corresponds to one of the 3 Trisula pillars
 */
export function isTrisulaDomain(name: string | null | undefined): boolean {
  if (!name) return false;
  return TRISULA_DOMAINS.some((d) => d.toLowerCase() === name.trim().toLowerCase());
}

/**
 * calculatePillarScore
 * Centralized pure aggregation rule for calculating averages across scores.
 */
export function calculatePillarScore(scores: (number | null | undefined)[]): number | null {
  const validScores = scores.filter((s): s is number => typeof s === "number" && !isNaN(s) && s >= 0);
  if (validScores.length === 0) return null;
  const sum = validScores.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / validScores.length) * 100) / 100;
}

/**
 * getScoreCategory
 * Centralized threshold categories for Trisula (0 - 100 scale).
 */
export function getScoreCategory(score: number | null | undefined): ScoreCategory | null {
  if (score === null || score === undefined || isNaN(score)) return null;
  if (score >= 90) {
    return { label: "Sangat Baik", short: "SB", colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  }
  if (score >= 75) {
    return { label: "Baik", short: "B", colorClass: "text-blue-700 bg-blue-50 border-blue-200" };
  }
  if (score >= 60) {
    return { label: "Cukup", short: "C", colorClass: "text-amber-700 bg-amber-50 border-amber-200" };
  }
  return { label: "Perlu Bimbingan", short: "PB", colorClass: "text-rose-700 bg-rose-50 border-rose-200" };
}

