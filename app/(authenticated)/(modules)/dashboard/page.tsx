"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { apiRequest } from "@/lib/api/client";
import { PageHeader, ErrorState } from "@/components/ui-states";
import { searchAuditLogs, AuditLog } from "@/lib/api/audit-logs";
import { listStudents, listStudentsByClass, StudentRecord, StudentSummary } from "@/lib/api/students";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import { listAcademicAssessments, AcademicAssessment, getClassAcademicSummary, ClassAcademicSummary } from "@/lib/api/academic";
import { listUsersApi, UserWithProfile } from "@/lib/api/users";
import { listStudentEnrollments, EnrollmentRecord } from "@/lib/api/enrollments";
import { getTeacherCultureCompleteness, TeacherCultureCompletenessResponse } from "@/lib/api/culture";
import { useMonitoringData } from "@/hooks/useMonitoringData";
import { useExecutiveDashboardStats } from "@/hooks/useExecutiveDashboardStats";
import { AcademicMonitoringDialog, CultureMonitoringDialog } from "@/components/dashboard/MonitoringDialogs";
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
  RadarChart as ReChartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart as ReChartsLineChart,
  Line
} from "recharts";
import {
  Users,
  GraduationCap,
  School,
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  ShieldCheck,
  Plus,
  Upload,
  UserPlus,
  Database,
  UserCog,
  Heart,
  PieChart as LucidePieChart,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  Award,
  Zap,
  ListTodo,
  FileDown,
  ChevronRight,
  DollarSign,
  Loader2
} from "lucide-react";
import { PageContainer, PageSection } from "@/components/ui/page-framework";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import { ColumnLabel, CardTitle, NumericDisplay } from "@/components/ui/typography";

// Global Date Formatter
const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return dateStr;
  }
};

