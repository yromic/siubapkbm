/**
 * ExportArtifactService.gs
 * Metadata, history, authorization, and download contracts for CSV artifacts.
 */

function recordCsvExportArtifact(metadata, actor) {
  ensureSheetHeaders(SHEETS.REPORT_EXPORTS, SHEET_HEADERS[SHEETS.REPORT_EXPORTS]);
  var file = DriveApp.getFileById(metadata.file_id);
  var size = '';
  try { size = file.getSize(); } catch (err) {
    try { size = file.getBlob().getBytes().length; } catch (blobErr) { size = ''; }
  }
  return createRecord(SHEETS.REPORT_EXPORTS, {
    report_type: metadata.report_type,
    snapshot_id: '', student_id: metadata.student_id || '', class_id: metadata.class_id || '',
    academic_year_id: metadata.academic_year_id || '', semester_id: metadata.semester_id || '',
    generated_by: actor.id, generated_at: nowIso(), status: 'completed',
    file_id: metadata.file_id, file_name: metadata.file_name, mime_type: metadata.mime_type,
    file_size: size, source_type: metadata.source_type, source_id: metadata.source_id || '',
    total_rows: metadata.total_rows
  }, actor);
}

function isCsvExportArtifact(record) {
  return !!(record && record.file_id && record.source_type && /_csv$/.test(String(record.source_type)));
}

function assertCanAccessExport(actor, exportRecord) {
  if (!actor) throw { code: 'ERR_UNAUTHORIZED', message: 'Authentication required.' };
  if (!isCsvExportArtifact(exportRecord)) {
    throw { code: 'ERR_NOT_FOUND', message: 'Export artifact not found.' };
  }
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) return true;
  if (actor.role !== ROLES.TEACHER) throw { code: 'ERR_FORBIDDEN', message: 'Forbidden: Export access denied.' };
  if (exportRecord.generated_by === actor.id) return true;
  if (exportRecord.class_id && isTeacherAssignedToClass(actor.id, exportRecord.class_id, exportRecord.academic_year_id, exportRecord.semester_id)) return true;
  throw { code: 'ERR_FORBIDDEN', message: 'Forbidden: You cannot access this export.' };
}

function listExportHistory(payload, actor) {
  assertExportPermissionGeneral(actor);
  ensureSheetHeaders(SHEETS.REPORT_EXPORTS, SHEET_HEADERS[SHEETS.REPORT_EXPORTS]);
  var page = Math.max(1, parseInt(payload.page, 10) || 1);
  var pageSize = Math.max(1, Math.min(100, parseInt(payload.page_size, 10) || 20));
  var users = listRecords(SHEETS.USERS);
  var userNames = {};
  users.forEach(function(user) { userNames[user.id] = user.name || user.id; });
  var rows = listRecords(SHEETS.REPORT_EXPORTS).filter(isCsvExportArtifact).filter(function(record) {
    if (payload.export_type && record.report_type !== payload.export_type) return false;
    if (payload.status && record.status !== payload.status) return false;
    try { assertCanAccessExport(actor, record); return true; } catch (err) { return false; }
  }).sort(function(a, b) { return String(b.generated_at).localeCompare(String(a.generated_at)); });
  var total = rows.length;
  var start = (page - 1) * pageSize;
  return {
    exports: rows.slice(start, start + pageSize).map(function(record) {
      return {
        export_id: record.id, export_type: record.report_type, source_type: record.source_type,
        source_id: record.source_id, file_name: record.file_name, mime_type: record.mime_type,
        file_size: Number(record.file_size) || 0, generated_by: record.generated_by,
        generated_by_name: userNames[record.generated_by] || record.generated_by,
        generated_at: record.generated_at, status: record.status,
        total_rows: Number(record.total_rows) || 0, download_available: record.status === 'completed' && !!record.file_id
      };
    }),
    total: total, page: page, page_size: pageSize
  };
}

function downloadReportExport(payload, actor) {
  validateRequiredFields(payload, ['export_id']);
  var record = getRecordById(SHEETS.REPORT_EXPORTS, payload.export_id);
  if (!record || !isCsvExportArtifact(record)) throw { code: 'ERR_NOT_FOUND', message: 'Export artifact not found.' };
  assertCanAccessExport(actor, record);
  var file;
  try { file = DriveApp.getFileById(record.file_id); } catch (err) {
    throw { code: 'ERR_FILE_NOT_FOUND', message: 'Export file is no longer available.' };
  }
  var result = {
    export_id: record.id, file_name: record.file_name, mime_type: record.mime_type,
    file_size: Number(record.file_size) || 0, base64_content: Utilities.base64Encode(file.getBlob().getBytes())
  };
  writeAuditLog({
    user_id: actor.id, user_name: actor.name, user_role: actor.role,
    action: 'download_export', entity_type: SHEETS.REPORT_EXPORTS, entity_id: record.id,
    old_value: '', new_value: JSON.stringify({ export_id: record.id, export_type: record.report_type, file_name: record.file_name, source_type: record.source_type, source_id: record.source_id }),
    description: 'Downloaded CSV export artifact: ' + record.file_name
  });
  return result;
}
