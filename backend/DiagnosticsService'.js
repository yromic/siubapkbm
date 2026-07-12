/**
 * DiagnosticsService.gs
 * Lightweight system diagnostics report for Sprint 11.
 */

function getSystemDiagnosticsReport(payload, actor) {
  payload = payload || {};
  assertHardeningReadRole(actor);

  return {
    generated_at: nowIso(),
    health: extendedHealthCheck({ summary_only: true }, actor),
    integrity: runDataIntegrityCheck({ summary_only: true, skip_audit: true }, actor).summary,
    storage: runStorageIntegrityCheck({ summary_only: true, skip_audit: true, orphan_scan_limit: 25 }, actor).summary,
    audit: getAuditLogSummary(),
    backup: getBackupSummary()
  };
}
