"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pdfjs } from "@/components/rpm/pdfjsClient";
import {
  AttachmentContentStatus,
  AttachmentRenderSummary,
  classifyEmbeddableAttachment,
  shouldBreakAfterPdfPage,
  summarizeAttachmentReadiness,
} from "@/lib/utils/rpmAttachmentRendering";
import {
  getAttachmentRenderGenerationKey,
  getAttachmentRenderSourceKey,
  getSafeAttachmentFileTypeLabel,
  isCurrentAttachmentRenderGeneration,
  resetPdfPageContainer,
} from "@/lib/utils/rpmAttachmentRendererLifecycle";
import { RPMAttachment } from "@/types/rpmAttachment";

interface RPMAttachmentDocumentPagesProps {
  attachments: RPMAttachment[];
  onReadinessChange?: (summary: AttachmentRenderSummary) => void;
}

interface AttachmentContentProps {
  attachment: RPMAttachment;
  stateKey: string;
  renderGeneration: number;
  onStatusChange: (stateKey: string, status: AttachmentContentStatus) => void;
}

function safeFilename(attachment: RPMAttachment): string {
  return attachment.originalFilename.trim() || "Berkas lampiran";
}

function logRenderFailure(
  documentId: string,
  attachmentId: string,
  operation: string,
  error: unknown,
) {
  console.error("RPM attachment render failed", {
    module: "RPMAttachmentDocumentPages",
    documentId,
    attachmentId,
    operation,
    error: error instanceof Error ? error.name : "UNKNOWN_ERROR",
  });
}

function AttachmentError({
  attachment,
  onRetry,
}: {
  attachment: RPMAttachment;
  onRetry: () => void;
}) {
  return (
    <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900" data-no-print>
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Lampiran gagal ditampilkan. <span className="font-medium">{safeFilename(attachment)}</span>
        </span>
      </span>
      <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="h-8 text-xs">
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Coba Lagi
      </Button>
    </div>
  );
}

