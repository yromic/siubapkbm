/**
 * Pagination — Reusable server/client pagination controls component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §2 (Font: font-data / IBM Plex Sans for numbers)
 */

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemLabel?: string;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  itemLabel = "item",
  className = "",
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const isFirst = page <= 1;
  const isLast = page >= safeTotalPages;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 ${className}`}
    >
      {totalItems !== undefined && (
        <div className="text-xs text-zinc-500 font-data">
          Menampilkan total <span className="font-semibold text-zinc-700 dark:text-zinc-300">{totalItems}</span> {itemLabel}
        </div>
      )}

      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={isFirst}
          className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-data bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 tabular-nums">
          {page} / {safeTotalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          disabled={isLast}
          className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
