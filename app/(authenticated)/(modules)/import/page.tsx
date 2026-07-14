"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { confirmImportData, createImportSession, downloadImportErrorReport, getImportTemplate, ImportConfirmResponse, ImportSummary, ImportType } from "@/lib/api/imports";
import { buildTemplateCsv, downloadCsvFile, readCsvFile } from "@/lib/utils/csv";
import { PageHeader } from "@/components/ui-states";
import { InfoBanner } from "@/components/ui/info-banner";
import { ImportUpload } from "@/components/import/import-upload";
import { ImportPreview } from "@/components/import/import-preview";
import { ImportConfirmDialog } from "@/components/import/import-confirm-dialog";
import { ImportHistory } from "@/components/import/import-history";
import { downloadBase64File } from "@/lib/utils/files";

const ALL_TYPES: Array<{ value: ImportType; label: string }> = [
  { value: "students", label: "Siswa" }, { value: "teachers", label: "Guru" }, { value: "classes", label: "Kelas" }, { value: "subjects", label: "Mata pelajaran" }, { value: "class_subjects", label: "Mapel kelas" }, { value: "academic_scores", label: "Nilai akademik" }, { value: "culture_scores", label: "Nilai budaya" },
];

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const apiErr = error as { code: string; message: string };
    if (apiErr.code === "ERR_ROW_LIMIT_EXCEEDED") return "Jumlah baris melebihi batas untuk jenis import ini. Kurangi data atau bagi menjadi beberapa file.";
    if (apiErr.code === "ERR_FORBIDDEN") return "Anda tidak memiliki izin untuk melakukan import jenis data ini.";
    if (apiErr.code === "ERR_PERIOD_LOCKED") return "Sebagian data berada pada periode yang sudah dikunci dan tidak dapat diubah.";
    if (apiErr.code === "NETWORK_ERROR") return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
    if (/csv|parse|column|header/i.test(apiErr.message || "")) return "File CSV tidak dapat dibaca. Gunakan template yang disediakan.";
  }
  return error instanceof Error ? error.message : "Terjadi kendala saat memproses import. Coba lagi.";
}

