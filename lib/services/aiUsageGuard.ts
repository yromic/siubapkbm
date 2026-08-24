import { db } from "@/lib/db";
import { getGeminiConfig, AIGenerationSource, AIFallbackReason } from "@/lib/config/gemini";
import { v4 as uuidv4 } from "uuid";

export type AIFeatureType =
  | "KKTP_ASSESSMENT"
  | "TP_GENERATOR"
  | "RPM_GENERATOR"
  | "TRISULA_ASSESSMENT"
  | "TRISULA_REPORT";

export interface AIUsageWindowDetail {
  used: number;
  limit: number | null;
  remaining: number | null;
  limited: boolean;
}

export interface AIUsageSnapshot {
  provider: string;
  model: string;
  scope: "LOCAL_SIUBA_ESTIMATE";
  rpm: AIUsageWindowDetail;
  rpd: AIUsageWindowDetail & { resetAt?: string };
}

export interface AIUsageLimitCheckResult {
  allowed: boolean;
  blockedReason?: "LOCAL_RPM_LIMIT" | "LOCAL_RPD_LIMIT";
  snapshot: AIUsageSnapshot;
}

export interface RecordAIAttemptParams {
  userId?: string | null;
  feature: AIFeatureType;
  provider?: string;
  model: string;
  source: AIGenerationSource;
  providerHttpStatus?: number | null;
  providerErrorReason?: AIFallbackReason | string | null;
  durationMs?: number | null;
  retryAttempt?: number;
  requestStartedAt?: Date | null;
}

let tableEnsured = false;

/**
 * Memastikan tabel ai_usage_events tersedia di MySQL tanpa crash jika migrasi CLI belum dijalankan.
 */
