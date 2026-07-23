import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { HealthSection, HealthIssue } from "./types";
import { HEALTH_CODES } from "./codes";
import { getWebsiteConfig } from "@/lib/services/websiteConfigService";
import { getActiveAcademicYear } from "@/lib/services/academicYearService";
import { getActiveSemester } from "@/lib/services/semesterService";

export async function checkActiveAcademicYear(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  let activeYearId: string | null = null;
  let activeYearName: string | null = null;
  let activeYearStatus: string | null = null;
  let activeCount = 0;

  try {
    const activeYear = await getActiveAcademicYear();

    if (activeYear) {
      activeYearId = activeYear.id;
      activeYearName = activeYear.name;
      activeYearStatus = "active";
      activeCount = 1;
      status = "healthy";
    } else {
      activeCount = 0;
      status = "warning";
      issues.push({
        code: HEALTH_CODES.CONFIG_ACADEMIC_YEAR_NOT_FOUND,
        severity: "warning",
        message: "Tidak ada Tahun Ajaran aktif ditemukan.",
        technical_details: { active_count: 0 },
      });
    }
  } catch (error) {
    status = "critical";
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "critical",
      message: "Gagal memeriksa konfigurasi Tahun Ajaran aktif.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_academic_year",
    title: "Tahun Ajaran Aktif",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      active_academic_year_id: activeYearId,
      name: activeYearName,
      status: activeYearStatus || "not_set",
      active_count: activeCount,
    },
  };
}

export async function checkActiveSemester(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  let activeSemesterId: string | null = null;
  let activeSemesterName: string | null = null;
  let activeSemesterStatus: string | null = null;
  let activeCount = 0;

  try {
    const activeYear = await getActiveAcademicYear();
    if (!activeYear) {
      activeCount = 0;
      status = "warning";
      issues.push({
        code: HEALTH_CODES.CONFIG_SEMESTER_NOT_FOUND,
        severity: "warning",
        message: "Tidak ada Semester aktif ditemukan karena tidak ada Tahun Ajaran aktif.",
        technical_details: { active_count: 0, reason: "no_active_academic_year" },
      });
    } else {
      const activeSemester = await getActiveSemester(activeYear.id);
      if (activeSemester) {
        activeSemesterId = activeSemester.id;
        activeSemesterName = activeSemester.name;
        activeSemesterStatus = "active";
        activeCount = 1;
        status = "healthy";
      } else {
        activeCount = 0;
        status = "warning";
        issues.push({
          code: HEALTH_CODES.CONFIG_SEMESTER_NOT_FOUND,
          severity: "warning",
          message: "Tidak ada Semester aktif ditemukan.",
          technical_details: { active_count: 0 },
        });
      }
    }
  } catch (error) {
    status = "critical";
    issues.push({
      code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
      severity: "critical",
      message: "Gagal memeriksa konfigurasi Semester aktif.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_semester",
    title: "Semester Aktif",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      active_semester_id: activeSemesterId,
      name: activeSemesterName,
      status: activeSemesterStatus || "not_set",
      active_count: activeCount,
    },
  };
}

export async function checkSchoolProfile(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  let schoolName = "";
  let address = "";
  let phone = "";
  let email = "";

  try {
    const config = await getWebsiteConfig();
    schoolName = config.school_name || "";
    address = [config.address_street, config.address_village, config.address_district, config.address_regency]
      .filter(Boolean)
      .join(", ");
    phone = config.contact_phone_display || config.contact_phone_raw || "";
    email = config.contact_email || "";

    const missingFields: string[] = [];
    if (!schoolName) missingFields.push("school_name");
    if (!address) missingFields.push("address");
    if (!phone) missingFields.push("phone");
    if (!email) missingFields.push("email");

    if (missingFields.length > 0) {
      status = "warning";
      issues.push({
        code: HEALTH_CODES.CONFIG_SCHOOL_PROFILE_INCOMPLETE,
        severity: "warning",
        message: "Konfigurasi profil sekolah belum lengkap.",
        technical_details: { missing_fields: missingFields },
      });
    }
  } catch (error) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.CONFIG_SCHOOL_PROFILE_INCOMPLETE,
      severity: "warning",
      message: "Gagal mengambil data profil sekolah.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_school_profile",
    title: "Profil Sekolah",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      school_name: schoolName || "Belum diatur",
      address: address || "Belum diatur",
      phone: phone || "Belum diatur",
      email: email || "Belum diatur",
    },
  };
}

