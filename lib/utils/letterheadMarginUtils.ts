export const LETTERHEAD_MARGIN_KEYS = {
  top: "letterhead_margin_top_mm",
  right: "letterhead_margin_right_mm",
  bottom: "letterhead_margin_bottom_mm",
  left: "letterhead_margin_left_mm",
} as const;

export const LETTERHEAD_MARGIN_MODE_KEY = "letterhead_margin_mode";
export const LETTERHEAD_MARGIN_MODE_ABSOLUTE = "absolute_from_paper";

export const MIN_LETTERHEAD_MARGIN_MM = 0;
export const DOCUMENT_CONTENT_MARGIN_MM = {
  top: 10,
  right: 12,
  bottom: 12,
  left: 12,
} as const;

export type LetterheadMarginSide = keyof typeof LETTERHEAD_MARGIN_KEYS;
export type LetterheadMargins = Record<LetterheadMarginSide, number>;

export const DEFAULT_LETTERHEAD_MARGINS: LetterheadMargins = {
  top: DOCUMENT_CONTENT_MARGIN_MM.top,
  right: DOCUMENT_CONTENT_MARGIN_MM.right,
  bottom: 0,
  left: DOCUMENT_CONTENT_MARGIN_MM.left,
};

export const MAX_LETTERHEAD_MARGIN_MM = 30;

export function normalizeLetterheadMargin(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_LETTERHEAD_MARGIN_MM, Math.max(0, parsed));
}

export function getLetterheadMargins(
  settings?: Record<string, unknown>,
): LetterheadMargins {
  const isAbsolute = settings?.[LETTERHEAD_MARGIN_MODE_KEY] === LETTERHEAD_MARGIN_MODE_ABSOLUTE;
  if (!isAbsolute) {
    // Backward compatibility: the first implementation stored extra inset values.
    return {
      top: DOCUMENT_CONTENT_MARGIN_MM.top + normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.top]),
      right: DOCUMENT_CONTENT_MARGIN_MM.right + normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.right]),
      bottom: normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.bottom]),
      left: DOCUMENT_CONTENT_MARGIN_MM.left + normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.left]),
    };
  }
  return {
    top: normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.top], DEFAULT_LETTERHEAD_MARGINS.top),
    right: normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.right], DEFAULT_LETTERHEAD_MARGINS.right),
    bottom: normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.bottom]),
    left: normalizeLetterheadMargin(settings?.[LETTERHEAD_MARGIN_KEYS.left], DEFAULT_LETTERHEAD_MARGINS.left),
  };
}

export function validateLetterheadMarginSettings(settings: Record<string, unknown>): void {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Payload pengaturan harus berupa objek.");
  }
  for (const key of Object.values(LETTERHEAD_MARGIN_KEYS)) {
    if (!(key in settings)) continue;
    const value = settings[key];
    const parsed = typeof value === "number" ? value : Number(String(value));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_LETTERHEAD_MARGIN_MM) {
      throw new Error(`Nilai ${key} harus berupa angka antara 0 dan ${MAX_LETTERHEAD_MARGIN_MM} mm.`);
    }
  }
  if (
    LETTERHEAD_MARGIN_MODE_KEY in settings &&
    settings[LETTERHEAD_MARGIN_MODE_KEY] !== LETTERHEAD_MARGIN_MODE_ABSOLUTE
  ) {
    throw new Error("Mode margin kop surat tidak valid.");
  }
}
