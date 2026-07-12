"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { downloadReportExport, ExportHistoryItem, listExportHistory } from "@/lib/api/exports";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-states";
import { downloadBase64File } from "@/lib/utils/files";

const TYPE_LABELS: Record<string, string> = { students: "Data Siswa", academic: "Nilai Akademik", character: "Nilai Karakter / FITRAH" };
const STATUS_LABELS: Record<string, string> = { completed: "Selesai", failed: "Gagal", archived: "Diarsipkan" };

export function exportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "ERR_FORBIDDEN") return "Anda tidak memiliki izin untuk membuat atau mengunduh export ini.";
    if (error.code === "ERR_NOT_FOUND") return "Data export tidak ditemukan atau sudah tidak tersedia.";
    if (error.code === "ERR_INVALID_EXPORT") return "Data export tidak valid.";
    if (error.code === "ERR_FILE_NOT_FOUND") return "File export sudah tidak tersedia di penyimpanan.";
    if (error.code === "NETWORK_ERROR") return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
    if (/lock timeout|database is busy/i.test(error.message)) return "Server sedang sibuk. Coba lagi beberapa saat.";
  }
  return "Terjadi kendala saat memproses export.";
}

function formatSize(value?: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportHistory({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [items, setItems] = useState<ExportHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listExportHistory(token, { export_type: type || undefined, status: status || undefined, page, page_size: pageSize });
      setItems(result.exports); setTotal(result.total);
    } catch (cause) { setError(exportErrorMessage(cause)); }
    finally { setLoading(false); }
  }, [page, status, token, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  async function download(item: ExportHistoryItem) {
    if (!item.download_available || downloadingId) return;
    setDownloadingId(item.export_id); setError("");
    try {
      const result = await downloadReportExport(token, item.export_id);
      downloadBase64File({
        base64_content: result.base64_content,
        mime_type: result.mime_type || "text/csv",
        file_name: result.file_name,
      });
    } catch (cause) { setError(exportErrorMessage(cause)); }
    finally { setDownloadingId(""); }
  }

  const filters = (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Jenis export<select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"><option value="">Semua jenis</option><option value="students">Data Siswa</option><option value="academic">Nilai Akademik</option><option value="character">Nilai Karakter / FITRAH</option></select></label>
      <label className="text-sm font-medium">Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"><option value="">Semua status</option><option value="completed">Selesai</option><option value="failed">Gagal</option><option value="archived">Diarsipkan</option></select></label>
    </div>
  );

  if (loading) return <div className="space-y-4">{filters}<LoadingState message="Memuat riwayat export..." /></div>;
  if (error && items.length === 0) return <div className="space-y-4">{filters}<ErrorState message={error} onRetry={() => void load()} /></div>;

  return <section className="space-y-4">{filters}{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}{items.length === 0 ? <EmptyState title="Belum Ada Export" description="Belum ada riwayat export untuk filter ini." /> : <>
    <div className="space-y-3 md:hidden">{items.map((item) => <article key={item.export_id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{TYPE_LABELS[item.export_type] || item.export_type}</h3><p className="text-xs text-zinc-500">{item.generated_at ? new Date(item.generated_at).toLocaleString("id-ID") : "-"}</p></div><span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold dark:bg-zinc-800">{STATUS_LABELS[item.status || ""] || item.status || "-"}</span></div><p className="mt-3 break-all text-sm font-medium">{item.file_name}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-zinc-500">Pembuat</dt><dd>{item.generated_by_name || item.generated_by || "-"}</dd></div><div><dt className="text-zinc-500">Ukuran</dt><dd>{formatSize(item.file_size)}</dd></div><div><dt className="text-zinc-500">Total baris</dt><dd>{item.total_rows ?? 0}</dd></div></dl><button type="button" disabled={!item.download_available || Boolean(downloadingId)} onClick={() => void download(item)} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{downloadingId === item.export_id ? "Menyiapkan..." : "Download"}</button></article>)}</div>
    <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 md:block"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-zinc-100 text-xs uppercase text-zinc-500 dark:bg-zinc-900"><tr>{["Tanggal", "Jenis", "Nama File", "Ukuran", "Pembuat", "Total Baris", "Status", "Download"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{items.map((item) => <tr key={item.export_id}><td className="whitespace-nowrap px-4 py-3">{item.generated_at ? new Date(item.generated_at).toLocaleString("id-ID") : "-"}</td><td className="px-4 py-3">{TYPE_LABELS[item.export_type] || item.export_type}</td><td className="max-w-64 truncate px-4 py-3 font-medium">{item.file_name}</td><td className="px-4 py-3">{formatSize(item.file_size)}</td><td className="px-4 py-3">{item.generated_by_name || item.generated_by || "-"}</td><td className="px-4 py-3">{item.total_rows ?? 0}</td><td className="px-4 py-3">{STATUS_LABELS[item.status || ""] || item.status || "-"}</td><td className="px-4 py-3"><button type="button" disabled={!item.download_available || Boolean(downloadingId)} onClick={() => void download(item)} className="font-semibold text-emerald-600 disabled:opacity-50">{downloadingId === item.export_id ? "Menyiapkan..." : "Download"}</button></td></tr>)}</tbody></table></div>
    <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm sm:flex-row dark:border-zinc-800"><span className="text-zinc-700 dark:text-zinc-300">Halaman {page} dari {totalPages} · {total} export</span><div className="flex w-full gap-2 sm:w-auto"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 sm:flex-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Sebelumnya</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 sm:flex-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Berikutnya</button></div></div>
  </>}</section>;
}
