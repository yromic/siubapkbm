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

/**
 * Checks if a string conforms to standard UUID format.
 */
export function isUuid(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

export interface AcademicPeriodResolutionContext {
  semesters?: Array<{ id: string; name: string; academic_year_id?: string; academic_year_name?: string }>;
  academicYears?: Array<{ id: string; name: string }>;
}

export interface ResolvedAcademicPeriod {
  semesterId?: string;
  semesterName: string; // e.g. "Ganjil"
  semesterLabel: string; // e.g. "Semester Ganjil"
  academicYearLabel: string; // e.g. "2026/2027"
  combinedLabel: string; // e.g. "Semester Ganjil • Tahun Ajaran 2026/2027"
}

export interface AcademicPeriodResolutionParams {
  semesterId?: string | null;
  semesterName?: string | null;
  semesterTahun?: string | null;
  semesterTahunRaw?: string | null;
  tahunAjaran?: string | null;
  tahunAjaranRaw?: string | null;
  masterSemesters?: Array<{ id: string; name: string; academic_year_id?: string; academic_year_name?: string }>;
  masterAcademicYears?: Array<{ id: string; name: string }>;
  semesters?: Array<{ id: string; name: string; academic_year_id?: string; academic_year_name?: string }>;
  academicYears?: Array<{ id: string; name: string }>;
}

/**
 * Resolves semester and academic year labels from IDs or legacy display values.
 * Guarantees that raw UUIDs are never returned as user-facing labels.
 */
export function resolveAcademicPeriodDisplay(
  params: AcademicPeriodResolutionParams,
  context?: AcademicPeriodResolutionContext
): ResolvedAcademicPeriod {
  const semesters = context?.semesters || params.masterSemesters || params.semesters || [];
  const academicYears = context?.academicYears || params.masterAcademicYears || params.academicYears || [];

  const rawSemesterTahun = params.semesterTahun ?? params.semesterTahunRaw ?? null;
  const rawTahunAjaran = params.tahunAjaran ?? params.tahunAjaranRaw ?? null;
  const rawSemesterName = params.semesterName ?? null;

  let resolvedSemId: string | undefined = undefined;
  let resolvedSemName = rawSemesterName ? rawSemesterName.trim() : "";
  let resolvedAyName = "";

  // 0. If rawSemesterName is accidentally a UUID, treat it as a lookup key, not a label
  if (isUuid(resolvedSemName)) {
    if (!resolvedSemId) resolvedSemId = resolvedSemName;
    resolvedSemName = "";
  }

  // 1. Resolve from semesterId if provided
  if (params.semesterId && params.semesterId.trim().length > 0) {
    resolvedSemId = params.semesterId.trim();
    const semRecord = semesters.find((s) => s.id === resolvedSemId);
    if (semRecord) {
      if (!resolvedSemName && semRecord.name) {
        resolvedSemName = semRecord.name;
      }
      if (semRecord.academic_year_name) {
        resolvedAyName = semRecord.academic_year_name;
      } else if (semRecord.academic_year_id) {
        const ayRecord = academicYears.find((y) => y.id === semRecord.academic_year_id);
        if (ayRecord?.name) {
          resolvedAyName = ayRecord.name;
        } else {
          const semWithAy = semesters.find((s) => s.academic_year_id === semRecord.academic_year_id && s.academic_year_name);
          if (semWithAy?.academic_year_name) resolvedAyName = semWithAy.academic_year_name;
        }
      }
    }
  }

  // 2. Resolve or fallback for semesterTahun (uses rawSemesterTahun)
  if (rawSemesterTahun && rawSemesterTahun.trim().length > 0) {
    const raw = rawSemesterTahun.trim();
    if (isUuid(raw)) {
      // Legacy data: semesterTahun stored as UUID
      const semRecord = semesters.find((s) => s.id === raw);
      if (semRecord) {
        if (!resolvedSemId) resolvedSemId = semRecord.id;
        if (!resolvedSemName) resolvedSemName = semRecord.name || "";
        if (!resolvedAyName) {
          resolvedAyName = semRecord.academic_year_name || academicYears.find((y) => y.id === semRecord.academic_year_id)?.name || "";
        }
      } else {
        // Maybe it was an academic_year UUID
        const ayRecord = academicYears.find((y) => y.id === raw);
        if (ayRecord?.name && !resolvedAyName) {
          resolvedAyName = ayRecord.name;
        } else {
          const semWithAy = semesters.find((s) => s.academic_year_id === raw);
          if (semWithAy?.academic_year_name && !resolvedAyName) {
            resolvedAyName = semWithAy.academic_year_name;
          }
        }
      }
    } else {
      // Check if raw is composite string e.g. "Semester Ganjil • 2026/2027" or "Semester Ganjil • Tahun Ajaran 2026/2027"
      const compositeMatch = raw.match(/^(.*?)(?:•|—|-)\s*(?:Tahun Ajaran|TA)?\s*(\d{4}\/\d{4})/i);
      if (compositeMatch) {
        if (!resolvedSemName) resolvedSemName = compositeMatch[1].trim();
        if (!resolvedAyName) resolvedAyName = compositeMatch[2].trim();
      } else if (!resolvedSemName) {
        resolvedSemName = raw;
      }
    }
  }

  // 3. Resolve or fallback for tahunAjaran (uses rawTahunAjaran)
  if (rawTahunAjaran && rawTahunAjaran.trim().length > 0) {
    const raw = rawTahunAjaran.trim();
    if (isUuid(raw)) {
      // UUID detected (e.g. legacy bug where academic_year_id was saved into tahunAjaran)
      const ayRecord = academicYears.find((y) => y.id === raw);
      if (ayRecord?.name) {
        resolvedAyName = ayRecord.name;
      } else {
        const semWithAy = semesters.find((s) => s.academic_year_id === raw || s.id === raw);
        if (semWithAy) {
          if (semWithAy.academic_year_name) resolvedAyName = semWithAy.academic_year_name;
          if (!resolvedSemName && semWithAy.name) resolvedSemName = semWithAy.name;
          if (!resolvedSemId) resolvedSemId = semWithAy.id;
        }
      }
    } else {
      // Valid human-readable year string (e.g. "2026/2027")
      resolvedAyName = raw;
    }
  }

  // 4. If still no resolvedAyName, check if resolvedSemId can find academic year
  if (!resolvedAyName && resolvedSemId) {
    const semRecord = semesters.find((s) => s.id === resolvedSemId);
    if (semRecord?.academic_year_name) {
      resolvedAyName = semRecord.academic_year_name;
    } else if (semRecord?.academic_year_id) {
      const ayRecord = academicYears.find((y) => y.id === semRecord.academic_year_id);
      if (ayRecord?.name) {
        resolvedAyName = ayRecord.name;
      } else {
        const semWithAy = semesters.find((s) => s.academic_year_id === semRecord.academic_year_id && s.academic_year_name);
        if (semWithAy?.academic_year_name) resolvedAyName = semWithAy.academic_year_name;
      }
    }
  }

  // 5. Sanitize: ensure no UUID leaks out as a label
  if (isUuid(resolvedSemName)) resolvedSemName = "";
  if (isUuid(resolvedAyName)) resolvedAyName = "";

  // 6. Normalize semesterName (e.g. "Ganjil" without "Semester " prefix)
  const cleanSemName = resolvedSemName.replace(/^Semester\s+/i, '').trim();

  // 7. Build formatted semesterLabel
  const semesterLabel = cleanSemName
    ? (resolvedSemName.toLowerCase().startsWith('semester') ? resolvedSemName : `Semester ${cleanSemName}`)
    : "-";

  const academicYearLabel = resolvedAyName ? resolvedAyName.trim() : "-";

  // 8. Build combinedLabel
  let combinedLabel = "-";
  if (semesterLabel !== "-" && academicYearLabel !== "-") {
    combinedLabel = `${semesterLabel} • Tahun Ajaran ${academicYearLabel}`;
  } else if (semesterLabel !== "-") {
    combinedLabel = semesterLabel;
  } else if (academicYearLabel !== "-") {
    combinedLabel = `Tahun Ajaran ${academicYearLabel}`;
  }

  return {
    semesterId: resolvedSemId,
    semesterName: cleanSemName || (resolvedSemName !== "-" ? resolvedSemName : ""),
    semesterLabel,
    academicYearLabel,
    combinedLabel,
  };
}

export const getAcademicPeriodDisplay = resolveAcademicPeriodDisplay;


