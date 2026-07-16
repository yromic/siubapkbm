"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api/client";
import {
  ResponsiveContainer,
  LoadingState,
  ForbiddenState,
} from "@/components/ui-states";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { notify } from "@/lib/notify";
import { InfoBanner } from "@/components/ui/info-banner";
import { UX_COPY } from "@/lib/ux-copy";
import { humanizeError } from "@/lib/utils/ui-error";
import {
  getStudentDetail,
  resetStudentParentPin,
  StudentRecord,
} from "@/lib/api/students";
import {
  getEnrollmentsForStudent,
  getStudentActiveEnrollment,
  createStudentEnrollment,
  EnrollmentRecord,
  EnrollmentStatus,
  ENROLLMENT_STATUSES,
  CreateEnrollmentPayload,
} from "@/lib/api/enrollments";
import { StudentFilesPanel } from "@/components/student-files-panel";
import { LifecycleBadge, LifecycleStatus } from "@/components/lifecycle-badge";
import { mutateLifecycleStatus } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Edit, Eye, Archive, CheckCircle, Trash2, Power, RotateCcw, ChevronDown } from "lucide-react";

// ─── Sub-components ───────────────────────────────────────────────────────────

function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const cfg: Record<EnrollmentStatus, { label: string; cls: string }> = {
    active: {
      label: "Aktif",
      cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    },
    promoted: {
      label: "Naik Kelas",
      cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    },
    repeated: {
      label: "Tinggal Kelas",
      cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    },
    graduated: {
      label: "Lulus",
      cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    },
    transferred: {
      label: "Pindah",
      cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    },
    inactive: {
      label: "Tidak Aktif",
      cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    },
  };
  const c = cfg[status] ?? cfg["inactive"];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

function enrollmentClassLabel(enrollment: EnrollmentRecord) {
  const name = enrollment.class_name?.trim();
  const code = enrollment.class_code?.trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || "Tidak ditemukan";
}

function enrollmentStatusLabel(status: EnrollmentStatus) {
  const labels: Record<EnrollmentStatus, string> = {
    active: "Aktif",
    promoted: "Naik Kelas",
    repeated: "Tinggal Kelas",
    graduated: "Lulus",
    transferred: "Pindah",
    inactive: "Tidak Aktif",
  };
  return labels[status] ?? "Tidak Aktif";
}

