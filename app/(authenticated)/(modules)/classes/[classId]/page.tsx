"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  ResponsiveContainer,
  LoadingState,
  EmptyState,
  ForbiddenState,
} from "@/components/ui-states";
import { listStudentsByClass, StudentSummary } from "@/lib/api/students";
import { useSettings } from "@/hooks/useSettings";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Search, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { notify } from "@/lib/notify";

type StudentStatus = string;

function StatusBadge({ status }: { status: StudentStatus }) {
  const isActive = status === "Aktif";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminClassDetailPage() {
  const { classId } = useParams() as { classId: string };
  const searchParams = useSearchParams();
  const academicYearId = searchParams.get("year") ?? "";
  const semesterId = searchParams.get("sem") ?? "";

  const { token, user } = useAuth();
  const { activeAcademicYear, activeSemester } = useSettings();

  const yearId = academicYearId || activeAcademicYear?.id || "";
  const semId = semesterId || activeSemester?.id || "";

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Bulk enrollment states
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkSubmitLoading, setBulkSubmitLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  const loadRoster = useCallback(async () => {
    if (!token || !classId) return;
    if (!yearId || !semId) {
      setStudents([]);
      setLoading(false);
      setError("Periode tahun ajaran dan semester tidak lengkap. Silakan buka dari daftar kelas.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listStudentsByClass(
        classId,
        yearId,
        semId,
        token
      );
      setStudents(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar siswa.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, classId, yearId, semId]);

  const fetchEligibleStudents = useCallback(async () => {
    if (!token || !semId) return;
    setLoadingEligible(true);
    try {
      const [resStudents, resEnrollments] = await Promise.all([
        apiRequest<any>("list_students", { limit: 1000, status: "active" }, token || undefined),
        apiRequest<any>("list_students_by_class", { semester_id: semId, limit: 1000 }, token || undefined)
      ]);
      const active = Array.isArray(resStudents) ? resStudents : resStudents?.data || [];
      const enrolledIds = new Set((resEnrollments || []).map((e: any) => e.student_id));
      const filtered = active.filter((s: any) => !enrolledIds.has(s.id));
      setEligibleStudents(filtered);
      setSelectedStudentIds(new Set());
      setBulkResult(null);
    } catch (err: any) {
      notify.error("Gagal memuat daftar siswa untuk enrollment.");
    } finally {
      setLoadingEligible(false);
    }
  }, [token, semId]);

  const handleOpenBulkEnroll = () => {
    setShowBulkEnrollModal(true);
    fetchEligibleStudents();
  };

  const handleSelectStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const filteredEligible = eligibleStudents.filter((s) => {
    const q = bulkSearch.toLowerCase();
    return (
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.nisn.toLowerCase().includes(q)
    );
  });

  const isAllSelected = filteredEligible.length > 0 && filteredEligible.every(s => selectedStudentIds.has(s.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedStudentIds);
      filteredEligible.forEach(s => next.delete(s.id));
      setSelectedStudentIds(next);
    } else {
      const next = new Set(selectedStudentIds);
      filteredEligible.forEach(s => next.add(s.id));
      setSelectedStudentIds(next);
    }
  };

  const handleBulkEnrollSubmit = async () => {
    if (selectedStudentIds.size === 0) {
      notify.error("Pilih minimal satu siswa.");
      return;
    }
    setBulkSubmitLoading(true);
    try {
      const payload = {
        student_ids: Array.from(selectedStudentIds),
        class_id: classId,
        academic_year_id: yearId,
        semester_id: semId
      };
      const res = await apiRequest<any>("bulk_enrollment", payload, token || undefined);
      setBulkResult(res);
      notify.success("Proses bulk enrollment selesai.");
      loadRoster();
    } catch (err: any) {
      notify.error(err.message || "Gagal memproses bulk enrollment.");
    } finally {
      setBulkSubmitLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => loadRoster(), 0);
  }, [loadRoster]);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.nisn.toLowerCase().includes(q)
    );
  });

  const isAuthorized = user && (user.role === "admin" || user.role === "administrator");
  if (!isAuthorized) {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Administrator atau Staf Operator." />
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Manajemen Kelas & Roster Siswa"
        description={`Kelas ID: ${classId}`}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenBulkEnroll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] text-white font-semibold shadow-md shadow-[#468432]/10 transition-all text-xs cursor-pointer"
            >
              Daftarkan Siswa ke Kelas Ini
            </button>
            <Link
              href="/classes"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Kelas
            </Link>
          </div>
        }
      />

      {/* Info banner */}
      <div className="p-3.5 rounded-[12px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-400">
        <strong>Akses Administrator:</strong> Anda memiliki akses penuh untuk mengelola pendaftaran siswa, melihat wali kelas, dan memproses data akademik kelas ini.
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cari nama atau NISN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432]"
        />
      </div>

      {loading && <LoadingState message="Memuat daftar siswa..." />}

      {error && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={search ? "Tidak Ada Hasil" : "Kelas Kosong"}
          description={
            search
              ? "Coba ubah kata kunci pencarian."
              : "Tidak ada siswa aktif di kelas ini pada semester aktif."
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Nama Siswa</th>
                  <th className="px-5 py-3.5">NISN</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Kelamin</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((student, idx) => (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-[#262626]/40 transition-colors"
                  >
                    <td className="px-5 py-4 text-zinc-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {student.full_name}
                      </div>
                      {student.birth_date && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {new Date(student.birth_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-600 dark:text-zinc-400 text-sm">
                      {student.nisn}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 hidden sm:table-cell">
                      {student.gender === "L"
                        ? "Laki-laki"
                        : student.gender === "P"
                        ? "Perempuan"
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={student.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/students/${student.id}`}
                        className="text-xs font-semibold text-[#468432] hover:text-emerald-700 dark:text-emerald-400 transition-colors"
                      >
                        Profil Siswa
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            {filtered.length} dari {students.length} siswa terdaftar
          </div>
        </div>
      )}

      {/* Bulk Enrollment Modal */}
      <Dialog.Root open={showBulkEnrollModal} onOpenChange={setShowBulkEnrollModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-2xl z-50 focus:outline-none max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
              <Dialog.Title className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {bulkResult ? "Ringkasan Bulk Enrollment" : "Daftarkan Siswa ke Kelas"}
              </Dialog.Title>
              <Dialog.Close className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            {bulkResult ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="p-4 rounded-[12px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-800 dark:text-emerald-350">
                  <strong>Berhasil:</strong> {bulkResult.enrolled?.length || 0} siswa sukses terdaftar.
                </div>

                {bulkResult.skipped?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                      Dilewati ({bulkResult.skipped.length})
                    </h4>
                    <div className="border border-zinc-100 dark:border-zinc-800 rounded-[12px] overflow-hidden text-xs divide-y divide-zinc-100 dark:divide-zinc-800">
                      {bulkResult.skipped.map((s: any, idx: number) => (
                        <div key={idx} className="p-3 bg-zinc-50/50 dark:bg-zinc-900/10 flex justify-between gap-4">
                          <div>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{s.student_name || "Siswa"}</span>
                            {s.nisn && <span className="text-zinc-400 font-mono ml-2">({s.nisn})</span>}
                          </div>
                          <span className="text-zinc-500 italic">{s.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bulkResult.failed?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-500">
                      Gagal ({bulkResult.failed.length})
                    </h4>
                    <div className="border border-zinc-100 dark:border-zinc-800 rounded-[12px] overflow-hidden text-xs divide-y divide-zinc-100 dark:divide-zinc-800">
                      {bulkResult.failed.map((s: any, idx: number) => (
                        <div key={idx} className="p-3 bg-zinc-50/50 dark:bg-zinc-900/10 flex justify-between gap-4">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">ID: {s.student_id}</span>
                          <span className="text-red-500">{s.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setShowBulkEnrollModal(false)}
                    className="px-4 py-2 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors text-sm cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search & Selection Options */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Cari nama atau NISN siswa..."
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432]"
                    />
                  </div>
                  <button
                    onClick={handleSelectAll}
                    disabled={filteredEligible.length === 0}
                    className="px-4 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
                  >
                    {isAllSelected ? "Batal Pilih Semua" : "Pilih Semua"}
                  </button>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-[12px] divide-y divide-zinc-150 dark:divide-zinc-800 min-h-[250px] max-h-[400px]">
                  {loadingEligible ? (
                    <div className="py-12 flex justify-center">
                      <LoadingState message="Memuat daftar siswa aktif..." />
                    </div>
                  ) : filteredEligible.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-sm">
                      Tidak ada siswa aktif yang memenuhi syarat atau sesuai kata kunci.
                    </div>
                  ) : (
                    filteredEligible.map((s) => {
                      const isChecked = selectedStudentIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleSelectStudent(s.id)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/50 dark:hover:bg-[#262626]/20 transition-colors cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by onClick on container
                            className="rounded border-zinc-300 dark:border-zinc-700 text-[#468432] focus:ring-[#468432]/30 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {s.full_name}
                            </div>
                            <div className="text-xs text-zinc-400 font-mono">
                              NISN: {s.nisn}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer buttons */}
                <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-semibold">
                    Terpilih: {selectedStudentIds.size} siswa
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowBulkEnrollModal(false)}
                      className="px-4 py-2.5 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleBulkEnrollSubmit}
                      disabled={bulkSubmitLoading || selectedStudentIds.size === 0}
                      className="px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] text-white font-semibold transition-all text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {bulkSubmitLoading ? "Mendaftarkan..." : `Daftarkan (${selectedStudentIds.size})`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ResponsiveContainer>
  );
}
