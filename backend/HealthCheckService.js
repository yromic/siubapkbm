/**
 * HealthCheckService.gs
 * Extended production health checks for Sprint 11.
 */

function assertHardeningReadRole(actor) {
  if (!actor || (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN)) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Sprint 11 hardening endpoints require administrator or admin role.'
    };
  }
}

function assertHardeningAdministrator(actor) {
  if (!actor || actor.role !== ROLES.ADMINISTRATOR) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: This hardening endpoint requires administrator role.'
    };
  }
}

function extendedHealthCheck(payload, actor) {
  assertHardeningReadRole(actor);

  var result = {
    status: 'healthy',
    spreadsheet: {},
    sheets: {},
    drive: {},
    settings: {},
    audit: {},
    cache: {},
    backup: {},
    triggers: {},
    integrity: {},
    summary: {
      checked_at: nowIso(),
      warnings: 0,
      criticals: 0
    }
  };

  healthCheckSpreadsheet(result);
  healthCheckSheets(result);
  healthCheckSettings(result);
  healthCheckDrive(result);
  healthCheckAudit(result);
  healthCheckCache(result);
  healthCheckBackup(result);
  healthCheckTriggers(result);
  healthCheckIntegrity(result);

  result.status = deriveHardeningStatus(result.summary.criticals, result.summary.warnings);
  return result;
}

function healthAddFinding(container, summary, severity, code, message, details) {
  if (!container.issues) container.issues = [];
  container.issues.push({
    severity: severity,
    code: code,
    message: message,
    details: details || {}
  });
  if (severity === 'critical') summary.criticals++;
  if (severity === 'warning') summary.warnings++;
}

function healthCheckSpreadsheet(result) {
  try {
    var ss = getActiveSpreadsheet();
    result.spreadsheet = {
      status: 'healthy',
      id: ss.getId(),
      name: ss.getName()
    };
  } catch (err) {
    result.spreadsheet = { status: 'critical' };
    healthAddFinding(result.spreadsheet, result.summary, 'critical', 'SPREADSHEET_UNREADABLE', String(err && err.message ? err.message : err));
  }
}

function healthCheckSheets(result) {
  var ss;
  try {
    ss = getActiveSpreadsheet();
  } catch (err) {
    result.sheets = { status: 'critical', checked: 0, missing: [], header_mismatches: [] };
    return;
  }

  var missing = [];
  var mismatches = [];
  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    var expected = SHEET_HEADERS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      missing.push(sheetName);
      return;
    }
    var lastCol = sheet.getLastColumn();
    var actual = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var missingHeaders = expected.filter(function(header) {
      return actual.indexOf(header) === -1;
    });
    if (missingHeaders.length > 0) {
      mismatches.push({ sheet: sheetName, missing_headers: missingHeaders });
    }
  });

  result.sheets = {
    status: missing.length || mismatches.length ? 'critical' : 'healthy',
    checked: Object.keys(SHEET_HEADERS).length,
    missing: missing,
    header_mismatches: mismatches
  };

  missing.forEach(function(sheetName) {
    healthAddFinding(result.sheets, result.summary, 'critical', 'MISSING_SHEET', 'Required sheet is missing: ' + sheetName, { sheet: sheetName });
  });
  mismatches.forEach(function(item) {
    healthAddFinding(result.sheets, result.summary, 'critical', 'HEADER_MISMATCH', 'Sheet header mismatch: ' + item.sheet, item);
  });
}

function healthCheckSettings(result) {
  var settings = {};
  try {
    settings = getAppSettings();
  } catch (err) {
    result.settings = { status: 'critical' };
    healthAddFinding(result.settings, result.summary, 'critical', 'APP_SETTINGS_UNREADABLE', String(err && err.message ? err.message : err));
    return;
  }

  var checks = {};
  checks.active_academic_year_id = checkOptionalSettingReference(settings.active_academic_year_id, SHEETS.ACADEMIC_YEARS);
  checks.active_semester_id = checkOptionalSettingReference(settings.active_semester_id, SHEETS.SEMESTERS);
  checks.PKBM_STORAGE_ROOT = settings.PKBM_STORAGE_ROOT ? { status: 'present', value: settings.PKBM_STORAGE_ROOT } : { status: 'not_set' };

  result.settings = { status: 'healthy', checks: checks };
  Object.keys(checks).forEach(function(key) {
    if (checks[key].status === 'invalid') {
      result.settings.status = 'warning';
      healthAddFinding(result.settings, result.summary, 'warning', 'INVALID_SETTING_REFERENCE', 'App setting has invalid reference: ' + key, { key: key, value: checks[key].value });
    }
  });
}

function checkOptionalSettingReference(value, sheetName) {
  if (!value) return { status: 'not_set' };
  return getRecordById(sheetName, value) ? { status: 'valid', value: value } : { status: 'invalid', value: value };
}

function healthCheckDrive(result) {
  try {
    var settings = getAppSettings();
    var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
    var folders = DriveApp.getFoldersByName(rootName);
    if (!folders.hasNext()) {
      result.drive = { status: 'warning', root_folder_name: rootName, root_accessible: false };
      healthAddFinding(result.drive, result.summary, 'warning', 'STORAGE_ROOT_NOT_FOUND', 'Storage root folder was not found.', { root_folder_name: rootName });
      return;
    }
    var folder = folders.next();
    result.drive = {
      status: 'healthy',
      root_folder_name: rootName,
      root_folder_id: folder.getId(),
      root_accessible: true
    };
  } catch (err) {
    result.drive = { status: 'critical', root_accessible: false };
    healthAddFinding(result.drive, result.summary, 'critical', 'DRIVE_UNREADABLE', String(err && err.message ? err.message : err));
  }
}