function DataRow({
  label,
  value,
  sensitive,
}: {
  label: string;
  value?: string | null;
  sensitive?: boolean;
}) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
      <dt className="w-44 shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 pt-0.5">
        {label}
      </dt>
      <dd
        className={`text-sm flex-1 ${
          sensitive
            ? "text-zinc-700 dark:text-zinc-300 font-mono"
            : "text-zinc-900 dark:text-zinc-100"
        } ${!value ? "text-zinc-400 dark:text-zinc-600 italic" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-5 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        {title}
      </h3>
      <dl>{children}</dl>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "profil" | "enrollment" | "pin" | "documents";

interface AcademicYear {
  id: string;
  name: string;
}
interface Semester {
  id: string;
  name: string;
  academic_year_id: string;
}
interface ClassRecord {
  id: string;
  name: string;
  code?: string;
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [activeEnrollment, setActiveEnrollment] =
    useState<EnrollmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("profil");

  // Status change
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [statusLoading, setStatusLoading] = useState(false);

  // PIN reset
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  // Enrollment create
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [enrollYear, setEnrollYear] = useState("");
  const [enrollSem, setEnrollSem] = useState("");
  const [enrollClass, setEnrollClass] = useState("");
  const [enrollStatus, setEnrollStatus] = useState<EnrollmentStatus>("active");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, e, ae] = await Promise.all([
        getStudentDetail(id, token) as Promise<StudentRecord>,
        getEnrollmentsForStudent(id, token),
        getStudentActiveEnrollment(id, token),
      ]);
      setStudent(s);
      setEnrollments(e);
      setActiveEnrollment(ae);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    setTimeout(() => loadAll(), 0);
  }, [loadAll]);

  // Load academic years, semesters, classes for enrollment form
  const loadEnrollmentMeta = useCallback(async () => {
    if (!token) return;
    try {
      const [years, sems, cls] = await Promise.all([
        apiRequest<AcademicYear[]>("list_academic_years", {}, token),
        apiRequest<Semester[]>("list_semesters", {}, token),
        apiRequest<ClassRecord[]>("list_classes", {}, token),
      ]);
      setAcademicYears(years);
      setSemesters(sems);
      setClasses(cls);
    } catch {
      // non-critical
    }
  }, [token]);

  useEffect(() => {
    if (!showEnrollModal) return;
    setTimeout(() => loadEnrollmentMeta(), 0);
  }, [showEnrollModal, loadEnrollmentMeta]);

  // Guard
  if (!user || (user.role !== "administrator" && user.role !== "admin" && user.role !== "teacher")) {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Administrator, Operator, dan Guru." />
    );
  }

  if (loading) return <LoadingState message={UX_COPY.loading.fetch} />;

  if (error || !student) {
    return (
      <ResponsiveContainer>
        <InfoBanner variant="error" description={error || "Data siswa tidak ditemukan."} />
      </ResponsiveContainer>
    );
  }

  // Status change handler
  const handleStatusChange = async () => {
    if (!token || !targetStatus) return;
    setStatusLoading(true);
    const promise = mutateLifecycleStatus("students", id, targetStatus, token);

    notify.promise(promise, {
      loading: UX_COPY.loading.save,
      success: () => {
        setConfirmOpen(false);
        loadAll();
        const statusLower = targetStatus.toLowerCase();
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
      setStatusLoading(false);
    }
  };

  // PIN reset handler
  const handlePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (!/^\d{4,8}$/.test(pin)) {
      setPinError("PIN harus berupa angka 4–8 digit.");
      return;
    }
    if (pin !== pinConfirm) {
      setPinError("Konfirmasi PIN tidak cocok.");
      return;
    }
    if (!token) return;
    setPinLoading(true);
    try {
      await resetStudentParentPin(id, pin, token);
      setPin("");
      setPinConfirm("");
      setPinSuccess(true);
    } catch (err: unknown) {
      setPinError(
        err instanceof Error ? err.message : "Gagal mereset PIN."
      );
    } finally {
      setPinLoading(false);
    }
  };

  // Enrollment create handler
  const filteredSemesters = semesters.filter(
    (s) => s.academic_year_id === enrollYear
  );

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    if (!enrollYear || !enrollSem || !enrollClass) {
      setEnrollError("Tahun ajaran, semester, dan kelas wajib dipilih.");
      return;
    }
    if (!token) return;
    setEnrollLoading(true);
    const payload: CreateEnrollmentPayload = {
      student_id: id,
      academic_year_id: enrollYear,
      semester_id: enrollSem,
      class_id: enrollClass,
      status: enrollStatus,
    };
    try {
      await createStudentEnrollment(payload, token);
      const [e, ae] = await Promise.all([
        getEnrollmentsForStudent(id, token),
        getStudentActiveEnrollment(id, token),
      ]);
      setEnrollments(e);
      setActiveEnrollment(ae);
      setShowEnrollModal(false);
      setEnrollYear("");
      setEnrollSem("");
      setEnrollClass("");
      setEnrollStatus("active");
    } catch (err: unknown) {
      setEnrollError(
        err instanceof Error ? err.message : "Gagal membuat enrollment."
      );
    } finally {
      setEnrollLoading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "profil", label: "Profil" },
    { key: "enrollment", label: `Riwayat Kelas (${enrollments.length})` },
    { key: "documents", label: "Dokumen" },
    ...(user.role === "administrator" || user.role === "admin"
      ? [{ key: "pin" as Tab, label: "PIN Orang Tua" }]
      : []),
  ];

  return (
    <ResponsiveContainer className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/students")}
            className="mt-1 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
              {student.full_name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-sm text-zinc-500 font-mono">
                NISN: {student.nisn}
              </span>
              <LifecycleBadge status={student.lifecycle_status || student.status || "active"} />
              {activeEnrollment && (
                <span className="text-xs text-zinc-400">
                  Kelas aktif: {enrollmentClassLabel(activeEnrollment)}
                </span>
              )}
            </div>
          </div>
        </div>
        {(user.role === "administrator" || user.role === "admin") && (
          <div className="flex items-center gap-2 ml-9 sm:ml-0 flex-wrap">
            {(() => {
              const currentStatus = (student.lifecycle_status || student.status || "active").toUpperCase();
              return (
                <>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="px-3.5 py-2 rounded-[12px] text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors outline-none cursor-pointer flex items-center gap-1.5">
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
                          <DropdownMenu.Item asChild>
                            <Link
                              href={`/students/${id}/edit`}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit Data
                            </Link>
                          </DropdownMenu.Item>
                        )}

                        {currentStatus === "ACTIVE" && (
                          <DropdownMenu.Item
                            onClick={() => {
                              setTargetStatus("INACTIVE");
                              setConfirmOpen(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Nonaktifkan
                          </DropdownMenu.Item>
                        )}

                        {currentStatus === "INACTIVE" && (
                          <>
                            <DropdownMenu.Item
                              onClick={() => {
                                setTargetStatus("ACTIVE");
                                setConfirmOpen(true);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Aktifkan
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => {
                                setTargetStatus("ARCHIVED");
                                setConfirmOpen(true);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Arsipkan
                            </DropdownMenu.Item>
                          </>
                        )}

                        {(currentStatus === "ARCHIVED" || currentStatus === "SOFT_DELETED") && (
                          <DropdownMenu.Item
                            onClick={() => {
                              setTargetStatus("ACTIVE");
                              setConfirmOpen(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-emerald-650 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 outline-none transition-colors cursor-pointer font-semibold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Pulihkan Siswa
                          </DropdownMenu.Item>
                        )}

                        {currentStatus === "ARCHIVED" && (
                          <DropdownMenu.Item
                            onClick={() => {
                              setTargetStatus("SOFT_DELETED");
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
                </>
              );
            })()}
          </div>
        )}
      </div>

      {(() => {
        const currentStatus = (student.lifecycle_status || student.status || "active").toUpperCase();
        return (
          <>
            {currentStatus === "ARCHIVED" && (
              <InfoBanner
                variant="warning"
                description="Data siswa ini berada dalam status diarsipkan. Seluruh data bersifat hanya baca (read-only) dan PIN orang tua telah dicabut."
              />
            )}
            {currentStatus === "SOFT_DELETED" && (
              <InfoBanner
                variant="error"
                description="Siswa ini berada di dalam tempat sampah (Soft Deleted). Harap pulihkan data sebelum melakukan modifikasi apapun."
              />
            )}
          </>
        );
      })()}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 -mt-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-[#468432] dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Profil ─────────────────────────────────────── */}
      {activeTab === "profil" && (
        <div className="space-y-4">
          <InfoSection title="Data Pribadi">
            <DataRow label="Nama Lengkap" value={student.full_name} />
            <DataRow label="NISN" value={student.nisn} sensitive />
            <DataRow label="NIK" value={student.nik} sensitive />
            <DataRow
              label="Tempat Lahir"
              value={student.birth_place}
            />
            <DataRow
              label="Tanggal Lahir"
              value={
                student.birth_date
                  ? new Date(student.birth_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : undefined
              }
            />
            <DataRow
              label="Jenis Kelamin"
              value={
                student.gender === "L"
                  ? "Laki-laki"
                  : student.gender === "P"
                  ? "Perempuan"
                  : undefined
              }
            />
            <DataRow label="Agama" value={student.religion} />
            <DataRow label="No. Telepon" value={student.phone} />
            <DataRow label="Afirmasi" value={student.affirmation} />
            <DataRow label="Kebutuhan Khusus" value={student.special_needs} />
            <DataRow
              label="Nominal SPP"
              value={
                student.spp_amount !== undefined && student.spp_amount !== null
                  ? new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(parseFloat(String(student.spp_amount)))
                  : "Menggunakan default sistem"
              }
            />
          </InfoSection>

          <InfoSection title="Data Keluarga">
            <DataRow
              label="No. Kartu Keluarga"
              value={student.family_card_number}
              sensitive
            />
            <DataRow
              label="Tgl. Kartu Keluarga"
              value={student.family_card_date}
            />
            <DataRow label="Nama Ibu" value={student.mother_name} />
            <DataRow label="NIK Ibu" value={student.mother_nik} sensitive />
            <DataRow label="Nama Ayah" value={student.father_name} />
            <DataRow label="NIK Ayah" value={student.father_nik} sensitive />
            <DataRow label="Nama Wali" value={student.guardian_name} />
            <DataRow label="NIK Wali" value={student.guardian_nik} sensitive />
          </InfoSection>

          <InfoSection title="Alamat">
            <DataRow label="Jalan" value={student.address_street} />
            <DataRow
              label="RT / RW"
              value={
                student.rt || student.rw
                  ? `RT ${student.rt || "-"} / RW ${student.rw || "-"}`
                  : undefined
              }
            />
            <DataRow label="Dusun" value={student.hamlet} />
            <DataRow label="Desa / Kelurahan" value={student.village} />
            <DataRow label="Kecamatan" value={student.district} />
            <DataRow label="Kab. / Kota" value={student.city} />
            <DataRow label="Provinsi" value={student.province} />
          </InfoSection>
        </div>
      )}

      {/* ── Tab: Enrollment ──────────────────────────────────── */}
      {activeTab === "enrollment" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Riwayat Kelas
            </h2>
            <button
              onClick={() => setShowEnrollModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] text-xs font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Tambah Riwayat Kelas
            </button>
          </div>

          {enrollments.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[20px]">
              Belum ada riwayat kelas untuk siswa ini.
            </div>
          ) : (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-5 py-3.5">Kelas</th>
                      <th className="px-5 py-3.5">Tahun Ajaran</th>
                      <th className="px-5 py-3.5">Semester</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 hidden md:table-cell">
                        Dibuat
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {enrollments.map((en) => (
                      <tr
                        key={en.id}
                        className="hover:bg-zinc-50/60 dark:hover:bg-[#262626]/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-zinc-700 dark:text-zinc-300">
                          {enrollmentClassLabel(en)}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500">
                          {en.academic_year_name?.trim() || "Tidak ditemukan"}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500">
                          {en.semester_name?.trim() || "Tidak ditemukan"}
                        </td>
                        <td className="px-5 py-3.5">
                          <EnrollmentStatusBadge status={en.status} />
                        </td>
                        <td className="px-5 py-3.5 text-xs text-zinc-400 hidden md:table-cell">
                          {en.created_at
                            ? new Date(en.created_at).toLocaleDateString(
                                "id-ID"
                              )
                            : "-"}
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

      {/* ── Tab: PIN ─────────────────────────────────────────── */}
      {activeTab === "pin" && (
        <div className="max-w-md">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Reset PIN Akses Orang Tua
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                PIN digunakan orang tua untuk mengakses portal perkembangan
                anak. PIN disimpan terenkripsi — tidak dapat dilihat kembali
                setelah disimpan.
              </p>
            </div>

            <InfoBanner variant="warning" description="Setelah reset berhasil, catat PIN dan sampaikan langsung kepada orang tua. Sistem tidak menyimpan PIN dalam bentuk asli." title="Perhatian" />

            <form onSubmit={handlePinReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  PIN Baru <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setPinSuccess(false);
                  }}
                  placeholder="4–8 digit angka"
                  autoComplete="new-password"
                  maxLength={8}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432] focus:bg-white dark:focus:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Konfirmasi PIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  placeholder="Ulangi PIN baru"
                  autoComplete="new-password"
                  maxLength={8}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432] focus:bg-white dark:focus:bg-zinc-900"
                />
              </div>

              {pinError && (
                <InfoBanner variant="error" description={pinError} />
              )}
              {pinSuccess && (
                <InfoBanner variant="success" description="PIN berhasil direset. Sampaikan PIN baru kepada orang tua secara langsung." />
              )}

              <button
                type="submit"
                disabled={pinLoading}
                className="w-full py-2.5 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pinLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Reset PIN"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "documents" && token && (
        <StudentFilesPanel
          studentId={id}
          token={token}
          user={user}
          mode={user.role === 'teacher' ? 'teacher' : 'admin'}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={
            targetStatus === "SOFT_DELETED"
              ? `Hapus permanen data siswa ${student.full_name}?`
              : targetStatus === "ACTIVE"
              ? `Aktifkan kembali akun siswa ${student.full_name}?`
              : targetStatus === "ARCHIVED"
              ? `Arsipkan data siswa ${student.full_name}?`
              : `Nonaktifkan akun siswa ${student.full_name}?`
          }
          description={
            targetStatus === "INACTIVE"
              ? "Siswa tidak akan dapat bertransaksi atau melakukan kegiatan akademik aktif sementara waktu."
              : targetStatus === "ARCHIVED"
              ? "Siswa akan dipindahkan ke arsip historis. Data riwayat akademik tetap disimpan secara permanen (read-only). PIN orang tua akan dicabut."
              : targetStatus === "ACTIVE"
              ? "Siswa akan dipulihkan kembali ke status aktif."
              : targetStatus === "SOFT_DELETED"
              ? "Siswa akan dipindahkan ke tempat sampah dan dapat dipulihkan kapan saja."
              : "Apakah Anda yakin ingin melanjutkan perubahan status data ini?"
          }
          confirmLabel={
            targetStatus === "SOFT_DELETED"
              ? "Ya, Hapus Permanen"
              : targetStatus === "ACTIVE"
              ? "Ya, Aktifkan"
              : targetStatus === "ARCHIVED"
              ? "Ya, Arsipkan"
              : "Ya, Nonaktifkan"
          }
          variant={targetStatus === "SOFT_DELETED" ? "destructive" : "default"}
          onConfirm={handleStatusChange}
        />
      )}

      <Dialog.Root open={showEnrollModal} onOpenChange={setShowEnrollModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <div>
                  <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-550">
                    Tambah Riwayat Kelas
                  </Dialog.Title>
                  <p className="text-xs text-zinc-500 mt-1">
                    Siswa: <strong>{student.full_name}</strong>
                  </p>
                </div>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <InfoBanner variant="warning" description="Hanya satu riwayat kelas berstatus Aktif yang diizinkan per semester." />

              <form onSubmit={handleCreateEnrollment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Tahun Ajaran <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={enrollYear}
                    onChange={(e) => {
                      setEnrollYear(e.target.value);
                      setEnrollSem("");
                    }}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
                  >
                    <option value="">Pilih tahun ajaran...</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Semester <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={enrollSem}
                    onChange={(e) => setEnrollSem(e.target.value)}
                    disabled={!enrollYear}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 disabled:opacity-50"
                  >
                    <option value="">
                      {enrollYear ? "Pilih semester..." : "Pilih tahun ajaran dulu"}
                    </option>
                    {filteredSemesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Kelas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={enrollClass}
                    onChange={(e) => setEnrollClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
                  >
                    <option value="">Pilih kelas...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Status Riwayat Kelas
                  </label>
                  <select
                    value={enrollStatus}
                    onChange={(e) =>
                      setEnrollStatus(e.target.value as EnrollmentStatus)
                    }
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
                  >
                    {ENROLLMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {enrollmentStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>

                {enrollError && (
                  <InfoBanner variant="error" description={enrollError} />
                )}

                <div className="flex gap-3 pt-2 justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={enrollLoading}
                      className="px-4 py-2 rounded-[12px] text-sm font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:text-zinc-100 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={enrollLoading}
                    className="px-4 py-2 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white transition-colors flex items-center gap-2 min-w-[80px] justify-center"
                  >
                    {enrollLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
