"use client";

import React, { useState, useMemo } from "react";
import { X, Search, BookOpen, Heart, AlertCircle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { AcademicMonitoringItem, CultureMonitoringItem } from "@/hooks/useMonitoringData";

interface AcademicDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: AcademicMonitoringItem[] | null;
}

interface CultureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: CultureMonitoringItem[] | null;
}

export function AcademicMonitoringDialog({ isOpen, onClose, loading, error, data }: AcademicDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.teacherName.toLowerCase().includes(query) ||
        item.className.toLowerCase().includes(query) ||
        item.subjectName.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Surface 3 dialog wrapper: #2d2d2d on dark mode, bg-white on light mode */}
      <div 
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-[#2d2d2d] border border-zinc-200 dark:border-zinc-750 rounded-[24px] shadow-2xl overflow-hidden animate-scaleIn"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
              <BookOpen className="w-5 h-5 text-[#468432] dark:text-[#5aa142]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Detail Pengisian Nilai Akademik</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-400">Daftar kelas dan mata pelajaran yang belum final</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        {!error && !loading && (
          <div className="px-6 py-3 bg-zinc-50 dark:bg-[#262626]/40 border-b border-zinc-150 dark:border-zinc-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari guru, kelas, atau mata pelajaran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-550 focus:outline-none focus:ring-0"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-4 border-[#468432] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Memuat detail pengisian akademik...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Gagal Memuat Data</h3>
              <p className="text-xs text-zinc-500 max-w-sm">{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-450 dark:text-zinc-500">
              <p className="text-sm font-medium">Tidak ada data pengisian yang cocok.</p>
              <p className="text-xs mt-1">Coba kata kunci pencarian lain.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Guru</th>
                    <th className="py-2.5 px-3">Kelas</th>
                    <th className="py-2.5 px-3">Mata Pelajaran</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                  {filteredData.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-zinc-50 dark:hover:bg-[#262626]/20 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-zinc-800 dark:text-zinc-100">{item.teacherName}</td>
                      <td className="py-3 px-3 font-medium text-zinc-500 dark:text-zinc-350">{item.className}</td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{item.subjectName}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[10px] leading-tight ${
                          item.status === "Final" 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : item.status === "Belum Final"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        }`}>
                          {item.status === "Final" && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                          {item.status === "Belum Final" && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />}
                          {item.status === "Belum Membuat Assessment" && <AlertCircle className="w-3 h-3 text-red-550 dark:text-red-400 shrink-0" />}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-zinc-50 dark:bg-[#262626]/30 border-t border-zinc-150 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export function CultureMonitoringDialog({ isOpen, onClose, loading, error, data }: CultureDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.waliKelas.toLowerCase().includes(query) ||
        item.className.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Surface 3 dialog wrapper */}
      <div 
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-[#2d2d2d] border border-zinc-200 dark:border-zinc-750 rounded-[24px] shadow-2xl overflow-hidden animate-scaleIn"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-xl">
              <Heart className="w-5 h-5 text-rose-500 dark:text-rose-450" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Detail Pengisian Budaya (SAHABAT)</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-400">Daftar kelas dan Wali Kelas serta kemajuan inputnya</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        {!error && !loading && (
          <div className="px-6 py-3 bg-zinc-50 dark:bg-[#262626]/40 border-b border-zinc-150 dark:border-zinc-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari wali kelas atau kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-550 focus:outline-none focus:ring-0"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-4 border-rose-550 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Memuat detail pengisian budaya...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Gagal Memuat Data</h3>
              <p className="text-xs text-zinc-500 max-w-sm">{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-450 dark:text-zinc-500">
              <p className="text-sm font-medium">Tidak ada data pengisian yang cocok.</p>
              <p className="text-xs mt-1">Coba kata kunci pencarian lain.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Wali Kelas</th>
                    <th className="py-2.5 px-3">Kelas</th>
                    <th className="py-2.5 px-3">Progress</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                  {filteredData.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-zinc-50 dark:hover:bg-[#262626]/20 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-zinc-800 dark:text-zinc-100">{item.waliKelas}</td>
                      <td className="py-3 px-3 font-medium text-zinc-500 dark:text-zinc-350">{item.className}</td>
                      <td className="py-3 px-3 font-bold text-zinc-700 dark:text-zinc-300">{item.progress}%</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[10px] leading-tight ${
                          item.status === "Lengkap" 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : item.status === "Sebagian"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        }`}>
                          {item.status === "Lengkap" && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                          {item.status === "Sebagian" && <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />}
                          {item.status === "Belum Ada Input" && <AlertCircle className="w-3 h-3 text-red-550 dark:text-red-400 shrink-0" />}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-zinc-50 dark:bg-[#262626]/30 border-t border-zinc-150 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
