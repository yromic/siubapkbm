"use client";

import { AlertTriangle, Paperclip, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AttachmentLoadStatus,
  getAttachmentPreviewMessage,
} from "@/lib/utils/attachmentPreview";

interface RPMAttachmentPreviewNoticeProps {
  count: number;
  status: AttachmentLoadStatus;
  onJump: () => void;
  onRetry: () => void;
}

export function RPMAttachmentPreviewNotice({
  count,
  status,
  onJump,
  onRetry,
}: RPMAttachmentPreviewNoticeProps) {
  const message = getAttachmentPreviewMessage(count);
  if (!message && status !== "error") return null;

  return (
    <div className="print:hidden space-y-2" data-no-print>
      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Lampiran gagal dimuat. Silakan coba lagi.
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="h-8 text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Coba Lagi
          </Button>
        </div>
      )}

      {message && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span className="flex items-center gap-2 font-medium">
            <Paperclip className="h-4 w-4" /> {message}
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={onJump} className="h-8 text-xs">
            Lihat Lampiran
          </Button>
        </div>
      )}
    </div>
  );
}
