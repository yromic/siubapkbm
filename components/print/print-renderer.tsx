"use client";

import React, { ReactNode } from "react";
import { UX_COPY } from "@/lib/ux-copy";
import { DocumentStatus } from "@/lib/permissions/documents";

export interface DocumentPrintHeaderProps {
  institutionName?: string;
  institutionSubHeader?: string;
  title?: string;
  subtitle?: string;
  documentNumber?: string;
}

export interface DocumentPrintMetadataProps {
  authorName?: string;
  className?: string;
  subjectName?: string;
  semesterName?: string;
  academicYear?: string;
}

export interface SchoolSettings {
  school_name?: string;
  school_sub_header?: string;
}

export interface PrintRendererProps {
  document: {
    id: string;
    type: 'RPM' | 'KKTP' | 'TRISULA' | 'BLC_PACKAGE' | 'TABAYYUN';
    title: string;
    status: DocumentStatus;
    version?: number;
    created_at?: string;
    updated_at?: string;
    author_name?: string;
    author_nip?: string | null;
    author_nuptk?: string | null;
    class_name?: string;
    subject_name?: string;
    semester_name?: string;
    // RPM zero-approval fields
    signed_at?: string | null;
    signed_by?: string | null;
    signer_name?: string | null;
    signer_nip?: string | null;
    signer_nuptk?: string | null;
    content?: any;
  };
  children: ReactNode;
  headerProps?: DocumentPrintHeaderProps;
  showKop?: boolean;
  /** Kop surat dari app_settings — bila disediakan, menggantikan placeholder hardcode */
  schoolSettings?: SchoolSettings;
}

/**
 * Tentukan teks watermark berdasarkan tipe dokumen:
 * RPM, KKTP, TRISULA → Selalu cetak bersih tanpa watermark apapun ("").
 * Tipe lain (UTSMAN / non-perencanaan) → Tetap pakai UX_COPY.documents.watermarkText[status] jika ada.
 */
function resolveWatermark(doc: PrintRendererProps['document']): string {
  if (['RPM', 'KKTP', 'TRISULA'].includes(doc.type)) {
    return "";
  }
  return UX_COPY.documents.watermarkText[doc.status] || "";
}

/**
 * Tentukan label status untuk bagian metadata header cetak:
 * RPM, KKTP, TRISULA → Selalu "Siap Dipakai".
 * Lainnya → UX_COPY.documents.statusLabel[status]
 */
function resolveStatusLabel(doc: PrintRendererProps['document']): string {
  if (['RPM', 'KKTP', 'TRISULA'].includes(doc.type)) {
    return UX_COPY.rpm?.status?.ready || "Siap Dipakai";
  }
  return UX_COPY.documents.statusLabel[doc.status] || doc.status;
}

