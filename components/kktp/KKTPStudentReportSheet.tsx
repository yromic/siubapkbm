"use client";

import React from "react";
import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import { generateKKTPDocumentNumber } from "@/lib/utils/kktpCalculationUtils";

export interface StudentKKTPReportData {
  assessment: {
    id: string;
    title: string;
    class_name: string;
    subject_name: string;
    subject_code?: string;
    academic_year_name: string;
    semester_name: string;
    fase: string;
    letterhead_version_id?: string | null;
  };
  student: {
    id: string;
    full_name: string;
    nisn?: string | null;
    gender?: string | null;
  };
  tps: Array<{
    tp_id: string;
    tp_code?: string | null;
    tp_text: string;
    score: number | null;
    predicate: { label: string; code: string; colorClass: string };
    reflection?: string | null;
  }>;
  summary: {
    average_score: number | null;
    predicate: { label: string; code: string; colorClass: string };
    competency_description?: string | null;
    catatan_tutor?: string | null;
  };
  letterheadUrl?: string;
  schoolSettings?: {
    school_name?: string;
    school_sub_header?: string;
    school_headmaster_name?: string;
    school_headmaster_nip?: string;
  };
  documentNumber?: string;
  tutorName?: string;
  kepalaName?: string;
}

interface KKTPStudentReportSheetProps {
  data: StudentKKTPReportData;
  className?: string;
  isPrintBreak?: boolean;
  letterheadUrl?: string;
  schoolSettings?: {
    school_name?: string;
    school_sub_header?: string;
    school_headmaster_name?: string;
    school_headmaster_nip?: string;
  };
}

