"use client";

import React from "react";
import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import type { RaportAcademicSummaryReport } from "@/lib/services/raportTerpaduService";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface AcademicSummarySectionProps {
  data: RaportAcademicSummaryReport;
  className?: string;
  isPrintBreak?: boolean;
}

export function AcademicSummarySection({
  data,
  className = "",
  isPrintBreak = false,
}: AcademicSummarySectionProps) {
  const {
    student,
    period,
    class: cls,
    tutor,
    school,
    subjects,
    academic_summary,
    semester_tutor_note,
    readiness,
    document_number,
  } = data;

  const currentDateFormatted = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={`raport-academic-sheet bg-white text-gray-950 p-6 sm:p-8 md:p-10 font-sans shadow-sm border border-gray-200 mx-auto max-w-[210mm] space-y-4 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-4 ${
        isPrintBreak ? "print-page-break" : ""
      } ${className}`}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* ─── 0. Readiness Warning Banner (Screen Only) ──────────────── */}
      {!readiness.is_ready && (
        <div className="print:hidden rounded-lg bg-amber-50 border border-amber-300 p-4 text-amber-900 mb-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">
                Perhatian: Raport Belum Siap Difinalisasi (Pratinjau Draft)
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                {academic_summary.completed_subject_count} dari{" "}
                {academic_summary.total_subject_count} mata pelajaran telah tuntas dinilai.
                Raport resmi baru dapat disahkan jika seluruh mata pelajaran telah lengkap.
              </p>
              {readiness.reasons.length > 0 && (
                <ul className="list-disc list-inside text-xs mt-1.5 space-y-0.5 text-amber-800">
                  {readiness.reasons.slice(0, 3).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                  {readiness.reasons.length > 3 && (
                    <li>...dan {readiness.reasons.length - 3} catatan lainnya</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── I. Kop Surat Resmi Institusi PKBM BLC ──────────────────── */}
      <OfficialSchoolLetterhead
        src={school.letterhead_url || "/branding/school-letterhead.png"}
        schoolSettings={{
          school_name: school.name,
          school_sub_header: school.address || undefined,
          letterhead_margin_top_mm: school.letterhead_margin_top_mm,
          letterhead_margin_right_mm: school.letterhead_margin_right_mm,
          letterhead_margin_bottom_mm: school.letterhead_margin_bottom_mm,
          letterhead_margin_left_mm: school.letterhead_margin_left_mm,
          letterhead_margin_mode: school.letterhead_margin_mode,
        }}
      />

      {/* ─── Judul Dokumen & Metadata ───────────────────────────────── */}
      <div className="text-center pt-2 pb-1 border-b-2 border-black">
        <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-gray-900">
          RAPORT TERPADU PESERTA DIDIK
        </h2>
        <p className="text-xs sm:text-sm font-bold text-gray-800 uppercase mt-0.5">
          LEMBAR 1: HASIL RATA-RATA CAPAIAN SETIAP MATA PELAJARAN (AKADEMIK)
        </p>
        <p className="text-[11px] text-gray-600 mt-0.5">
          Tahun Ajaran {period.academic_year_name} • Semester {period.semester_name}
        </p>
        <p className="text-[9px] text-gray-400 font-mono mt-1">
          No. Dokumen: {document_number}
        </p>
      </div>

      {/* ─── II. Identitas Peserta Didik ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs py-2 bg-gray-50/75 p-3 rounded border border-gray-200 print:bg-transparent print:border-gray-300">
        <div className="space-y-1">
          <div className="flex">
            <span className="w-32 font-semibold text-gray-600">Nama Lengkap</span>
            <span className="font-bold text-gray-900">: {student.name}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold text-gray-600">NISN / No. Induk</span>
            <span className="text-gray-800">: {student.nisn || "-"}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold text-gray-600">Jenis Kelamin</span>
            <span className="text-gray-800">
              : {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex">
            <span className="w-32 font-semibold text-gray-600">Kelas / Rombel</span>
            <span className="text-gray-800">
              : {cls.name} ({cls.fase ? `Fase ${cls.fase}` : `Tingkat ${cls.level}`})
            </span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold text-gray-600">Tutor Pendamping</span>
            <span className="text-gray-800">: {tutor.name}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold text-gray-600">Status Capaian</span>
            <span className="text-gray-800 font-medium">
              : {readiness.is_ready ? (
                <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Lengkap ({academic_summary.completed_subject_count}/{academic_summary.total_subject_count} Mapel)
                </span>
              ) : (
                <span className="text-amber-700 font-semibold">
                  Belum Lengkap ({academic_summary.completed_subject_count}/{academic_summary.total_subject_count} Mapel)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ─── III. Tabel Hasil Capaian Pembelajaran Akademik ───────────── */}
      <div>
        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-gray-800 font-bold text-center print:bg-gray-200">
              <th className="border border-gray-300 px-2 py-2 w-10">No</th>
              <th className="border border-gray-300 px-3 py-2 text-left w-52">Mata Pelajaran</th>
              <th className="border border-gray-300 px-2 py-2 w-16">Nilai</th>
              <th className="border border-gray-300 px-2 py-2 w-28">Predikat</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Deskripsi Capaian Kompetensi Belajar</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-gray-300 px-3 py-4 text-center text-gray-500 italic">
                  Belum ada mata pelajaran yang dikonfigurasi untuk rombel ini.
                </td>
              </tr>
            ) : (
              subjects.map((item, idx) => (
                <tr key={item.subject_id} className="hover:bg-gray-50/50 print:hover:bg-transparent">
                  <td className="border border-gray-300 px-2 py-2 text-center font-medium">
                    {idx + 1}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-900">
                    {item.subject_name}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">
                    {item.is_complete && item.final_score !== null ? (
                      <span className="text-gray-900 text-sm">{item.final_score}</span>
                    ) : item.provisional_average !== null ? (
                      <span className="text-amber-700 italic text-[11px]" title={`Nilai sementara (${item.scored_tp_count}/${item.total_tp_count} TP)`}>
                        {item.provisional_average}*
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center">
                    {item.predicate ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${item.predicate.colorClass} print:border-none print:bg-transparent print:p-0`}>
                        {item.predicate.label}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px] italic">Belum Dinilai</span>
                    )}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-800 leading-relaxed text-[11px]">
                    {item.competency_description?.trim() ? (
                      item.competency_description
                    ) : !item.is_complete ? (
                      <span className="text-gray-400 italic">
                        {item.total_tp_count === 0
                          ? "Tujuan pembelajaran (TP) belum dikonfigurasi."
                          : `Penilaian belum selesai (${item.scored_tp_count}/${item.total_tp_count} TP dinilai).`}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">
                        Telah menuntaskan seluruh tujuan pembelajaran dengan capaian predikat {item.predicate?.label || "Tuntas"}.
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-500 mt-1 italic print:text-gray-600">
          * Tanda bintang (*) menandakan nilai sementara karena belum seluruh Tujuan Pembelajaran (TP) dinilai tuntas.
        </p>
      </div>

      {/* ─── IV. Rangkuman Nilai Akademik Terpadu ─────────────────────── */}
      <div className="border border-gray-300 rounded p-3.5 bg-gray-50 print:bg-transparent print:border-gray-400 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            RATA-RATA NILAI AKADEMIK TERPADU
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Akumulasi nilai akhir seluruh mata pelajaran yang telah tuntas dinilai
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-black text-gray-900 leading-none">
              {academic_summary.is_complete && academic_summary.overall_average !== null ? (
                academic_summary.overall_average
              ) : (
                <span className="text-amber-700 text-lg font-bold">
                  {academic_summary.completed_subject_count}/{academic_summary.total_subject_count} Mapel
                </span>
              )}
            </div>
            <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
              Skala 0 - 100
            </div>
          </div>

          {academic_summary.category && (
            <div className={`px-3 py-1.5 rounded border text-xs font-bold ${academic_summary.category.colorClass} print:border-gray-400 print:text-black`}>
              {academic_summary.category.label}
            </div>
          )}
        </div>
      </div>

      {/* ─── V. Catatan Tutor Pendamping ────────────────────────────── */}
      <div className="border border-gray-300 rounded p-3.5 space-y-1.5 print:border-gray-400">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
          CATATAN TUTOR PENDAMPING
        </h4>
        <div className="text-xs text-gray-800 leading-relaxed min-h-[50px] p-2 bg-gray-50/50 rounded border border-gray-100 print:bg-transparent print:border-none print:p-0">
          {semester_tutor_note.content?.trim() ? (
            <p className="whitespace-pre-line">{semester_tutor_note.content}</p>
          ) : (
            <p className="text-gray-400 italic">
              (Belum ada catatan perkembangan umum dari tutor pendamping untuk semester ini.)
            </p>
          )}
        </div>
      </div>

      {/* ─── VI. Pengesahan & Tanda Tangan (3 Kolom) ─────────────────── */}
      <div className="mt-6 pt-4 border-t border-gray-300 print-break-inside-avoid">
        {/* Tanggal cetak tanpa nama kota bawaan */}
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

          {/* Kolom 2: Tutor Pendamping (Wali Kelas) */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">Tutor Pendamping,</p>
            <div>
              <p className="font-bold underline text-gray-900">
                {tutor.name || "Tutor Pendamping Kelas"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {tutor.nip ? `NIP. ${tutor.nip}` : "Wali Kelas / Rombel"}
              </p>
            </div>
          </div>

          {/* Kolom 3: Kepala PKBM */}
          <div className="flex flex-col justify-between h-24">
            <p className="font-semibold text-gray-700">Kepala PKBM BLC,</p>
            <div>
              <p className="font-bold underline text-gray-900">
                {school.headmaster_name || "Kepala PKBM BLC"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                NIP/ID. {school.headmaster_nip || "........................................"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[9px] text-gray-400 border-t border-gray-100 pt-2 print:border-t-0">
          Lembar Raport Terpadu Resmi (Lembar 1) • Dicetak melalui Sistem Informasi Pembelajaran Terpadu SIUBA PKBM
        </div>
      </div>
    </div>
  );
}
