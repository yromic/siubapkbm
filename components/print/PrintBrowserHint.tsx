"use client";

import React from "react";
import { Info } from "lucide-react";

export interface PrintBrowserHintProps {
  /** Optional additional class names for container styling */
  className?: string;
  /** Layout style: default card or compact inline */
  variant?: "default" | "compact";
}

/**
 * PrintBrowserHint
 *
 * Screen-only informational banner providing clear instructions to teachers and admins
 * on disabling browser-generated headers and footers (URL, page title, timestamp, and page numbers)
 * in Chrome/Edge print dialog to produce clean official SIUBA PDFs.
 *
 * Guarantees zero footprint on printed output via `print:hidden` and `no-print`.
 */
export function PrintBrowserHint({
  className = "",
  variant = "default",
}: PrintBrowserHintProps) {
  if (variant === "compact") {
    return (
      <div
        role="note"
        aria-label="Petunjuk Hasil PDF Resmi"
        className={`print:hidden no-print flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/90 text-xs text-emerald-950 select-none ${className}`}
      >
        <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <span className="font-semibold text-emerald-900">Tips PDF Bersih: </span>
          <span className="text-gray-700">
            Pada dialog cetak, buka <strong className="font-semibold text-gray-900">More settings</strong> lalu nonaktifkan opsi <strong className="font-semibold text-gray-900">&ldquo;Headers and footers&rdquo;</strong> agar tanggal, URL, dan nomor halaman browser tidak tercetak.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label="Petunjuk Hasil PDF Resmi"
      className={`print:hidden no-print flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 border border-emerald-200/80 shadow-2xs text-xs text-emerald-950 select-none ${className}`}
    >
      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
        <Info className="w-4 h-4" />
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-emerald-950 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
          Petunjuk Hasil Cetak &amp; PDF Resmi
        </h4>
        <p className="text-gray-700 text-xs leading-relaxed">
          Untuk menghasilkan dokumen PDF yang bersih sesuai standar resmi SIUBA: pada jendela dialog cetak (Chrome / Edge), buka menu <strong className="font-semibold text-gray-900">&ldquo;More settings&rdquo;</strong> lalu hilangkan centang opsi <strong className="font-semibold text-gray-900">&ldquo;Headers and footers&rdquo;</strong>.
        </p>
        <p className="text-[11px] text-gray-500">
          Langkah ini memastikan tanggal browser, judul halaman, URL website, dan nomor halaman bawaan tidak ikut tercetak pada dokumen.
        </p>
      </div>
    </div>
  );
}
