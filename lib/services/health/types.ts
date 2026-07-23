export type HealthSeverity = "healthy" | "warning" | "critical" | "unknown";
export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";
export type HealthCategory = "infrastructure" | "configuration" | "operations" | "integrity";

/**
 * Operational priority derived from severity.
 *   critical → P1
 *   warning  → P2
 *   unknown  → P3
 *   healthy  → (no priority)
 */
export type OperationalPriority = "P1" | "P2" | "P3" | null;

export interface HealthIssue {
  code: string;
  severity: HealthSeverity;
  message: string;
  technical_details?: Record<string, unknown>;

  // ── Sprint 6: Remediation Guidance ───────────────────────────────────────
  /** Human-readable description of the operational impact when this issue occurs. */
  impact?: string;
  /** Step-by-step or descriptive recommendation for resolving this issue. */
  recommendation?: string;
  /** Link to internal documentation. null when no documentation exists. */
  documentation_url?: string | null;
  /**
   * Indicates whether this issue type COULD be auto-repaired in a future sprint.
   * Sprint 6 only introduces metadata — no repair logic is implemented yet.
   */
  auto_repair_supported?: boolean;
  /** Identifier of the repair action (future use only). null in Sprint 6. */
  repair_action?: string | null;
  /** Operational priority derived from severity. */
  priority?: OperationalPriority;
}

export interface HealthSection {
  id: string;
  title: string;
  category: HealthCategory;
  status: HealthStatus;
  duration_ms: number;
  checked_at: string;
  issues: HealthIssue[];
  details: Record<string, unknown>;
}

export interface HealthSummary {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  total: number;
}

export interface HealthResponse {
  status: HealthStatus;
  summary: HealthSummary;
  sections: HealthSection[];
}