export function PrintRenderer({
  document,
  children,
  headerProps,
  showKop = true,
  schoolSettings,
}: PrintRendererProps) {
  const watermarkText = resolveWatermark(document);
  const statusLabel   = resolveStatusLabel(document);

  // Unifikasi sumber data: Untuk RPM, sinkronkan dengan content.identitas
  const isRPM = document.type === 'RPM';
  const identitas = document.content?.identitas;

  const resolvedSubjectName = isRPM
    ? (identitas?.mataPelajaran || document.subject_name || "-")
    : (document.subject_name || identitas?.mataPelajaran || "-");

  const resolvedClassName = isRPM
    ? (identitas?.kelasRombel
        ? (identitas?.tingkatFase ? `${identitas.tingkatFase} (${identitas.kelasRombel})` : identitas.kelasRombel)
        : (document.class_name || "-"))
    : (document.class_name || identitas?.kelasRombel || "-");

  const resolvedAuthorName = isRPM
    ? (identitas?.namaTutorPengampu || document.author_name || "-")
    : (document.author_name || identitas?.namaTutorPengampu || "-");

  const resolvedTutorRole = isRPM
    ? `Tutor Pengampu ${identitas?.kelasRombel || identitas?.mataPelajaran || document.class_name || document.subject_name || "Paket"}`
    : (document.class_name ? `Tutor Pengampu ${document.class_name}` : document.subject_name ? `Tutor Pengampu ${document.subject_name}` : "Tutor Pengampu");

  // NIP / ID tutor dari database guru — kosongkan jika tidak ada (TIDAK BOLEH dikarang)
  const tutorIdRaw = document.author_nip || document.author_nuptk || identitas?.nipTutor;
  const tutorIdDisplay = tutorIdRaw ? String(tutorIdRaw).trim() : "";

  // NIP / ID kepala sekolah / signer dari database
  const signerIdRaw = document.signer_nip || document.signer_nuptk;
  const signerIdDisplay = signerIdRaw ? String(signerIdRaw).trim() : "";

  return (
    <div className="print-engine-container relative w-full bg-white text-black p-6 print:p-0 print:m-0">
      {/* Watermark — Fixed sekali per halaman cetak & ukuran proporsional agar tidak terpotong */}
      {watermarkText && (
        <div className="print-watermark pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden opacity-10 select-none print:opacity-10">
          <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-widest text-gray-500 uppercase -rotate-45 text-center px-4 max-w-4xl select-none leading-relaxed">
            {watermarkText}
          </span>
        </div>
      )}

      {/* Header / Kop Instansi */}
      {showKop && (
        <div className="border-b-2 border-black pb-4 mb-6 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wide">
            {headerProps?.institutionName
              || schoolSettings?.school_name
              || "[Nama sekolah belum dikonfigurasi — isi di Pengaturan Aplikasi]"}
          </h1>
          <p className="text-sm font-medium text-gray-700">
            {headerProps?.institutionSubHeader
              || schoolSettings?.school_sub_header
              || "[Alamat & izin operasional belum dikonfigurasi]"}
          </p>
          <div className="mt-4 border-t border-black pt-2">
            <h2 className="text-lg font-bold uppercase underline">
              {headerProps?.title || document.title}
            </h2>
            {headerProps?.subtitle && (
              <p className="text-xs italic text-gray-600">{headerProps.subtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* Metadata Table */}
      <div className="mb-6 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p><span className="font-semibold">Dokumen:</span> {document.type} (v{document.version || 1})</p>
          <p><span className="font-semibold">Mata Pelajaran:</span> {resolvedSubjectName}</p>
          <p><span className="font-semibold">Kelas:</span> {resolvedClassName}</p>
        </div>
        <div className="text-right">
          <p><span className="font-semibold">Penyusun:</span> {resolvedAuthorName}</p>
          <p><span className="font-semibold">Status:</span> {statusLabel}</p>
          <p><span className="font-semibold">Tanggal Cetak:</span> {new Date().toLocaleDateString("id-ID")}</p>
        </div>
      </div>

      {/* Main Document Content */}
      <div className="document-body space-y-4">
        {children}
      </div>

      {/* Footer & Tanda Tangan Basah */}
      <div className="mt-12 pt-6 border-t border-gray-300 print:break-inside-avoid">
        <div className="flex justify-between items-start text-xs text-center px-4">

          {/* Kolom kiri: Mengetahui - Kepala PKBM BLC */}
          <div className="w-64">
            <p className="mb-16">
              Mengetahui,<br />
              <span className="font-semibold">Kepala PKBM BLC</span>
            </p>
            <p className="font-bold underline">
              {document.signer_name || "Kepala PKBM BLC"}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              NIP/ID. {signerIdDisplay || "........................................"}
            </p>
          </div>

          {/* Kolom kanan: Disusun oleh - Tutor Pengampu */}
          <div className="w-64">
            <p className="mb-16">
              Disusun oleh,<br />
              <span className="font-semibold">{resolvedTutorRole}</span>
            </p>
            <p className="font-bold underline">
              {resolvedAuthorName !== "-" ? resolvedAuthorName : (document.author_name || "Tutor Pengampu")}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              ID: {tutorIdDisplay || "........................................"}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-2 print:border-t-0">
          Dicetak secara otomatis melalui Sistem SIUBA
        </div>
      </div>
    </div>
  );
}