export function KKTPStudentReportSheet({
  data,
  className = "",
  isPrintBreak = false,
  letterheadUrl,
  schoolSettings,
}: KKTPStudentReportSheetProps) {
  const { assessment, student, tps, summary, tutorName, kepalaName } = data;

  const resolvedLetterheadUrl = letterheadUrl || data.letterheadUrl;
  const resolvedSchoolSettings = schoolSettings || data.schoolSettings;

  const docNumber =
    data.documentNumber ||
    generateKKTPDocumentNumber(
      assessment.academic_year_name,
      assessment.semester_name,
      assessment.class_name,
      assessment.subject_code || assessment.subject_name,
      student.nisn || student.id
    );

  const currentDateFormatted = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={`kktp-report-sheet bg-white text-gray-950 p-6 sm:p-8 md:p-10 font-sans shadow-sm border border-gray-200 mx-auto max-w-[210mm] space-y-4 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-4 ${
        isPrintBreak ? "print-page-break" : ""
      } ${className}`}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* ─── Top Header / Official Institutional Letterhead ───────────── */}
      <div>
        <div className="pb-2 text-center">
          <OfficialSchoolLetterhead
            src={resolvedLetterheadUrl}
            schoolSettings={resolvedSchoolSettings}
          />

          <div className="mt-3 pt-2 border-t-2 border-emerald-800 flex flex-col items-center print:border-emerald-800 print-break-inside-avoid">
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-emerald-950">
              LAPORAN CAPAIAN KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)
            </h2>
            <span className="text-[11px] font-mono text-emerald-800 mt-0.5 font-semibold">
              No: {docNumber}
            </span>
            <p className="text-[11px] font-semibold text-gray-600 mt-0.5">
              Kurikulum Merdeka • TA {assessment.academic_year_name || "2026/2027"} — {assessment.semester_name || "Semester Ganjil"}
            </p>
          </div>
        </div>

        {/* ─── Student & Subject Metadata Block ──────────────────────── */}
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs bg-emerald-50/30 p-3.5 rounded-lg border border-emerald-200 print:border-gray-300 print:bg-transparent print-break-inside-avoid">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
              <span className="font-semibold text-gray-600">Nama Murid</span>
              <span className="font-bold text-gray-900 uppercase">: {student.full_name}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
              <span className="font-semibold text-gray-600">NISN / ID</span>
              <span className="font-bold text-gray-900 font-mono">: {student.nisn || "-"}</span>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="font-semibold text-gray-600">Kelas & Rombel</span>
              <span className="font-bold text-gray-900">: {assessment.class_name || "-"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
              <span className="font-semibold text-gray-600">Mata Pelajaran</span>
              <span className="font-bold text-emerald-950">: {assessment.subject_name}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
              <span className="font-semibold text-gray-600">Fase / Jenjang</span>
              <span className="font-bold text-gray-900">: {assessment.fase || "-"}</span>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="font-semibold text-gray-600">Semester & TA</span>
              <span className="font-bold text-gray-900">: {assessment.semester_name || "-"} • TA {assessment.academic_year_name || "-"}</span>
            </div>
          </div>
        </div>

        {/* ─── I. Hasil Penilaian Tujuan Pembelajaran (Table) ────────── */}
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-1.5 flex items-center gap-1.5 print-break-after-avoid">
            <span className="w-1.5 h-3.5 bg-emerald-600 rounded-xs inline-block"></span>
            <span>I. Hasil Penilaian Tujuan Pembelajaran (TP)</span>
          </h3>

          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-emerald-50/70 print:bg-gray-100 text-emerald-950 print:text-gray-900 border-b border-gray-300 font-bold">
                  <th className="py-2 px-2 border-r border-gray-300 w-10 text-center">No</th>
                  <th className="py-2 px-2 border-r border-gray-300 w-16 text-center font-mono">Kode</th>
                  <th className="py-2 px-3 border-r border-gray-300 text-left">Tujuan Pembelajaran (TP)</th>
                  <th className="py-2 px-2 border-r border-gray-300 w-16 text-center">Nilai</th>
                  <th className="py-2 px-3 border-r border-gray-300 w-28 text-center">Ketercapaian</th>
                  <th className="py-2 px-3 w-52 text-left">Catatan & Refleksi Bukti Belajar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {tps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-gray-400 italic">
                      Belum ada Tujuan Pembelajaran yang dikonfigurasikan atau dinilai.
                    </td>
                  </tr>
                ) : (
                  tps.map((tp, idx) => (
                    <tr key={tp.tp_id || idx} className="hover:bg-gray-50/50 print:hover:bg-transparent print-break-inside-avoid">
                      <td className="py-2 px-2 border-r border-gray-300 text-center text-gray-600 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2 border-r border-gray-300 text-center font-mono font-semibold text-gray-700">
                        {tp.tp_code || `TP-${String(idx + 1).padStart(2, "0")}`}
                      </td>
                      <td className="py-2 px-3 border-r border-gray-300 leading-relaxed text-[11px] text-gray-900">
                        {tp.tp_text}
                      </td>
                      <td className="py-2 px-2 border-r border-gray-300 text-center font-bold text-sm text-gray-900">
                        {tp.score !== null ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 print:border-none print:bg-transparent">
                            {tp.score}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-gray-300 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${tp.predicate.colorClass} print:border print:bg-transparent`}
                        >
                          {tp.predicate.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-gray-700 leading-relaxed">
                        {tp.reflection?.trim() ? (
                          tp.reflection
                        ) : (
                          <span className="text-gray-400 italic">Capaian tuntas teramati.</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}

                {/* Summary / Average Row */}
                {tps.length > 0 && (
                  <tr className="bg-emerald-50/60 print:bg-gray-100 font-bold border-t-2 border-emerald-800 print:border-gray-400 print-break-inside-avoid">
                    <td colSpan={3} className="py-2 px-3 border-r border-gray-300 text-right text-emerald-950 print:text-black">
                      Rata-Rata Capaian Akhir Mata Pelajaran:
                    </td>
                    <td className="py-2 px-2 border-r border-gray-300 text-center text-sm font-black text-emerald-950">
                      {summary.average_score !== null ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 border border-emerald-300 print:border-none print:bg-transparent">
                          {summary.average_score}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-gray-300 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${summary.predicate.colorClass} print:border print:bg-transparent`}
                      >
                        {summary.predicate.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[10px] text-gray-600 font-normal">
                      Skala: 0–100 (Kriteria Tuntas &ge; 76)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── II. Deskripsi Capaian Kompetensi & Catatan ─────────────── */}
        <div className="mt-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5 print-break-after-avoid">
            <span className="w-1.5 h-3.5 bg-emerald-600 rounded-xs inline-block"></span>
            <span>II. Deskripsi Capaian Kompetensi & Catatan Guru Pengampu</span>
          </h3>

          {/* Card A: Deskripsi Capaian Kompetensi */}
          <div className="border-l-4 border-emerald-600 bg-emerald-50/30 p-3 rounded-r-lg print:border-emerald-600 print:bg-transparent print-break-inside-avoid text-xs">
            <span className="font-bold text-emerald-900 block mb-1 text-[11px] uppercase tracking-wide">
              A. Deskripsi Capaian Kompetensi:
            </span>
            <p className="text-gray-800 leading-relaxed text-[11px] whitespace-pre-wrap">
              {summary.competency_description?.trim() ? (
                summary.competency_description
              ) : (
                <span className="text-gray-400 italic">
                  Ananda telah menyelesaikan asesmen Tujuan Pembelajaran (TP) pada mata pelajaran ini dengan capaian yang terdokumentasi dalam rubrik penilaian.
                </span>
              )}
            </p>
          </div>

          {/* Card B: Catatan & Saran Tindak Lanjut Tutor */}
          <div className="border-l-4 border-blue-500 bg-blue-50/30 p-3 rounded-r-lg print:border-blue-500 print:bg-transparent print-break-inside-avoid text-xs">
            <span className="font-bold text-blue-900 block mb-1 text-[11px] uppercase tracking-wide">
              B. Catatan & Saran Tindak Lanjut Tutor Pengampu:
            </span>
            <p className="text-gray-800 leading-relaxed text-[11px] whitespace-pre-wrap">
              {summary.catatan_tutor?.trim() ? (
                summary.catatan_tutor
              ) : (
                <span className="text-gray-400 italic">
                  Pertahankan semangat belajar dan terus kembangkan pemahaman konsep secara terpadu dan berkelanjutan.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ─── III. Pengesahan & Tanda Tangan ──────────────────────────── */}
      <div className="mt-6 pt-4 border-t border-gray-300 print-break-inside-avoid">
        {/* Tanggal cetak tanpa nama kota (hanya tanggal, bulan, dan tahun) */}
        <div className="text-right text-xs font-medium text-gray-700 mb-3 print:text-black">
          {currentDateFormatted}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          {/* Kolom 1: Orang Tua / Wali */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">Orang Tua / Wali Murid,</p>
            <div>
              <div className="border-b border-black w-36 mx-auto mb-1"></div>
              <p className="text-[10px] text-gray-500">(Nama & Tanda Tangan)</p>
            </div>
          </div>

          {/* Kolom 2: Tutor Pengampu */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">Tutor Pengampu,</p>
            <div>
              <p className="font-bold underline text-gray-900">
                {tutorName || "Tutor Pengampu Mata Pelajaran"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">PKBM Baitusyukur Learning Center</p>
            </div>
          </div>

          {/* Kolom 3: Kepala PKBM */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">Kepala PKBM BLC,</p>
            <div>
              <p className="font-bold underline text-gray-900">
                {kepalaName || resolvedSchoolSettings?.school_headmaster_name || "Kepala PKBM BLC"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                NIP/ID. {resolvedSchoolSettings?.school_headmaster_nip || "........................................"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[9px] text-gray-400 border-t border-gray-100 pt-2 print:border-t-0">
          Lembar Penilaian KKTP Resmi • Dicetak melalui Sistem Informasi Pembelajaran Terpadu SIUBA PKBM
        </div>
      </div>
    </div>
  );
}
