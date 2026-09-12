export type EmbeddableAttachmentKind = "pdf" | "image" | "external";

export type AttachmentContentStatus = "idle" | "loading" | "ready" | "error";

export type AttachmentPrintReadiness = "idle" | "loading" | "ready" | "error";

export interface AttachmentRenderState {
  embeddable: boolean;
  status: AttachmentContentStatus;
}

export interface AttachmentRenderSummary {
  status: AttachmentPrintReadiness;
  embeddableCount: number;
  readyCount: number;
  loadingCount: number;
  errorCount: number;
}

export function classifyEmbeddableAttachment(mimeType: string): EmbeddableAttachmentKind {
  const normalized = mimeType.toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/png" || normalized === "image/jpeg") return "image";
  return "external";
}

export function summarizeAttachmentReadiness(
  states: readonly AttachmentRenderState[],
): AttachmentRenderSummary {
  const embeddableStates = states.filter((state) => state.embeddable);
  const readyCount = embeddableStates.filter((state) => state.status === "ready").length;
  const loadingCount = embeddableStates.filter((state) => state.status === "loading").length;
  const errorCount = embeddableStates.filter((state) => state.status === "error").length;

  let status: AttachmentPrintReadiness = "ready";
  if (loadingCount > 0) status = "loading";
  else if (errorCount > 0) status = "error";
  else if (readyCount < embeddableStates.length) status = "idle";

  return {
    status,
    embeddableCount: embeddableStates.length,
    readyCount,
    loadingCount,
    errorCount,
  };
}

export function shouldBreakAfterPdfPage(pageIndex: number, pageCount: number): boolean {
  return pageIndex < pageCount - 1;
}
