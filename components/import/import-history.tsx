"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { downloadImportErrorReport, ImportLog, ImportLogStatus, ImportType, listImportLogs } from "@/lib/api/imports";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-states";
import { downloadBase64File } from "@/lib/utils/files";

const TYPE_LABELS: Record<ImportType, string> = { students: "Siswa", teachers: "Guru", classes: "Kelas", subjects: "Mata pelajaran", class_subjects: "Mapel kelas", academic_scores: "Nilai akademik", culture_scores: "Nilai budaya" };
const STATUS_LABELS: Record<ImportLogStatus, string> = { previewed: "Pratinjau", success: "Berhasil", partial_success: "Berhasil sebagian", failed: "Gagal" };

function messageForError(error: unknown) {
  if (error instanceof ApiError && error.code === "ERR_FORBIDDEN") return "Anda tidak memiliki izin untuk melihat atau mengunduh riwayat ini.";
  if (error instanceof ApiError && error.code === "NETWORK_ERROR") return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
  return "Riwayat import tidak dapat dimuat. Coba lagi.";
}

function LogFacts({ log }: { log: ImportLog }) {
  return <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800"><b className="block text-base">{log.total_rows}</b>Total</div><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><b className="block text-base">{log.success_rows}</b>Sukses</div><div className="rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-950/40 dark:text-red-300"><b className="block text-base">{log.error_rows}</b>Error</div></div>;
}

export function ImportHistory({ token, allowedTypes, refreshKey = 0 }: { token: string; allowedTypes: ImportType[]; refreshKey?: number }) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [importType, setImportType] = useState<ImportType | "">("");
  const [status, setStatus] = useState<ImportLogStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  const load = useCallback(async () => {
    void refreshKey;
    setLoading(true); setError("");
    try {
      const result = await listImportLogs(token, { page, page_size: 20, import_type: importType, status });
      setLogs(result.logs); setTotalPages(result.total_pages);
    } catch (cause) { setError(messageForError(cause)); }
    finally { setLoading(false); }
  }, [token, page, importType, status, refreshKey]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function download(log: ImportLog) {
    if (!log.error_report_file_id || downloadingId) return;
    setDownloadingId(log.id); setError("");
    try {
      const report = await downloadImportErrorReport(token, log.error_report_file_id);
      downloadBase64File({
        base64_content: report.base64_content,
        mime_type: report.mime_type || "text/csv",
        file_name: report.file_name,
      });
    } catch (cause) { setError(messageForError(cause)); }
    finally { setDownloadingId(""); }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Jenis import<select value={importType} onChange={(e) => { setImportType(e.target.value as ImportType | ""); setPage(1); }} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"><option value="">Semua jenis</option>{allowedTypes.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label>
        <label className="text-sm font-medium">Status<select value={status} onChange={(e) => { setStatus(e.target.value as ImportLogStatus | ""); setPage(1); }} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"><option value="">Semua status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading ? <LoadingState message="Memuat riwayat import..." /> : logs.length === 0 ? <EmptyState title="Belum ada riwayat" description="Riwayat import akan muncul setelah file divalidasi." /> : (
        <>
          <div className="space-y-3 md:hidden">{logs.map((log) => <article key={log.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{log.file_name}</h3><p className="text-xs text-zinc-500">{TYPE_LABELS[log.import_type]} · {new Date(log.created_at).toLocaleString("id-ID")}</p><p className="text-xs text-zinc-500">Oleh {log.uploader_name}</p></div><span className="h-fit shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold dark:bg-zinc-800">{STATUS_LABELS[log.status] || log.status}</span></div><div className="mt-3"><LogFacts log={log} /></div>{log.error_report_file_id && <button type="button" disabled={Boolean(downloadingId)} onClick={() => void download(log)} className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700">{downloadingId === log.id ? "Menyiapkan laporan..." : "Download laporan error"}</button>}</article>)}</div>
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-900"><tr>{["Tanggal", "Jenis", "Nama file", "Uploader", "Total", "Sukses", "Error", "Status", "Aksi"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{logs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-4 py-3">{new Date(log.created_at).toLocaleString("id-ID")}</td><td className="px-4 py-3">{TYPE_LABELS[log.import_type]}</td><td className="max-w-52 truncate px-4 py-3 font-medium">{log.file_name}</td><td className="px-4 py-3">{log.uploader_name}</td><td className="px-4 py-3">{log.total_rows}</td><td className="px-4 py-3 text-emerald-600">{log.success_rows}</td><td className="px-4 py-3 text-red-600">{log.error_rows}</td><td className="px-4 py-3">{STATUS_LABELS[log.status] || log.status}</td><td className="px-4 py-3">{log.error_report_file_id ? <button type="button" disabled={Boolean(downloadingId)} onClick={() => void download(log)} className="font-semibold text-emerald-600 disabled:opacity-50">{downloadingId === log.id ? "Menyiapkan..." : "Laporan error"}</button> : "-"}</td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700">Sebelumnya</button><span className="text-sm text-zinc-500">Halaman {page} dari {Math.max(totalPages, 1)}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700">Berikutnya</button></div>
        </>
      )}
    </section>
  );
}
