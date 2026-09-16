'use client';

import React from 'react';
import { StudentAttendanceClassItem } from '@/types/studentAttendance';
import {
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { EmptyState } from '@/components/ui-states';

interface TeacherAttendanceLandingProps {
  classes: StudentAttendanceClassItem[];
  date: string;
  onSelectClass: (classId: string) => void;
}

export function TeacherAttendanceLanding({
  classes,
  date,
  onSelectClass,
}: TeacherAttendanceLandingProps) {
  if (classes.length === 0) {
    return (
      <EmptyState
        title="Belum Ada Kelas Wali"
        description="Belum ada kelas wali yang ditugaskan pada semester aktif saat ini."
        icon={<BookOpen className="w-8 h-8 text-zinc-400" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => {
          const hasSubmitted = cls.has_submitted;

          return (
            <div
              key={cls.class_id}
              onClick={() => onSelectClass(cls.class_id)}
              className={`
                p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group
                ${
                  hasSubmitted
                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-brand-emerald-500/50 hover:shadow-md'
                    : 'bg-white dark:bg-zinc-900 border-amber-200/80 dark:border-amber-900/40 hover:border-amber-500 hover:shadow-md'
                }
              `}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100 group-hover:text-brand-emerald-600 dark:group-hover:text-brand-emerald-400 transition-colors">
                      Kelas {cls.class_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {cls.level && <span>Fase / Tingkat {cls.level}</span>}
                      {cls.level && <span>•</span>}
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5" />
                        {cls.student_count} Murid
                      </span>
                    </div>
                  </div>

                  {hasSubmitted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sudah Presensi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      Belum Presensi
                    </span>
                  )}
                </div>

                {/* Status summary counts if submitted */}
                {hasSubmitted ? (
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-xs font-semibold flex-wrap">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {cls.counts.hadir} H
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-amber-700 dark:text-amber-400">
                      {cls.counts.sakit} S
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-blue-700 dark:text-blue-400">
                      {cls.counts.izin} I
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-rose-700 dark:text-rose-400">
                      {cls.counts.alpa} A
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-purple-700 dark:text-purple-400">
                      {cls.counts.terlambat} T
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-amber-600 dark:text-amber-400">
                    Presensi hari ini belum diisi oleh wali kelas.
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => onSelectClass(cls.class_id)}
                  className={`
                    w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold font-plus-jakarta transition-all cursor-pointer
                    ${
                      hasSubmitted
                        ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                        : 'bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white shadow-sm'
                    }
                  `}
                >
                  <span>{hasSubmitted ? 'Lihat / Ubah' : 'Isi Presensi'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
