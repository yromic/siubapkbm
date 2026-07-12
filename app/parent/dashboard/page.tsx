"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParentAuth } from "@/hooks/useParentAuth";
import { ResponsiveContainer } from "@/components/ui-states";
import { getParentDashboardApi, ParentDashboardData } from "@/lib/api/parent";
import { ApiError } from "@/lib/api/client";
import SppBanner from "@/components/parent/SppBanner";
import { Loader2, AlertTriangle, LogOut, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentDashboard() {
  const { token, logout, clearSession } = useParentAuth();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
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
      if (err instanceof ApiError && err.code === "ERR_UNAUTHORIZED") {
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

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <div className="text-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-[#468432] mx-auto mb-4" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Memuat ringkasan anak...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <ResponsiveContainer className="max-w-md px-4">
          <div className="bg-white dark:bg-[#171717] p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4 text-red-650 dark:text-red-400">
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
  const academic = data?.academic_summary;
  const character = data?.character_summary;

  const showCompletenessWarning = character && character.days_counted < 10;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-50 animate-fadeIn">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-[#171717]/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-lg font-bold bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
            SIUBA PKBM
          </span>
          <button
            onClick={() => setShowConfirmLogout(true)}
            className="inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#262626] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            Keluar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        
        {/* SPP Payment Alert Banner */}
        <SppBanner />

        {/* Child Header Card */}
        {student && (
          <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Nama Siswa</span>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{student.full_name}</h2>
              <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-0.5 font-data">NISN {student.nisn}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Kelas</span>
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 block mt-0.5">
                  {student.class_name || "Belum terdaftar"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Semester</span>
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 block mt-0.5 text-ellipsis overflow-hidden whitespace-nowrap font-data">
                  {student.semester_name || student.academic_year_name ? (
                    `${student.semester_name || ""} ${student.academic_year_name || ""}`
                  ) : "-"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Academic Summary Card */}
        <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-850 pb-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Ringkasan Akademik</h3>
            <span className="text-[10px] font-semibold text-[#468432] dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
              Akademik
            </span>
          </div>
          
          {academic && (academic.total_assessments > 0 || academic.average_score !== null) ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Rata-rata Akademik</span>
                  <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-550 block mt-1 font-data">
                    {academic.average_score !== null ? academic.average_score : "-"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Penilaian</span>
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 block mt-1 font-data">
                    {academic.completed_assessments} <span className="font-sans font-normal text-zinc-400 text-xs">dari</span> {academic.total_assessments} <span className="font-sans font-normal text-zinc-400 text-xs">selesai</span>
                  </span>
                </div>
              </div>
              {academic.latest_assessment_date && (
                <div className="text-xs text-zinc-450 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 font-data">
                  Terakhir diperbarui: {academic.latest_assessment_date}
                </div>
              )}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Link
                  href="/parent/academic"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#468432] dark:text-emerald-400 hover:underline"
                >
                  Lihat Detail Akademik
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
                Belum ada data akademik yang tersedia.
              </p>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Link
                  href="/parent/academic"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#468432] dark:text-emerald-400 hover:underline"
                >
                  Lihat Detail Akademik
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Character Summary Card */}
        <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-850 pb-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Perkembangan Karakter</h3>
            <span className="text-[10px] font-semibold text-[#468432] dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
              Karakter
            </span>
          </div>

          {character && (character.days_counted > 0 || character.overall_average !== null) ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Rata-rata FITRAH</span>
                  <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-550 block mt-1 font-data">
                    {character.overall_average !== null ? character.overall_average : "-"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Hari Input</span>
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 block mt-1 font-data">
                    {character.days_counted} <span className="font-sans font-normal text-zinc-400 text-xs">hari aktif</span>
                  </span>
                </div>
              </div>

              {/* Mini FITRAH aspect indicators */}
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Detail Aspek FITRAH</span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {[
                    { label: "Fathonah", val: character.f },
                    { label: "Istiqamah", val: character.i },
                    { label: "Tanggung Jawab", val: character.t },
                    { label: "Ramah", val: character.r },
                    { label: "Amanah", val: character.a },
                    { label: "Harmonis", val: character.h },
                  ].map((aspect) => (
                    <div key={aspect.label} className="flex justify-between items-center bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/20 px-3 py-2 rounded-[12px] text-xs">
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">{aspect.label}</span>
                      <span className="font-bold text-zinc-950 dark:text-zinc-50 font-data">{aspect.val !== null ? aspect.val : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-zinc-400 dark:text-zinc-500">
                Berdasarkan data input budaya pada {character.period_label || "semester ini"}.
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Link
                  href="/parent/character"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#468432] dark:text-emerald-400 hover:underline"
                >
                  Lihat Detail Karakter
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
              Belum ada data karakter yang tersedia.
            </p>
          )}
        </div>

        {/* Data Completeness Notice */}
        {showCompletenessWarning && (
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4 rounded-[20px] text-xs text-amber-800 dark:text-amber-350 leading-relaxed">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              Data karakter pada periode ini masih terbatas sehingga ringkasan perlu dibaca dengan hati-hati.
            </p>
          </div>
        )}

        {/* Future Navigation Placeholder */}
        <div className="bg-zinc-100/50 dark:bg-[#171717]/30 border border-zinc-200/50 dark:border-zinc-800/40 p-4 rounded-[12px] text-center">
          <p className="text-xs text-zinc-450 dark:text-zinc-500 leading-relaxed">
            Informasi lengkap mengenai perkembangan belajar dan analisis karakter terperinci akan tersedia di menu laporan selanjutnya.
          </p>
        </div>

      </main>

      <ConfirmDialog
        open={showConfirmLogout}
        onOpenChange={setShowConfirmLogout}
        title="Keluar dari Portal?"
        description="Apakah Anda yakin ingin keluar dari portal monitoring wali murid?"
        confirmLabel="Ya, Keluar"
        variant="destructive"
        onConfirm={logout}
      />
    </div>
  );
}
