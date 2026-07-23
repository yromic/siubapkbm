import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { HealthSection, HealthIssue } from "./types";
import { HEALTH_CODES } from "./codes";

export async function checkDatabaseConnectivity(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";
  let latencyMs = 0;

  const dbName = process.env.DB_NAME || "siuba_dev";
  const driver = "mysql2";

  try {
    const pingStart = Date.now();
    await db.raw("SELECT 1");
    latencyMs = Date.now() - pingStart;
  } catch (error) {
    status = "critical";
    issues.push({
      code: HEALTH_CODES.DB_CONNECTIVITY_FAILED,
      severity: "critical",
      message: "Database connection failed. Unable to reach database server.",
      technical_details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "database_connectivity",
    title: "Konektivitas Database",
    category: "infrastructure",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      latency_ms: latencyMs,
      driver,
      database_name: dbName,
    },
  };
}

export async function checkDatabaseAccessibility(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];
  let status: HealthSection["status"] = "healthy";
  let userCount = 0;

  try {
    const result = await db("users").count("* as count").first();
    userCount = Number(result?.count || 0);
  } catch (error) {
    status = "critical";
    issues.push({
      code: HEALTH_CODES.DB_ACCESSIBILITY_FAILED,
      severity: "critical",
      message: "Database query execution failed. Unable to query core tables.",
      technical_details: {
        error: error instanceof Error ? error.message : String(error),
        table: "users",
      },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "database_accessibility",
    title: "Aksesibilitas Database",
    category: "infrastructure",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      user_count: userCount,
      table_queried: "users",
    },
  };
}

export async function checkStorage(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];

  const storageDir = path.join(process.cwd(), "storage");
  let exists = false;
  let readable = false;
  let writable = false;

  try {
    exists = fs.existsSync(storageDir);
    if (!exists) {
      issues.push({
        code: HEALTH_CODES.STORAGE_MISSING,
        severity: "critical",
        message: "Direktori penyimpanan (storage) tidak ditemukan.",
        technical_details: { path: storageDir },
      });
    } else {
      try {
        fs.accessSync(storageDir, fs.constants.R_OK);
        readable = true;
      } catch (e) {
        issues.push({
          code: HEALTH_CODES.STORAGE_UNREADABLE,
          severity: "critical",
          message: "Direktori penyimpanan tidak dapat dibaca.",
          technical_details: {
            error: e instanceof Error ? e.message : String(e),
            path: storageDir,
          },
        });
      }

      const tempFileName = `.health_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`;
      const tempFilePath = path.join(storageDir, tempFileName);

      try {
        fs.writeFileSync(tempFilePath, "health_check_test_content", "utf8");
        writable = true;
      } catch (e) {
        issues.push({
          code: HEALTH_CODES.STORAGE_UNWRITABLE,
          severity: "critical",
          message: "Gagal menulis berkas sementara pada direktori penyimpanan.",
          technical_details: {
            error: e instanceof Error ? e.message : String(e),
            path: storageDir,
          },
        });
      } finally {
        if (fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            issues.push({
              code: HEALTH_CODES.STORAGE_CLEANUP_FAILED,
              severity: "warning",
              message: "Gagal membersihkan berkas sementara uji penyimpanan.",
              technical_details: {
                error: e instanceof Error ? e.message : String(e),
                temp_file: tempFilePath,
              },
            });
          }
        }
      }
    }
  } catch (error) {
    issues.push({
      code: HEALTH_CODES.STORAGE_MISSING,
      severity: "critical",
      message: "Kesalahan tidak terduga saat memeriksa direktori penyimpanan.",
      technical_details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const status: HealthSection["status"] = hasCritical
    ? "critical"
    : hasWarning
      ? "warning"
      : "healthy";

  const durationMs = Date.now() - startTime;

  return {
    id: "storage",
    title: "Penyimpanan Berkas",
    category: "infrastructure",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      exists,
      readable,
      writable,
      path: storageDir,
    },
  };
}

export async function checkRuntime(): Promise<HealthSection> {
  const startTime = Date.now();
  const issues: HealthIssue[] = [];

  let status: HealthSection["status"] = "healthy";
  let nodeVersion = "";
  let uptimeSeconds = 0;
  let memoryUsage: Record<string, number> = {};
  let platform = "";

  try {
    nodeVersion = process.version;
    uptimeSeconds = Math.floor(process.uptime());
    memoryUsage = process.memoryUsage() as unknown as Record<string, number>;
    platform = process.platform;
  } catch (error) {
    status = "warning";
    issues.push({
      code: HEALTH_CODES.RUNTIME_CHECK_FAILED,
      severity: "warning",
      message: "Gagal mengambil statistik runtime Node.js.",
      technical_details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    id: "runtime",
    title: "Runtime Node.js",
    category: "infrastructure",
    status,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    issues,
    details: {
      node_version: nodeVersion,
      uptime_seconds: uptimeSeconds,
      memory_usage: memoryUsage,
      platform,
    },
  };
}
