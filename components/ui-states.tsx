import React from "react";
import { Loader2, Inbox, AlertCircle, Lock, ChevronRight } from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────
// LoadingState
// ─────────────────────────────────────────────

interface LoadingProps {
  message?: string;
}

export function LoadingState({ message = "Memuat data..." }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center flex-1" role="status" aria-busy="true">
      <Loader2 className="w-10 h-10 animate-spin text-brand-emerald-500" />
      <p className="mt-4 text-zinc-600 dark:text-zinc-400 font-plus-jakarta font-medium text-sm">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────

interface EmptyProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  /** Call-to-action element (tombol, link, dll.) yang ditampilkan di bawah deskripsi */
  action?: React.ReactNode;
}

export function EmptyState({
  title = "Tidak Ada Data",
  description = "Belum ada item untuk ditampilkan.",
  icon,
  action,
}: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20">
      {icon ? (
        <div className="mb-3 text-zinc-400">{icon}</div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
          <Inbox className="w-6 h-6 text-zinc-400" />
        </div>
      )}
      <h3 className="text-base font-semibold font-plus-jakarta text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm font-plus-jakarta text-zinc-500 dark:text-zinc-400 max-w-xs">{description}</p>
      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ErrorState
// ─────────────────────────────────────────────

interface ErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  /** Langkah-langkah atau panduan untuk mengatasi error */
  solution?: string;
}

export function ErrorState({
  title = "Terjadi Kesalahan",
  message,
  onRetry,
  solution,
}: ErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-8 text-center border border-red-100 dark:border-red-950 rounded-2xl bg-red-50/50 dark:bg-red-950/10"
    >
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-3 text-red-600 dark:text-red-400">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold font-plus-jakarta text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm font-plus-jakarta text-red-600 dark:text-red-400 max-w-md">{message}</p>
      {solution && (
        <p className="mt-2 text-sm font-plus-jakarta text-zinc-500 dark:text-zinc-400 max-w-md">
          {solution}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold font-plus-jakarta hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ForbiddenState
// ─────────────────────────────────────────────

interface ForbiddenProps {
  title?: string;
  message?: string;
}

export function ForbiddenState({
  title = "Akses Ditolak",
  message = "Anda tidak memiliki izin yang cukup untuk mengakses halaman ini.",
}: ForbiddenProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center p-12 text-center flex-1">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm font-plus-jakarta text-zinc-600 dark:text-zinc-400 max-w-sm">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// PageHeader
// ─────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** Primary page title — rendered as <h1> in font-fredoka per design spec */
  title: string;
  /** Optional subtitle / description below the title */
  description?: string;
  /** Optional breadcrumb trail shown above the title */
  breadcrumbs?: BreadcrumbItem[];
  /** Primary action slot (e.g. "Tambah Siswa" button) */
  actions?: React.ReactNode;
  /** Secondary action slot (e.g. filter dropdown, export button) */
  secondaryActions?: React.ReactNode;
  /** Optional status badge displayed inline next to the title */
  statusBadge?: React.ReactNode;
  /** Optional back-navigation button rendered above the title */
  backHref?: string;
  /** Label for the back button (default: "Kembali") */
  backLabel?: string;
  /** Show a skeleton loading state instead of real content */
  loading?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  secondaryActions,
  statusBadge,
  backHref,
  backLabel = "Kembali",
  loading = false,
}: PageHeaderProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800/60" aria-hidden="true">
        <div className="h-4 w-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-8 w-64 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-4 w-80 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 pb-6 border-b border-zinc-100 dark:border-zinc-800/60">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" aria-hidden="true" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-xs font-medium font-plus-jakarta text-zinc-500 dark:text-zinc-400 hover:text-brand-emerald-600 dark:hover:text-brand-emerald-400 transition-colors focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1 rounded"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-xs font-medium font-plus-jakarta text-zinc-400 dark:text-zinc-500" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Back Button */}
      {backHref && (
        <div className="mb-1">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold font-plus-jakarta text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1 rounded"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      )}

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-0.5">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <h1 className="text-2xl font-bold font-fredoka text-zinc-950 dark:text-zinc-50 tracking-tight leading-tight">
            {title}
          </h1>
          {statusBadge && <div className="flex-shrink-0">{statusBadge}</div>}
        </div>

        {/* Actions */}
        {(actions || secondaryActions) && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {secondaryActions}
            {actions}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm font-plus-jakarta text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
          {description}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ResponsiveContainer
// ─────────────────────────────────────────────

export function ResponsiveContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
