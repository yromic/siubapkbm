"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Paperclip,
  Plus,
  Trash2,
  Edit2,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  File,
  X,
  ExternalLink,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RPMAttachment,
  RPMAttachmentType,
  RPM_ATTACHMENT_TYPES,
  RPM_ATTACHMENT_TYPE_LABELS,
} from "@/types/rpmAttachment";
import {
  fetchRpmAttachments,
  uploadRpmAttachmentApi,
  updateRpmAttachmentMetadataApi,
  deleteRpmAttachmentApi,
  reorderRpmAttachmentsApi,
} from "@/lib/api/rpmAttachments";
import { formatFileSize, formatAttachmentType } from "@/lib/utils/rpmAttachmentUtils";

interface RPMAttachmentSectionProps {
  documentId?: string | null;
  initialAttachments?: RPMAttachment[];
  onSaveAndOpenAttachments?: () => Promise<void>;
  onAttachmentsChange?: (attachments: RPMAttachment[]) => void;
  readOnly?: boolean;
}

export function RPMAttachmentSection({
  documentId,
  initialAttachments,
  onSaveAndOpenAttachments,
  onAttachmentsChange,
  readOnly = false,
}: RPMAttachmentSectionProps) {
  const [attachments, setAttachments] = useState<RPMAttachment[]>(initialAttachments || []);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const isInitialMount = useRef(true);

  // Sync with initialAttachments when provided or updated
  useEffect(() => {
    if (initialAttachments && initialAttachments.length > 0 && attachments.length === 0) {
      setAttachments(initialAttachments);
    }
  }, [initialAttachments]);

  // Notify parent component whenever attachments state changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // On mount, only notify parent if we actually have non-empty attachments
      if (attachments.length > 0) {
        onAttachmentsChange?.(attachments);
      }
      return;
    }
    onAttachmentsChange?.(attachments);
  }, [attachments, onAttachmentsChange]);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<RPMAttachmentType>("LKPD");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit metadata modal state
  const [editingAttachment, setEditingAttachment] = useState<RPMAttachment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<RPMAttachmentType>("LKPD");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview modal state
  const [previewAttachment, setPreviewAttachment] = useState<RPMAttachment | null>(null);

  // Reorder loading state
  const [isReordering, setIsReordering] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load attachments whenever documentId changes
  useEffect(() => {
    if (!documentId) {
      setAttachments([]);
      return;
    }

    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchRpmAttachments(documentId!);
        if (isMounted) setAttachments(data);
      } catch (err: any) {
        console.error("Failed to load RPM attachments:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit on client
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar. Batas maksimum ukuran berkas adalah 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      const ext = file.name.lastIndexOf(".") > 0 ? file.name.substring(0, file.name.lastIndexOf(".")) : file.name;
      setUploadTitle(ext.replace(/[_-]+/g, " ").trim());
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) return;

    if (!selectedFile) {
      toast.error("Silakan pilih file dokumen terlebih dahulu.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("attachment_type", uploadType);
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim());
      if (uploadDescription.trim()) formData.append("description", uploadDescription.trim());

      const created = await uploadRpmAttachmentApi(documentId, formData);
      setAttachments((prev) => [...prev, created]);
      toast.success("Lampiran berhasil diunggah.");

      // Reset form
      setSelectedFile(null);
      setUploadTitle("");
      setUploadDescription("");
      setUploadType("LKPD");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowUploadModal(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah lampiran.");
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Metadata Update
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId || !editingAttachment) return;

    if (!editTitle.trim()) {
      toast.error("Judul lampiran tidak boleh kosong.");
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await updateRpmAttachmentMetadataApi(documentId, editingAttachment.id, {
        title: editTitle.trim(),
        attachmentType: editType,
        description: editDescription.trim() || null,
      });

      setAttachments((prev) =>
        prev.map((att) => (att.id === updated.id ? updated : att))
      );
      toast.success("Metadata lampiran berhasil diperbarui.");
      setEditingAttachment(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui metadata.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Submit Delete
  const handleDeleteConfirm = async () => {
    if (!documentId || !deletingId) return;

    setIsDeleting(true);
    try {
      await deleteRpmAttachmentApi(documentId, deletingId);
      setAttachments((prev) => prev.filter((a) => a.id !== deletingId));
      toast.success("Lampiran berhasil dihapus.");
      setDeletingId(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus lampiran.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Move Up / Move Down
  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!documentId || isReordering) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= attachments.length) return;

    const newAttachments = [...attachments];
    const [moved] = newAttachments.splice(index, 1);
    newAttachments.splice(targetIndex, 0, moved);

    // Optimistic update
    setAttachments(newAttachments);
    setIsReordering(true);

    try {
      const orderedIds = newAttachments.map((a) => a.id);
      const serverOrdered = await reorderRpmAttachmentsApi(documentId, orderedIds);
      setAttachments(serverOrdered);
    } catch (err: any) {
      toast.error("Gagal menyimpan perubahan urutan.");
      // Rollback on failure
      const reverted = await fetchRpmAttachments(documentId);
      setAttachments(reverted);
    } finally {
      setIsReordering(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (att: RPMAttachment) => {
    setEditingAttachment(att);
    setEditTitle(att.title);
    setEditType(att.attachmentType);
    setEditDescription(att.description || "");
  };

  // Helper icon for file extension/mime
  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType === "application/pdf") {
      return <FileText className="w-4 h-4 text-rose-600 shrink-0" />;
    }
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="w-4 h-4 text-purple-600 shrink-0" />;
    }
    if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || mimeType.includes("spreadsheet")) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
    }
    return <File className="w-4 h-4 text-blue-600 shrink-0" />;
  };

  return (
    <Card className="bg-white shadow-xs border border-gray-200/90 rounded-2xl overflow-hidden transition-all">
      {/* Section Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-gradient-to-r from-gray-50/80 to-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80 shrink-0">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 font-plus-jakarta">
                Lampiran RPM
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                {attachments.length} Dokumen
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Dokumen pendukung seperti LKPD, rubrik, bahan ajar, atau instrumen asesmen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {documentId && !readOnly && (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              className="min-h-[34px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Lampiran
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="w-8 h-8 p-0 text-gray-400 hover:text-gray-700"
            aria-label={isOpen ? "Tutup bagian" : "Buka bagian"}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* CASE 1: Unsaved RPM Document */}
          {!documentId ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="max-w-sm mx-auto">
                <h4 className="text-xs font-bold text-gray-800">
                  Simpan RPM Terlebih Dahulu
                </h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Fitur lampiran memerlukan identitas dokumen yang tersimpan di sistem.
                  Simpan rancangan RPM ini untuk mulai menambahkan berkas pendukung.
                </p>
              </div>
              {onSaveAndOpenAttachments && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onSaveAndOpenAttachments}
                  className="min-h-[34px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Simpan RPM & Tambah Lampiran
                </Button>
              )}
            </div>
          ) : loading ? (
            /* Loading state */
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <p className="text-xs">Memuat lampiran dokumen...</p>
            </div>
          ) : attachments.length === 0 ? (
            /* Empty state for saved RPM */
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-6 text-center space-y-2">
              <Paperclip className="w-6 h-6 text-gray-400 mx-auto" />
              <p className="text-xs font-semibold text-gray-700">Belum ada dokumen lampiran</p>
              <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                Tambahkan LKPD, rubrik asesmen, bahan bacaan, atau materi ajar untuk memperkaya perencanaan ini.
              </p>
              {!readOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowUploadModal(true)}
                  className="mt-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Unggah Lampiran Pertama
                </Button>
              )}
            </div>
          ) : (
            /* Attachment List */
            <div className="space-y-2.5">
              {attachments.map((att, index) => (
                <div
                  key={att.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-200 hover:shadow-2xs transition-all"
                >
                  {/* Info Left */}
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 text-center">
                      {index + 1}.
                    </span>
                    <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                      {getFileIcon(att.mimeType, att.originalFilename)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-gray-900 truncate">
                          {att.title}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {formatAttachmentType(att.attachmentType)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        <span className="font-medium text-gray-600">{att.originalFilename}</span> &bull; {formatFileSize(att.fileSize)}
                      </p>
                      {att.description && (
                        <p className="text-[11px] text-gray-600 mt-1 line-clamp-1 italic bg-gray-50/80 px-2 py-0.5 rounded border border-gray-100">
                          {att.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Reordering */}
                    {!readOnly && attachments.length > 1 && (
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50 mr-1">
                        <button
                          type="button"
                          disabled={index === 0 || isReordering}
                          onClick={() => handleMove(index, "up")}
                          className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent text-gray-600"
                          title="Pindah ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === attachments.length - 1 || isReordering}
                          onClick={() => handleMove(index, "down")}
                          className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent text-gray-600 border-l border-gray-200"
                          title="Pindah ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Preview Button (PDF & Images only) */}
                    {att.previewUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewAttachment(att)}
                        className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                      </Button>
                    )}

                    {/* Download Button */}
                    <a
                      href={att.downloadUrl}
                      download={att.originalFilename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-8 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Unduh
                    </a>

                    {/* Edit Metadata Button */}
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(att)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        title="Edit metadata"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Delete Button */}
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(att.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Hapus lampiran"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: UNGGAH LAMPIRAN ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                  Tambah Lampiran Dokumen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* Jenis Lampiran */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Jenis Lampiran <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as RPMAttachmentType)}
                  className="w-full min-h-[38px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200 font-medium"
                >
                  {RPM_ATTACHMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RPM_ATTACHMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Judul Lampiran */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Judul Dokumen
                </label>
                <Input
                  type="text"
                  placeholder="Contoh: LKPD Gelombang Elektromagnetik (opsional, default nama berkas)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="text-xs bg-white"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Deskripsi / Catatan Penggunaan (opsional)
                </label>
                <Textarea
                  placeholder="Contoh: Digunakan pada kegiatan inti pertemuan pertama."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="text-xs bg-white"
                />
              </div>

              {/* File Input */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Pilih File <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-xl p-4 text-center bg-gray-50/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="attachment-file-input"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="attachment-file-input"
                    className="cursor-pointer flex flex-col items-center gap-1.5"
                  >
                    <Paperclip className="w-5 h-5 text-gray-400" />
                    {selectedFile ? (
                      <div>
                        <p className="font-bold text-emerald-700 text-xs">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Ukuran: {formatFileSize(selectedFile.size)} (Klik untuk mengganti)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-gray-700 text-xs">
                          Klik untuk memilih berkas dari perangkat
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Format: PDF, DOCX, XLSX, PNG, JPG (Maks. 10 MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => setShowUploadModal(false)}
                  className="min-h-[36px] text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploading || !selectedFile}
                  className="min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Mengunggah...
                    </>
                  ) : (
                    "Unggah Lampiran"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT METADATA ── */}
      {editingAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                Edit Informasi Lampiran
              </h3>
              <button
                type="button"
                onClick={() => setEditingAttachment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Jenis Lampiran
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as RPMAttachmentType)}
                  className="w-full min-h-[38px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200"
                >
                  {RPM_ATTACHMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RPM_ATTACHMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Judul Lampiran
                </label>
                <Input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xs bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Deskripsi / Catatan (opsional)
                </label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="text-xs bg-white"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-500">
                <span className="font-semibold text-gray-700">Berkas: </span>
                {editingAttachment.originalFilename} ({formatFileSize(editingAttachment.fileSize)})
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUpdating}
                  onClick={() => setEditingAttachment(null)}
                  className="min-h-[36px] text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdating}
                  className="min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: KONFIRMASI HAPUS ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Hapus Lampiran Ini?</h3>
            <p className="text-xs text-gray-600">
              Dokumen lampiran akan dihapus permanen dari server. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="flex-1 min-h-[36px] text-xs"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex-1 min-h-[36px] bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PREVIEW BERKAS (PDF & Gambar) ── */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-gray-200 bg-gray-50/80">
              <div className="flex items-center gap-2 truncate pr-4">
                {getFileIcon(previewAttachment.mimeType, previewAttachment.originalFilename)}
                <span className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                  {previewAttachment.title}
                </span>
                <span className="text-[10px] text-gray-400 truncate">
                  ({previewAttachment.originalFilename})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewAttachment.previewUrl || previewAttachment.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-emerald-700 hover:underline font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Buka di Tab Baru
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 bg-gray-100 p-2 overflow-auto flex items-center justify-center">
              {previewAttachment.mimeType.startsWith("image/") ? (
                <img
                  src={previewAttachment.previewUrl!}
                  alt={previewAttachment.title}
                  className="max-h-full max-w-full object-contain rounded shadow-sm"
                />
              ) : previewAttachment.mimeType === "application/pdf" ? (
                <iframe
                  src={previewAttachment.previewUrl!}
                  title={previewAttachment.title}
                  className="w-full h-full rounded border border-gray-200 bg-white"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">
                    Pratinjau langsung tidak didukung untuk format ini.
                  </p>
                  <a
                    href={previewAttachment.downloadUrl}
                    className="inline-flex items-center text-xs text-emerald-600 hover:underline font-bold"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Unduh Dokumen
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
