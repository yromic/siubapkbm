/**
 * Character Rule Configuration (Sprint 2)
 * Terpusat untuk pemetaan SAHABAT ke FITRAH dan rumus UTSMAN.
 */

export interface SahabatScores {
  sss: number; // Salam, Sapa, Senyum, Santun
  am: number;  // Al-Qur'an & Ibadah
  hb: number;  // Hubungan Baik / Harmonis
  asm: number; // Amanah & Jujur
  br: number;  // Bersih, Rapi, Sehat
  ak: number;  // Aktif & Adaptif / Akal
  tm: number;  // Tanggung Jawab
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
  u_score: number; // U - Ulet & Unggul (AM + AK) / 2
  t_score: number; // T - Ta'at & Tangguh (AK)
  s_score: number; // S - Santun & Empati (SSS + HB) / 2
  m_score: number; // M - Mandiri & Rapi (BR)
  a_score: number; // A - Amanah & Jujur (AM + ASM) / 2
  n_score: number; // N - Nalar & Inisiatif (HB + TM) / 2
}

/**
 * Pemetaan Indikator SAHABAT ke Dimensi FITRAH
 */
export const SAHABAT_TO_FITRAH = {
  fathonah: (s: SahabatScores): number => (s.ak + s.asm) / 2,
  istiqamah: (s: SahabatScores): number => s.am,
  tanggungJawab: (s: SahabatScores): number => s.tm,
  rahmah: (s: SahabatScores): number => (s.sss + s.hb) / 2,
  amanah: (s: SahabatScores): number => (s.am + s.hb) / 2,
  harmonis: (s: SahabatScores): number => (s.sss + s.hb) / 2,
};

/**
 * Rumus Profil UTSMAN Semester Summary
 */
export const UTSMAN_FORMULA = {
  /** U - Ulet & Unggul: (AM + AK) / 2 */
  calculateU: (s: SahabatScores): number => (s.am + s.ak) / 2,

  /** T - Ta'at & Tangguh: AK */
  calculateT: (s: SahabatScores): number => s.ak,

  /** S - Santun & Empati: (SSS + HB) / 2 */
  calculateS: (s: SahabatScores): number => (s.sss + s.hb) / 2,

  /** M - Mandiri & Rapi: BR */
  calculateM: (s: SahabatScores): number => s.br,

  /** A - Amanah & Jujur: (AM + ASM) / 2 */
  calculateA: (s: SahabatScores): number => (s.am + s.asm) / 2,

  /** N - Nalar & Inisiatif: (HB + TM) / 2 */
  calculateN: (s: SahabatScores): number => (s.hb + s.tm) / 2,
};
