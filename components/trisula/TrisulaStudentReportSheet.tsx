"use client";

import React from "react";
import { ScoreCategory, getScoreCategory } from "@/lib/utils/academicUtils";
import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import { BookOpen, Calculator, HeartHandshake } from "lucide-react";

export interface TrisulaStudentReportData {
  assessment: {
    id: string;
    title?: string;
    class_id?: string;
    class_name?: string;
    academic_year_name?: string;
    semester_name?: string;
    fase?: string;
  };
  student: {
    id: string;
    full_name: string;
    nisn?: string | null;
    gender?: string | null;
  };
  summary?: {
    literasi_score?: number | null;
    numerasi_score?: number | null;
    diniyyah_score?: number | null;
    overall_score?: number | null;
    literasi_description?: string | null;
    numerasi_description?: string | null;
    diniyyah_description?: string | null;
    catatan_rangkuman?: string | null;
    pesan_orang_tua?: string | null;
  } | null;
  tutorName?: string;
  kepalaName?: string;
  documentNumber?: string;
}

interface TrisulaStudentReportSheetProps {
  data: TrisulaStudentReportData;
  className?: string;
  isPrintBreak?: boolean;
  /** Resolved letterhead URL (historical snapshot or active global). Defaults to static path. */
  letterheadUrl?: string;
  /** School settings for textual fallback rendering */
  schoolSettings?: {
    school_name?: string;
    school_sub_header?: string;
    school_headmaster_name?: string;
    school_headmaster_nip?: string;
  };
}

export function generateTrisulaDocumentNumber(
  academicYear?: string,
  semester?: string,
  className?: string,
  studentIdOrNisn?: string
): string {
  const cleanYear = (academicYear || new Date().getFullYear().toString()).replace(/[^a-zA-Z0-9]/g, "");
  const cleanSem = (semester || "SM1").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const cleanClass = (className || "BLC").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const cleanStudent = (studentIdOrNisn || "001").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `BLC/TRISULA/${cleanYear}/${cleanSem}/${cleanClass}/${cleanStudent}`;
}

