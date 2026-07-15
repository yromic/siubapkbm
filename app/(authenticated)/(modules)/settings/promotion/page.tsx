"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api/client";
import {
  executeStudentPromotion,
  previewStudentPromotion,
  PromotionAction,
  PromotionExecutionResult,
  PromotionOverride,
  PromotionPayload,
  PromotionPreview,
} from "@/lib/api/promotion";
import { ForbiddenState, PageHeader, ResponsiveContainer } from "@/components/ui-states";
import { userFacingError } from "@/lib/utils/ui-error";

interface AcademicYear { id: string; name: string; start_date: string }
interface Semester { id: string; academic_year_id: string; name: string; start_date: string }
interface ClassItem { id: string; name: string; level: string; status: string }

const ACTIONS: Array<{ value: PromotionAction; label: string }> = [
  { value: "promoted", label: "Naik Kelas" },
  { value: "repeated", label: "Tinggal Kelas" },
  { value: "graduated", label: "Lulus" },
  { value: "transferred", label: "Pindah" },
  { value: "inactive", label: "Tidak Aktif" },
  { value: "left", label: "Keluar" },
];

const PROMOTION_LABELS: Record<string, string> = {
  promoted: "Naik Kelas",
  repeated: "Tinggal Kelas",
  graduated: "Lulus",
  transferred: "Pindah",
  inactive: "Tidak Aktif",
  left: "Keluar",
  unresolved: "Perlu Tindakan",
};

const SUMMARY_LABELS: Record<string, string> = {
  total: "Total Siswa",
  processed: "Diproses",
  completed: "Berhasil",
  skipped: "Dilewati",
  failed: "Gagal",
  recovered: "Dipulihkan",
  ...PROMOTION_LABELS,
};

function formatPromotionActionLabel(action?: string) {
  return action ? PROMOTION_LABELS[action] || "Perlu Tindakan" : "Perlu Tindakan";
}

function formatPromotionSummaryLabel(key: string) {
  return SUMMARY_LABELS[key] || key;
}

function localizePromotionMessage(message: string) {
  return Object.entries(PROMOTION_LABELS).reduce(
    (localized, [technical, label]) => localized.replace(new RegExp(`\\b${technical}\\b`, "gi"), label),
    message
  );
}

