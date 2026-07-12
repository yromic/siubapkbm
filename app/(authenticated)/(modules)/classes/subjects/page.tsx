"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { apiRequest } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState } from "@/components/ui-states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import { UX_COPY } from "@/lib/ux-copy";

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
}

export interface SubjectItem {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
}

export interface ClassSubjectMapping {
  id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
  status: "active" | "inactive";
}

export default function ClassSubjectsPage() {
  const { token, user } = useAuth();
  const { academicYears, semesters, activeAcademicYear, activeSemester } = useSettings();

  // Master lists
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [mappings, setMappings] = useState<ClassSubjectMapping[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Assignment states
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [unassignMappingId, setUnassignMappingId] = useState<string | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize and load master data
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [classList, subjectList, mappingList] = await Promise.all([
        apiRequest<ClassItem[]>("list_classes", {}, token),
        apiRequest<SubjectItem[]>("list_subjects", {}, token),
        apiRequest<ClassSubjectMapping[]>("list_class_subjects", {}, token),
      ]);
      setClasses(classList.filter(c => c.status === "active"));
      setSubjects(subjectList.filter(s => s.status === "active"));
      setMappings(mappingList);
      
      // Setup initial defaults from active period context
      const defaultYear = activeAcademicYear?.id || academicYears[0]?.id || "";
      setSelectedYearId(defaultYear);

      const defaultSem = activeSemester?.id || semesters[0]?.id || "";
      setSelectedSemesterId(defaultSem);

      if (classList.length > 0) {
        setSelectedClassId(classList[0].id);
      }
      if (subjectList.length > 0) {
        setSelectedSubjectId(subjectList[0].id);
      }
    } catch (err: unknown) {
      console.error("Failed to load mapping data:", err);
      const msg = err instanceof Error ? err.message : "Gagal memuat data mapping mata pelajaran.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, activeAcademicYear, activeSemester, academicYears, semesters]);

  useEffect(() => {
    setTimeout(() => {
      loadData();
    }, 0);
  }, [loadData]);

  // Handle year change to update semester choices if needed
  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    const relatedSemesters = semesters.filter(s => s.academic_year_id === yearId);
    if (relatedSemesters.length > 0) {
      setSelectedSemesterId(relatedSemesters[0].id);
    } else {
      setSelectedSemesterId("");
    }
  };

  const handleAssignSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!selectedClassId || !selectedSubjectId || !selectedYearId || !selectedSemesterId) {
      setFormError("Semua field wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      await apiRequest("assign_subject_to_class", {
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        academic_year_id: selectedYearId,
        semester_id: selectedSemesterId,
      }, token);
      
      // Reload mappings
      const updatedMappings = await apiRequest<ClassSubjectMapping[]>("list_class_subjects", {}, token);
      setMappings(updatedMappings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungkan mata pelajaran ke kelas.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUnassignSubject = async (id: string) => {
    if (!token) return;
    setFormLoading(true);
    try {
      await apiRequest("unassign_subject_from_class", { id }, token);
      notify.success(UX_COPY.classes.unassignSubjectSuccess);
      
      // Reload mappings
      const updatedMappings = await apiRequest<ClassSubjectMapping[]>("list_class_subjects", {}, token);
      setMappings(updatedMappings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal melepas mata pelajaran.";
      notify.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // Filter current active mappings to display in the list
  const activeMappings = mappings.filter((m) => {
    return (
      m.class_id === selectedClassId &&
      m.academic_year_id === selectedYearId &&
      m.semester_id === selectedSemesterId &&
      m.status === "active"
    );
  });

  // Guard: Only administrator can access
  if (!user || user.role !== "administrator") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Akses Ditolak</h2>
        <p className="mt-2 text-sm text-zinc-655 dark:text-zinc-400 max-w-sm">
          Menu ini hanya dapat diakses oleh Administrator sekolah.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Mata Pelajaran di Kelas"
        description="Hubungkan mata pelajaran ke kelas untuk semester & tahun ajaran tertentu."
      />

      {loading && <LoadingState message="Memuat mata pelajaran di kelas..." />}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 h-fit">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 dark:border-zinc-800 pb-3">Filter Periode & Kelas</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">Tahun Ajaran</label>
                <select
                  value={selectedYearId}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">Semester</label>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                >
                  {semesters.filter(s => s.academic_year_id === selectedYearId).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">Kelas</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Mapping Action */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Hubungkan Mapel Baru</h4>
              <form onSubmit={handleAssignSubject} className="space-y-3">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>

                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-650 dark:text-red-400">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formLoading || classes.length === 0 || subjects.length === 0}
                  className="w-full flex justify-center items-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-md shadow-emerald-500/10 transition-colors text-sm disabled:opacity-50"
                >
                  {formLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Hubungkan Mapel"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Mapped Subjects List */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Mata Pelajaran yang Terhubung
              </h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-850 text-zinc-650 dark:text-zinc-400">
                {activeMappings.length} Terhubung
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 font-semibold">
                    <th className="pb-3 w-32">Kode Mapel</th>
                    <th className="pb-3">Nama Mata Pelajaran</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                  {activeMappings.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-500">
                        Belum ada mata pelajaran terhubung untuk filter kelas & periode ini.
                      </td>
                    </tr>
                  ) : (
                    activeMappings.map((mapping) => {
                      const subjectObj = subjects.find((s) => s.id === mapping.subject_id);
                      return (
                        <tr key={mapping.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-850/10 transition-colors">
                          <td className="py-3.5 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {subjectObj ? subjectObj.code : "Unknown"}
                          </td>
                          <td className="py-3.5 font-semibold text-zinc-900 dark:text-zinc-100">
                            {subjectObj ? subjectObj.name : "Mata pelajaran tidak ditemukan"}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => setUnassignMappingId(mapping.id)}
                              disabled={formLoading}
                              className="text-xs font-bold text-red-650 hover:text-red-755 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                            >
                              Putus Hubungan
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={unassignMappingId !== null}
        onOpenChange={(open) => { if (!open) setUnassignMappingId(null); }}
        title={UX_COPY.classes.unassignSubjectConfirmTitle}
        description={UX_COPY.classes.unassignSubjectConfirmDescription}
        confirmLabel={UX_COPY.classes.unassignSubjectConfirmLabel}
        variant="destructive"
        onConfirm={() => {
          if (unassignMappingId) {
            void handleUnassignSubject(unassignMappingId);
          }
        }}
      />
    </ResponsiveContainer>
  );
}
