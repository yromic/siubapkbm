export type AttachmentLoadStatus = "idle" | "loading" | "success" | "error";

export function getAttachmentPreviewMessage(count: number): string | null {
  if (count <= 0) return null;
  return `${count} lampiran tersedia di bagian akhir dokumen.`;
}

export function shouldConfirmAttachmentPrint(status: AttachmentLoadStatus): boolean {
  return status === "error";
}
