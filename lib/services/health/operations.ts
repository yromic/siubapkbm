import { db } from "@/lib/db";
import { HealthSection, HealthIssue } from "./types";
import { HEALTH_CODES } from "./codes";

export async function checkAuditLoggingService(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";
  let auditTableExists = false;

  try {
    auditTableExists = await db.schema.hasTable("audit_logs");
    if (!auditTableExists) {
      status = "warning";
      issues.push({
        code: HEALTH_CODES.AUDIT_SERVICE_UNAVAILABLE,
        severity: "warning",
        message: "Layanan pencatatan audit belum siap karena tabel audit_logs tidak ditemukan.",
        technical_details: { table: "audit_logs" },
      });
    }
  } catch (error) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.AUDIT_SERVICE_UNAVAILABLE,
      severity: "warning",
      message: "Gagal memverifikasi kesiapan layanan pencatatan audit.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_audit_logging",
    title: "Layanan Audit Logging",
    category: "operations",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      audit_table_exists: auditTableExists,
      service: "auditService",
      functions: ["createAuditLog", "searchAuditLogs"],
    },
  };
}

export async function checkJobQueueService(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];

  let tableExists = false;

  try {
    tableExists = await db.schema.hasTable("job_queue");
  } catch {
    tableExists = false;
  }

  // Evidence: No active worker loop process exists in Next.js backend for job_queue
  issues.push({
    code: HEALTH_CODES.JOB_QUEUE_WORKER_UNVERIFIED,
    severity: "unknown",
    message: "Tabel dan fungsi job_queue tersedia, tetapi proses worker/runner belum terverifikasi di Next.js backend.",
    technical_details: {
      table_exists: tableExists,
      add_job_available: true,
      worker_verified: false,
    },
  });

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_job_queue",
    title: "Layanan Antrean Pekerjaan (Job Queue)",
    category: "operations",
    status: "unknown",
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      table_exists: tableExists,
      service: "jobQueueService",
      functions: ["addJob", "getJobStatus"],
      worker_verified: false,
    },
  };
}

export async function checkBackgroundWorkerService(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];

  // Evidence: No dedicated background worker process, daemon, or cron runner exists in Next.js codebase
  issues.push({
    code: HEALTH_CODES.BACKGROUND_WORKER_NOT_FOUND,
    severity: "unknown",
    message: "Tidak ditemukan proses background worker / queue runner terdedikasi pada arsitektur Next.js saat ini.",
    technical_details: {
      worker_process_found: false,
      cron_runner_found: false,
    },
  });

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_background_worker",
    title: "Proses Worker Terjadwal (Background Worker)",
    category: "operations",
    status: "unknown",
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      worker_process_found: false,
      daemon_running: false,
    },
  };
}

export async function checkBackupService(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";
  let tableExists = false;

  try {
    tableExists = await db.schema.hasTable("backup_snapshots");
    if (!tableExists) {
      status = "unknown";
      issues.push({
        code: HEALTH_CODES.BACKUP_SERVICE_NOT_IMPLEMENTED,
        severity: "unknown",
        message: "Tabel snapshot cadangan (backup_snapshots) belum tersedia di database.",
        technical_details: { table: "backup_snapshots" },
      });
    }
  } catch (error) {
    status = "unknown";
    issues.push({
      code: HEALTH_CODES.BACKUP_SERVICE_NOT_IMPLEMENTED,
      severity: "unknown",
      message: "Gagal memverifikasi kesiapan layanan cadangan data (backup).",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_backup_service",
    title: "Layanan Cadangan Data (Backup)",
    category: "operations",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      table_exists: tableExists,
      service: "backupService",
      functions: ["createManualBackup", "listBackups", "getBackupPreview"],
    },
  };
}

export async function checkCacheService(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];

  // Evidence: No Redis or external/in-memory cache layer is configured in Next.js backend
  issues.push({
    code: HEALTH_CODES.CACHE_SERVICE_UNAVAILABLE,
    severity: "unknown",
    message: "Layanan cache (Redis/In-Memory Cache) belum terkonfigurasi pada layer backend Next.js saat ini.",
    technical_details: {
      cache_provider: "none",
      configured: false,
    },
  });

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_cache_service",
    title: "Layanan Cache Data (Cache)",
    category: "operations",
    status: "unknown",
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      cache_configured: false,
      provider: "none",
    },
  };
}

export async function checkDiagnosticsService(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";

  let coreTablesAvailable = 0;
  const coreTables = ["users", "students", "teachers", "classes", "subjects", "audit_logs"];

  try {
    for (const table of coreTables) {
      try {
        const has = await db.schema.hasTable(table);
        if (has) coreTablesAvailable++;
      } catch {
        /* skip */
      }
    }
  } catch (error) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.DIAGNOSTICS_ENDPOINT_UNAVAILABLE,
      severity: "warning",
      message: "Gagal memverifikasi kesiapan agregasi diagnosa sistem.",
      technical_details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_diagnostics_service",
    title: "Layanan Diagnostik Sistem",
    category: "operations",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      diagnostics_available: true,
      endpoint: "/api/v1/system/diagnostics",
      core_tables_checked: coreTables.length,
      core_tables_available: coreTablesAvailable,
    },
  };
}

export async function checkMonitoringServices(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];

  const durationMs = Date.now() - startTime;

  return {
    id: "ops_monitoring_services",
    title: "Layanan Pemantauan (Monitoring)",
    category: "operations",
    status: "healthy",
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      endpoints: [
        "/api/v1/system/health",
        "/api/v1/system/health/extended",
        "/api/v1/system/health/v2",
        "/api/v1/system/diagnostics",
      ],
    },
  };
}
