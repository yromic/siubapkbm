import path from "path";
import { RPMAttachmentType, RPM_ATTACHMENT_TYPE_LABELS, RPM_ATTACHMENT_TYPES } from "@/types/rpmAttachment";

/**
 * Maximum file size allowed for RPM attachments: 10 MB
 */
export const MAX_RPM_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "docx",
  "xlsx",
  "png",
  "jpg",
  "jpeg",
] as const;

export type AllowedAttachmentExt = (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedExt?: AllowedAttachmentExt;
  mimeType?: string;
}

/**
 * Validates buffer via magic bytes inspection and checks against extension and size limits.
 * Strict security: never trusts client extension or Content-Type header alone.
 */
export function validateAttachmentBuffer(
  buffer: Buffer,
  originalFilename: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "File kosong (0 bytes)." };
  }

  if (buffer.length > MAX_RPM_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Ukuran file melebihi batas maksimum 10 MB (terdeteksi: ${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const rawExt = path.extname(originalFilename || "").toLowerCase().replace(/^\./, "");
  if (!rawExt || !ALLOWED_ATTACHMENT_EXTENSIONS.includes(rawExt as AllowedAttachmentExt)) {
    return {
      valid: false,
      error: `Format file .${rawExt || "unknown"} tidak didukung. Unggah file PDF, DOCX, XLSX, PNG, atau JPG.`,
    };
  }

  // 1. Check PDF: Starts with %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    if (rawExt !== "pdf") {
      return { valid: false, error: "Ekstensi file tidak sesuai dengan konten PDF sebenarnya." };
    }
    return {
      valid: true,
      detectedExt: "pdf",
      mimeType: "application/pdf",
    };
  }

  // 2. Check PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (rawExt !== "png") {
      return { valid: false, error: "Ekstensi file tidak sesuai dengan konten PNG sebenarnya." };
    }
    return {
      valid: true,
      detectedExt: "png",
      mimeType: "image/png",
    };
  }

  // 3. Check JPEG/JPG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    if (rawExt !== "jpg" && rawExt !== "jpeg") {
      return { valid: false, error: "Ekstensi file tidak sesuai dengan konten JPEG sebenarnya." };
    }
    return {
      valid: true,
      detectedExt: rawExt === "jpeg" ? "jpeg" : "jpg",
      mimeType: "image/jpeg",
    };
  }

  // 4. Check OpenXML ZIP Container (DOCX / XLSX): Starts with 'PK' (0x50 0x4B 0x03 0x04)
  const isZipHeader =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);

  if (isZipHeader) {
    if (rawExt === "docx") {
      return {
        valid: true,
        detectedExt: "docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }
    if (rawExt === "xlsx") {
      return {
        valid: true,
        detectedExt: "xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }
    return {
      valid: false,
      error: "Arsip ZIP biasa tidak didukung. Harap unggah dokumen DOCX atau XLSX yang valid.",
    };
  }

  return {
    valid: false,
    error: "Tanda tangan biner file tidak valid atau file mengalami kerusakan.",
  };
}

/**
 * Sanitizes original filename for database metadata and client display.
 * Strips path traversal characters and caps length to 255 chars.
 */
export function sanitizeOriginalFilename(filename: string): string {
  if (!filename || typeof filename !== "string") return "attachment";
  const base = path.basename(filename).trim();
  // Remove control chars and reserved characters
  const clean = base.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_");
  return clean.slice(0, 255) || "attachment";
}

/**
 * Derives default title from original filename if user leaves title blank.
 * Example: "LKPD Gelombang.pdf" -> "LKPD Gelombang"
 */
export function deriveDefaultTitle(originalFilename: string): string {
  const clean = sanitizeOriginalFilename(originalFilename);
  const ext = path.extname(clean);
  const title = path.basename(clean, ext).replace(/[_-]+/g, " ").trim();
  return title || "Lampiran RPM";
}

/**
 * Builds safe immutable storage filename: attachment_<uuid>.<ext>
 */
export function buildStorageFilename(uuid: string, ext: AllowedAttachmentExt): string {
  return `attachment_${uuid}.${ext}`;
}

/**
 * Validates if the given string is a recognized RPMAttachmentType enum
 */
export function isValidAttachmentType(type: any): type is RPMAttachmentType {
  return typeof type === "string" && (RPM_ATTACHMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Returns user-facing label for attachment type
 */
export function formatAttachmentType(type: RPMAttachmentType | string): string {
  return RPM_ATTACHMENT_TYPE_LABELS[type as RPMAttachmentType] || type;
}

/**
 * Formats byte count to human-readable string (e.g. 1.2 MB, 340 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
