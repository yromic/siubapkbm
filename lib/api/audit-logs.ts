import { apiRequest } from "./client";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: string | Record<string, unknown>;
  new_value: string | Record<string, unknown>;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  severity: AuditSeverity;
}

export interface AuditLogSearchPayload {
  q?: string;
  action?: string;
  user_id?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface AuditLogSearchResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export function searchAuditLogs(token: string, payload: AuditLogSearchPayload) {
  return apiRequest<AuditLogSearchResponse>("search_audit_logs", payload, token);
}
