/**
 * BackupService.gs
 * Manual JSON backup snapshots and restore preview for Sprint 11.
 */

function createManualBackupSnapshot(payload, actor) {
  payload = payload || {};
  assertHardeningAdministrator(actor);
  ensureSheetHeaders(SHEETS.BACKUP_SNAPSHOTS, SHEET_HEADERS[SHEETS.BACKUP_SNAPSHOTS]);

  var sourceSheets = getBackupSourceSheets();
  var sheetsPayload = {};
  var recordCount = 0;
  sourceSheets.forEach(function(sheetName) {
    var rows = listRecords(sheetName);
    sheetsPayload[sheetName] = rows;
    recordCount += rows.length;
  });

  var backup = {
    created_at: nowIso(),
    created_by: actor.id,
    sheets: sheetsPayload
  };

  var fileName = 'pkbm_manual_backup_' + backup.created_at.replace(/[:.]/g, '-') + '.json';
  var folder = getOrCreateBackupFolder();
  var blob = Utilities.newBlob(JSON.stringify(backup), 'application/json', fileName);
  var file = folder.createFile(blob);

  var metadata = appendRow(SHEETS.BACKUP_SNAPSHOTS, {
    backup_file_id: file.getId(),
    backup_type: 'manual_json',
    created_by: actor.id,
    created_at: backup.created_at,
    status: 'created',
    sheet_count: sourceSheets.length,
    record_count: recordCount,
    description: payload.description || ''
  });

  logHardeningAudit(actor, 'create_manual_backup_snapshot', SHEETS.BACKUP_SNAPSHOTS, metadata.id, {
    backup_file_id: metadata.backup_file_id,
    sheet_count: metadata.sheet_count,
    record_count: metadata.record_count
  });

  return metadata;
}

function listBackupSnapshots(payload, actor) {
  assertHardeningAdministrator(actor);
  ensureSheetHeaders(SHEETS.BACKUP_SNAPSHOTS, SHEET_HEADERS[SHEETS.BACKUP_SNAPSHOTS]);
  var rows = listRecords(SHEETS.BACKUP_SNAPSHOTS);
  rows.sort(function(a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  return rows;
}

function previewRestoreBackup(payload, actor) {
  payload = payload || {};
  assertHardeningAdministrator(actor);
  validateRequiredFields(payload, ['backup_id']);

  var metadata = getRecordById(SHEETS.BACKUP_SNAPSHOTS, payload.backup_id);
  if (!metadata) {
    throw { code: 'ERR_NOT_FOUND', message: 'Backup snapshot not found.' };
  }

  var file = DriveApp.getFileById(metadata.backup_file_id);
  var backup = JSON.parse(file.getBlob().getDataAsString());
  var differences = [];
  var sheetNames = Object.keys(backup.sheets || {});
  var totalRecords = 0;

  sheetNames.forEach(function(sheetName) {
    var backupRows = backup.sheets[sheetName] || [];
    var currentRows = listRecords(sheetName);
    totalRecords += backupRows.length;
    if (backupRows.length !== currentRows.length) {
      differences.push({
        sheet: sheetName,
        type: 'record_count_changed',
        current_count: currentRows.length,
        backup_count: backupRows.length
      });
    }
  });

  logHardeningAudit(actor, 'preview_restore_backup', SHEETS.BACKUP_SNAPSHOTS, metadata.id, {
    sheet_count: sheetNames.length,
    record_count: totalRecords,
    difference_count: differences.length
  });

  return {
    backup: metadata,
    summary: {
      sheets: sheetNames.length,
      records: totalRecords
    },
    differences: differences
  };
}

function getBackupSourceSheets() {
  return Object.keys(SHEET_HEADERS).filter(function(sheetName) {
    return sheetName !== SHEETS.BACKUP_SNAPSHOTS;
  });
}

function getOrCreateBackupFolder() {
  var rootId = getOrCreateStorageRoot();
  var root = DriveApp.getFolderById(rootId);
  return getOrCreateFolder(root, 'backup_snapshots');
}

function getBackupSummary() {
  ensureSheetHeaders(SHEETS.BACKUP_SNAPSHOTS, SHEET_HEADERS[SHEETS.BACKUP_SNAPSHOTS]);
  var rows = listRecords(SHEETS.BACKUP_SNAPSHOTS);
  rows.sort(function(a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  return {
    total_snapshots: rows.length,
    latest_snapshot: rows.length ? {
      id: rows[0].id,
      created_at: rows[0].created_at,
      status: rows[0].status,
      record_count: rows[0].record_count
    } : null
  };
}

function performScheduledBackup() {
  var admin = getUserByIdentifier('admin') || { id: 'system', name: 'System', role: ROLES.ADMINISTRATOR };
  ensureSheetHeaders(SHEETS.BACKUP_SNAPSHOTS, SHEET_HEADERS[SHEETS.BACKUP_SNAPSHOTS]);
  
  var activeSs = getActiveSpreadsheet();
  var mainId = MAIN_SPREADSHEET_ID || activeSs.getId();
  var folder = getOrCreateBackupFolder();
  var timestamp = nowIso();
  var copyName = 'pkbm_scheduled_backup_' + timestamp.replace(/[:.]/g, '-');
  
  var fileCopy = DriveApp.getFileById(mainId).makeCopy(copyName, folder);
  
  var metadata = appendRow(SHEETS.BACKUP_SNAPSHOTS, {
    backup_file_id: fileCopy.getId(),
    backup_type: 'spreadsheet_copy',
    created_by: 'system',
    created_at: timestamp,
    status: 'created',
    sheet_count: activeSs.getSheets().length,
    record_count: 0,
    description: 'Scheduled automatic spreadsheet copy backup'
  });
  
  logHardeningAudit(admin, 'scheduled_backup_success', SHEETS.BACKUP_SNAPSHOTS, metadata.id, {
    backup_file_id: metadata.backup_file_id,
    backup_type: 'spreadsheet_copy'
  });
  
  applyBackupRetention();
}

function applyBackupRetention() {
  ensureSheetHeaders(SHEETS.BACKUP_SNAPSHOTS, SHEET_HEADERS[SHEETS.BACKUP_SNAPSHOTS]);
  var records = listRecords(SHEETS.BACKUP_SNAPSHOTS);
  records.sort(function(a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  
  if (records.length <= 30) {
    return;
  }
  
  var toDeleteRecords = records.slice(30);
  var idsToKeep = records.slice(0, 30).map(function(r) { return r.id; });
  
  toDeleteRecords.forEach(function(rec) {
    if (rec.backup_file_id) {
      try {
        var file = DriveApp.getFileById(rec.backup_file_id);
        file.setTrashed(true);
      } catch (e) {
        console.error("Failed to trash backup file: " + rec.backup_file_id + " - " + e.message);
      }
    }
  });
  
  var sheet = getActiveSpreadsheet().getSheetByName(SHEETS.BACKUP_SNAPSHOTS);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  var headers = SHEET_HEADERS[SHEETS.BACKUP_SNAPSHOTS];
  
  var dataRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var keptRows = dataRows.filter(function(row) {
    var obj = rowToObject(headers, row);
    return idsToKeep.indexOf(obj.id) !== -1;
  });
  
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (keptRows.length > 0) {
    sheet.getRange(2, 1, keptRows.length, headers.length).setValues(keptRows);
  }
}
