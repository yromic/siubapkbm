import React from "react";
import { Loader2, Inbox, AlertCircle, Lock } from "lucide-react";

interface LoadingProps {
  message?: string;
}

export function LoadingState({ message = "Memuat data..." }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      <p className="mt-4 text-zinc-600 dark:text-zinc-400 font-medium text-sm">{message}</p>
    </div>
  );
}

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
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
      {icon ? (
        <div className="mb-3 text-zinc-400">{icon}</div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
          <Inbox className="w-6 h-6 text-zinc-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">{description}</p>
      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}

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
    <div className="flex flex-col items-center justify-center p-8 text-center border border-red-100 dark:border-red-950 rounded-xl bg-red-50/50 dark:bg-red-950/10">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-3 text-red-600 dark:text-red-400">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400 max-w-md">{message}</p>
      {solution && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
          {solution}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Coba Lagi
        </button>
      )}
    </div>
  );
}

interface ForbiddenProps {
  title?: string;
  message?: string;
}

export function ForbiddenState({
  title = "Akses Ditolak",
  message = "Anda tidak memiliki izin yang cukup untuk mengakses halaman ini.",
}: ForbiddenProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">{message}</p>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-900">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function ResponsiveContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
