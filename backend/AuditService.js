/**
 * AuditService.gs
 * Handles logging of user actions and critical changes.
 * Allows separate AUDIT_SPREADSHEET_ID or fallback to local audit_logs sheet.
 */

/**
 * Writes an audit log entry.
 * @param {Object} entry - Audit log entry fields.
 */
function writeAuditLog(entry) {
  entry = entry || {};
  
  // Sanitize fields before mapping to sheet rows
  entry.old_value = sanitizeAuditPayload(entry.old_value);
  entry.new_value = sanitizeAuditPayload(entry.new_value);
  entry.description = redactSensitiveSubstrings(entry.description);
  
  var sheetName = SHEETS.AUDIT_LOGS;
  var headers = SHEET_HEADERS[sheetName];
  
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
  if (!sheet) {
    sheet = targetSs.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  // Populate default fields
  entry.id = generateId('AUD');
  entry.created_at = nowIso();
  
  var rowData = headers.map(function(header) {
    var val = entry[header];
    return val === undefined || val === null ? '' : val;
  });
  
  sheet.appendRow(rowData);
}

/**
 * Parses JSON strings or objects and deep-redacts sensitive keys,
 * falling back to substring redaction if it's a plain text string.
 */
function sanitizeAuditPayload(value) {
  if (value === undefined || value === null || value === '') return '';
  
  var obj;
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if ((trimmed.indexOf('{') === 0 && trimmed.lastIndexOf('}') === trimmed.length - 1) ||
        (trimmed.indexOf('[') === 0 && trimmed.lastIndexOf(']') === trimmed.length - 1)) {
      try {
        obj = JSON.parse(trimmed);
      } catch (e) {
        return redactSensitiveSubstrings(value);
      }
    } else {
      return redactSensitiveSubstrings(value);
    }
  } else if (typeof value === 'object') {
    try {
      obj = JSON.parse(JSON.stringify(value));
    } catch (e) {
      obj = value;
    }
  } else {
    return value;
  }
  
  redactSensitiveKeys(obj);
  
  if (typeof value === 'string') {
    return JSON.stringify(obj);
  }
  return obj;
}

/**
 * Deep-redacts keys from an object recursively.
 */
function redactSensitiveKeys(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  var sensitiveKeys = [
    'password', 'password_hash', 'new_password', 'old_password',
    'token', 'token_hash', 'session', 'session_token',
    'pin', 'pin_hash', 'parent_pin', 'parent_access_pin', 'parent_access_pin_hash',
    'nik', 'mother_nik', 'father_nik', 'guardian_nik',
    'family_card_number', 'family_card_date', 'kk', 'kartu_keluarga'
  ];
  
  if (Array.isArray(obj)) {
    obj.forEach(function(item) {
      redactSensitiveKeys(item);
    });
  } else {
    for (var key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactSensitiveKeys(obj[key]);
      } else if (sensitiveKeys.indexOf(key.toLowerCase()) !== -1) {
        obj[key] = '[REDACTED]';
      }
    }
  }
}

/**
 * Selectively redacts sensitive patterns in string format.
 */
function redactSensitiveSubstrings(str) {
  if (typeof str !== 'string' || !str) return str;
  
  var sensitiveKeys = [
    'parent_access_pin_hash', 'family_card_number', 'family_card_date',
    'password_hash', 'session_token', 'kartu_keluarga', 'parent_access_pin',
    'new_password', 'old_password', 'guardian_nik', 'mother_nik', 'father_nik',
    'password', 'token_hash', 'parent_pin', 'pin_hash', 'session', 'token',
    'nik', 'pin', 'kk'
  ];
  
  var result = str;
  sensitiveKeys.forEach(function(key) {
    // Replaces key-value pairs formatted as "key":"val", "key" to "val", key is val, key=val, etc.
    var regexQuoted = new RegExp('([\\"\']?' + key + '[\\"\']?\\s*([:=]|to|is)\\s*)([\\"\'])(?:(?!\\3).)*\\3', 'gi');
    result = result.replace(regexQuoted, '$1"[REDACTED]"');
    
    var regexUnquoted = new RegExp('([\\"\']?' + key + '[\\"\']?\\s*([:=]|to|is)\\s*)([^\\s,\\"\'\}]+)', 'gi');
    result = result.replace(regexUnquoted, '$1[REDACTED]');
  });
  
  return result;
}

