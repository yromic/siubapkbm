"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import React from "react";

export interface ConfirmDialogProps {
  /** Apakah dialog terbuka */
  open: boolean;
  /** Callback ketika status open berubah */
  onOpenChange: (open: boolean) => void;
  /** Judul dialog */
  title: string;
  /** Deskripsi/pesan konfirmasi */
  description?: string;
  /** Label tombol konfirmasi (default: "Ya, Lanjutkan") */
  confirmLabel?: string;
  /** Label tombol batal (default: "Batal") */
  cancelLabel?: string;
  /**
   * Variant tombol konfirmasi:
   * - "destructive" → merah (hapus, reset, keluar)
   * - "default"     → emerald (konfirmasi simpan, lanjutkan)
   */
  variant?: "destructive" | "default";
  /** Callback ketika pengguna mengkonfirmasi */
  onConfirm: () => void | Promise<void>;
  /** Loading state saat aksi sedang diproses */
  loading?: boolean;
}

/**
 * ConfirmDialog — Dialog konfirmasi yang konsisten menggunakan Radix AlertDialog.
 *
 * Mendukung Esc key, focus trap, dan aria-modal secara otomatis.
 * Digunakan untuk: batal perubahan, hapus data, logout, reset form.
 *
 * @example
 * <ConfirmDialog
 *   open={confirmOpen}
 *   onOpenChange={setConfirmOpen}
 *   title="Batalkan Perubahan?"
 *   description="Data yang belum disimpan akan hilang."
 *   confirmLabel="Ya, Batalkan"
 *   variant="destructive"
 *   onConfirm={handleCancel}
 * />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  variant = "destructive",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const isLoading = loading || internalLoading;

  const handleConfirm = async () => {
    const result = onConfirm();
    if (result instanceof Promise) {
      setInternalLoading(true);
      try {
        await result;
      } finally {
        setInternalLoading(false);
      }
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        {/* Overlay */}
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Dialog content */}
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">

          {/* Icon */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            variant === "destructive"
              ? "bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
              : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <AlertDialog.Title className="text-base font-bold text-zinc-950 dark:text-zinc-50 mb-2">
            {title}
          </AlertDialog.Title>

          {/* Description */}
          {description && (
            <AlertDialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              {description}
            </AlertDialog.Description>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <AlertDialog.Cancel asChild>
              <button
                disabled={isLoading}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 cursor-pointer ${
                  variant === "destructive"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
