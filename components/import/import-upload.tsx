"use client";

import type { ChangeEvent } from "react";
import type { ImportType } from "@/lib/api/imports";

export function ImportUpload({ importType, typeOptions, file, busy, onTypeChange, onDownloadTemplate, onFileChange, onPreview }: { importType: ImportType; typeOptions: Array<{ value: ImportType; label: string }>; file: File | null; busy: boolean; onTypeChange: (value: ImportType) => void; onDownloadTemplate: () => void; onFileChange: (file: File | null) => void; onPreview: () => void; }) {
  function handleFile(event: ChangeEvent<HTMLInputElement>) { onFileChange(event.target.files?.[0] || null); }
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <h2 className="text-lg font-bold">Siapkan file import</h2>
      <p className="mt-1 text-sm text-zinc-500">Gunakan template CSV agar nama dan urutan kolom sesuai.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium">Jenis import<select value={importType} disabled={busy} onChange={(event) => onTypeChange(event.target.value as ImportType)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950">{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="flex items-end"><button type="button" disabled={busy} onClick={onDownloadTemplate} className="w-full rounded-xl border border-emerald-600 px-4 py-3 font-semibold text-emerald-700 disabled:opacity-50 dark:text-emerald-400">Download template CSV</button></div>
        <label className="text-sm font-medium lg:col-span-2">File CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={handleFile} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:font-semibold file:text-white disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950" /></label>
      </div>
      {file && <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800"><span className="font-semibold">{file.name}</span> · {(file.size / 1024).toFixed(1)} KB</p>}
      <button type="button" disabled={!file || busy} onClick={onPreview} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Validasi dan pratinjau</button>
      {!file && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Pilih berkas CSV terlebih dahulu.</p>}
    </section>
  );
}