function PdfAttachmentContent({
  attachment,
  stateKey,
  renderGeneration,
  onStatusChange,
}: AttachmentContentProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const activeGenerationRef = useRef<number | null>(null);
  const { documentId, id: attachmentId, previewUrl } = attachment;

  const reportStatus = useCallback(
    (status: AttachmentContentStatus) => {
      if (isCurrentAttachmentRenderGeneration(activeGenerationRef.current, renderGeneration)) {
        onStatusChange(stateKey, status);
      }
    },
    [onStatusChange, renderGeneration, stateKey],
  );

  useEffect(() => {
    let active = true;
    let operation = "fetch";
    const abortController = new AbortController();
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
    let documentProxy: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | undefined;
    const renderTasks: Array<{ cancel: () => void }> = [];
    const pagesContainer = pagesRef.current;
    activeGenerationRef.current = renderGeneration;
    resetPdfPageContainer(pagesContainer);

    async function renderPdf() {
      reportStatus("loading");

      try {
        if (!previewUrl) throw new Error("ATTACHMENT_PREVIEW_URL_MISSING");

        const response = await fetch(previewUrl, {
          credentials: "same-origin",
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error("ATTACHMENT_FETCH_FAILED");

        operation = "read-bytes";
        const bytes = await response.arrayBuffer();
        if (!active) return;

        operation = "load-pdf";
        loadingTask = pdfjs.getDocument({ data: bytes });
        documentProxy = await loadingTask.promise;
        if (!active) return;

        for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
          operation = "load-page";
          const page = await documentProxy.getPage(pageNumber);
          if (!active) return;

          const canvas = document.createElement("canvas");
          const viewport = page.getViewport({ scale: 2 });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "rpm-attachment-pdf-canvas";

          const pageElement = document.createElement("div");
          pageElement.className = "rpm-attachment-pdf-page";
          if (shouldBreakAfterPdfPage(pageNumber - 1, documentProxy.numPages)) {
            pageElement.classList.add("rpm-attachment-pdf-page-break-after");
          }
          pageElement.appendChild(canvas);
          if (!pagesContainer) return;
          pagesContainer.appendChild(pageElement);

          operation = "render-page";
          const renderTask = page.render({ canvas, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
          if (!active) return;
        }

        if (active) reportStatus("ready");
      } catch (error) {
        if (active && isCurrentAttachmentRenderGeneration(activeGenerationRef.current, renderGeneration)) {
          logRenderFailure(documentId, attachmentId, operation, error);
          reportStatus("error");
        }
      }
    }

    void renderPdf();

    return () => {
      active = false;
      if (isCurrentAttachmentRenderGeneration(activeGenerationRef.current, renderGeneration)) {
        activeGenerationRef.current = null;
      }
      abortController.abort();
      for (const task of renderTasks) task.cancel();
      resetPdfPageContainer(pagesContainer);
      void loadingTask?.destroy().catch((error) => {
        logRenderFailure(documentId, attachmentId, "destroy-pdf", error);
      });
    };
  }, [attachmentId, documentId, previewUrl, renderGeneration, reportStatus]);

  return <div ref={pagesRef} className="rpm-attachment-pdf-pages" />;
}

function ImageAttachmentContent({
  attachment,
  stateKey,
  renderGeneration,
  onStatusChange,
}: AttachmentContentProps) {
  const activeGenerationRef = useRef<number | null>(null);
  const { documentId, id: attachmentId, previewUrl } = attachment;

  const reportStatus = useCallback(
    (status: AttachmentContentStatus) => {
      if (isCurrentAttachmentRenderGeneration(activeGenerationRef.current, renderGeneration)) {
        onStatusChange(stateKey, status);
      }
    },
    [onStatusChange, renderGeneration, stateKey],
  );

  useEffect(() => {
    activeGenerationRef.current = renderGeneration;
    if (!previewUrl) {
      logRenderFailure(documentId, attachmentId, "load-image", new Error("ATTACHMENT_PREVIEW_URL_MISSING"));
      reportStatus("error");
    } else {
      reportStatus("loading");
    }

    return () => {
      if (isCurrentAttachmentRenderGeneration(activeGenerationRef.current, renderGeneration)) {
        activeGenerationRef.current = null;
      }
    };
  }, [attachmentId, documentId, previewUrl, renderGeneration, reportStatus]);

  if (!previewUrl) return null;

  return (
    <img
      src={previewUrl}
      alt={attachment.title || safeFilename(attachment)}
      className="rpm-attachment-image"
      onLoad={() => reportStatus("ready")}
      onError={() => {
        logRenderFailure(documentId, attachmentId, "load-image", new Error("ATTACHMENT_IMAGE_LOAD_FAILED"));
        reportStatus("error");
      }}
    />
  );
}

function ExternalAttachmentFallback({ attachment }: { attachment: RPMAttachment }) {
  return (
    <div className="rpm-attachment-external-fallback rounded-lg border border-gray-300 bg-white p-4 text-sm text-gray-800">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
        <div>
          <p className="font-semibold">{attachment.title || safeFilename(attachment)}</p>
          <p className="mt-1 text-xs text-gray-600">Berkas: {safeFilename(attachment)}</p>
          <p className="mt-1 text-xs text-gray-600">
            Jenis berkas: {getSafeAttachmentFileTypeLabel(attachment.mimeType, attachment.originalFilename)}
          </p>
          <p className="mt-2 text-xs text-gray-700">
            Dokumen ini tersedia sebagai berkas terpisah dan tidak dapat ditampilkan di dalam cetakan.
          </p>
        </div>
      </div>
    </div>
  );
}

export function RPMAttachmentDocumentPages({
  attachments,
  onReadinessChange,
}: RPMAttachmentDocumentPagesProps) {
  const [statuses, setStatuses] = useState<Record<string, AttachmentContentStatus>>({});
  const [retryGenerations, setRetryGenerations] = useState<Record<string, number>>({});

  const sortedAttachments = useMemo(
    () => [...attachments].sort((left, right) => left.sortOrder - right.sortOrder),
    [attachments],
  );

  const setAttachmentStatus = useCallback((stateKey: string, status: AttachmentContentStatus) => {
    setStatuses((current) => (current[stateKey] === status ? current : { ...current, [stateKey]: status }));
  }, []);

  const readiness = useMemo(
    () =>
      summarizeAttachmentReadiness(
        sortedAttachments.map((attachment) => ({
          embeddable: classifyEmbeddableAttachment(attachment.mimeType) !== "external",
          status: statuses[getAttachmentRenderSourceKey(attachment)] ?? "idle",
        })),
      ),
    [sortedAttachments, statuses],
  );

  useEffect(() => {
    onReadinessChange?.(readiness);
  }, [onReadinessChange, readiness]);

  const retryAttachment = useCallback((attachment: RPMAttachment) => {
    const stateKey = getAttachmentRenderSourceKey(attachment);
    setStatuses((current) => ({ ...current, [stateKey]: "idle" }));
    setRetryGenerations((current) => ({
      ...current,
      [stateKey]: (current[stateKey] ?? 0) + 1,
    }));
  }, []);

  if (sortedAttachments.length === 0) return null;

  return (
    <section id="rpm-lampiran" className="rpm-attachment-document-pages space-y-4 text-gray-900">
      {sortedAttachments.map((attachment, index) => {
        const kind = classifyEmbeddableAttachment(attachment.mimeType);
        const stateKey = getAttachmentRenderSourceKey(attachment);
        const status = statuses[stateKey] ?? "idle";
        const retryGeneration = retryGenerations[stateKey] ?? 0;
        const contentKey = getAttachmentRenderGenerationKey(attachment, retryGeneration);

        return (
          <article key={attachment.id} className="rpm-attachment-start space-y-3">
            {index === 0 && (
              <h2 className="rpm-attachment-heading text-base font-bold uppercase tracking-wide">Lampiran</h2>
            )}
            <header className="rpm-attachment-header border-b border-gray-300 pb-2">
              <p className="text-xs font-semibold text-gray-500">Lampiran {index + 1}</p>
              <h3 className="text-sm font-bold">{attachment.title || safeFilename(attachment)}</h3>
              <p className="text-xs text-gray-600">{safeFilename(attachment)}</p>
            </header>

            {kind === "external" ? (
              <ExternalAttachmentFallback attachment={attachment} />
            ) : status === "error" ? (
              <AttachmentError attachment={attachment} onRetry={() => retryAttachment(attachment)} />
            ) : kind === "pdf" ? (
              <PdfAttachmentContent
                key={contentKey}
                attachment={attachment}
                stateKey={stateKey}
                renderGeneration={retryGeneration}
                onStatusChange={setAttachmentStatus}
              />
            ) : (
              <ImageAttachmentContent
                key={contentKey}
                attachment={attachment}
                stateKey={stateKey}
                renderGeneration={retryGeneration}
                onStatusChange={setAttachmentStatus}
              />
            )}

            {status === "loading" && (
              <div className="print:hidden flex items-center gap-2 text-xs text-gray-600" data-no-print>
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat lampiran...
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
