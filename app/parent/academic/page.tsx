"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParentAuth } from "@/hooks/useParentAuth";
import { ResponsiveContainer } from "@/components/ui-states";
import {
  getParentAcademicSummaryApi,
  getParentAcademicDetailApi,
  ParentAcademicSummary,
  ParentAcademicDetail,
} from "@/lib/api/parent";
import { ApiError } from "@/lib/api/client";
import { Loader2, AlertTriangle, LogOut, ChevronLeft, ChevronDown, BookOpen } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentAcademicPage() {
  const { token, logout, clearSession } = useParentAuth();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [summaryData, setSummaryData] = useState<ParentAcademicSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Lazy loading & Caching state
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [detailCache, setDetailCache] = useState<Record<string, ParentAcademicDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string | null>>({});

  const fetchSummary = useCallback(
    async (sessionToken: string) => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const response = await getParentAcademicSummaryApi(sessionToken);
        setSummaryData(response);
      } catch (err) {
        console.error("Failed to load academic summary:", err);
        if (err instanceof ApiError && err.code === "ERR_UNAUTHORIZED") {
          clearSession();
        } else {
          setSummaryError(UX_COPY.error.default);
        }
      } finally {
        setLoadingSummary(false);
      }
    },
    [clearSession]
  );

  useEffect(() => {
    if (token) {
      fetchSummary(token);
    }
  }, [token, fetchSummary]);

  const handleToggleSubject = async (subjectCode: string) => {
    const isCurrentlyExpanded = !!expandedSubjects[subjectCode];

    // Toggle expand state
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectCode]: !isCurrentlyExpanded,
    }));

    // If opening and not cached yet, fetch detail
    if (!isCurrentlyExpanded && !detailCache[subjectCode]) {
      if (!token) return;

      setLoadingDetails((prev) => ({ ...prev, [subjectCode]: true }));
      setDetailErrors((prev) => ({ ...prev, [subjectCode]: null }));

      try {
        const response = await getParentAcademicDetailApi(token, subjectCode);
        setDetailCache((prev) => ({ ...prev, [subjectCode]: response }));
      } catch (err) {
        console.error(`Failed to load academic detail for ${subjectCode}:`, err);
        setDetailErrors((prev) => ({
          ...prev,
          [subjectCode]: UX_COPY.error.default,
        }));
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [subjectCode]: false }));
      }
    }
  };

  if (loadingSummary && !summaryData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <div className="text-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-[#468432] mx-auto mb-4" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Memuat ringkasan akademik...
          </p>
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <ResponsiveContainer className="max-w-md px-4">
          <div className="bg-white dark:bg-[#171717] p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4 text-red-655 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold mb-2 text-zinc-900 dark:text-zinc-100">Terjadi Kesalahan</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{summaryError}</p>
            <button
              onClick={() => token && fetchSummary(token)}
              className="px-5 py-2.5 w-full bg-[#468432] hover:bg-[#3A6F2B] text-white text-sm font-semibold rounded-[12px] transition-colors cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </ResponsiveContainer>
      </div>
    );
  }

  const student = summaryData?.student;
  const period = summaryData?.period;
  const hasAcademicData =
    summaryData &&
    summaryData.subject_averages &&
    summaryData.subject_averages.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-50 animate-fadeIn">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-[#171717]/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center text-xs font-bold text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            id="back-to-dashboard-btn"
          >
            <ChevronLeft className="w-4 h-4 mr-1.5" />
            Kembali
          </Link>
          <span className="text-sm font-bold bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
            Nilai Akademik
          </span>
          <button
            onClick={() => setShowConfirmLogout(true)}
            className="inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#262626] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            id="logout-btn"
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            Keluar
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        {/* Child Information Header Card */}
        {student && (
          <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                Nama Siswa
              </span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {student.full_name}
              </h2>
              <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-0.5 font-data">NISN {student.nisn}</p>
            </div>
            {period && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-850">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Semester Aktif
                </span>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mt-0.5 truncate font-data">
                  {period.semester_name || ""} {period.academic_year_name || ""}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Academic Summary Card */}
        {summaryData && (
          <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Ringkasan nilai yang sudah tersedia
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-200/50 dark:border-zinc-800/20 p-4 rounded-[12px]">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Rata-rata Akademik
                </span>
                <span className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1 block font-data">
                  {summaryData.overall_average !== null
                    ? summaryData.overall_average.toFixed(1)
                    : "Belum ada nilai"}
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-200/50 dark:border-zinc-800/20 p-4 rounded-[12px]">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Total Evaluasi
                </span>
                <span className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1 block font-data">
                  {summaryData.completed_assessments} <span className="font-sans font-normal text-zinc-400 text-xs">dari</span> {summaryData.total_assessments}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Nilai akan muncul setelah dipublikasikan oleh guru mata pelajaran masing-masing.
            </p>
          </div>
        )}

        {/* Subject Cards Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Daftar Mata Pelajaran
          </h3>

          {!hasAcademicData ? (
            <div className="bg-white dark:bg-[#171717] p-8 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
              <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-550 dark:text-zinc-400">
                Belum ada data akademik yang tersedia.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {summaryData.subject_averages.map((subject) => {
                const isExpanded = !!expandedSubjects[subject.subject_code];
                const detail = detailCache[subject.subject_code];
                const loadingDetail = !!loadingDetails[subject.subject_code];
                const detailError = detailErrors[subject.subject_code];

                return (
                  <div
                    key={subject.subject_code}
                    className="bg-white dark:bg-[#171717] rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all duration-200"
                  >
                    {/* Subject Row Trigger */}
                    <button
                      onClick={() => handleToggleSubject(subject.subject_code)}
                      className="w-full text-left p-4.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-[#262626]/40 transition-colors cursor-pointer"
                      id={`subject-trigger-${subject.subject_code}`}
                    >
                      <div className="flex-1 pr-4">
                        <span className="text-[10px] uppercase font-bold text-[#468432] dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md font-data">
                          {subject.subject_code}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1.5">
                          {subject.subject_name}
                        </h4>
                        <span className="text-[10px] text-zinc-450 dark:text-zinc-550 mt-1 block font-data">
                          {subject.assessment_count} <span className="font-sans">Evaluasi</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-400 block">
                            Rata-rata
                          </span>
                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-50 block mt-0.5 font-data">
                            {subject.average_score !== null
                              ? subject.average_score.toFixed(1)
                              : "Belum ada nilai"}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                            isExpanded ? "transform rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Subject Details Panel */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/20 p-4 space-y-3">
                        {loadingDetail && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-3 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#468432]" />
                            Memuat detail nilai...
                          </p>
                        )}

                        {detailError && (
                          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-[12px] text-center">
                            <p className="text-xs text-red-655 dark:text-red-400">{detailError}</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSubject(subject.subject_code); // Collapse
                                setTimeout(() => handleToggleSubject(subject.subject_code), 50); // Fetch again
                              }}
                              className="text-[10px] font-bold text-red-600 dark:text-red-400 underline mt-1 block mx-auto cursor-pointer"
                            >
                              Coba lagi
                            </button>
                          </div>
                        )}

                        {!loadingDetail && !detailError && detail && (
                          <>
                            {detail.assessments.length === 0 ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4 text-center">
                                Belum ada evaluasi yang tersedia untuk mata pelajaran ini.
                              </p>
                            ) : (
                              <div className="space-y-2.5">
                                {detail.assessments.map((assessment, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white dark:bg-[#171717] p-4 rounded-[12px] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col space-y-2"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 pr-2">
                                        <h5 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                          {assessment.assessment_title}
                                        </h5>
                                        <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-0.5 font-data">
                                          Tanggal: {assessment.assessment_date}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-[#262626]/40 px-2.5 py-1 rounded-[12px] font-data">
                                          {assessment.score !== null
                                            ? assessment.score
                                            : "Belum tersedia"}
                                        </span>
                                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 font-data">
                                          Skala {assessment.score_min} - {assessment.score_max}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t border-zinc-100 dark:border-zinc-850 text-[10px]">
                                      <span className="text-zinc-450 dark:text-zinc-500">Status Publikasi</span>
                                      <span
                                        className={`font-semibold px-2 py-0.5 rounded-[12px] ${
                                          assessment.assessment_status === "locked"
                                            ? "text-amber-755 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20"
                                            : "text-[#3A6F2B] bg-emerald-50/10 dark:text-emerald-400 dark:bg-emerald-950/20"
                                        }`}
                                      >
                                        {assessment.assessment_status === "locked"
                                          ? "Terkunci (Final)"
                                          : "Dipublikasikan"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