export async function checkBrandingConfiguration(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  let appName = "";
  let logoConfigured = false;
  let faviconConfigured = false;

  try {
    const config = await getWebsiteConfig();
    appName = config.short_name || config.school_name || "SIUBA";
    logoConfigured = Boolean(config.logo_id || config.logo?.url);
    
    // Check favicon in config or physical file public/favicon.ico
    const physicalFavicon = fs.existsSync(path.join(process.cwd(), "public", "favicon.ico"));
    faviconConfigured = Boolean(config.favicon_id || config.favicon?.url || physicalFavicon);

    if (!appName || (!logoConfigured && !faviconConfigured)) {
      status = "warning";
      issues.push({
        code: HEALTH_CODES.CONFIG_BRANDING_INCOMPLETE,
        severity: "warning",
        message: "Konfigurasi branding (nama aplikasi/logo/favicon) belum lengkap.",
        technical_details: { app_name: appName, logoConfigured, faviconConfigured },
      });
    }
  } catch (error) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.CONFIG_BRANDING_INCOMPLETE,
      severity: "warning",
      message: "Gagal memeriksa konfigurasi identitas/branding.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_branding",
    title: "Konfigurasi Branding",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      app_name: appName,
      logo_configured: logoConfigured,
      favicon_configured: faviconConfigured,
    },
  };
}

export async function checkStorageConfiguration(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  const storageDir = path.join(process.cwd(), "storage");
  const uploadDirConfigured = fs.existsSync(storageDir);

  // Check backup dir config (storage/backup or backup_snapshots table)
  let backupDirConfigured = false;
  try {
    const backupTableExists = await db.schema.hasTable("backup_snapshots");
    backupDirConfigured = backupTableExists;
  } catch {
    backupDirConfigured = false;
  }

  if (!uploadDirConfigured) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.CONFIG_STORAGE_NOT_CONFIGURED,
      severity: "warning",
      message: "Direktori penyimpanan utama tidak terkonfigurasi.",
      technical_details: { path: storageDir },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_storage",
    title: "Konfigurasi Penyimpanan Berkas",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      upload_dir_configured: uploadDirConfigured,
      backup_dir_configured: backupDirConfigured,
      upload_path: storageDir,
    },
  };
}

export async function checkAuditConfiguration(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  let auditTableExists = false;

  try {
    auditTableExists = await db.schema.hasTable("audit_logs");
    if (!auditTableExists) {
      status = "critical";
      issues.push({
        code: HEALTH_CODES.CONFIG_AUDIT_NOT_CONFIGURED,
        severity: "critical",
        message: "Tabel audit (audit_logs) tidak ditemukan di database.",
        technical_details: { table: "audit_logs" },
      });
    }
  } catch (error) {
    status = "critical";
    issues.push({
      code: HEALTH_CODES.CONFIG_AUDIT_NOT_CONFIGURED,
      severity: "critical",
      message: "Gagal memeriksa ketersediaan tabel audit.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_audit",
    title: "Konfigurasi Catatan Aktivitas (Audit)",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      audit_table_exists: auditTableExists,
      table_name: "audit_logs",
    },
  };
}

export async function checkEnvironmentConfiguration(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  const envsToCheck = [
    { name: "DB_HOST", key: process.env.DB_HOST },
    { name: "DB_NAME", key: process.env.DB_NAME },
    { name: "NODE_ENV", key: process.env.NODE_ENV },
  ];

  const envDetails: Record<string, string> = {};
  const missingEnvs: string[] = [];

  for (const env of envsToCheck) {
    if (env.key && env.key.trim() !== "") {
      envDetails[env.name] = "configured";
    } else {
      envDetails[env.name] = "not_configured";
      missingEnvs.push(env.name);
    }
  }

  if (missingEnvs.length > 0) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.CONFIG_ENV_MISSING,
      severity: "warning",
      message: `Variabel lingkungan belum terkonfigurasi lengkap: ${missingEnvs.join(", ")}`,
      technical_details: { missing_envs: missingEnvs },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "config_environment",
    title: "Konfigurasi Variabel Lingkungan (ENV)",
    category: "configuration",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: envDetails,
  };
}
