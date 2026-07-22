"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { apiRequest } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState, ForbiddenState } from "@/components/ui-states";
import { CelebrationModal } from "@/components/ui/celebration-modal";
import { useAppreciation } from "@/hooks/useAppreciation";
import { userFacingError } from "@/lib/utils/ui-error";

interface ClassReadiness {
  class_id: string;
  class_name: string;
  has_enrollments: boolean;
  enrollment_count: number;
  has_teacher_assignment: boolean;
  has_subject_mapping: boolean;
  status: "ready" | "warning" | "not_ready";
  issues: string[];
}

interface ReadinessData {
  period: {
    academic_year_id: string;
    academic_year_name: string;
    semester_id: string;
    semester_name: string;
  };
  overall_status: "ready" | "warning" | "not_ready";
  summary: {
    total_classes: number;
    ready_classes: number;
    warning_classes: number;
    not_ready_classes: number;
  };
  classes: ClassReadiness[];
}

interface AssignmentPreviewItem {
  class_id: string;
  class_name: string;
  teacher_user_id: string;
  teacher_name: string;
  status: "ready" | "duplicate" | "conflict";
}

interface AssignmentPreviewResult {
  total_found: number;
  assignments: AssignmentPreviewItem[];
  warnings: string[];
}

interface RolloverExecResult {
  copied: number;
  skipped: number;
  errors: string[];
}

interface SubjectPreviewItem {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  status: "ready" | "duplicate";
}

interface SubjectPreviewResult {
  total_found: number;
  subjects: SubjectPreviewItem[];
  warnings: string[];
}

