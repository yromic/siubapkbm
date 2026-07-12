"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { apiRequest } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer } from "@/components/ui-states";
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
  const realAcademicStats = useMemo(() => {
    if (!academicData) {
      return {
        final: 0,
        belumIsi: 0,
        belumFinal: 0,
        loading: true
      };
    }
    const final = academicData.filter(item => item.status === "Final").length;
    const belumFinal = academicData.filter(item => item.status === "Belum Final").length;
    const belumIsi = academicData.filter(item => item.status === "Belum Membuat Assessment").length;
    return { final, belumIsi, belumFinal, loading: false };
  }, [academicData]);

  const realCultureStats = useMemo(() => {
    if (!cultureData || cultureData.length === 0) {
      return {
        lengkap: 0,
        sebagian: 0,
        kosong: 0,
        loading: true
      };
    }
    const total = cultureData.length;
    const lengkapCount = cultureData.filter(item => item.status === "Lengkap").length;
    const sebagianCount = cultureData.filter(item => item.status === "Sebagian").length;
    const kosongCount = cultureData.filter(item => item.status === "Belum Ada Input").length;

    return {
      lengkap: Math.round((lengkapCount / total) * 100),
      sebagian: Math.round((sebagianCount / total) * 100),
      kosong: Math.round((kosongCount / total) * 100),
      loading: false
    };
  }, [cultureData]);

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
      apiRequest<any[]>("list_classes", {}, token).then(setClasses).catch(() => {})
    );
    promises.push(
      apiRequest<any[]>("list_subjects", {}, token).then(setSubjects).catch(() => {})
    );
    promises.push(
      listStudents(token).then(r => setStudents(r.data)).catch(() => {})
    );
    promises.push(
      listStudentEnrollments(token).then(setEnrollments).catch(() => {})
    );

    if (user.role === "administrator" || user.role === "admin") {
      promises.push(
        listUsersApi(token).then((res) => setTeachers(res.filter((u) => u.role === "teacher"))).catch(() => {})
      );
      promises.push(
        searchAuditLogs(token, { page: 1, page_size: 10 }).then((res) => setAuditLogs(res.logs || [])).catch(() => {})
      );
      promises.push(
        listAcademicAssessments(token).then(setAssessments).catch(() => {})
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
              listStudentsByClass(primaryClass.class_id, primaryClass.academic_year_id, primaryClass.semester_id, token)
                .then(setTeacherStudents).catch(() => {}),
              listAcademicAssessments(token, { class_id: primaryClass.class_id }).then(setTeacherAssessments).catch(() => {}),
              getTeacherCultureCompleteness(token, { period_mode: "week", class_id: primaryClass.class_id }).then(setTeacherCulture).catch(() => {}),
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
    if (loading) return null;

    // 1. Academic Completion Rate
    const totalAssessmentsCount = assessments.length;
    const completedAssessmentsCount = assessments.filter(a => a.status === "locked").length;
    const academicCompletion = totalAssessmentsCount > 0 
      ? Math.round((completedAssessmentsCount / totalAssessmentsCount) * 100) 
      : 0;

    // 2. Character Completion Rate
    const characterCompletion = realCultureStats.loading ? 0 : realCultureStats.lengkap;

    // 3. Teacher Attendance Rate
    const teacherAttendance = statsData ? statsData.teacherAttendanceRate : 0;

    // 4. SPP Completion Rate
    const sppCompletion = statsData ? statsData.sppCompletionRate : 0;

    // 5. Document Completion Rate
    const docCompletion = statsData ? statsData.docCompletionRate : 0;

    // Overall School Health Score
    const overallHealthScore = Math.round(
      (academicCompletion + characterCompletion + teacherAttendance + sppCompletion + docCompletion) / 5
    );

    let healthCategory: "Sangat Baik" | "Baik" | "Perlu Perhatian" | "Kritis" = "Baik";
    if (overallHealthScore >= 90) healthCategory = "Sangat Baik";
    else if (overallHealthScore >= 75) healthCategory = "Baik";
    else if (overallHealthScore >= 50) healthCategory = "Perlu Perhatian";
    else healthCategory = "Kritis";

    return {
      academicCompletion,
      characterCompletion,
      teacherAttendance,
      sppCompletion,
      docCompletion,
      overallHealthScore,
      healthCategory
    };
  }, [loading, assessments, statsData, realCultureStats]);

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
  const studentsWithoutPinCount = useMemo(() => {
    return students.filter(s => s.status === "Aktif" && !s.has_parent_pin).length;
  }, [students]);

  const dataQualityStats = useMemo(() => {
    const duplicateNIKs = students.filter((s, idx) => s.nik && students.findIndex(x => x.nik === s.nik) !== idx);
    const duplicateNISNs = students.filter((s, idx) => s.nisn && students.findIndex(x => x.nisn === s.nisn) !== idx);
    
    const enrolledStudentIds = new Set(enrollments.filter(e => e.status === "active").map(e => e.student_id));
    const orphanStudents = students.filter(s => s.status === "Aktif" && !enrolledStudentIds.has(s.id));
    
    return {
      duplicateNIKCount: duplicateNIKs.length,
      duplicateNISNCount: duplicateNISNs.length,
      orphanStudentCount: orphanStudents.length,
      missingBirthdateCount: students.filter(s => !s.birth_date).length,
      hasQualityIssue: duplicateNIKs.length > 0 || duplicateNISNs.length > 0 || orphanStudents.length > 0
    };
  }, [students, enrollments]);

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
      <ResponsiveContainer className="space-y-6 flex-1 flex flex-col py-6 max-w-[1280px] mx-auto px-6">
        <PageHeader title="SIUBA control center" description="Memuat modul dashboard..." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-[20px]"></div>
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-[20px]"></div>
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-[20px]"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 h-96 bg-zinc-200 dark:bg-zinc-800 rounded-[20px]"></div>
          <div className="h-96 bg-zinc-200 dark:bg-zinc-800 rounded-[20px]"></div>
        </div>
      </ResponsiveContainer>
    );
  }

  if (error || settingsError) {
    return (
      <ResponsiveContainer className="py-12 text-center max-w-md mx-auto px-6">
        <div className="p-6 bg-white dark:bg-[#171717] rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-500 mb-2">Terjadi kesalahan</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error || settingsError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-2.5 bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold rounded-[12px] transition-colors cursor-pointer"
          >
            Refresh halaman
          </button>
        </div>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer className="space-y-6 flex-1 flex flex-col justify-start py-6 max-w-[1280px] mx-auto px-6">
      <PageHeader
        title={`Dashboard ${formatRoleLabel(user?.role || "")}`}
        description={`Pusat kendali SIUBA • Selamat datang kembali, ${user?.name}.`}
      />

      {/* ========================================================================= */}
      {/* 1. ADMINISTRATOR EXECUTIVE DASHBOARD */}
      {/* ========================================================================= */}
      {user?.role === "administrator" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* SECTION 1: School Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Siswa aktif</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-500 font-data">
                  {students.filter(s => s.status === "Aktif").length}
                </span>
                <span className="text-[10px] text-zinc-400">anak</span>
              </div>
            </div>
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Guru aktif</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-500 font-data">
                  {teachers.length}
                </span>
                <span className="text-[10px] text-zinc-400">pengajar</span>
              </div>
            </div>
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Kelas aktif</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-500 font-data">
                  {classes.length}
                </span>
                <span className="text-[10px] text-zinc-400">tingkat</span>
              </div>
            </div>
            <div className="p-4 rounded-[20px] bg-gradient-to-br from-emerald-50/50 to-teal-50/20 dark:from-emerald-950/10 dark:to-teal-950/5 border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[#468432] dark:text-emerald-400 uppercase tracking-wider">Tahun ajaran</span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-500 mt-2 font-data">
                {activeAcademicYear ? activeAcademicYear.name : "Belum Diatur"}
              </span>
            </div>
            <div className="p-4 rounded-[20px] bg-gradient-to-br from-emerald-50/50 to-teal-50/20 dark:from-emerald-950/10 dark:to-teal-950/5 border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[#468432] dark:text-emerald-400 uppercase tracking-wider">Semester</span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-500 mt-2 font-data">
                {activeSemester ? `Semester ${activeSemester.name}` : "Belum Diatur"}
              </span>
            </div>
          </div>

          {/* SECTION 2: School Health Score */}
          {aggregators && (
            <div className="bg-white dark:bg-[#171717] p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Progress Ring */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="60" className="stroke-zinc-100 dark:stroke-zinc-800 fill-none" strokeWidth="12" />
                    <circle cx="72" cy="72" r="60" className="stroke-[#468432] fill-none" strokeWidth="12" 
                            strokeDasharray={String(2 * Math.PI * 60)} 
                            strokeDashoffset={2 * Math.PI * 60 * (1 - aggregators.overallHealthScore / 100)} 
                            strokeLinecap="round" />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50 font-data">{aggregators.overallHealthScore}</span>
                    <span className="text-[9px] block text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Skor kesehatan</span>
                  </div>
                </div>

                {/* Score Breakdown & Category */}
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">Dashboard kesehatan sekolah</h3>
                      <p className="text-xs text-zinc-500 mt-0.5 font-normal">Status operasional akademik & administrasi sekolah terintegrasi secara dinamis.</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-zinc-50/50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 ${getHealthColorClass(aggregators.healthCategory)}`}>
                      {aggregators.healthCategory}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500 font-medium">Ketuntasan akademik</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-250 font-data">{aggregators.academicCompletion}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${aggregators.academicCompletion}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500 font-medium">Ketuntasan karakter</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-250 font-data">{aggregators.characterCompletion}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#468432] rounded-full" style={{ width: `${aggregators.characterCompletion}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500 font-medium">Kehadiran guru</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-250 font-data">{aggregators.teacherAttendance}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${aggregators.teacherAttendance}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500 font-medium">Rasio pelunasan SPP</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-250 font-data">{aggregators.sppCompletion}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${aggregators.sppCompletion}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3 & 4: Progress Boards (Read-Only for Admin) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* SECTION 3: Academic Progress */}
            <div className="p-5 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#468432]" />
                  Kemajuan pengisian nilai
                </h3>
                <button
                  onClick={handleOpenAcademicMonitoring}
                  className="text-xs font-bold text-[#468432] hover:text-[#3a6f2b] dark:text-[#5aa142] dark:hover:text-[#6cb853] hover:underline cursor-pointer focus:outline-none"
                >
                  Lihat Detail
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100/50 dark:border-zinc-800/10 rounded-[12px]">
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Sudah isi</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-1 font-data">
                    {realAcademicStats.loading ? "..." : realAcademicStats.final}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100/50 dark:border-zinc-800/10 rounded-[12px]">
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Belum isi</span>
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-1 font-data">
                    {realAcademicStats.loading ? "..." : realAcademicStats.belumIsi}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100/50 dark:border-zinc-800/10 rounded-[12px]">
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Belum final</span>
                  <span className="text-lg font-black text-red-500 block mt-1 font-data">
                    {realAcademicStats.loading ? "..." : realAcademicStats.belumFinal}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 4: Character Progress */}
            <div className="p-5 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  Kemajuan pengisian budaya (SAHABAT)
                </h3>
                <button
                  onClick={handleOpenCultureMonitoring}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-450 dark:hover:text-rose-400 hover:underline cursor-pointer focus:outline-none"
                >
                  Lihat Detail
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100/50 dark:border-zinc-800/10 rounded-[12px]">
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Lengkap</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-405 block mt-1 font-data">
                    {realCultureStats.loading ? "..." : `${realCultureStats.lengkap}%`}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100/50 dark:border-zinc-800/10 rounded-[12px]">
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Sebagian</span>
                  <span className="text-lg font-black text-blue-500 block mt-1 font-data">
                    {realCultureStats.loading ? "..." : `${realCultureStats.sebagian}%`}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100/50 dark:border-zinc-800/10 rounded-[12px]">
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Kosong</span>
                  <span className="text-lg font-black text-red-500 block mt-1 font-data">
                    {realCultureStats.loading ? "..." : `${realCultureStats.kosong}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: Critical Alert */}
          {criticalAlerts.length > 0 && (
            <div className="bg-red-50/40 dark:bg-red-950/10 border border-red-200/80 dark:border-red-900/30 p-5 rounded-[20px] space-y-3 animate-fadeIn">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Pemberitahuan penting kepala sekolah
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {criticalAlerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="p-4 bg-surface-1 rounded-[16px] border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1"></div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-red-650 dark:text-red-400 block font-sans">
                        {alert.category}
                      </span>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{alert.title}</h4>
                      <p className="text-[10px] text-zinc-600 dark:text-zinc-350 mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6 & 7: Visual Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SECTION 6: Academic Analytics */}
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#468432]" />
                Distribusi nilai rata-rata per tingkat kelas
              </h3>
              <div className="h-64">
                {!statsData?.classAcademicAverages || statsData.classAcademicAverages.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-zinc-400">Belum ada data nilai akademik</span>
                  </div>
                ) : (
                  <ReChartsResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ReChartsBarChart data={statsData.classAcademicAverages.map(item => {
                      const name = item.name;
                      let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
                      cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
                      const cleanName = cleaned.startsWith("Kelas ") ? cleaned : `Kelas ${cleaned}`;
                      return {
                        ...item,
                        name: cleanName
                      };
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
            </div>

            {/* SECTION 7: Character Analytics */}
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                Rata-rata aspek FITRAH tingkat sekolah
              </h3>
              <div className="h-64">
                {!statsData?.fitrahRadarData || statsData.fitrahRadarData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs text-zinc-400">Belum ada data pembiasaan karakter</span>
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
            </div>
          </div>

          {/* SECTION 8: School Insights */}
          <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#468432]" />
              Wawasan utama sekolah
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/30 rounded-[12px]">
                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Pencapaian akademik kelas terbaik</span>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                  {statsData ? (() => {
                    const name = statsData.bestClassAcademicName;
                    let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
                    cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
                    return cleaned.startsWith("Kelas ") ? cleaned : `Kelas ${cleaned}`;
                  })() : "..."}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {statsData ? statsData.bestClassAcademicAvg : "Menganalisis rata-rata nilai akademik..."}
                </p>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/30 rounded-[12px]">
                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Guru paling produktif</span>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                  {statsData ? statsData.mostActiveTeacherName : "..."}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {statsData ? statsData.mostActiveTeacherDesc : "Menghitung aktivitas entri nilai..."}
                </p>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/30 rounded-[12px]">
                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Keteladanan karakter terbaik</span>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                  {statsData ? (() => {
                    const name = statsData.bestCultureClassName;
                    let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
                    cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
                    return cleaned.startsWith("Kelas ") ? cleaned : `Kelas ${cleaned}`;
                  })() : "..."}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {statsData ? statsData.bestCultureClassAvg : "Menghitung rasio kelayakan pembiasaan..."}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 9 & 10: Timeline & Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* SECTION 9: Recent Activities Timeline */}
            <div className="lg:col-span-2 p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-500" />
                Ringkasan aktivitas sekolah terbaru
              </h3>
              <div className="flow-root">
                <ul className="-mb-8">
                  {auditLogs.slice(0, 4).map((log, logIdx) => (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {logIdx !== auditLogs.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-zinc-100 dark:bg-zinc-800" aria-hidden="true"></span>
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center">
                              <Activity className="w-3.5 h-3.5 text-[#468432]" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200">{log.user_name}</span>{" "}
                              melakukan tindakan <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatAuditAction(log.action)}</span>
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{formatAuditDescription(log.description, log.action)}</p>
                          </div>
                          <div className="text-right text-[10px] whitespace-nowrap text-zinc-500 font-data">
                            {formatDate(log.created_at)}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SECTION 10: Quick Actions */}
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Aksi cepat administrator
                </h3>
                <div className="space-y-3">
                  <Link href="/students" className="flex items-center gap-2 p-2.5 rounded-[12px] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#262626]/40 dark:hover:bg-[#262626] border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer">
                    <UserPlus className="w-4 h-4 text-[#468432]" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Registrasi siswa baru</span>
                  </Link>
                  <Link href="/import" className="flex items-center gap-2 p-2.5 rounded-[12px] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#262626]/40 dark:hover:bg-[#262626] border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-[#468432]" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Impor berkas Excel</span>
                  </Link>
                  <Link href="/export" className="flex items-center gap-2 p-2.5 rounded-[12px] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#262626]/40 dark:hover:bg-[#262626] border border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer">
                    <FileDown className="w-4 h-4 text-[#468432]" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Unduh laporan rapor</span>
                  </Link>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OPERATOR ADMINISTRASI DASHBOARD */}
      {/* ========================================================================= */}
      {user?.role === "admin" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* SECTION 1: Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Siswa terdaftar</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50 block mt-2 font-data">{students.length}</span>
            </div>
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Total guru</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50 block mt-2 font-data">{teachers.length}</span>
            </div>
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Total kelas</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50 block mt-2 font-data">{classes.length}</span>
            </div>
            <div className="p-4 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Mata pelajaran</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50 block mt-2 font-data">{subjects.length}</span>
            </div>
            <div className="p-4 rounded-[20px] bg-gradient-to-br from-emerald-50/50 to-teal-50/20 dark:from-[#2d2d2d]/30 dark:to-[#171717]/30 border border-[#468432]/20 dark:border-zinc-800 shadow-sm">
              <span className="text-[10px] text-[#468432] dark:text-emerald-400 block font-bold uppercase tracking-wider">Kelengkapan berkas</span>
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50 block mt-2 font-data">
                {statsData ? `${statsData.docCompletionRate}%` : "..."}
              </span>
            </div>
          </div>

          {/* SECTION 2: Today's Tasks */}
          <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-250/70 dark:border-amber-900/30 p-5 rounded-[20px] space-y-3">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="w-4 h-4" />
              Tugas harian operator (hari ini)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-white dark:bg-[#171717] rounded-[16px] border border-amber-100 dark:border-amber-950/20 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Siswa belum terdaftar kelas</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Terdapat {students.filter(s => s.status === "Aktif" && !studentClassMap[s.id]).length} siswa belum terdaftar di kelas manapun.</p>
                </div>
                <Link href="/students" className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] rounded-lg cursor-pointer">Atur</Link>
              </div>
              <div className="p-3 bg-white dark:bg-[#171717] rounded-[16px] border border-amber-100 dark:border-amber-950/20 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-50">PIN portal orang tua belum dibuat</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {studentsWithoutPinCount > 0
                      ? `Terdapat ${studentsWithoutPinCount} anak didik aktif belum memiliki PIN akses portal wali.`
                      : "Semua wali murid dari anak didik aktif telah memiliki PIN portal."}
                  </p>
                </div>
                <Link href="/students" className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px] rounded-lg cursor-pointer">Buat PIN</Link>
              </div>
            </div>
          </div>

          {/* SECTION 3 & 4: Document & SPP Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SECTION 3: Document Completion */}
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#468432]" />
                Rasio kelengkapan berkas siswa
              </h3>
              <div className="h-60">
                {!statsData ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 text-[#468432] animate-spin" />
                    <span className="text-[10px] text-zinc-400">Memperbarui rasio berkas...</span>
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
            </div>

            {/* SECTION 4: SPP Overview */}
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Grafik aliran SPP semester berjalan
              </h3>
              <div className="h-60">
                {!statsData ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                    <span className="text-[10px] text-zinc-400">Memperbarui aliran SPP...</span>
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
            </div>
          </div>

          {/* SECTION 5 & 6: Data Quality & Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* SECTION 6: Data Quality Diagnostic */}
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#468432]" />
                Kualitas data & integritas basis data
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-medium">Duplikasi NIK siswa</span>
                  <span className={`font-bold font-data ${dataQualityStats.duplicateNIKCount > 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {dataQualityStats.duplicateNIKCount} temuan
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-medium">Duplikasi NISN</span>
                  <span className={`font-bold font-data ${dataQualityStats.duplicateNISNCount > 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {dataQualityStats.duplicateNISNCount} temuan
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-medium">Siswa tanpa kelas</span>
                  <span className={`font-bold font-data ${dataQualityStats.orphanStudentCount > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                    {dataQualityStats.orphanStudentCount} anak
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-medium">Tanggal lahir kosong</span>
                  <span className={`font-bold font-data ${dataQualityStats.missingBirthdateCount > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                    {dataQualityStats.missingBirthdateCount} anak
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 5: Import Export Activity logs */}
            <div className="lg:col-span-2 p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-zinc-500" />
                  Riwayat sinkronisasi & backup database
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 gap-2">
                    <div>
                      <span className="font-bold text-zinc-800 dark:text-zinc-400 block">Google Sheets backup terjadwal</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5">Status: {statsData?.lastBackupStatus || "Pending"}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-data self-start sm:self-center">{statsData?.lastBackupTime || "..."}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 gap-2">
                    <div>
                      <span className="font-bold text-zinc-800 dark:text-zinc-400 block">Pengecekan integritas sistem</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 break-all sm:break-normal">Status: {formatIntegrityStatus(statsData?.lastIntegrityCheckStatus || "Pending")}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-data self-start sm:self-center">{statsData?.lastIntegrityCheckTime || "..."}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 8: Quick Actions for Operator */}
              <div className="grid grid-cols-2 gap-2 pt-4">
                <Link href="/students" className="flex items-center justify-center gap-1 bg-[#468432] hover:bg-[#3A6F2B] text-white p-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5" /> Siswa baru
                </Link>
                <Link href="/import" className="flex items-center justify-center gap-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 p-2.5 rounded-[12px] text-xs font-bold transition-all cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Impor Excel
                </Link>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GURU PERSONAL DASHBOARD (TEACHER WORK CENTER) */}
      {/* ========================================================================= */}
      {user?.role === "teacher" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* SECTION 1: Hero */}
          <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#468432] dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-[#468432] animate-pulse"></span>
                Guru pengajar
              </span>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-500 mt-2">Selamat datang kembali, {user.name}</h3>
              <p className="text-xs text-zinc-500 font-data mt-0.5">{user.email}</p>
            </div>
            <div className="flex gap-4 border-t md:border-t-0 md:border-l border-zinc-100 dark:border-zinc-800 pt-4 md:pt-0 md:pl-6 text-xs text-zinc-500">
              <div>
                <span className="block font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Tahun ajaran</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 font-data block mt-1">{activeAcademicYear ? activeAcademicYear.name : "-"}</span>
              </div>
              <div>
                <span className="block font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Semester</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-1">{activeSemester ? `Semester ${activeSemester.name}` : "-"}</span>
              </div>
            </div>
          </div>          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Perwalian kelas</span>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                  {myClasses.length > 0 ? myClasses[0].class_name : "Tidak ada perwalian aktif"}
                </h4>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-[#468432] dark:text-emerald-400">
                <School className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Jumlah mengajar</span>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-data">
                  {myClasses.length} kelas
                </h4>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl text-blue-600 dark:text-blue-400">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Siswa diampu</span>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-data">
                  {teacherStudents.length} anak
                </h4>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-amber-600 dark:text-amber-400">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* SECTION 2: Today's Schedule */}
          <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#468432]" />
              Jadwal dan agenda mengajar hari ini
            </h3>
            <div className="space-y-3">
              {myClasses.length > 0 ? (
                myClasses.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-[12px] bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/30">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50 block">{item.class_name}</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 block font-data">Kode: {item.class_code}</span>
                    </div>
                    <span className="text-xs font-bold text-[#468432] dark:text-emerald-400 font-sans">Sesi Aktif</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 italic text-center py-4">Belum ada kelas mengajar hari ini.</p>
              )}
            </div>
          </div>

          {/* SECTION 3: Today's Tasks */}
          <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-250/70 dark:border-amber-900/30 p-5 rounded-[20px] space-y-3">
            <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="w-4 h-4" />
              Tugas mengajar tertunda
            </h3>
            {teacherPendingTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teacherPendingTasks.map((task) => (
                  <Link key={task.id} href={task.href} className="p-3 bg-white dark:bg-[#171717] rounded-[16px] border border-amber-100 dark:border-amber-950/20 shadow-sm flex items-center justify-between hover:border-amber-500 transition-colors cursor-pointer">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-400 block">{task.category}</span>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">{task.title}</h4>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{task.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#171717] p-6 rounded-[16px] border border-amber-100 dark:border-amber-950/20 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-350">Luar biasa! Tidak ada tugas tertunda untuk hari ini.</p>
              </div>
            )}
          </div>

          {/* SECTION 4 & 5: Academic & Culture Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* SECTION 4: Academic Progress */}
            <div className="p-5 bg-white dark:bg-[#171717] rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#468432]" />
                Kemajuan pengisian nilai akademik
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-500 font-medium">Beban evaluasi selesai (locked)</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 font-data">
                      {teacherAcademicStats.completedCount} <span className="font-sans font-normal text-zinc-400 text-[10px]">dari</span> {teacherAcademicStats.totalCount} ({teacherAcademicStats.academicProgressPercent}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${teacherAcademicStats.academicProgressPercent}%` }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/10 rounded-[12px]">
                    <span className="text-[10px] text-zinc-400 block font-bold uppercase">Sudah final</span>
                    <span className="text-sm font-black text-zinc-850 dark:text-zinc-100 mt-1 block font-data">{teacherAcademicStats.completedCount}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/10 rounded-[12px]">
                    <span className="text-[10px] text-zinc-400 block font-bold uppercase">Masih draf</span>
                    <span className="text-sm font-black text-zinc-850 dark:text-zinc-100 mt-1 block font-data">{teacherAcademicStats.pendingCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Culture Progress */}
            <div className="p-5 bg-white dark:bg-[#171717] rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                Kemajuan pengisian budaya (SAHABAT)
              </h3>
              {teacherCulture && teacherCulture.class_summary ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500 font-medium">Rata-rata cakupan harian kelas</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 font-data">
                        {teacherCulture.class_summary.average_coverage_percent}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${teacherCulture.class_summary.average_coverage_percent}%` }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/10 rounded-[12px]">
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase">Siswa lengkap</span>
                      <span className="text-sm font-black text-zinc-850 dark:text-zinc-100 mt-1 block font-data">
                        {teacherCulture.class_summary.complete_students} anak
                      </span>
                    </div>
                    <div className="p-2.5 bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-100 dark:border-zinc-800/10 rounded-[12px]">
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase">Siswa kosong</span>
                      <span className="text-sm font-black text-zinc-850 dark:text-zinc-100 mt-1 block font-data">
                        {teacherCulture.class_summary.empty_students} anak
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic py-4 text-center">Data rekapitulasi budaya belum tersedia untuk semester ini.</p>
              )}
            </div>

          </div>

          {/* SECTION 7: Reminder */}
          <div className="bg-amber-50/20 dark:bg-amber-950/10 border border-amber-250/70 dark:border-amber-900/30 p-5 rounded-[20px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Pengingat batas waktu penting guru
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-350 leading-relaxed">
                Penguncian semester aktif dijadwalkan pada tanggal <strong>{activeSemester?.end_date ? new Date(activeSemester.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "akhir semester"}</strong>. Pastikan semua draf penilaian akademik dikunci dan rekap pembiasaan budaya SAHABAT diisi secara penuh demi kelancaran penerbitan rapor murid.
              </p>
            </div>
          </div>

          {/* SECTION 8: Analytics */}
          {teacherAnalyticsData && (
            <div className="p-6 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#468432]" />
                Distribusi pencapaian nilai rata-rata kelas perwalian
              </h3>
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
            </div>
          )}

          {/* SECTION 9: Quick Actions */}
          <div className="p-5 rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
              Aksi cepat guru
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/academic-scores" className="flex items-center justify-center gap-1.5 p-3 rounded-[12px] bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-200 dark:border-zinc-800 hover:bg-[#468432] hover:text-white transition-all text-xs font-bold cursor-pointer">
                Input nilai
              </Link>
              <Link href="/daily-culture" className="flex items-center justify-center gap-1.5 p-3 rounded-[12px] bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-200 dark:border-zinc-800 hover:bg-[#468432] hover:text-white transition-all text-xs font-bold cursor-pointer">
                Input karakter
              </Link>
              <Link href="/presence" className="flex items-center justify-center gap-1.5 p-3 rounded-[12px] bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-200 dark:border-zinc-800 hover:bg-[#468432] hover:text-white transition-all text-xs font-bold cursor-pointer">
                Presensi kelas
              </Link>
              <Link href="/my-class" className="flex items-center justify-center gap-1.5 p-3 rounded-[12px] bg-zinc-50 dark:bg-[#262626]/40 border border-zinc-200 dark:border-zinc-800 hover:bg-[#468432] hover:text-white transition-all text-xs font-bold cursor-pointer">
                Catatan wali
              </Link>
            </div>
          </div>

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
    </ResponsiveContainer>
  );
}