export default function ImportPage() {
  const { user, token } = useAuth();
  const allowedOptions = useMemo(() => user?.role === "teacher" ? ALL_TYPES.filter((item) => item.value === "academic_scores" || item.value === "culture_scores") : ALL_TYPES, [user?.role]);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [importType, setImportType] = useState<ImportType>(user?.role === "teacher" ? "academic_scores" : "students");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportConfirmResponse | null>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "validating" | "importing">("idle");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedSession, setConfirmedSession] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const busy = stage !== "idle";
  const typeLabel = ALL_TYPES.find((item) => item.value === importType)?.label || importType;

  function changeType(value: ImportType) { setImportType(value); setFile(null); setPreview(null); setResult(null); setError(""); setConfirmedSession(""); }
  function changeFile(value: File | null) { setFile(value); setPreview(null); setResult(null); setError(""); setConfirmedSession(""); }

  async function downloadTemplate() {
    if (!token || busy) return;
    setError("");
    try { const template = await getImportTemplate(token, importType); downloadCsvFile(buildTemplateCsv(template), `template_${importType}.csv`); }
    catch (cause) { setError(errorMessage(cause)); }
  }

  async function validateFile() {
    if (!file || !token || busy) return;
    setError(""); setPreview(null); setResult(null);
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Pilih file dengan format CSV."); return; }
    if (file.size === 0) { setError("File CSV kosong. Isi template terlebih dahulu."); return; }
    try {
      setStage("reading"); const content = await readCsvFile(file);
      if (!content.trim()) { setError("File CSV kosong. Isi template terlebih dahulu."); return; }
      const file_content_base64 = btoa(unescape(encodeURIComponent(content)));
      setStage("validating"); const response = await createImportSession(token, { import_type: importType, file_name: file.name, file_content_base64 });
      setPreview(response);
      if (response.status === "failed") setError("Import tidak dapat diproses. Periksa error dan laporan yang tersedia.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setStage("idle"); }
  }

  async function confirm() {
    if (!preview || !token || busy || preview.valid_rows <= 0 || confirmedSession === preview.import_log_id) return;
    setStage("importing"); setError("");
    try {
      const response = await confirmImportData(token, preview.import_log_id);
      setResult(response); setConfirmedSession(preview.import_log_id); setConfirmOpen(false); setHistoryRefresh((value) => value + 1);
      if (response.status === "partial_success") setError("Import selesai sebagian. Baris valid berhasil diproses, sebagian baris gagal.");
      if (response.status === "failed") setError("Import tidak berhasil diproses. Periksa laporan error.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setStage("idle"); }
  }

  async function downloadReport() {
    const reportId = preview?.error_report_file_id;
    if (!token || !reportId || downloading) return;
    setDownloading(true);
    try {
      const report = await downloadImportErrorReport(token, reportId);
      downloadBase64File({
        base64_content: report.base64_content,
        mime_type: report.mime_type || "text/csv",
        file_name: report.file_name,
      });
    }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setDownloading(false); }
  }

  if (!user || !token) return null;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader title="Import Data" description="Validasi dan import data sekolah melalui file CSV." />
      <div className="flex rounded-[12px] bg-zinc-100 p-1 dark:bg-[#171717]" role="tablist"><button type="button" role="tab" aria-selected={tab === "new"} onClick={() => setTab("new")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "new" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500"}`}>Import Baru</button><button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === "history" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500"}`}>Riwayat</button></div>
      {tab === "history" ? <ImportHistory token={token} allowedTypes={allowedOptions.map((item) => item.value)} refreshKey={historyRefresh} /> : (
        <div className="space-y-6">
          {/* Instruksi format CSV — H6: Recognition Rather Than Recall, H10: Help & Documentation */}
          <InfoBanner
            variant="info"
            title="Format File yang Didukung"
            description="Gunakan file CSV dengan pembatas koma (,) dan encoding UTF-8. Unduh template terlebih dahulu untuk memastikan susunan kolom sesuai. File Excel (.xlsx) tidak didukung secara langsung — simpan sebagai CSV terlebih dahulu melalui menu File → Save As → CSV."
            dismissible
          />
          <ImportUpload importType={importType} typeOptions={allowedOptions} file={file} busy={busy} onTypeChange={changeType} onDownloadTemplate={() => void downloadTemplate()} onFileChange={changeFile} onPreview={() => void validateFile()} />
          {stage !== "idle" && <div className="rounded-[12px] bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{stage === "reading" ? "Membaca file..." : stage === "validating" ? "Memvalidasi data..." : "Mengimpor data..."}</div>}
          {error && <InfoBanner variant="error" description={error} />}
          {preview && <ImportPreview preview={preview} />}
          {preview?.update_count ? <InfoBanner variant="warning" description="Import ini akan memperbarui data lama. Periksa perubahan sebelum melanjutkan." /> : null}
          {preview && preview.error_count > 0 && preview.valid_rows > 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">Baris valid tetap dapat diproses. Baris error akan dilewati.</p>}
          {preview?.error_report_file_id && <button type="button" disabled={downloading} onClick={() => void downloadReport()} className="w-full rounded-[12px] border border-red-300 px-4 py-3 font-semibold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300">{downloading ? "Menyiapkan laporan..." : "Download laporan error"}</button>}
          {preview && !confirmedSession && <button type="button" disabled={busy || preview.valid_rows <= 0 || !preview.import_log_id} onClick={() => setConfirmOpen(true)} className="w-full rounded-[12px] bg-[#468432] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm import ({preview.valid_rows} baris valid)</button>}
          {result && <section className={`rounded-[20px] border p-5 ${result.status === "success" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"}`}><h2 className="text-lg font-bold">{result.status === "success" ? "Import selesai" : result.status === "partial_success" ? "Import selesai sebagian" : "Import gagal"}</h2><div className="mt-3 grid grid-cols-3 gap-3 text-center"><div><b className="block text-2xl">{result.total_rows}</b><span className="text-xs">Total</span></div><div><b className="block text-2xl text-[#468432]">{result.success_rows}</b><span className="text-xs">Sukses</span></div><div><b className="block text-2xl text-red-600">{result.error_rows}</b><span className="text-xs">Error</span></div></div><button type="button" onClick={() => setTab("history")} className="mt-4 w-full rounded-[12px] border border-current px-4 py-2.5 font-semibold">Lihat riwayat</button></section>}
          {preview && <ImportConfirmDialog open={confirmOpen} preview={preview} typeLabel={typeLabel} loading={stage === "importing"} onClose={() => { if (!busy) setConfirmOpen(false); }} onConfirm={() => void confirm()} />}
        </div>
      )}
    </div>
  );
}