export default function RolloverPage() {
  const { token, user } = useAuth();
  const { academicYears, semesters } = useSettings();

  const { open: appOpen, setOpen: setAppOpen, message: appMsg, triggerAppreciation } = useAppreciation();

  const [activeTab, setActiveTab] = useState<"readiness" | "assignment" | "subject">("readiness");

  // Readiness Tab States
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // Assignment Tab States
  const [srcYearId, setSrcYearId] = useState("");
  const [tgtYearId, setTgtYearId] = useState("");

  // We will override selected semesters to match selected years to prevent mismatches
  const [selectedSrcSemesterId, setSelectedSrcSemesterId] = useState("");
  const [selectedTgtSemesterId, setSelectedTgtSemesterId] = useState("");

  const [assignPreview, setAssignPreview] = useState<AssignmentPreviewResult | null>(null);
  const [assignExec, setAssignExec] = useState<RolloverExecResult | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Subject Tab States
  const [subSrcYearId, setSubSrcYearId] = useState("");
  const [subTgtYearId, setSubTgtYearId] = useState("");
  const [selectedSubSrcSemesterId, setSelectedSubSrcSemesterId] = useState("");
  const [selectedSubTgtSemesterId, setSelectedSubTgtSemesterId] = useState("");

  const [subPreview, setSubPreview] = useState<SubjectPreviewResult | null>(null);
  const [subExec, setSubExec] = useState<RolloverExecResult | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // Search filter for readiness
  const [readinessSearch, setReadinessSearch] = useState("");
  const [confirmType, setConfirmType] = useState<"assignment" | "subject" | null>(null);

  // Fetch readiness data
  const fetchReadiness = async () => {
    if (!token) return;
    setReadinessLoading(true);
    setReadinessError(null);
    try {
      const res = await apiRequest<ReadinessData>("get_period_setup_readiness", {}, token);
      setReadiness(res);
    } catch (err: unknown) {
      setReadinessError(userFacingError(err, "Status kesiapan periode gagal dimuat."));
    } finally {
      setReadinessLoading(false);
    }
  };

  useEffect(() => {
    if (token && user && (user.role === "administrator" || user.role === "admin")) {
      fetchReadiness();
    }
  }, [token, user]);

  // Set default form values when academic years load
  useEffect(() => {
    if (academicYears.length > 0) {
      setSrcYearId(academicYears[0].id);
      setTgtYearId(academicYears.length > 1 ? academicYears[1].id : academicYears[0].id);
      setSubSrcYearId(academicYears[0].id);
      setSubTgtYearId(academicYears.length > 1 ? academicYears[1].id : academicYears[0].id);
    }
  }, [academicYears]);

  // Sync semesters for source and target
  useEffect(() => {
    if (srcYearId && semesters.length > 0) {
      const filtered = semesters.filter(s => s.academic_year_id === srcYearId);
      if (filtered.length > 0) {
        setSelectedSrcSemesterId(filtered[0].id);
      } else {
        setSelectedSrcSemesterId("");
      }
    }
  }, [srcYearId, semesters]);

  useEffect(() => {
    if (tgtYearId && semesters.length > 0) {
      const filtered = semesters.filter(s => s.academic_year_id === tgtYearId);
      if (filtered.length > 0) {
        setSelectedTgtSemesterId(filtered[0].id);
      } else {
        setSelectedTgtSemesterId("");
      }
    }
  }, [tgtYearId, semesters]);

  // Sync semesters for subjects tab
  useEffect(() => {
    if (subSrcYearId && semesters.length > 0) {
      const filtered = semesters.filter(s => s.academic_year_id === subSrcYearId);
      if (filtered.length > 0) {
        setSelectedSubSrcSemesterId(filtered[0].id);
      } else {
        setSelectedSubSrcSemesterId("");
      }
    }
  }, [subSrcYearId, semesters]);

  useEffect(() => {
    if (subTgtYearId && semesters.length > 0) {
      const filtered = semesters.filter(s => s.academic_year_id === subTgtYearId);
      if (filtered.length > 0) {
        setSelectedSubTgtSemesterId(filtered[0].id);
      } else {
        setSelectedSubTgtSemesterId("");
      }
    }
  }, [subTgtYearId, semesters]);

  // --- ACTIONS ---
  const handlePreviewAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!srcYearId || !selectedSrcSemesterId || !tgtYearId || !selectedTgtSemesterId) {
      setAssignError("Semua pilihan periode wajib ditentukan.");
      return;
    }

    setAssignLoading(true);
    setAssignError(null);
    setAssignPreview(null);
    setAssignExec(null);

    try {
      const res = await apiRequest<AssignmentPreviewResult>("preview_assignment_rollover", {
        source_academic_year_id: srcYearId,
        source_semester_id: selectedSrcSemesterId,
        target_academic_year_id: tgtYearId,
        target_semester_id: selectedTgtSemesterId
      }, token);
      setAssignPreview(res);
    } catch (err: unknown) {
      setAssignError(userFacingError(err, "Pratinjau penugasan wali kelas gagal dimuat."));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleExecuteAssignment = async () => {
    if (!token || assignLoading || !assignPreview) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignExec(null);

    try {
      const res = await apiRequest<RolloverExecResult>("execute_assignment_rollover", {
        source_academic_year_id: srcYearId,
        source_semester_id: selectedSrcSemesterId,
        target_academic_year_id: tgtYearId,
        target_semester_id: selectedTgtSemesterId
      }, token);
      setAssignExec(res);
      notify.success("Penyalinan penugasan wali kelas berhasil.");
      triggerAppreciation({
        workflowId: "semester_finalize",
        academicYearId: tgtYearId,
        semesterId: selectedTgtSemesterId,
        role: "admin",
        level: 5,
      });
      // Refresh readiness state
      fetchReadiness();
    } catch (err: unknown) {
      setAssignError(userFacingError(err, "Penugasan wali kelas gagal disalin."));
    } finally {
      setAssignLoading(false);
    }
  };

  const handlePreviewSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!subSrcYearId || !selectedSubSrcSemesterId || !subTgtYearId || !selectedSubTgtSemesterId) {
      setSubError("Semua pilihan periode wajib ditentukan.");
      return;
    }

    setSubLoading(true);
    setSubError(null);
    setSubPreview(null);
    setSubExec(null);

    try {
      const res = await apiRequest<SubjectPreviewResult>("preview_subject_rollover", {
        source_academic_year_id: subSrcYearId,
        source_semester_id: selectedSubSrcSemesterId,
        target_academic_year_id: subTgtYearId,
        target_semester_id: selectedSubTgtSemesterId
      }, token);
      setSubPreview(res);
    } catch (err: unknown) {
      setSubError(userFacingError(err, "Pratinjau mata pelajaran di kelas gagal dimuat."));
    } finally {
      setSubLoading(false);
    }
  };

  const handleExecuteSubject = async () => {
    if (!token || subLoading || !subPreview) return;

    setSubLoading(true);
    setSubError(null);
    setSubExec(null);

    try {
      const res = await apiRequest<RolloverExecResult>("execute_subject_rollover", {
        source_academic_year_id: subSrcYearId,
        source_semester_id: selectedSubSrcSemesterId,
        target_academic_year_id: subTgtYearId,
        target_semester_id: selectedSubTgtSemesterId
      }, token);
      setSubExec(res);
      // Refresh readiness state
      fetchReadiness();
    } catch (err: unknown) {
      setSubError(userFacingError(err, "Mata pelajaran di kelas gagal disalin."));
    } finally {
      setSubLoading(false);
    }
  };

  // Guard: Role authorization checks
  if (!user || (user.role !== "administrator" && user.role !== "admin")) {
    return (
      <ForbiddenState message="Menu Rollover hanya dapat diakses oleh Administrator atau Admin." />
    );
  }

  // Filter readiness details by search query
  const filteredReadinessClasses = readiness?.classes.filter(cl =>
    String(cl.class_name ?? "").toLowerCase().includes(readinessSearch.toLowerCase())
  ) || [];

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Salin Pengaturan Periode"
        description="Salin penugasan wali kelas dan mata pelajaran di kelas ke semester baru secara aman."
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("readiness")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "readiness"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          1. Kesiapan Pengaturan
        </button>
        <button
          onClick={() => setActiveTab("assignment")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "assignment"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          2. Salin Wali Kelas
        </button>
        <button
          onClick={() => setActiveTab("subject")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "subject"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          3. Salin Mapel Kelas
        </button>
      </div>

      {/* READINESS TAB */}
      {activeTab === "readiness" && (
        <div className="space-y-6 animate-fade-in">
          {readinessLoading && <LoadingState message="Memeriksa data kesiapan operasional..." />}

          {readinessError && (
            <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
              {readinessError}
            </div>
          )}

          {!readinessLoading && !readinessError && readiness && (
            <>
              {/* Overall status display */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-550 uppercase">Periode Aktif Terdeteksi</span>
                    <h4 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 mt-1">
                      {readiness.period.academic_year_name || "Tidak Set"}
                    </h4>
                    <p className="text-sm text-zinc-500 mt-0.5">
                      Semester: {readiness.period.semester_name || "Tidak Set"}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
                    <svg className="w-4 h-4 text-emerald-550" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Sinkron & Terkunci
                  </div>
                </div>

                <div className="p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-550 uppercase">Status Kesiapan Operasional</span>
                    <div className="mt-2 flex items-center gap-2">
                      {readiness.overall_status === "ready" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          Siap Operasional
                        </span>
                      ) : readiness.overall_status === "warning" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          Perlu Penyesuaian
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                          Belum Siap
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                    {readiness.overall_status === "ready"
                      ? "Seluruh kelas aktif telah memiliki wali kelas dan mapping pelajaran."
                      : "Beberapa kelas aktif belum memiliki wali kelas atau mapping pelajaran untuk semester aktif."}
                  </p>
                </div>

                <div className="p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] shadow-sm">
                  <span className="text-xs font-semibold text-zinc-550 uppercase">Ringkasan Setup</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-550">Total Kelas Aktif:</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-150">{readiness.summary.total_classes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-550">Kelas Siap (Ready):</span>
                      <span className="font-bold text-[#468432] dark:text-emerald-450">{readiness.summary.ready_classes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-550">Kelas Perlu Setup (Warning/Not Ready):</span>
                      <span className="font-bold text-amber-600 dark:text-amber-450">
                        {readiness.summary.warning_classes + readiness.summary.not_ready_classes}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Class setup list */}
              <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm space-y-4 p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-md font-bold text-zinc-900 dark:text-zinc-50">Daftar Detail Kelas</h3>
                  <input
                    type="text"
                    placeholder="Cari kelas..."
                    value={readinessSearch}
                    onChange={(e) => setReadinessSearch(e.target.value)}
                    className="w-full sm:w-64 px-3 py-1.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                        <th className="p-4">Nama Kelas</th>
                        <th className="p-4 text-center">Siswa Terdaftar (Extra)</th>
                        <th className="p-4 text-center">Wali Kelas</th>
                        <th className="p-4 text-center">Mapping Mapel</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4">Masalah / Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredReadinessClasses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-500">
                            Tidak ada kelas ditemukan.
                          </td>
                        </tr>
                      ) : (
                        filteredReadinessClasses.map((cl) => (
                          <tr key={cl.class_id} className="hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors">
                            <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{cl.class_name}</td>
                            <td className="p-4 text-center text-zinc-550">
                              {cl.has_enrollments ? (
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                  {cl.enrollment_count} Siswa
                                </span>
                              ) : (
                                <span className="text-zinc-400">Kosong</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {cl.has_teacher_assignment ? (
                                <span className="text-[#468432] font-bold font-mono">✔ Ready</span>
                              ) : (
                                <span className="text-red-500 font-bold font-mono">✖ Belum</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {cl.has_subject_mapping ? (
                                <span className="text-[#468432] font-bold font-mono">✔ Ready</span>
                              ) : (
                                <span className="text-red-500 font-bold font-mono">✖ Belum</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {cl.status === "ready" ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-450">
                                  Ready
                                </span>
                              ) : cl.status === "warning" ? (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450">
                          Perlu Diperiksa
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-450">
                          Belum Siap
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              {cl.issues.length > 0 ? (
                                <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                                  {cl.issues.map((issue, idx) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-zinc-400 italic">Konfigurasi lengkap.</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ASSIGNMENT COPY TAB */}
      {activeTab === "assignment" && (
        <div className="space-y-6 animate-fade-in">
          {/* Explanation Alert */}
          <div className="p-4 rounded-[20px] bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 text-sm text-sky-800 dark:text-sky-300 space-y-1">
            <h4 className="font-bold">Ketentuan Penyalinan Wali Kelas:</h4>
            <ul className="list-disc list-inside space-y-1 text-xs mt-1 leading-relaxed">
              <li>Fitur ini menyalin konfigurasi penugasan guru wali kelas dari periode sumber ke periode target.</li>
              <li>Akun guru wali kelas disalin apa adanya, namun <strong>guru tidak otomatis naik tingkat kelas</strong>.</li>
              <li>Proses ini <strong>tidak menyalin atau membuat riwayat kelas siswa baru</strong>. Kenaikan kelas dilakukan melalui menu Kenaikan Kelas.</li>
              <li>Sistem memproteksi target agar tidak memiliki wali kelas ganda atau tumpang tindih.</li>
            </ul>
          </div>

          <div className="p-5 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm">
            <form onSubmit={handlePreviewAssignment} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Tahun Sumber</label>
                <select
                  value={srcYearId}
                  onChange={(e) => setSrcYearId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name?.trim() || "Tahun ajaran tanpa nama"}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Semester Sumber</label>
                <select
                  value={selectedSrcSemesterId}
                  onChange={(e) => setSelectedSrcSemesterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {semesters.filter(s => s.academic_year_id === srcYearId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Tahun Target</label>
                <select
                  value={tgtYearId}
                  onChange={(e) => setTgtYearId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name?.trim() || "Tahun ajaran tanpa nama"}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Semester Target</label>
                <select
                  value={selectedTgtSemesterId}
                  onChange={(e) => setSelectedTgtSemesterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {semesters.filter(s => s.academic_year_id === tgtYearId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="w-full px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold shadow-md shadow-[#468432]/10 transition-colors disabled:opacity-50 text-sm"
                >
                  {assignLoading ? "Memproses..." : "Lihat Pratinjau"}
                </button>
              </div>
            </form>
          </div>

          {assignError && (
            <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
              <p>{assignError}</p><button type="button" onClick={() => void handlePreviewAssignment({ preventDefault() {} } as React.FormEvent)} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-semibold dark:border-red-800">Coba Lagi</button>
            </div>
          )}

          {assignExec && (
            <div className="p-5 rounded-[20px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-850 dark:text-emerald-400 space-y-2">
              <h4 className="font-bold text-md">✔ Salin Penugasan Wali Kelas Sukses!</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-2">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-semibold">Tersalin (Baru):</span>
                  <span className="text-xl font-bold text-emerald-650">{assignExec.copied}</span>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-semibold">Dilewati (Duplikat/Konflik):</span>
                  <span className="text-xl font-bold text-zinc-500">{assignExec.skipped}</span>
                </div>
              </div>
            </div>
          )}

          {assignPreview && (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-150 pb-3">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                  Pratinjau: {assignPreview.total_found} Penugasan Ditemukan
                </h3>
                <button
                  onClick={() => setConfirmType("assignment")}
                  disabled={assignLoading}
                  className="px-4 py-2 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold text-xs shadow-md shadow-[#468432]/10 transition-colors disabled:opacity-50"
                >
                  {assignLoading ? "Menyalin..." : "Salin Wali Kelas"}
                </button>
              </div>

              {assignPreview.warnings.length > 0 && (
                <div className="p-4 rounded-[12px] bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 text-xs text-amber-750 dark:text-amber-400 space-y-1">
                  <span className="font-bold">Perhatian untuk Target:</span>
                  <ul className="list-disc list-inside space-y-1 mt-1 font-medium">
                    {assignPreview.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <th className="p-4">Nama Kelas</th>
                      <th className="p-4">Nama Guru</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {assignPreview.assignments.map((a, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors">
                        <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{a.class_name}</td>
                        <td className="p-4 text-zinc-650 dark:text-zinc-400">{a.teacher_name}</td>
                        <td className="p-4 text-center">
                          {a.status === "ready" ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-semibold">
                              Siap Disalin
                            </span>
                          ) : a.status === "duplicate" ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 text-xs font-semibold">
                              Dilewati (Sudah Ada)
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-xs font-semibold">
                              Dilewati (Konflik)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBJECT COPY TAB */}
      {activeTab === "subject" && (
        <div className="space-y-6 animate-fade-in">
          {/* Explanation Alert */}
          <div className="p-4 rounded-[20px] bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 text-sm text-sky-800 dark:text-sky-300 space-y-1">
            <h4 className="font-bold">Ketentuan Penyalinan Mata Pelajaran di Kelas:</h4>
            <ul className="list-disc list-inside space-y-1 text-xs mt-1 leading-relaxed">
              <li>Fitur ini menyalin mata pelajaran di kelas dari periode sumber ke periode target.</li>
              <li>Pemetaan mata pelajaran aktif disalin apa adanya, namun <strong>siswa tidak otomatis ikut naik kelas</strong>.</li>
              <li>Proses ini <strong>tidak menyalin atau membuat riwayat kelas siswa baru</strong>.</li>
              <li>Mata pelajaran yang sudah ada pada periode target akan dilewati secara otomatis untuk mencegah duplikasi.</li>
            </ul>
          </div>

          <div className="p-5 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm">
            <form onSubmit={handlePreviewSubject} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Tahun Sumber</label>
                <select
                  value={subSrcYearId}
                  onChange={(e) => setSubSrcYearId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name?.trim() || "Tahun ajaran tanpa nama"}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Semester Sumber</label>
                <select
                  value={selectedSubSrcSemesterId}
                  onChange={(e) => setSelectedSubSrcSemesterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {semesters.filter(s => s.academic_year_id === subSrcYearId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Tahun Target</label>
                <select
                  value={subTgtYearId}
                  onChange={(e) => setSubTgtYearId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name?.trim() || "Tahun ajaran tanpa nama"}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1.5">Semester Target</label>
                <select
                  value={selectedSubTgtSemesterId}
                  onChange={(e) => setSelectedSubTgtSemesterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432]"
                >
                  {semesters.filter(s => s.academic_year_id === subTgtYearId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={subLoading}
                  className="w-full px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold shadow-md shadow-[#468432]/10 transition-colors disabled:opacity-50 text-sm"
                >
                  {subLoading ? "Memproses..." : "Lihat Pratinjau"}
                </button>
              </div>
            </form>
          </div>

          {subError && (
            <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
              <p>{subError}</p><button type="button" onClick={() => void handlePreviewSubject({ preventDefault() {} } as React.FormEvent)} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-semibold dark:border-red-800">Coba Lagi</button>
            </div>
          )}

          {subExec && (
            <div className="p-5 rounded-[20px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-850 dark:text-emerald-400 space-y-2">
              <h4 className="font-bold text-md">Mata pelajaran di kelas berhasil disalin.</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-2">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-semibold">Tersalin (Baru):</span>
                  <span className="text-xl font-bold text-emerald-650">{subExec.copied}</span>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-semibold">Dilewati (Duplikat):</span>
                  <span className="text-xl font-bold text-zinc-500">{subExec.skipped}</span>
                </div>
              </div>
            </div>
          )}

          {subPreview && (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-150 pb-3">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                  Pratinjau: {subPreview.total_found} Mata Pelajaran Ditemukan
                </h3>
                <button
                  onClick={() => setConfirmType("subject")}
                  disabled={subLoading}
                  className="px-4 py-2 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold text-xs shadow-md shadow-[#468432]/10 transition-colors disabled:opacity-50"
                >
                  {subLoading ? "Menyalin..." : "Salin Mata Pelajaran"}
                </button>
              </div>

              {subPreview.warnings.length > 0 && (
                <div className="p-4 rounded-[12px] bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 text-xs text-amber-750 dark:text-amber-400 space-y-1">
                  <span className="font-bold">Perhatian untuk Target:</span>
                  <ul className="list-disc list-inside space-y-1 mt-1 font-medium">
                    {subPreview.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <th className="p-4">Nama Kelas</th>
                      <th className="p-4">Mata Pelajaran</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {subPreview.subjects.map((s, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors">
                        <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{s.class_name}</td>
                        <td className="p-4 text-zinc-650 dark:text-zinc-400">{s.subject_name}</td>
                        <td className="p-4 text-center">
                          {s.status === "ready" ? (
                            <span className="inline-flex px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-semibold">
                              Siap Disalin
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 text-xs font-semibold">
                              Dilewati (Sudah Ada)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {confirmType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="rollover-confirm-title"><div className="w-full max-w-lg rounded-[20px] bg-white p-6 shadow-xl dark:bg-[#171717]"><h2 id="rollover-confirm-title" className="text-xl font-bold">Konfirmasi Penyalinan Pengaturan</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><ConfirmItem label="Periode Sumber" value={confirmType === "assignment" ? periodLabel(srcYearId, selectedSrcSemesterId) : periodLabel(subSrcYearId, selectedSubSrcSemesterId)} wide /><ConfirmItem label="Periode Target" value={confirmType === "assignment" ? periodLabel(tgtYearId, selectedTgtSemesterId) : periodLabel(subTgtYearId, selectedSubTgtSemesterId)} wide /><ConfirmItem label="Penugasan Akan Disalin" value={confirmType === "assignment" ? assignPreview?.assignments.filter((item) => item.status === "ready").length || 0 : 0} /><ConfirmItem label="Mapel Akan Disalin" value={confirmType === "subject" ? subPreview?.subjects.filter((item) => item.status === "ready").length || 0 : 0} /><ConfirmItem label="Konflik" value={confirmType === "assignment" ? assignPreview?.assignments.filter((item) => item.status === "conflict").length || 0 : 0} /><ConfirmItem label="Duplikasi" value={confirmType === "assignment" ? assignPreview?.assignments.filter((item) => item.status === "duplicate").length || 0 : subPreview?.subjects.filter((item) => item.status === "duplicate").length || 0} /></dl><p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Proses ini akan menyalin konfigurasi ke periode baru dan tidak dapat dibatalkan secara otomatis.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmType(null)} className="rounded-[12px] border border-zinc-300 px-4 py-2 dark:border-zinc-700">Batal</button><button type="button" onClick={() => { const type = confirmType; setConfirmType(null); if (type === "assignment") void handleExecuteAssignment(); else void handleExecuteSubject(); }} className="rounded-[12px] bg-red-600 px-4 py-2 font-semibold text-white">Ya, Proses</button></div></div></div>}

      <CelebrationModal
        open={appOpen}
        onOpenChange={setAppOpen}
        title={appMsg.title}
        description={appMsg.body}
        badgeLabel="Finalisasi Semester"
      />
    </ResponsiveContainer>
  );

  function periodLabel(yearId: string, semesterId: string) {
    const year = academicYears.find((item) => item.id === yearId)?.name || "-";
    const semester = semesters.find((item) => item.id === semesterId)?.name || "";
    return `${year} ${semester}`.trim();
  }
}

function ConfirmItem({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return <div className={`rounded-[12px] bg-zinc-50 p-3 dark:bg-zinc-800 ${wide ? "col-span-2" : ""}`}><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}
