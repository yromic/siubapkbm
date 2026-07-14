"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  ResponsiveContainer,
  LoadingState,
  ForbiddenState,
  EmptyState
} from "@/components/ui-states";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { X, MoreVertical, Edit, Key, Archive, CheckCircle, Trash2, Power, RotateCcw, ChevronDown } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import {
  listUsersApi,
  createUserApi,
  updateUserApi,
  resetUserPasswordApi,
  UserWithProfile
} from "@/lib/api/users";
import { ApiError, mutateLifecycleStatus } from "@/lib/api/client";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { useDebounce } from "@/hooks/useDebounce";
import { UX_COPY } from "@/lib/ux-copy";
import { humanizeError } from "@/lib/utils/ui-error";

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  
  // Data States
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>(UX_COPY.loading.fetch);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter States
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("ACTIVE");

  // Modal Visibility States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  
  // Mutation Confirm State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; status: string; role: string } | null>(null);

  // Target User States
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);

  // Form Fields - User Account
  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<string>("teacher");
  const [phone, setPhone] = useState<string>("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // Form Fields - Teacher Profile
  const [gender, setGender] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [nip, setNip] = useState<string>("");
  const [nuptk, setNuptk] = useState<string>("");
  const [position, setPosition] = useState<string>("Guru");

  // Form Fields - Reset Password
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Modal Form States
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch Users
  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (filterRole !== "all") {
        filters.role = filterRole;
      }
      if (filterStatus === "ALL_OPERATIONAL") {
        filters.includeInactive = true;
      } else if (filterStatus === "Semua") {
        filters.includeInactive = true;
        filters.includeArchived = true;
      } else if (filterStatus === "INACTIVE") {
        filters.includeInactive = true;
      } else if (filterStatus === "ARCHIVED") {
        filters.onlyArchived = true;
      } else if (filterStatus === "SOFT_DELETED") {
        filters.onlyDeleted = true;
      }
      const data = await listUsersApi(token, filters);
      setUsers(data);
    } catch (err: unknown) {
      console.error("Failed to load users:", err);
      const msg = err && typeof err === "object" && "code" in err ? (err as { message: string }).message : "Data pengguna belum dapat dimuat. Silakan coba kembali.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, filterRole, filterStatus]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Access Guard
  if (!currentUser || currentUser.role !== "administrator") {
    return <ForbiddenState message="Hanya Administrator yang memiliki akses ke menu ini." />;
  }

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalError(null);
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("teacher");
    setPhone("");
    setStatus("active");
    setGender("");
    setAddress("");
    setNip("");
    setNuptk("");
    setPosition("Guru");
    setShowCreateModal(true);
  };

  // Handle Create User Submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setModalError("Nama lengkap, username, email, dan password wajib diisi.");
      return;
    }
    if (password.length < 8) {
      setModalError("Password harus minimal 8 karakter.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setLoadingMessage("Menyimpan pengguna...");

    try {
      const payload: Record<string, any> = {
        name,
        username,
        email,
        password,
        role,
        phone,
        status
      };

      if (role === "teacher") {
        payload.gender = gender;
        payload.address = address;
        payload.nip = nip;
        payload.nuptk = nuptk;
        payload.position = position;
      }

      await createUserApi(token, payload);
      await loadUsers();
      setShowCreateModal(false);
    } catch (err: unknown) {
      console.error("Failed to create user:", err);
      const msg = err && typeof err === "object" && "code" in err ? (err as { message: string }).message : "Gagal menyimpan pengguna.";
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserWithProfile) => {
    setModalError(null);
    setSelectedUser(user);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
    setPhone(user.phone || "");
    setStatus(user.status);
    
    if (user.role === "teacher" && user.teacher_profile) {
      const profile = user.teacher_profile;
      setGender(profile.gender || "");
      setAddress(profile.address || "");
      setNip(profile.nip || "");
      setNuptk(profile.nuptk || "");
      setPosition(profile.position || "Guru");
    } else {
      setGender("");
      setAddress("");
      setNip("");
      setNuptk("");
      setPosition("");
    }
    
    setShowEditModal(true);
  };

  // Handle Edit User Submit
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUser) return;

    if (!name.trim() || !username.trim() || !email.trim()) {
      setModalError("Nama lengkap, username, dan email wajib diisi.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setLoadingMessage("Menyimpan pengguna...");

    try {
      const payload: Record<string, any> = {
        name,
        username,
        email,
        phone,
        status
      };

      // Role is teacher (updating teacher profile details directly)
      if (selectedUser.role === "teacher") {
        payload.gender = gender;
        payload.address = address;
        payload.nip = nip;
        payload.nuptk = nuptk;
        payload.position = position;
      }

      await updateUserApi(token, selectedUser.id, payload);
      await loadUsers();
      setShowEditModal(false);
    } catch (err: unknown) {
      console.error("Failed to update user:", err);
      const msg = err && typeof err === "object" && "code" in err ? (err as { message: string }).message : "Gagal memperbarui pengguna.";
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetModal = (user: UserWithProfile) => {
    setModalError(null);
    setResetSuccessMessage(null);
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowResetModal(true);
  };

  // Handle Reset Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUser) return;

    if (!newPassword || !confirmPassword) {
      setModalError("Kata sandi baru dan konfirmasi kata sandi wajib diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (newPassword.length < 8) {
      setModalError("Kata sandi harus minimal 8 karakter.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setLoadingMessage("Mengatur ulang password...");

    try {
      await resetUserPasswordApi(token, selectedUser.id, newPassword);
      setResetSuccessMessage(
        "Password berhasil direset. Sampaikan password baru kepada pengguna secara aman."
      );
    } catch (err: unknown) {
      console.error("Failed to reset password:", err);
      const msg = err && typeof err === "object" && "code" in err ? (err as { message: string }).message : "Gagal mengatur ulang kata sandi.";
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  const handleLifecycleMutation = async () => {
    if (!token || !confirmTarget) return;
    setModalLoading(true);
    const promise = mutateLifecycleStatus("users", confirmTarget.id, confirmTarget.status, token);
    
    notify.promise(promise, {
      loading: UX_COPY.loading.save,
      success: () => {
        setConfirmOpen(false);
        loadUsers();
        const statusLower = confirmTarget.status.toLowerCase();
        let msg = UX_COPY.lifecycle.restored("pengguna");
        if (statusLower === "active") msg = UX_COPY.lifecycle.active("pengguna");
        else if (statusLower === "inactive") msg = UX_COPY.lifecycle.inactive("pengguna");
        else if (statusLower === "archived") msg = UX_COPY.lifecycle.archived("pengguna");
        else if (statusLower === "soft_deleted") msg = UX_COPY.lifecycle.softDeleted("pengguna");
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
      setModalLoading(false);
    }
  };

  const getConsequenceText = (status: string, role: string) => {
    if (role === "teacher" && status === "ARCHIVED") {
      return "Pengguna ini memiliki peran Guru Wali Kelas. Pengarsipan user ini juga akan mengarsipkan profil guru terkait.";
    }
    switch (status) {
      case "INACTIVE":
        return "Pengguna tidak akan dapat masuk ke sistem sementara waktu.";
      case "ARCHIVED":
        return "Pengguna akan dipindahkan ke arsip historis. Hak akses login dicabut secara permanen.";
      case "ACTIVE":
        return "Pengguna akan dipulihkan kembali ke status aktif.";
      case "SOFT_DELETED":
        return "Pengguna akan dipindahkan ke tempat sampah (Soft Delete).";
      default:
        return "Apakah Anda yakin ingin melanjutkan perubahan status data ini?";
    }
  };

  // Format Role labels and styles
  const renderRoleBadge = (role: string) => {
    switch (role) {
      case "administrator":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50">
            Administrator
          </span>
        );
      case "admin":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50">
            Operator
          </span>
        );
      case "teacher":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50">
            Guru Wali Kelas
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-50 text-zinc-700 border border-zinc-200">
            {role}
          </span>
        );
    }
  };

  // Local Client Filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search check
      const query = debouncedSearch.toLowerCase().trim();
      if (query !== "") {
        const matchName = u.name.toLowerCase().includes(query);
        const matchUsername = u.username.toLowerCase().includes(query);
        const matchEmail = u.email.toLowerCase().includes(query);
        if (!matchName && !matchUsername && !matchEmail) return false;
      }
      return true;
    });
  }, [users, debouncedSearch]);

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola hak akses dan akun staf Administrator, Operator, dan Guru Wali Kelas."
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white rounded-[12px] shadow-md shadow-[#468432]/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Pengguna
          </button>
        }
      />

      {/* Filters and Search Panel */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white dark:bg-[#171717]/40 border border-zinc-200 dark:border-zinc-800/80 rounded-[20px] shadow-sm">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Cari nama, username, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900"
          />
          <svg className="w-5 h-5 text-zinc-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-3 w-full sm:w-auto">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 w-full sm:min-w-[130px]"
          >
            <option value="all">Semua Peran</option>
            <option value="administrator">Administrator</option>
            <option value="admin">Operator</option>
            <option value="teacher">Guru</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 w-full sm:min-w-[130px] cursor-pointer"
          >
            <option value="ALL_OPERATIONAL">Operasional (Aktif & Nonaktif)</option>
            <option value="ACTIVE">Aktif saja</option>
            <option value="INACTIVE">Tidak Aktif saja</option>
            <option value="ARCHIVED">Diarsipkan</option>
            <option value="SOFT_DELETED">Terhapus</option>
            <option value="Semua">Semua</option>
          </select>
        </div>
      </div>

      {loading && <LoadingState message={loadingMessage} />}

      {error && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-650 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Users Directory */}
      {!loading && !error && (
        <>
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="Belum ada pengguna"
              description="Belum ada pengguna terdaftar yang cocok dengan pencarian atau kriteria filter Anda."
            />
          ) : (
            <>
              {/* PRIMARY MOBILE CARD LAYOUT (stacks on screens below md) */}
              <div className="block md:hidden space-y-4">
                {filteredUsers.map((u) => {
                  const currentStatus = (u.lifecycle_status || (u.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
                  const isArchived = currentStatus === "ARCHIVED";

                  return (
                    <div
                      key={u.id}
                      className={`p-5 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800/80 rounded-[20px] space-y-3.5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors ${
                        isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div>
                          <h4 className="font-bold text-zinc-950 dark:text-zinc-550 text-base">{u.name}</h4>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">@{u.username}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <LifecycleBadge status={currentStatus} />
                          {renderRoleBadge(u.role)}
                        </div>
                      </div>

                      <div className="text-xs space-y-2 border-t border-b border-zinc-100 dark:border-zinc-850 py-3 text-zinc-550 dark:text-zinc-400">
                        <div className="flex justify-between">
                          <span>Email:</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-300 truncate max-w-[200px]">{u.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>HP:</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-300">{u.phone || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Login Terakhir:</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-300">
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString("id-ID") : "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="w-full sm:w-auto text-center px-4 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-[12px] text-zinc-750 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer flex items-center justify-center gap-1">
                              Tindakan
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              sideOffset={5}
                              className="z-50 min-w-[160px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[12px] p-1 shadow-lg outline-none"
                            >
                              {currentStatus !== "ARCHIVED" && currentStatus !== "SOFT_DELETED" && (
                                <>
                                  <DropdownMenu.Item
                                    onClick={() => handleOpenEditModal(u)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit Profil
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => handleOpenResetModal(u)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                  >
                                    <Key className="w-3.5 h-3.5" />
                                    Reset Password
                                  </DropdownMenu.Item>
                                </>
                              )}

                              {currentStatus === "ACTIVE" && (
                                <>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setConfirmTarget({ id: u.id, name: u.name, status: "INACTIVE", role: u.role });
                                      setConfirmOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                    Nonaktifkan
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setConfirmTarget({ id: u.id, name: u.name, status: "ARCHIVED", role: u.role });
                                      setConfirmOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    Arsipkan
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setConfirmTarget({ id: u.id, name: u.name, status: "SOFT_DELETED", role: u.role });
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
                                      setConfirmTarget({ id: u.id, name: u.name, status: "ACTIVE", role: u.role });
                                      setConfirmOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Aktifkan
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setConfirmTarget({ id: u.id, name: u.name, status: "ARCHIVED", role: u.role });
                                      setConfirmOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    Arsipkan
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onClick={() => {
                                      setConfirmTarget({ id: u.id, name: u.name, status: "SOFT_DELETED", role: u.role });
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
                                <DropdownMenu.Item
                                  onClick={() => {
                                    setConfirmTarget({ id: u.id, name: u.name, status: "SOFT_DELETED", role: u.role });
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
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TABLE LAYOUT FOR DESKTOP VIEWS */}
              <div className="hidden md:block bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                        <th className="p-4">Nama & Username</th>
                        <th className="p-4">Kontak</th>
                        <th className="p-4">Peran</th>
                        <th className="p-4">Login Terakhir</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {filteredUsers.map((u) => {
                        const currentStatus = (u.lifecycle_status || (u.status === "active" ? "ACTIVE" : "INACTIVE")).toUpperCase();
                        const isArchived = currentStatus === "ARCHIVED";

                        return (
                          <tr key={u.id} className={`hover:bg-zinc-50/50 dark:hover:bg-[#262626]/40 transition-colors ${
                            isArchived ? "opacity-60 bg-zinc-50/30 dark:bg-zinc-950/10" : ""
                          }`}>
                            <td className="p-4">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100">{u.name}</div>
                              <div className="text-xs text-zinc-400 font-mono mt-0.5">@{u.username}</div>
                            </td>
                            <td className="p-4">
                              <div className="text-zinc-700 dark:text-zinc-300">{u.email}</div>
                              <div className="text-xs text-zinc-400 mt-0.5">{u.phone || "-"}</div>
                            </td>
                            <td className="p-4">{renderRoleBadge(u.role)}</td>
                            <td className="p-4 text-zinc-600 dark:text-zinc-400">
                              {u.last_login_at ? new Date(u.last_login_at).toLocaleString("id-ID") : "-"}
                            </td>
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
                                      <>
                                        <DropdownMenu.Item
                                          onClick={() => handleOpenEditModal(u)}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                          Edit Profil
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => handleOpenResetModal(u)}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Key className="w-3.5 h-3.5" />
                                          Reset Password
                                        </DropdownMenu.Item>
                                      </>
                                    )}

                                    {currentStatus === "ACTIVE" && (
                                      <>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "INACTIVE", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Power className="w-3.5 h-3.5" />
                                          Nonaktifkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "ARCHIVED", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          Arsipkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "SOFT_DELETED", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                            setConfirmTarget({ id: u.id, name: u.name, status: "ACTIVE", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <CheckCircle className="w-3.5 h-3.5" />
                                          Aktifkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "ARCHIVED", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          Arsipkan
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "SOFT_DELETED", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                            setConfirmTarget({ id: u.id, name: u.name, status: "ACTIVE", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#468432] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          Pulihkan Pengguna
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "SOFT_DELETED", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
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
                                            setConfirmTarget({ id: u.id, name: u.name, status: "ACTIVE", role: u.role });
                                            setConfirmOpen(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#468432] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          Pulihkan Pengguna
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          onClick={() => {
                                            setConfirmTarget({ id: u.id, name: u.name, status: "HARD_DELETED", role: u.role });
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
            </>
          )}
        </>
      )}

      {/* --- CREATE MODAL --- */}
      <Dialog.Root open={showCreateModal} onOpenChange={setShowCreateModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Tambah Pengguna
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <form onSubmit={handleCreateUser} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 pb-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      placeholder="Nama Lengkap"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400 mb-1.5">
                        Kata Sandi Awal
                      </label>
                      <input
                        type="password"
                        placeholder="Minimal 8 karakter"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400 mb-1.5">
                        Nomor HP (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Nomor HP"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                        Peran / Hak Akses
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      >
                        <option value="teacher">Guru</option>
                        <option value="admin">Operator</option>
                        <option value="administrator">Administrator</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400 mb-1.5">
                        Status Akun
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      >
                        <option value="active">Aktif</option>
                        <option value="inactive">Tidak Aktif</option>
                      </select>
                    </div>
                  </div>

                  {role === "teacher" && (
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-[20px] space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#468432] dark:text-emerald-450 border-b border-zinc-200 dark:border-zinc-850 pb-1.5">
                        Profil Guru (Opsional)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                            Jenis Kelamin
                          </label>
                          <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] focus:text-zinc-900 dark:focus:text-zinc-100"
                          >
                            <option value="">Pilih...</option>
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                            Jabatan
                          </label>
                          <input
                            type="text"
                            placeholder="Jabatan"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] focus:text-zinc-900 dark:focus:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                            NIP
                          </label>
                          <input
                            type="text"
                            placeholder="NIP"
                            value={nip}
                            onChange={(e) => setNip(e.target.value)}
                            className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] focus:text-zinc-900 dark:focus:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                            NUPTK
                          </label>
                          <input
                            type="text"
                            placeholder="NUPTK"
                            value={nuptk}
                            onChange={(e) => setNuptk(e.target.value)}
                            className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] focus:text-zinc-900 dark:focus:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                          Alamat
                        </label>
                        <textarea
                          placeholder="Alamat lengkap"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] focus:text-zinc-900 dark:focus:text-zinc-100 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {modalError && (
                    <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-650 dark:text-red-400">
                      {modalError}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={modalLoading}
                      className="px-4 py-2.5 rounded-[12px] text-sm font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-855 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-2.5 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-md shadow-[#468432]/10 transition-colors flex items-center justify-center min-w-[80px]"
                  >
                    {modalLoading ? (
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

      {/* --- EDIT MODAL --- */}
      <Dialog.Root open={showEditModal} onOpenChange={setShowEditModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Ubah Pengguna
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {selectedUser && (
                <form onSubmit={handleEditUser} className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 pb-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                        Peran / Hak Akses (Read-Only)
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={selectedUser.role.toUpperCase()}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 text-sm cursor-not-allowed text-zinc-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        placeholder="Nama Lengkap"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                          Username
                        </label>
                        <input
                          type="text"
                          placeholder="Username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400 mb-1.5">
                          Nomor HP (Opsional)
                        </label>
                        <input
                          type="text"
                          placeholder="Nomor HP"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-555 dark:text-zinc-400 mb-1.5">
                          Status Akun
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                          className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                        >
                          <option value="active">Aktif</option>
                          <option value="inactive">Tidak Aktif</option>
                        </select>
                      </div>
                    </div>

                    {selectedUser.role === "teacher" && (
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-[20px] space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#468432] dark:text-emerald-450 border-b border-zinc-200 dark:border-zinc-850 pb-1.5">
                          Profil Guru (Opsional)
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                              Jenis Kelamin
                            </label>
                            <select
                              value={gender}
                              onChange={(e) => setGender(e.target.value)}
                              className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] focus:text-zinc-905"
                            >
                              <option value="">Pilih...</option>
                              <option value="L">Laki-laki</option>
                              <option value="P">Perempuan</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                              Jabatan
                            </label>
                            <input
                              type="text"
                              placeholder="Jabatan"
                              value={position}
                              onChange={(e) => setPosition(e.target.value)}
                              className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                              NIP
                            </label>
                            <input
                              type="text"
                              placeholder="NIP"
                              value={nip}
                              onChange={(e) => setNip(e.target.value)}
                              className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                              NUPTK
                            </label>
                            <input
                              type="text"
                              placeholder="NUPTK"
                              value={nuptk}
                              onChange={(e) => setNuptk(e.target.value)}
                              className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                            Alamat
                          </label>
                          <textarea
                            placeholder="Alamat lengkap"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-xs focus:outline-[#468432] resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {modalError && (
                      <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-650 dark:text-red-400">
                        {modalError}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        disabled={modalLoading}
                        className="px-4 py-2.5 rounded-[12px] text-sm font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="px-4 py-2.5 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-md shadow-[#468432]/10 transition-colors flex items-center justify-center min-w-[80px]"
                    >
                      {modalLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        "Simpan"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* --- RESET PASSWORD MODAL --- */}
      <Dialog.Root open={showResetModal} onOpenChange={setShowResetModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Atur Ulang Kata Sandi
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              {selectedUser && (
                <form onSubmit={handleResetPassword} className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 pb-4">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-[12px] text-xs space-y-1 border border-zinc-150 dark:border-zinc-850">
                      <div>Nama: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedUser.name}</span></div>
                      <div>Username: <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">@{selectedUser.username}</span></div>
                    </div>

                    {!resetSuccessMessage ? (
                      <>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                            Kata Sandi Baru
                          </label>
                          <input
                            type="password"
                            placeholder="Minimal 8 karakter"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
                            Konfirmasi Kata Sandi Baru
                          </label>
                          <input
                            type="password"
                            placeholder="Konfirmasi Kata Sandi Baru"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="p-4 rounded-[12px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900 text-xs font-semibold text-emerald-850 dark:text-emerald-400 leading-relaxed">
                        {resetSuccessMessage}
                      </div>
                    )}

                    {modalError && (
                      <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-xs font-semibold text-red-650 dark:text-red-400">
                        {modalError}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        disabled={modalLoading}
                        className="px-4 py-2.5 rounded-[12px] text-sm font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                      >
                        {resetSuccessMessage ? "Tutup" : "Batal"}
                      </button>
                    </Dialog.Close>
                    {!resetSuccessMessage && (
                      <button
                        type="submit"
                        disabled={modalLoading}
                        className="px-4 py-2.5 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-md shadow-[#468432]/10 transition-colors flex items-center justify-center min-w-[80px]"
                      >
                        {modalLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          "Reset"
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}
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
              ? `Hapus permanen akun ${confirmTarget.name}?`
              : confirmTarget.status === "ACTIVE"
              ? `Aktifkan kembali akun ${confirmTarget.name}?`
              : confirmTarget.status === "ARCHIVED"
              ? `Arsipkan akun ${confirmTarget.name}?`
              : `Nonaktifkan akun ${confirmTarget.name}?`
          }
          description={getConsequenceText(confirmTarget.status, confirmTarget.role)}
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
