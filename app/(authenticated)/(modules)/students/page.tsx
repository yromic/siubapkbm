"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  ResponsiveContainer,
  LoadingState,
  EmptyState,
  ForbiddenState,
} from "@/components/ui-states";
import {
  listStudents,
  StudentRecord
} from "@/lib/api/students";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { mutateLifecycleStatus } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Edit, Eye, Archive, CheckCircle, Trash2, Power, RotateCcw, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { notify } from "@/lib/notify";
import { UX_COPY } from "@/lib/ux-copy";
import { humanizeError } from "@/lib/utils/ui-error";

const LIMIT = 20;

const OPERATIONAL_FILTER_OPTIONS = [
  { label: "Operasional (Aktif & Nonaktif)", value: "ALL_OPERATIONAL" },
  { label: "Aktif saja", value: "ACTIVE" },
  { label: "Tidak Aktif saja", value: "INACTIVE" },
  { label: "Lulus saja", value: "GRADUATED" },
  { label: "Pindah saja", value: "TRANSFERRED" },
  { label: "Keluar saja", value: "WITHDRAWN" },
  { label: "Meninggal saja", value: "DECEASED" },
  { label: "Semua", value: "Semua" },
];

const ARCHIVE_FILTER_OPTIONS = [
  { label: "Terhapus saja", value: "SOFT_DELETED" },
  { label: "Diarsipkan saja", value: "ARCHIVED" },
];

