/**
 * AuditExplorerService.gs
 * Search/filter access to audit logs for Sprint 11.
 */

function searchAuditLogs(payload, actor) {
  payload = payload || {};
  assertHardeningAdministrator(actor);

  var legacyLimit = Number(payload.limit || 0);
  var page = Math.floor(Number(payload.page || 1));
  var pageSize = Math.floor(Number(payload.page_size || legacyLimit || 50));
  if (isNaN(page) || page <= 0) page = 1;
  if (isNaN(pageSize) || pageSize <= 0) pageSize = 50;
  pageSize = Math.min(pageSize, 200);
  var query = String(payload.q || '').trim().toLowerCase();

  var rows = readAuditLogRows();
  var filtered = rows.filter(function(row) {
    if (payload.user_id && row.user_id !== payload.user_id) return false;
    if (payload.action && row.action !== payload.action) return false;
    if (payload.entity_type && row.entity_type !== payload.entity_type) return false;
    if (payload.entity_id && row.entity_id !== payload.entity_id) return false;
    if (!auditDateInRange(row.created_at, payload.date_from, payload.date_to)) return false;
    if (query && !auditLogMatchesQuery(row, query)) return false;
    return true;
  });

  filtered.sort(function(a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  var offset = (page - 1) * pageSize;
  var logs = filtered.slice(offset, offset + pageSize).map(sanitizeAuditLogForViewer);
  return {
    logs: logs,
    total: filtered.length,
    page: page,
    page_size: pageSize,
    summary: {
      total_matched: filtered.length,
      returned: logs.length,
      limit: pageSize
    }
  };
}

function auditLogMatchesQuery(row, query) {
  return ['user_name', 'action', 'entity_type', 'entity_id', 'description'].some(function(field) {
    return String(row[field] || '').toLowerCase().indexOf(query) !== -1;
  });
}

function sanitizeAuditLogForViewer(row) {
  var safeRow = {};
  Object.keys(row || {}).forEach(function(key) { safeRow[key] = row[key]; });
  safeRow.old_value = sanitizeAuditPayload(safeRow.old_value);
  safeRow.new_value = sanitizeAuditPayload(safeRow.new_value);
  safeRow.description = redactSensitiveSubstrings(String(safeRow.description || ''));
  safeRow.severity = deriveAuditLogSeverity(safeRow.action);
  return safeRow;
}

function deriveAuditLogSeverity(action) {
  var value = String(action || '').toLowerCase();
  if (/(security|breach|attack|compromised)/.test(value)) return 'critical';
  if (/(failed|forbidden|unauthorized|lockout)/.test(value)) return 'warning';
  if (['view_sensitive_document', 'reset_password', 'set_user_status', 'download_export'].indexOf(value) !== -1) return 'warning';
  return 'info';
}

function readAuditLogRows() {
  var sheetName = SHEETS.AUDIT_LOGS;
  if (typeof AUDIT_SPREADSHEET_ID === 'undefined' || !AUDIT_SPREADSHEET_ID) {
    throw new Error("Audit log isolation error: AUDIT_SPREADSHEET_ID is not configured.");
  }
  
  var targetSs;
  try {
    targetSs = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID);
  } catch (e) {
    throw new Error("Audit log isolation error: Failed to open AUDIT_SPREADSHEET_ID. Detail: " + e.message);
  }

  var sheet = targetSs.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(function(row) {
    return rowToObject(headers, row);
  });
}

function auditDateInRange(createdAt, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!createdAt) return false;
  var time = new Date(createdAt).getTime();
  if (dateFrom) {
    var from = new Date(dateFrom + 'T00:00:00.000Z').getTime();
    if (time < from) return false;
  }
  if (dateTo) {
    var to = new Date(dateTo + 'T23:59:59.999Z').getTime();
    if (time > to) return false;
  }
  return true;
}

function getAuditLogSummary() {
  var rows = readAuditLogRows();
  var byAction = {};
  rows.forEach(function(row) {
    var action = row.action || 'unknown';
    byAction[action] = (byAction[action] || 0) + 1;
  });
  return {
    total_logs: rows.length,
    by_action: byAction,
    newest_created_at: rows.length ? rows.sort(function(a, b) {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })[0].created_at : null
  };
}

function logHardeningAudit(actor, action, entityType, entityId, details) {
  safeAudit(function() {
    writeAuditLog({
      user_id: actor ? actor.id : '',
      user_name: actor ? actor.name : '',
      user_role: actor ? actor.role : '',
      action: action,
      entity_type: entityType || 'system',
      entity_id: entityId || '',
      old_value: '',
      new_value: JSON.stringify(details || {}),
      description: 'Sprint 11 hardening action: ' + action
    });
  });
}
