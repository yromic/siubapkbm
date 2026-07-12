"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ExtendedHealthResponse, HealthIssue, HealthSectionData, extendedHealthCheck } from "@/lib/api/health";
import { ErrorState, ForbiddenState, LoadingState, PageHeader, ResponsiveContainer } from "@/components/ui-states";
import { userFacingError } from "@/lib/utils/ui-error";

const SECTION_LABELS: Array<[keyof ExtendedHealthResponse, string]> = [
  ["spreadsheet", "Penyimpanan Data"], ["sheets", "Lembar Data"], ["settings", "Pengaturan"],
  ["drive", "Penyimpanan Berkas"], ["audit", "Catatan Aktivitas"], ["cache", "Data Sementara"],
  ["backup", "Cadangan Data"], ["triggers", "Proses Terjadwal"], ["integrity", "Pemeriksaan Data Terakhir"],
];

function statusClass(status?: string) {
  if (status === "healthy") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "critical") return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
}

function StatusBadge({ status }: { status?: string }) {
  const label = status === "healthy" ? "Sehat" : status === "critical" ? "Kritis" : status === "warning" ? "Peringatan" : "Belum diketahui";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{label}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "Belum pernah dijalankan";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function sectionSummary(section: HealthSectionData) {
  const ignored = new Set(["status", "issues", "checks", "error"]);
  const technicalFields = new Set([
    "id", "spreadsheet_id", "root_folder_id", "rootfolderid", "folder_id", "file_id",
    "drive_file_id", "backup_file_id", "token", "secret", "key", "password", "hash",
  ]);
  return Object.entries(section).filter(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    const sensitive = technicalFields.has(normalizedKey) || /(?:token|secret|password|hash)$/.test(normalizedKey);
    return !ignored.has(key) && !sensitive && (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null);
  }).slice(0, 3);
}

export default function HealthCheckPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<ExtendedHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed = user?.role === "administrator" || user?.role === "admin";
  const load = useCallback(async () => {
    if (!token || !allowed) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { setData(await extendedHealthCheck(token)); }
    catch (err) { setError(userFacingError(err, "Pemeriksaan sistem gagal dimuat. Silakan coba lagi.")); }
    finally { setLoading(false); }
  }, [token, allowed]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sections = useMemo(() => data ? SECTION_LABELS.map(([key, label]) => ({ key, label, data: data[key] as HealthSectionData })) : [], [data]);
  const issues = useMemo(() => sections.flatMap((section) => (section.data.issues || []).map((issue: HealthIssue) => ({ ...issue, section: section.label }))), [sections]);

  if (!user || !allowed) return <ForbiddenState message="Anda tidak memiliki izin untuk mengakses halaman ini." />;
  if (loading && !data) return <LoadingState message="Memeriksa kondisi sistem..." />;

  return <ResponsiveContainer className="space-y-6 py-6">
    <PageHeader title="Pemeriksaan Sistem" description="Status operasional, peringatan, dan tindakan yang perlu diperhatikan." actions={
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-[12px] bg-[#468432] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Memeriksa..." : "Periksa Lagi"}
      </button>
    } />

    {error && <ErrorState message={error} onRetry={() => void load()} />}
    {data && <>
      <section className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#171717]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm text-zinc-500">Status keseluruhan</p><div className="mt-2"><StatusBadge status={data.status} /></div></div>
          <div className="text-left sm:text-right"><p className="text-sm text-zinc-500">Terakhir diperiksa</p><p className="mt-1 font-medium">{formatDate(data.summary.checked_at)}</p></div>
        </div>
        <div className="mt-4 flex gap-4 text-sm"><span>{data.summary.criticals} kritis</span><span>{data.summary.warnings} peringatan</span></div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => <section key={String(section.key)} className="rounded-[20px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#171717]">
          <div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{section.label}</h2><StatusBadge status={section.data.status} /></div>
          {section.key === "integrity" && <div className="mt-4 rounded-[12px] bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"><strong>Terakhir dijalankan:</strong> {formatDate(data.integrity.last_run)}</div>}
        </section>)}
      </div>

      <section className="space-y-3"><h2 className="text-lg font-bold">Masalah Ditemukan</h2>
        {issues.length === 0 ? <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">Sistem belum menemukan masalah pada pemeriksaan terakhir.</div> :
          <div className="grid gap-3 md:grid-cols-2">{issues.map((issue, index) => <article key={`${issue.code}-${index}`} className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#171717]">
            <div className="flex items-start justify-between gap-3"><p className="font-semibold">{issue.section}</p><StatusBadge status={issue.severity} /></div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Bagian ini perlu diperiksa oleh pengelola sistem.</p>
          </article>)}</div>}
      </section>
      <details className="rounded-[20px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#171717]">
        <summary className="cursor-pointer font-semibold">Detail Teknis</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{sections.map((section) => <section key={String(section.key)} className="rounded-[12px] bg-zinc-50 p-4 text-xs dark:bg-zinc-800">
          <h3 className="font-semibold">{section.label}</h3>
          <dl className="mt-3 space-y-2">{sectionSummary(section.data).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt>{key.replaceAll("_", " ")}</dt><dd className="max-w-[60%] truncate font-medium">{String(value ?? "-")}</dd></div>)}</dl>
        </section>)}</div>
      </details>
    </>}
  </ResponsiveContainer>;
}
