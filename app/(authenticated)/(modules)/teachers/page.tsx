"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, mutateLifecycleStatus } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState, EmptyState, ForbiddenState } from "@/components/ui-states";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { X, MoreVertical, Edit, Archive, CheckCircle, Trash2, Power, RotateCcw, Search, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { UX_COPY } from "@/lib/ux-copy";
import { humanizeError } from "@/lib/utils/ui-error";

export interface TeacherProfile {
  id: string;
  user_id: string;
  full_name: string;
  gender?: string;
  phone?: string;
  address?: string;
  nip?: string;
  nuptk?: string;
  position?: string;
  status: "active" | "inactive";
  lifecycle_status?: string;
}

const LIFECYCLE_FILTER_OPTIONS = [
  { label: "Operasional (Aktif & Nonaktif)", value: "ALL_OPERATIONAL" },
  { label: "Aktif saja", value: "ACTIVE" },
  { label: "Tidak Aktif saja", value: "INACTIVE" },
  { label: "Diarsipkan", value: "ARCHIVED" },
  { label: "Terhapus", value: "SOFT_DELETED" },
  { label: "Semua", value: "Semua" },
];

export default function TeachersPage() {
  const { token, user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter State
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState<string>("ALL_OPERATIONAL");

  // Form / Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  
  // Mutation Confirm State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; status: string } | null>(null);
  
  // Fields
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [nip, setNip] = useState("");
  const [nuptk, setNuptk] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTeachers = useCallback(async () => {
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
      const data = await apiRequest<TeacherProfile[]>("list_teacher_profiles", params, token);
      setTeachers(data);
    } catch (err: unknown) {
      console.error("Failed to load teacher profiles:", err);
      const msg = err instanceof Error ? err.message : "Gagal memuat profil guru.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => {
    setTimeout(() => {
      loadTeachers();
    }, 0);
  }, [loadTeachers]);

  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      const q = debouncedSearch.toLowerCase();
      const matchSearch =
        !q ||
        t.full_name.toLowerCase().includes(q) ||
        (t.nip && t.nip.toLowerCase().includes(q)) ||
        (t.nuptk && t.nuptk.toLowerCase().includes(q)) ||
        (t.position && t.position.toLowerCase().includes(q));

      if (filterStatus) {
        const tStatus = (t.lifecycle_status || (t.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
        if (filterStatus === "ALL_OPERATIONAL") {
          if (tStatus !== "ACTIVE" && tStatus !== "INACTIVE") return false;
        } else if (filterStatus !== "Semua") {
          if (filterStatus !== tStatus) return false;
        }
      }
      return matchSearch;
    });
  }, [teachers, debouncedSearch, filterStatus]);

  const handleOpenEditModal = (teacher: TeacherProfile) => {
    setFormError(null);
    setSelectedTeacher(teacher);
    setFullName(teacher.full_name);
    setGender(teacher.gender || "");
    setPhone(teacher.phone || "");
    setAddress(teacher.address || "");
    setNip(teacher.nip || "");
    setNuptk(teacher.nuptk || "");
    setPosition(teacher.position || "");
    setStatus(teacher.status);
    setShowModal(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTeacher) return;
    if (!fullName) {
      setFormError("Nama lengkap wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      await apiRequest("update_teacher_profile", {
        id: selectedTeacher.id,
        user_id: selectedTeacher.user_id,
        full_name: fullName,
        gender,
        phone,
        address,
        nip,
        nuptk,
        position,
        status,
      }, token);
      await loadTeachers();
      setShowModal(false);
      notify.success("Profil guru berhasil diperbarui.");
    } catch (err: unknown) {
      setFormError(humanizeError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleLifecycleMutation = async () => {
    if (!token || !confirmTarget) return;
    setFormLoading(true);
    const promise = mutateLifecycleStatus("teacher_profiles", confirmTarget.id, confirmTarget.status, token);
    
    notify.promise(promise, {
      loading: UX_COPY.loading.save,
      success: () => {
        setConfirmOpen(false);
        loadTeachers();
        const statusLower = confirmTarget.status.toLowerCase();
        let msg = UX_COPY.lifecycle.restored("guru");
        if (statusLower === "active") msg = UX_COPY.lifecycle.active("guru");
        else if (statusLower === "inactive") msg = UX_COPY.lifecycle.inactive("guru");
        else if (statusLower === "archived") msg = UX_COPY.lifecycle.archived("guru");
        else if (statusLower === "soft_deleted") msg = UX_COPY.lifecycle.softDeleted("guru");
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

  if (!user || user.role !== "administrator") {
    return (
      <ForbiddenState message="Menu ini hanya dapat diakses oleh Administrator sekolah." />
    );
  }

  const getConsequenceText = (status: string) => {
    switch (status) {
      case "INACTIVE":
        return "Profil guru akan dinonaktifkan sementara. Hubungan guru dengan mata pelajaran atau kelas berjalan tetap dipertahankan, namun guru tidak dapat mengakses menu akademik aktif.";
      case "ARCHIVED":
        return "Profil guru akan diarsipkan. Data riwayat mengajar tetap diarsipkan secara historis. Wali kelas aktif di bawah guru ini akan diblokir deaktivasinya.";
      case "ACTIVE":
        return "Profil guru akan dipulihkan kembali ke status aktif.";
      case "SOFT_DELETED":
        return "Profil guru akan dipindahkan ke tempat sampah (Soft Delete).";
      default:
        return "Apakah Anda yakin ingin melanjutkan perubahan status data ini?";
    }
  };

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Daftar Profil Guru"
        description="Kelola informasi dan profil staf pengajar."
      />

      <div className="p-4 rounded-[20px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3.5 shadow-sm text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-bold text-amber-850 dark:text-amber-350">Informasi Pembuatan Profil</h4>
          <p className="text-amber-800 dark:text-amber-400 mt-0.5 leading-relaxed">
            Status profil guru terintegrasi langsung dengan status otentikasi User.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari guru berdasarkan nama, NIP, atau NUPTK..."
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
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              title={search || filterStatus !== "ALL_OPERATIONAL" ? UX_COPY.emptyState.search : UX_COPY.emptyState.teachers}
              description="Coba ubah kata kunci pencarian atau filter status untuk menampilkan data."
            />
          ) : (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-550 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">NIP / NUPTK</th>
                      <th className="p-4">Jabatan</th>
                      <th className="p-4">Kontak</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filtered.map((teacher) => {
                      const currentStatus = (teacher.lifecycle_status || (teacher.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
                      const isArchived = currentStatus === "ARCHIVED";

                      return (
                        <tr key={teacher.id} className={`hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors ${
                          isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                        }`}>
                          <td className="p-4">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">{teacher.full_name}</div>
                            <div className="text-xs text-zinc-450 dark:text-zinc-500 font-data mt-0.5">User ID: {teacher.user_id}</div>
                          </td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400 font-data">
                            <div>NIP: {teacher.nip || "-"}</div>
                            <div className="text-xs mt-0.5 text-zinc-450">NUPTK: {teacher.nuptk || "-"}</div>
                          </td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400">{teacher.position || "-"}</td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400 font-data">
                            <div>{teacher.phone || "-"}</div>
                            <div className="text-xs text-zinc-450 dark:text-zinc-500 max-w-[180px] truncate mt-0.5 normal-case font-sans">{teacher.address || "-"}</div>
                          </td>
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
                                      onClick={() => handleOpenEditModal(teacher)}
                                      className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      Edit Profil
                                    </DropdownMenu.Item>
                                  )}

                                  {currentStatus === "ACTIVE" && (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "INACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Power className="w-3.5 h-3.5" />
                                        Nonaktifkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "ARCHIVED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "SOFT_DELETED" });
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
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Aktifkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "ARCHIVED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "SOFT_DELETED" });
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
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Guru
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "SOFT_DELETED" });
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
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Guru
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: teacher.id, name: teacher.full_name, status: "HARD_DELETED" });
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

      {/* --- EDIT MODAL --- */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0a0a0a]/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Edit Profil Guru
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-[12px] p-2 hover:bg-zinc-100 dark:hover:bg-[#262626] text-zinc-550 transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              
              <form onSubmit={handleSaveTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-data">
                    User ID Guru (Read-Only)
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={selectedTeacher?.user_id || ""}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 text-sm cursor-not-allowed text-zinc-400 font-data"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Lengkap"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Jenis Kelamin
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                    >
                      <option value="">Pilih...</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      No. Kontak
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 0812..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 font-data"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      NIP
                    </label>
                    <input
                      type="text"
                      placeholder="NIP"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 font-data"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      NUPTK
                    </label>
                    <input
                      type="text"
                      placeholder="NUPTK"
                      value={nuptk}
                      onChange={(e) => setNuptk(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 font-data"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Jabatan
                  </label>
                  <input
                    type="text"
                    placeholder="Jabatan"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Alamat
                  </label>
                  <textarea
                    placeholder="Alamat lengkap"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 resize-none"
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
                      className="px-4 py-2 rounded-[12px] text-sm font-semibold border border-zinc-250 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
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
              ? `Hapus permanen data guru ${confirmTarget.name}?`
              : confirmTarget.status === "ACTIVE"
              ? `Aktifkan kembali akun guru ${confirmTarget.name}?`
              : confirmTarget.status === "ARCHIVED"
              ? `Arsipkan data guru ${confirmTarget.name}?`
              : `Nonaktifkan akun guru ${confirmTarget.name}?`
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
