"use client";

import React, { ReactNode } from "react";
import { UX_COPY } from "@/lib/ux-copy";
import { DocumentStatus } from "@/lib/permissions/documents";
import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import { resolveAcademicPeriodDisplay } from "@/lib/utils/academicUtils";
import { RPMAttachment } from "@/types/rpmAttachment";
import { RPMAttachmentDocumentPages } from "@/components/rpm/RPMAttachmentDocumentPages";
import type { AttachmentRenderSummary } from "@/lib/utils/rpmAttachmentRendering";

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
  /** Headmaster name from institutional app_settings */
  school_headmaster_name?: string;
  /** Headmaster NIP/ID from institutional app_settings */
  school_headmaster_nip?: string;
  /** Active institutional letterhead ID from app_settings */
  active_letterhead_id?: string;
  /** Active institutional letterhead public URL from app_settings */
  active_letterhead_url?: string;
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
    author_name?: string | null;
    author_nip?: string | null;
    author_nuptk?: string | null;
    class_name?: string | null;
    subject_name?: string | null;
    semester_id?: string | null;
    semester_name?: string | null;
    // RPM zero-approval fields
    signed_at?: string | null;
    signed_by?: string | null;
    signer_name?: string | null;
    signer_nip?: string | null;
    signer_nuptk?: string | null;
    content?: Record<string, unknown> | null;
  };
  children: ReactNode;
  headerProps?: DocumentPrintHeaderProps;
  showKop?: boolean;
  /** Kop surat dari app_settings — bila disediakan, menggantikan placeholder hardcode */
  schoolSettings?: SchoolSettings;
  /** Master semester records for dynamic label resolution */
  semesters?: Array<{ id: string; name: string; academic_year_id?: string; academic_year_name?: string }>;
  /** Master academic years for dynamic label resolution */
  academicYears?: Array<{ id: string; name: string }>;
  /** Lampiran resmi terdaftar untuk dokumen RPM */
  attachments?: RPMAttachment[];
  /** Callback perubahan status kesiapan render lampiran tersemat */
  onAttachmentReadinessChange?: (summary: AttachmentRenderSummary) => void;
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
 * For RPM: canonical heading is always "RENCANA PEMBELAJARAN MODUL (RPM)".
 * Subtitle = modulTopik (the actual topic, not the system document.title).
 * For other types: use headerProps.title or document.title.
 */
function resolveDocumentTitle(doc: PrintRendererProps['document'], headerProps?: DocumentPrintHeaderProps): string {
  if (doc.type === 'RPM') {
    // Always canonical — never use raw document.title (which could be "RPM ALA ALA")
    return "RENCANA PEMBELAJARAN MODUL (RPM)";
  }
  return headerProps?.title || doc.title;
}

function resolveDocumentSubtitle(doc: PrintRendererProps['document'], headerProps?: DocumentPrintHeaderProps): string | undefined {
  if (doc.type === 'RPM') {
    // Use modulTopik as the subtitle, not headerProps.subtitle
    const topik = doc.content?.identitas?.modulTopik;
    return topik ? topik : undefined;
  }
  return headerProps?.subtitle;
}

