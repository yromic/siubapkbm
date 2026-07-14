"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, StaffUser } from "@/lib/api/client";
import {
  archiveStudentFile,
  getStudentFileAccess,
  listStudentFiles,
  replaceStudentFile,
  StudentFileRecord,
  StudentFileType,
  STUDENT_FILE_TYPES,
  uploadStudentFile,
} from "@/lib/api/documents";
import {
  ALLOWED_STUDENT_FILE_MIME_TYPES,
  base64ToBlob,
  buildDriveViewerUrl,
  fileToBase64,
  formatFileSize,
  MAX_STUDENT_FILE_MB,
  validateFileSize,
  validateMimeType,
} from "@/lib/utils/files";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui-states";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";

const SENSITIVE_FILE_TYPES: StudentFileType[] = ["kk", "akta", "dokumen_lain"];

const FILE_TYPE_LABELS: Record<StudentFileType, string> = {
  foto: "Foto",
  pas_foto: "Pas Foto",
  kk: "KK",
  akta: "Akta",
  dokumen_lain: "Dokumen Lain",
};

const STATUS_LABELS: Record<StudentFileRecord["status"], string> = {
  active: "Aktif",
  archived: "Diarsipkan",
  replaced: "Digantikan",
};

function isSensitiveFileType(fileType: StudentFileType): boolean {
  return SENSITIVE_FILE_TYPES.includes(fileType);
}

