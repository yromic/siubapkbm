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
