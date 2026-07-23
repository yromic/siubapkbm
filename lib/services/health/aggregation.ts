import { HealthSection, HealthSummary, HealthResponse, HealthStatus, HealthIssue } from "./types";
import { getIssueMetadata, severityToPriority } from "./issueRegistry";

/**
 * Enriches a single HealthIssue with metadata from the central issue registry.
 * Fields already present on the issue are preserved (checker wins over registry).
 */
function enrichIssue(issue: HealthIssue): HealthIssue {
  const meta = getIssueMetadata(issue.code);
  return {
    // Registry-sourced fields (only applied when not already set on the issue)
    impact: issue.impact ?? meta?.impact,
    recommendation: issue.recommendation ?? meta?.recommendation,
    documentation_url: issue.documentation_url ?? meta?.documentation_url ?? null,
    auto_repair_supported: issue.auto_repair_supported ?? meta?.auto_repair_supported ?? false,
    repair_action: issue.repair_action ?? meta?.repair_action ?? null,
    priority: issue.priority ?? severityToPriority(issue.severity),
    // Original issue fields (always preserved, placed after defaults to allow override)
    ...issue,
  };
}

export function aggregateHealthResults(sections: HealthSection[]): HealthResponse {
  // Enrich all issues in all sections before aggregation
  const enrichedSections: HealthSection[] = sections.map((section) => ({
    ...section,
    issues: section.issues.map(enrichIssue),
  }));

  const summary: HealthSummary = {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    total: enrichedSections.length,
  };

  for (const section of enrichedSections) {
    if (section.status === "healthy") summary.healthy++;
    else if (section.status === "warning") summary.warning++;
    else if (section.status === "critical") summary.critical++;
    else summary.unknown++;
  }

  let status: HealthStatus = "healthy";

  if (summary.critical > 0) {
    status = "critical";
  } else if (summary.warning > 0) {
    status = "warning";
  } else if (summary.unknown > 0 || summary.total === 0) {
    status = "unknown";
  } else {
    status = "healthy";
  }

  return {
    status,
    summary,
    sections: enrichedSections,
  };
}
