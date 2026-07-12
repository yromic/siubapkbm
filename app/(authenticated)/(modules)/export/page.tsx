"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api/client";
import { listMyClassSubjects, MyClassSubject } from "@/lib/api/academic";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import { downloadReportExport, ExportGenerateResponse, exportAcademicScoresCsv, exportCharacterSummaryCsv, exportStudentsCsv, ExportType } from "@/lib/api/exports";
import { PageHeader } from "@/components/ui-states";
import { ExportHistory, exportErrorMessage } from "@/components/export/export-history";
import { downloadBase64File } from "@/lib/utils/files";

type Option = { id: string; label: string };
type FormState = { class_id: string; academic_year_id: string; semester_id: string; subject_id: string };
const TYPES: Array<{ value: ExportType; label: string }> = [{ value: "students_csv", label: "Data Siswa" }, { value: "academic_scores_csv", label: "Nilai Akademik" }, { value: "character_summary_csv", label: "Nilai Karakter / FITRAH" }];
const EMPTY_FORM: FormState = { class_id: "", academic_year_id: "", semester_id: "", subject_id: "" };

export default function ExportPage() {
  const { user, token } = useAuth();
  const teacher = user?.role === "teacher";
  const [tab, setTab] = useState<"new" | "history">("new");
  const [type, setType] = useState<ExportType>("students_csv");
  const [scope, setScope] = useState<"filtered" | "all">("filtered");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [classes, setClasses] = useState<Option[]>([]);
  const [years, setYears] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Array<Option & { academic_year_id?: string }>>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [assignments, setAssignments] = useState<MyClassAssignment[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExportGenerateResponse | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const loadFilters = useCallback(async () => {
    if (!token || !user) return;
    setLoadingFilters(true); setError("");
    try {
      if (teacher) {
        const rows = await getMyClasses(token);
        setAssignments(rows);
        setClasses(Array.from(new Map(rows.map((row) => [row.class_id, { id: row.class_id, label: `${row.class_code} · ${row.class_name}` }])).values()));
        setYears(Array.from(new Map(rows.map((row) => [row.academic_year_id, { id: row.academic_year_id, label: row.academic_year_name }])).values()));
        setSemesters(Array.from(new Map(rows.map((row) => [row.semester_id, { id: row.semester_id, label: row.semester_name, academic_year_id: row.academic_year_id }])).values()));
      } else {
        const [classRows, yearRows, semesterRows, subjectRows] = await Promise.all([
          apiRequest<Array<{ id: string; code: string; name: string }>>("list_classes", {}, token),
          apiRequest<Array<{ id: string; name: string }>>("list_academic_years", {}, token),
          apiRequest<Array<{ id: string; name: string; academic_year_id?: string }>>("list_semesters", {}, token),
          apiRequest<Array<{ id: string; code: string; name: string }>>("list_subjects", {}, token),
        ]);
        setClasses(classRows.map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` })));
        setYears(yearRows.map((row) => ({ id: row.id, label: row.name })));
        setSemesters(semesterRows.map((row) => ({ id: row.id, label: row.name, academic_year_id: row.academic_year_id })));
        setSubjects(subjectRows.map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` })));
      }
    } catch (cause) { setError(exportErrorMessage(cause)); }
    finally { setLoadingFilters(false); }
  }, [teacher, token, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadFilters(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFilters]);

  const availableAssignments = useMemo(() => assignments.filter((row) => (!form.class_id || row.class_id === form.class_id) && (!form.academic_year_id || row.academic_year_id === form.academic_year_id) && (!form.semester_id || row.semester_id === form.semester_id)), [assignments, form]);
  const visibleClasses = teacher && (form.academic_year_id || form.semester_id) ? classes.filter((item) => availableAssignments.some((row) => row.class_id === item.id)) : classes;
  const visibleYears = teacher && (form.class_id || form.semester_id) ? years.filter((item) => availableAssignments.some((row) => row.academic_year_id === item.id)) : years;
  const visibleSemesters = semesters.filter((item) => (!form.academic_year_id || !item.academic_year_id || item.academic_year_id === form.academic_year_id) && (!teacher || (!form.class_id || assignments.some((row) => row.class_id === form.class_id && row.semester_id === item.id))));

  useEffect(() => {
    if (!token || !form.class_id || !form.academic_year_id || !form.semester_id || type !== "academic_scores_csv") return;
    if (teacher) {
      listMyClassSubjects(token, { class_id: form.class_id, academic_year_id: form.academic_year_id, semester_id: form.semester_id }).then((rows: MyClassSubject[]) => setSubjects(rows.map((row) => ({ id: row.subject_id, label: `${row.subject_code} · ${row.subject_name}` })))).catch((cause) => setError(exportErrorMessage(cause)));
    }
  }, [form.academic_year_id, form.class_id, form.semester_id, teacher, token, type]);

  function update(field: keyof FormState, value: string) { setForm((current) => ({ ...current, [field]: value, ...(field !== "subject_id" ? { subject_id: "" } : {}) })); setResult(null); setError(""); }
  function changeType(value: ExportType) { setType(value); setForm(EMPTY_FORM); setScope("filtered"); setResult(null); setError(""); }

  const requiresFilters = teacher || type !== "students_csv" || scope === "filtered";
  const validAssignment = !teacher || assignments.some((row) => row.class_id === form.class_id && row.academic_year_id === form.academic_year_id && row.semester_id === form.semester_id);
  const valid = !requiresFilters || Boolean(form.class_id && form.academic_year_id && form.semester_id && validAssignment && (type !== "academic_scores_csv" || form.subject_id));

  async function generate() {
    if (!token || generating || !valid) return;
    setGenerating(true); setError(""); setResult(null);
    try {
      let response: ExportGenerateResponse;
      if (type === "students_csv") response = await exportStudentsCsv(token, scope === "all" && !teacher ? {} : { class_id: form.class_id, academic_year_id: form.academic_year_id, semester_id: form.semester_id });
      else if (type === "academic_scores_csv") response = await exportAcademicScoresCsv(token, form);
      else response = await exportCharacterSummaryCsv(token, { class_id: form.class_id, academic_year_id: form.academic_year_id, semester_id: form.semester_id });
      setResult(response); setHistoryRefresh((value) => value + 1);
    } catch (cause) { setError(exportErrorMessage(cause)); }
    finally { setGenerating(false); }
  }

  async function downloadNow() {
    if (!token || !result?.export_id || downloading) return;
    setDownloading(true); setError("");
    try {
      const response = await downloadReportExport(token, result.export_id);
      downloadBase64File({
        base64_content: response.base64_content,
        mime_type: response.mime_type || "text/csv",
        file_name: response.file_name,
      });
    }
    catch (cause) { setError(exportErrorMessage(cause)); }
    finally { setDownloading(false); }
  }

  if (!user || !token) return null;
  const selectClass = "mt-1.5 w-full rounded-[12px] border border-zinc-300 bg-white px-3 py-2.5 disabled:opacity-60 dark:border-zinc-700 dark:bg-[#171717]";
  return <div className="mx-auto w-full max-w-7xl space-y-6"><PageHeader title="Export CSV" description="Buat dan unduh export data sekolah dengan akses yang terkontrol." />
    <div className="flex rounded-[12px] bg-zinc-100 p-1 dark:bg-[#171717]" role="tablist"><button type="button" role="tab" aria-selected={tab === "new"} onClick={() => setTab("new")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "new" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500"}`}>Export Baru</button><button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "history" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500"}`}>Riwayat</button></div>
    {tab === "history" ? <ExportHistory token={token} refreshKey={historyRefresh} /> : <section className="space-y-5 rounded-[20px] border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-[#171717]"><label className="block text-sm font-medium">Jenis export<select value={type} onChange={(event) => changeType(event.target.value as ExportType)} className={selectClass}>{TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {type === "students_csv" && !teacher && <fieldset><legend className="text-sm font-medium">Scope data</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className={`rounded-[12px] border p-3 ${scope === "filtered" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-700"}`}><input type="radio" name="scope" checked={scope === "filtered"} onChange={() => setScope("filtered")} className="mr-2" />Per kelas/periode</label><label className={`rounded-[12px] border p-3 ${scope === "all" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-zinc-200 dark:border-zinc-700"}`}><input type="radio" name="scope" checked={scope === "all"} onChange={() => { setScope("all"); setForm(EMPTY_FORM); }} className="mr-2" />Semua siswa</label></div>{scope === "all" && <p role="alert" className="mt-3 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Export ini akan mengambil seluruh data siswa yang dapat Anda akses.</p>}</fieldset>}
      {requiresFilters && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Tahun ajaran<select disabled={loadingFilters} value={form.academic_year_id} onChange={(event) => update("academic_year_id", event.target.value)} className={selectClass}><option value="">Pilih tahun ajaran</option>{visibleYears.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Semester<select disabled={loadingFilters} value={form.semester_id} onChange={(event) => update("semester_id", event.target.value)} className={selectClass}><option value="">Pilih semester</option>{visibleSemesters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Kelas<select disabled={loadingFilters} value={form.class_id} onChange={(event) => update("class_id", event.target.value)} className={selectClass}><option value="">Pilih kelas</option>{visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{type === "academic_scores_csv" && <label className="text-sm font-medium">Mata pelajaran<select disabled={loadingFilters || !form.class_id || !form.academic_year_id || !form.semester_id} value={form.subject_id} onChange={(event) => update("subject_id", event.target.value)} className={selectClass}><option value="">Pilih mata pelajaran</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</div>}
      {error && <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
      <button type="button" disabled={generating || loadingFilters || !valid} onClick={() => void generate()} className="w-full rounded-[12px] bg-[#468432] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{generating ? "Membuat CSV..." : "Buat CSV"}</button>
      {result && <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"><h2 className="font-bold text-emerald-800 dark:text-emerald-200">Export berhasil dibuat</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-zinc-500">Nama file</dt><dd className="break-all font-semibold">{result.file_name}</dd></div><div><dt className="text-zinc-500">Total baris</dt><dd className="font-semibold">{result.total_rows ?? 0}</dd></div><div><dt className="text-zinc-500">Export ID</dt><dd className="break-all font-mono text-xs">{result.export_id}</dd></div></dl><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={!result.download_available || downloading} onClick={() => void downloadNow()} className="w-full rounded-[12px] bg-[#468432] px-4 py-2.5 font-semibold text-white disabled:opacity-50">{downloading ? "Menyiapkan..." : "Download Sekarang"}</button><button type="button" onClick={() => setTab("history")} className="w-full rounded-[12px] border border-emerald-600 px-4 py-2.5 font-semibold text-emerald-700 dark:text-emerald-300">Lihat Riwayat</button></div></div>}
    </section>}
  </div>;
}