export default function PromotionPage() {
  const { token, user } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceSemesterId, setSourceSemesterId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [targetSemesterId, setTargetSemesterId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, PromotionOverride>>({});
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [result, setResult] = useState<PromotionExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [classLoadWarning, setClassLoadWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const previewSequence = useRef(0);
  const submitting = useRef(false);

  const isAdmin = user?.role === "administrator" || user?.role === "admin";

  const loadInitialData = useCallback(async () => {
    if (!token || !isAdmin) return;
    setInitialLoading(true);
    setInitialError(null);
    setClassLoadWarning(null);

    const [yearsResult, semestersResult, classesResult] = await Promise.allSettled([
      apiRequest<AcademicYear[]>("list_academic_years", {}, token),
      apiRequest<Semester[]>("list_semesters", {}, token),
      apiRequest<ClassItem[]>("list_classes", {}, token),
    ]);

    if (yearsResult.status === "rejected" || semestersResult.status === "rejected") {
      const reason = yearsResult.status === "rejected" ? yearsResult.reason : semestersResult.status === "rejected" ? semestersResult.reason : null;
      setInitialError(userFacingError(reason, "Tahun ajaran dan semester gagal dimuat."));
    } else {
      const nextYears = yearsResult.value;
      const nextSemesters = semestersResult.value;
      const sortedYears = [...nextYears].sort((a, b) => a.start_date.localeCompare(b.start_date));
      setYears(sortedYears);
      setSemesters(nextSemesters);
      if (sortedYears.length) {
        const source = sortedYears[Math.max(0, sortedYears.length - 2)];
        const target = sortedYears[sortedYears.length - 1];
        setSourceYearId(source.id);
        setTargetYearId(target.id);
        const sourceSems = nextSemesters.filter((s) => s.academic_year_id === source.id).sort((a, b) => a.start_date.localeCompare(b.start_date));
        const targetSems = nextSemesters.filter((s) => s.academic_year_id === target.id).sort((a, b) => a.start_date.localeCompare(b.start_date));
        setSourceSemesterId(sourceSems.at(-1)?.id || "");
        setTargetSemesterId(targetSems[0]?.id || "");
      }
    }

    if (classesResult.status === "fulfilled") {
      setClasses(classesResult.value.filter((item) => item.status === "active"));
    } else {
      setClasses([]);
      setClassLoadWarning(userFacingError(classesResult.reason, "Daftar kelas gagal dimuat. Periode tetap dapat dipilih."));
    }
    setInitialLoading(false);
  }, [token, isAdmin]);

  useEffect(() => {
    // Initial remote data synchronization is intentionally triggered by auth changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitialData();
  }, [loadInitialData]);

  const sourceSemesters = useMemo(() => semesters.filter((s) => s.academic_year_id === sourceYearId).sort((a, b) => a.start_date.localeCompare(b.start_date)), [semesters, sourceYearId]);
  const targetSemesters = useMemo(() => semesters.filter((s) => s.academic_year_id === targetYearId).sort((a, b) => a.start_date.localeCompare(b.start_date)), [semesters, targetYearId]);

  function payloadWith(nextOverrides = overrides): PromotionPayload {
    return {
      source_academic_year_id: sourceYearId,
      source_semester_id: sourceSemesterId,
      target_academic_year_id: targetYearId,
      target_semester_id: targetSemesterId,
      overrides: Object.values(nextOverrides),
    };
  }

  async function runPreview(nextOverrides = overrides) {
    if (!token || loading || !sourceYearId || !sourceSemesterId || !targetYearId || !targetSemesterId) return;
    const sequence = ++previewSequence.current;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await previewStudentPromotion(token, payloadWith(nextOverrides));
      if (sequence === previewSequence.current) setPreview(data);
    } catch (reason: unknown) {
      if (sequence === previewSequence.current) setError(userFacingError(reason, "Pratinjau kenaikan kelas gagal diproses."));
    } finally {
      if (sequence === previewSequence.current) setLoading(false);
    }
  }

  function changePeriod(kind: "sourceYear" | "targetYear" | "sourceSemester" | "targetSemester", value: string) {
    setPreview(null); setResult(null); setOverrides({});
    if (kind === "sourceYear") {
      setSourceYearId(value);
      const options = semesters.filter((s) => s.academic_year_id === value).sort((a, b) => a.start_date.localeCompare(b.start_date));
      setSourceSemesterId(options.at(-1)?.id || "");
    } else if (kind === "targetYear") {
      setTargetYearId(value);
      const options = semesters.filter((s) => s.academic_year_id === value).sort((a, b) => a.start_date.localeCompare(b.start_date));
      setTargetSemesterId(options[0]?.id || "");
    } else if (kind === "sourceSemester") setSourceSemesterId(value);
    else setTargetSemesterId(value);
  }

  function applyOverride(studentId: string, action: PromotionAction, targetClassId = "") {
    const next = { ...overrides, [studentId]: { student_id: studentId, action, ...(action === "promoted" ? { target_class_id: targetClassId } : {}) } };
    setOverrides(next);
    void runPreview(next);
  }

  async function execute() {
    if (!token || !preview?.can_execute || submitting.current) return;
    submitting.current = true;
    setLoading(true); setError(null);
    try {
      setResult(await executeStudentPromotion(token, payloadWith()));
      setConfirmOpen(false);
      setPreview(null);
    } catch (reason: unknown) {
      setError(userFacingError(reason, "Kenaikan kelas gagal diproses. Periksa data lalu coba lagi."));
      setConfirmOpen(false);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  if (!isAdmin) return <ForbiddenState message="Panduan Kenaikan Kelas hanya dapat diakses Administrator atau Operator." />;

  const sourcePeriod = `${years.find((item) => item.id === sourceYearId)?.name || "-"} ${semesters.find((item) => item.id === sourceSemesterId)?.name || ""}`.trim();
  const targetPeriod = `${years.find((item) => item.id === targetYearId)?.name || "-"} ${semesters.find((item) => item.id === targetSemesterId)?.name || ""}`.trim();
  const manualOverrideCount = Object.keys(overrides).length;

  const summary = result || preview?.counts;
  const summaryKeys = result
    ? ["processed", "completed", "skipped", "failed", "promoted", "repeated", "graduated", "transferred", "inactive", "left"]
    : ["total", "promoted", "repeated", "graduated", "transferred", "inactive", "left", "unresolved"];

  return <ResponsiveContainer className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <PageHeader title="Panduan Kenaikan Kelas" description="Pratinjau, tindakan manual, dan pelaksanaan kenaikan kelas tahunan siswa." />
      <Link href="/settings/promotion-history" className="inline-flex items-center justify-center rounded-[12px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2.5 text-sm font-semibold transition">
        Lihat Riwayat Kenaikan Kelas
      </Link>
    </div>

    <section className="rounded-[20px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#171717]">
      <h2 className="mb-4 text-lg font-bold">1. Pilih Periode</h2>
      <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Khusus kenaikan tahun ajaran dari semester akhir ke semester awal. Bukan rollover Ganjil → Genap dalam tahun ajaran yang sama.</div>
      {initialLoading && <div className="mb-4 rounded-[12px] bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Memuat tahun ajaran, semester, dan kelas...</div>}
      {initialError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><span>{initialError}</span><button type="button" disabled={initialLoading} onClick={() => void loadInitialData()} className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold disabled:opacity-50 dark:border-red-800">Coba Lagi</button></div>}
      {classLoadWarning && <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Daftar kelas gagal dimuat: {classLoadWarning} Target kelas untuk tindakan manual naik kelas belum tersedia, tetapi pilihan periode tetap dapat digunakan.</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Select label="Tahun ajaran sumber" value={sourceYearId} disabled={loading || initialLoading} onChange={(v) => changePeriod("sourceYear", v)} options={years.map((v) => ({ value: v.id, label: v.name?.trim() || "Tahun ajaran tanpa nama" }))} />
        <Select label="Semester sumber" value={sourceSemesterId} disabled={loading || initialLoading} onChange={(v) => changePeriod("sourceSemester", v)} options={sourceSemesters.map((v) => ({ value: v.id, label: v.name }))} />
        <Select label="Tahun ajaran target" value={targetYearId} disabled={loading || initialLoading} onChange={(v) => changePeriod("targetYear", v)} options={years.map((v) => ({ value: v.id, label: v.name?.trim() || "Tahun ajaran tanpa nama" }))} />
        <Select label="Semester target" value={targetSemesterId} disabled={loading || initialLoading} onChange={(v) => changePeriod("targetSemester", v)} options={targetSemesters.map((v) => ({ value: v.id, label: v.name }))} />
      </div>
      <button type="button" onClick={() => void runPreview()} disabled={loading || initialLoading || !sourceSemesterId || !targetSemesterId} className="mt-5 rounded-[12px] bg-[#468432] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Memproses..." : "Pratinjau Kenaikan Kelas"}</button>
      {(!sourceSemesterId || !targetSemesterId) && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Periode sumber dan target belum lengkap.</p>}
    </section>

    {error && <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

    {summary && <section className="rounded-[20px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#171717]">
      <h2 className="mb-4 text-lg font-bold">{result ? "Hasil Pelaksanaan" : "Ringkasan Pratinjau"}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">{summaryKeys.map((key) => <div key={key} className="rounded-[12px] bg-zinc-50 p-3 dark:bg-zinc-800"><div className="text-xs font-semibold text-zinc-500">{formatPromotionSummaryLabel(key)}</div><div className="text-2xl font-bold">{String(summary[key as keyof typeof summary] ?? 0)}</div></div>)}</div>
    </section>}

    {preview && <section className="space-y-4">
      <div className={`rounded-[12px] border p-4 ${preview.can_execute ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"}`}><strong>{preview.can_execute ? "Siap diproses" : "Belum dapat diproses"}</strong>{preview.global_blockers.map((b, i) => <p key={`${b.type}-${i}`} className="mt-1 text-sm">{localizePromotionMessage(b.message)}</p>)}</div>
      <div className="overflow-x-auto rounded-[20px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#171717]"><table className="min-w-full text-sm"><thead className="bg-zinc-50 text-left dark:bg-zinc-800"><tr><th className="p-3">Siswa</th><th className="p-3">Kelas asal</th><th className="p-3">Rekomendasi</th><th className="p-3">Tindakan Manual</th><th className="p-3">Target kelas</th><th className="p-3">Kendala</th></tr></thead><tbody>{preview.students.map((student) => {
        const override = overrides[student.student_id];
        const action = override?.action || student.resolved_action as PromotionAction;
        return <tr key={student.student_id} className={`border-t align-top ${override ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20" : "border-zinc-100 dark:border-zinc-800"}`}><td className="p-3 font-medium">{student.student_name}<div className="text-xs text-zinc-500">{student.nisn || "-"}</div><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${override ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>{override ? "Manual" : "Otomatis"}</span></td><td className="p-3">{student.source_class_name}</td><td className="p-3"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{formatPromotionActionLabel(student.recommended_action)}</span></td><td className="p-3"><select aria-label={`Tindakan manual ${student.student_name}`} value={action} disabled={loading} onChange={(e) => applyOverride(student.student_id, e.target.value as PromotionAction, e.target.value === "promoted" ? student.resolved_target_class_id : "")} className="rounded-lg border border-zinc-300 bg-transparent px-2 py-2 dark:border-zinc-700">{ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></td><td className="p-3">{action === "promoted" ? <select aria-label={`Target kelas ${student.student_name}`} value={override?.target_class_id ?? student.resolved_target_class_id} disabled={loading} onChange={(e) => applyOverride(student.student_id, "promoted", e.target.value)} className="rounded-lg border border-zinc-300 bg-transparent px-2 py-2 dark:border-zinc-700"><option value="">Pilih kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : "-"}</td><td className="p-3 text-red-600 dark:text-red-400">{student.blockers.length ? localizePromotionMessage(student.blockers.join(" ")) : "-"}</td></tr>;
      })}</tbody></table></div>
      <button type="button" disabled={loading || !preview.can_execute} onClick={() => setConfirmOpen(true)} className="rounded-[12px] bg-red-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Proses Kenaikan Kelas</button>
      {!preview.can_execute && <p className="text-sm text-red-700 dark:text-red-300">Masih terdapat kendala yang harus diperbaiki sebelum data dapat diproses.</p>}
    </section>}

    {confirmOpen && preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="promotion-confirm-title"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl dark:bg-[#171717]"><h2 id="promotion-confirm-title" className="text-xl font-bold">Konfirmasi Kenaikan Kelas</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Summary label="Periode Sumber" value={sourcePeriod} wide /><Summary label="Periode Target" value={targetPeriod} wide /><Summary label="Naik Kelas" value={preview.counts.promoted} /><Summary label="Tinggal Kelas" value={preview.counts.repeated} /><Summary label="Lulus" value={preview.counts.graduated} /><Summary label="Pindah" value={preview.counts.transferred} /><Summary label="Tidak Aktif" value={preview.counts.inactive} /><Summary label="Keluar" value={preview.counts.left} /><Summary label="Kendala" value={preview.global_blockers.length + (preview.counts.unresolved || 0)} /><Summary label="Perubahan Manual" value={manualOverrideCount} /></dl><p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Proses ini akan memperbarui riwayat kelas siswa dan tidak dapat dibatalkan secara otomatis.</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={loading} onClick={() => setConfirmOpen(false)} className="rounded-[12px] border border-zinc-300 px-4 py-2 dark:border-zinc-700">Batal</button><button type="button" disabled={loading} onClick={() => void execute()} className="rounded-[12px] bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? "Memproses..." : "Ya, Proses"}</button></div></div></div>}
  </ResponsiveContainer>;
}

function Summary({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return <div className={`rounded-[12px] bg-zinc-50 p-3 dark:bg-zinc-800 ${wide ? "col-span-2" : ""}`}><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

function Select({ label, value, options, disabled, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-sm font-medium"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[12px] border border-zinc-300 bg-transparent px-3 py-2.5 dark:border-zinc-700"><option value="">Pilih periode</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