export function PrintRenderer({
  document,
  children,
  headerProps,
  showKop = true,
  schoolSettings,
  semesters,
  academicYears,
  attachments,
  onAttachmentReadinessChange,
}: PrintRendererProps) {
  const watermarkText = resolveWatermark(document);
  const documentTitle  = resolveDocumentTitle(document, headerProps);
  const documentSubtitle = resolveDocumentSubtitle(document, headerProps);

  // Unifikasi sumber data: Untuk RPM, sinkronkan dengan content.identitas
  const isRPM = String(document.type || '').toUpperCase() === 'RPM';
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

  // Headmaster: institutional config takes priority, then signed document signer_name
  // NEVER use "Kepala PKBM BLC" as the name itself (only as a label/role)
  const headmasterName = schoolSettings?.school_headmaster_name?.trim()
    || document.signer_name?.trim()
    || "";
  const headmasterNipRaw = schoolSettings?.school_headmaster_nip?.trim()
    || document.signer_nip?.trim()
    || document.signer_nuptk?.trim()
    || "";

  // Dynamic semester & TA resolution — never leaks raw database UUIDs to printed document
  const resolvedPeriod = resolveAcademicPeriodDisplay({
    semesterId: document.semester_id || identitas?.semesterId,
    semesterName: document.semester_name || identitas?.semesterNama,
    tahunAjaranRaw: identitas?.tahunAjaran,
    semesterTahunRaw: identitas?.semesterTahun,
    masterSemesters: semesters,
    masterAcademicYears: academicYears,
  });

  const semesterLabel = resolvedPeriod.semesterLabel;
  const tahunAjaran = resolvedPeriod.academicYearLabel;

  // ── Letterhead URL resolution chain ─────────────────────────────────────
  // Priority: historical snapshot → active global setting → static legacy
  const resolvedLetterheadUrl: string =
    document.content?.identitas?.letterhead?.url ||
    schoolSettings?.active_letterhead_url ||
    "/branding/school-letterhead.png";

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
        <div className="mb-6">
          <OfficialSchoolLetterhead
            src={resolvedLetterheadUrl}
            schoolSettings={schoolSettings}
            defaultSchoolName={headerProps?.institutionName}
            defaultSubHeader={headerProps?.institutionSubHeader}
          />
          <div className="mt-3 border-t-2 border-emerald-800 pt-2 text-center print:border-emerald-800 print-break-inside-avoid">
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-emerald-950">
              {documentTitle}
            </h2>
            {isRPM && documentSubtitle ? (
              <div className="mt-0.5">
                <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                  {documentSubtitle}
                </p>
                <p className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                  {resolvedClassName} &bull; {semesterLabel !== "-" ? semesterLabel : "Semester"} &bull; {tahunAjaran !== "-" ? `TA ${tahunAjaran}` : ""}
                </p>
              </div>
            ) : documentSubtitle ? (
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{documentSubtitle}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Metadata Table — RPM: compact 2-column grid with formal academic tone */}
      {isRPM ? (
        <div className="mb-4 text-xs border border-emerald-200/90 rounded-lg overflow-hidden bg-emerald-50/20 print:border-gray-300 print:bg-transparent print-break-inside-avoid">
          <table className="w-full">
            <tbody className="divide-y divide-gray-200 text-[11px] print:divide-gray-300">
              <tr>
                <td className="py-1 px-3 font-semibold text-gray-600 w-1/4 bg-gray-50/70 print:bg-transparent">Mata Pelajaran</td>
                <td className="py-1 px-3 font-bold text-gray-900 w-1/4">: {resolvedSubjectName}</td>
                <td className="py-1 px-3 font-semibold text-gray-600 w-1/4 bg-gray-50/70 print:bg-transparent">Tutor Pengampu</td>
                <td className="py-1 px-3 font-bold text-gray-900 w-1/4">: {resolvedAuthorName !== "-" ? resolvedAuthorName : (document.author_name || "-")}</td>
              </tr>
              <tr>
                <td className="py-1 px-3 font-semibold text-gray-600 bg-gray-50/70 print:bg-transparent">Kelas / Fase</td>
                <td className="py-1 px-3 font-bold text-gray-900">: {resolvedClassName}</td>
                <td className="py-1 px-3 font-semibold text-gray-600 bg-gray-50/70 print:bg-transparent">Alokasi Waktu</td>
                <td className="py-1 px-3 font-bold text-gray-900">: {identitas?.alokasiWaktu || 0} Menit</td>
              </tr>
              {(semesterLabel !== "-" || tahunAjaran !== "-") && (
                <tr>
                  <td className="py-1 px-3 font-semibold text-gray-600 bg-gray-50/70 print:bg-transparent">Semester</td>
                  <td className="py-1 px-3 font-bold text-gray-900">: {semesterLabel}</td>
                  <td className="py-1 px-3 font-semibold text-gray-600 bg-gray-50/70 print:bg-transparent">Tahun Ajaran</td>
                  <td className="py-1 px-3 font-bold text-gray-900">: {tahunAjaran}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Non-RPM: original metadata table preserved */
        <div className="mb-6 grid grid-cols-2 gap-4 text-xs print-break-inside-avoid">
          <div>
            <p><span className="font-semibold">Dokumen:</span> {document.type} (v{document.version || 1})</p>
            <p><span className="font-semibold">Mata Pelajaran:</span> {resolvedSubjectName}</p>
            <p><span className="font-semibold">Kelas:</span> {resolvedClassName}</p>
          </div>
          <div className="text-right">
            <p><span className="font-semibold">Penyusun:</span> {resolvedAuthorName}</p>
            <p><span className="font-semibold">Status:</span> {UX_COPY.documents.statusLabel[document.status] || document.status}</p>
            <p><span className="font-semibold">Tanggal Cetak:</span> {new Date().toLocaleDateString("id-ID")}</p>
          </div>
        </div>
      )}

      {/* Main Document Content */}
      <div className="document-body space-y-4">
        {children}
      </div>

      {/* Footer & Tanda Tangan Basah */}
      <div className="mt-6 pt-4 border-t border-gray-300 print-break-inside-avoid">
        <div className="flex justify-between items-start text-xs text-center px-4">

          {/* Kolom kiri: Mengetahui - Kepala PKBM BLC */}
          <div className="w-64">
            <p className="mb-16">
              Mengetahui,<br />
              <span className="font-semibold">Kepala PKBM BLC</span>
            </p>
            <p className="font-bold underline">
              {headmasterName || "......................................"}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              NIP/ID. {headmasterNipRaw || "........................................"}
            </p>
          </div>

          {/* Kolom kanan: Disusun oleh - Tutor Pengampu */}
          <div className="w-64">
            <p className="mb-16">
              Disusun oleh,<br />
              <span className="font-semibold">{resolvedTutorRole}</span>
            </p>
            <p className="font-bold underline">
              {resolvedAuthorName !== "-" ? resolvedAuthorName : (document.author_name || "......................................")}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              ID: {tutorIdDisplay || "........................................"}
            </p>
          </div>
        </div>

        {/* Footer audit — Tanggal cetak di sini, bukan di metadata body */}
        <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-2 print:border-t-0">
          Dicetak secara otomatis melalui Sistem SIUBA &bull; {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* Formal Lampiran Dokumen - Embedded Content (Always after main RPM signatures & footer) */}
      {isRPM && Array.isArray(attachments) && attachments.length > 0 && (
        <div className="mt-8 pt-6 border-t-2 border-emerald-800 print:border-emerald-800 print:mt-6">
          <RPMAttachmentDocumentPages
            attachments={attachments}
            onReadinessChange={onAttachmentReadinessChange}
          />
        </div>
      )}
    </div>
  );
}