export async function ensureAIUsageTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    const hasTable = await db.schema.hasTable("ai_usage_events");
    if (!hasTable) {
      await db.raw(`
        CREATE TABLE IF NOT EXISTS \`ai_usage_events\` (
          \`id\` CHAR(36) NOT NULL,
          \`user_id\` CHAR(36) NULL,
          \`feature\` VARCHAR(50) NOT NULL,
          \`provider\` VARCHAR(50) NOT NULL DEFAULT 'GEMINI',
          \`model\` VARCHAR(100) NOT NULL,
          \`source\` VARCHAR(20) NOT NULL DEFAULT 'GEMINI',
          \`provider_http_status\` INT NULL,
          \`provider_error_reason\` VARCHAR(50) NULL,
          \`duration_ms\` INT NULL,
          \`retry_attempt\` INT NOT NULL DEFAULT 1,
          \`request_started_at\` DATETIME NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          INDEX \`idx_ai_usage_lookup\` (\`provider\`, \`model\`, \`created_at\`),
          INDEX \`idx_ai_usage_created_at\` (\`created_at\`),
          INDEX \`idx_ai_usage_feature\` (\`feature\`),
          INDEX \`idx_ai_usage_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }
    tableEnsured = true;
  } catch (err) {
    console.error("[aiUsageGuard] Warning: Failed to verify ai_usage_events table:", err);
  }
}

/**
 * getGeminiQuotaDayBoundary
 *
 * Menghitung batas awal hari reset kuota harian Google (00:00 US Pacific Time / UTC-8).
 */
export function getGeminiQuotaDayBoundary(): { dayStart: Date; nextResetAt: Date } {
  const now = new Date();
  // Konversi ke zona waktu Pacific (America/Los_Angeles)
  const pacificTimeString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const pacificDate = new Date(pacificTimeString);

  // Awal hari pacific saat ini
  const pacificStartOfDay = new Date(pacificDate);
  pacificStartOfDay.setHours(0, 0, 0, 0);

  // Selisih offset antara waktu lokal dan waktu Pasifik
  const offsetDiffMs = now.getTime() - pacificDate.getTime();
  const dayStart = new Date(pacificStartOfDay.getTime() + offsetDiffMs);

  // Reset berikutnya adalah 24 jam setelah awal hari pacific saat ini
  const nextResetAt = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return { dayStart, nextResetAt };
}

/**
 * classifyProvider429
 *
 * Membedakan short-term rate limit (RPM/TPM) dari daily quota exhaustion (RPD)
 * berdasarkan isi respons resmi dari Google gateway.
 */
export function classifyProvider429(status: number, responseBodyText: string): AIFallbackReason {
  if (status !== 429) {
    return status >= 500 ? "HTTP_ERROR" : "HTTP_ERROR";
  }

  const text = (responseBodyText || "").toLowerCase();

  // Indikator Daily Quota Exhaustion resmi dari Google API
  if (
    text.includes("quota") &&
    (text.includes("perday") ||
      text.includes("daily") ||
      text.includes("day") ||
      text.includes("resource_exhausted") ||
      text.includes("28 days") ||
      text.includes("exceeded your current quota"))
  ) {
    return "DAILY_QUOTA";
  }

  // Indikator Short-term Rate Limit (RPM / TPM)
  if (
    text.includes("rate limit") ||
    text.includes("per minute") ||
    text.includes("rpm") ||
    text.includes("tpm") ||
    text.includes("too many requests")
  ) {
    return "RATE_LIMIT";
  }

  // Default jika 429 tapi teks tidak spesifik
  return "RATE_LIMIT";
}

/**
 * checkAIUsageLimit
 *
 * Melakukan pengecekan rolling RPM (60 detik) dan RPD (harian) terhadap limit lokal SIUBA.
 */
export async function checkAIUsageLimit(targetModel?: string): Promise<AIUsageLimitCheckResult> {
  const config = getGeminiConfig();
  const model = targetModel || config.model;
  await ensureAIUsageTable();

  const { dayStart, nextResetAt } = getGeminiQuotaDayBoundary();
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);

  let rpmCount = 0;
  let rpdCount = 0;

  try {
    // 1. Hitung request dalam 60 detik terakhir untuk model ini
    const rpmRow = await db("ai_usage_events")
      .where("provider", "GEMINI")
      .where("model", model)
      .where("created_at", ">=", sixtySecondsAgo)
      .count("id as count")
      .first();

    rpmCount = Number(rpmRow?.count || 0);

    // 2. Hitung request hari ini (sejak awal hari reset kuota)
    const rpdRow = await db("ai_usage_events")
      .where("provider", "GEMINI")
      .where("model", model)
      .where("created_at", ">=", dayStart)
      .count("id as count")
      .first();

    rpdCount = Number(rpdRow?.count || 0);
  } catch (err) {
    console.error("[aiUsageGuard] Failed to query usage counts from DB:", err);
    // Jika DB error, fail-open agar fitur tidak mati karena query counter
  }

  const rpmLimit = config.rpmLimit;
  const rpdLimit = config.rpdLimit;

  const rpmLimited = rpmLimit !== null && rpmCount >= rpmLimit;
  const rpdLimited = rpdLimit !== null && rpdCount >= rpdLimit;

  let allowed = true;
  let blockedReason: "LOCAL_RPM_LIMIT" | "LOCAL_RPD_LIMIT" | undefined = undefined;

  if (rpdLimited) {
    allowed = false;
    blockedReason = "LOCAL_RPD_LIMIT";
  } else if (rpmLimited) {
    allowed = false;
    blockedReason = "LOCAL_RPM_LIMIT";
  }

  const snapshot: AIUsageSnapshot = {
    provider: "GEMINI",
    model,
    scope: "LOCAL_SIUBA_ESTIMATE",
    rpm: {
      used: rpmCount,
      limit: rpmLimit,
      remaining: rpmLimit !== null ? Math.max(0, rpmLimit - rpmCount) : null,
      limited: rpmLimited,
    },
    rpd: {
      used: rpdCount,
      limit: rpdLimit,
      remaining: rpdLimit !== null ? Math.max(0, rpdLimit - rpdCount) : null,
      limited: rpdLimited,
      resetAt: nextResetAt.toISOString(),
    },
  };

  return { allowed, blockedReason, snapshot };
}

/**
 * recordAIUsageAttempt
 *
 * Mencatat 1 event percobaan request AI ke tabel persistensi ai_usage_events.
 */
export async function recordAIUsageAttempt(params: RecordAIAttemptParams): Promise<void> {
  await ensureAIUsageTable();
  try {
    await db("ai_usage_events").insert({
      id: uuidv4(),
      user_id: params.userId || null,
      feature: params.feature,
      provider: params.provider || "GEMINI",
      model: params.model,
      source: params.source,
      provider_http_status: params.providerHttpStatus || null,
      provider_error_reason: params.providerErrorReason || null,
      duration_ms: params.durationMs !== undefined && params.durationMs !== null ? Math.round(params.durationMs) : null,
      retry_attempt: params.retryAttempt || 1,
      request_started_at: params.requestStartedAt || new Date(),
      created_at: new Date(),
    });
  } catch (err) {
    console.error("[aiUsageGuard] Warning: Failed to insert AI usage record:", err);
  }
}

/**
 * getAIUsageSnapshot
 *
 * Mengambil ringkasan penggunaan AI lokal untuk endpoint GET /api/v1/ai/usage.
 */
export async function getAIUsageSnapshot(targetModel?: string): Promise<AIUsageSnapshot> {
  const result = await checkAIUsageLimit(targetModel);
  return result.snapshot;
}