export function TrisulaStudentReportSheet({
  data,
  className = "",
  isPrintBreak = false,
  letterheadUrl,
  schoolSettings,
}: TrisulaStudentReportSheetProps) {
  const { assessment, student, summary, tutorName, kepalaName } = data;

  const litScore = summary?.literasi_score !== null && summary?.literasi_score !== undefined ? Number(summary.literasi_score) : null;
  const numScore = summary?.numerasi_score !== null && summary?.numerasi_score !== undefined ? Number(summary.numerasi_score) : null;
  const dinScore = summary?.diniyyah_score !== null && summary?.diniyyah_score !== undefined ? Number(summary.diniyyah_score) : null;
  const ovScore = summary?.overall_score !== null && summary?.overall_score !== undefined ? Number(summary.overall_score) : null;

  const litCat: ScoreCategory | null = getScoreCategory(litScore);
  const numCat: ScoreCategory | null = getScoreCategory(numScore);
  const dinCat: ScoreCategory | null = getScoreCategory(dinScore);
  const ovCat: ScoreCategory | null = getScoreCategory(ovScore);

  const docNumber = data.documentNumber || generateTrisulaDocumentNumber(
    assessment?.academic_year_name,
    assessment?.semester_name,
    assessment?.class_name,
    student?.nisn || student?.id
  );

  const currentDateFormatted = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={`trisula-report-sheet bg-white text-gray-950 p-6 sm:p-8 md:p-10 font-sans shadow-sm border border-gray-200 mx-auto max-w-[210mm] space-y-4 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-4 ${
        isPrintBreak ? "print-page-break" : ""
      } ${className}`}
    >
      {/* Top Header / KOP PKBM BLC */}
      <div>
        <div className="pb-2 text-center">
          <OfficialSchoolLetterhead
            src={letterheadUrl}
            schoolSettings={schoolSettings}
          />
          
          <div className="mt-3 pt-2 border-t-2 border-emerald-800 flex flex-col items-center print:border-emerald-800 print-break-inside-avoid">
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-emerald-950">
              RAPORT TRISULA AKADEMIK BLC
            </h2>
            <span className="text-[11px] font-mono text-emerald-800 mt-0.5 font-semibold">
              No: {docNumber}
            </span>
          </div>
        </div>

        {/* Student Metadata Section */}
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs bg-emerald-50/30 p-3 rounded-lg border border-emerald-200 print:border-gray-300 print:bg-transparent print-break-inside-avoid">
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
              <span className="font-semibold text-gray-600">Fase / Jenjang</span>
              <span className="font-bold text-gray-900">: {assessment.fase || "-"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
              <span className="font-semibold text-gray-600">Kelas & Rombel</span>
              <span className="font-bold text-gray-900">: {assessment.class_name || "-"}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
              <span className="font-semibold text-gray-600">Semester / TA</span>
              <span className="font-bold text-gray-900">: {assessment.semester_name || "-"} • TA {assessment.academic_year_name || "-"}</span>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <span className="font-semibold text-gray-600">Bidang Asesmen</span>
              <span className="text-emerald-800 font-bold">: Trisula Akademik BLC</span>
            </div>
          </div>
        </div>

        {/* I. Capaian Asesmen Trisula Akademik BLC (Table) */}
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-1.5 flex items-center gap-1.5 print-break-after-avoid">
            <span className="w-1.5 h-3.5 bg-emerald-600 rounded-xs inline-block"></span>
            <span>I. Capaian Asesmen Trisula Akademik BLC (Literasi, Numerasi & Diniyyah)</span>
          </h3>

          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-emerald-50/70 print:bg-gray-100 text-emerald-950 print:text-gray-900 border-b border-gray-300 font-bold">
                  <th className="py-2 px-3 border-r border-gray-300 w-40">Pilar Trisula BLC</th>
                  <th className="py-2 px-2 border-r border-gray-300 w-16 text-center">Nilai</th>
                  <th className="py-2 px-3 border-r border-gray-300 w-32 text-center">Kategori</th>
                  <th className="py-2 px-3">Deskripsi Ketercapaian Integrasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {/* 1. Literasi */}
                <tr className="print-break-inside-avoid">
                  <td className="py-2.5 px-3 border-r border-gray-300 font-bold text-blue-950 bg-blue-50/20 print:bg-transparent">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Literasi</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 border-r border-gray-300 text-center font-bold text-sm text-gray-900">
                    {litScore !== null ? (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 print:border-none print:bg-transparent">
                        {litScore}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 px-3 border-r border-gray-300 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${litCat ? litCat.colorClass : "text-gray-500 bg-gray-100 border-gray-200"} print:border print:bg-transparent`}>
                      {litCat?.label || "Belum Dinilai"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] leading-relaxed text-gray-700">
                    {summary?.literasi_description?.trim() ? (
                      summary.literasi_description
                    ) : (
                      <span className="text-gray-400 italic">Belum ada deskripsi ketercapaian.</span>
                    )}
                  </td>
                </tr>

                {/* 2. Numerasi */}
                <tr className="print-break-inside-avoid">
                  <td className="py-2.5 px-3 border-r border-gray-300 font-bold text-teal-950 bg-teal-50/20 print:bg-transparent">
                    <div className="flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-teal-600" />
                      <span>Numerasi</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 border-r border-gray-300 text-center font-bold text-sm text-gray-900">
                    {numScore !== null ? (
                      <span className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 print:border-none print:bg-transparent">
                        {numScore}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 px-3 border-r border-gray-300 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${numCat ? numCat.colorClass : "text-gray-500 bg-gray-100 border-gray-200"} print:border print:bg-transparent`}>
                      {numCat?.label || "Belum Dinilai"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] leading-relaxed text-gray-700">
                    {summary?.numerasi_description?.trim() ? (
                      summary.numerasi_description
                    ) : (
                      <span className="text-gray-400 italic">Belum ada deskripsi ketercapaian.</span>
                    )}
                  </td>
                </tr>

                {/* 3. Diniyyah */}
                <tr className="print-break-inside-avoid">
                  <td className="py-2.5 px-3 border-r border-gray-300 font-bold text-amber-950 bg-amber-50/20 print:bg-transparent">
                    <div className="flex items-center gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                      <span>Diniyyah & Adab</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 border-r border-gray-300 text-center font-bold text-sm text-gray-900">
                    {dinScore !== null ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 print:border-none print:bg-transparent">
                        {dinScore}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 px-3 border-r border-gray-300 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${dinCat ? dinCat.colorClass : "text-gray-500 bg-gray-100 border-gray-200"} print:border print:bg-transparent`}>
                      {dinCat?.label || "Belum Dinilai"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] leading-relaxed text-gray-700">
                    {summary?.diniyyah_description?.trim() ? (
                      summary.diniyyah_description
                    ) : (
                      <span className="text-gray-400 italic">Belum ada deskripsi ketercapaian.</span>
                    )}
                  </td>
                </tr>

                {/* Summary Row */}
                <tr className="bg-emerald-50/60 print:bg-gray-100 font-bold border-t-2 border-emerald-800 print:border-gray-400 print-break-inside-avoid">
                  <td className="py-2 px-3 border-r border-gray-300 text-emerald-950 print:text-black">
                    Rata-Rata Akhir
                  </td>
                  <td className="py-2 px-2 border-r border-gray-300 text-center text-sm font-black text-emerald-950">
                    {ovScore !== null ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 border border-emerald-300 print:border-none print:bg-transparent">
                        {ovScore}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 px-3 border-r border-gray-300 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${ovCat ? ovCat.colorClass : "text-gray-500 bg-gray-100 border-gray-200"} print:border print:bg-transparent`}>
                      {ovCat?.label || "—"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[10px] text-gray-600 font-normal">
                    Skala: 90–100 (Sangat Baik), 75–89 (Baik), 60–74 (Cukup), &lt;60 (Perlu Bimbingan)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* II. Rangkuman Capaian Trisula BLC & Kemitraan Orang Tua */}
        <div className="mt-4 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-1.5 print-break-after-avoid">
            <span className="w-1.5 h-3.5 bg-emerald-600 rounded-xs inline-block"></span>
            <span>II. Rangkuman Capaian Trisula BLC & Kemitraan Orang Tua</span>
          </h3>

          {/* Catatan & Rekomendasi Trisula */}
          <div className="border-l-4 border-blue-500 bg-blue-50/30 p-3 rounded-r-lg print:border-blue-500 print:bg-transparent print-break-inside-avoid text-xs">
            <span className="font-bold text-blue-900 block mb-1 text-[11px] uppercase tracking-wide">
              A. Catatan & Rekomendasi Perkembangan Trisula:
            </span>
            <p className="text-gray-800 leading-relaxed text-[11px] whitespace-pre-wrap">
              {summary?.catatan_rangkuman?.trim() ? (
                summary.catatan_rangkuman
              ) : (
                <span className="text-gray-400 italic">Belum ada catatan rangkuman perkembangan.</span>
              )}
            </p>
          </div>

          {/* Pesan Penguatan Trisula di Rumah */}
          <div className="border-l-4 border-amber-500 bg-amber-50/40 p-3 rounded-r-lg print:border-amber-500 print:bg-transparent print-break-inside-avoid text-xs">
            <span className="font-bold text-amber-900 block mb-1 text-[11px] uppercase tracking-wide">
              B. Pesan Penguatan Trisula di Rumah (Kemitraan Madrasatul Ula):
            </span>
            <p className="text-gray-800 leading-relaxed text-[11px] whitespace-pre-wrap">
              {summary?.pesan_orang_tua?.trim() ? (
                summary.pesan_orang_tua
              ) : (
                <span className="text-gray-400 italic">Belum ada pesan kemitraan orang tua.</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* III. Signatures Section */}
      <div className="mt-6 pt-4 border-t border-gray-300 print-break-inside-avoid">
        <div className="text-right text-[11px] text-gray-600 mb-3">
          Baitusyukur, {currentDateFormatted}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          {/* Kolom 1: Orang Tua / Wali */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">
              Orang Tua / Wali Murid,
            </p>
            <div>
              <div className="border-b border-black w-36 mx-auto mb-1"></div>
              <p className="text-[10px] text-gray-500">(Nama & Tanda Tangan)</p>
            </div>
          </div>

          {/* Kolom 2: Tutor Pembimbing */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">
              Tutor Pengampu,
            </p>
            <div>
              <p className="font-bold underline text-gray-900">
                {tutorName || "Tutor Kelas Trisula"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">ID: ........................................</p>
            </div>
          </div>

          {/* Kolom 3: Kepala PKBM */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">
              Kepala PKBM BLC,
            </p>
            <div>
              <p className="font-bold underline text-gray-900">
                {kepalaName || schoolSettings?.school_headmaster_name || "Kepala PKBM BLC"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">NIP/ID. {schoolSettings?.school_headmaster_nip || "........................................"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[9px] text-gray-400">
          Lembar Raport Trisula Resmi • Dicetak melalui Sistem Informasi Pembelajaran Terpadu SIUBA PKBM
        </div>
      </div>
    </div>
  );
}
