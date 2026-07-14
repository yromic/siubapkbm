"use client";

import { useMemo, useState } from "react";
import type { ImportOperation, ImportPreviewRow, ImportSummary } from "@/lib/api/imports";

type PreviewFilter = "all" | ImportOperation | "warning";

const FILTERS: Array<{ value: PreviewFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "create", label: "Tambah" },
  { value: "update", label: "Perbarui" },
  { value: "skip", label: "Lewati" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Peringatan" },
];

const operationLabels: Record<ImportOperation, string> = {
  create: "Tambah",
  update: "Perbarui",
  skip: "Lewati",
  error: "Error",
};

function safeValue(value: string) {
  return value === "[REDACTED]" ? "Disembunyikan" : value || "(kosong)";
}

function RowCard({ row }: { row: ImportPreviewRow }) {
  const tone = row.operation === "error" ? "border-red-200 dark:border-red-900" : row.status === "warning" ? "border-amber-200 dark:border-amber-900" : "border-zinc-200 dark:border-zinc-800";
  return (
    <article className={`rounded-xl border bg-white p-4 dark:bg-zinc-900 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Baris {row.row_number}</p>
          <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{row.display_name || row.identifier || "Data tanpa identitas"}</h3>
          {row.identifier && <p className="truncate text-xs text-zinc-500">{row.identifier}</p>}
          {row.temp_password && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-650 dark:text-zinc-350">
              <span className="font-semibold text-zinc-550 dark:text-zinc-450">Password Sementara:</span>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono font-bold text-emerald-700 dark:bg-zinc-800 dark:text-emerald-400 select-all">
                {row.temp_password}
              </code>
            </div>
          )}
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">{operationLabels[row.operation]}</span>
          <span className={`rounded-full px-2.5 py-1 ${row.status === "invalid" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : row.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
            {row.status === "invalid" ? "Tidak valid" : row.status === "warning" ? "Peringatan" : "Valid"}
          </span>
        </div>
      </div>
      {(row.changes ?? []).length > 0 && (
        <details className="mt-3 rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
          <summary className="cursor-pointer font-semibold text-blue-800 dark:text-blue-200">Lihat perubahan ({(row.changes ?? []).length})</summary>
          <ul className="mt-2 space-y-1.5 text-zinc-700 dark:text-zinc-300">
            {(row.changes ?? []).map((change, index) => <li key={`${change.field}-${index}`}><span className="font-medium">{change.field}:</span> {safeValue(change.old_value)} → {safeValue(change.new_value)}</li>)}
          </ul>
        </details>
      )}
      {[...(row.errors ?? []), ...(row.warnings ?? [])].length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {(row.errors ?? []).map((issue, index) => <li className="text-red-700 dark:text-red-300" key={`error-${index}`}>• {issue.message}</li>)}
          {(row.warnings ?? []).map((issue, index) => <li className="text-amber-700 dark:text-amber-300" key={`warning-${index}`}>• {issue.message}</li>)}
        </ul>
      )}
    </article>
  );
}

export function ImportPreview({ preview }: { preview: ImportSummary }) {
  const [filter, setFilter] = useState<PreviewFilter>("all");
  const [limit, setLimit] = useState(20);
  const ordered = useMemo(() => [...(preview.preview_rows ?? [])].sort((a, b) => {
    const priority = (row: ImportPreviewRow) => row.operation === "error" ? 0 : row.status === "warning" ? 1 : row.operation === "update" ? 2 : row.operation === "create" ? 3 : 4;
    return priority(a) - priority(b) || a.row_number - b.row_number;
  }), [preview.preview_rows]);
  const filtered = ordered.filter((row) => filter === "all" || (filter === "warning" ? row.status === "warning" : row.operation === filter));

  const cards = [
    ["Akan ditambahkan", preview.create_count, "text-emerald-600"],
    ["Akan diperbarui", preview.update_count, "text-blue-600"],
    ["Tidak berubah", preview.skip_count, "text-zinc-600"],
    ["Error", preview.error_count, "text-red-600"],
    ["Peringatan", preview.warning_count, "text-amber-600"],
  ] as const;

  return (
    <section className="space-y-4" aria-labelledby="preview-heading">
      <div><h2 id="preview-heading" className="text-lg font-bold">Hasil preview</h2><p className="text-sm text-zinc-500">{preview.valid_rows} baris valid dari {preview.total_rows} baris. Hasil berasal dari validasi backend.</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value, tone]) => <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-xs text-zinc-500">{label}</p><p className={`text-2xl font-bold ${tone}`}>{value}</p></div>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter preview">
        {FILTERS.map((item) => <button key={item.value} type="button" onClick={() => { setFilter(item.value); setLimit(20); }} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${filter === item.value ? "bg-emerald-600 text-white" : "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}>{item.label}</button>)}
      </div>
      <div className="space-y-3">
        {filtered.slice(0, limit).map((row) => <RowCard key={row.row_number} row={row} />)}
        {filtered.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-zinc-500">Tidak ada baris untuk filter ini.</p>}
      </div>
      {limit < filtered.length && <button type="button" onClick={() => setLimit((value) => value + 20)} className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Lihat lebih banyak ({filtered.length - limit})</button>}
    </section>
  );
}
