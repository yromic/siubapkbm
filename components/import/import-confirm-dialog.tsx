"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Loader2 } from "lucide-react";
import type { ImportSummary } from "@/lib/api/imports";

export function ImportConfirmDialog({ open, preview, typeLabel, loading, onClose, onConfirm }: { open: boolean; preview: ImportSummary; typeLabel: string; loading: boolean; onClose: () => void; onConfirm: () => void; }) {
  const rows = [["Jenis import", typeLabel], ["Nama file", preview.file_name || "-"], ["Tambah", preview.create_count], ["Perbarui", preview.update_count], ["Lewati", preview.skip_count], ["Error", preview.error_count], ["Peringatan", preview.warning_count]];
  return (
    <AlertDialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-5 sm:p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
          <AlertDialog.Title className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Konfirmasi import</AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Backend akan memproses baris valid. Baris error tidak akan diimport.</AlertDialog.Description>
          <dl className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4">
            {rows.map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 py-2.5 text-sm"><dt className="text-zinc-500 dark:text-zinc-400">{label}</dt><dd className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{value}</dd></div>)}
          </dl>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <button type="button" disabled={loading} className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer">Batal</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" disabled={loading} onClick={onConfirm} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 cursor-pointer">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Mengimpor data..." : "Ya, proses baris valid"}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
