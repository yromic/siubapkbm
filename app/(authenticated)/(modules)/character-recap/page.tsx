"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  ResponsiveContainer,
} from "@/components/ui-states";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import {
  getClassCharacterSummary,
  getStudentWatchlist,
  getStudentCharacterSummary,
  StudentCharacterSummary,
  WatchlistStudent,
  IndividualCharacterSummary,
} from "@/lib/api/character";
import { FitrahRadarChart } from "@/components/character/fitrah-radar-chart";
import { StudentGrowth } from "@/components/character/student-growth";
import {
  CharacterPeriodFilter,
  CharacterPeriodMode,
  INDONESIAN_MONTHS,
  getLocalDateString,
  getMondayOfDate,
  getWeekRangeString,
  isFutureWeek,
  isFutureMonth,
  getPeriodParams,
} from "@/lib/utils/character-period";

interface FitrahConfig {
  code: "F" | "I" | "T" | "R" | "A" | "H";
  name: string;
  description: string;
  indicators: string[];
}

const FITRAH_DIMENSIONS: FitrahConfig[] = [
  { code: "F", name: "Fathonah", description: "Bernalar Kritis & Literat", indicators: ["Aku Suka Membaca (ASM)"] },
  { code: "I", name: "Istiqamah", description: "Teguh dalam Ibadah", indicators: ["Asyik Mengaji (AM)"] },
  { code: "T", name: "Tanggung Jawab", description: "Mandiri & Disiplin", indicators: ["Bersih & Rapi (BR)"] },
  { code: "R", name: "Ramah", description: "Tawadhu, Santun & Adab Kepatuhan", indicators: ["Senyum, Sapa, Salam (SSS)", "Hormat & Berbakti (HB)"] },
  { code: "A", name: "Amanah", description: "Jujur Berkarya Sesuai Syariat", indicators: ["Aktif Berkarya (AK)"] },
  { code: "H", name: "Harmonis", description: "Empati & Peduli Sosial", indicators: ["Tolong Menolong (TM)"] },
];

