"use client";

import { AlertTriangle, Info, CheckCircle2, XCircle, X } from "lucide-react";
import React from "react";

export type InfoBannerVariant = "warning" | "error" | "info" | "success";

export interface InfoBannerProps {
  /** Jenis banner yang menentukan warna dan ikon */
  variant: InfoBannerVariant;
  /** Judul banner (opsional — jika hanya pesan singkat, lewati) */
  title?: string;
  /** Deskripsi/pesan utama banner */
  description: string;
  /** Konten tambahan di bawah deskripsi (link, tombol, dll.) */
  action?: React.ReactNode;
  /** Apakah banner dapat ditutup oleh pengguna */
  dismissible?: boolean;
  /** Callback saat banner ditutup (harus digunakan bersama dismissible) */
  onDismiss?: () => void;
  /** Class tambahan untuk kustomisasi */
  className?: string;
}

const VARIANT_STYLES: Record<InfoBannerVariant, {
  container: string;
  icon: string;
  title: string;
  description: string;
  Icon: typeof AlertTriangle;
}> = {
  warning: {
    container: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-200",
    description: "text-amber-800 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  error: {
    container: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
    icon: "text-red-600 dark:text-red-400",
    title: "text-red-900 dark:text-red-200",
    description: "text-red-800 dark:text-red-300",
    Icon: XCircle,
  },
  info: {
    container: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
    icon: "text-blue-600 dark:text-blue-400",
    title: "text-blue-900 dark:text-blue-200",
    description: "text-blue-800 dark:text-blue-300",
    Icon: Info,
  },
  success: {
    container: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900",
    icon: "text-emerald-600 dark:text-emerald-400",
    title: "text-emerald-900 dark:text-emerald-200",
    description: "text-emerald-800 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
};

/**
 * InfoBanner — Banner kontekstual yang reusable untuk informasi penting.
 *
 * Digunakan untuk:
 * - Periode penilaian terkunci (warning)
 * - Semester sudah difinalisasi (error)
 * - Penilaian masih draft (warning)
 * - Data bersifat read-only (info)
 * - Instruksi sebelum aksi penting (info)
 *
 * @example
 * <InfoBanner
 *   variant="warning"
 *   title="Periode Terkunci"
 *   description="Tanggal ini sudah melewati batas 7 hari. Nilai hanya dapat dilihat."
 * />
 */
export function InfoBanner({
  variant,
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  className = "",
}: InfoBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const styles = VARIANT_STYLES[variant];
  const { Icon } = styles;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border p-4 animate-fadeIn ${styles.container} ${className}`}
    >
      {/* Icon */}
      <div className={`shrink-0 mt-0.5 ${styles.icon}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`text-sm font-semibold mb-0.5 ${styles.title}`}>
            {title}
          </p>
        )}
        <p className={`text-sm ${styles.description}`}>
          {description}
        </p>
        {action && (
          <div className="mt-3">
            {action}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          aria-label="Tutup pesan"
          className={`shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${styles.icon}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
