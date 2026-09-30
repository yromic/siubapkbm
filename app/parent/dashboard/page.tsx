"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParentAuth } from "@/hooks/useParentAuth";
import { ResponsiveContainer } from "@/components/ui-states";
import { getParentDashboardApi, ParentDashboardData } from "@/lib/api/parent";
import { UtsmanRadarChart } from "@/components/character/utsman-radar-chart";
import { UtsmanSummaryRecord } from "@/lib/api/character";
import SppBanner from "@/components/parent/SppBanner";
import { ParentNavbar } from "@/components/parent/ParentNavbar";
import {
  Loader2,
  AlertTriangle,
  ChevronRight,
  Calendar,
  BookOpen,
  Sparkles,
  Award,
  ArrowRight,
  Clock,
} from "lucide-react";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentDashboard() {
  const { token, clearSession } = useParentAuth();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (sessionToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const dashboardData = await getParentDashboardApi(sessionToken);
      setData(dashboardData);
    } catch (err) {
      console.error("Failed to load parent dashboard data:", err);
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_UNAUTHORIZED") {
        clearSession();
      } else {
        setError(UX_COPY.error.default);
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    if (token) {
      const timer = setTimeout(() => {
        fetchDashboard(token);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, fetchDashboard]);

  // Construct utsman record for the radar chart
  const utsmanRecord: UtsmanSummaryRecord | null = useMemo(() => {
    if (!data?.character_summary) return null;
    const c = data.character_summary;
    return {
      student_id: data.student?.id || "",
      semester_id: "",
      u_score: c.u,
      t_score: c.t,
      s_score: c.s,
      m_score: c.m,
      a_score: c.a,
      n_score: c.n,
    };
  }, [data]);

  // Overall KKTP summary metrics
  const overallKktp = useMemo(() => {
    const list = data?.kktp_progress || [];
    let total = 0;
    let achieved = 0;
    for (const item of list) {
      total += item.total_tps;
      achieved += item.achieved_tps;
    }
    const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;
    return { total, achieved, pct, subjectCount: list.length };
  }, [data?.kktp_progress]);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <div className="text-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-[#468432] mx-auto mb-4" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Memuat ringkasan ananda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <ResponsiveContainer className="max-w-md px-4">
          <div className="bg-white dark:bg-[#171717] p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold mb-2 text-zinc-900 dark:text-zinc-100">Terjadi Kesalahan</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error}</p>
            <button
              onClick={() => token && fetchDashboard(token)}
              className="px-5 py-2.5 w-full bg-[#468432] hover:bg-[#3A6F2B] text-white text-sm font-semibold rounded-[12px] transition-colors cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </ResponsiveContainer>
      </div>
    );
  }

  const student = data?.student;
  const attendance = data?.student_attendance;
  const character = data?.character_summary;
  const kktpProgress = data?.kktp_progress || [];

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f4] dark:bg-[#0c0c0d] text-zinc-900 dark:text-zinc-50 animate-fadeIn pb-24 md:pb-12">
      {/* Unified Navigation Bar */}
      <ParentNavbar
        studentName={student?.full_name}
        studentClass={student?.class_name || undefined}
        nisn={student?.nisn}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Calm Welcome Header with Context & High-level Status */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50">
                Ahlan wa Sahlan, Ayah/Bunda
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-plus-jakarta">
                {student?.full_name ? <span className="font-bold text-zinc-800 dark:text-zinc-200">{student.full_name}</span> : ""}
                {student?.class_name ? ` • Kelas ${student.class_name}` : ""}
                {student?.semester_name || student?.academic_year_name
                  ? ` • ${student.semester_name || ""} ${student.academic_year_name || ""}`
                  : ""}
              </p>
            </div>

            {/* High-level status cards (Kehadiran, Akademik, Karakter) */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
              <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Kehadiran</span>
                <span className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-zinc-100 block mt-0.5 font-data">
                  {attendance?.attendance_rate !== null && attendance?.attendance_rate !== undefined
                    ? `${attendance.attendance_rate}%`
                    : "Belum ada"}
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Capaian KKTP</span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-data">
                  {overallKktp.total > 0 ? `${overallKktp.pct}%` : "Belum dinilai"}
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Karakter</span>
                <span className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-zinc-100 block mt-0.5 font-data">
                  {character?.overall_average !== null && character?.overall_average !== undefined
                    ? Number(character.overall_average).toFixed(2)
                    : "Belum dinilai"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SPP Alert Banner (Consolidated - Single Smart Alert) */}
        <SppBanner />

        {/* 3. Responsive 2-Column Grid Layout on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── LEFT COLUMN (lg:col-span-5) ─── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Attendance Summary */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-fredoka flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Presensi Semester Ini
                </h3>
              </div>

              {attendance && attendance.total_days > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 font-fredoka">
                        {attendance.attendance_rate !== null ? `${attendance.attendance_rate}%` : "-"}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2 font-plus-jakarta">
                        ({attendance.hadir + attendance.terlambat} dari {attendance.total_days} hari hadir)
                      </span>
                    </div>
                  </div>

                  {/* Status Breakdown Chips */}
                  <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">Hadir</span>
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200 block mt-0.5 font-data">
                        {attendance.hadir}
                      </span>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block">Telat</span>
                      <span className="text-sm font-bold text-blue-800 dark:text-blue-200 block mt-0.5 font-data">
                        {attendance.terlambat}
                      </span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block">Sakit</span>
                      <span className="text-sm font-bold text-amber-800 dark:text-amber-200 block mt-0.5 font-data">
                        {attendance.sakit}
                      </span>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 block">Izin</span>
                      <span className="text-sm font-bold text-purple-800 dark:text-purple-200 block mt-0.5 font-data">
                        {attendance.izin}
                      </span>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">Alpa</span>
                      <span className="text-sm font-bold text-rose-800 dark:text-rose-200 block mt-0.5 font-data">
                        {attendance.alpa}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Clock className="w-7 h-7 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Belum Ada Rekap Presensi</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-plus-jakarta">
                    Data kehadiran belum tersedia untuk semester ini.
                  </p>
                </div>
              )}
            </div>

            {/* Character (UTSMAN) Summary Visual */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-fredoka flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Profil Karakter UTSMAN
                </h3>
                <Link
                  href="/parent/character"
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  Rincian 6 Dimensi
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {utsmanRecord ? (
                <div className="flex flex-col items-center">
                  <div className="w-full flex items-center justify-center p-2 bg-zinc-50/60 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <UtsmanRadarChart data={utsmanRecord} />
                  </div>
                  <Link
                    href="/parent/character"
                    className="mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 inline-flex items-center gap-1 font-plus-jakarta"
                  >
                    <span>Lihat analisis keunggulan & penguatan karakter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-zinc-400 italic">Belum ada evaluasi karakter pada semester ini.</p>
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT COLUMN (lg:col-span-7) ─── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Academic Snapshot (KKTP) — Clean summary, NO deep accordions */}
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-fredoka flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Ringkasan Capaian Belajar (KKTP)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-plus-jakarta">
                    Progres penguasaan target pembelajaran per mata pelajaran.
                  </p>
                </div>
                <Link
                  href="/parent/academic"
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  Buku Nilai Lengkap
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {kktpProgress.length > 0 ? (
                <div className="space-y-3">
                  {kktpProgress.map((sub) => {
                    const pct = sub.total_tps > 0 ? Math.round((sub.achieved_tps / sub.total_tps) * 100) : 0;
                    return (
                      <div
                        key={sub.subject_id}
                        className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 font-plus-jakarta">
                              {sub.subject_name}
                            </span>
                            {sub.predicate && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Predikat {sub.predicate}
                              </span>
                            )}
                          </div>
                          {sub.average_score !== null && (
                            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-data">
                              {sub.average_score}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-500 font-plus-jakarta">
                            <span>{sub.achieved_tps} dari {sub.total_tps} target tercapai</span>
                            <span className="font-semibold font-data">{pct}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-2 text-center">
                    <Link
                      href="/parent/academic"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-colors w-full sm:w-auto"
                    >
                      <span>Lihat Rincian Seluruh Tujuan Pembelajaran & Catatan Guru</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <BookOpen className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Belum Ada Penilaian Akademik</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm mx-auto font-plus-jakarta">
                    Capaian Tujuan Pembelajaran (KKTP) belum diterbitkan untuk semester ini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
