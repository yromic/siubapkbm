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
import { ParentNavbar } from "@/components/parent/ParentNavbar";
import {
  Loader2,
  AlertTriangle,
  ChevronDown,
  BookOpen,
  Calendar,
  Award,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentAcademicPage() {
  const { token, clearSession } = useParentAuth();
  const [summaryData, setSummaryData] = useState<ParentAcademicSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Expanded states and cache for subject details
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
        console.error("Failed to load academic summary data:", err);
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_UNAUTHORIZED") {
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
      const timer = setTimeout(() => {
        fetchSummary(token);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, fetchSummary]);

  const handleToggleSubject = async (subjectCode: string) => {
    const isCurrentlyExpanded = !!expandedSubjects[subjectCode];

    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectCode]: !isCurrentlyExpanded,
    }));

    // If expanding and not in cache, fetch detail
    if (!isCurrentlyExpanded && !detailCache[subjectCode] && token) {
      setLoadingDetails((prev) => ({ ...prev, [subjectCode]: true }));
      setDetailErrors((prev) => ({ ...prev, [subjectCode]: null }));

      try {
        const detail = await getParentAcademicDetailApi(token, subjectCode);
        setDetailCache((prev) => ({ ...prev, [subjectCode]: detail }));
      } catch (err: unknown) {
        console.error(`Failed to load academic details for subject ${subjectCode}:`, err);
        setDetailErrors((prev) => ({
          ...prev,
          [subjectCode]: "Gagal memuat detail nilai.",
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
            Memuat buku nilai akademik...
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
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
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
  const hasAcademicData = summaryData && summaryData.subject_averages && summaryData.subject_averages.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f4] dark:bg-[#0c0c0d] text-zinc-900 dark:text-zinc-50 animate-fadeIn pb-24 md:pb-12">
      {/* Unified Desktop & Mobile Navigation Bar */}
      <ParentNavbar
        studentName={student?.full_name}
        nisn={student?.nisn}
        title="Nilai Akademik"
        showBack={true}
      />

      {/* Main Container — Responsive Desktop Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* 2-Column Responsive Desktop Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ─── LEFT COLUMN (lg:col-span-4) ─── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Child Information Header Card */}
            {student && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Santri / Murid
                    </span>
                    <h2 className="text-lg font-bold font-fredoka text-zinc-900 dark:text-zinc-100 mt-1">
                      {student.full_name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5 font-data">NISN: {student.nisn}</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 flex items-center justify-center font-bold text-base font-fredoka border border-emerald-200 dark:border-emerald-800 shadow-xs shrink-0">
                    {student.full_name?.charAt(0) || "S"}
                  </div>
                </div>

                {period && (
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                      Semester Aktif
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mt-0.5 truncate font-data">
                      {period.semester_name || ""} {period.academic_year_name || ""}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Academic Summary Metrics Card */}
            {summaryData && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Ringkasan Nilai Terbit
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                      Rata-Rata
                    </span>
                    <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 block font-data">
                      {typeof summaryData.overall_average === "number" && !isNaN(summaryData.overall_average)
                        ? summaryData.overall_average.toFixed(1)
                        : "-"}
                    </span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                      Evaluasi Terbit
                    </span>
                    <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1 block font-data">
                      {summaryData.completed_assessments ?? 0}{" "}
                      <span className="font-sans font-normal text-zinc-400 text-xs">dari {summaryData.total_assessments ?? 0}</span>
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-plus-jakarta">
                  Nilai diperbarui secara langsung saat tutor mata pelajaran menyelesaikan penilaian di kelas.
                </p>
              </div>
            )}

            {/* Quick Guide */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 text-xs text-emerald-900 dark:text-emerald-300 space-y-1.5 font-plus-jakarta">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Prinsip Kurikulum Merdeka</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Penilaian difokuskan pada ketercapaian Tujuan Pembelajaran (KKTP) dan deskripsi kompetensi, bukan semata pemeringkatan ranking.
              </p>
            </div>

          </div>

          {/* ─── RIGHT COLUMN (lg:col-span-8) ─── */}
          <div className="lg:col-span-8 space-y-5">

            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-fredoka flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Daftar Mata Pelajaran Santri
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Klik pada mata pelajaran untuk melihat rincian asesmen dan catatan kompetensi.
                </p>
              </div>
              <span className="text-xs font-bold text-zinc-500 font-data">
                {summaryData?.subject_averages?.length || 0} Mapel
              </span>
            </div>

            {!hasAcademicData ? (
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 shadow-xs text-center py-12">
                <BookOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Belum Ada Data Akademik yang Tersedia
                </p>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Nilai akan tampil setelah guru memasukkan evaluasi mata pelajaran pada semester ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {summaryData.subject_averages.map((subject: ParentAcademicSummary["subject_averages"][number]) => {
                  const isExpanded = !!expandedSubjects[subject.subject_code];
                  const detail = detailCache[subject.subject_code];
                  const loadingDetail = !!loadingDetails[subject.subject_code];
                  const detailError = detailErrors[subject.subject_code];

                  return (
                    <div
                      key={subject.subject_code}
                      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs overflow-hidden transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700"
                    >
                      {/* Subject Row Trigger */}
                      <button
                        onClick={() => handleToggleSubject(subject.subject_code)}
                        className="w-full text-left p-4.5 flex items-center justify-between hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                        id={`subject-trigger-${subject.subject_code}`}
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md font-data">
                              {subject.subject_code}
                            </span>
                            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                              {subject.subject_name}
                            </h4>
                          </div>
                          <span className="text-[11px] text-zinc-450 dark:text-zinc-500 mt-1 block font-data">
                            {subject.assessment_count} <span className="font-sans">Evaluasi Terbit</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">
                              Rata-Rata
                            </span>
                            <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 block mt-0.5 font-data">
                              {typeof subject.average_score === "number" && !isNaN(subject.average_score)
                                ? subject.average_score.toFixed(1)
                                : "Belum dinilai"}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? "transform rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </button>

                      {/* Subject Details Panel — Desktop Multi-Column */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 p-4.5 space-y-4 animate-fadeIn">
                          {loadingDetail && (
                            <p className="text-xs text-zinc-500 py-3 flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                              Memuat rincian evaluasi...
                            </p>
                          )}

                          {detailError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-center">
                              <p className="text-xs text-red-600 dark:text-red-400">{detailError}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSubject(subject.subject_code);
                                  setTimeout(() => handleToggleSubject(subject.subject_code), 50);
                                }}
                                className="text-[10px] font-bold text-red-600 dark:text-red-400 underline mt-1 block mx-auto cursor-pointer"
                              >
                                Coba lagi
                              </button>
                            </div>
                          )}

                          {detail && (
                            <div className="space-y-4">
                              {/* Desktop Grid of Assessments */}
                              {detail.assessments && detail.assessments.length > 0 ? (
                                <div className="space-y-2">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                                    Daftar Nilai Asesmen
                                  </span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {detail.assessments.map((ass: ParentAcademicDetail["assessments"][number], i: number) => (
                                      <div
                                        key={i}
                                        className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs shadow-2xs"
                                      >
                                        <div className="space-y-0.5 pr-2">
                                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{ass.assessment_title}</p>
                                          {ass.assessment_date && (
                                            <p className="text-[10px] text-zinc-400 font-data">{ass.assessment_date}</p>
                                          )}
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-data">
                                            {ass.score !== null ? ass.score : "-"}
                                          </span>
                                          {ass.assessment_status && (
                                            <span className="block text-[10px] text-zinc-400 uppercase">
                                              {ass.assessment_status}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-400 italic">Belum ada rincian asesmen pada mata pelajaran ini.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </main>
    </div>
  );
}
