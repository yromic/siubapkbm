/**
 * Character Rule Configuration (Sprint 2 & Post-Audit Correctness)
 * Terpusat untuk pemetaan SAHABAT ke FITRAH dan rumus UTSMAN.
 */

export interface SahabatScores {
  sss: number | null; // Salam, Sapa, Senyum, Santun
  am: number | null;  // Al-Qur'an & Ibadah
  hb: number | null;  // Hubungan Baik / Harmonis
  asm: number | null; // Amanah & Jujur
  br: number | null;  // Bersih, Rapi, Sehat
  ak: number | null;  // Aktif & Adaptif / Akal
  tm: number | null;  // Tanggung Jawab
}

export interface FitrahResult {
  fathonah: number;      // F - Akal / Kecerdasan
  istiqamah: number;     // I - Ketaatan Ibadah
  tanggungJawab: number; // T - Tanggung Jawab
  rahmah: number;        // R - Kasih Sayang & Empati
  amanah: number;        // A - Kejujuran & Integritas
  harmonis: number;      // H - Hubungan Sosial
}

export interface UtsmanResult {
  u_score: number | null; // U - Ulet & Unggul: mean(AM, AK)
  t_score: number | null; // T - Ta'at & Tangguh: AK
  s_score: number | null; // S - Santun & Empati: mean(SSS, HB)
  m_score: number | null; // M - Mandiri & Rapi: BR
  a_score: number | null; // A - Amanah & Jujur: mean(AM, ASM)
  n_score: number | null; // N - Nalar & Inisiatif: mean(HB, TM)
}

/**
 * Calculates arithmetic mean strictly over observed (non-null, non-undefined, valid) numeric values.
 * Returns null if all input values are null/unobserved.
 */
export function meanObserved(values: (number | null | undefined)[]): number | null {
  const observed = values.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  if (observed.length === 0) return null;
  const sum = observed.reduce((acc, curr) => acc + curr, 0);
  return sum / observed.length;
}

/**
 * Pemetaan Indikator SAHABAT ke Dimensi FITRAH (Legacy auxiliary)
 */
export const SAHABAT_TO_FITRAH = {
  fathonah: (s: SahabatScores): number => meanObserved([s.ak, s.asm]) ?? 0,
  istiqamah: (s: SahabatScores): number => s.am ?? 0,
  tanggungJawab: (s: SahabatScores): number => s.tm ?? 0,
  rahmah: (s: SahabatScores): number => meanObserved([s.sss, s.hb]) ?? 0,
  amanah: (s: SahabatScores): number => meanObserved([s.am, s.hb]) ?? 0,
  harmonis: (s: SahabatScores): number => meanObserved([s.sss, s.hb]) ?? 0,
};

/**
 * Rumus Profil UTSMAN Semester Summary (Canonical Correctness)
 * Operates only on observed indicators. Unobserved indicator does NOT depress score.
 * Completely unobserved dimension returns null.
 */
export const UTSMAN_FORMULA = {
  /** U - Ulet & Unggul: mean(AM, AK) */
  calculateU: (s: SahabatScores): number | null => meanObserved([s.am, s.ak]),

  /** T - Ta'at & Tangguh: AK */
  calculateT: (s: SahabatScores): number | null => (s.ak !== null && s.ak !== undefined && !isNaN(s.ak) ? s.ak : null),

  /** S - Santun & Empati: mean(SSS, HB) */
  calculateS: (s: SahabatScores): number | null => meanObserved([s.sss, s.hb]),

  /** M - Mandiri & Rapi: BR */
  calculateM: (s: SahabatScores): number | null => (s.br !== null && s.br !== undefined && !isNaN(s.br) ? s.br : null),

  /** A - Amanah & Jujur: mean(AM, ASM) */
  calculateA: (s: SahabatScores): number | null => meanObserved([s.am, s.asm]),

  /** N - Nalar & Inisiatif: mean(HB, TM) */
  calculateN: (s: SahabatScores): number | null => meanObserved([s.hb, s.tm]),
};

/**
 * Calculates overall UTSMAN average using strictly observed UTSMAN dimensions.
 * Example: U=4, A=4, others null -> overall=4, NOT (4+0+0+0+4+0)/6 = 1.33.
 */
export function calculateUtsmanOverallAverage(scores: UtsmanResult): number | null {
  return meanObserved([
    scores.u_score,
    scores.t_score,
    scores.s_score,
    scores.m_score,
    scores.a_score,
    scores.n_score,
  ]);
}

