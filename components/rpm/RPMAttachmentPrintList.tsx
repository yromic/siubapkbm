"use client";

import React, { useMemo } from "react";
import { Paperclip } from "lucide-react";
import { RPMAttachment } from "@/types/rpmAttachment";
import { formatAttachmentType, formatFileSize } from "@/lib/utils/rpmAttachmentUtils";
import { PrintSectionHeader } from "@/components/print/PrintSectionHeader";

export interface RPMAttachmentPrintListProps {
  attachments?: RPMAttachment[];
  className?: string;
}

/**
 * RPMAttachmentPrintList
 *
 * Presentational-only component for rendering official Lampiran Dokumen
 * in RPM Document Preview and Print (A4 PDF output).
 *
 * Rules:
 * - Omits section completely if attachments is empty.
 * - Sorts by sortOrder ascending defensively.
 * - Each item has print-break-inside-avoid.
 * - No interactive upload/download/edit controls rendered.
 * - No internal UUIDs or private download tokens exposed.
 */
export function RPMAttachmentPrintList({
  attachments,
  className = "",
}: RPMAttachmentPrintListProps) {
  const sortedAttachments = useMemo(() => {
    if (!attachments || attachments.length === 0) return [];
    return [...attachments].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [attachments]);

  if (sortedAttachments.length === 0) {
    return null;
  }

  return (
    <section id="rpm-lampiran" className={`scroll-mt-4 space-y-3 pt-3 text-gray-900 ${className}`}>
      <PrintSectionHeader
        title="Lampiran Dokumen"
        variant="primary"
        icon={<Paperclip className="w-3.5 h-3.5 text-emerald-700" />}
      />

      <div className="border border-emerald-200/90 rounded-lg overflow-hidden bg-white text-xs divide-y divide-gray-200 print:border-gray-300">
        {sortedAttachments.map((att, idx) => {
          const itemNumber = String(idx + 1).padStart(2, "0");
          return (
            <div
              key={att.id || idx}
              className="p-3 flex items-start gap-3 print:p-2.5 print-break-inside-avoid bg-white"
            >
              {/* Monospace sequential number badge */}
              <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs font-mono print:border-gray-300 print:bg-gray-100">
                {itemNumber}
              </div>

              {/* Attachment content details */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h4 className="font-bold text-xs text-gray-900 leading-snug break-words">
                    {att.title}
                  </h4>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 print:border-gray-300 print:bg-gray-100 print:text-gray-900">
                    {formatAttachmentType(att.attachmentType)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-600">
                  <span>
                    Berkas: <span className="font-medium text-gray-800">{att.originalFilename}</span>
                  </span>
                  {att.fileSize > 0 && (
                    <>
                      <span className="text-gray-400">&bull;</span>
                      <span className="text-gray-500">{formatFileSize(att.fileSize)}</span>
                    </>
                  )}
                </div>

                {att.description && att.description.trim().length > 0 && (
                  <p className="text-[11px] text-gray-700 italic pt-0.5 leading-relaxed">
                    {att.description.trim()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