export default function CharacterRecapPage() {
  const { token, user } = useAuth();
  const { activeAcademicYear, activeSemester } = useSettings();

  // Selection states
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [periodFilter, setPeriodFilter] = useState<CharacterPeriodFilter>(() => {
    const today = new Date();
    const monday = getMondayOfDate(today);
    return {
      mode: "semester",
      weekStartDate: getLocalDateString(monday),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };
  });

  // Data states
  const [watchlist, setWatchlist] = useState<WatchlistStudent[]>([]);
  const [studentSummaries, setStudentSummaries] = useState<StudentCharacterSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Tab & Growth monitoring states
  const [activeTab, setActiveTab] = useState<"summary" | "growth">("summary");
  const [growthDataCache, setGrowthDataCache] = useState<
    Record<string, { month: number; year: number; data: IndividualCharacterSummary }[]>
  >({});
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthError, setGrowthError] = useState<string | null>(null);

  // Status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedAssignment = useMemo(() => {
    return classes.find((item) => item.class_id === selectedClassId);
  }, [classes, selectedClassId]);

  const selectedStudent = useMemo(() => {
    return studentSummaries.find((s) => s.student_id === selectedStudentId) || null;
  }, [studentSummaries, selectedStudentId]);

  // Load teacher classes
  useEffect(() => {
    if (!token || !user) return;

    async function loadClasses() {
      try {
        const myClasses = await getMyClasses(token!);
        setClasses(myClasses);
        if (myClasses.length > 0) {
          setSelectedClassId(myClasses[0].class_id);
        } else {
          setLoading(false);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Gagal memuat kelas.");
        setLoading(false);
      }
    }

    setTimeout(() => loadClasses(), 0);
  }, [token, user]);

  // Compute timezone-safe payload params
  const periodParams = useMemo(() => {
    return getPeriodParams(periodFilter);
  }, [periodFilter]);

  // Fetch summaries and watchlist
  const loadData = useCallback(async () => {
    if (!token || !selectedClassId || !selectedAssignment) return;

    setLoading(true);
    setError(null);

    try {
      const { academic_year_id, semester_id } = selectedAssignment;

      // 1. Fetch class summaries & watchlist in parallel
      const [summaries, watchListRes] = await Promise.all([
        getClassCharacterSummary(token!, {
          class_id: selectedClassId,
          academic_year_id,
          semester_id,
          ...periodParams,
        }),
        getStudentWatchlist(token!, {
          academic_year_id,
          semester_id,
        }),
      ]);

      setStudentSummaries(summaries);
      // Filter watchlist so that teacher only sees at-risk or needs-data students from the selected class
      const filteredWatchlist = watchListRes.filter(
        (w) => (w.risk_status === "AT_RISK" || w.risk_status === "NEEDS_DATA") && summaries.some((s) => s.student_id === w.student_id)
      );
      setWatchlist(filteredWatchlist);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat rekap karakter.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedClassId, selectedAssignment, periodParams]);

  useEffect(() => {
    if (selectedClassId && selectedAssignment) {
      setTimeout(() => loadData(), 0);
    }
  }, [selectedClassId, periodFilter, selectedAssignment, loadData]);

  // Clear growth cache when class changes
  useEffect(() => {
    setGrowthDataCache({});
  }, [selectedClassId]);

  // Reset tab to summary when selected student changes
  useEffect(() => {
    setActiveTab("summary");
    setGrowthError(null);
  }, [selectedStudentId]);

  const loadStudentGrowth = useCallback(
    async (studentId: string) => {
      if (growthDataCache[studentId]) return;

      setGrowthLoading(true);
      setGrowthError(null);

      try {
        const today = new Date();
        const periods: { month: number; year: number }[] = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          periods.push({
            month: d.getMonth() + 1,
            year: d.getFullYear(),
          });
        }

        const { academic_year_id, semester_id } = selectedAssignment!;

        // Parallel requests
        const results = await Promise.all(
          periods.map(async (p) => {
            const summary = await getStudentCharacterSummary(token!, {
              student_id: studentId,
              academic_year_id,
              semester_id,
              month: p.month,
              year: p.year,
            });
            return {
              month: p.month,
              year: p.year,
              data: summary,
            };
          })
        );

        setGrowthDataCache((prev) => ({
          ...prev,
          [studentId]: results,
        }));
      } catch (err: unknown) {
        setGrowthError(err instanceof Error ? err.message : "Gagal memuat data perkembangan.");
      } finally {
        setGrowthLoading(false);
      }
    },
    [token, selectedAssignment, growthDataCache]
  );

  useEffect(() => {
    if (activeTab === "growth" && selectedStudentId) {
      loadStudentGrowth(selectedStudentId);
    }
  }, [activeTab, selectedStudentId, loadStudentGrowth]);

  // Compute class averages
  const classAverages = useMemo(() => {
    if (studentSummaries.length === 0) return null;

    const totals = { f: 0, i: 0, t: 0, r: 0, a: 0, h: 0 };
    const counts = { f: 0, i: 0, t: 0, r: 0, a: 0, h: 0 };

    studentSummaries.forEach((s) => {
      if (s.f !== null) { totals.f += s.f; counts.f++; }
      if (s.i !== null) { totals.i += s.i; counts.i++; }
      if (s.t !== null) { totals.t += s.t; counts.t++; }
      if (s.r !== null) { totals.r += s.r; counts.r++; }
      if (s.a !== null) { totals.a += s.a; counts.a++; }
      if (s.h !== null) { totals.h += s.h; counts.h++; }
    });

    return {
      f: counts.f > 0 ? Number((totals.f / counts.f).toFixed(2)) : null,
      i: counts.i > 0 ? Number((totals.i / counts.i).toFixed(2)) : null,
      t: counts.t > 0 ? Number((totals.t / counts.t).toFixed(2)) : null,
      r: counts.r > 0 ? Number((totals.r / counts.r).toFixed(2)) : null,
      a: counts.a > 0 ? Number((totals.a / counts.a).toFixed(2)) : null,
      h: counts.h > 0 ? Number((totals.h / counts.h).toFixed(2)) : null,
    };
  }, [studentSummaries]);

  const atRiskStudents = useMemo(() => {
    return watchlist.filter((w) => w.risk_status === "AT_RISK");
  }, [watchlist]);

  const needsDataStudents = useMemo(() => {
    return watchlist.filter((w) => w.risk_status === "NEEDS_DATA");
  }, [watchlist]);

  const isClassAveragesEmpty = useMemo(() => {
    if (!classAverages) return true;
    return Object.values(classAverages).every((v) => v === null);
  }, [classAverages]);

  if (!user || user.role !== "teacher") {
    return <ForbiddenState message="Halaman Rekap Karakter hanya dapat diakses oleh Guru Wali Kelas." />;
  }

  // Render progress bar color/style helper
  const renderProgressBar = (value: number | null) => {
    if (value === null) {
      return (
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div className="bg-zinc-350 dark:bg-zinc-700 h-full w-0" />
        </div>
      );
    }

    // Scale is 1 to 4
    const percentage = ((value - 1) / 3) * 100;
    let colorClass = "bg-red-500";
    if (value >= 3.0) {
      colorClass = "bg-emerald-500";
    } else if (value >= 2.0) {
      colorClass = "bg-amber-500";
    }

    return (
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
        <div className={`${colorClass} h-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    );
  };

  const today = new Date();

  const handlePrevWeek = () => {
    const d = new Date(periodFilter.weekStartDate);
    d.setDate(d.getDate() - 7);
    setPeriodFilter((prev) => ({ ...prev, weekStartDate: getLocalDateString(d) }));
  };

  const handleNextWeek = () => {
    const d = new Date(periodFilter.weekStartDate);
    d.setDate(d.getDate() + 7);
    const nextWeekStr = getLocalDateString(d);
    if (!isFutureWeek(nextWeekStr)) {
      setPeriodFilter((prev) => ({ ...prev, weekStartDate: nextWeekStr }));
    }
  };

  const nextWeekDate = new Date(periodFilter.weekStartDate);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const isNextWeekDisabled = isFutureWeek(getLocalDateString(nextWeekDate));

  const years = [today.getFullYear() - 1, today.getFullYear()];

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Rekap Karakter & FITRAH"
        description="Pantau ringkasan hasil perkembangan karakter FITRAH siswa kelas Anda."
      />

      {/* Selectors Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-surface-1 p-5 border border-zinc-200 dark:border-zinc-800/80 rounded-[20px] shadow-sm">
        {/* Class Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-2">
            Kelas
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={loading}
            className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-surface-1 dark:bg-surface-0 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 font-semibold"
          >
            {classes.map((item) => (
              <option key={item.assignment_id} value={item.class_id}>
                {item.class_name} {item.class_code ? `(${item.class_code})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Period Mode Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-2">
            Level Periode
          </label>
          <div className="flex bg-surface-2 p-1.5 rounded-[12px] border border-zinc-200/80 dark:border-zinc-800/60 h-[46px] items-center">
            {(["semester", "month", "week"] as CharacterPeriodMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPeriodFilter((prev) => ({ ...prev, mode }))}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  periodFilter.mode === mode
                    ? "bg-white dark:bg-surface-1 text-zinc-950 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-550 dark:text-zinc-400 hover:text-zinc-855 dark:hover:text-zinc-200"
                }`}
              >
                {mode === "semester" ? "Semester" : mode === "month" ? "Bulan" : "Minggu"}
              </button>
            ))}
          </div>
        </div>

        {/* Period Details Sub-picker */}
        <div className="flex flex-col justify-end">
          {periodFilter.mode === "semester" && selectedAssignment && (
            <div className="text-xs text-zinc-505 dark:text-zinc-400 bg-surface-2 p-3 rounded-[12px] border border-zinc-150 dark:border-zinc-800/60 h-[46px] flex items-center justify-between">
              <span className="font-semibold text-zinc-500">Periode:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {selectedAssignment.academic_year_name} - Semester {selectedAssignment.semester_name}
              </span>
            </div>
          )}

          {periodFilter.mode === "month" && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={periodFilter.month}
                onChange={(e) => setPeriodFilter((prev) => ({ ...prev, month: Number(e.target.value) }))}
                className="px-3 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-surface-1 dark:bg-surface-0 text-xs font-bold focus:outline-none"
              >
                {INDONESIAN_MONTHS.map((name, index) => {
                  const monthNum = index + 1;
                  const isFuture = isFutureMonth(monthNum, periodFilter.year);
                  return (
                    <option key={monthNum} value={monthNum} disabled={isFuture}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <select
                value={periodFilter.year}
                onChange={(e) => {
                  const newYear = Number(e.target.value);
                  setPeriodFilter((prev) => {
                    let newMonth = prev.month;
                    if (isFutureMonth(newMonth, newYear)) {
                      newMonth = today.getMonth() + 1;
                    }
                    return { ...prev, year: newYear, month: newMonth };
                  });
                }}
                className="px-3 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-surface-1 dark:bg-surface-0 text-xs font-bold focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodFilter.mode === "week" && (
            <div className="flex items-center gap-2 h-[46px] justify-between bg-surface-2 border border-zinc-150 dark:border-zinc-800/60 rounded-[12px] px-2">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-655 dark:text-zinc-350"
                title="Minggu Sebelumnya"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[10px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-tight truncate max-w-[140px] text-center leading-none">
                {getWeekRangeString(periodFilter.weekStartDate)}
              </span>
              <button
                type="button"
                onClick={handleNextWeek}
                disabled={isNextWeekDisabled}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-655 dark:text-zinc-350 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Minggu Selanjutnya"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Period Header Context Banner */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-[20px] text-xs font-bold text-emerald-800 dark:text-emerald-350">
        <svg className="w-4 h-4 shrink-0 text-[#468432] dark:text-emerald-550" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>
          Periode Aktif:{" "}
          {periodFilter.mode === "semester" && `Semester ${activeSemester?.name || "-"} (${activeAcademicYear?.name || "-"})`}
          {periodFilter.mode === "month" && `${INDONESIAN_MONTHS[periodFilter.month - 1]} ${periodFilter.year}`}
          {periodFilter.mode === "week" && `Minggu ${getWeekRangeString(periodFilter.weekStartDate)}`}
        </span>
      </div>

      {/* At-Risk Warning Box */}
      {!loading && !error && atRiskStudents.length > 0 && (
        <div className="p-4 rounded-[20px] bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-450 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Siswa Perlu Perhatian ({atRiskStudents.length})
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-450">
            Siswa berikut membutuhkan perhatian lebih lanjut berdasarkan batas aman rekap sistem:
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {atRiskStudents.map((w) => {
              const reasonsText = w.risk_reasons
                ?.map((r) => {
                  if (r === "ACADEMIC_BELOW_THRESHOLD") return "Akademik";
                  if (r === "FITRAH_BELOW_THRESHOLD") return "FITRAH";
                  return r;
                })
                .join(" & ");
              return (
                <span key={w.student_id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-250 dark:border-amber-855">
                  {w.student_name} {reasonsText ? `(${reasonsText})` : ""}
                </span>
              );
            })}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-500 font-medium italic mt-1 border-t border-amber-200/40 pt-1">
            * Watchlist menggunakan data semester aktif.
          </div>
        </div>
      )}

      {/* Needs Data Info Box */}
      {!loading && !error && needsDataStudents.length > 0 && (
        <div className="p-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
            <svg className="w-5 h-5 text-zinc-505 dark:text-zinc-450 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Data Budaya Belum Lengkap ({needsDataStudents.length})
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Siswa berikut belum memiliki cukup data budaya harian untuk dievaluasi perkembangan karakternya pada periode ini:
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {needsDataStudents.map((w) => (
              <span key={w.student_id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-105 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-250 dark:border-zinc-700">
                {w.student_name} <span className="ml-1 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">(Belum ada data budaya)</span>
              </span>
            ))}
          </div>
          <div className="text-[10px] text-zinc-500/80 dark:text-zinc-500 font-medium italic mt-1 border-t border-zinc-200/40 pt-1">
            * Evaluasi kecukupan data menggunakan data semester aktif.
          </div>
        </div>
      )}

      {loading && <LoadingState message="Memuat rekap karakter..." />}

      {!loading && error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && !error && (
        <>
          {classes.length === 0 && (
            <EmptyState
              title="Belum Ada Kelas"
              description="Anda belum memiliki assignment kelas aktif."
            />
          )}

          {classes.length > 0 && studentSummaries.length === 0 && (
            <EmptyState
              title="Roster Kosong"
              description="Tidak ada data rekap siswa pada kelas dan periode ini."
            />
          )}

          {studentSummaries.length > 0 && (
            <div className="space-y-6">
              {/* Class averages overview cards */}
              {classAverages && (
                <section className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">Rata-rata Karakter Kelas</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Nilai rata-rata dari seluruh siswa yang terisi di periode ini.</p>
                  </div>
                  {isClassAveragesEmpty ? (
                    <div className="p-4 rounded-[12px] bg-surface-2 border border-zinc-150 dark:border-zinc-850 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Belum ada data budaya pada periode ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      <div className="lg:col-span-4 bg-surface-2 border border-zinc-150 dark:border-zinc-850 rounded-[12px] p-4 flex justify-center">
                        <div className="w-full max-w-[320px]">
                          <FitrahRadarChart data={classAverages} />
                        </div>
                      </div>
                      <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {FITRAH_DIMENSIONS.map((dim) => {
                          const val = classAverages[dim.code.toLowerCase() as "f" | "i" | "t" | "r" | "a" | "h"];
                          return (
                            <div key={dim.code} className="p-4 rounded-[12px] bg-surface-2 border border-zinc-150 dark:border-zinc-850 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-650">{dim.code} — {dim.name}</span>
                                <span className="text-sm font-black text-zinc-950 dark:text-zinc-50">{val !== null && val !== undefined ? val : "-"}</span>
                              </div>
                              {renderProgressBar(val)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Roster student summary list */}
              <div className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-150 dark:border-zinc-800/80 bg-surface-2">
                  <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">Daftar Karakter Siswa</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Pilih nama siswa untuk melihat visualisasi dan detail mapping.</p>
                </div>

                {/* Table for larger screens */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2 border-b border-zinc-150 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4 min-w-[200px]">Nama Siswa</th>
                        <th className="py-3 px-4 text-center">Hari Diisi</th>
                        {FITRAH_DIMENSIONS.map((dim) => (
                          <th key={dim.code} className="py-3 px-4 text-center min-w-[90px]" title={dim.description}>
                            {dim.code}
                            <span className="block text-[9px] font-normal lowercase text-zinc-400 dark:text-zinc-650 truncate max-w-[80px] mt-0.5">
                              {dim.name}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                      {studentSummaries.map((s, index) => {
                        const hasRisk = watchlist.some((w) => w.student_id === s.student_id);
                        return (
                          <tr
                            key={s.student_id}
                            onClick={() => setSelectedStudentId(s.student_id)}
                            className="hover:bg-surface-2 cursor-pointer transition-colors"
                          >
                            <td className="py-3.5 px-4 text-center text-sm font-semibold text-zinc-400 dark:text-zinc-650">
                              {index + 1}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-zinc-950 dark:text-zinc-50 leading-tight">
                                  {s.full_name}
                                </span>
                                {hasRisk && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    watchlist.find((w) => w.student_id === s.student_id)?.risk_status === "NEEDS_DATA"
                                      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                      : "bg-amber-105 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                  }`}>
                                    {watchlist.find((w) => w.student_id === s.student_id)?.risk_status === "NEEDS_DATA" ? "Needs Data" : "Perhatian"}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                NISN: {s.nisn}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center text-sm font-medium text-zinc-700 dark:text-zinc-350">
                              {s.days_counted !== null && s.days_counted !== undefined ? s.days_counted : 0} hari
                            </td>
                            {FITRAH_DIMENSIONS.map((dim) => {
                              const val = s[dim.code.toLowerCase() as "f" | "i" | "t" | "r" | "a" | "h"];
                              return (
                                <td key={dim.code} className="py-3.5 px-4 text-center font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                  {val !== null && val !== undefined ? val : "-"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>                {/* Cards for mobile screens */}
                <div className="block md:hidden divide-y divide-zinc-150 dark:divide-zinc-800">
                  {studentSummaries.map((s, index) => {
                    const hasRisk = watchlist.some((w) => w.student_id === s.student_id);
                    return (
                      <button
                        key={s.student_id}
                        type="button"
                        onClick={() => setSelectedStudentId(s.student_id)}
                        className="w-full p-4 flex flex-col text-left hover:bg-surface-2 transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between min-w-0 gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-surface-2 text-zinc-500 dark:text-zinc-450 flex items-center justify-center text-xs font-bold shrink-0">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-zinc-950 dark:text-zinc-50 truncate flex items-center gap-1.5">
                                {s.full_name}
                                {hasRisk && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                    watchlist.find((w) => w.student_id === s.student_id)?.risk_status === "NEEDS_DATA"
                                      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                      : "bg-amber-105 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                  }`}>
                                    {watchlist.find((w) => w.student_id === s.student_id)?.risk_status === "NEEDS_DATA" ? "Needs Data" : "Perhatian"}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-550 dark:text-zinc-400 mt-0.5">
                                NISN: {s.nisn}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-surface-2 text-zinc-655 dark:text-zinc-400 text-[10px] font-bold">
                            {s.days_counted !== null && s.days_counted !== undefined ? s.days_counted : 0} hari
                          </span>
                        </div>

                        {/* Dimensions horizontal summary grid */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {FITRAH_DIMENSIONS.map((dim) => {
                            const val = s[dim.code.toLowerCase() as "f" | "i" | "t" | "r" | "a" | "h"];
                            return (
                              <div key={dim.code} className="text-xs py-1.5 px-2 bg-surface-2 border border-zinc-150 dark:border-zinc-850 rounded-lg flex items-center justify-between">
                                <span className="font-semibold text-zinc-400 dark:text-zinc-600">{dim.code}</span>
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{val !== null && val !== undefined ? val : "-"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Student Detail Slide-Over Drawer */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-1 h-full flex flex-col border-l border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-150 dark:border-zinc-800/80 bg-surface-2 shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">{selectedStudent.full_name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">NISN: {selectedStudent.nisn} • {selectedStudent.days_counted !== null && selectedStudent.days_counted !== undefined ? selectedStudent.days_counted : 0} Hari terisi</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-surface-2 text-zinc-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-150 dark:border-zinc-800 shrink-0 px-5 bg-surface-1">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`py-3 px-4 border-b-2 text-xs font-bold transition-all ${
                  activeTab === "summary"
                    ? "border-emerald-500 text-[#468432] dark:text-emerald-450"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Ringkasan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("growth")}
                className={`py-3 px-4 border-b-2 text-xs font-bold transition-all ${
                  activeTab === "growth"
                    ? "border-emerald-500 text-[#468432] dark:text-emerald-450"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Perkembangan
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {activeTab === "summary" && (
                <>
                  {/* Radar Chart */}
                  {!(selectedStudent.days_counted === 0 || (!selectedStudent.f && !selectedStudent.i && !selectedStudent.t && !selectedStudent.r && !selectedStudent.a && !selectedStudent.h)) && (
                    <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-[12px] flex justify-center">
                      <div className="w-full max-w-[320px]">
                        <FitrahRadarChart data={selectedStudent} />
                      </div>
                    </div>
                  )}

                  {/* Empty Data Warning */}
                  {(selectedStudent.days_counted === 0 || (!selectedStudent.f && !selectedStudent.i && !selectedStudent.t && !selectedStudent.r && !selectedStudent.a && !selectedStudent.h)) && (
                    <div className="p-4 rounded-[12px] bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      Belum ada data budaya pada periode ini.
                    </div>
                  )}

                  {/* FITRAH Progress Bars */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">Hasil Dimensi FITRAH</h4>
                    <div className="space-y-3.5">
                      {FITRAH_DIMENSIONS.map((dim) => {
                        const val = selectedStudent[dim.code.toLowerCase() as "f" | "i" | "t" | "r" | "a" | "h"];
                        return (
                          <div key={dim.code} className="space-y-1.5">
                            <div className="flex justify-between items-baseline">
                              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-250">
                                {dim.code} — {dim.name}
                                <span className="block text-[10px] font-normal text-zinc-400 mt-0.5">{dim.description}</span>
                              </div>
                              <span className="text-sm font-black text-zinc-950 dark:text-zinc-50">{val !== null && val !== undefined ? val : "-"}</span>
                            </div>
                            {renderProgressBar(val)}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conceptual Mapping SAHABAT -> FITRAH */}
                  <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-6 space-y-3">
                    <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">Mapping SAHABAT &rarr; FITRAH</h4>
                    <div className="space-y-2">
                      {FITRAH_DIMENSIONS.map((dim) => (
                        <div key={dim.code} className="text-xs p-3 rounded-[12px] bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850">
                          <div className="font-bold text-zinc-700 dark:text-zinc-350">{dim.code} ({dim.name})</div>
                          <div className="text-zinc-505 mt-1">
                            Dihitung dari rata-rata budaya harian:
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {dim.indicators.map((ind, i) => (
                              <span key={i} className="inline-block px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-[10px] text-zinc-650 dark:text-zinc-400 font-medium">
                                {ind}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "growth" && (
                <>
                  {growthLoading && (
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-zinc-550 dark:text-zinc-400">Memuat data perkembangan...</span>
                    </div>
                  )}

                  {!growthLoading && growthError && (
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-zinc-50/50 dark:bg-zinc-955/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[20px] min-h-[220px]">
                      <svg className="w-10 h-10 text-rose-500 mb-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        Gagal memuat data perkembangan.
                      </span>
                      <span className="text-xs text-zinc-500 max-w-[280px]">
                        {growthError}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadStudentGrowth(selectedStudent.student_id)}
                        className="px-4 py-2 mt-2 bg-[#468432] hover:bg-[#3A6F2B] text-white text-xs font-bold rounded-[12px] transition-colors"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  )}

                  {!growthLoading && !growthError && (
                    <StudentGrowth historicalData={growthDataCache[selectedStudent.student_id] || []} />
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex-1" onClick={() => setSelectedStudentId(null)} />
        </div>
      )}
    </ResponsiveContainer>
  );
}
