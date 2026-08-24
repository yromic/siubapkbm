"use client";

import React from "react";
import { ScoreCategory, getScoreCategory } from "@/lib/utils/academicUtils";

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
      className={`trisula-report-sheet bg-white text-zinc-950 p-6 sm:p-8 md:p-10 font-sans shadow-sm border border-zinc-200 mx-auto max-w-[210mm] min-h-[297mm] flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:min-h-0 ${
        isPrintBreak ? "print-page-break" : ""
      } ${className}`}
    >
      {/* Top Header / KOP PKBM BLC */}
      <div>
        <div className="border-b-2 border-zinc-900 pb-3 text-center">
          <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-zinc-900 leading-snug">
            PKBM BAITUSYUKUR LEARNING CENTER (BLC)
          </h1>
          <p className="text-xs font-semibold text-zinc-700 mt-0.5">
            Pendidikan Kesetaraan Paket A / B / C • Kurikulum Merdeka Terintegrasi BLC
          </p>
          <p className="text-[11px] text-zinc-500">
            Pusat Kegiatan Belajar Mengajar & Pengembangan Karakter Generasi Qurani
          </p>
          
          <div className="mt-2.5 pt-2 border-t border-zinc-300 flex flex-col items-center">
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide text-zinc-900 underline decoration-1 underline-offset-2">
              RAPORT TRISULA AKADEMIK BLC
            </h2>
            <span className="text-[11px] font-mono text-zinc-500 mt-0.5 font-medium">
              No: {docNumber}
            </span>
          </div>
        </div>

        {/* Student Metadata Section */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs bg-zinc-50 print:bg-transparent p-3 rounded-xl border border-zinc-200 print:border-none print:p-0">
          <div className="space-y-1">
            <div className="flex">
              <span className="w-28 font-semibold text-zinc-600">Nama Murid</span>
              <span className="mr-2 font-bold">:</span>
              <span className="font-bold text-zinc-900 uppercase">{student.full_name}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-semibold text-zinc-600">NISN / ID</span>
              <span className="mr-2">:</span>
              <span className="text-zinc-800 font-mono">{student.nisn || "-"}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-semibold text-zinc-600">Fase / Jenjang</span>
              <span className="mr-2">:</span>
              <span className="text-zinc-800 font-semibold">{assessment.fase || "-"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex">
              <span className="w-28 font-semibold text-zinc-600">Kelas & Rombel</span>
              <span className="mr-2 font-bold">:</span>
              <span className="font-bold text-zinc-900">{assessment.class_name || "-"}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-semibold text-zinc-600">Semester / TA</span>
              <span className="mr-2">:</span>
              <span className="text-zinc-800 font-medium">
                {assessment.semester_name || "-"} / {assessment.academic_year_name || "-"}
              </span>
            </div>
            <div className="flex">
              <span className="w-28 font-semibold text-zinc-600">Bidang Asesmen</span>
              <span className="mr-2">:</span>
              <span className="text-emerald-800 font-bold">Trisula Akademik BLC</span>
            </div>
          </div>
        </div>

        {/* I. Capaian Asesmen Trisula Akademik BLC (Table) */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 mb-2 flex items-center gap-1.5">
            <span>I.</span>
            <span>Capaian Asesmen Trisula Akademik BLC (Literasi, Numerasi & Diniyyah)</span>
          </h3>

          <div className="border border-zinc-900 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100 text-zinc-900 border-b border-zinc-900 font-bold">
                  <th className="py-2 px-3 border-r border-zinc-900 w-36">Pilar Trisula BLC</th>
                  <th className="py-2 px-2 border-r border-zinc-900 w-16 text-center">Nilai</th>
                  <th className="py-2 px-3 border-r border-zinc-900 w-28 text-center">Kategori</th>
                  <th className="py-2 px-3">Deskripsi Ketercapaian Integrasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-800">
                {/* 1. Literasi */}
                <tr>
                  <td className="py-2.5 px-3 border-r border-zinc-900 font-bold">
                    Literasi
                  </td>
                  <td className="py-2.5 px-2 border-r border-zinc-900 text-center font-bold text-sm">
                    {litScore !== null ? litScore : "—"}
                  </td>
                  <td className="py-2.5 px-3 border-r border-zinc-900 text-center font-semibold text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 print:bg-transparent font-bold">
                      {litCat?.label || "Belum Dinilai"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] leading-relaxed italic text-zinc-700">
                    {summary?.literasi_description || "Santri aktif mengikuti pembelajaran membaca dan pemahaman teks terintegrasi."}
                  </td>
                </tr>

                {/* 2. Numerasi */}
                <tr>
                  <td className="py-2.5 px-3 border-r border-zinc-900 font-bold">
                    Numerasi
                  </td>
                  <td className="py-2.5 px-2 border-r border-zinc-900 text-center font-bold text-sm">
                    {numScore !== null ? numScore : "—"}
                  </td>
                  <td className="py-2.5 px-3 border-r border-zinc-900 text-center font-semibold text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 print:bg-transparent font-bold">
                      {numCat?.label || "Belum Dinilai"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] leading-relaxed italic text-zinc-700">
                    {summary?.numerasi_description || "Santri menunjukkan penalaran matematis dan kemampuan pemecahan masalah kontekstual."}
                  </td>
                </tr>

                {/* 3. Diniyyah */}
                <tr>
                  <td className="py-2.5 px-3 border-r border-zinc-900 font-bold">
                    Diniyyah
                  </td>
                  <td className="py-2.5 px-2 border-r border-zinc-900 text-center font-bold text-sm">
                    {dinScore !== null ? dinScore : "—"}
                  </td>
                  <td className="py-2.5 px-3 border-r border-zinc-900 text-center font-semibold text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 print:bg-transparent font-bold">
                      {dinCat?.label || "Belum Dinilai"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] leading-relaxed italic text-zinc-700">
                    {summary?.diniyyah_description || "Santri mengamalkan adab islami, ketertiban ibadah harian, dan karakter fitrah mulia."}
                  </td>
                </tr>

                {/* Summary Row */}
                <tr className="bg-zinc-50 font-bold border-t-2 border-zinc-900">
                  <td className="py-2 px-3 border-r border-zinc-900 text-zinc-900">
                    Rata-Rata Akhir
                  </td>
                  <td className="py-2 px-2 border-r border-zinc-900 text-center text-sm font-black text-emerald-800">
                    {ovScore !== null ? ovScore : "—"}
                  </td>
                  <td className="py-2 px-3 border-r border-zinc-900 text-center font-bold text-zinc-900 text-[11px]">
                    {ovCat?.label || "—"}
                  </td>
                  <td className="py-2 px-3 text-[10px] text-zinc-600 font-normal">
                    Skala Penilaian: 90–100 (Sangat Baik), 75–89 (Baik), 60–74 (Cukup), &lt;60 (Perlu Bimbingan)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* II. Rangkuman Capaian Trisula BLC & Kemitraan Orang Tua */}
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
            <span>II.</span>
            <span>Rangkuman Capaian Trisula BLC & Kemitraan Orang Tua</span>
          </h3>

          {/* Catatan & Rekomendasi Trisula */}
          <div className="p-3 rounded-lg border border-zinc-900 bg-zinc-50/40 print:bg-transparent text-xs">
            <span className="font-bold text-zinc-900 block mb-1 text-[11px] uppercase tracking-wide">
              A. Catatan & Rekomendasi Perkembangan Trisula:
            </span>
            <p className="text-zinc-800 leading-relaxed text-[11px] whitespace-pre-wrap">
              {summary?.catatan_rangkuman ||
                "Santri menunjukkan komitmen belajar yang baik pada pilar Literasi, Numerasi, dan Diniyyah. Disarankan untuk terus mempertahankan ketekunan membaca dan adab kebiasaan harian."}
            </p>
          </div>

          {/* Pesan Penguatan Trisula di Rumah */}
          <div className="p-3 rounded-lg border border-zinc-900 bg-zinc-50/40 print:bg-transparent text-xs">
            <span className="font-bold text-zinc-900 block mb-1 text-[11px] uppercase tracking-wide">
              B. Pesan Penguatan Trisula di Rumah (Kemitraan Madrasatul Ula):
            </span>
            <p className="text-zinc-800 leading-relaxed text-[11px] whitespace-pre-wrap">
              {summary?.pesan_orang_tua ||
                "Mohon Ayah/Bunda senantiasa mendampingi tilawah harian di rumah, mengajak ananda berdiskusi buku bacaan, serta memberikan keteladanan ibadah tepat waktu."}
            </p>
          </div>
        </div>
      </div>

      {/* III. Signatures Section */}
      <div className="mt-8 pt-4 border-t border-zinc-300 print:break-inside-avoid">
        <div className="text-right text-[11px] text-zinc-600 mb-4">
          Baitusyukur, {currentDateFormatted}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          {/* Kolom 1: Orang Tua / Wali */}
          <div className="flex flex-col justify-between h-28">
            <p className="font-medium text-zinc-700">
              Orang Tua / Wali Murid,
            </p>
            <div>
              <div className="border-b border-zinc-900 w-36 mx-auto mb-1"></div>
              <p className="text-[10px] text-zinc-500">(Nama & Tanda Tangan)</p>
            </div>
          </div>

          {/* Kolom 2: Tutor Pembimbing */}
          <div className="flex flex-col justify-between h-28">
            <p className="font-medium text-zinc-700">
              Tutor Pembimbing BLC,
            </p>
            <div>
              <p className="font-bold underline text-zinc-900">
                {tutorName || "Tutor Kelas Trisula"}
              </p>
              <p className="text-[10px] text-zinc-500">NIP/ID. ........................................</p>
            </div>
          </div>

          {/* Kolom 3: Kepala PKBM */}
          <div className="flex flex-col justify-between h-28">
            <p className="font-medium text-zinc-700">
              Kepala PKBM BLC,
            </p>
            <div>
              <p className="font-bold underline text-zinc-900">
                {kepalaName || "Kepala PKBM BLC"}
              </p>
              <p className="text-[10px] text-zinc-500">NIP/ID. ........................................</p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[9px] text-zinc-400">
          Lembar Raport Trisula Resmi • Dicetak melalui Sistem Informasi Pembelajaran Terpadu SIUBA PKBM
        </div>
      </div>
    </div>
  );
}
