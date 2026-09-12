/**
 * SIUBA Letterhead Upload Validation Utilities
 *
 * Server-side guard functions for validating image uploads destined
 * for use as official institutional letterheads.
 *
 * All validation happens on raw Buffer — never trust extension or MIME header alone.
 */

export const MAX_LETTERHEAD_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg"] as const;
export type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

interface MagicByteResult {
  valid: boolean;
  mimeType: string;
  ext: AllowedExt | null;
}

/**
 * Validate image bytes via magic byte inspection.
 * Supports PNG and JPEG only — no SVG, no GIF, no WebP.
 */
export function validateLetterheadMagicBytes(buffer: Buffer): MagicByteResult {
  if (buffer.length < 8) {
    return { valid: false, mimeType: "", ext: null };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: "image/png", ext: "png" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg", ext: "jpg" };
  }

  return { valid: false, mimeType: "", ext: null };
}

/**
 * Validate size limit.
 */
export function validateLetterheadSize(sizeBytes: number): boolean {
  return sizeBytes <= MAX_LETTERHEAD_SIZE_BYTES;
}

/**
 * Derive safe storage filename from a UUID and detected extension.
 * Format: letterhead_<uuid>.<ext>
 */
export function buildLetterheadFilename(uuid: string, ext: AllowedExt): string {
  return `letterhead_${uuid}.${ext}`;
}
