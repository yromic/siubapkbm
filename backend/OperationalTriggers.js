/**
 * OperationalTriggers.gs
 * Scheduled triggers installation and automatic integrity checks for Sprint 11.5B.
 */

function installOperationalHardeningTriggers() {
  var admin = getUserByIdentifier('admin') || { id: 'system', name: 'System', role: ROLES.ADMINISTRATOR };
  uninstallOperationalHardeningTriggers(); // Clean up to avoid duplicate triggers
  
  // 1. Create daily backup trigger (e.g. at 2 AM)
  ScriptApp.newTrigger('performScheduledBackup')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
    
  // 2. Create daily integrity check trigger (e.g. at 3 AM)
  ScriptApp.newTrigger('performScheduledIntegrityCheck')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
    
  logHardeningAudit(admin, 'install_triggers', 'system', '', {
    triggers: ['performScheduledBackup', 'performScheduledIntegrityCheck']
  });
}

function uninstallOperationalHardeningTriggers() {
  var admin = getUserByIdentifier('admin') || { id: 'system', name: 'System', role: ROLES.ADMINISTRATOR };
  var triggers = ScriptApp.getProjectTriggers();
  var removed = [];
  triggers.forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'performScheduledBackup' || fn === 'performScheduledIntegrityCheck') {
      ScriptApp.deleteTrigger(t);
      removed.push(fn);
    }
  });
  if (removed.length > 0) {
    logHardeningAudit(admin, 'uninstall_triggers', 'system', '', {
      triggers: removed
    });
  }
}

function listOperationalHardeningTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var expected = ['performScheduledBackup', 'performScheduledIntegrityCheck'];
  return triggers
    .filter(function(t) {
      return expected.indexOf(t.getHandlerFunction()) !== -1;
    })
    .map(function(t) {
      return {
        handler: t.getHandlerFunction(),
        type: t.getEventType().toString(),
        source: t.getTriggerSource().toString()
      };
    });
}

function performScheduledIntegrityCheck() {
  var admin = getUserByIdentifier('admin') || { id: 'system', name: 'System', role: ROLES.ADMINISTRATOR };
  
  // 1. Run Data Integrity Check
  var dataResult = runDataIntegrityCheck({ skip_audit: false }, admin);
  
  // 2. Run Storage Integrity Check
  var storageResult = runStorageIntegrityCheck({ skip_audit: false, orphan_scan_limit: 25 }, admin);
  
  var status = (dataResult.status === 'healthy' && storageResult.status === 'healthy') ? 'healthy' : 'warning';
  
  var summary = {
    checked_at: nowIso(),
    status: status,
    data_issues: dataResult.summary.issue_count,
    storage_issues: storageResult.summary.issue_count
  };
  
  // Persist status in app_settings
  updateSingleSetting('last_integrity_check_status', JSON.stringify(summary), admin);
  
  logHardeningAudit(admin, 'scheduled_integrity_check_success', 'system_integrity', '', summary);
}