export default function StudentsPage() {
  const { token, user } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server-side search, filter & pagination
  const [viewArchive, setViewArchive] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState<string>("ALL_OPERATIONAL");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));

  // Mutation ConfirmDialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; status: string } | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);

  // Resets page to 1 when search, tab, or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, viewArchive]);

  const loadStudents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      let statusParam: string | undefined;
      if (viewArchive) {
        statusParam = filterStatus === "ARCHIVED" ? "archived" : "soft_deleted";
      } else {
        if (filterStatus === "ACTIVE") statusParam = "active";
        else if (filterStatus === "INACTIVE") statusParam = "inactive";
        else if (filterStatus === "GRADUATED") statusParam = "graduated";
        else if (filterStatus === "TRANSFERRED") statusParam = "transferred";
        else if (filterStatus === "WITHDRAWN") statusParam = "withdrawn";
        else if (filterStatus === "DECEASED") statusParam = "deceased";
        else if (filterStatus === "ARCHIVED") statusParam = "archived";
        // ALL_OPERATIONAL sends undefined statusParam to let backend fetch operational
      }

      const result = await listStudents(token, {
        page,
        limit: LIMIT,
        search: debouncedSearch || undefined,
        status: statusParam,
      });
      setStudents(result.data);
      setTotalItems(result.pagination.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data siswa.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus, page, debouncedSearch]);

  useEffect(() => {
    setTimeout(() => loadStudents(), 0);
  }, [loadStudents]);

  // Handle Lifecycle Mutation
  const handleLifecycleMutation = async () => {
    if (!token || !confirmTarget) return;
    setMutationLoading(true);
    const promise = mutateLifecycleStatus("students", confirmTarget.id, confirmTarget.status, token);

    notify.promise(promise, {
      loading: UX_COPY.loading.save,
      success: () => {
        setConfirmOpen(false);
        loadStudents();
        const statusLower = confirmTarget.status.toLowerCase();
        let msg = UX_COPY.lifecycle.restored("siswa");
        if (statusLower === "active") msg = UX_COPY.lifecycle.active("siswa");
        else if (statusLower === "inactive") msg = UX_COPY.lifecycle.inactive("siswa");
        else if (statusLower === "archived") msg = UX_COPY.lifecycle.archived("siswa");
        else if (statusLower === "soft_deleted") msg = UX_COPY.lifecycle.softDeleted("siswa");
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
      setMutationLoading(false);
    }
  };

  // Guard
  if (!user || (user.role !== "administrator" && user.role !== "admin")) {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Administrator dan Operator." />
    );
  }

  // Helper to determine transition consequences text
  const getConsequenceText = (status: string) => {
    switch (status) {
      case "INACTIVE":
        return "Siswa tidak akan dapat bertransaksi atau melakukan kegiatan akademik aktif sementara waktu.";
      case "ARCHIVED":
        return "Siswa akan dipindahkan ke arsip historis. Data riwayat akademik tetap disimpan secara permanen (read-only). PIN orang tua akan dicabut.";
      case "ACTIVE":
        return "Siswa akan dipulihkan kembali ke status aktif.";
      case "SOFT_DELETED":
        return "Siswa akan dipindahkan ke tempat sampah dan dapat dipulihkan kapan saja.";
      default:
        return "Apakah Anda yakin ingin melanjutkan perubahan status data ini?";
    }
  };

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Data Siswa"
        description={`${totalItems} siswa terdaftar`}
        actions={
          <Link
            href="/students/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-sm shadow-[#468432]/10 font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => {
            setViewArchive(false);
            setFilterStatus("ALL_OPERATIONAL");
          }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            !viewArchive
              ? "border-[#468432] text-[#468432]"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Daftar Siswa
        </button>
        <button
          onClick={() => {
            setViewArchive(true);
            setFilterStatus("SOFT_DELETED");
          }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            viewArchive
              ? "border-[#468432] text-[#468432]"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Arsip / Terhapus
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama, NISN, atau NIK..."
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
          {(viewArchive ? ARCHIVE_FILTER_OPTIONS : OPERATIONAL_FILTER_OPTIONS).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading && <LoadingState message={UX_COPY.loading.fetch} />}

      {error && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {students.length === 0 ? (
            <EmptyState
              title={
                search || filterStatus !== "ALL_OPERATIONAL" ? UX_COPY.emptyState.search : UX_COPY.emptyState.students
              }
              description={
                search || filterStatus !== "ALL_OPERATIONAL"
                  ? "Coba ubah kata kunci pencarian atau filter status."
                  : "Klik 'Tambah Siswa' untuk menambahkan data siswa pertama."
              }
            />
          ) : (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-550 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-5 py-3.5">Nama Siswa</th>
                      <th className="px-5 py-3.5">NISN</th>
                      <th className="px-5 py-3.5 hidden sm:table-cell">
                        Tgl Lahir
                      </th>
                      <th className="px-5 py-3.5 hidden md:table-cell">
                        Kelamin
                      </th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {students.map((student) => {
                      const currentStatus = (student.lifecycle_status || student.status || "active").toUpperCase();
                      const isArchived = currentStatus === "ARCHIVED";

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-zinc-50/60 dark:hover:bg-[#262626]/40 transition-colors cursor-pointer ${
                            isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                          }`}
                          onClick={() => router.push(`/students/${student.id}`)}
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {student.full_name}
                            </div>
                            {student.nik && (
                              <div className="text-xs text-zinc-450 dark:text-zinc-500 font-data mt-0.5">
                                NIK: {student.nik}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 font-data text-zinc-600 dark:text-zinc-400 text-sm">
                            {student.nisn}
                          </td>
                          <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell font-data">
                            {student.birth_date
                              ? new Date(student.birth_date).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )
                              : "-"}
                          </td>
                          <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                            {student.gender === "L"
                              ? "Laki-laki"
                              : student.gender === "P"
                              ? "Perempuan"
                              : "-"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <LifecycleBadge status={currentStatus} />
                          </td>
                          <td
                            className="px-5 py-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                                  <DropdownMenu.Item asChild>
                                    <Link
                                      href={`/students/${student.id}`}
                                      className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Detail Siswa
                                    </Link>
                                  </DropdownMenu.Item>

                                  {currentStatus !== "ARCHIVED" && currentStatus !== "SOFT_DELETED" && (
                                    <DropdownMenu.Item asChild>
                                      <Link
                                        href={`/students/${student.id}/edit`}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                        Edit Data
                                      </Link>
                                    </DropdownMenu.Item>
                                  )}

                                  {/* Conditionally render transition triggers based on status */}
                                  {currentStatus === "ACTIVE" && (
                                    <>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "INACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Power className="w-3.5 h-3.5" />
                                        Nonaktifkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "ARCHIVED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "SOFT_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Aktifkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "ARCHIVED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#262626]/60 outline-none transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        Arsipkan
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "SOFT_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Siswa
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "SOFT_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "ACTIVE" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Pulihkan Siswa
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onClick={() => {
                                          setConfirmTarget({ id: student.id, name: student.full_name, status: "HARD_DELETED" });
                                          setConfirmOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer font-semibold"
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

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
                <div className="text-xs text-zinc-500 font-data">
                  Menampilkan {students.length} dari {totalItems} siswa
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-[10px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 font-data">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-[10px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {confirmTarget && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={
            confirmTarget.status === "SOFT_DELETED"
              ? `Hapus permanen data siswa ${confirmTarget.name}?`
              : confirmTarget.status === "ACTIVE"
              ? `Aktifkan kembali akun siswa ${confirmTarget.name}?`
              : confirmTarget.status === "ARCHIVED"
              ? `Arsipkan data siswa ${confirmTarget.name}?`
              : `Nonaktifkan akun siswa ${confirmTarget.name}?`
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
