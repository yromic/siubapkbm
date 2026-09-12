import type { AttachmentPrintReadiness } from "./rpmAttachmentRendering.ts";

export type AttachmentLoadStatus = "idle" | "loading" | "success" | "error";
export type AttachmentPrintDecision = "wait" | "confirm" | "print";

export function getAttachmentPreviewMessage(count: number): string | null {
  if (count <= 0) return null;
  return `${count} lampiran tersedia di bagian akhir dokumen.`;
}

export function shouldConfirmAttachmentPrint(status: AttachmentLoadStatus): boolean {
  return status === "error";
}

export function getAttachmentPrintDecision(status: AttachmentPrintReadiness): AttachmentPrintDecision {
  if (status === "loading") return "wait";
  if (status === "error") return "confirm";
  return "print";
}

