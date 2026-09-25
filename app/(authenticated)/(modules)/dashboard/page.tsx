"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { PageHeader, ErrorState } from "@/components/ui-states";
import { useExecutiveDashboardStats } from "@/hooks/useExecutiveDashboardStats";
import {
  getAdminDashboardAggregateApi,
  getTeacherDashboardAggregateApi,
  AdminDashboardAggregate,
  TeacherDashboardAggregate,
} from "@/lib/api/dashboard";
import {
  BarChart as ReChartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer as ReChartsResponsiveContainer,
  PieChart as ReChartsPieChart,
  Pie,
  Cell,
  LineChart as ReChartsLineChart,
  Line,
} from "recharts";
import {
  Users,
  GraduationCap,
  School,
  BookOpen,
  FileText,
  Upload,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ListTodo,
  FileDown,
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
} from "lucide-react";
import { PageContainer, PageSection } from "@/components/ui/page-framework";
import { Card, CardHeader } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import { ColumnLabel, CardTitle, NumericDisplay } from "@/components/ui/typography";

// Role translation helper
const formatRoleLabel = (role: string) => {
  switch (role) {
    case "administrator":
      return "administrator";
    case "admin":
      return "operator tata usaha";
    case "teacher":
    case "guru":
      return "guru pengajar";
    default:
      return role;
  }
};

// Format Integrity status helper
const formatIntegrityStatus = (statusStr: string) => {
  if (!statusStr) return "Pending";
  try {
    const parsed = JSON.parse(statusStr);
    if (parsed && typeof parsed === "object") {
      const label =
        parsed.status === "success"
          ? "Aman"
          : parsed.status === "warning"
          ? "Peringatan"
          : parsed.status === "danger"
          ? "Bahaya"
          : parsed.status;
      return `${label} (${parsed.data_issues || 0} Masalah Data, ${parsed.storage_issues || 0} Masalah Penyimpanan)`;
    }
  } catch {
    // Return raw string if not JSON
  }
  return statusStr;
};

