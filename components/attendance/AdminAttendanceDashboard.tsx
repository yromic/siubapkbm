'use client';

import React from 'react';
import { StudentAttendanceDashboardOverview } from '@/types/studentAttendance';
import {
  CheckCircle2,
  Clock,
  Users,
  School,
  Percent,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { EmptyState } from '@/components/ui-states';

interface AdminAttendanceDashboardProps {
  data: StudentAttendanceDashboardOverview;
  onSelectClass: (classId: string) => void;
}

export function AdminAttendanceDashboard({
  data,
  onSelectClass,
}: AdminAttendanceDashboardProps) {
  const { overview, classes, semester, academic_year } = data;

  return (
    <div className="space-y-6">
      {/* 1. Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total & Submitted Classes */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-plus-jakarta">
              Status Kelas
            </span>
            <School className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold font-plus-jakarta text-zinc-900 dark:text-zinc-100">
              {overview.submitted_classes}
            </span>
            <span className="text-xs md:text-sm font-medium text-zinc-500">
              / {overview.total_classes} Kelas
            </span>
          </div>
          <div className="mt-2 text-xs flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {overview.submitted_classes} Sudah
            </span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">
              {overview.unsubmitted_classes} Belum
            </span>
          </div>
        </div>

        {/* Total Students Recorded */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-plus-jakarta">
              Murid Terdata
            </span>
            <Users className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold font-plus-jakarta text-zinc-900 dark:text-zinc-100">
              {overview.total_students_recorded}
            </span>
            <span className="text-xs md:text-sm font-medium text-zinc-500">
              Murid
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Dari {overview.submitted_classes} kelas yang telah presensi
          </p>
        </div>

        {/* Attendance Rate */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-plus-jakarta">
              Tingkat Kehadiran
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold font-plus-jakarta text-emerald-600 dark:text-emerald-400">
              {overview.attendance_rate}%
            </span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
            (Hadir + Terlambat) dari {overview.submitted_classes} kelas presensi
          </p>
        </div>

        {/* Breakdown Chips */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 font-plus-jakarta">
            Total Status (H / S / I / A / T)
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-lg">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {overview.counts.hadir}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">H</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {overview.counts.sakit}
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400">S</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded-lg">
              <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                {overview.counts.izin}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400">I</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-lg">
              <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                {overview.counts.alpa}
              </div>
              <div className="text-[10px] text-rose-600 dark:text-rose-400">A</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/40 p-1.5 rounded-lg">
              <div className="text-xs font-bold text-purple-700 dark:text-purple-300">
                {overview.counts.terlambat}
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400">T</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. School-wide Class Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100">
              Daftar Presensi Semua Kelas
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tahun Ajaran {academic_year.name} • Semester {semester.name}
            </p>
          </div>
        </div>

        {classes.length === 0 ? (
          <EmptyState
            title="Tidak Ada Kelas"
            description="Tidak ada kelas aktif yang terdaftar dalam sistem."
          />
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {classes.map((cls) => {
              const hasSubmitted = cls.has_submitted;

              return (
                <div
                  key={cls.class_id}
                  onClick={() => onSelectClass(cls.class_id)}
                  className="p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-700 dark:text-zinc-300 shrink-0">
                      {cls.class_name}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm font-plus-jakarta text-zinc-900 dark:text-zinc-100">
                          Kelas {cls.class_name}
                        </h4>
                        {cls.level && (
                          <span className="text-xs text-zinc-400 font-normal">
                            (Tingkat {cls.level})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Wali Kelas:{' '}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {cls.wali_kelas_name || 'Belum ditugaskan'}
                        </span>{' '}
                        • {cls.student_count} Murid
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    {/* Submission status & counts */}
                    {hasSubmitted ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {cls.counts.hadir} H
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {cls.counts.sakit} S
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="text-blue-600 dark:text-blue-400">
                            {cls.counts.izin} I
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="text-rose-600 dark:text-rose-400">
                            {cls.counts.alpa} A
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="text-purple-600 dark:text-purple-400">
                            {cls.counts.terlambat} T
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Sudah Presensi
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        Belum Presensi
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectClass(cls.class_id)}
                      className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors shrink-0"
                      title="Buka Lembar Presensi Kelas"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
