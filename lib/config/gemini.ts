// lib/config/gemini.ts — Centralized Gemini AI Configuration & Source Types

export type AIGenerationSource = 'GEMINI' | 'FALLBACK';

export type AIFallbackReason =
  | 'NO_API_KEY'
  | 'HTTP_ERROR'
  | 'RATE_LIMIT'
  | 'DAILY_QUOTA'
  | 'LOCAL_RPM_LIMIT'
  | 'LOCAL_RPD_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_SCHEMA'
  | 'UNKNOWN';

export interface GeminiConfig {
  apiKey: string | null;
  isConfigured: boolean;
  model: string;
  endpointUrl: string | null;
  rpmLimit: number | null;
  rpdLimit: number | null;
}

function parseEnvLimit(val: string | undefined): number | null {
  if (!val || typeof val !== 'string') return null;
  const parsed = parseInt(val.trim(), 10);
  if (isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * getGeminiConfig
 *
 * Membaca GEMINI_API_KEY, GEMINI_MODEL, GEMINI_RPM_LIMIT, dan GEMINI_RPD_LIMIT dari environment.
 * Nilai API key tidak pernah dibocorkan ke client atau log.
 */
export function getGeminiConfig(): GeminiConfig {
  const rawKey = process.env.GEMINI_API_KEY;
  const apiKey = typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : null;
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const rpmLimit = parseEnvLimit(process.env.GEMINI_RPM_LIMIT);
  const rpdLimit = parseEnvLimit(process.env.GEMINI_RPD_LIMIT);

  return {
    apiKey,
    isConfigured: Boolean(apiKey),
    model,
    endpointUrl: apiKey
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      : null,
    rpmLimit,
    rpdLimit,
  };
}

