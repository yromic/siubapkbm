import { apiRequest } from "./client";

export type HealthStatus = "healthy" | "warning" | "critical" | string;

export interface HealthIssue {
  severity: "warning" | "critical" | string;
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
