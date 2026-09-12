/**
 * SIUBA RPM Attachment Types & Contracts
 *
 * Lampiran RPM adalah dokumen pendukung (LKPD, Rubrik, Bahan Ajar, dll.)
 * yang terhubung ke dokumen RPM secara relasional, tersimpan pada direktori
 * privat server, dan disajikan melalui stream terotorisasi.
 */

export type RPMAttachmentType =
  | "LKPD"
  | "BAHAN_AJAR"
  | "RUBRIK"
  | "INSTRUMEN_ASESMEN"
  | "MEDIA_PENDUKUNG"
  | "DOKUMEN_PENDUKUNG"
  | "LAINNYA";

export const RPM_ATTACHMENT_TYPES: readonly RPMAttachmentType[] = [
  "LKPD",
  "BAHAN_AJAR",
  "RUBRIK",
  "INSTRUMEN_ASESMEN",
  "MEDIA_PENDUKUNG",
  "DOKUMEN_PENDUKUNG",
  "LAINNYA",
] as const;

export const RPM_ATTACHMENT_TYPE_LABELS: Record<RPMAttachmentType, string> = {
  LKPD: "LKPD",
  BAHAN_AJAR: "Bahan Ajar",
  RUBRIK: "Rubrik",
  INSTRUMEN_ASESMEN: "Instrumen Asesmen",
  MEDIA_PENDUKUNG: "Media Pendukung",
  DOKUMEN_PENDUKUNG: "Dokumen Pendukung",
  LAINNYA: "Lainnya",
};

export interface RPMAttachment {
  id: string;
  documentId: string;
  attachmentType: RPMAttachmentType;
  title: string;
  description?: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  previewUrl?: string | null;
}

export interface RPMAttachmentInput {
  attachmentType: RPMAttachmentType;
  title?: string;
  description?: string;
}

export interface RPMAttachmentMetadataUpdate {
  attachmentType?: RPMAttachmentType;
  title?: string;
  description?: string | null;
  sortOrder?: number;
}