/**
 * Runs audit logging without allowing audit failures to break the main flow.
 * @param {Function} callback
 */
function safeAudit(callback) {
  try {
    callback();
  } catch (err) {
    var message = err && err.message ? err.message : err;
    console.error("Failed to write audit log: " + message);
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log("Failed to write audit log: " + message);
    }
  }
}

/**
 * JSON-stringifies audit values consistently.
 * @param {*} value
 * @returns {string}
 */
function auditJson(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Logs a successful login.
 * @param {Object} user
 * @param {Object} meta
 */
function logLoginSuccess(user, meta) {
  user = user || {};
  meta = meta || {};
  writeAuditLog({
    user_id: user.id || '',
    user_name: user.name || '',
    user_role: user.role || '',
    action: 'login',
    entity_type: 'users',
    entity_id: user.id || '',
    old_value: '',
    new_value: '',
    description: 'User logged in successfully.',
    ip_address: meta.ip_address || '',
    user_agent: meta.user_agent || ''
  });
}

/**
 * Logs a failed login attempt.
 * @param {string} identifier
 * @param {Object} meta
 */
function logLoginFailed(identifier, meta) {
  meta = meta || {};
  writeAuditLog({
    user_id: '',
    user_name: identifier || '',
    user_role: '',
    action: 'login_failed',
    entity_type: 'users',
    entity_id: '',
    old_value: '',
    new_value: '',
    description: 'Failed login attempt using identifier: ' + identifier,
    ip_address: meta.ip_address || '',
    user_agent: meta.user_agent || ''
  });
}

/**
 * Logs a user lockout event.
 * @param {Object} user
 * @param {Object} meta
 */
function logLoginLockout(user, meta) {
  user = user || {};
  meta = meta || {};
  writeAuditLog({
    user_id: user.id || '',
    user_name: user.name || '',
    user_role: user.role || '',
    action: 'login_lockout',
    entity_type: 'users',
    entity_id: user.id || '',
    old_value: '',
    new_value: '',
    description: 'User account temporarily locked due to too many failed attempts.',
    ip_address: meta.ip_address || '',
    user_agent: meta.user_agent || ''
  });
}

/**
 * Logs a record creation.
 * @param {string} entityType
 * @param {string} entityId
 * @param {Object} actor
 * @param {string} newValue - JSON string representation of the created object.
 */
function logCreate(entityType, entityId, actor, newValue) {
  writeAuditLog({
    user_id: actor ? actor.id : 'system',
    user_name: actor ? actor.name : 'System',
    user_role: actor ? actor.role : 'system',
    action: 'create_record',
    entity_type: entityType,
    entity_id: entityId,
    old_value: '',
    new_value: auditJson(newValue),
    description: 'Created new record in ' + entityType + '.'
  });
}

/**
 * Logs a record modification.
 * @param {string} entityType
 * @param {string} entityId
 * @param {Object} actor
 * @param {string} oldValue - JSON string representation before change.
 * @param {string} newValue - JSON string representation after change.
 */
function logUpdate(entityType, entityId, actor, oldValue, newValue) {
  writeAuditLog({
    user_id: actor ? actor.id : 'system',
    user_name: actor ? actor.name : 'System',
    user_role: actor ? actor.role : 'system',
    action: 'update_record',
    entity_type: entityType,
    entity_id: entityId,
    old_value: auditJson(oldValue),
    new_value: auditJson(newValue),
    description: 'Updated record in ' + entityType + '.'
  });
}
