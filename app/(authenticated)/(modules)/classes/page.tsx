"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { apiRequest, mutateLifecycleStatus } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState, EmptyState, ForbiddenState } from "@/components/ui-states";
import { DatePicker } from "@/components/ui/date-picker";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { X, MoreVertical, Edit, Archive, CheckCircle, Trash2, Power, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { UX_COPY } from "@/lib/ux-copy";
import { humanizeError } from "@/lib/utils/ui-error";

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  level: string | number;
  status: "active" | "inactive";
  lifecycle_status?: string;
  created_at?: string;
  updated_at?: string;
}

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
}

export interface ClassTeacherAssignment {
  id: string;
  class_id: string;
  teacher_user_id: string;
  academic_year_id: string;
  semester_id: string;
  effective_from: string;
  effective_until?: string;
  status: "active" | "ended";
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

export default function ClassesPage() {
  const { token, user } = useAuth();
  const { academicYears, semesters, activeAcademicYear, activeSemester } = useSettings();

  const [activeTab, setActiveTab] = useState<"classes" | "assignments">("classes");
  
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [assignments, setAssignments] = useState<ClassTeacherAssignment[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState<string>("ALL_OPERATIONAL");

  const [showClassModal, setShowClassModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; status: string; type: "classes" | "assignments" } | null>(null);

  const [classCode, setClassCode] = useState("");
  const [classNameField, setClassNameField] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [classStatus, setClassStatus] = useState<"active" | "inactive">("active");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignTeacherUserId, setAssignTeacherUserId] = useState("");
  const [assignYearId, setAssignYearId] = useState("");
  const [assignSemesterId, setAssignSemesterId] = useState("");
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState("");
  const [assignEffectiveUntil, setAssignEffectiveUntil] = useState("");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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

      const [classList, teacherList, assignmentList] = await Promise.all([
        apiRequest<ClassItem[]>("list_classes", params, token),
        apiRequest<TeacherProfile[]>("list_teacher_profiles", {}, token),
        apiRequest<ClassTeacherAssignment[]>("list_class_teacher_assignments", params, token),
      ]);
      setClasses(classList);
      setTeachers(teacherList);
      setAssignments(assignmentList);
    } catch (err: unknown) {
      console.error("Failed to load classes data:", err);
      const msg = err instanceof Error ? err.message : "Gagal memuat data kelas dan penugasan.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => {
    setTimeout(() => {
      loadData();
    }, 0);
  }, [loadData]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      const q = debouncedSearch.toLowerCase().trim();
      const matchSearch = !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      return matchSearch;
    });
  }, [classes, debouncedSearch]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assign) => {
      const q = debouncedSearch.toLowerCase().trim();
      if (!q) return true;
      const clsObj = classes.find((c) => c.id === assign.class_id);
      const teacherObj = teachers.find((t) => t.user_id === assign.teacher_user_id);
      
      const matchClass = clsObj && clsObj.name.toLowerCase().includes(q);
      const matchTeacher = teacherObj && teacherObj.full_name.toLowerCase().includes(q);
      return matchClass || matchTeacher;
    });
  }, [assignments, classes, teachers, debouncedSearch]);

  const handleOpenClassModal = (cls: ClassItem | null = null) => {
    setFormError(null);
    if (cls) {
      setSelectedClass(cls);
      setClassCode(cls.code);
      setClassNameField(cls.name);
      setClassLevel(String(cls.level));
      setClassStatus(cls.status);
    } else {
      setSelectedClass(null);
      setClassCode("");
      setClassNameField("");
      setClassLevel("1");
      setClassStatus("active");
    }
    setShowClassModal(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!classCode || !classNameField || !classLevel) {
      setFormError("Kode, nama kelas, dan tingkat wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const payload = {
      id: selectedClass?.id,
      code: classCode,
      name: classNameField,
      level: parseInt(classLevel, 10),
      status: classStatus,
    };

    try {
      const action = selectedClass ? "update_class" : "create_class";
      await apiRequest(action, payload, token);
      notify.success(selectedClass ? UX_COPY.crud.update("kelas") : UX_COPY.crud.create("kelas"));
      await loadData();
      setShowClassModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan data kelas.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenAssignModal = () => {
    setFormError(null);
    setAssignClassId(classes[0]?.id || "");
    setAssignTeacherUserId(teachers[0]?.user_id || "");
    setAssignYearId(activeAcademicYear?.id || "");
    setAssignSemesterId(activeSemester?.id || "");
    setAssignEffectiveFrom(new Date().toISOString().split("T")[0]);
    setAssignEffectiveUntil("");
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!assignClassId || !assignTeacherUserId || !assignYearId || !assignSemesterId || !assignEffectiveFrom) {
      setFormError("Kelas, wali kelas, tahun ajaran, semester, dan tanggal mulai wajib diisi.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      await apiRequest("assign_class_teacher", {
        class_id: assignClassId,
        teacher_user_id: assignTeacherUserId,
        academic_year_id: assignYearId,
        semester_id: assignSemesterId,
        effective_from: assignEffectiveFrom,
        effective_until: assignEffectiveUntil || undefined,
      }, token);
      await loadData();
      setShowAssignModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan penugasan.";
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleLifecycleMutation = async () => {
    if (!token || !confirmTarget) return;
    setFormLoading(true);
    
    const sheetName = confirmTarget.type === "classes" ? "classes" : "class_teacher_assignments";
    const promise = mutateLifecycleStatus(sheetName, confirmTarget.id, confirmTarget.status, token);
    
    notify.promise(promise, {
      loading: UX_COPY.loading.save,
      success: () => {
        setConfirmOpen(false);
        loadData();
        const label = confirmTarget.type === "classes" ? "kelas" : "penugasan wali kelas";
        const statusLower = confirmTarget.status.toLowerCase();
        let msg = UX_COPY.lifecycle.restored(label);
        if (statusLower === "active") msg = UX_COPY.lifecycle.active(label);
        else if (statusLower === "inactive") msg = UX_COPY.lifecycle.inactive(label);
        else if (statusLower === "archived") msg = UX_COPY.lifecycle.archived(label);
        else if (statusLower === "soft_deleted") msg = UX_COPY.lifecycle.softDeleted(label);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (!user || user.role !== "administrator") {
    return (
      <ForbiddenState message="Menu ini hanya dapat diakses oleh Administrator sekolah." />
    );
  }

  const getConsequenceText = (status: string, type: "classes" | "assignments") => {
    if (type === "classes") {
      switch (status) {
        case "INACTIVE":
          return "Kelas akan dinonaktifkan sementara. Siswa aktif di kelas ini akan kehilangan penugasan kelas berjalan.";
        case "ARCHIVED":
          return "Kelas akan diarsipkan. Data riwayat akademik diarsipkan secara historis. Hubungan dengan wali kelas lama diputus (ended).";
        case "ACTIVE":
          return "Kelas akan dipulihkan kembali ke status aktif.";
        case "SOFT_DELETED":
          return "Kelas akan dipindahkan ke tempat sampah (Soft Delete).";
        default:
          return "Apakah Anda yakin ingin melanjutkan perubahan status data ini?";
      }
    } else {
      switch (status) {
        case "INACTIVE":
          return "Penugasan wali kelas akan diakhiri (ended) atau dinonaktifkan sementara.";
        case "ARCHIVED":
          return "Penugasan wali kelas akan diarsipkan secara historis.";
        case "ACTIVE":
          return "Penugasan wali kelas akan diaktifkan kembali.";
        case "SOFT_DELETED":
          return "Penugasan wali kelas akan dipindahkan ke tempat sampah (Soft Delete).";
        default:
          return "Apakah Anda yakin ingin melanjutkan penutupan tugas ini?";
      }
    }
  };

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Manajemen Kelas & Wali Kelas"
        description="Kelola daftar kelas serta penugasan guru wali kelas."
        actions={
          <button
            onClick={() => {
              if (activeTab === "classes") {
                handleOpenClassModal();
              } else {
                handleOpenAssignModal();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] text-white font-semibold shadow-md shadow-[#468432]/10 transition-all text-sm cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Tambah {activeTab === "classes" ? "Kelas" : "Penugasan"}
          </button>
        }
      />

      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("classes")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "classes"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Daftar Kelas
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "assignments"
              ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Penugasan Wali Kelas
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={activeTab === "classes" ? "Cari kelas berdasarkan kode atau nama..." : "Cari penugasan berdasarkan kelas atau wali kelas..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432] cursor-pointer"
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
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-655 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {activeTab === "classes" ? (
            filteredClasses.length === 0 ? (
              <EmptyState
                title={search || filterStatus !== "ALL_OPERATIONAL" ? UX_COPY.emptyState.search : UX_COPY.emptyState.classes}
                description="Coba ubah kriteria pencarian atau status filter Anda."
              />
            ) : (
              <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                        <th className="p-4 w-32">Kode Kelas</th>
                        <th className="p-4">Nama Kelas</th>
                        <th className="p-4 w-28">Tingkat</th>
                        <th className="p-4 text-center w-32">Status</th>
                        <th className="p-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredClasses.map((cls) => {
                        const currentStatus = (cls.lifecycle_status || (cls.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
                        const isArchived = currentStatus === "ARCHIVED";

                        return (
                          <tr key={cls.id} className={`hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors ${
                            isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                          }`}>
                            <td className="p-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">{cls.code}</td>
                            <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{cls.name}</td>
                            <td className="p-4 text-zinc-650 dark:text-zinc-400">Tingkat {cls.level}</td>
                            <td className="p-4 text-center">
                              <LifecycleBadge status={currentStatus} />
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors outline-none cursor-pointer">
                                    <MoreVertical className="w-4 h-4 text-zinc-400" />
                                  </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    sideOffset={5}
                                    className="z-50 min-w-[160px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[12px] p-1 shadow-lg outline-none"
                                  >
                                    {currentStatus !== "ARCHIVED" && currentStatus !== "SOFT_DELETED" && (
                                      <DropdownMenu.Item
                                        onClick={() => handleOpenClassModal(cls)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                        Edit Kelas
                                      </DropdownMenu.Item>
                                    )}

                                    {currentStatus === "ACTIVE" && (
                                      <>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "INACTIVE", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Power className="w-3.5 h-3.5" />
                                          Nonaktifkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "ARCHIVED", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          Arsipkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "SOFT_DELETED", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "ACTIVE", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <CheckCircle className="w-3.5 h-3.5" />
                                          Aktifkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "ARCHIVED", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          Arsipkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "SOFT_DELETED", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "ACTIVE", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#468432] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          Pulihkan Kelas
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "SOFT_DELETED", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "ACTIVE", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#468432] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          Pulihkan Kelas
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: cls.id, name: cls.name, status: "HARD_DELETED", type: "classes" });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer font-semibold"
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
            )
          ) : (
            filteredAssignments.length === 0 ? (
              <EmptyState
                title={search || filterStatus !== "ALL_OPERATIONAL" ? UX_COPY.emptyState.search : UX_COPY.emptyState.assignments}
                description="Coba ubah kriteria pencarian atau status filter Anda."
              />
            ) : (
              <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                        <th className="p-4">Kelas</th>
                        <th className="p-4">Wali Kelas</th>
                        <th className="p-4">Periode</th>
                        <th className="p-4">Tanggal Mulai</th>
                        <th className="p-4">Tanggal Selesai</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredAssignments.map((assign) => {
                        const clsObj = classes.find((c) => c.id === assign.class_id);
                        const teacherObj = teachers.find((t) => t.user_id === assign.teacher_user_id);
                        const yearObj = academicYears.find((y) => y.id === assign.academic_year_id);
                        const semObj = semesters.find((s) => s.id === assign.semester_id);
                        
                        const currentStatus = (assign.lifecycle_status || (assign.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
                        const isArchived = currentStatus === "ARCHIVED";

                        return (
                          <tr key={assign.id} className={`hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors ${
                            isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                          }`}>
                            <td className="p-4 font-bold text-zinc-900 dark:text-zinc-100">{clsObj ? clsObj.name : "Unknown"}</td>
                            <td className="p-4 font-medium text-zinc-900 dark:text-zinc-100">{teacherObj ? teacherObj.full_name : `User ID: ${assign.teacher_user_id}`}</td>
                            <td className="p-4 text-zinc-650 dark:text-zinc-400">{yearObj ? yearObj.name : "-"} ({semObj ? semObj.name : "-"})</td>
                            <td className="p-4 text-zinc-550 dark:text-zinc-400">{formatDate(assign.effective_from)}</td>
                            <td className="p-4 text-zinc-550 dark:text-zinc-400">{formatDate(assign.effective_until)}</td>
                            <td className="p-4 text-center">
                              <LifecycleBadge status={currentStatus} />
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors outline-none cursor-pointer">
                                    <MoreVertical className="w-4 h-4 text-zinc-400" />
                                  </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    sideOffset={5}
                                    className="z-50 min-w-[160px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[12px] p-1 shadow-lg outline-none"
                                  >
                                    {currentStatus === "ACTIVE" && (
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: assign.id, name: `Wali Kelas ${clsObj?.name || ""}`, status: "INACTIVE", type: "assignments" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
                                      >
                                        <Power className="w-3.5 h-3.5" />
                                        Akhiri Penugasan
                                      </DropdownMenu.Item>
                                    )}

                                    {currentStatus === "ACTIVE" && (
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: assign.id, name: `Wali Kelas ${clsObj?.name || ""}`, status: "ARCHIVED", type: "assignments" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                    )}

                                    {currentStatus === "INACTIVE" && (
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: assign.id, name: `Wali Kelas ${clsObj?.name || ""}`, status: "ARCHIVED", type: "assignments" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                    )}

                                    {(currentStatus === "ARCHIVED" || currentStatus === "SOFT_DELETED") && (
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: assign.id, name: `Wali Kelas ${clsObj?.name || ""}`, status: "ACTIVE", type: "assignments" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-emerald-650 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Penugasan
                                      </DropdownMenu.Item>
                                    )}

                                    {currentStatus === "ARCHIVED" && (
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: assign.id, name: `Wali Kelas ${clsObj?.name || ""}`, status: "SOFT_DELETED", type: "assignments" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Hapus (Soft Delete)
                                      </DropdownMenu.Item>
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
            )
          )}
        </>
      )}

      {/* --- CLASS MODAL --- */}
      <Dialog.Root open={showClassModal} onOpenChange={setShowClassModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-550">
                  {selectedClass ? "Edit Kelas" : "Tambah Kelas"}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              
              <form onSubmit={handleSaveClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Kode Kelas
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: K1A, K4B"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Nama Kelas
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kelas 1 A"
                    value={classNameField}
                    onChange={(e) => setClassNameField(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Tingkat Kelas
                  </label>
                  <select
                    value={classLevel}
                    onChange={(e) => setClassLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Tingkat {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                {formError && (
                  <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-655 dark:text-red-400 font-mono">
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

      {/* --- ASSIGN MODAL --- */}
      <Dialog.Root open={showAssignModal} onOpenChange={setShowAssignModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-550">
                  Tugaskan Wali Kelas
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              
              <form onSubmit={handleSaveAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Kelas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                    Wali Kelas (Guru) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignTeacherUserId}
                    onChange={(e) => setAssignTeacherUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                  >
                    {teachers.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                      Tahun Ajaran <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assignYearId}
                      onChange={(e) => setAssignYearId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400 mb-1.5">
                      Semester <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assignSemesterId}
                      onChange={(e) => setAssignSemesterId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                    >
                      {semesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    label="Tanggal Mulai Efektif"
                    value={assignEffectiveFrom}
                    onChange={setAssignEffectiveFrom}
                    placeholder="Pilih tanggal..."
                  />
                  <DatePicker
                    label="Tanggal Selesai (Opsional)"
                    value={assignEffectiveUntil}
                    onChange={setAssignEffectiveUntil}
                    placeholder="Pilih tanggal..."
                  />
                </div>

                {formError && (
                  <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-655 dark:text-red-400 font-mono">
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
              ? `Hapus permanen ${confirmTarget.type === "classes" ? "data kelas" : "penugasan wali kelas"} ${confirmTarget.name}?`
              : confirmTarget.status === "ACTIVE"
              ? `Aktifkan kembali ${confirmTarget.type === "classes" ? "kelas" : "penugasan wali kelas"} ${confirmTarget.name}?`
              : confirmTarget.status === "ARCHIVED"
              ? `Arsipkan ${confirmTarget.type === "classes" ? "data kelas" : "penugasan wali kelas"} ${confirmTarget.name}?`
              : `Nonaktifkan ${confirmTarget.type === "classes" ? "kelas" : "penugasan wali kelas"} ${confirmTarget.name}?`
          }
          description={getConsequenceText(confirmTarget.status, confirmTarget.type)}
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
