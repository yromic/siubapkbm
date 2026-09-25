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
import { notify } from "@/lib/notify";
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
    <div className="min-h-screen bg-zinc-50/60 pb-16">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-200 px-4 sm:px-6 lg:px-8 py-5 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
              <BookOpenCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
                Raport Terpadu
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Penerbitan dan integrasi penilaian raport modular per rombongan belajar (Lembar 1: Ringkasan Akademik).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadClassReadiness()}
              disabled={isLoadingReadiness}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReadiness ? "animate-spin" : ""}`} />
              Segarkan Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 print:p-0 print:m-0 print:max-w-none">
        {/* ─── Selection Bar ────────────────────────────────────────── */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Kelas Selector */}
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-700">Rombel / Kelas:</span>
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
                className="text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  TA {readinessData.academic_year_name} • Semester {readinessData.semester_name}
                </span>
              </div>
            )}
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari santri / NISN..."
                className="text-xs pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Total Santri Terdaftar
              </span>
              <div className="text-2xl font-black text-zinc-900 mt-1">
                {readinessData.total_students}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Rombel {readinessData.class_name}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Raport Siap Cetak
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {readinessData.ready_students_count}
              </div>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Seluruh nilai mapel telah lengkap
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Penilaian Belum Lengkap
              </span>
              <div className="text-2xl font-black text-amber-700 mt-1">
                {readinessData.incomplete_students_count}
              </div>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Masih memiliki mapel/TP belum dinilai
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Persentase Kesiapan Kelas
              </span>
              <div className="text-2xl font-black text-zinc-900 mt-1">
                {readinessData.class_completion_percentage}%
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${readinessData.class_completion_percentage}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Student Table ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden print:hidden">
          <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">
              Daftar Santri & Status Kesiapan Raport (Lembar 1)
            </h2>
            <span className="text-xs text-zinc-500">
              Menampilkan {filteredStudents.length} dari {readinessData?.total_students || 0} santri
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 uppercase font-semibold border-b border-zinc-200">
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
              <tbody className="divide-y divide-zinc-100">
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
                      className={`hover:bg-zinc-50/70 transition-colors ${
                        selectedStudent?.student_id === std.student_id ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-zinc-500 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-zinc-900 block">{std.student_name}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 font-mono">
                        {std.nisn || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            std.is_ready ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {std.completed_subject_count} / {std.total_subject_count} Mapel
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {std.overall_average !== null ? (
                          <span className="text-zinc-900">{std.overall_average}</span>
                        ) : (
                          <span className="text-zinc-400 font-normal italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {std.is_ready ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Siap Cetak
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3" /> Belum Lengkap
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openStudentReport(std)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-zinc-500" /> Catatan
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
          <div className="bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden mt-8 print:shadow-none print:border-none print:m-0 print:p-0">
            {/* Top Toolbar */}
            <div className="bg-zinc-900 text-white px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" /> Edit Catatan Tutor
                </button>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Lembar 1
                </button>

                <button
                  onClick={closeStudentReport}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Render Area */}
            <div className="p-4 sm:p-8 bg-zinc-100/50 print:bg-white print:p-0">
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
      </div>

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
    </div>
  );
}