// Format Integrity status helper
const formatIntegrityStatus = (statusStr: string) => {
  if (!statusStr) return "Pending";
  try {
    const parsed = JSON.parse(statusStr);
    if (parsed && typeof parsed === "object") {
      const label = parsed.status === "success"
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


// Role translation helper
const formatRoleLabel = (role: string) => {
  switch (role) {
    case "administrator":
      return "administrator";
    case "admin":
      return "operator tata usaha";
    case "teacher":
      return "guru pengajar";
    default:
      return role;
  }
};

// Health status badge coloring helper
const getHealthColorClass = (category: string) => {
  switch (category) {
    case "Sangat Baik": return "text-emerald-600 dark:text-emerald-400";
    case "Baik": return "text-blue-600 dark:text-blue-400";
    case "Perlu Perhatian": return "text-amber-600 dark:text-amber-400";
    case "Kritis": return "text-red-600 dark:text-red-400";
    default: return "text-zinc-500";
  }
};

// Color palettes for Recharts
const COLORS_PRIMARY = ["#468432", "#3A6F2B", "#65a30d", "#84cc16", "#a3e635"];
const COLORS_HEALTH = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"]; // Sangat Kurang, Kurang, Baik, Sangat Baik
const COLORS_FITRAH = ["#e11d48", "#ea580c", "#d97706", "#059669", "#2563eb", "#7c3aed"]; // F, I, T, R, A, H

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { activeAcademicYear, activeSemester, loading: settingsLoading, error: settingsError } = useSettings();

  // General Loading & State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw Database States (Admin/Operator)
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<UserWithProfile[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Teacher specific state
  const [myClasses, setMyClasses] = useState<MyClassAssignment[]>([]);
  const [teacherStudents, setTeacherStudents] = useState<StudentSummary[]>([]);
  const [teacherAssessments, setTeacherAssessments] = useState<AcademicAssessment[]>([]);
  const [teacherCulture, setTeacherCulture] = useState<TeacherCultureCompletenessResponse | null>(null);
  const [teacherAcademicSummary, setTeacherAcademicSummary] = useState<ClassAcademicSummary | null>(null);

  // Monitoring states (Admin/Operator)
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [isCultureModalOpen, setIsCultureModalOpen] = useState(false);

  const {
    loading: monitoringLoading,
    error: monitoringError,
    academicData,
    cultureData,
    fetchMonitoringData
  } = useMonitoringData();

  const {
    statsData,
    loading: statsLoading,
    fetchExecutiveStats
  } = useExecutiveDashboardStats();

  const handleOpenAcademicMonitoring = () => {
    setIsAcademicModalOpen(true);
    if (token) {
      fetchMonitoringData(
        token,
        assessments,
        activeAcademicYear?.id,
        activeSemester?.id
      );
    }
  };

  const handleOpenCultureMonitoring = () => {
    setIsCultureModalOpen(true);
    if (token) {
      fetchMonitoringData(
        token,
        assessments,
        activeAcademicYear?.id,
        activeSemester?.id
      );
    }
  };

  // Load monitoring & executive stats on mount for admin/operator roles
  useEffect(() => {
    if (token && (user?.role === "administrator" || user?.role === "admin")) {
      fetchExecutiveStats(token);
      if (assessments.length > 0) {
        fetchMonitoringData(
          token,
          assessments,
          activeAcademicYear?.id,
          activeSemester?.id
        );
      }
    }
  }, [token, user, assessments, activeAcademicYear, activeSemester, fetchMonitoringData, fetchExecutiveStats]);

  // Real stats calculated from useMonitoringData
  // Real stats resolved from statsData (orchestrated in dashboardService)
  const realAcademicStats = useMemo(() => {
    if (!statsData?.academicStatusStats) {
      return {
        final: 0,
        belumIsi: 0,
        belumFinal: 0,
        loading: true
      };
    }
    const { final, belumFinal, belumIsi } = statsData.academicStatusStats;
    return { final, belumIsi, belumFinal, loading: false };
  }, [statsData]);

  const realCultureStats = useMemo(() => {
    if (!statsData?.cultureStatusStats) {
      return {
        lengkap: 0,
        sebagian: 0,
        kosong: 0,
        loading: true
      };
    }
    const { lengkap, sebagian, kosong } = statsData.cultureStatusStats;
    const total = (lengkap + sebagian + kosong) || 1;

    return {
      lengkap: Math.round((lengkap / total) * 100),
      sebagian: Math.round((sebagian / total) * 100),
      kosong: Math.round((kosong / total) * 100),
      loading: false
    };
  }, [statsData]);

  // Translators for human-centered audit logs
  const formatAuditAction = (action: string) => {
    switch (action) {
      case "login": return "Login";
      case "logout": return "Logout";
      case "staff_session_created": return "Memulai Sesi Baru";
      case "staff_session_rejected": return "Sesi Ditolak/Kedaluwarsa";
      case "create_record": return "Menambahkan Data Baru";
      case "update_record": return "Memperbarui Data";
      case "delete_record": return "Menghapus Data";
      default: return action.replace(/_/g, " ");
    }
  };

  const formatAuditDescription = (desc: string, action: string) => {
    if (!desc) return "";
    let formatted = desc;
    if (formatted === "User logged in successfully.") {
      return "Berhasil masuk ke dalam sistem.";
    }
    if (formatted.startsWith("Created new record in")) {
      const table = formatted.split("in ")[1]?.replace(".", "") || "tabel";
      return `Berhasil menambahkan data baru pada tabel ${table}.`;
    }
    if (formatted.startsWith("Updated record in")) {
      const table = formatted.split("in ")[1]?.replace(".", "") || "tabel";
      return `Berhasil memperbarui data pada tabel ${table}.`;
    }
    if (formatted.startsWith("Deleted record in")) {
      const table = formatted.split("in ")[1]?.replace(".", "") || "tabel";
      return `Berhasil menghapus data pada tabel ${table}.`;
    }
    if (formatted.startsWith("Staff session to") && formatted.includes("issued")) {
      return "Sesi akses staf berhasil diterbitkan.";
    }
    if (formatted.startsWith("Staff session to") && formatted.includes("rejected")) {
      const reason = formatted.split("rejected: ")[1] || "";
      const reasonIndo = reason === "expired_token" ? "token kedaluwarsa" : reason;
      return `Sesi akses staf ditolak (${reasonIndo}).`;
    }
    return formatted;
  };

  // Fetch all existing data in parallel depending on the user's role
  useEffect(() => {
    if (!token || !user) return;

    setLoading(true);
    setError(null);

    const promises: Promise<any>[] = [];

    // Core sets needed for analytics
    promises.push(
      apiRequest<any[]>("list_classes", { limit: 1000 }, token).then(setClasses).catch(() => {})
    );
    promises.push(
      apiRequest<any[]>("list_subjects", { limit: 1000 }, token).then(setSubjects).catch(() => {})
    );
    promises.push(
      listStudents(token, { limit: 1000 }).then(r => setStudents(r.data)).catch(() => {})
    );
    promises.push(
      listStudentEnrollments(token, { limit: 1000 }).then(setEnrollments).catch(() => {})
    );

    if (user.role === "administrator" || user.role === "admin") {
      promises.push(
        listUsersApi(token, { limit: 1000 }).then((res) => setTeachers(res.filter((u) => u.role === "teacher"))).catch(() => {})
      );
      promises.push(
        searchAuditLogs(token, { page: 1, page_size: 10 }).then((res) => setAuditLogs(res.logs || [])).catch(() => {})
      );
      promises.push(
        listAcademicAssessments(token, { limit: 1000 }).then(setAssessments).catch(() => {})
      );
    }

    if (user.role === "teacher") {
      // Lazy load teacher perwalian class details
      promises.push(
        getMyClasses(token).then(async (assignedClasses) => {
          setMyClasses(assignedClasses);
          if (assignedClasses.length > 0) {
            const primaryClass = assignedClasses[0];

            // Parallel fetch teacher class data with correct 4 arguments
            await Promise.all([
              listStudentsByClass(primaryClass.class_id, primaryClass.academic_year_id, primaryClass.semester_id, token, 1000)
                .then(setTeacherStudents).catch(() => {}),
              listAcademicAssessments(token, { class_id: primaryClass.class_id, limit: 1000 }).then(setTeacherAssessments).catch(() => {}),
              getTeacherCultureCompleteness(token, {
                period_mode: "week",
                class_id: primaryClass.class_id,
                academic_year_id: primaryClass.academic_year_id,
                semester_id: primaryClass.semester_id
              }).then(setTeacherCulture).catch((err) => { console.error('Gagal memuat data budaya:', err); setTeacherCulture(null); }),
              getClassAcademicSummary(token, {
                class_id: primaryClass.class_id,
                academic_year_id: primaryClass.academic_year_id,
                semester_id: primaryClass.semester_id
              }).then(setTeacherAcademicSummary).catch(() => {})
            ]);
          }
        }).catch(() => {})
      );
    }

    Promise.all(promises)
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard data load error:", err);
        setError("Gagal memuat beberapa data dashboard.");
        setLoading(false);
      });
  }, [token, user]);

  // Map student to their active enrollment class name
  const studentClassMap = useMemo(() => {
    const map: Record<string, string> = {};
    enrollments.forEach(e => {
      if (e.status === "active" && e.class_name) {
        map[e.student_id] = e.class_name;
      }
    });
    return map;
  }, [enrollments]);

  // --- AGGREGATORS & HEALTH SCORE COMPUTATIONS (SECTION 2 - ADMIN) ---
  const aggregators = useMemo(() => {
    if (!statsData) return null;

    return {
      academicCompletion: statsData.academicCompletion,
      characterCompletion: statsData.characterCompletion ?? 0,
      teacherAttendance: statsData.teacherAttendanceRate,
      sppCompletion: statsData.sppCompletionRate ?? 0,
      docCompletion: statsData.docCompletionRate ?? 0,
      overallHealthScore: statsData.overallHealthScore ?? 0,
      healthCategory: statsData.healthCategory ?? "Baik"
    };
  }, [statsData]);

  // --- CRITICAL ALERTS SELECTOR (SECTION 5 - ADMIN) ---
  const criticalAlerts = useMemo(() => {
    const alerts = [];

    // Helper to clean test/system suffixes from class names
    const formatClassName = (name: string) => {
      if (!name) return "";
      let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
      cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
      if (cleaned.startsWith("Kelas ")) {
        return cleaned;
      }
      return `Kelas ${cleaned}`;
    };

    // 1. Kepegawaian: Wali kelas pendamping belum lengkap
    const emptyWaliClasses = statsData?.classesWithoutWali || [];
    if (emptyWaliClasses.length > 0) {
      const formattedClasses = emptyWaliClasses.map(formatClassName).join(", ");
      alerts.push({
        id: "wali-missing",
        priority: 1,
        title: "Pendamping Wali Kelas belum lengkap",
        description: `${formattedClasses} belum memiliki Wali Kelas pendamping semester ini.`,
        category: "Kepegawaian"
      });
    }

    // 2. Kurikulum: Finalisasi nilai tertunda
    const unpublishedAssessments = assessments.filter(a => a.status !== "locked");
    if (unpublishedAssessments.length > 5) {
      alerts.push({
        id: "assessments-unpublished",
        priority: 2,
        title: "Finalisasi evaluasi belajar tertunda",
        description: `Terdapat ${unpublishedAssessments.length} evaluasi belajar siswa yang masih berupa draf dan belum difinalisasi oleh guru.`,
        category: "Kurikulum"
      });
    }

    // 3. Kesiswaan: Murid belum ditempatkan di rombel
    const orphanStudentsCount = statsData?.orphanStudentsCount || 0;
    if (orphanStudentsCount > 0) {
      alerts.push({
        id: "students-orphan",
        priority: 3,
        title: "Anak didik belum masuk kelas (rombel)",
        description: `Ada ${orphanStudentsCount} anak didik aktif yang belum terdaftar di kelas manapun semester ini.`,
        category: "Kesiswaan"
      });
    }

    // 4. Administrasi: Berkas pendaftaran kurang lengkap
    const incompleteDocsCount = statsData?.docPieChartData?.find(d => d.name === "Belum Lengkap")?.value || 0;
    if (incompleteDocsCount > 0) {
      alerts.push({
        id: "docs-incomplete",
        priority: 4,
        title: "Berkas pokok pendaftaran siswa kurang lengkap",
        description: `Sebanyak ${incompleteDocsCount} berkas pokok siswa baru (seperti Akta Kelahiran atau KK) belum diunggah.`,
        category: "Administrasi"
      });
    }

    // 5. Keuangan: Tagihan iuran SPP
    const unpaidSppPercent = statsData?.unpaidSppPercent || 0;
    if (unpaidSppPercent > 20) {
      alerts.push({
        id: "spp-unpaid-alert",
        priority: 5,
        title: "Arus kas iuran SPP berjalan",
        description: `Sebanyak ${unpaidSppPercent}% rencana iuran SPP siswa bulan ini masih dalam proses pelunasan.`,
        category: "Keuangan"
      });
    }

    // 6. Keamanan: Akses mencurigakan terdeteksi dalam 24 jam terakhir
    const failedLoginsCount = statsData?.failedLoginsCount || 0;
    if (failedLoginsCount > 0) {
      alerts.push({
        id: "failed-logins-count",
        priority: 6,
        title: "Aktivitas akses sistem mencurigakan",
        description: `Terdeteksi ${failedLoginsCount} kali percobaan masuk tidak sah atau peringatan kritis dalam 24 jam terakhir.`,
        category: "Keamanan"
      });
    }

    return alerts.sort((a, b) => a.priority - b.priority);
  }, [assessments, statsData]);

  // --- DATA QUALITY CHECKER (SECTION 6 - OPERATOR) ---
  const studentsWithoutPinCount = statsData?.qualityStats?.studentsWithoutPinCount ?? 0;

  const dataQualityStats = useMemo(() => {
    if (!statsData?.qualityStats) {
      return {
        duplicateNIKCount: 0,
        duplicateNISNCount: 0,
        orphanStudentCount: 0,
        missingBirthdateCount: 0,
        hasQualityIssue: false
      };
    }
    const { duplicateNIKCount, duplicateNISNCount, orphanStudentCount, missingBirthdateCount } = statsData.qualityStats;
    return {
      duplicateNIKCount,
      duplicateNISNCount,
      orphanStudentCount,
      missingBirthdateCount,
      hasQualityIssue: duplicateNIKCount > 0 || duplicateNISNCount > 0 || orphanStudentCount > 0
    };
  }, [statsData]);

  // --- TEACHER PENDING TASKS CALCULATOR (SECTION 3 - GURU) ---
  const teacherPendingTasks = useMemo(() => {
    const tasks = [];

    // Task 1: Draft assessments (Academic)
    const draftAssessments = teacherAssessments.filter(a => a.status === "draft");
    draftAssessments.forEach(a => {
      tasks.push({
        id: `draft-eval-${a.id}`,
        title: `Finalisasi draf penilaian: ${a.title}`,
        description: `Evaluasi ${a.title} masih berstatus draf dan belum dikunci.`,
        href: "/academic-scores",
        category: "Akademik",
        priority: 1
      });
    });

    // Task 2: Culture completeness (Weekly / Monthly)
    if (teacherCulture && teacherCulture.class_summary && teacherCulture.class_summary.average_coverage_percent < 100) {
      tasks.push({
        id: "culture-incomplete",
        title: `Lengkapi rekap karakter mingguan`,
        description: `Kemajuan rata-rata pengisian budaya kelas masih sebesar ${teacherCulture.class_summary.average_coverage_percent || 0}%.`,
        href: "/daily-culture",
        category: "Karakter",
        priority: 2
      });
    }

    return tasks.sort((a, b) => a.priority - b.priority);
  }, [teacherAssessments, teacherCulture]);

  // --- TEACHER STATISTICS COMPILER (SECTION 4 - GURU) ---
  const teacherAcademicStats = useMemo(() => {
    const totalCount = teacherAssessments.length;
    const completedCount = teacherAssessments.filter(a => a.status === "locked").length;
    const pendingCount = totalCount - completedCount;
    const academicProgressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      completedCount,
      pendingCount,
      academicProgressPercent
    };
  }, [teacherAssessments]);

  // --- TEACHER ANALYTICS COMPILER (SECTION 8 - GURU) ---
  const teacherAnalyticsData = useMemo(() => {
    if (!teacherAcademicSummary || !teacherAcademicSummary.student_summaries) return null;

    // Class score distribution groups
    let countA = 0; // >= 85
    let countB = 0; // 75-84
    let countC = 0; // 60-74
    let countD = 0; // < 60

    teacherAcademicSummary.student_summaries.forEach((s) => {
      if (s.average_score !== null) {
        if (s.average_score >= 85) countA++;
        else if (s.average_score >= 75) countB++;
        else if (s.average_score >= 60) countC++;
        else countD++;
      }
    });

    return [
      { name: "Nilai A (>=85)", Jumlah: countA },
      { name: "Nilai B (75-84)", Jumlah: countB },
      { name: "Nilai C (60-74)", Jumlah: countC },
      { name: "Nilai D (<60)", Jumlah: countD }
    ];
  }, [teacherAcademicSummary]);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      {user?.role === "administrator" && (
        <div className="space-y-6 animate-fadeIn">

          {/* SECTION 1: School Summary KPIs */}
          <PageSection>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard
                title="Siswa aktif"
                value={statsData?.total_students ?? 0}
                subtitle="anak terdaftar"
                loading={statsLoading}
                icon={<Users className="w-4 h-4" />}
              />
              <KPICard
                title="Guru aktif"
                value={statsData?.total_teachers ?? 0}
                subtitle="pengajar"
                loading={statsLoading}
                icon={<GraduationCap className="w-4 h-4" />}
              />
              <KPICard
                title="Kelas aktif"
                value={statsData?.total_classes ?? 0}
                subtitle="rombongan belajar"
                loading={statsLoading}
                icon={<School className="w-4 h-4" />}
              />
              <KPICard
                title="Tahun ajaran"
                value={activeAcademicYear ? activeAcademicYear.name : "Belum Diatur"}
                variant="flat"
                loading={settingsLoading}
              />
              <KPICard
                title="Semester"
                value={activeSemester ? `Semester ${activeSemester.name}` : "Belum Diatur"}
                variant="flat"
                loading={settingsLoading}
              />
            </div>
          </PageSection>

          {/* SECTION 2: School Health Score */}
          {aggregators && (
            <PageSection>
              <Card padding="lg">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Progress Ring */}
                  <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="60" className="stroke-zinc-100 dark:stroke-zinc-800 fill-none" strokeWidth="12" />
                      <circle cx="72" cy="72" r="60" className="stroke-brand-emerald-600 fill-none" strokeWidth="12"
                              strokeDasharray={String(2 * Math.PI * 60)}
                              strokeDashoffset={2 * Math.PI * 60 * (1 - aggregators.overallHealthScore / 100)}
                              strokeLinecap="round" />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-3xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50">{aggregators.overallHealthScore}</span>
                      <ColumnLabel className="block mt-0.5">Skor kesehatan</ColumnLabel>
                    </div>
                  </div>

                  {/* Score Breakdown & Category */}
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Dashboard kesehatan sekolah</CardTitle>
                        <p className="text-xs font-plus-jakarta text-zinc-500 mt-0.5">Status operasional akademik &amp; administrasi sekolah terintegrasi secara dinamis.</p>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold font-plus-jakarta uppercase tracking-wider bg-surface-2 border border-zinc-200 dark:border-zinc-800 ${getHealthColorClass(aggregators.healthCategory)}`}>
                        {aggregators.healthCategory}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-plus-jakarta font-medium">Ketuntasan akademik</span>
                          <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">
                            {aggregators.academicCompletion === null || aggregators.academicCompletion === undefined
                              ? "Belum ada assessment"
                              : `${aggregators.academicCompletion}%`}
                          </NumericDisplay>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${aggregators.academicCompletion ?? 0}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-plus-jakarta font-medium">Ketuntasan karakter</span>
                          <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">{aggregators.characterCompletion}%</NumericDisplay>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-emerald-600 rounded-full" style={{ width: `${aggregators.characterCompletion}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-plus-jakarta font-medium">Kehadiran guru</span>
                          <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">
                            {aggregators.teacherAttendance === null || aggregators.teacherAttendance === undefined
                              ? "Belum ada data"
                              : `${aggregators.teacherAttendance}%`}
                          </NumericDisplay>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${aggregators.teacherAttendance ?? 0}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-plus-jakarta font-medium">Rasio pelunasan SPP</span>
                          <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">{aggregators.sppCompletion}%</NumericDisplay>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${aggregators.sppCompletion}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </PageSection>
          )}

          {/* SECTION 3 & 4: Progress Boards (Read-Only for Admin) */}
          <PageSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SECTION 3: Academic Progress */}
              <Card padding="md">
                <CardHeader
                  title="Kemajuan pengisian nilai"
                  subtitle={`Semester ${activeSemester?.name || "Aktif"} ${activeAcademicYear?.name || ""} • Target Pasangan Mapel-Kelas`}
                  bordered
                  action={
                    <button
                      onClick={handleOpenAcademicMonitoring}
                      className="text-xs font-bold font-plus-jakarta text-brand-emerald-600 hover:text-brand-emerald-700 dark:text-brand-emerald-400 dark:hover:text-brand-emerald-300 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1 rounded"
                    >
                      Lihat Detail
                    </button>
                  }
                />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                    <ColumnLabel className="block">Sudah isi</ColumnLabel>
                    <span className="text-lg font-bold font-fredoka text-emerald-600 dark:text-emerald-400 block mt-1">
                      {realAcademicStats.loading ? "..." : realAcademicStats.final}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-plus-jakarta">
                      Target Mapel-Kelas
                    </span>
                  </div>
                  <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                    <ColumnLabel className="block">Belum isi</ColumnLabel>
                    <span className="text-lg font-bold font-fredoka text-amber-600 dark:text-amber-400 block mt-1">
                      {realAcademicStats.loading ? "..." : realAcademicStats.belumIsi}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-plus-jakarta">
                      Target Mapel-Kelas
                    </span>
                  </div>
                  <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                    <ColumnLabel className="block">Belum final</ColumnLabel>
                    <span className="text-lg font-bold font-fredoka text-red-500 block mt-1">
                      {realAcademicStats.loading ? "..." : realAcademicStats.belumFinal}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-plus-jakarta">
                      Target Mapel-Kelas
                    </span>
                  </div>
                </div>
              </Card>

              {/* SECTION 4: Character Progress */}
              <Card padding="md">
                <CardHeader
                  title="Kemajuan pengisian budaya (SAHABAT)"
                  subtitle={`Akumulasi Jurnal Semester ${activeSemester?.name || "Aktif"} • Satuan % Total Kelas`}
                  bordered
                  action={
                    <button
                      onClick={handleOpenCultureMonitoring}
                      className="text-xs font-bold font-plus-jakarta text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 rounded"
                    >
                      Lihat Detail
                    </button>
                  }
                />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                    <ColumnLabel className="block">Lengkap</ColumnLabel>
                    <span className="text-lg font-bold font-fredoka text-emerald-600 dark:text-emerald-400 block mt-1">
                      {realCultureStats.loading ? "..." : `${realCultureStats.lengkap}%`}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-plus-jakarta">
                      dari total kelas
                    </span>
                  </div>
                  <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                    <ColumnLabel className="block">Sebagian</ColumnLabel>
                    <span className="text-lg font-bold font-fredoka text-blue-500 block mt-1">
                      {realCultureStats.loading ? "..." : `${realCultureStats.sebagian}%`}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-plus-jakarta">
                      dari total kelas
                    </span>
                  </div>
                  <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                    <ColumnLabel className="block">Kosong</ColumnLabel>
                    <span className="text-lg font-bold font-fredoka text-red-500 block mt-1">
                      {realCultureStats.loading ? "..." : `${realCultureStats.kosong}%`}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-plus-jakarta">
                      dari total kelas
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </PageSection>

          {/* SECTION 5: Critical Alerts */}
          {criticalAlerts.length > 0 && (
            <PageSection>
              <div className="bg-red-50/40 dark:bg-red-950/10 border border-red-200/80 dark:border-red-900/30 p-5 rounded-2xl space-y-3 animate-fadeIn">
                <ColumnLabel className="text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Pemberitahuan penting kepala sekolah
                </ColumnLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {criticalAlerts.slice(0, 4).map((alert) => (
                    <Card key={alert.id} variant="flat" padding="sm">
                      <div className="flex gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1" aria-hidden="true" />
                        <div>
                          <ColumnLabel className="text-red-600 dark:text-red-400 block">{alert.category}</ColumnLabel>
                          <CardTitle className="mt-0.5">{alert.title}</CardTitle>
                          <p className="text-[10px] font-plus-jakarta text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{alert.description}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </PageSection>
          )}

          {/* SECTION 6 & 7: Visual Analytics Charts */}
          <PageSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* SECTION 6: Academic Analytics */}
              <Card padding="lg">
                <CardHeader
                  title="Distribusi nilai rata-rata per tingkat kelas"
                  bordered
                />
                <div className="h-64">
                  {!statsData?.classAcademicAverages || statsData.classAcademicAverages.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs font-plus-jakarta text-zinc-400">Belum ada data nilai akademik</span>
                    </div>
                  ) : (
                    <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ReChartsBarChart data={statsData.classAcademicAverages.map(item => {
                        const name = item.name;
                        let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
                        cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
                        const cleanName = cleaned.startsWith("Kelas ") ? cleaned : `Kelas ${cleaned}`;
                        return { ...item, name: cleanName };
                      })}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" fontSize={10} tickLine={false} />
                        <YAxis domain={[50, 100]} fontSize={10} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="RataRata" fill="#468432" radius={[6, 6, 0, 0]} />
                      </ReChartsBarChart>
                    </ReChartsResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* SECTION 7: Character Analytics */}
              <Card padding="lg">
                <CardHeader
                  title="Rata-rata aspek FITRAH tingkat sekolah"
                  bordered
                />
                <div className="h-64">
                  {!statsData?.fitrahRadarData || statsData.fitrahRadarData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs font-plus-jakarta text-zinc-400">Belum ada data pembiasaan karakter</span>
                    </div>
                  ) : (
                    <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ReChartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={statsData.fitrahRadarData}>
                        <PolarGrid stroke="#e4e4e7" />
                        <PolarAngleAxis dataKey="subject" fontSize={10} />
                        <PolarRadiusAxis angle={30} domain={[0, 4.0]} fontSize={8} />
                        <Tooltip />
                        <Radar name="Skor Rata-rata" dataKey="A" stroke="#468432" fill="#468432" fillOpacity={0.25} />
                      </ReChartsRadarChart>
                    </ReChartsResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          </PageSection>

          {/* SECTION 8: School Insights */}
          <PageSection>
            <Card padding="md">
              <CardHeader title="Wawasan utama sekolah" bordered />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                  <ColumnLabel className="block">Pencapaian akademik kelas terbaik</ColumnLabel>
                  <CardTitle className="mt-1">
                    {statsData ? (() => {
                      const name = statsData.bestClassAcademicName;
                      let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
                      cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
                      return cleaned.startsWith("Kelas ") ? cleaned : `Kelas ${cleaned}`;
                    })() : "..."}
                  </CardTitle>
                  <p className="text-[10px] font-plus-jakarta text-zinc-400 mt-0.5">
                    {statsData ? statsData.bestClassAcademicAvg : "Menganalisis rata-rata nilai akademik..."}
                  </p>
                </div>
                <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                  <ColumnLabel className="block">Guru paling produktif</ColumnLabel>
                  <CardTitle className="mt-1">{statsData ? statsData.mostActiveTeacherName : "..."}</CardTitle>
                  <p className="text-[10px] font-plus-jakarta text-zinc-400 mt-0.5">
                    {statsData ? statsData.mostActiveTeacherDesc : "Menghitung aktivitas entri nilai..."}
                  </p>
                </div>
                <div className="p-3 bg-surface-2 border border-zinc-100 dark:border-zinc-800/30 rounded-xl">
                  <ColumnLabel className="block">Keteladanan karakter terbaik</ColumnLabel>
                  <CardTitle className="mt-1">
                    {statsData ? (() => {
                      const name = statsData.bestCultureClassName;
                      let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
                      cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
                      return cleaned.startsWith("Kelas ") ? cleaned : `Kelas ${cleaned}`;
                    })() : "..."}
                  </CardTitle>
                  <p className="text-[10px] font-plus-jakarta text-zinc-400 mt-0.5">
                    {statsData ? statsData.bestCultureClassAvg : "Menghitung rasio kelayakan pembiasaan..."}
                  </p>
                </div>
              </div>
            </Card>
          </PageSection>

          {/* SECTION 9 & 10: Timeline & Actions */}
          <PageSection>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* SECTION 9: Recent Activities Timeline */}
              <div className="lg:col-span-2">
                <Card padding="lg">
                  <CardHeader title="Ringkasan aktivitas sekolah terbaru" bordered />
                  <div className="flow-root">
                    <ul className="-mb-8" role="list">
                      {auditLogs.slice(0, 4).map((log, logIdx) => (
                        <li key={log.id}>
                          <div className="relative pb-8">
                            {logIdx !== auditLogs.length - 1 ? (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-zinc-100 dark:bg-zinc-800" aria-hidden="true" />
                            ) : null}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full bg-surface-2 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center">
                                  <Activity className="w-3.5 h-3.5 text-brand-emerald-600" aria-hidden="true" />
                                </span>
                              </div>
                              <div className="flex-1 min-w-0 pt-1.5">
                                <p className="text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400">
                                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{log.user_name}</span>{" "}
                                  melakukan tindakan <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatAuditAction(log.action)}</span>
                                </p>
                                <p className="text-[10px] font-plus-jakarta text-zinc-500 mt-0.5">{formatAuditDescription(log.description, log.action)}</p>
                              </div>
                              <div className="text-right text-[10px] whitespace-nowrap font-plus-jakarta text-zinc-500">
                                <NumericDisplay>{formatDate(log.created_at)}</NumericDisplay>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </div>

              {/* SECTION 10: Quick Actions */}
              <Card padding="lg">
                <CardHeader title="Aksi cepat administrator" bordered />
                <div className="space-y-3">
                  <Link
                    href="/students"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                  >
                    <UserPlus className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                    <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Registrasi siswa baru</span>
                  </Link>
                  <Link
                    href="/import"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                  >
                    <Upload className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                    <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Impor berkas Excel</span>
                  </Link>
                  <Link
                    href="/export"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                  >
                    <FileDown className="w-4 h-4 text-brand-emerald-600" aria-hidden="true" />
                    <span className="text-xs font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200">Unduh laporan rapor</span>
                  </Link>
                </div>
              </Card>
            </div>
          </PageSection>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OPERATOR ADMINISTRASI DASHBOARD */}
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
                title="Mata pelajaran"
                value={subjects.length}
                loading={statsLoading}
                icon={<BookOpen className="w-4 h-4" />}
              />
              <KPICard
                title="Kelengkapan berkas"
                value={statsData ? `${statsData.docCompletionRate}%` : "..."}
                loading={statsLoading}
                icon={<FileText className="w-4 h-4" />}
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
                      className="shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] font-plus-jakarta rounded-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 transition-colors"
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
                      className="shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] font-plus-jakarta rounded-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 transition-colors"
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

              {/* SECTION 3: Document Completion */}
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
                          {COLORS_PRIMARY.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_PRIMARY[index % COLORS_PRIMARY.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} fontSize={10} />
                      </ReChartsPieChart>
                    </ReChartsResponsiveContainer>
                  )}
                </div>
              </Card>

              {/* SECTION 4: SPP Overview */}
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

          {/* SECTION 5 & 6: Data Quality & Activities */}
          <PageSection>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* SECTION 6: Data Quality Diagnostic */}
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

              {/* SECTION 5: Import Export Activity logs */}
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

                  {/* Quick Actions for Operator */}
                  <div className="grid grid-cols-2 gap-2 pt-4">
                    <Link
                      href="/students"
                      className="flex items-center justify-center gap-1 bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white p-2.5 rounded-xl text-xs font-bold font-plus-jakarta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Siswa baru
                    </Link>
                    <Link
                      href="/import"
                      className="flex items-center justify-center gap-1 bg-surface-2 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 p-2.5 rounded-xl text-xs font-bold font-plus-jakarta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
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
      {/* 3. GURU PERSONAL DASHBOARD (TEACHER WORK CENTER) */}
      {/* ========================================================================= */}
      {user?.role === "teacher" && (
        <div className="space-y-6 animate-fadeIn">

          {/* SECTION 1: Hero */}
          <PageSection>
            <Card padding="lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-plus-jakarta bg-brand-emerald-50 text-brand-emerald-600 dark:bg-brand-emerald-950/40 dark:text-brand-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald-600 animate-pulse" aria-hidden="true" />
                    Guru pengajar
                  </span>
                  <h3 className="text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50 mt-2">Selamat datang kembali, {user.name}</h3>
                  <NumericDisplay className="text-zinc-500 text-xs mt-0.5 block">{user.email}</NumericDisplay>
                </div>
                <div className="flex gap-4 border-t md:border-t-0 md:border-l border-zinc-100 dark:border-zinc-800 pt-4 md:pt-0 md:pl-6">
                  <div>
                    <ColumnLabel className="block">Tahun ajaran</ColumnLabel>
                    <span className="font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200 block mt-1 text-sm">
                      {activeAcademicYear ? activeAcademicYear.name : "-"}
                    </span>
                  </div>
                  <div>
                    <ColumnLabel className="block">Semester</ColumnLabel>
                    <span className="font-bold font-plus-jakarta text-zinc-800 dark:text-zinc-200 block mt-1 text-sm">
                      {activeSemester ? `Semester ${activeSemester.name}` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </PageSection>

          {/* Teacher stat KPIs */}
          <PageSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard
                title="Perwalian kelas"
                value={myClasses.length > 0 ? myClasses[0].class_name : "Tidak ada perwalian aktif"}
                icon={<School className="w-4 h-4" />}
              />
              <KPICard
                title="Jumlah mengajar"
                value={`${myClasses.length} kelas`}
                icon={<BookOpen className="w-4 h-4" />}
              />
              <KPICard
                title="Siswa diampu"
                value={`${teacherStudents.length} anak`}
                icon={<Users className="w-4 h-4" />}
              />
            </div>
          </PageSection>

          {/* SECTION 2: Today's Schedule */}
          <PageSection>
            <Card padding="lg">
              <CardHeader title="Jadwal dan agenda mengajar hari ini" bordered />
              <div className="space-y-3">
                {myClasses.length > 0 ? (
                  myClasses.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-surface-2 border border-zinc-100 dark:border-zinc-800/30">
                      <div>
                        <span className="text-xs font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-50 block">{item.class_name}</span>
                        <NumericDisplay className="text-[10px] text-zinc-400 mt-0.5 block">Kode: {item.class_code}</NumericDisplay>
                      </div>
                      <span className="text-xs font-bold font-plus-jakarta text-brand-emerald-600 dark:text-brand-emerald-400">Sesi Aktif</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-plus-jakarta text-zinc-500 italic text-center py-4">Belum ada kelas mengajar hari ini.</p>
                )}
              </div>
            </Card>
          </PageSection>

          {/* SECTION 3: Today's Tasks */}
          <PageSection>
            <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/30 p-5 rounded-2xl space-y-3">
              <ColumnLabel className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4" aria-hidden="true" />
                Tugas mengajar tertunda
              </ColumnLabel>
              {teacherPendingTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teacherPendingTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={task.href}
                      className="p-3 bg-surface-1 rounded-2xl border border-amber-100 dark:border-amber-950/20 shadow-sm flex items-center justify-between hover:border-amber-500 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                    >
                      <div>
                        <ColumnLabel className="text-amber-700 dark:text-amber-400 block">{task.category}</ColumnLabel>
                        <CardTitle className="mt-0.5">{task.title}</CardTitle>
                        <p className="text-[10px] font-plus-jakarta text-zinc-500 dark:text-zinc-400 mt-0.5">{task.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-surface-1 p-6 rounded-2xl border border-amber-100 dark:border-amber-950/20 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs font-plus-jakarta text-zinc-600 dark:text-zinc-400">Luar biasa! Tidak ada tugas tertunda untuk hari ini.</p>
                </div>
              )}
            </div>
          </PageSection>

          {/* SECTION 4 & 5: Academic & Culture Progress */}
          <PageSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SECTION 4: Academic Progress */}
              <Card padding="md">
                <CardHeader title="Kemajuan pengisian nilai akademik" bordered />
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-plus-jakarta text-zinc-500 font-medium">Beban evaluasi selesai (locked)</span>
                      <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">
                        {teacherAcademicStats.completedCount} dari {teacherAcademicStats.totalCount} ({teacherAcademicStats.academicProgressPercent}%)
                      </NumericDisplay>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${teacherAcademicStats.academicProgressPercent}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-surface-2 border border-zinc-100 dark:border-zinc-800/10 rounded-xl">
                      <ColumnLabel className="block">Sudah final</ColumnLabel>
                      <span className="text-sm font-bold font-fredoka text-zinc-900 dark:text-zinc-100 mt-1 block">{teacherAcademicStats.completedCount}</span>
                    </div>
                    <div className="p-2.5 bg-surface-2 border border-zinc-100 dark:border-zinc-800/10 rounded-xl">
                      <ColumnLabel className="block">Masih draf</ColumnLabel>
                      <span className="text-sm font-bold font-fredoka text-zinc-900 dark:text-zinc-100 mt-1 block">{teacherAcademicStats.pendingCount}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* SECTION 5: Culture Progress */}
              <Card padding="md">
                <CardHeader title="Kemajuan pengisian budaya (SAHABAT)" bordered />
                {teacherCulture && teacherCulture.class_summary ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-plus-jakarta text-zinc-500 font-medium">Rata-rata cakupan harian kelas</span>
                        <NumericDisplay className="font-bold text-zinc-800 dark:text-zinc-200">
                          {teacherCulture.class_summary.average_coverage_percent}%
                        </NumericDisplay>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${teacherCulture.class_summary.average_coverage_percent}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2.5 bg-surface-2 border border-zinc-100 dark:border-zinc-800/10 rounded-xl">
                        <ColumnLabel className="block">Siswa lengkap</ColumnLabel>
                        <span className="text-sm font-bold font-fredoka text-zinc-900 dark:text-zinc-100 mt-1 block">
                          {teacherCulture.class_summary.complete_students} anak
                        </span>
                      </div>
                      <div className="p-2.5 bg-surface-2 border border-zinc-100 dark:border-zinc-800/10 rounded-xl">
                        <ColumnLabel className="block">Siswa kosong</ColumnLabel>
                        <span className="text-sm font-bold font-fredoka text-zinc-900 dark:text-zinc-100 mt-1 block">
                          {teacherCulture.class_summary.empty_students} anak
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-plus-jakarta text-zinc-500 italic py-4 text-center">Data rekapitulasi budaya belum tersedia untuk semester ini.</p>
                )}
              </Card>

            </div>
          </PageSection>

          {/* SECTION 7: Reminder */}
          <PageSection>
            <div className="bg-amber-50/20 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/30 p-5 rounded-2xl">
              <ColumnLabel className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                Pengingat batas waktu penting guru
              </ColumnLabel>
              <p className="text-xs font-plus-jakarta text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Penguncian semester aktif dijadwalkan pada tanggal{" "}
                <strong>
                  {activeSemester?.end_date
                    ? new Date(activeSemester.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                    : "akhir semester"}
                </strong>. Pastikan semua draf penilaian akademik dikunci dan rekap pembiasaan budaya SAHABAT diisi secara penuh demi kelancaran penerbitan rapor murid.
              </p>
            </div>
          </PageSection>

          {/* SECTION 8: Analytics */}
          {teacherAnalyticsData && (
            <PageSection>
              <Card padding="lg">
                <CardHeader title="Distribusi pencapaian nilai rata-rata kelas perwalian" bordered />
                <div className="h-64">
                  <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ReChartsBarChart data={teacherAnalyticsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} />
                      <YAxis fontSize={10} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="Jumlah" fill="#468432" radius={[6, 6, 0, 0]} />
                    </ReChartsBarChart>
                  </ReChartsResponsiveContainer>
                </div>
              </Card>
            </PageSection>
          )}

          {/* SECTION 9: Quick Actions */}
          <PageSection>
            <Card padding="md">
              <CardHeader title="Aksi cepat guru" bordered />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  href="/academic-scores"
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white hover:border-brand-emerald-600 transition-all text-xs font-bold font-plus-jakarta cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                >
                  Input nilai
                </Link>
                <Link
                  href="/daily-culture"
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white hover:border-brand-emerald-600 transition-all text-xs font-bold font-plus-jakarta cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                >
                  Input karakter
                </Link>
                <Link
                  href="/presence"
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white hover:border-brand-emerald-600 transition-all text-xs font-bold font-plus-jakarta cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                >
                  Presensi kelas
                </Link>
                <Link
                  href="/my-class"
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 hover:bg-brand-emerald-600 hover:text-white hover:border-brand-emerald-600 transition-all text-xs font-bold font-plus-jakarta cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1"
                >
                  Catatan wali
                </Link>
              </div>
            </Card>
          </PageSection>

        </div>
      )}

      {/* Monitoring Dialogs for Admin/Operator */}
      {(user?.role === "administrator" || user?.role === "admin") && (
        <>
          <AcademicMonitoringDialog
            isOpen={isAcademicModalOpen}
            onClose={() => setIsAcademicModalOpen(false)}
            loading={monitoringLoading}
            error={monitoringError}
            data={academicData}
          />
          <CultureMonitoringDialog
            isOpen={isCultureModalOpen}
            onClose={() => setIsCultureModalOpen(false)}
            loading={monitoringLoading}
            error={monitoringError}
            data={cultureData}
          />
        </>
      )}
    </PageContainer>
  );
}