// Color palettes for Recharts
const COLORS_PRIMARY = ["#468432", "#3A6F2B", "#65a30d", "#84cc16", "#a3e635"];

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { activeAcademicYear, activeSemester, loading: settingsLoading, error: settingsError } = useSettings();

  // General Loading & State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role Aggregate States
  const [adminData, setAdminData] = useState<AdminDashboardAggregate | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherDashboardAggregate | null>(null);

  // Executive Stats (used primarily by Admin/TU Operator)
  const {
    statsData,
    loading: statsLoading,
    fetchExecutiveStats,
  } = useExecutiveDashboardStats();

  useEffect(() => {
    if (!token || !user) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadDashboard = async () => {
      try {
        if (user.role === "administrator") {
          const res = await getAdminDashboardAggregateApi(token);
          if (isMounted) setAdminData(res);
        } else if (user.role === "teacher" || user.role === "guru") {
          const res = await getTeacherDashboardAggregateApi(token);
          if (isMounted) setTeacherData(res);
        } else if (user.role === "admin") {
          // TU Operator role uses executive stats
          await fetchExecutiveStats(token);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Dashboard fetch error:", err);
          setError(err?.message || "Gagal memuat ringkasan dashboard.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [token, user, fetchExecutiveStats]);

  // --- DATA QUALITY CHECKER (SECTION - OPERATOR) ---
  const studentsWithoutPinCount = statsData?.qualityStats?.studentsWithoutPinCount ?? 0;

  const dataQualityStats = useMemo(() => {
    if (!statsData?.qualityStats) {
      return {
        duplicateNIKCount: 0,
        duplicateNISNCount: 0,
        orphanStudentCount: 0,
        missingBirthdateCount: 0,
        hasQualityIssue: false,
      };
    }
    const { duplicateNIKCount, duplicateNISNCount, orphanStudentCount, missingBirthdateCount } = statsData.qualityStats;
    return {
      duplicateNIKCount,
      duplicateNISNCount,
      orphanStudentCount,
      missingBirthdateCount,
      hasQualityIssue: duplicateNIKCount > 0 || duplicateNISNCount > 0 || orphanStudentCount > 0,
    };
  }, [statsData]);

  // --- RENDERING LOADING SKELETON ---
  if (loading || settingsLoading) {
    return (
      <PageContainer>
        <PageHeader loading title="" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <KPICard key={i} loading title="" value="" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 h-60 bg-surface-2 rounded-2xl animate-pulse" />
          <div className="h-60 bg-surface-2 rounded-2xl animate-pulse" />
        </div>
      </PageContainer>
    );
  }

  if (error || settingsError) {
    return (
      <PageContainer maxWidth="4xl">
        <ErrorState
          title="Terjadi Kesalahan"
          message={error || settingsError || "Gagal memuat data dashboard."}
          onRetry={() => window.location.reload()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Dashboard ${formatRoleLabel(user?.role || "")}`}
        description={`Pusat kendali SIUBA • Selamat datang kembali, ${user?.name}.`}
      />

      {/* ========================================================================= */}
      {/* 1. ADMINISTRATOR EXECUTIVE DASHBOARD */}
      {/* ========================================================================= */}
      {user?.role === "administrator" && adminData && (
        <div className="space-y-6 animate-fadeIn">

          {/* SECTION 1: School Overview KPIs */}
          <PageSection>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard
                title="Siswa aktif"
                value={adminData.school_overview.total_students}
                subtitle="anak terdaftar"
                icon={<Users className="w-4 h-4" />}
              />
              <KPICard
                title="Guru aktif"
                value={adminData.school_overview.total_teachers}
                subtitle="pengajar"
                icon={<GraduationCap className="w-4 h-4" />}
              />
              <KPICard
                title="Kelas aktif"
                value={adminData.school_overview.total_classes}
                subtitle="rombongan belajar"
                icon={<School className="w-4 h-4" />}
              />
              <KPICard
                title="Tahun ajaran"
                value={adminData.context.active_academic_year?.name || "Belum Diatur"}
                variant="flat"
              />
              <KPICard
                title="Semester"
                value={adminData.context.active_semester ? `Semester ${adminData.context.active_semester.name}` : "Belum Diatur"}
                variant="flat"
              />
            </div>
          </PageSection>

          {/* SECTION 2: Operasional Hari Ini (Presensi Siswa & Presensi Guru) */}
          <PageSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Presensi Siswa Hari Ini */}
              <Card padding="md">
                <CardHeader
                  title="Presensi Siswa Hari Ini"
                  subtitle={`Tanggal: ${adminData.today.date} • ${adminData.today.student_attendance.submitted_classes} dari ${adminData.today.student_attendance.total_classes} kelas terkirim`}
                  bordered
                  action={
                    <Link
                      href="/student-attendance"
                      className="text-xs font-bold font-plus-jakarta text-brand-emerald-600 hover:text-brand-emerald-700 dark:text-brand-emerald-400 hover:underline"
                    >
                      Buka Presensi Siswa
                    </Link>
                  }
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-zinc-100 dark:border-zinc-800/30">
                    <div>
                      <ColumnLabel className="block">Tingkat Kehadiran Terkirim</ColumnLabel>
                      <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 block mt-0.5">
                        {adminData.today.student_attendance.attendance_rate !== null
                          ? `${adminData.today.student_attendance.attendance_rate}%`
                          : "Belum ada presensi"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold font-plus-jakarta text-zinc-600 dark:text-zinc-400 block">
                        {adminData.today.student_attendance.total_students_recorded} siswa tercatat
                      </span>
                      <span className={`text-[10px] font-bold font-plus-jakarta px-2 py-0.5 rounded-full inline-block mt-1 ${
                        adminData.today.student_attendance.unsubmitted_classes === 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      }`}>
                        {adminData.today.student_attendance.unsubmitted_classes === 0
                          ? "Semua kelas selesai"
                          : `${adminData.today.student_attendance.unsubmitted_classes} kelas belum kirim`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    <div className="p-2 bg-surface-2 rounded-lg border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Hadir</span>
                      <span className="text-sm font-bold font-fredoka text-emerald-600">{adminData.today.student_attendance.counts.hadir}</span>
                    </div>
                    <div className="p-2 bg-surface-2 rounded-lg border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Terlambat</span>
                      <span className="text-sm font-bold font-fredoka text-blue-500">{adminData.today.student_attendance.counts.terlambat}</span>
                    </div>
                    <div className="p-2 bg-surface-2 rounded-lg border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Sakit</span>
                      <span className="text-sm font-bold font-fredoka text-amber-500">{adminData.today.student_attendance.counts.sakit}</span>
                    </div>
                    <div className="p-2 bg-surface-2 rounded-lg border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Izin</span>
                      <span className="text-sm font-bold font-fredoka text-indigo-500">{adminData.today.student_attendance.counts.izin}</span>
                    </div>
                    <div className="p-2 bg-surface-2 rounded-lg border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Alpa</span>
                      <span className="text-sm font-bold font-fredoka text-red-500">{adminData.today.student_attendance.counts.alpa}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Presensi Guru Hari Ini */}
              <Card padding="md">
                <CardHeader
                  title="Presensi Guru Hari Ini"
                  subtitle={`Total guru aktif: ${adminData.today.teacher_attendance.total_teachers} orang`}
                  bordered
                  action={
                    <Link
                      href="/presence"
                      className="text-xs font-bold font-plus-jakarta text-brand-emerald-600 hover:text-brand-emerald-700 dark:text-brand-emerald-400 hover:underline"
                    >
                      Buka Rekap Kehadiran
                    </Link>
                  }
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-zinc-100 dark:border-zinc-800/30">
                    <div>
                      <ColumnLabel className="block">Rasio Kehadiran Guru Hari Ini</ColumnLabel>
                      <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 block mt-0.5">
                        {adminData.today.teacher_attendance.attendance_rate !== null
                          ? `${adminData.today.teacher_attendance.attendance_rate}%`
                          : "Belum ada data"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold font-plus-jakarta text-zinc-600 dark:text-zinc-400 block">
                        {adminData.today.teacher_attendance.present_count + adminData.today.teacher_attendance.late_count} dari {adminData.today.teacher_attendance.total_teachers} guru hadir
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-surface-2 rounded-xl border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Hadir Tepat Waktu</span>
                      <span className="text-base font-bold font-fredoka text-emerald-600 mt-0.5 block">{adminData.today.teacher_attendance.present_count}</span>
                    </div>
                    <div className="p-2.5 bg-surface-2 rounded-xl border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Terlambat</span>
                      <span className="text-base font-bold font-fredoka text-amber-500 mt-0.5 block">{adminData.today.teacher_attendance.late_count}</span>
                    </div>
                    <div className="p-2.5 bg-surface-2 rounded-xl border border-zinc-100 dark:border-zinc-800/20">
                      <span className="text-[10px] text-zinc-400 block font-plus-jakarta">Belum Presensi</span>
                      <span className="text-base font-bold font-fredoka text-zinc-500 mt-0.5 block">
                        {Math.max(
                          adminData.today.teacher_attendance.total_teachers -
                            (adminData.today.teacher_attendance.present_count + adminData.today.teacher_attendance.late_count),
                          0
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

            </div>
          </PageSection>

          {/* SECTION 3: Academic & Curriculum Completeness (Replacing Old Composite Health Score) */}
          <PageSection>
            <Card padding="lg">
              <CardHeader
                title="Kelengkapan Akademik &amp; Kurikulum"
                subtitle="Status komprehensif seluruh domain kurikulum aktif semester ini"
                bordered
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">

                {/* 1. Nilai Akademik */}
                <div className="p-3.5 bg-surface-2 rounded-2xl border border-zinc-100 dark:border-zinc-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <ColumnLabel>Nilai Akademik</ColumnLabel>
                      <Link href="/academic-scores" className="text-[10px] text-brand-emerald-600 hover:underline font-bold">Detail</Link>
                    </div>
                    <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                      {adminData.academic_completeness.academic_scores.completion_percent !== null
                        ? `${adminData.academic_completeness.academic_scores.completion_percent}%`
                        : "-"}
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {adminData.academic_completeness.academic_scores.final} final dari {adminData.academic_completeness.academic_scores.total_targets} target
                    </p>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${adminData.academic_completeness.academic_scores.completion_percent ?? 0}%` }} />
                  </div>
                </div>

                {/* 2. Jurnal Budaya SAHABAT */}
                <div className="p-3.5 bg-surface-2 rounded-2xl border border-zinc-100 dark:border-zinc-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <ColumnLabel>Budaya SAHABAT</ColumnLabel>
                      <Link href="/daily-culture" className="text-[10px] text-brand-emerald-600 hover:underline font-bold">Detail</Link>
                    </div>
                    <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                      {adminData.academic_completeness.culture.completion_percent}%
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {adminData.academic_completeness.culture.lengkap} kelas lengkap dari {adminData.academic_completeness.culture.total_classes} rombel
                    </p>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${adminData.academic_completeness.culture.completion_percent}%` }} />
                  </div>
                </div>

                {/* 3. Dokumen KKTP */}
                <div className="p-3.5 bg-surface-2 rounded-2xl border border-zinc-100 dark:border-zinc-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <ColumnLabel>Dokumen KKTP</ColumnLabel>
                      <Link href="/kktp" className="text-[10px] text-brand-emerald-600 hover:underline font-bold">Detail</Link>
                    </div>
                    <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                      {adminData.academic_completeness.kktp.students_with_kktp} <span className="text-xs font-normal text-zinc-500">siswa</span>
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {adminData.academic_completeness.kktp.completion_percent}% siswa memiliki dokumen KKTP
                    </p>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${adminData.academic_completeness.kktp.completion_percent}%` }} />
                  </div>
                </div>

                {/* 4. Dokumen RPM */}
                <div className="p-3.5 bg-surface-2 rounded-2xl border border-zinc-100 dark:border-zinc-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <ColumnLabel>Dokumen RPM</ColumnLabel>
                      <Link href="/rpm" className="text-[10px] text-brand-emerald-600 hover:underline font-bold">Detail</Link>
                    </div>
                    <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                      {adminData.academic_completeness.rpm.total_documents} <span className="text-xs font-normal text-zinc-500">dokumen</span>
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Tersedia dalam repositori RPM</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full inline-block self-start mt-2">
                    Aktif
                  </span>
                </div>

                {/* 5. Alur Trisula */}
                <div className="p-3.5 bg-surface-2 rounded-2xl border border-zinc-100 dark:border-zinc-800/30 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <ColumnLabel>Alur Trisula</ColumnLabel>
                      <Link href="/trisula" className="text-[10px] text-brand-emerald-600 hover:underline font-bold">Detail</Link>
                    </div>
                    <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                      {adminData.academic_completeness.trisula.total_assessments} <span className="text-xs font-normal text-zinc-500">evaluasi</span>
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {adminData.academic_completeness.trisula.finalized_count} Final • {adminData.academic_completeness.trisula.draft_count} Draf
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full inline-block self-start mt-2">
                    {adminData.academic_completeness.trisula.in_progress_count > 0 ? "Proses Pengisian" : "Stabil"}
                  </span>
                </div>

              </div>
            </Card>
          </PageSection>

          {/* SECTION 4: Actionable Alerts */}
          {adminData.actionable_alerts.length > 0 && (
            <PageSection>
              <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/80 dark:border-amber-900/30 p-5 rounded-2xl space-y-3 animate-fadeIn">
                <ColumnLabel className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Pemberitahuan Operasional Penting
                </ColumnLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminData.actionable_alerts.map((alert) => (
                    <Card key={alert.id} variant="flat" padding="sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1" aria-hidden="true" />
                          <div>
                            <ColumnLabel className="text-amber-600 dark:text-amber-400 block">{alert.category}</ColumnLabel>
                            <CardTitle className="mt-0.5">{alert.title}</CardTitle>
                            <p className="text-[10px] font-plus-jakarta text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                              {alert.description}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={alert.action_href}
                          className="shrink-0 px-2.5 py-1 text-[10px] font-bold font-plus-jakarta text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/30 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          Tinjau
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </PageSection>
          )}

          {/* SECTION 5: Administrator Quick Actions */}
          <PageSection>
            <Card padding="md">
              <CardHeader title="Aksi Cepat Administrator" bordered />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Link
                  href="/student-attendance"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                  <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Presensi Siswa</span>
                </Link>
                <Link
                  href="/students"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                  <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Registrasi Siswa</span>
                </Link>
                <Link
                  href="/import"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                  <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Impor Data Excel</span>
                </Link>
                <Link
                  href="/academic-scores"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                  <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Rekap Nilai</span>
                </Link>
                <Link
                  href="/export"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                  <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Unduh / Export</span>
                </Link>
              </div>
            </Card>
          </PageSection>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OPERATOR ADMINISTRASI DASHBOARD (TU BRANCH PRESERVED) */}
      {/* ========================================================================= */}
      {user?.role === "admin" && (
        <div className="space-y-6 animate-fadeIn">

          {/* SECTION 1: Summary KPIs */}
          <PageSection>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard
                title="Siswa terdaftar"
                value={statsData?.total_students ?? 0}
                loading={statsLoading}
                icon={<Users className="w-4 h-4" />}
              />
              <KPICard
                title="Total guru"
                value={statsData?.total_teachers ?? 0}
                loading={statsLoading}
                icon={<GraduationCap className="w-4 h-4" />}
              />
              <KPICard
                title="Total kelas"
                value={statsData?.total_classes ?? 0}
                loading={statsLoading}
                icon={<School className="w-4 h-4" />}
              />
              <KPICard
                title="Kelengkapan berkas"
                value={statsData ? `${statsData.docCompletionRate}%` : "..."}
                loading={statsLoading}
                icon={<FileText className="w-4 h-4" />}
                variant="flat"
              />
              <KPICard
                title="Rasio pelunasan SPP"
                value={statsData ? `${statsData.sppCompletionRate}%` : "..."}
                loading={statsLoading}
                variant="flat"
              />
            </div>
          </PageSection>

          {/* SECTION 2: Today's Tasks */}
          <PageSection>
            <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/30 p-5 rounded-2xl space-y-3">
              <ColumnLabel className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4" aria-hidden="true" />
                Tugas harian operator (hari ini)
              </ColumnLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card variant="flat" padding="sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Siswa belum terdaftar kelas</CardTitle>
                      <p className="text-[10px] font-plus-jakarta text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Terdapat {statsData?.qualityStats?.orphanStudentCount ?? 0} siswa belum terdaftar di kelas manapun.
                      </p>
                    </div>
                    <Link
                      href="/students"
                      className="shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] font-plus-jakarta rounded-lg cursor-pointer transition-colors"
                    >
                      Atur
                    </Link>
                  </div>
                </Card>
                <Card variant="flat" padding="sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>PIN portal orang tua belum dibuat</CardTitle>
                      <p className="text-[10px] font-plus-jakarta text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {studentsWithoutPinCount > 0
                          ? `Terdapat ${studentsWithoutPinCount} anak didik aktif belum memiliki PIN akses portal wali.`
                          : "Semua wali murid dari anak didik aktif telah memiliki PIN portal."}
                      </p>
                    </div>
                    <Link
                      href="/students"
                      className="shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] font-plus-jakarta rounded-lg cursor-pointer transition-colors"
                    >
                      Buat PIN
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </PageSection>

          {/* SECTION 3 & 4: Document & SPP Analytics */}
          <PageSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Document Completion */}
              <Card padding="lg">
                <CardHeader title="Rasio kelengkapan berkas siswa" bordered />
                <div className="h-60">
                  {!statsData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-brand-emerald-600 animate-spin" aria-hidden="true" />
                      <span className="text-[10px] font-plus-jakarta text-zinc-400">Memperbarui rasio berkas...</span>
                    </div>
                  ) : (
                    <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ReChartsPieChart>
                        <Pie data={statsData.docPieChartData} cx="50%" cy="50%" outerRadius={70} fill="#8884d8" dataKey="value" label>
                          {COLORS_PRIMARY.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_PRIMARY[index % COLORS_PRIMARY.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 10 }} />
                      </ReChartsPieChart>
                    </ReChartsResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* SPP Overview */}
              <Card padding="lg">
                <CardHeader title="Grafik aliran SPP semester berjalan" bordered />
                <div className="h-60">
                  {!statsData ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" aria-hidden="true" />
                      <span className="text-[10px] font-plus-jakarta text-zinc-400">Memperbarui aliran SPP...</span>
                    </div>
                  ) : (
                    <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ReChartsLineChart data={statsData.sppChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" fontSize={10} tickLine={false} />
                        <YAxis fontSize={10} tickLine={false} tickFormatter={(val) => `${val}%`} />
                        <Tooltip formatter={(value) => [`${value}%`, undefined]} />
                        <Legend />
                        <Line type="monotone" dataKey="Lunas" stroke="#468432" strokeWidth={2} />
                        <Line type="monotone" dataKey="Belum" stroke="#ef4444" strokeWidth={2} />
                      </ReChartsLineChart>
                    </ReChartsResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          </PageSection>

          {/* SECTION 5 & 6: Data Quality Diagnostic */}
          <PageSection>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card padding="lg">
                <CardHeader title="Kualitas data &amp; integritas basis data" bordered />
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-plus-jakarta text-zinc-500 font-medium">Duplikasi NIK siswa</span>
                    <NumericDisplay className={`font-bold ${dataQualityStats.duplicateNIKCount > 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {dataQualityStats.duplicateNIKCount} temuan
                    </NumericDisplay>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-plus-jakarta text-zinc-500 font-medium">Duplikasi NISN</span>
                    <NumericDisplay className={`font-bold ${dataQualityStats.duplicateNISNCount > 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {dataQualityStats.duplicateNISNCount} temuan
                    </NumericDisplay>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-plus-jakarta text-zinc-500 font-medium">Siswa tanpa kelas</span>
                    <NumericDisplay className={`font-bold ${dataQualityStats.orphanStudentCount > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                      {dataQualityStats.orphanStudentCount} anak
                    </NumericDisplay>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-plus-jakarta text-zinc-500 font-medium">Tanggal lahir kosong</span>
                    <NumericDisplay className={`font-bold ${dataQualityStats.missingBirthdateCount > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                      {dataQualityStats.missingBirthdateCount} anak
                    </NumericDisplay>
                  </div>
                </div>
              </Card>

              {/* Sync & Backup status */}
              <div className="lg:col-span-2">
                <Card padding="lg">
                  <CardHeader title="Riwayat sinkronisasi &amp; backup database" bordered />
                  <div className="space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 gap-2">
                      <div>
                        <span className="font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-400 block">Google Sheets backup terjadwal</span>
                        <span className="text-[10px] font-plus-jakarta text-zinc-400 mt-0.5">Status: {statsData?.lastBackupStatus || "Pending"}</span>
                      </div>
                      <NumericDisplay className="text-[10px] text-zinc-500 self-start sm:self-center">
                        {statsData?.lastBackupTime || "..."}
                      </NumericDisplay>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 gap-2">
                      <div>
                        <span className="font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-400 block">Pengecekan integritas sistem</span>
                        <span className="text-[10px] font-plus-jakarta text-zinc-400 mt-0.5 break-all sm:break-normal">
                          Status: {formatIntegrityStatus(statsData?.lastIntegrityCheckStatus || "Pending")}
                        </span>
                      </div>
                      <NumericDisplay className="text-[10px] text-zinc-500 self-start sm:self-center">
                        {statsData?.lastIntegrityCheckTime || "..."}
                      </NumericDisplay>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-4">
                    <Link
                      href="/students"
                      className="flex items-center justify-center gap-1 bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white p-2.5 rounded-xl text-xs font-bold font-plus-jakarta transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Siswa baru
                    </Link>
                    <Link
                      href="/import"
                      className="flex items-center justify-center gap-1 bg-surface-2 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 p-2.5 rounded-xl text-xs font-bold font-plus-jakarta transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Impor Excel
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </PageSection>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GURU PERSONAL DASHBOARD (REAL HARI INI WORK CENTER) */}
      {/* ========================================================================= */}
      {(user?.role === "teacher" || user?.role === "guru") && teacherData && (
        <div className="space-y-6 animate-fadeIn">

          {/* SECTION 1: Hero & Context */}
          <PageSection>
            <Card padding="lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-plus-jakarta bg-brand-emerald-50 text-brand-emerald-600 dark:bg-brand-emerald-950/40 dark:text-brand-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald-600 animate-pulse" aria-hidden="true" />
                      Guru Pengajar
                    </span>
                    {teacherData.context.perwalian_class && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-plus-jakarta bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        Wali Kelas: {teacherData.context.perwalian_class.class_name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-2">
                    Selamat datang kembali, {teacherData.context.teacher_name}
                  </h3>
                  <NumericDisplay className="text-zinc-500 text-xs mt-0.5 block">{teacherData.context.teacher_email}</NumericDisplay>
                </div>
                <div className="flex gap-4 border-t md:border-t-0 md:border-l border-zinc-100 dark:border-zinc-800 pt-4 md:pt-0 md:pl-6">
                  <div>
                    <ColumnLabel className="block">Tahun ajaran</ColumnLabel>
                    <span className="font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200 block mt-1 text-sm">
                      {teacherData.context.active_academic_year?.name || "-"}
                    </span>
                  </div>
                  <div>
                    <ColumnLabel className="block">Semester</ColumnLabel>
                    <span className="font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200 block mt-1 text-sm">
                      {teacherData.context.active_semester ? `Semester ${teacherData.context.active_semester.name}` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </PageSection>

          {/* SECTION 2: Operational Work "Hari Ini" (Presensi Siswa, Presensi Mandiri, Budaya) */}
          <PageSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* 1. Presensi Kelas Perwalian */}
              <Card padding="md">
                <CardHeader
                  title="Presensi Kelas Hari Ini"
                  subtitle={teacherData.context.perwalian_class ? `Kelas: ${teacherData.context.perwalian_class.class_name}` : "Bukan Wali Kelas"}
                  bordered
                />
                <div className="space-y-3">
                  {teacherData.context.perwalian_class ? (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-zinc-100 dark:border-zinc-800/30">
                        <div>
                          <ColumnLabel className="block">Status Pengiriman</ColumnLabel>
                          <span className={`text-xs font-bold font-plus-jakarta mt-1 inline-block px-2.5 py-0.5 rounded-full ${
                            teacherData.today.student_attendance.is_submitted
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                          }`}>
                            {teacherData.today.student_attendance.is_submitted ? "SUDAH DIKIRIM" : "BELUM DIKIRIM"}
                          </span>
                        </div>
                        {teacherData.today.student_attendance.counts && (
                          <div className="text-right text-[10px] text-zinc-500 font-plus-jakarta">
                            H:{teacherData.today.student_attendance.counts.hadir} • T:{teacherData.today.student_attendance.counts.terlambat} • S:{teacherData.today.student_attendance.counts.sakit} • I:{teacherData.today.student_attendance.counts.izin} • A:{teacherData.today.student_attendance.counts.alpa}
                          </div>
                        )}
                      </div>
                      <Link
                        href="/student-attendance"
                        className="flex items-center justify-center gap-1.5 w-full p-2.5 rounded-xl bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white text-xs font-bold font-plus-jakarta transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Buka Presensi Kelas
                      </Link>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-zinc-400 font-plus-jakarta italic">Anda tidak memiliki rombel perwalian aktif.</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* 2. Presensi Mandiri Guru (GPS Presence) */}
              <Card padding="md">
                <CardHeader
                  title="Presensi Mandiri Guru"
                  subtitle={`Tanggal: ${teacherData.today.date}`}
                  bordered
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-zinc-100 dark:border-zinc-800/30">
                    <div>
                      <ColumnLabel className="block">Status Kehadiran Anda</ColumnLabel>
                      <span className={`text-xs font-bold font-plus-jakarta mt-1 inline-block px-2.5 py-0.5 rounded-full ${
                        teacherData.today.teacher_attendance.status === "present"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : teacherData.today.teacher_attendance.status === "late"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {teacherData.today.teacher_attendance.status === "present"
                          ? "Hadir Tepat Waktu"
                          : teacherData.today.teacher_attendance.status === "late"
                          ? "Terlambat"
                          : "Belum Presensi"}
                      </span>
                    </div>
                    {teacherData.today.teacher_attendance.time_in && (
                      <span className="text-xs font-bold font-fredoka text-zinc-800 dark:text-zinc-200">
                        {teacherData.today.teacher_attendance.time_in}
                      </span>
                    )}
                  </div>
                  <Link
                    href="/presence"
                    className="flex items-center justify-center gap-1.5 w-full p-2.5 rounded-xl bg-surface-2 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 text-xs font-bold font-plus-jakarta transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-brand-emerald-600" /> Buka Presensi Mandiri
                  </Link>
                </div>
              </Card>

              {/* 3. Jurnal Budaya SAHABAT */}
              <Card padding="md">
                <CardHeader
                  title="Jurnal Budaya SAHABAT"
                  subtitle={teacherData.context.perwalian_class ? `Kelas: ${teacherData.context.perwalian_class.class_name}` : "Rekap Budaya"}
                  bordered
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-zinc-100 dark:border-zinc-800/30">
                    <div>
                      <ColumnLabel className="block">Cakupan Rekap Kelas</ColumnLabel>
                      <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 block mt-0.5">
                        {teacherData.today.culture?.coverage_percent ?? 0}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 font-plus-jakarta block">
                        {teacherData.today.culture?.weeks_recorded ?? 0} pekan tercatat
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/daily-culture"
                    className="flex items-center justify-center gap-1.5 w-full p-2.5 rounded-xl bg-surface-2 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 text-xs font-bold font-plus-jakarta transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Buka Jurnal Budaya
                  </Link>
                </div>
              </Card>

            </div>
          </PageSection>

          {/* SECTION 3: Pending Work (Tugas Mengajar & Dokumen Tertunda) */}
          <PageSection>
            <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/30 p-5 rounded-2xl space-y-3">
              <ColumnLabel className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4" aria-hidden="true" />
                Tugas Mengajar &amp; Dokumen Berjalan
              </ColumnLabel>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                {/* 1. Draf Penilaian */}
                <Link
                  href="/academic-scores"
                  className="p-3.5 bg-surface-1 rounded-2xl border border-amber-100 dark:border-amber-950/20 shadow-sm flex flex-col justify-between hover:border-amber-500 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <ColumnLabel className="text-amber-700 dark:text-amber-400">Akademik</ColumnLabel>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <CardTitle className="mt-1">Draf Penilaian</CardTitle>
                  <span className="text-lg font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                    {teacherData.pending_work.draft_assessments_count} <span className="text-xs font-normal text-zinc-500">belum dikunci</span>
                  </span>
                </Link>

                {/* 2. KKTP Belum Dibuat */}
                <Link
                  href="/kktp"
                  className="p-3.5 bg-surface-1 rounded-2xl border border-amber-100 dark:border-amber-950/20 shadow-sm flex flex-col justify-between hover:border-amber-500 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <ColumnLabel className="text-amber-700 dark:text-amber-400">Dokumen KKTP</ColumnLabel>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <CardTitle className="mt-1">KKTP Belum Selesai</CardTitle>
                  <span className="text-lg font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                    {teacherData.pending_work.kktp_pending_count} <span className="text-xs font-normal text-zinc-500">siswa perlu dibuat</span>
                  </span>
                </Link>

                {/* 3. RPM Tersedia */}
                <Link
                  href="/rpm"
                  className="p-3.5 bg-surface-1 rounded-2xl border border-amber-100 dark:border-amber-950/20 shadow-sm flex flex-col justify-between hover:border-amber-500 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <ColumnLabel className="text-amber-700 dark:text-amber-400">Dokumen RPM</ColumnLabel>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <CardTitle className="mt-1">Repositori RPM</CardTitle>
                  <span className="text-lg font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                    {teacherData.pending_work.rpm_count} <span className="text-xs font-normal text-zinc-500">dokumen dibuat</span>
                  </span>
                </Link>

                {/* 4. Trisula */}
                <Link
                  href="/trisula"
                  className="p-3.5 bg-surface-1 rounded-2xl border border-amber-100 dark:border-amber-950/20 shadow-sm flex flex-col justify-between hover:border-amber-500 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <ColumnLabel className="text-amber-700 dark:text-amber-400">Trisula</ColumnLabel>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <CardTitle className="mt-1">Asesmen Berjalan</CardTitle>
                  <span className="text-lg font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-1 block">
                    {teacherData.pending_work.trisula_draft_count} <span className="text-xs font-normal text-zinc-500">perlu dilengkapi</span>
                  </span>
                </Link>

              </div>
            </div>
          </PageSection>

          {/* SECTION 4: Class Overview (Homeroom Class Health) */}
          {teacherData.class_overview && (
            <PageSection>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* KPIs Perwalian */}
                <Card padding="lg">
                  <CardHeader title="Perkembangan Kelas Perwalian" bordered />
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-plus-jakarta text-zinc-500 font-medium">Ketuntasan Nilai Akademik</span>
                        <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">
                          {teacherData.class_overview.completed_evaluations} dari {teacherData.class_overview.total_evaluations} ({teacherData.class_overview.academic_progress_percent}%)
                        </NumericDisplay>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${teacherData.class_overview.academic_progress_percent}%` }} />
                      </div>
                    </div>

                    <div className="p-3 bg-surface-2 rounded-xl border border-zinc-100 dark:border-zinc-800/30">
                      <ColumnLabel className="block">Rata-rata Kehadiran Semester Ini</ColumnLabel>
                      <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 block mt-0.5">
                        {teacherData.class_overview.attendance_rate !== null
                          ? `${teacherData.class_overview.attendance_rate}%`
                          : "Belum ada data presensi"}
                      </span>
                    </div>

                    <div className="p-3 bg-surface-2 rounded-xl border border-zinc-100 dark:border-zinc-800/30">
                      <ColumnLabel className="block">Jumlah Siswa Terdaftar</ColumnLabel>
                      <span className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 block mt-0.5">
                        {teacherData.class_overview.student_count} anak didik
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Grade Distribution Bar Chart */}
                <div className="lg:col-span-2">
                  <Card padding="lg">
                    <CardHeader title="Distribusi Nilai Rata-rata Kelas Perwalian" bordered />
                    <div className="h-64">
                      <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <ReChartsBarChart data={teacherData.class_overview.grade_distribution}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" fontSize={10} tickLine={false} />
                          <YAxis fontSize={10} tickLine={false} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#468432" radius={[6, 6, 0, 0]} />
                        </ReChartsBarChart>
                      </ReChartsResponsiveContainer>
                    </div>
                  </Card>
                </div>

              </div>
            </PageSection>
          )}

          {/* SECTION 5: Teacher Quick Actions */}
          <PageSection>
            <Card padding="md">
              <CardHeader title="Aksi Cepat Guru" bordered />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Link
                  href="/student-attendance"
                  className="flex items-center justify-center p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white transition-all text-xs font-bold font-plus-jakarta"
                >
                  Presensi Kelas
                </Link>
                <Link
                  href="/academic-scores"
                  className="flex items-center justify-center p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white transition-all text-xs font-bold font-plus-jakarta"
                >
                  Input Nilai
                </Link>
                <Link
                  href="/daily-culture"
                  className="flex items-center justify-center p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white transition-all text-xs font-bold font-plus-jakarta"
                >
                  Input Karakter
                </Link>
                <Link
                  href="/kktp"
                  className="flex items-center justify-center p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white transition-all text-xs font-bold font-plus-jakarta"
                >
                  Dokumen KKTP
                </Link>
                <Link
                  href="/rpm"
                  className="flex items-center justify-center p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white transition-all text-xs font-bold font-plus-jakarta"
                >
                  Dokumen RPM
                </Link>
                <Link
                  href="/my-class"
                  className="flex items-center justify-center p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white transition-all text-xs font-bold font-plus-jakarta"
                >
                  Catatan Wali
                </Link>
              </div>
            </Card>
          </PageSection>

        </div>
      )}
    </PageContainer>
  );
}
