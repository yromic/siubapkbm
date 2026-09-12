"use client";

import React from "react";
import { X, CheckCircle2, Eye, ShieldCheck, Calendar, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import { LetterheadVersion } from "@/types/letterhead";

interface LetterheadA4PreviewModalProps {
  letterhead: LetterheadVersion | null;
  isOpen: boolean;
  onClose: () => void;
  onActivate?: (id: string) => void;
  isActivating?: boolean;
  schoolSettings?: {
    school_name?: string;
    school_sub_header?: string;
  };
}

export function LetterheadA4PreviewModal({
  letterhead,
  isOpen,
  onClose,
  onActivate,
  isActivating = false,
  schoolSettings,
}: LetterheadA4PreviewModalProps) {
  if (!isOpen || !letterhead) return null;

  const isActive = letterhead.status === "ACTIVE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 shadow-xs">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  Pratinjau Kertas A4 &mdash; {letterhead.name}
                </h3>
                {isActive ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Kop Resmi Aktif
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {letterhead.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {new Date(letterhead.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" /> {(letterhead.size_bytes / 1024).toFixed(1)} KB ({letterhead.ext.toUpperCase()})
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white/80 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Realistic A4 Sheet Simulation */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-100/80 flex justify-center">
          <div className="bg-white text-zinc-900 w-full max-w-[210mm] shadow-md border border-zinc-200 rounded-sm p-6 sm:p-10 font-sans min-h-[297mm] flex flex-col justify-between">
            {/* Top Sheet Content */}
            <div>
              {/* Kop Surat Header */}
              <div className="mb-4">
                <OfficialSchoolLetterhead
                  src={letterhead.url}
                  schoolSettings={schoolSettings}
                />
              </div>

              {/* Title bar simulating an official document */}
              <div className="text-center border-t border-zinc-300 pt-3 mb-6">
                <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide text-zinc-900 underline decoration-1 underline-offset-2">
                  CONTOH DOKUMEN RESMI KURIKULUM & ASESMEN
                </h2>
                <p className="text-[11px] font-medium text-zinc-500 mt-0.5">
                  Nomor: BLC/OFFICIAL/{new Date().getFullYear()}/001 &bull; Pratinjau Skala Visual A4
                </p>
              </div>

              {/* Metadata box */}
              <div className="mb-5 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-200 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p><span className="font-semibold text-zinc-500">Institusi:</span> {schoolSettings?.school_name || "PKBM Baitusyukur Learning Center"}</p>
                  <p><span className="font-semibold text-zinc-500">Mata Pelajaran:</span> Bahasa Indonesia / Matematika</p>
                  <p><span className="font-semibold text-zinc-500">Fase / Kelas:</span> Fase B (Kelas 4)</p>
                </div>
                <div className="space-y-1.5 text-right">
                  <p><span className="font-semibold text-zinc-500">Versi Kop:</span> {letterhead.name}</p>
                  <p><span className="font-semibold text-zinc-500">Status Kop:</span> <span className="font-bold text-emerald-700">{letterhead.status}</span></p>
                  <p><span className="font-semibold text-zinc-500">Simulasi Cetak:</span> Ukuran Standar A4 (210 &times; 297 mm)</p>
                </div>
              </div>

              {/* Skeleton content */}
              <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
                <div className="h-3 bg-zinc-200/70 rounded-sm w-3/4 animate-pulse" />
                <div className="h-3 bg-zinc-200/50 rounded-sm w-full animate-pulse" />
                <div className="h-3 bg-zinc-200/60 rounded-sm w-5/6 animate-pulse" />
                <div className="h-3 bg-zinc-200/40 rounded-sm w-2/3 animate-pulse" />

                <div className="mt-6 border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100/80 text-zinc-600 font-bold border-b border-zinc-200">
                      <tr>
                        <th className="p-2 w-10 text-center">No</th>
                        <th className="p-2">Tujuan Pembelajaran / Indikator</th>
                        <th className="p-2 text-center w-24">Ketercapaian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      <tr>
                        <td className="p-2 text-center font-medium text-zinc-400">1</td>
                        <td className="p-2">Memahami konsep dasar dan nilai-nilai adab belajar Islami.</td>
                        <td className="p-2 text-center font-semibold text-emerald-700">Tercapai</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-center font-medium text-zinc-400">2</td>
                        <td className="p-2">Mampu menerapkan penalaran logis dalam pemecahan masalah harian.</td>
                        <td className="p-2 text-center font-semibold text-emerald-700">Tercapai</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Signature Preview */}
            <div className="mt-10 pt-6 border-t border-zinc-200 flex justify-between items-end text-xs text-center text-zinc-700">
              <div className="w-40">
                <p className="mb-14 text-[11px] text-zinc-500">Tutor Pengampu,</p>
                <div className="border-b border-zinc-800 w-32 mx-auto mb-1" />
                <p className="font-semibold text-zinc-900">Ustadz / Ustadzah</p>
              </div>
              <div className="w-40">
                <p className="mb-14 text-[11px] text-zinc-500">Kepala PKBM BLC,</p>
                <div className="border-b border-zinc-800 w-32 mx-auto mb-1" />
                <p className="font-semibold text-zinc-900">Kepala Sekolah</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Path aset: <code className="bg-white px-2 py-0.5 rounded border text-gray-700 font-mono text-[11px]">{letterhead.url}</code>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Tutup
            </Button>
            {!isActive && onActivate && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                onClick={() => onActivate(letterhead.id)}
                disabled={isActivating || letterhead.status === "ARCHIVED"}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                {isActivating ? "Mengaktifkan..." : "Aktifkan Kop Ini"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
