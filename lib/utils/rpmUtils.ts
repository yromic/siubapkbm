export interface RPMActivityItem {
  teks: string;
  tagBudaya?: string[];
  tagKarakter?: string[];
}

export type RPMActivityInput = string | RPMActivityItem;

export const VALID_TRISULA = ["Literasi", "Numerasi", "Diniyyah"] as const;
export const VALID_FITRAH = ["Keimanan", "Kemandirian", "Adab & Akhlak", "Keberanian", "Kreativitas", "Kepedulian"] as const;
export const VALID_SAHABAT = ["Disiplin", "Jujur", "Empati", "Tanggung Jawab", "Kerja Keras", "Syukur", "Sabar"] as const;
export const VALID_UTSMAN = ["Keberanian", "Kedermawanan", "Keteguhan", "Keadilan", "Kejujuran", "Kepemimpinan"] as const;
export const VALID_KURNAS = [
  "Keimanan dan Ketakwaan kepada Tuhan YME",
  "Kewargaan",
  "Penalaran Kritis",
  "Kreativitas",
  "Kolaborasi",
  "Kemandirian",
  "Kesehatan",
  "Komunikasi"
] as const;

export type DplKurnasValue = typeof VALID_KURNAS[number];

// ─── Extended RPM types for new planning fields ───────────────────────────────

/**
 * Rubrik Karakter FITRAH: 1 row per selected karakterFitrah indicator.
 * Teacher planning rubric (observable behaviors), NOT student score intervals.
 */
export interface RPMRubrikItem {
  indikator: string;
  sangatBaik: string;
  perluBimbingan: string;
}

/**
 * Per-phase activity metadata (structured duration, focus, and method).
 * Optional extension that preserves backward compatibility with old documents
 * that only have the activity arrays.
 */
export interface RPMActivityPhaseMetadata {
  fokus?: string;
  durasiMenit?: number;
}

export interface RPMAwalMetadata extends RPMActivityPhaseMetadata {
  fokusAdab?: string;
}

export interface RPMIntiMetadata extends RPMActivityPhaseMetadata {
  pendekatanMetode?: string;
}

export interface RPMAkhirMetadata extends RPMActivityPhaseMetadata {
  fokusRefleksi?: string;
}

export interface RPMKegiatanMetadata {
  awal?: RPMAwalMetadata;
  inti?: RPMIntiMetadata;
  akhir?: RPMAkhirMetadata;
}

/**
 * Normalisasi item aktivitas (string atau object) menjadi object RPMActivityItem baku.
 * Mendukung ekstraksi anotasi bracket lama seperti [Budaya: X | Karakter: Y] jika ada.
 */
export function normalizeActivityItem(item: RPMActivityInput): RPMActivityItem {
  if (typeof item === 'object' && item !== null) {
    return {
      teks: item.teks || "",
      tagBudaya: Array.isArray(item.tagBudaya) ? item.tagBudaya : [],
      tagKarakter: Array.isArray(item.tagKarakter) ? item.tagKarakter : [],
    };
  }
  const str = String(item || "").trim();
  const bracketMatch = str.match(/\[(.*?)\]$/);
  if (bracketMatch) {
    const cleanTeks = str.replace(/\[(.*?)\]$/, "").trim();
    const inside = bracketMatch[1];
    const parts = inside.split("|").map((p) => p.trim());
    const tagBudaya: string[] = [];
    const tagKarakter: string[] = [];
    for (const part of parts) {
      if (part.startsWith("Budaya:")) {
        const val = part.replace("Budaya:", "").trim();
        tagBudaya.push(...val.split(",").map((v) => v.trim()).filter(Boolean));
      } else if (part.startsWith("Karakter:")) {
        const val = part.replace("Karakter:", "").trim();
        tagKarakter.push(...val.split(",").map((v) => v.trim()).filter(Boolean));
      }
    }
    return { teks: cleanTeks, tagBudaya, tagKarakter };
  }
  return { teks: str, tagBudaya: [], tagKarakter: [] };
}

/**
 * Format item aktivitas menjadi teks utuh yang diakhiri anotasi [Budaya: ... | Karakter: ...]
 */
export function formatActivityItemWithTags(item: RPMActivityInput): string {
  const norm = normalizeActivityItem(item);
  const tagParts: string[] = [];
  if (norm.tagBudaya && norm.tagBudaya.length > 0) {
    tagParts.push(`Budaya: ${norm.tagBudaya.join(", ")}`);
  }
  if (norm.tagKarakter && norm.tagKarakter.length > 0) {
    tagParts.push(`Karakter: ${norm.tagKarakter.join(", ")}`);
  }
  if (tagParts.length === 0) return norm.teks;
  return `${norm.teks} [${tagParts.join(" | ")}]`;
}

/**
 * Compute total structured duration from activity metadata.
 * Returns numeric total if all three phases have structured data,
 * otherwise returns null to indicate legacy text-parsing should be used.
 */
export function computeStructuredDuration(metadata: RPMKegiatanMetadata | undefined): number | null {
  if (!metadata) return null;
  const a = metadata.awal?.durasiMenit;
  const i = metadata.inti?.durasiMenit;
  const k = metadata.akhir?.durasiMenit;
  if (a === undefined && i === undefined && k === undefined) return null;
  return (a || 0) + (i || 0) + (k || 0);
}

/**
 * Legacy fallback: extract total duration from activity item text strings.
 * Used for old documents that don't have structured metadata durations.
 */
export function computeLegacyDurationFromActivities(
  awal: RPMActivityItem[],
  inti: RPMActivityItem[],
  akhir: RPMActivityItem[]
): number | null {
  let total = 0;
  let found = false;
  for (const act of [...awal, ...inti, ...akhir]) {
    const match = act.teks.match(/\((\d+)\s*Menit\)/i);
    if (match && match[1]) {
      total += parseInt(match[1], 10);
      found = true;
    }
  }
  return found ? total : null;
}
