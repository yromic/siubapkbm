/**
 * Sprint115BTests.gs
 * QA assertions for Sprint 11.5B Operational Hardening.
 */

function test_runSprint115BQA() {
  console.log("STARTING SPRINT 11.5B OPERATIONAL HARDENING QA");
  setupDatabase();
  seedInitialData();
  
  // Clear leftover QA data from previous test suites to ensure a clean slate for integrity health checks
  var mainSs = getActiveSpreadsheet();
  [SHEETS.STUDENT_ENROLLMENTS, SHEETS.STUDENT_FILES].forEach(function(sheetName) {
    var sh = mainSs.getSheetByName(sheetName);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    }
  });
  
  var adminLogin = loginSprint11TestUser(DEFAULT_ADMIN.username, DEFAULT_ADMIN.password);
  var adminToken = adminLogin;
  var admin = getUserByIdentifier('admin');
  var ctx = { admin: admin, adminToken: adminToken };
  
  test_115BAuditLogIsolation(ctx);
  test_115BAutomaticBackupAndRetention(ctx);
  test_115BScheduledTriggers(ctx);
  test_115BScheduledIntegrityCheck(ctx);
  test_115BExtendedHealthCheckHardening(ctx);
  
  console.log("SPRINT 11.5B OPERATIONAL HARDENING QA PASSED");
}

function test_115BAuditLogIsolation(ctx) {
  console.log("Testing audit log isolation...");
  
  // 1. Assert that audit logs are successfully written to the external spreadsheet
  // We can write a test entry
  writeAuditLog({
    user_id: ctx.admin.id,
    user_name: ctx.admin.name,
    user_role: ctx.admin.role,
    action: 'test_isolation',
    entity_type: 'system',
    entity_id: 'test'
  });
  
  var rows = readAuditLogRows();
  var found = rows.some(function(r) { return r.action === 'test_isolation'; });
  if (!found) {
    throw new Error("Audit log isolation failed: test audit log was not found in readAuditLogRows.");
  }
  
  // 2. Assert that no audit log sheet exists in the active spreadsheet (or remains empty/cleared)
  var mainSs = getActiveSpreadsheet();
  var mainSheet = mainSs.getSheetByName(SHEETS.AUDIT_LOGS);
  if (mainSheet && mainSheet.getLastRow() > 1) {
    // If it exists in the template database, it should not be updated with our new isolated audit logs
    var mainValues = mainSheet.getRange(2, 1, mainSheet.getLastRow() - 1, mainSheet.getLastColumn()).getValues();
    var hasNewLog = mainValues.some(function(row) {
      return row.indexOf('test_isolation') !== -1;
    });
    if (hasNewLog) {
      throw new Error("Security Violation: New audit log entry was written to the main spreadsheet.");
    }
  }
  
  // 3. Assert that writeAuditLog throws error when AUDIT_SPREADSHEET_ID is undefined or empty
  var originalId = AUDIT_SPREADSHEET_ID;
  try {
    AUDIT_SPREADSHEET_ID = '';
    writeAuditLog({ action: 'should_fail' });
    throw new Error("Expected writeAuditLog to throw error when AUDIT_SPREADSHEET_ID is empty.");
  } catch (err) {
    if (err.message.indexOf("Audit log isolation error") === -1) {
      throw err;
    }
  } finally {
    AUDIT_SPREADSHEET_ID = originalId;
  }
  
  console.log("Audit log isolation verification passed.");
}

