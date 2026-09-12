export interface AttachmentRenderIdentity {
  id: string;
  documentId?: string;
  mimeType: string;
  previewUrl?: string | null;
}

export interface PdfPageContainer {
  replaceChildren(): void;
}

export function getAttachmentRenderSourceKey(attachment: AttachmentRenderIdentity): string {
  return `${attachment.documentId ?? ""}:${attachment.id}:${attachment.mimeType}:${attachment.previewUrl ?? ""}`;
}

export function getAttachmentRenderGenerationKey(
  attachment: AttachmentRenderIdentity,
  retryGeneration: number,
): string {
  return `${getAttachmentRenderSourceKey(attachment)}:${retryGeneration}`;
}

export function isCurrentAttachmentRenderGeneration(
  activeGeneration: number | null,
  candidateGeneration: number,
): boolean {
  return activeGeneration === candidateGeneration;
}

export function resetPdfPageContainer(container: PdfPageContainer | null): void {
  container?.replaceChildren();
}

export function getSafeAttachmentFileTypeLabel(mimeType: string, originalFilename: string): string {
  const normalizedMimeType = mimeType.toLowerCase();
  if (normalizedMimeType === "application/pdf") return "PDF";
  if (normalizedMimeType === "image/png") return "PNG";
  if (normalizedMimeType === "image/jpeg") return "JPEG";
  if (normalizedMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "DOCX";
  }
  if (normalizedMimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "XLSX";
  }
  if (normalizedMimeType === "application/msword") return "DOC";
  if (normalizedMimeType === "application/vnd.ms-excel") return "XLS";

  const extension = originalFilename.split(".").at(-1)?.toUpperCase();
  return extension && /^[A-Z0-9]{1,10}$/.test(extension) ? extension : "Berkas lain";
}
