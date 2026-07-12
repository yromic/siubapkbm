"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  CultureCompletenessPeriodMode,
  CultureCompletenessStatus,
  getTeacherCultureCompleteness,
  TeacherCultureCompletenessResponse,
} from "@/lib/api/culture";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";

const PERIOD_OPTIONS: Array<{ value: CultureCompletenessPeriodMode; label: string }> = [
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
  { value: "semester", label: "Semester" },
];

const STATUS_META: Record<CultureCompletenessStatus, { label: string; className: string; order: number }> = {
  empty: { label: "Belum Ada Data", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", order: 0 },
  low: { label: "Masih Rendah", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300", order: 1 },
  partial: { label: "Sebagian", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300", order: 2 },
  complete: { label: "Lengkap", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300", order: 3 },
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
}

function coverageErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "ERR_FORBIDDEN") {
    return "Anda tidak memiliki akses ke data budaya kelas ini.";
  }
  return "Data kelengkapan budaya gagal dimuat. Silakan coba lagi.";
}

export function CultureCompletenessCard({ token }: { token: string }) {
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [classId, setClassId] = useState("");
  const [periodMode, setPeriodMode] = useState<CultureCompletenessPeriodMode>("week");
  const [data, setData] = useState<TeacherCultureCompletenessResponse | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false);

  useEffect(() => {
    let active = true;
    getMyClasses(token)
      .then((items) => {
        if (!active) return;
        setClasses(items);
        setClassId(items[0]?.class_id || "");
        setLoading(items.length > 0);
      })
      .catch((err: unknown) => {
        if (active) setError(coverageErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const loadCompleteness = useCallback(async () => {
    if (!classId) return;
    try {
      setData(await getTeacherCultureCompleteness(token, { period_mode: periodMode, class_id: classId }));
    } catch (err: unknown) {
      setData(null);
      setError(coverageErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [classId, periodMode, token]);

  useEffect(() => {
    if (!classId) return;
    let active = true;
    getTeacherCultureCompleteness(token, { period_mode: periodMode, class_id: classId })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setData(null);
        setError(coverageErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, periodMode, token]);

  const missingDates = useMemo(
    () => [...(data?.missing_dates || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [data]
  );
  const lowCoverageStudents = useMemo(
    () =>
      (data?.students || [])
        .filter((student) => student.completeness_status !== "complete")
        .sort((a, b) => {
          const orderDiff = STATUS_META[a.completeness_status].order - STATUS_META[b.completeness_status].order;
          return orderDiff || a.student_name.localeCompare(b.student_name, "id-ID");
        }),
    [data]
  );

  const visibleDates = showAllDates ? missingDates : missingDates.slice(0, 5);
  const visibleStudents = showAllStudents ? lowCoverageStudents : lowCoverageStudents.slice(0, 5);
  const noCultureData = data && data.class_summary.total_students > 0 && data.class_summary.empty_students === data.class_summary.total_students;

  return (
    <section className="md:col-span-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">Kelengkapan Budaya</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Pantau hari dan siswa yang masih membutuhkan input budaya.</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800" aria-label="Pilih periode kelengkapan budaya">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPeriodMode(option.value);
                setLoading(true);
                setError(null);
                setShowAllDates(false);
                setShowAllStudents(false);
              }}
              aria-pressed={periodMode === option.value}
              className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors ${
                periodMode === option.value
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {classes.length > 1 && (
        <label className="mt-4 block max-w-sm text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Kelas
          <select
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setLoading(true);
              setError(null);
              setShowAllDates(false);
              setShowAllStudents(false);
            }}
            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {classes.map((item) => (
              <option key={item.assignment_id} value={item.class_id}>{item.class_name}</option>
            ))}
          </select>
        </label>
      )}

      {loadingClasses ? (
        <p className="py-10 text-center text-sm text-zinc-500">Memuat assignment kelas...</p>
      ) : classes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
          Anda belum memiliki assignment kelas aktif untuk periode ini.
        </p>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/20 dark:text-red-300">
          <p>{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); void loadCompleteness(); }} className="mt-3 min-h-10 rounded-lg bg-zinc-900 px-4 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">Coba Lagi</button>
        </div>
      ) : loading || !data ? (
        <p className="py-10 text-center text-sm text-zinc-500">Memuat kelengkapan budaya...</p>
      ) : (
        <div className="mt-5 space-y-6">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {formatDate(data.period.start_date)} – {formatDate(data.period.end_date)}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><p className="text-3xl font-black text-emerald-950 dark:text-emerald-50">{data.class_summary.average_coverage_percent}%</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">Rata-rata kelengkapan kelas</p></div>
              <div><p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">{data.class_summary.complete_students} / {data.class_summary.total_students}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Siswa lengkap</p></div>
              <div><p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">{data.expected_days}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Hari input terjadwal</p></div>
            </div>
            <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">Periode ini memiliki {data.expected_days} hari input terjadwal. Rata-rata kelengkapan kelas: {data.class_summary.average_coverage_percent}%.</p>
          </div>

          {data.expected_days === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-950/30 dark:text-zinc-400">Belum ada hari input budaya yang dijadwalkan pada periode ini.</p>
          ) : noCultureData ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-950/30 dark:text-zinc-400">Belum ada data budaya yang diisi pada periode ini.</p>
          ) : null}

          <div>
            <h3 className="font-bold text-zinc-950 dark:text-zinc-50">Tanggal Perlu Dilengkapi</h3>
            {missingDates.length === 0 ? (
              <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">Data budaya pada periode ini sudah lengkap.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {visibleDates.map((item) => (
                  <article key={item.date} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">{formatDate(item.date)}</p><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{item.completion_percent}%</span></div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.completed_students} dari {item.expected_students} siswa sudah diisi.</p>
                    <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">{item.missing_students} siswa belum diisi</p>
                    <Link href={{ pathname: "/daily-culture", query: { date: item.date, class_id: classId } }} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">Isi Budaya Tanggal Ini</Link>
                  </article>
                ))}
              </div>
            )}
            {missingDates.length > 5 && <button type="button" onClick={() => setShowAllDates((value) => !value)} className="mt-3 min-h-10 text-sm font-bold text-emerald-700 dark:text-emerald-400">{showAllDates ? "Tampilkan lebih sedikit" : "Lihat semua"}</button>}
          </div>

          <div>
            <h3 className="font-bold text-zinc-950 dark:text-zinc-50">Siswa Membutuhkan Data Tambahan</h3>
            {lowCoverageStudents.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Semua siswa memiliki coverage yang lengkap.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {visibleStudents.map((student) => {
                  const status = STATUS_META[student.completeness_status];
                  return <article key={student.student_id} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="min-w-0"><p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">{student.student_name}</p><p className="mt-1 text-xs text-zinc-500">{student.days_counted} / {student.expected_days} hari · {student.coverage_percent}%</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span></article>;
                })}
              </div>
            )}
            {lowCoverageStudents.length > 5 && <button type="button" onClick={() => setShowAllStudents((value) => !value)} className="mt-3 min-h-10 text-sm font-bold text-emerald-700 dark:text-emerald-400">{showAllStudents ? "Tampilkan lebih sedikit" : "Lihat semua"}</button>}
          </div>
        </div>
      )}
    </section>
  );
}
