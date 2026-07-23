import { apiRequest } from "./client";

export type HealthStatus = "healthy" | "warning" | "critical" | string;

export interface HealthIssue {
  severity: "warning" | "critical" | "unknown" | string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthSectionData {
  status?: HealthStatus;
  issues?: HealthIssue[];
  [key: string]: unknown;
}

export interface ExtendedHealthResponse {
  status: HealthStatus;
  spreadsheet: HealthSectionData;
  sheets: HealthSectionData;
  settings: HealthSectionData;
  drive: HealthSectionData;
  audit: HealthSectionData;
  cache: HealthSectionData;
  backup: HealthSectionData;
  triggers: HealthSectionData;
  integrity: HealthSectionData & { last_run?: string | null };
  summary: { checked_at: string; warnings: number; criticals: number };
}

export interface SystemDiagnosticsResponse {
  generated_at: string;
  health: ExtendedHealthResponse;
  integrity: Record<string, unknown>;
  storage: Record<string, unknown>;
  audit: Record<string, unknown>;
  backup: Record<string, unknown>;
}

export function extendedHealthCheck(token: string) {
  return apiRequest<ExtendedHealthResponse>("extended_health_check", {}, token);
}

export function getSystemDiagnosticsReport(token: string) {
  return apiRequest<SystemDiagnosticsResponse>("get_system_diagnostics_report", {}, token);
}

// ── Health Check v2 ──────────────────────────────────────────────────────────

export type HealthV2Status = "healthy" | "warning" | "critical" | "unknown";
export type HealthV2Category = "infrastructure" | "configuration" | "operations" | "integrity";
export type HealthV2Priority = "P1" | "P2" | "P3" | null;

export interface HealthV2Issue {
  code: string;
  severity: HealthV2Status;
  message: string;
  technical_details?: Record<string, unknown>;

  // ── Sprint 6: Remediation Guidance ───────────────────────────────────────
  impact?: string;
  recommendation?: string;
  documentation_url?: string | null;
  auto_repair_supported?: boolean;
  repair_action?: string | null;
  priority?: HealthV2Priority;
}

export interface HealthV2Section {
  id: string;
  title: string;
  category: HealthV2Category;
  status: HealthV2Status;
  duration_ms: number;
  checked_at: string;
  issues: HealthV2Issue[];
  details: Record<string, unknown>;
}

export interface HealthV2Summary {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  total: number;
}

export interface HealthV2Response {
  status: HealthV2Status;
  summary: HealthV2Summary;
  sections: HealthV2Section[];
}

export function getHealthCheckV2(): Promise<HealthV2Response> {
  return apiRequest<HealthV2Response>("health_check_v2", {});
}
