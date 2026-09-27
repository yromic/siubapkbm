"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Edit3,
  Search,
  ChevronRight,
  School,
  Calendar,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { PageContainer } from "@/components/ui/page-framework";
import { PageHeader } from "@/components/ui-states";
import { RaportTerpaduDocument } from "@/components/raport/RaportTerpaduDocument";
import { RaportTutorNoteModal } from "@/components/raport/RaportTutorNoteModal";
import type {
  ClassRaportReadinessResponse,
  StudentClassReadinessItem,
  RaportAcademicSummaryReport,
} from "@/lib/services/raportTerpaduService";

interface ClassOption {
  id: string;
  class_id?: string;
  class_name?: string;
  name?: string;
  code?: string;
  class_code?: string;
  academic_year_id?: string;
  semester_id?: string;
}

export default function RaportTerpaduPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);
  const [readinessData, setReadinessData] = useState<ClassRaportReadinessResponse | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "READY" | "INCOMPLETE">("ALL");

  // Selected Student for Lembar 1 Preview
  const [selectedStudent, setSelectedStudent] = useState<StudentClassReadinessItem | null>(null);
  const [reportData, setReportData] = useState<RaportAcademicSummaryReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Batch Print Class Reports
  const [batchReportData, setBatchReportData] = useState<RaportAcademicSummaryReport[] | null>(null);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  // Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteStudentTarget, setNoteStudentTarget] = useState<{
    id: string;
    name: string;
    content: string;
  } | null>(null);

  // 1. Load classes on mount
  useEffect(() => {
    async function loadClasses() {
      try {
        setIsLoadingClasses(true);
        const res = await fetch("/api/v1/classes/my");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Gagal memuat daftar kelas.");

        const list: ClassOption[] = json.data || [];
        setClasses(list);

        if (list.length > 0) {
          const firstClass = list[0];
          const classId = firstClass.class_id || firstClass.id;
          setSelectedClassId(classId);
          if (firstClass.academic_year_id) setSelectedAcademicYearId(firstClass.academic_year_id);
          if (firstClass.semester_id) setSelectedSemesterId(firstClass.semester_id);
        }
      } catch (err: any) {
        notify.error(err.message || "Terjadi kesalahan saat memuat kelas.");
      } finally {
        setIsLoadingClasses(false);
      }
    }
    loadClasses();
  }, []);

  // 2. Load class readiness when selectedClassId changes
  const loadClassReadiness = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setIsLoadingReadiness(true);
      let url = `/api/v1/raport/class-readiness?class_id=${encodeURIComponent(selectedClassId)}`;
      if (selectedAcademicYearId) url += `&academic_year_id=${encodeURIComponent(selectedAcademicYearId)}`;
      if (selectedSemesterId) url += `&semester_id=${encodeURIComponent(selectedSemesterId)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal memuat status kesiapan kelas.");

      setReadinessData(json.data);
    } catch (err: any) {
      notify.error(err.message || "Terjadi kesalahan saat memuat status kesiapan.");
    } finally {
      setIsLoadingReadiness(false);
    }
  }, [selectedClassId, selectedAcademicYearId, selectedSemesterId]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassReadiness();
    }
  }, [selectedClassId, loadClassReadiness]);

  // 3. Load Student Academic Summary (Lembar 1)
  const openStudentReport = async (student: StudentClassReadinessItem) => {
    setSelectedStudent(student);
    try {
      setIsLoadingReport(true);
      let url = `/api/v1/raport/academic-summary?student_id=${encodeURIComponent(student.student_id)}`;
      if (selectedAcademicYearId) url += `&academic_year_id=${encodeURIComponent(selectedAcademicYearId)}`;
      if (selectedSemesterId) url += `&semester_id=${encodeURIComponent(selectedSemesterId)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal memuat raport santri.");

      setReportData(json.data);
    } catch (err: any) {
      notify.error(err.message || "Terjadi kesalahan saat memuat raport santri.");
      setSelectedStudent(null);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const closeStudentReport = () => {
    setSelectedStudent(null);
    setReportData(null);
  };

  // 4. Batch Print All Students in Class
  const handleBatchPrint = async () => {
    const studentsToPrint = readinessData?.students || [];
    if (studentsToPrint.length === 0) {
      notify.warning("Tidak ada santri untuk dicetak.");
      return;
    }

    const toastId = notify.loading(`Menyiapkan cetak seluruh raport kelas (0/${studentsToPrint.length})...`);
    setIsBatchPrinting(true);
    try {
      const reports: RaportAcademicSummaryReport[] = [];
      for (const s of studentsToPrint) {
        let url = `/api/v1/raport/academic-summary?student_id=${encodeURIComponent(s.student_id)}`;
        if (selectedAcademicYearId) url += `&academic_year_id=${encodeURIComponent(selectedAcademicYearId)}`;
        if (selectedSemesterId) url += `&semester_id=${encodeURIComponent(selectedSemesterId)}`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data) {
          reports.push(json.data);
        }
      }

      notify.dismiss(toastId);
      if (reports.length > 0) {
        setBatchReportData(reports);
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        notify.error("Tidak ada data raport santri yang berhasil dimuat.");
      }
    } catch {
      notify.dismiss(toastId);
      notify.error("Gagal menyiapkan cetak massal raport kelas.");
    } finally {
      setIsBatchPrinting(false);
    }
  };

  // Filtered Students
  const filteredStudents = (readinessData?.students || []).filter((s) => {
    const matchesSearch =
      s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.nisn && s.nisn.includes(searchQuery));
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "READY" && s.is_ready) ||
      (statusFilter === "INCOMPLETE" && !s.is_ready);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#fdfbf7] dark:bg-zinc-950 pb-16 print:bg-white print:min-h-0 print:pb-0">
      <PageContainer maxWidth="7xl" className="space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-0">
        {/* ─── Standardized PageHeader ───────────────────────────────── */}
        <div className="print:hidden">
          <PageHeader
            title="Raport Terpadu"
            description="Penerbitan dan integrasi penilaian raport modular per rombongan belajar (Lembar 1: Ringkasan Akademik)."
            statusBadge={
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Kurikulum Merdeka
              </span>
            }
            actions={
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBatchPrint}
                  disabled={isBatchPrinting || !readinessData || (readinessData.students || []).length === 0}
                  className="text-xs font-semibold rounded-xl dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 flex-1 sm:flex-none"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-zinc-500 dark:text-zinc-400" />
                  Cetak Raport Kelas ({readinessData?.students?.length || 0})
                </Button>
                <button
                  onClick={() => loadClassReadiness()}
                  disabled={isLoadingReadiness}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReadiness ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Segarkan Data</span>
                </button>
              </div>
            }
          />
        </div>

        {/* ─── Selection Bar ────────────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Kelas Selector */}
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Rombel / Kelas:</span>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedClassId(newId);
                  const cls = classes.find((c) => (c.class_id || c.id) === newId);
                  if (cls?.academic_year_id) setSelectedAcademicYearId(cls.academic_year_id);
                  if (cls?.semester_id) setSelectedSemesterId(cls.semester_id);
                  closeStudentReport();
                }}
                disabled={isLoadingClasses}
                className="text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {classes.map((cls) => {
                  const id = cls.class_id || cls.id;
                  const name = cls.class_name || cls.name || id;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Academic Period Indicator */}
            {readinessData && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  TA {readinessData.academic_year_name} • Semester {readinessData.semester_name}
                </span>
              </div>
            )}
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari santri / NISN..."
                className="text-xs pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="READY">Siap Cetak</option>
              <option value="INCOMPLETE">Belum Lengkap</option>
            </select>
          </div>
        </div>

        {/* ─── Class Readiness KPI Summary Cards ─────────────────────── */}
        {readinessData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Total Santri Terdaftar
              </span>
              <div className="font-fredoka text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {readinessData.total_students}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                Rombel {readinessData.class_name}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Raport Siap Cetak
              </span>
              <div className="font-fredoka text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {readinessData.ready_students_count}
              </div>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                Seluruh nilai mapel telah lengkap
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Penilaian Belum Lengkap
              </span>
              <div className="font-fredoka text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {readinessData.incomplete_students_count}
              </div>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                Masih memiliki mapel/TP belum dinilai
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Persentase Kesiapan Kelas
              </span>
              <div className="font-fredoka text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                {readinessData.class_completion_percentage}%
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${readinessData.class_completion_percentage}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Student Table & Mobile Cards ────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden print:hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Daftar Santri & Status Kesiapan Raport (Lembar 1)
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Menampilkan {filteredStudents.length} dari {readinessData?.total_students || 0} santri
            </span>
          </div>

          {/* Mobile Card List (md:hidden) */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {isLoadingReadiness ? (
              <div className="p-8 text-center text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                Memeriksa status kelengkapan raport santri...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 italic text-xs">
                Tidak ada santri yang sesuai kriteria pencarian.
              </div>
            ) : (
              filteredStudents.map((std, idx) => (
                <div
                  key={std.student_id}
                  className={`p-4 space-y-3 transition-colors ${
                    selectedStudent?.student_id === std.student_id
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 block">
                        {idx + 1}. {std.student_name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        NISN: {std.nisn || "-"}
                      </span>
                    </div>
                    {std.is_ready ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Siap Cetak
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-3 h-3" /> Belum Lengkap
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">Kelengkapan</span>
                      <span className={`font-semibold ${std.is_ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {std.completed_subject_count} / {std.total_subject_count} Mapel
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">Rata-Rata</span>
                      <span className="font-fredoka font-bold text-zinc-900 dark:text-zinc-100">
                        {std.overall_average !== null ? std.overall_average : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openStudentReport(std)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5" /> Pratinjau Lembar 1
                    </button>
                    <button
                      onClick={() => {
                        setNoteStudentTarget({
                          id: std.student_id,
                          name: std.student_name,
                          content: "",
                        });
                        setIsNoteModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" /> Catatan
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">No</th>
                  <th className="px-4 py-3">Nama Santri</th>
                  <th className="px-4 py-3 w-32">NISN</th>
                  <th className="px-4 py-3 w-40 text-center">Kelengkapan Mapel</th>
                  <th className="px-4 py-3 w-28 text-center">Rata-Rata</th>
                  <th className="px-4 py-3 w-36 text-center">Status</th>
                  <th className="px-4 py-3 w-56 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoadingReadiness ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                      Memeriksa status kelengkapan raport santri...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-zinc-400 italic">
                      Tidak ada santri yang sesuai kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std, idx) => (
                    <tr
                      key={std.student_id}
                      className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50 transition-colors ${
                        selectedStudent?.student_id === std.student_id ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-zinc-500 dark:text-zinc-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{std.student_name}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono">
                        {std.nisn || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            std.is_ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {std.completed_subject_count} / {std.total_subject_count} Mapel
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {std.overall_average !== null ? (
                          <span className="font-fredoka text-sm text-zinc-900 dark:text-zinc-100">{std.overall_average}</span>
                        ) : (
                          <span className="text-zinc-400 font-normal italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {std.is_ready ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Siap Cetak
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="w-3 h-3" /> Belum Lengkap
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openStudentReport(std)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
                          >
                            <FileText className="w-3.5 h-3.5" /> Lembar 1
                          </button>
                          <button
                            onClick={() => {
                              setNoteStudentTarget({
                                id: std.student_id,
                                name: std.student_name,
                                content: "",
                              });
                              setIsNoteModalOpen(true);
                            }}
                            title="Edit Catatan Tutor Pendamping"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" /> Catatan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Lembar 1 Preview Modal / Sheet Section ────────────────── */}
        {selectedStudent && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden mt-8 print:shadow-none print:border-none print:m-0 print:p-0 print:overflow-visible print:rounded-none print:bg-transparent">
            {/* Top Toolbar */}
            <div className="bg-zinc-900 dark:bg-zinc-950 text-white px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Pratinjau Lembar 1: {selectedStudent.student_name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    NISN: {selectedStudent.nisn || "-"} • Rombel: {readinessData?.class_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNoteStudentTarget({
                      id: selectedStudent.student_id,
                      name: selectedStudent.student_name,
                      content: reportData?.semester_tutor_note.content || "",
                    });
                    setIsNoteModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" /> Edit Catatan Tutor
                </button>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Lembar 1
                </button>

                <button
                  onClick={closeStudentReport}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Render Area */}
            <div className="p-4 sm:p-8 bg-zinc-100/50 dark:bg-zinc-950/50 print:bg-transparent print:p-0 print:m-0">
              {isLoadingReport ? (
                <div className="p-16 text-center text-zinc-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-emerald-600" />
                  Menyiapkan agregasi data akademik dan pratinjau Lembar 1...
                </div>
              ) : reportData ? (
                <RaportTerpaduDocument
                  report={reportData}
                  sections={{ academic: true }}
                />
              ) : (
                <div className="p-12 text-center text-zinc-400 italic">
                  Gagal memuat dokumen raport.
                </div>
              )}
            </div>
          </div>
        )}
      </PageContainer>

      {/* ─── Tutor Note Modal ───────────────────────────────────────── */}
      {noteStudentTarget && (
        <RaportTutorNoteModal
          isOpen={isNoteModalOpen}
          onClose={() => {
            setIsNoteModalOpen(false);
            setNoteStudentTarget(null);
          }}
          studentId={noteStudentTarget.id}
          studentName={noteStudentTarget.name}
          academicYearId={selectedAcademicYearId}
          semesterId={selectedSemesterId}
          initialContent={noteStudentTarget.content}
          onSaved={(newContent) => {
            if (reportData && selectedStudent?.student_id === noteStudentTarget.id) {
              setReportData({
                ...reportData,
                semester_tutor_note: {
                  ...reportData.semester_tutor_note,
                  content: newContent,
                },
              });
            }
          }}
        />
      )}

      {/* ─── Batch Print Class Reports ─────────────────────────────── */}
      {batchReportData && (
        <div className="hidden print:block print:w-full print:m-0 print:p-0">
          {batchReportData.map((rep, idx) => (
            <div key={rep.student.id} className={idx < batchReportData.length - 1 ? "page-break-after" : ""}>
              <RaportTerpaduDocument
                report={rep}
                sections={{ academic: true }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
