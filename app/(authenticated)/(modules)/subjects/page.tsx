"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, mutateLifecycleStatus } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState, EmptyState, ForbiddenState } from "@/components/ui-states";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { X, MoreVertical, Edit, Archive, CheckCircle, Trash2, Power, RotateCcw, ChevronDown, Plus, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { UX_COPY } from "@/lib/ux-copy";
import { humanizeError } from "@/lib/utils/ui-error";

export interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  lifecycle_status?: string;
  created_at?: string;
  updated_at?: string;
}

const LIFECYCLE_FILTER_OPTIONS = [
  { label: "Operasional (Aktif & Nonaktif)", value: "ALL_OPERATIONAL" },
  { label: "Aktif saja", value: "ACTIVE" },
  { label: "Tidak Aktif saja", value: "INACTIVE" },
  { label: "Diarsipkan", value: "ARCHIVED" },
  { label: "Terhapus", value: "SOFT_DELETED" },
  { label: "Semua", value: "Semua" },
];

export default function SubjectsPage() {
  const { token, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState<string>("ALL_OPERATIONAL");

  // Form / Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  // Mutation Confirm State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; status: string } | null>(null);

  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectDesc, setSubjectDesc] = useState("");
  const [subjectStatus, setSubjectStatus] = useState<"active" | "inactive">("active");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filterStatus === "ALL_OPERATIONAL") {
        params.includeInactive = true;
      } else if (filterStatus === "Semua") {
        params.includeInactive = true;
        params.includeArchived = true;
      } else if (filterStatus === "INACTIVE") {
        params.includeInactive = true;
      } else if (filterStatus === "ARCHIVED") {
        params.onlyArchived = true;
      } else if (filterStatus === "SOFT_DELETED") {
        params.onlyDeleted = true;
      }
      const data = await apiRequest<Subject[]>("list_subjects", params, token);
      setSubjects(data);
    } catch (err: unknown) {
      console.error("Failed to load subjects:", err);
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar mata pelajaran.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => {
    setTimeout(() => {
      loadSubjects();
    }, 0);
  }, [loadSubjects]);

  const filtered = useMemo(() => {
    return subjects.filter((s) => {
      const q = debouncedSearch.toLowerCase().trim();
      const matchSearch = !q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [subjects, debouncedSearch]);

  const handleOpenModal = (subj: Subject | null = null) => {
    setFormError(null);
    if (subj) {
      setSelectedSubject(subj);
      setSubjectCode(subj.code);
      setSubjectName(subj.name);
      setSubjectDesc(subj.description || "");
      setSubjectStatus(subj.status);
    } else {
      setSelectedSubject(null);
      setSubjectCode("");
      setSubjectName("");
      setSubjectDesc("");
      setSubjectStatus("active");
    }
    setShowModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!subjectCode || !subjectName) {
      setFormError("Kode dan Nama mata pelajaran wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      if (selectedSubject) {
        await apiRequest("update_subject", {
          id: selectedSubject.id,
          code: subjectCode,
          name: subjectName,
          description: subjectDesc,
          status: subjectStatus,
        }, token);
      } else {
        await apiRequest("create_subject", {
          code: subjectCode,
          name: subjectName,
          description: subjectDesc,
        }, token);
      }
      await loadSubjects();
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan mata pelajaran.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleLifecycleMutation = async () => {
    if (!token || !confirmTarget) return;
    setFormLoading(true);
    const promise = mutateLifecycleStatus("subjects", confirmTarget.id, confirmTarget.status, token);
    
    notify.promise(promise, {
      loading: UX_COPY.loading.save,
      success: () => {
        setConfirmOpen(false);
        loadSubjects();
        const statusLower = confirmTarget.status.toLowerCase();
        let msg = UX_COPY.lifecycle.restored("mata pelajaran");
        if (statusLower === "active") msg = UX_COPY.lifecycle.active("mata pelajaran");
        else if (statusLower === "inactive") msg = UX_COPY.lifecycle.inactive("mata pelajaran");
        else if (statusLower === "archived") msg = UX_COPY.lifecycle.archived("mata pelajaran");
        else if (statusLower === "soft_deleted") msg = UX_COPY.lifecycle.softDeleted("mata pelajaran");
        return msg;
      },
      error: (err: any) => {
        return humanizeError(err);
      }
    });

    try {
      await promise;
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  // Guard: Only administrator can access
  if (!user || user.role !== "administrator") {
    return (
      <ForbiddenState message="Menu ini hanya dapat diakses oleh Administrator sekolah." />
    );
  }

  const getConsequenceText = (status: string) => {
    switch (status) {
      case "INACTIVE":
        return "Mata pelajaran akan dinonaktifkan sementara. Hubungan mata pelajaran dengan kelas yang ada akan dinonaktifkan secara otomatis.";
      case "ARCHIVED":
        return "Mata pelajaran akan diarsipkan. Data riwayat akademik diarsipkan secara historis.";
      case "ACTIVE":
        return "Mata pelajaran akan dipulihkan kembali ke status aktif.";
      case "SOFT_DELETED":
        return "Mata pelajaran akan dipindahkan ke tempat sampah (Soft Delete).";
      default:
        return "Apakah Anda yakin ingin melanjutkan perubahan status data ini?";
    }
  };

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Mata Pelajaran"
        description="Kelola kurikulum mata pelajaran PKBM."
        actions={
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold shadow-md shadow-[#468432]/10 transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Mapel
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari mata pelajaran berdasarkan kode atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432] cursor-pointer"
        >
          {LIFECYCLE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingState message={UX_COPY.loading.fetch} />}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-655 dark:text-red-450">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              title={search || filterStatus !== "ALL_OPERATIONAL" ? UX_COPY.emptyState.search : UX_COPY.emptyState.subjects}
              description="Coba ubah kriteria pencarian atau status filter Anda."
            />
          ) : (
            <div className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-550 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4 w-32">Kode</th>
                      <th className="p-4">Nama Mata Pelajaran</th>
                      <th className="p-4">Deskripsi</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filtered.map((subj) => {
                      const currentStatus = (subj.lifecycle_status || (subj.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
                      const isArchived = currentStatus === "ARCHIVED";

                      return (
                        <tr key={subj.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors ${
                          isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                        }`}>
                          <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100 font-data">{subj.code}</td>
                          <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{subj.name}</td>
                          <td className="p-4 text-zinc-650 dark:text-zinc-450">{subj.description || "-"}</td>
                          <td className="p-4 text-center">
                            <LifecycleBadge status={currentStatus} />
                          </td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button className="p-1.5 rounded-[12px] hover:bg-zinc-100 dark:hover:bg-[#262626] transition-colors outline-none cursor-pointer">
                                  <MoreVertical className="w-4 h-4 text-zinc-400" />
                                </button>
                              </DropdownMenu.Trigger>

                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  align="end"
                                  sideOffset={5}
                                  className="z-50 min-w-[160px] bg-white dark:bg-[#2d2d2d] border border-zinc-200 dark:border-zinc-800 rounded-[16px] p-1 shadow-lg outline-none"
                                >
                                  {currentStatus !== "ARCHIVED" && currentStatus !== "SOFT_DELETED" && (
                                    <DropdownMenu.Item
                                      onClick={() => handleOpenModal(subj)}
                                      className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      Edit Mapel
                                    </DropdownMenu.Item>
                                  )}

                                  {currentStatus === "ACTIVE" && (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "INACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Power className="w-3.5 h-3.5" />
                                        Nonaktifkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "ARCHIVED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "SOFT_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Hapus (Soft Delete)
                                      </DropdownMenu.Item>
                                    </>
                                  )}

                                  {currentStatus === "INACTIVE" && (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Aktifkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "ARCHIVED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "SOFT_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Hapus (Soft Delete)
                                      </DropdownMenu.Item>
                                    </>
                                  )}

                                  {currentStatus === "ARCHIVED" && (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Mapel
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "SOFT_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Hapus (Soft Delete)
                                      </DropdownMenu.Item>
                                    </>
                                  )}

                                  {currentStatus === "SOFT_DELETED" && (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Mapel
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: subj.id, name: subj.name, status: "HARD_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Hapus Permanen
                                      </DropdownMenu.Item>
                                    </>
                                  )}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- FORM MODAL --- */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0a0a0a]/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {selectedSubject ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-[12px] p-2 hover:bg-zinc-100 dark:hover:bg-[#262626] text-zinc-550 transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              
              <form onSubmit={handleSaveSubject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-data">
                    Kode Mapel
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: MAT, IPA, IND"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 font-data uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Nama Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Matematika"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Deskripsi
                  </label>
                  <textarea
                    placeholder="Deskripsi mata pelajaran (opsional)"
                    value={subjectDesc}
                    onChange={(e) => setSubjectDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 resize-none font-sans"
                  />
                </div>

                {formError && (
                  <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-655 dark:text-red-400">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={formLoading}
                      className="px-4 py-2 rounded-[12px] text-sm font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#262626] transition-colors cursor-pointer"
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

      {confirmTarget && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={
            confirmTarget.status === "SOFT_DELETED"
              ? `Hapus permanen mata pelajaran ${confirmTarget.name}?`
              : confirmTarget.status === "ACTIVE"
              ? `Aktifkan kembali mata pelajaran ${confirmTarget.name}?`
              : confirmTarget.status === "ARCHIVED"
              ? `Arsipkan mata pelajaran ${confirmTarget.name}?`
              : `Nonaktifkan mata pelajaran ${confirmTarget.name}?`
          }
          description={getConsequenceText(confirmTarget.status)}
          confirmLabel={
            confirmTarget.status === "SOFT_DELETED"
              ? "Ya, Hapus Permanen"
              : confirmTarget.status === "ACTIVE"
              ? "Ya, Aktifkan"
              : confirmTarget.status === "ARCHIVED"
              ? "Ya, Arsipkan"
              : "Ya, Nonaktifkan"
          }
          variant={confirmTarget.status === "SOFT_DELETED" ? "destructive" : "default"}
          onConfirm={handleLifecycleMutation}
        />
      )}
    </ResponsiveContainer>
  );
}
