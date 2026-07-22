/**
 * DataTable — Standardized desktop table architecture component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §6 (Desktop table hidden md:block pattern)
 *   - SIUBA_THEME_SYSTEM.md §4 (Surface 1 container, Surface 3 borders)
 */

import React from "react";
import { LoadingState } from "../ui-states";
import { EmptyState } from "../ui-states";
import { ErrorState } from "../ui-states";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectAll?: (checked: boolean) => void;
  onSelectRow?: (key: string | number, checked: boolean) => void;
  className?: string;
}

const ALIGN_CLASSES = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Tidak Ada Data",
  emptyDescription = "Belum ada item untuk ditampilkan.",
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedKeys,
  onSelectAll,
  onSelectRow,
  className = "",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={`bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 ${className}`}>
        <LoadingState message="Memuat data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 ${className}`}>
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 ${className}`}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const allSelected = data.length > 0 && selectedKeys && data.every((row, idx) => selectedKeys.has(keyExtractor(row, idx)));
  const someSelected = selectedKeys && selectedKeys.size > 0 && !allSelected;

  return (
    <div className={`hidden md:block bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40">
              {selectable && (
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = !!someSelected;
                    }}
                    onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                    className="rounded border-zinc-300 text-brand-emerald-600 focus:ring-brand-emerald-500 cursor-pointer"
                    aria-label="Pilih semua baris"
                  />
                </th>
              )}

              {columns.map((col) => {
                const alignClass = ALIGN_CLASSES[col.align || "left"];
                const isSorted = sortColumn === col.key;

                return (
                  <th
                    key={col.key}
                    className={`py-3 px-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${alignClass} ${
                      col.className || ""
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort && onSort(col.key)}
                        className="inline-flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer select-none"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-brand-emerald-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-brand-emerald-600" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-plus-jakarta">
            {data.map((row, index) => {
              const rowKey = keyExtractor(row, index);
              const isSelected = selectedKeys?.has(rowKey);

              return (
                <tr
                  key={rowKey}
                  className={`transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 ${
                    isSelected ? "bg-brand-emerald-50/40 dark:bg-brand-emerald-950/20" : ""
                  }`}
                >
                  {selectable && (
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={(e) => onSelectRow && onSelectRow(rowKey, e.target.checked)}
                        className="rounded border-zinc-300 text-brand-emerald-600 focus:ring-brand-emerald-500 cursor-pointer"
                        aria-label={`Pilih baris ${index + 1}`}
                      />
                    </td>
                  )}

                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3.5 px-4 text-zinc-700 dark:text-zinc-300 ${ALIGN_CLASSES[col.align || "left"]} ${
                        col.className || ""
                      }`}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
