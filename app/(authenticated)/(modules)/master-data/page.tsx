"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings, AcademicYear, Semester } from "@/hooks/useSettings";
import { apiRequest } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState } from "@/components/ui-states";
import { DatePicker } from "@/components/ui/date-picker";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { notify } from "@/lib/notify";
import { UX_COPY } from "@/lib/ux-copy";

export default function MasterDataPage() {
  const { token, user } = useAuth();
  const {
    academicYears,
    semesters,
    loading: contextLoading,
    error: contextError,
    refreshSettings,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<"years" | "semesters">("years");
  
  // Modals and Forms states
  const [showYearModal, setShowYearModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
  const [yearName, setYearName] = useState("");
  const [yearStartDate, setYearStartDate] = useState("");
  const [yearEndDate, setYearEndDate] = useState("");
  
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
  const [semesterYearId, setSemesterYearId] = useState("");
  const [semesterName, setSemesterName] = useState("");
  const [semesterStartDate, setSemesterStartDate] = useState("");
  const [semesterEndDate, setSemesterEndDate] = useState("");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- ACADEMIC YEAR ACTIONS ---
  const handleOpenYearModal = (year: AcademicYear | null = null) => {
    setFormError(null);
    if (year) {
      setSelectedYear(year);
      setYearName(year.name);
      setYearStartDate(year.start_date ? year.start_date.split("T")[0] : "");
      setYearEndDate(year.end_date ? year.end_date.split("T")[0] : "");
    } else {
      setSelectedYear(null);
      setYearName("");
      setYearStartDate("");
      setYearEndDate("");
    }
    setShowYearModal(true);
  };

  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!yearName || !yearStartDate || !yearEndDate) {
      setFormError("Semua field wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      if (selectedYear) {
        await apiRequest("update_academic_year", {
          id: selectedYear.id,
          name: yearName,
          start_date: yearStartDate,
          end_date: yearEndDate,
        }, token);
      } else {
        await apiRequest("create_academic_year", {
          name: yearName,
          start_date: yearStartDate,
          end_date: yearEndDate,
        }, token);
      }
      await refreshSettings();
      setShowYearModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan tahun ajaran.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleActivateYear = async (id: string) => {
    if (!token) return;
    setFormLoading(true);
    try {
      await apiRequest("set_active_academic_year", { id }, token);
      notify.success(UX_COPY.lifecycle.active("tahun ajaran"));
      await refreshSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengaktifkan tahun ajaran.";
      notify.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  // --- SEMESTER ACTIONS ---
  const handleOpenSemesterModal = (sem: Semester | null = null) => {
    setFormError(null);
    if (sem) {
      setSelectedSemester(sem);
      setSemesterYearId(sem.academic_year_id);
      setSemesterName(sem.name);
      setSemesterStartDate(sem.start_date ? sem.start_date.split("T")[0] : "");
      setSemesterEndDate(sem.end_date ? sem.end_date.split("T")[0] : "");
    } else {
      setSelectedSemester(null);
      setSemesterYearId(academicYears[0]?.id || "");
      setSemesterName("");
      setSemesterStartDate("");
      setSemesterEndDate("");
    }
    setShowSemesterModal(true);
  };

  const handleSaveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!semesterYearId || !semesterName || !semesterStartDate || !semesterEndDate) {
      setFormError("Semua field wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      if (selectedSemester) {
        await apiRequest("update_semester", {
          id: selectedSemester.id,
          academic_year_id: semesterYearId,
          name: semesterName,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
        }, token);
      } else {
        await apiRequest("create_semester", {
          academic_year_id: semesterYearId,
          name: semesterName,
          start_date: semesterStartDate,
          end_date: semesterEndDate,
        }, token);
      }
      await refreshSettings();
      setShowSemesterModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan semester.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleActivateSemester = async (id: string) => {
    if (!token) return;
    setFormLoading(true);
    try {
      await apiRequest("set_active_semester", { id }, token);
      notify.success(UX_COPY.lifecycle.active("semester"));
      await refreshSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengaktifkan semester.";
      notify.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Guard: Only administrator can access (moved to bottom to satisfy hook rules)
  if (!user || user.role !== "administrator") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Akses Ditolak</h2>
        <p className="mt-2 text-sm text-zinc-650 dark:text-zinc-400 max-w-sm">
          Menu ini hanya dapat diakses oleh Administrator sekolah.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Master Data Periode"
        description="Kelola Tahun Ajaran dan Semester aktif sekolah."
        actions={
          <button
            onClick={() => {
              if (activeTab === "years") {
                handleOpenYearModal();
              } else {
                handleOpenSemesterModal();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] text-white font-semibold shadow-md shadow-[#468432]/10 transition-all text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Tambah {activeTab === "years" ? "Tahun Ajaran" : "Semester"}
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("years")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "years"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Tahun Ajaran
        </button>
        <button
          onClick={() => setActiveTab("semesters")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === "semesters"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Semester
        </button>
      </div>

      {contextLoading && <LoadingState message="Memuat data periode..." />}

      {contextError && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
          {contextError}
        </div>
      )}

      {!contextLoading && !contextError && (
        <>
          {activeTab === "years" ? (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <th className="p-4">Tahun Ajaran</th>
                      <th className="p-4">Tanggal Mulai</th>
                      <th className="p-4">Tanggal Selesai</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {academicYears.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                          Belum ada data Tahun Ajaran.
                        </td>
                      </tr>
                    ) : (
                      academicYears.map((year) => {
                        const active = year.is_active === true || String(year.is_active) === "1" || String(year.is_active).toLowerCase() === "true";
                        return (
                          <tr key={year.id} className="hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors">
                            <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{year.name?.trim() || "Tahun ajaran tanpa nama"}</td>
                            <td className="p-4 text-zinc-650 dark:text-zinc-400">{formatDate(year.start_date)}</td>
                            <td className="p-4 text-zinc-650 dark:text-zinc-400">{formatDate(year.end_date)}</td>
                            <td className="p-4 text-center">
                              {active ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-750 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  Tidak Aktif
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              {!active && (
                                <button
                                  onClick={() => handleActivateYear(year.id)}
                                  disabled={formLoading}
                                  className="text-xs font-bold text-[#468432] hover:text-emerald-700 dark:text-emerald-450 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
                                >
                                  Aktifkan
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenYearModal(year)}
                                className="text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                              >
                                Edit
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
          ) : (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <th className="p-4">Tahun Ajaran</th>
                      <th className="p-4">Semester</th>
                      <th className="p-4">Tanggal Mulai</th>
                      <th className="p-4">Tanggal Selesai</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {semesters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500">
                          Belum ada data Semester.
                        </td>
                      </tr>
                    ) : (
                      semesters.map((sem) => {
                        const year = academicYears.find((y) => y.id === sem.academic_year_id);
                        const active = sem.is_active === true || String(sem.is_active) === "1" || String(sem.is_active).toLowerCase() === "true";
                        return (
                          <tr key={sem.id} className="hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors">
                            <td className="p-4 text-zinc-550 dark:text-zinc-400 font-medium">{year ? year.name : "Unknown"}</td>
                            <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{sem.name}</td>
                            <td className="p-4 text-zinc-650 dark:text-zinc-400">{formatDate(sem.start_date)}</td>
                            <td className="p-4 text-zinc-650 dark:text-zinc-400">{formatDate(sem.end_date)}</td>
                            <td className="p-4 text-center">
                              {active ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-750 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  Tidak Aktif
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              {!active && (
                                <button
                                  onClick={() => handleActivateSemester(sem.id)}
                                  disabled={formLoading}
                                  className="text-xs font-bold text-[#468432] hover:text-emerald-700 dark:text-emerald-450 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
                                >
                                  Aktifkan
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenSemesterModal(sem)}
                                className="text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                              >
                                Edit
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
          )}
        </>
      )}

      {/* --- YEAR MODAL --- */}
      <Dialog.Root open={showYearModal} onOpenChange={setShowYearModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {selectedYear ? "Edit Tahun Ajaran" : "Tambah Tahun Ajaran"}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <form onSubmit={handleSaveYear} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Nama Tahun Ajaran
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2026/2027"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    label="Tanggal Mulai"
                    value={yearStartDate}
                    onChange={setYearStartDate}
                    placeholder="Pilih tanggal..."
                  />
                  <DatePicker
                    label="Tanggal Selesai"
                    value={yearEndDate}
                    onChange={setYearEndDate}
                    placeholder="Pilih tanggal..."
                  />
                </div>

                {formError && (
                  <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-650 dark:text-red-400">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={formLoading}
                      className="px-4 py-2 rounded-[12px] text-sm font-semibold border border-zinc-255 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-md shadow-[#468432]/10 transition-colors flex items-center justify-center min-w-[80px]"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Simpan"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* --- SEMESTER MODAL --- */}
      <Dialog.Root open={showSemesterModal} onOpenChange={setShowSemesterModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {selectedSemester ? "Edit Semester" : "Tambah Semester"}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <form onSubmit={handleSaveSemester} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Tahun Ajaran
                  </label>
                  <select
                    value={semesterYearId}
                    onChange={(e) => setSemesterYearId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name?.trim() || "Tahun ajaran tanpa nama"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Nama Semester
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ganjil / Genap"
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    label="Tanggal Mulai"
                    value={semesterStartDate}
                    onChange={setSemesterStartDate}
                    placeholder="Pilih tanggal..."
                  />
                  <DatePicker
                    label="Tanggal Selesai"
                    value={semesterEndDate}
                    onChange={setSemesterEndDate}
                    placeholder="Pilih tanggal..."
                  />
                </div>

                {formError && (
                  <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-650 dark:text-red-400">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={formLoading}
                      className="px-4 py-2 rounded-[12px] text-sm font-semibold border border-zinc-255 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-md shadow-[#468432]/10 transition-colors flex items-center justify-center min-w-[80px]"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "Simpan"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ResponsiveContainer>
  );
}
