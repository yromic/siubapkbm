"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParentAuth } from "@/hooks/useParentAuth";
import { ResponsiveContainer } from "@/components/ui-states";
import { getParentDashboardApi, ParentDashboardData, ParentKKTPProgressItem } from "@/lib/api/parent";
import { UtsmanRadarChart } from "@/components/character/utsman-radar-chart";
import { UtsmanSummaryRecord } from "@/lib/api/character";
import SppBanner from "@/components/parent/SppBanner";
import { ParentNavbar } from "@/components/parent/ParentNavbar";
import {
  Loader2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Calendar,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Sparkles,
  Award,
  CreditCard,
  User,
  ArrowRight,
  Clock,
} from "lucide-react";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentDashboard() {
  const { token, clearSession } = useParentAuth();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded subject cards in KKTP section
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

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
      fetchDashboard(token);
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
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Memuat ringkasan santri...</p>
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
      {/* Unified Desktop & Mobile Navigation Bar */}
      <ParentNavbar
        studentName={student?.full_name}
        studentClass={student?.class_name || undefined}
        nisn={student?.nisn}
      />

      {/* Main Container — Expanded for Desktop/Windows Screen */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* 1. Desktop Welcome & Executive Summary Banner */}
        <section className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden border border-emerald-700/40">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 text-[11px] font-bold tracking-wider uppercase border border-emerald-600/50">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>Portal Pemantauan Terpadu Santri</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-fredoka tracking-tight text-white">
                Ahlan wa Sahlan, Ayah/Bunda {student?.full_name?.split(" ")[0]}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-plus-jakarta">
                Pantau perkembangan capaian kompetensi Kurikulum Merdeka, pembiasaan 6 karakter UTSMAN, dan rekapitulasi kehadiran ananda secara langsung.
              </p>
            </div>

            {/* Quick KPI summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Kelas</span>
                <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5 font-fredoka">
                  {student?.class_name ? `Kelas ${student.class_name}` : "-"}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Kehadiran</span>
                <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5 font-data">
                  {attendance?.attendance_rate !== null && attendance?.attendance_rate !== undefined
                    ? `${attendance.attendance_rate}%`
                    : "-"}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Capaian KKTP</span>
                <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5 font-data">
                  {overallKktp.pct}%
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Mapel Dinilai</span>
                <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5 font-data">
                  {overallKktp.subjectCount} <span className="text-xs font-normal text-emerald-200">Mapel</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Responsive 2-Column Grid Layout on Desktop (4 cols Left, 8 cols Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ─── LEFT COLUMN (lg:col-span-4) ─── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Child Profile Card */}
            {student && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Identitas Santri
                    </span>
                    <h2 className="text-lg font-bold font-fredoka text-zinc-900 dark:text-zinc-100 mt-1">
                      {student.full_name}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-data">
                      NISN: {student.nisn}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 flex items-center justify-center font-bold text-lg font-fredoka border border-emerald-200 dark:border-emerald-800 shadow-xs shrink-0">
                    {student.full_name?.charAt(0) || "S"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                      Rombel / Kelas
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mt-0.5">
                      {student.class_name ? `Kelas ${student.class_name}` : "Belum terdaftar"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                      Semester Aktif
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mt-0.5 font-data">
                      {student.semester_name || student.academic_year_name
                        ? `${student.semester_name || ""} ${student.academic_year_name || ""}`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SPP Payment Alert & Summary */}
            <div className="space-y-2">
              <SppBanner />
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold">Keuangan & Pembayaran SPP</p>
                    <p className="text-[11px] text-zinc-500">Cek rekap riwayat setor & kwitansi bulanan</p>
                  </div>
                </div>
                <Link
                  href="/parent/spp"
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold text-zinc-800 dark:text-zinc-200 transition-colors shrink-0"
                >
                  Detail
                </Link>
              </div>
            </div>

            {/* Attendance (Presensi Siswa) */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-fredoka flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Presensi Semester Ini
                </h3>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  Presensi
                </span>
              </div>

              {attendance && attendance.total_days > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                        Tingkat Kehadiran
                      </span>
                      <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 block mt-0.5 font-fredoka">
                        {attendance.attendance_rate !== null ? `${attendance.attendance_rate}%` : "-"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                        Total Pertemuan
                      </span>
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 block mt-0.5 font-data">
                        {attendance.total_days} <span className="font-normal text-zinc-400 text-xs">hari</span>
                      </span>
                    </div>
                  </div>

                  {/* Attendance Breakdown Chips */}
                  <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
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
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Data kehadiran akan tampil setelah wali kelas memproses presensi harian.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Navigation Links */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-2.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Pintasan Laporan Lengkap
              </span>
              <Link
                href="/parent/academic"
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors border border-zinc-200/60 dark:border-zinc-700/60"
              >
                <span className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Lihat Buku Nilai Akademik Lengkap
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </Link>
              <Link
                href="/parent/character"
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors border border-zinc-200/60 dark:border-zinc-700/60"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Rincian 6 Dimensi UTSMAN & 7 Budaya
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </Link>
            </div>

          </div>

          {/* ─── RIGHT COLUMN (lg:col-span-8) ─── */}
          <div className="lg:col-span-8 space-y-6">

            {/* 1. Radar Karakter UTSMAN & 7 Budaya (Desktop Split-View) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-fredoka flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Profil Karakter & Pembiasaan Budaya (Radar UTSMAN)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-plus-jakarta">
                    Pemantauan 6 dimensi karakter utama dan 7 indikator pembiasaan budaya santri.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full shrink-0">
                  Radar Karakter
                </span>
              </div>

              {/* Split View on Desktop: Chart on Left (md:col-span-5), 6 Dimensi on Right (md:col-span-7) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Radar Chart */}
                <div className="md:col-span-5 bg-zinc-50/60 dark:bg-zinc-950/50 rounded-2xl p-2.5 border border-zinc-100 dark:border-zinc-800/80 flex items-center justify-center">
                  <UtsmanRadarChart data={utsmanRecord} />
                </div>

                {/* 6 Dimensions Badges & Progress */}
                <div className="md:col-span-7 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                    Skor Dimensi Karakter (Skala 0 – 100)
                  </span>
                  {character ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { code: "U", label: "Ulet & Unggul", val: character.u, desc: "Ketekunan & motivasi berprestasi" },
                        { code: "T", label: "Ta'at & Tangguh", val: character.t, desc: "Kepatuhan ibadah & daya juang" },
                        { code: "S", label: "Santun & Empati", val: character.s, desc: "Akhlak mulia & kepedulian sesama" },
                        { code: "M", label: "Mandiri & Rapi", val: character.m, desc: "Kemandirian belajar & kerapian diri" },
                        { code: "A", label: "Amanah & Jujur", val: character.a, desc: "Integritas & tanggung jawab tugas" },
                        { code: "N", label: "Nalar & Inisiatif", val: character.n, desc: "Berpikir kritis & inisiatif aktif" },
                      ].map((dim) => (
                        <div
                          key={dim.code}
                          className="bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 rounded-xl space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{dim.label}</span>
                            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 font-data">
                              {dim.val !== null && dim.val !== undefined ? Number(dim.val).toFixed(1) : "-"}
                            </span>
                          </div>
                          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, Number(dim.val) || 0))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Belum ada evaluasi karakter pada semester ini.</p>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Link
                      href="/parent/character"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 group"
                    >
                      <span>Lihat Rincian Penilaian Harian Karakter</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Capaian Tujuan Pembelajaran (KKTP Kurikulum Merdeka) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-fredoka flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Capaian Tujuan Pembelajaran (KKTP)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-plus-jakarta">
                    Ketercapaian kompetensi riil Kurikulum Merdeka per mata pelajaran santri.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full shrink-0">
                    Kurikulum Merdeka
                  </span>
                  <Link
                    href="/parent/academic"
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline hidden sm:inline-flex items-center gap-1"
                  >
                    Buku Nilai
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {kktpProgress.length > 0 ? (
                <div className="space-y-3.5">
                  {kktpProgress.map((sub) => {
                    const isExpanded = !!expandedSubjects[sub.subject_id];
                    const pct = sub.total_tps > 0 ? Math.round((sub.achieved_tps / sub.total_tps) * 100) : 0;

                    return (
                      <div
                        key={sub.subject_id}
                        className="border border-zinc-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900/60 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                      >
                        {/* Header Bar */}
                        <button
                          type="button"
                          onClick={() => toggleSubject(sub.subject_id)}
                          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                        >
                          <div className="space-y-1.5 flex-1 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-plus-jakarta">
                                {sub.subject_name}
                              </span>
                              {sub.fase && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                  {sub.fase}
                                </span>
                              )}
                              {sub.predicate && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Predikat {sub.predicate}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {sub.achieved_tps} dari {sub.total_tps} Tujuan Pembelajaran Tercapai ({pct}%)
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {sub.average_score !== null && (
                              <div className="text-right">
                                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-data">
                                  {sub.average_score}
                                </span>
                                <span className="text-[10px] font-semibold block text-zinc-400">
                                  Rata-rata
                                </span>
                              </div>
                            )}
                            <div className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </div>
                        </button>

                        {/* Progress bar */}
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {/* Expanded details — Desktop 2-Column Grid */}
                        {isExpanded && (
                          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 space-y-4 animate-fadeIn">
                            {/* 2-Column TP list on desktop */}
                            <div className="space-y-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                                Rincian Capaian per Tujuan Pembelajaran
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {sub.tps.map((tp) => (
                                  <div
                                    key={tp.id}
                                    className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start justify-between gap-3 text-xs shadow-2xs"
                                  >
                                    <div className="space-y-1 flex-1 pr-1">
                                      <p className="font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                                        {tp.title}
                                      </p>
                                      {tp.description && (
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                          {tp.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                      {tp.is_achieved === true ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                          <CheckCircle2 className="w-3 h-3" /> Tercapai
                                        </span>
                                      ) : tp.is_achieved === false ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                          <AlertCircle className="w-3 h-3" /> Perlu Bimbingan
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium text-zinc-400 px-2 py-0.5">
                                          Belum Dinilai
                                        </span>
                                      )}
                                      {tp.score !== null && (
                                        <span className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 font-data mt-0.5">
                                          Nilai: {tp.score}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Competency & Tutor Notes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {sub.competency_description && (
                                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-xs">
                                  <span className="font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                                    Deskripsi Capaian Kompetensi:
                                  </span>
                                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed italic">
                                    "{sub.competency_description}"
                                  </p>
                                </div>
                              )}

                              {sub.catatan_tutor && (
                                <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                                    Catatan Guru / Tutor:
                                  </span>
                                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                                    "{sub.catatan_tutor}"
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <BookOpen className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Belum Ada Asesmen KKTP Terbit</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm mx-auto">
                    Capaian Tujuan Pembelajaran (TP) akan otomatis tampil di sini saat tutor mata pelajaran memasukkan nilai di kelas.
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
