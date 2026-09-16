import React from 'react';
import {
  StudentAttendanceStatus,
  STUDENT_ATTENDANCE_STATUSES,
  STATUS_LABELS,
  STATUS_SHORT_LABELS,
} from '@/types/studentAttendance';

interface AttendanceStatusSelectorProps {
  value: StudentAttendanceStatus;
  onChange: (status: StudentAttendanceStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  StudentAttendanceStatus,
  {
    bgActive: string;
    textActive: string;
    borderActive: string;
    hoverBg: string;
  }
> = {
  hadir: {
    bgActive: 'bg-emerald-600 text-white shadow-sm',
    textActive: 'text-white',
    borderActive: 'border-emerald-600',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
  },
  sakit: {
    bgActive: 'bg-amber-500 text-white shadow-sm',
    textActive: 'text-white',
    borderActive: 'border-amber-500',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  },
  izin: {
    bgActive: 'bg-blue-600 text-white shadow-sm',
    textActive: 'text-white',
    borderActive: 'border-blue-600',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  },
  alpa: {
    bgActive: 'bg-rose-600 text-white shadow-sm',
    textActive: 'text-white',
    borderActive: 'border-rose-600',
    hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400',
  },
  terlambat: {
    bgActive: 'bg-purple-600 text-white shadow-sm',
    textActive: 'text-white',
    borderActive: 'border-purple-600',
    hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-400',
  },
};

export function AttendanceStatusSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: AttendanceStatusSelectorProps) {
  return (
    <div
      className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60"
      role="radiogroup"
      aria-label="Pilih status kehadiran"
    >
      {STUDENT_ATTENDANCE_STATUSES.map((status) => {
        const isSelected = value === status;
        const config = STATUS_CONFIG[status];

        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={`
              relative flex items-center justify-center font-plus-jakarta font-semibold transition-all duration-150 rounded-lg cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              ${compact ? 'px-2.5 py-1 text-xs min-w-[32px]' : 'px-3.5 py-1.5 text-xs min-w-[40px] md:min-w-[48px]'}
              ${
                isSelected
                  ? config.bgActive
                  : `text-zinc-600 dark:text-zinc-400 ${config.hoverBg}`
              }
            `}
            title={STATUS_LABELS[status]}
          >
            <span className="md:hidden font-bold">{STATUS_SHORT_LABELS[status]}</span>
            <span className="hidden md:inline">{STATUS_LABELS[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