function canManageDocuments(user: StaffUser | null): boolean {
  return user?.role === "administrator" || user?.role === "admin";
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileTypeBadge({ fileType }: { fileType: StudentFileType }) {
  const sensitive = isSensitiveFileType(fileType);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        sensitive
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
      }`}
    >
      {FILE_TYPE_LABELS[fileType]}
    </span>
  );
}

function StatusBadge({ status }: { status: StudentFileRecord["status"] }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
      : status === "replaced"
      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

interface StudentFilesPanelProps {
  studentId: string;
  token: string;
  user: StaffUser | null;
  mode?: "admin" | "teacher";
}

export function StudentFilesPanel({
  studentId,
  token,
  user,
  mode = "admin",
}: StudentFilesPanelProps) {
  const [files, setFiles] = useState<StudentFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  const [archivingFileId, setArchivingFileId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<StudentFileRecord | null>(null);
  const [sensitiveConfirmFile, setSensitiveConfirmFile] = useState<StudentFileRecord | null>(null);
  const [archiveConfirmFile, setArchiveConfirmFile] = useState<StudentFileRecord | null>(null);

  const mayManage = mode === "admin" && canManageDocuments(user);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStudentFiles(studentId, token);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dokumen siswa.");
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => {
    setTimeout(() => loadFiles(), 0);
  }, [loadFiles]);

  const groupedFiles = useMemo(() => {
    return STUDENT_FILE_TYPES.map((fileType) => ({
      fileType,
      files: files.filter((file) => file.file_type === fileType),
    })).filter((group) => group.files.length > 0);
  }, [files]);

  const handleView = async (file: StudentFileRecord) => {
    setActionError(null);
    setViewingFileId(file.id);
    try {
      const access = await getStudentFileAccess(file.id, token);
      const blob = base64ToBlob(access.base64_content, access.mime_type);
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
        const a = document.createElement("a");
        a.href = url;
        a.download = access.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      notify.success("Dokumen berhasil dibuka.");
    } catch (err) {
      const isForbidden = err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_FORBIDDEN";
      const fallback = isForbidden
          ? "Anda tidak memiliki izin untuk membuka dokumen ini."
          : "Gagal membuka dokumen.";
      const msg = err instanceof Error ? err.message || fallback : fallback;
      setActionError(msg);
      notify.error(msg);
    } finally {
      setViewingFileId(null);
    }
  };

  const handleArchive = async (file: StudentFileRecord) => {
    setActionError(null);
    setArchivingFileId(file.id);
    try {
      await archiveStudentFile(file.id, token);
      notify.success("Dokumen berhasil diarsipkan.");
      await loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengarsipkan dokumen.";
      setActionError(msg);
      notify.error(msg);
    } finally {
      setArchivingFileId(null);
    }
  };

  if (loading) return <LoadingState message="Memuat dokumen siswa..." />;

  if (error) {
    return <ErrorState message={error} onRetry={loadFiles} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
            Dokumen Siswa
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            File dibuka melalui akses aman backend. Dokumen sensitif dicatat saat dilihat.
          </p>
        </div>
        {mayManage && (
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Upload Dokumen
          </button>
        )}
      </div>

      {mode === "teacher" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          Dokumen sensitif hanya dapat diakses operator sekolah. Guru hanya melihat dokumen non-sensitif yang diizinkan backend.
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
          {actionError}
        </div>
      )}

      {files.length === 0 ? (
        <EmptyState
          title="Belum Ada Dokumen"
          description={
            mode === "teacher"
              ? "Tidak ada dokumen non-sensitif yang tersedia untuk siswa ini."
              : "Belum ada dokumen yang diunggah untuk siswa ini."
          }
        />
      ) : (
        <div className="space-y-4">
          {groupedFiles.map((group) => (
            <section
              key={group.fileType}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileTypeBadge fileType={group.fileType} />
                  {isSensitiveFileType(group.fileType) && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                      Sensitif
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-zinc-400">
                  {group.files.length} versi
                </span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {group.files.map((file) => (
                  <div
                    key={file.id}
                    className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {file.original_filename}
                        </p>
                        <StatusBadge status={file.status} />
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          v{file.version || "-"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{file.mime_type || "-"}</span>
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>Upload: {formatDateTime(file.uploaded_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <button
                        onClick={() => {
                          if (isSensitiveFileType(file.file_type)) {
                            setSensitiveConfirmFile(file);
                          } else {
                            void handleView(file);
                          }
                        }}
                        disabled={viewingFileId === file.id}
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {viewingFileId === file.id ? "Membuka..." : "View"}
                      </button>
                      {mayManage && (
                        <>
                          <button
                            onClick={() => setReplaceTarget(file)}
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => setArchiveConfirmFile(file)}
                            disabled={archivingFileId === file.id}
                            className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-955/20"
                          >
                            {archivingFileId === file.id ? "Archive..." : "Archive"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {uploadOpen && user && (
        <UploadStudentFileModal
          studentId={studentId}
          token={token}
          actorUserId={user.id}
          onClose={() => setUploadOpen(false)}
          onDone={async () => {
            setUploadOpen(false);
            await loadFiles();
          }}
        />
      )}

      {replaceTarget && user && (
        <ReplaceStudentFileModal
          target={replaceTarget}
          token={token}
          actorUserId={user.id}
          onClose={() => setReplaceTarget(null)}
          onDone={async () => {
            setReplaceTarget(null);
            await loadFiles();
          }}
        />
      )}
      <ConfirmDialog
        open={sensitiveConfirmFile !== null}
        onOpenChange={(open) => { if (!open) setSensitiveConfirmFile(null); }}
        title="Buka Dokumen Sensitif?"
        description="Dokumen ini sensitif. Akses akan dicatat di audit log. Lanjutkan membuka file?"
        confirmLabel="Ya, Lanjutkan"
        variant="default"
        onConfirm={() => {
          if (sensitiveConfirmFile) {
            void handleView(sensitiveConfirmFile);
          }
        }}
      />

      <ConfirmDialog
        open={archiveConfirmFile !== null}
        onOpenChange={(open) => { if (!open) setArchiveConfirmFile(null); }}
        title="Arsipkan Dokumen?"
        description={
          archiveConfirmFile
            ? `Apakah Anda yakin ingin mengarsipkan dokumen "${archiveConfirmFile.original_filename}"? File tidak akan dihapus permanen.`
            : ""
        }
        confirmLabel="Ya, Arsipkan"
        variant="destructive"
        onConfirm={() => {
          if (archiveConfirmFile) {
            void handleArchive(archiveConfirmFile);
          }
        }}
      />
    </div>
  );
}

function FileInputSummary({ file }: { file: File | null }) {
  if (!file) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      <div className="font-semibold text-zinc-800 dark:text-zinc-100">{file.name}</div>
      <div className="mt-1">
        {file.type || "unknown"} · {formatFileSize(file.size)}
      </div>
    </div>
  );
}

interface UploadModalProps {
  studentId: string;
  token: string;
  actorUserId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}

function UploadStudentFileModal({
  studentId,
  token,
  actorUserId,
  onClose,
  onDone,
}: UploadModalProps) {
  const [fileType, setFileType] = useState<StudentFileType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!fileType) {
      setError("Jenis dokumen wajib dipilih.");
      return;
    }
    if (!file) {
      setError("File wajib dipilih.");
      return;
    }
    if (!validateFileSize(file, MAX_STUDENT_FILE_MB)) {
      setError("Ukuran file maksimal 2 MB.");
      return;
    }
    if (!validateMimeType(file, ALLOWED_STUDENT_FILE_MIME_TYPES)) {
      setError("Format file harus JPG, PNG, atau PDF.");
      return;
    }

    setSubmitting(true);
    try {
      const base64 = await fileToBase64(file);
      await uploadStudentFile(
        {
          student_id: studentId,
          file_type: fileType,
          file_content_base64: base64,
          original_filename: file.name,
        },
        token
      );
      setSuccess(true);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload dokumen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FileModalFrame title="Upload Dokumen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FileTypeSelect value={fileType} onChange={setFileType} />
        <FilePicker onFile={setFile} />
        <FileInputSummary file={file} />
        {error && <ModalError message={error} />}
        {success && <ModalSuccess message="Dokumen berhasil diupload." />}
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="Upload" />
      </form>
    </FileModalFrame>
  );
}

interface ReplaceModalProps {
  target: StudentFileRecord;
  token: string;
  actorUserId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}

function ReplaceStudentFileModal({
  target,
  token,
  actorUserId,
  onClose,
  onDone,
}: ReplaceModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!file) {
      setError("File baru wajib dipilih.");
      return;
    }
    if (!validateFileSize(file, MAX_STUDENT_FILE_MB)) {
      setError("Ukuran file maksimal 2 MB.");
      return;
    }
    if (!validateMimeType(file, ALLOWED_STUDENT_FILE_MIME_TYPES)) {
      setError("Format file harus JPG, PNG, atau PDF.");
      return;
    }

    setSubmitting(true);
    try {
      const base64 = await fileToBase64(file);
      await replaceStudentFile(
        {
          id: target.id,
          student_id: target.student_id,
          file_type: target.file_type,
          file_content_base64: base64,
          original_filename: file.name,
        },
        token
      );
      setSuccess(true);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal replace dokumen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FileModalFrame title="Replace Dokumen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          File lama tidak dihapus, akan ditandai replaced.
        </div>
        <div className="text-xs text-zinc-500">
          Target: <strong>{FILE_TYPE_LABELS[target.file_type]}</strong> · {target.original_filename}
        </div>
        <FilePicker onFile={setFile} />
        <FileInputSummary file={file} />
        {error && <ModalError message={error} />}
        {success && <ModalSuccess message="Dokumen berhasil direplace." />}
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="Replace" />
      </form>
    </FileModalFrame>
  );
}

function FileModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:rounded-3xl sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <div className="flex items-start justify-between mb-4 shrink-0">
              <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FileTypeSelect({
  value,
  onChange,
}: {
  value: StudentFileType | "";
  onChange: (value: StudentFileType | "") => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Jenis Dokumen
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StudentFileType | "")}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <option value="">Pilih jenis dokumen...</option>
        {STUDENT_FILE_TYPES.map((type) => (
          <option key={type} value={type}>
            {FILE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilePicker({ onFile }: { onFile: (file: File | null) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        File
      </label>
      <input
        type="file"
        accept={ALLOWED_STUDENT_FILE_MIME_TYPES.join(",")}
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:file:bg-zinc-800 dark:file:text-zinc-200"
      />
      <p className="mt-1.5 text-xs text-zinc-500">
        Maksimal 2 MB. Format: JPG, PNG, PDF.
      </p>
    </div>
  );
}

function ModalError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
      {message}
    </div>
  );
}

function ModalSuccess({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
      {message}
    </div>
  );
}

function ModalActions({
  onClose,
  submitting,
  submitLabel,
}: {
  onClose: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Batal
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-w-24 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {submitting ? "Menyimpan..." : submitLabel}
      </button>
    </div>
  );
}
