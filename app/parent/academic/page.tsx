"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { ResponsiveContainer } from "@/components/ui-states";
import {
  getParentAcademicSummaryApi,
  ParentAcademicSummary,
  ParentKKTPProgressItem,
} from "@/lib/api/parent";
import { ParentNavbar } from "@/components/parent/ParentNavbar";
import {
  Loader2,
  AlertTriangle,
  ChevronDown,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentAcademicPage() {
  const { token, clearSession } = useParentAuth();
  const [summaryData, setSummaryData] = useState<ParentAcademicSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Expanded states for subject KKTP accordions
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const fetchSummary = useCallback(
    async (sessionToken: string) => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const response = await getParentAcademicSummaryApi(sessionToken);
        setSummaryData(response);
        // By default expand the first subject if available
        if (response?.kktp_progress && response.kktp_progress.length > 0) {
          setExpandedSubjects({ [response.kktp_progress[0].subject_id]: true });
        }
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

  if (loadingSummary && !summaryData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <div className="text-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-[#468432] mx-auto mb-4" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Memuat capaian belajar akademik...
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
  const kktpProgress = summaryData?.kktp_progress || [];
  const hasKktpData = kktpProgress.length > 0;

  // Calculate overall metrics from normalized KKTP
  let totalTps = 0;
  let achievedTps = 0;
  let totalScoreSum = 0;
  let totalScoreCount = 0;

  for (const sub of kktpProgress) {
    totalTps += sub.total_tps;
    achievedTps += sub.achieved_tps;
    if (sub.average_score !== null && sub.average_score !== undefined) {
      totalScoreSum += Number(sub.average_score);
      totalScoreCount++;
    }
  }

  const kktpAverage = totalScoreCount > 0 ? (totalScoreSum / totalScoreCount).toFixed(1) : null;
  const kktpPercentage = totalTps > 0 ? Math.round((achievedTps / totalTps) * 100) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f4] dark:bg-[#0c0c0d] text-zinc-900 dark:text-zinc-50 animate-fadeIn pb-24 md:pb-12">
      {/* Unified Navigation Bar */}
      <ParentNavbar
        studentName={student?.full_name}
        studentClass={student?.class_name || undefined}
        nisn={student?.nisn}
        title="Capaian Belajar"
        showBack={true}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header & Period Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-fredoka text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Capaian Belajar & KKTP Ananda
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-plus-jakarta">
              {student?.full_name ? `${student.full_name} • ` : ""}
              {period?.semester_name || ""} {period?.academic_year_name || ""}
            </p>
          </div>

          {/* High-level status pills */}
          <div className="flex items-center gap-3">
            {kktpAverage !== null ? (
              <div className="bg-white dark:bg-zinc-900 px-3.5 py-1.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 text-xs">
                <span className="text-[10px] text-zinc-400 font-medium uppercase block">Rata-Rata</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-data text-sm">
                  {kktpAverage}
                </span>
              </div>
            ) : null}
            {kktpPercentage !== null ? (
              <div className="bg-white dark:bg-zinc-900 px-3.5 py-1.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 text-xs">
                <span className="text-[10px] text-zinc-400 font-medium uppercase block">Target Tercapai</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-data text-sm">
                  {kktpPercentage}%
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* KKTP Learning Objectives Detail Section */}
        {!hasKktpData ? (
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 shadow-xs text-center py-16">
            <BookOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Belum Ada Penilaian Akademik Semester Ini
            </p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto font-plus-jakarta">
              Capaian Tujuan Pembelajaran (KKTP) akan tampil di sini setelah evaluasi pembelajaran dicatat.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="font-medium font-plus-jakarta">
                Daftar Mata Pelajaran & Rincian Tujuan Pembelajaran ({kktpProgress.length} Mapel)
              </span>
              <span className="text-[11px] text-zinc-400">
                Klik mata pelajaran untuk melihat detail
              </span>
            </div>

            {kktpProgress.map((sub: ParentKKTPProgressItem) => {
              const isExpanded = !!expandedSubjects[sub.subject_id];
              const pct = sub.total_tps > 0 ? Math.round((sub.achieved_tps / sub.total_tps) * 100) : 0;

              return (
                <div
                  key={sub.subject_id}
                  className="border border-zinc-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  {/* Subject Trigger Header */}
                  <button
                    type="button"
                    onClick={() => toggleSubject(sub.subject_id)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 font-plus-jakarta">
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
                        {sub.achieved_tps} dari {sub.total_tps} Target Pembelajaran Tercapai ({pct}%)
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {sub.average_score !== null && (
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400 font-data">
                            {sub.average_score}
                          </span>
                          <span className="text-[10px] font-semibold block text-zinc-400">
                            Nilai Akhir
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

                  {/* Expanded KKTP Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-zinc-50/50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 space-y-4 animate-fadeIn">
                      {/* Individual TP list */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                          Rincian Capaian Tujuan Pembelajaran (KKTP)
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {sub.tps.map((tp) => (
                            <div
                              key={tp.id}
                              className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start justify-between gap-3 text-xs shadow-2xs"
                            >
                              <div className="space-y-1 flex-1 pr-1">
                                <p className="font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                                  {tp.title}
                                </p>
                                {tp.description && (
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-plus-jakarta">
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
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed italic font-plus-jakarta">
                              &ldquo;{sub.competency_description}&rdquo;
                            </p>
                          </div>
                        )}

                        {sub.catatan_tutor && (
                          <div className="p-3.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                              Catatan Guru / Wali Kelas:
                            </span>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-plus-jakarta">
                              &ldquo;{sub.catatan_tutor}&rdquo;
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
        )}
      </main>
    </div>
  );
}
