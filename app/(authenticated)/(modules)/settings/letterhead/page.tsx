"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  Archive,
  Eye,
  ShieldCheck,
  Calendar,
  HardDrive,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  Check,
  Info,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-framework";
import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import { LetterheadA4PreviewModal } from "@/components/settings/LetterheadA4PreviewModal";
import { LetterheadVersion } from "@/types/letterhead";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function LetterheadSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator" || user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<LetterheadVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [activeLetterheadUrl, setActiveLetterheadUrl] = useState<string | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<Record<string, any>>({});

  // Upload Form State
  const [uploadName, setUploadName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A4 Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTargetVersion, setPreviewTargetVersion] = useState<LetterheadVersion | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "activate" | "archive";
    version: LetterheadVersion | null;
  }>({ open: false, type: "activate", version: null });

  // ── Fetch Letterhead Data ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lhRes, setRes] = await Promise.all([
        fetch("/api/v1/letterheads"),
        fetch("/api/v1/app-settings"),
      ]);

      const lhJson = await lhRes.json();
      const setJson = await setRes.json();

      if (lhJson.success && lhJson.data) {
        setVersions(lhJson.data.versions || []);
        setActiveVersionId(lhJson.data.active_letterhead_id || null);
        setActiveLetterheadUrl(lhJson.data.active_letterhead_url || null);
      }

      if (setJson.success && setJson.data) {
        setSchoolSettings(setJson.data);
      }
    } catch {
      toast.error("Gagal memuat data kop surat resmi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Find currently active version object
  const activeVersion = versions.find((v) => v.id === activeVersionId) || null;

  // ── File Selection Handler ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format tidak didukung. Harap pilih gambar PNG atau JPG.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Ukuran file melebihi 2 MB. Harap kompres gambar terlebih dahulu.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);

    // Auto-fill name if empty
    if (!uploadName.trim()) {
      const defaultName = `Kop Resmi ${new Date().getFullYear()} - ${file.name.replace(/\.[^/.]+$/, "")}`;
      setUploadName(defaultName);
    }

    // Generate local preview URL
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setPreviewDataUrl(loadEvt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Upload Submission ──────────────────────────────────────────────────────
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim()) {
      toast.error("Nama versi kop surat wajib diisi.");
      return;
    }
    if (!selectedFile) {
      toast.error("Pilih file gambar kop surat terlebih dahulu.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", uploadName.trim());
      formData.append("file", selectedFile);

      const res = await fetch("/api/v1/letterheads", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Kop surat berhasil diunggah.");
        setUploadName("");
        handleClearSelectedFile();
        fetchData();
      } else {
        toast.error(json.message || "Gagal mengunggah kop surat.");
      }
    } catch {
      toast.error("Terjadi kendala jaringan saat mengunggah kop surat.");
    } finally {
      setUploading(false);
    }
  };

  // ── Activate Handler ───────────────────────────────────────────────────────
  const handleActivate = async (versionId: string) => {
    setActivatingId(versionId);
    try {
      const res = await fetch(`/api/v1/letterheads/${versionId}/activate`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Kop surat resmi berhasil diaktifkan.");
        fetchData();
        setPreviewModalOpen(false);
        setConfirmModal({ open: false, type: "activate", version: null });
      } else {
        toast.error(json.message || "Gagal mengaktifkan kop surat.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengaktifkan kop surat.");
    } finally {
      setActivatingId(null);
    }
  };

  // ── Archive Handler ────────────────────────────────────────────────────────
  const handleArchive = async (versionId: string) => {
    setArchivingId(versionId);
    try {
      const res = await fetch(`/api/v1/letterheads/${versionId}/archive`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Kop surat berhasil diarsipkan.");
        fetchData();
        setConfirmModal({ open: false, type: "archive", version: null });
      } else {
        toast.error(json.message || "Gagal mengarsipkan kop surat.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengarsipkan kop surat.");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <PageContainer maxWidth="7xl" className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Pengaturan Sistem
            </span>
            <span className="text-xs text-gray-400">&bull;</span>
            <span className="text-xs text-gray-500 font-medium">Institusi & Identitas Resmi</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
            Kop Surat Resmi (Official Letterhead)
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-3xl">
            Satu sumber kebenaran resmi (single source of truth) untuk kop surat institusi. Digunakan secara otomatis oleh seluruh modul cetak RPM, KKTP, dan Raport Trisula dengan preservasi arsip dokumen historis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="text-xs min-h-[38px] border-gray-200 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
        </div>
      </div>

      {/* ── Top Status Cards (KPIs) ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Letterhead Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 shadow-2xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500">Status Kop Institusi</p>
            <h3 className="text-base font-bold text-gray-900 truncate">
              {activeVersion ? activeVersion.name : "Kop Statis Default"}
            </h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {activeVersion ? "Kop Resmi Terpasang Aktif" : "Menggunakan Fallback Statis"}
            </p>
          </div>
        </div>

        {/* Total Versions */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0 shadow-2xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Total Versi Terdaftar</p>
            <h3 className="text-xl font-bold text-gray-900 font-fredoka">
              {versions.length} <span className="text-xs font-normal text-gray-500">Versi</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Semua file tersimpan immutable</p>
          </div>
        </div>

        {/* Storage Guard */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0 shadow-2xs">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Integritas Repositori</p>
            <h3 className="text-base font-bold text-gray-900">Validasi Server-Side</h3>
            <p className="text-[11px] text-purple-700 font-medium mt-0.5">Magic byte guard &amp; 2MB limit</p>
          </div>
        </div>
      </div>

      {/* ── Active Letterhead Spotlight Card ─────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 border-emerald-200/80 shadow-xs rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-600 text-white uppercase tracking-wider">
                  Kop Surat Resmi Aktif
                </span>
                <span className="text-xs text-gray-400">&bull;</span>
                <span className="text-xs text-gray-600 font-medium">
                  {activeVersion ? activeVersion.name : "Kop Standar BLC (Default)"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Kop ini adalah yang saat ini otomatis disisipkan pada setiap pembuatan dokumen baru di seluruh sistem.
              </p>
            </div>

            {activeVersion && (
              <Button
                variant="secondary"
                size="sm"
                className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50 shrink-0"
                onClick={() => {
                  setPreviewTargetVersion(activeVersion);
                  setPreviewModalOpen(true);
                }}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" /> Pratinjau Kertas A4
              </Button>
            )}
          </div>

          {/* Letterhead Visual Box */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-2xs">
            <OfficialSchoolLetterhead
              src={activeLetterheadUrl || "/branding/school-letterhead.png"}
              schoolSettings={schoolSettings}
            />
          </div>

          {activeVersion && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pt-1">
              <div className="flex items-center gap-4 flex-wrap">
                <span>
                  Diaktifkan:{" "}
                  <strong className="text-gray-800">
                    {activeVersion.activated_at
                      ? new Date(activeVersion.activated_at).toLocaleString("id-ID")
                      : "-"}
                  </strong>
                </span>
                <span>&bull;</span>
                <span>
                  Ukuran:{" "}
                  <strong className="text-gray-800">
                    {(activeVersion.size_bytes / 1024).toFixed(1)} KB ({activeVersion.ext.toUpperCase()})
                  </strong>
                </span>
              </div>
              <div className="font-mono text-[11px] text-gray-400">
                UUID: {activeVersion.id}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Upload New Letterhead Card (Admin Only) ──────────────────────────── */}
      {isAdmin && (
        <Card className="bg-white border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Unggah Versi Kop Surat Baru</h3>
                <p className="text-[11px] text-gray-500">
                  Daftarkan kop surat resmi baru ke dalam repositori institusi.
                </p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Admin Akses
            </span>
          </div>

          <form onSubmit={handleUploadSubmit} className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nama Versi Kop Surat <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Contoh: Kop Resmi PKBM BLC 2026/2027"
                    className="text-xs"
                    disabled={uploading}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Beri nama deskriptif agar mudah dikenali pada riwayat arsip.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    File Gambar Kop Surat <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-gray-200 rounded-lg p-1"
                    disabled={uploading}
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1.5">
                    <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>Format yang didukung: PNG atau JPG/JPEG. Ukuran file maksimal: 2 MB.</span>
                  </div>
                </div>

                <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-600" /> Kebijakan Aktivasi:
                  </p>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Kop surat yang baru diunggah akan berstatus <strong>PENDING</strong> dan <em>tidak langsung</em> menggantikan kop aktif. Anda dapat meninjau tampilannya terlebih dahulu sebelum memutuskan untuk mengaktifkannya.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs min-h-[40px] shadow-xs"
                  disabled={uploading || !selectedFile || !uploadName.trim()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Mengunggah &amp; Memvalidasi...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Unggah Kop Surat ke Repositori
                    </>
                  )}
                </Button>
              </div>

              {/* Preview Box */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Pratinjau File Pilihan
                </label>
                <div className="flex-1 min-h-[160px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                  {previewDataUrl ? (
                    <div className="w-full text-center space-y-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewDataUrl}
                        alt="Pratinjau Kop Surat"
                        className="max-h-32 object-contain mx-auto bg-white p-2 rounded-lg shadow-2xs border border-gray-200"
                      />
                      <div className="text-xs text-gray-600">
                        <p className="font-bold text-gray-800 truncate">{selectedFile?.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {((selectedFile?.size || 0) / 1024).toFixed(1)} KB &bull; {selectedFile?.type}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSelectedFile}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
                      >
                        Hapus Pilihan
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 space-y-2">
                      <FileText className="w-10 h-10 mx-auto text-gray-300" />
                      <p className="text-xs font-medium">Belum ada file yang dipilih</p>
                      <p className="text-[10px] text-gray-400">
                        Pilih file di sisi kiri untuk melihat pratinjau proporsi kop
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* ── Version History & Archive Table ─────────────────────────────────── */}
      <Card className="bg-white border-gray-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h3 className="text-base font-bold text-gray-900">Riwayat Versi Kop Surat</h3>
            <p className="text-xs text-gray-500">
              Daftar seluruh versi kop surat resmi yang pernah didaftarkan ke sistem.
            </p>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Total: <strong className="text-gray-900">{versions.length}</strong> entri
          </span>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs text-gray-500 font-medium">Memuat riwayat kop surat...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-12 h-12 mx-auto text-gray-300" />
            <h4 className="text-sm font-bold text-gray-800">Belum Ada Riwayat Kop Surat</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Sistem saat ini masih menggunakan kop statis default bawaan aplikasi. Unggah versi kop resmi pertama Anda melalui formulir di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-32">Pratinjau</th>
                  <th className="py-3.5 px-4">Nama Versi</th>
                  <th className="py-3.5 px-4 w-28 text-center">Status</th>
                  <th className="py-3.5 px-4 w-36">Tanggal Unggah</th>
                  <th className="py-3.5 px-4 w-36">Tanggal Aktif</th>
                  <th className="py-3.5 px-4 w-52 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {versions.map((ver, idx) => {
                  const isActive = ver.status === "ACTIVE";
                  const isArchived = ver.status === "ARCHIVED";
                  const isPending = ver.status === "PENDING";

                  return (
                    <tr
                      key={ver.id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        isActive ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                        {idx + 1}
                      </td>

                      {/* Thumbnail */}
                      <td className="py-3.5 px-4">
                        <div
                          className="w-24 h-10 bg-white border border-gray-200 rounded-md overflow-hidden flex items-center justify-center cursor-pointer hover:border-emerald-400 shadow-2xs transition-colors"
                          onClick={() => {
                            setPreviewTargetVersion(ver);
                            setPreviewModalOpen(true);
                          }}
                          title="Klik untuk pratinjau A4"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ver.url}
                            alt={ver.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </td>

                      {/* Name & File details */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                            {ver.name}
                            {isActive && (
                              <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Aktif
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono">
                            {(ver.size_bytes / 1024).toFixed(1)} KB &bull; {ver.ext.toUpperCase()} &bull; {ver.url}
                          </p>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" /> ACTIVE
                          </span>
                        ) : isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            <Archive className="w-3 h-3" /> ARCHIVED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> PENDING
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-gray-600">
                        {new Date(ver.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Activated At */}
                      <td className="py-3.5 px-4 text-gray-600">
                        {ver.activated_at
                          ? new Date(ver.activated_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs font-semibold hover:bg-gray-100"
                            onClick={() => {
                              setPreviewTargetVersion(ver);
                              setPreviewModalOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Pratinjau
                          </Button>

                          {isAdmin && !isActive && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() =>
                                  setConfirmModal({
                                    open: true,
                                    type: "activate",
                                    version: ver,
                                  })
                                }
                                disabled={activatingId === ver.id}
                              >
                                {activatingId === ver.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                )}
                                Aktifkan
                              </Button>

                              {!isArchived && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() =>
                                    setConfirmModal({
                                      open: true,
                                      type: "archive",
                                      version: ver,
                                    })
                                  }
                                  disabled={archivingId === ver.id}
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── A4 Preview Modal ─────────────────────────────────────────────────── */}
      <LetterheadA4PreviewModal
        letterhead={previewTargetVersion}
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setPreviewTargetVersion(null);
        }}
        onActivate={isAdmin ? (id) => handleActivate(id) : undefined}
        isActivating={activatingId !== null}
        schoolSettings={schoolSettings}
      />

      {/* ── Confirmation Modal (Activate / Archive) ─────────────────────────── */}
      {confirmModal.open && confirmModal.version && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  confirmModal.type === "activate"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {confirmModal.type === "activate" ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 font-plus-jakarta">
                  {confirmModal.type === "activate"
                    ? "Aktifkan Kop Surat Resmi?"
                    : "Arsipkan Versi Kop Surat?"}
                </h3>
                <p className="text-xs text-gray-500">
                  Target: <strong>{confirmModal.version.name}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {confirmModal.type === "activate"
                ? "Setelah diaktifkan, kop surat ini akan langsung diterapkan secara global pada seluruh dokumen RPM, KKTP, dan Raport Trisula yang baru dibuat atau dicetak."
                : "Versi kop surat yang diarsipkan tidak akan muncul sebagai pilihan aktif. File aset pada disk tetap dipertahankan secara permanen untuk kebutuhan cetak ulang historis."}
            </p>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1 text-xs font-semibold"
                onClick={() =>
                  setConfirmModal({ open: false, type: "activate", version: null })
                }
                disabled={activatingId !== null || archivingId !== null}
              >
                Batal
              </Button>
              <Button
                className={`flex-1 text-xs font-bold text-white shadow-xs ${
                  confirmModal.type === "activate"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
                onClick={() => {
                  if (confirmModal.type === "activate") {
                    handleActivate(confirmModal.version!.id);
                  } else {
                    handleArchive(confirmModal.version!.id);
                  }
                }}
                disabled={activatingId !== null || archivingId !== null}
              >
                {activatingId || archivingId ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : confirmModal.type === "activate" ? (
                  <Check className="w-4 h-4 mr-1.5" />
                ) : (
                  <Archive className="w-4 h-4 mr-1.5" />
                )}
                {confirmModal.type === "activate" ? "Ya, Aktifkan" : "Ya, Arsipkan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