function test_115BAutomaticBackupAndRetention(ctx) {
  console.log("Testing backup automatic copy and retention rotation...");
  
  // 1. Perform a backup
  performScheduledBackup();
  
  // Verify backup record was created
  var records = listRecords(SHEETS.BACKUP_SNAPSHOTS);
  if (records.length === 0) {
    throw new Error("Scheduled backup failed to create metadata record.");
  }
  var latest = records.sort(function(a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  })[0];
  if (latest.backup_type !== 'spreadsheet_copy') {
    throw new Error("Scheduled backup was not registered as 'spreadsheet_copy'.");
  }
  
  // 2. Mock 35 backups to test 30-backup retention limit
  // Clear old backup metadata and add mock metadata
  var sheet = getActiveSpreadsheet().getSheetByName(SHEETS.BACKUP_SNAPSHOTS);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  var timestampBase = new Date().getTime();
  for (var i = 0; i < 35; i++) {
    appendRow(SHEETS.BACKUP_SNAPSHOTS, {
      backup_file_id: 'mock-file-' + i,
      backup_type: 'spreadsheet_copy',
      created_by: 'system',
      created_at: new Date(timestampBase + i * 1000).toISOString(),
      status: 'created',
      sheet_count: 5,
      record_count: 0,
      description: 'Mock backup ' + i
    });
  }
  
  // Trigger retention
  applyBackupRetention();
  
  // Assert exactly 30 records remain
  var remaining = listRecords(SHEETS.BACKUP_SNAPSHOTS);
  if (remaining.length !== 30) {
    throw new Error("Retention failed: expected exactly 30 records but got " + remaining.length);
  }
  
  // Assert the retained records are the latest ones (e.g. index 5 to 34)
  remaining.sort(function(a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  if (remaining[0].description !== 'Mock backup 34') {
    throw new Error("Retention failed: latest backup should be 'Mock backup 34' but got " + remaining[0].description);
  }
  
  console.log("Backup and retention verification passed.");
}

function test_115BScheduledTriggers(ctx) {
  console.log("Testing trigger installation, listing, and uninstallation...");
  
  // 1. Install triggers
  installOperationalHardeningTriggers();
  
  var list = listOperationalHardeningTriggers();
  if (list.length !== 2) {
    throw new Error("Trigger installation failed: expected 2 triggers installed but found " + list.length);
  }
  
  var handlers = list.map(function(t) { return t.handler; });
  if (handlers.indexOf('performScheduledBackup') === -1 || handlers.indexOf('performScheduledIntegrityCheck') === -1) {
    throw new Error("Trigger installation failed: correct triggers were not found: " + JSON.stringify(handlers));
  }
  
  // 2. Re-install triggers to ensure no duplicates
  installOperationalHardeningTriggers();
  list = listOperationalHardeningTriggers();
  if (list.length !== 2) {
    throw new Error("Trigger re-installation failed: duplicate triggers were created. Total triggers: " + list.length);
  }
  
  // 3. Uninstall triggers
  uninstallOperationalHardeningTriggers();
  list = listOperationalHardeningTriggers();
  if (list.length !== 0) {
    throw new Error("Trigger uninstallation failed: triggers still remain: " + JSON.stringify(list));
  }
  
  console.log("Trigger management verification passed.");
}

function test_115BScheduledIntegrityCheck(ctx) {
  console.log("Testing scheduled integrity check execution...");
  
  performScheduledIntegrityCheck();
  
  // Verify status is persisted in settings
  var settings = getAppSettings();
  if (!settings.last_integrity_check_status) {
    throw new Error("Scheduled integrity check failed to persist status in settings.");
  }
  
  var statusInfo = JSON.parse(settings.last_integrity_check_status);
  if (!statusInfo.checked_at || !statusInfo.status) {
    throw new Error("Persisted integrity check status format is invalid: " + settings.last_integrity_check_status);
  }
  
  console.log("Scheduled integrity check verification passed.");
}

function test_115BExtendedHealthCheckHardening(ctx) {
  console.log("Testing extended health check metrics...");
  
  // Ensure triggers are installed so health check finds them
  installOperationalHardeningTriggers();
  // Ensure integrity check ran
  performScheduledIntegrityCheck();
  // Ensure a backup metadata exists
  performScheduledBackup();
  
  var health = extendedHealthCheck({}, ctx.admin);
  
  if (!health.summary || health.summary.criticals !== 0) {
    throw new Error("Extended health check reported critical failures: " + JSON.stringify(health));
  }
  
  if (health.audit.status !== 'healthy') {
    throw new Error("Health check failed to report healthy audit status: " + JSON.stringify(health.audit));
  }
  
  if (health.backup.status !== 'healthy') {
    throw new Error("Health check failed to report healthy backup status: " + JSON.stringify(health.backup));
  }
  
  if (health.triggers.status !== 'healthy') {
    throw new Error("Health check failed to report healthy trigger status: " + JSON.stringify(health.triggers));
  }
  
  if (!health.audit.configured || !health.audit.reachable) {
    throw new Error("Health check failed to verify audit configuration and reachability: " + JSON.stringify(health.audit));
  }
  
  if (!health.backup.folder_reachable || !health.backup.latest_backup_exists) {
    throw new Error("Health check failed to verify backup folder reachability and latest backup: " + JSON.stringify(health.backup));
  }
  
  if (!health.triggers.backup_trigger_installed || !health.triggers.integrity_trigger_installed) {
    throw new Error("Health check failed to verify operational trigger status: " + JSON.stringify(health.triggers));
  }
  
  if (!health.integrity.status || !health.integrity.last_run) {
    throw new Error("Health check failed to verify last scheduled integrity check status: " + JSON.stringify(health.integrity));
  }
  
  // 2. Assert warning/critical in audit when AUDIT_SPREADSHEET_ID is invalid
  var originalId = AUDIT_SPREADSHEET_ID;
  try {
    AUDIT_SPREADSHEET_ID = 'invalid-id';
    var badHealth = extendedHealthCheck({}, ctx.admin);
    if (badHealth.audit.status !== 'critical' || badHealth.audit.reachable !== false) {
      throw new Error("Health check failed to report invalid/unreachable audit spreadsheet: " + JSON.stringify(badHealth.audit));
    }
  } finally {
    AUDIT_SPREADSHEET_ID = originalId;
  }
  
  console.log("Extended health check verification passed.");
}
