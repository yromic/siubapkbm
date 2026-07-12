import React from "react";
import {
  CheckCircle,
  XCircle,
  Archive,
  Lock,
  MinusCircle,
  Trash,
  GraduationCap,
  ArrowLeftRight,
  LogOut,
  HeartCrack,
  FileEdit,
  LucideIcon
} from "lucide-react";

export type LifecycleStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED"
  | "LOCKED"
  | "SUSPENDED"
  | "SOFT_DELETED"
  | "GRADUATED"
  | "TRANSFERRED"
  | "WITHDRAWN"
  | "DECEASED"
  | "DRAFT";

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  cls: string;
  tooltip: string;
}

const CONFIG: Record<LifecycleStatus, BadgeConfig> = {
  ACTIVE: {
    label: "Aktif",
    icon: CheckCircle,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
    tooltip: "Data aktif dan dapat digunakan dalam transaksi sistem."
  },
  INACTIVE: {
    label: "Tidak Aktif",
    icon: XCircle,
    cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50",
    tooltip: "Data dinonaktifkan sementara dan tidak dapat digunakan dalam transaksi baru."
  },
  ARCHIVED: {
    label: "Diarsipkan",
    icon: Archive,
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
    tooltip: "Data disimpan dalam arsip jangka panjang (read-only)."
  },
  LOCKED: {
    label: "Terkunci",
    icon: Lock,
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    tooltip: "Periode atau data telah dikunci secara permanen."
  },
  SUSPENDED: {
    label: "Ditangguhkan",
    icon: MinusCircle,
    cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50",
    tooltip: "Akun pengguna ditangguhkan sementara."
  },
  SOFT_DELETED: {
    label: "Terhapus",
    icon: Trash,
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
    tooltip: "Data berada di tempat sampah (dapat dipulihkan)."
  },
  GRADUATED: {
    label: "Lulus",
    icon: GraduationCap,
    cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/50",
    tooltip: "Siswa telah menyelesaikan studi akademik."
  },
  TRANSFERRED: {
    label: "Pindah",
    icon: ArrowLeftRight,
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50",
    tooltip: "Siswa mutasi pindah ke sekolah lain."
  },
  WITHDRAWN: {
    label: "Keluar",
    icon: LogOut,
    cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50",
    tooltip: "Siswa mengundurkan diri atau putus sekolah."
  },
  DECEASED: {
    label: "Meninggal",
    icon: HeartCrack,
    cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50",
    tooltip: "Siswa wafat/meninggal dunia."
  },
  DRAFT: {
    label: "Draft",
    icon: FileEdit,
    cls: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900/50",
    tooltip: "Data draf dan belum diterbitkan resmi."
  }
};

export function LifecycleBadge({ status }: { status: LifecycleStatus | string }) {
  const normStatus = (String(status).toUpperCase() as LifecycleStatus);
  const cfg = CONFIG[normStatus] || {
    label: String(status),
    icon: CheckCircle,
    cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50",
    tooltip: "Status tidak dikenal."
  };

  const Icon = cfg.icon;

  return (
    <span
      title={cfg.tooltip}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls} transition-all duration-200 cursor-help`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {cfg.label}
    </span>
  );
}