function healthCheckAudit(result) {
  var configured = typeof AUDIT_SPREADSHEET_ID !== 'undefined' && AUDIT_SPREADSHEET_ID !== '';
  var reachable = false;
  var errorMsg = '';
  
  if (configured) {
    try {
      var targetSs = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID);
      var sheet = targetSs.getSheetByName(SHEETS.AUDIT_LOGS);
      reachable = (sheet !== null);
    } catch (err) {
      errorMsg = String(err && err.message ? err.message : err);
    }
  }
  
  result.audit = {
    status: (configured && reachable) ? 'healthy' : 'critical',
    configured: configured,
    reachable: reachable
  };
  
  if (!configured) {
    healthAddFinding(result.audit, result.summary, 'critical', 'AUDIT_SPREADSHEET_NOT_CONFIGURED', 'Audit spreadsheet ID is not configured.');
  } else if (!reachable) {
    healthAddFinding(result.audit, result.summary, 'critical', 'AUDIT_SPREADSHEET_UNREACHABLE', 'Audit spreadsheet is configured but not reachable: ' + errorMsg);
  }
}

function healthCheckCache(result) {
  try {
    if (typeof CacheService !== 'undefined') {
      var cache = CacheService.getScriptCache();
      var key = 'health_check_' + new Date().getTime();
      cache.put(key, 'ok', 10);
      result.cache = { status: cache.get(key) === 'ok' ? 'healthy' : 'warning', basic_token_storage: true };
    } else {
      result.cache = { status: 'warning', basic_token_storage: false };
    }
  } catch (err) {
    result.cache = { status: 'warning', basic_token_storage: false };
    healthAddFinding(result.cache, result.summary, 'warning', 'CACHE_BASIC_CHECK_FAILED', String(err && err.message ? err.message : err));
  }
}

function healthCheckBackup(result) {
  try {
    var folder = getOrCreateBackupFolder();
    var hasLatest = false;
    var records = listRecords(SHEETS.BACKUP_SNAPSHOTS);
    if (records.length > 0) {
      records.sort(function(a, b) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      var latestRec = records[0];
      if (latestRec.backup_file_id) {
        try {
          var file = DriveApp.getFileById(latestRec.backup_file_id);
          hasLatest = (file !== null);
        } catch (e) {
          // file not found
        }
      }
    }
    
    result.backup = {
      status: hasLatest ? 'healthy' : 'warning',
      folder_reachable: true,
      latest_backup_exists: hasLatest,
      retention_valid: true
    };
    
    if (!hasLatest) {
      healthAddFinding(result.backup, result.summary, 'warning', 'NO_LATEST_BACKUP', 'No recent backup exists or latest backup file is missing in Drive.');
    }
  } catch (err) {
    result.backup = { status: 'critical', folder_reachable: false, latest_backup_exists: false, retention_valid: false };
    healthAddFinding(result.backup, result.summary, 'critical', 'BACKUP_FOLDER_UNREACHABLE', 'Backup folder is not reachable: ' + String(err && err.message ? err.message : err));
  }
}

function healthCheckTriggers(result) {
  try {
    var list = listOperationalHardeningTriggers();
    var installed = list.map(function(t) { return t.handler; });
    var backupInstalled = installed.indexOf('performScheduledBackup') !== -1;
    var integrityInstalled = installed.indexOf('performScheduledIntegrityCheck') !== -1;
    
    var status = (backupInstalled && integrityInstalled) ? 'healthy' : 'warning';
    result.triggers = {
      status: status,
      backup_trigger_installed: backupInstalled,
      integrity_trigger_installed: integrityInstalled
    };
    
    if (!backupInstalled || !integrityInstalled) {
      healthAddFinding(result.triggers, result.summary, 'warning', 'OPERATIONAL_TRIGGERS_MISSING', 'One or more scheduled triggers are not installed.', { installed: installed });
    }
  } catch (err) {
    result.triggers = { status: 'warning', backup_trigger_installed: false, integrity_trigger_installed: false };
    healthAddFinding(result.triggers, result.summary, 'warning', 'TRIGGERS_CHECK_FAILED', String(err && err.message ? err.message : err));
  }
}

function healthCheckIntegrity(result) {
  try {
    var settings = getAppSettings();
    var lastStatusRaw = settings.last_integrity_check_status;
    if (!lastStatusRaw) {
      result.integrity = { status: 'warning', last_run: null };
      healthAddFinding(result.integrity, result.summary, 'warning', 'NO_INTEGRITY_CHECK_RECORD', 'No scheduled integrity check has been recorded yet.');
      return;
    }
    
    var info = JSON.parse(lastStatusRaw);
    result.integrity = {
      status: info.status === 'healthy' ? 'healthy' : 'warning',
      last_run: info.checked_at,
      data_issues: info.data_issues,
      storage_issues: info.storage_issues
    };
    
    if (info.status !== 'healthy') {
      healthAddFinding(result.integrity, result.summary, 'warning', 'INTEGRITY_ISSUES_FOUND', 'Last scheduled integrity check found issues.', info);
    }
  } catch (err) {
    result.integrity = { status: 'warning', error: String(err && err.message ? err.message : err) };
    healthAddFinding(result.integrity, result.summary, 'warning', 'INTEGRITY_STATUS_CHECK_FAILED', String(err && err.message ? err.message : err));
  }
}

function deriveHardeningStatus(criticals, warnings) {
  if (criticals > 0) return 'critical';
  if (warnings > 0) return 'warning';
  return 'healthy';
}
