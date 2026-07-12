/**
 * StorageIntegrityService.gs
 * Google Drive and student_files metadata integrity checks for Sprint 11.
 */

function runStorageIntegrityCheck(payload, actor) {
  payload = payload || {};
  assertHardeningReadRole(actor);

  var issues = [];
  var files = listRecords(SHEETS.STUDENT_FILES);
  var metadataDriveIds = {};
  var validStatuses = ['active', 'replaced', 'archived'];
  var orphanScanLimit = Number(payload.orphan_scan_limit || 200);
  if (isNaN(orphanScanLimit) || orphanScanLimit < 0) orphanScanLimit = 200;

  checkStorageRoot(issues);
  files.forEach(function(row) {
    if (row.drive_file_id) metadataDriveIds[String(row.drive_file_id)] = true;
    if (validStatuses.indexOf(String(row.status || '')) === -1) {
      addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_FILES, row.id, 'INVALID_FILE_STATUS', 'student_files.status must be active, replaced, or archived.', { status: row.status });
    }
    checkDriveFileForMetadata(row, issues);
  });

  checkDuplicateActiveStudentFiles(files, issues);
  checkNonActiveFilesPointingToActiveDriveFile(files, issues);
  checkDriveFilesWithoutMetadata(metadataDriveIds, issues, orphanScanLimit);

  var summary = summarizeIntegrityIssues(issues, { student_files: files });
  var result = {
    status: deriveHardeningStatus(summary.criticals, summary.warnings),
    issues: payload.summary_only ? [] : issues,
    summary: summary
  };

  if (!payload.skip_audit) {
    logHardeningAudit(actor, 'run_storage_integrity_check', 'storage_integrity', '', {
      status: result.status,
      issue_count: issues.length
    });
  }

  return result;
}

function checkStorageRoot(issues) {
  try {
    var settings = getAppSettings();
    var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
    var folders = DriveApp.getFoldersByName(rootName);
    if (!folders.hasNext()) {
      addIntegrityIssue(issues, 'critical', 'drive', rootName, 'STORAGE_ROOT_NOT_FOUND', 'Root storage folder does not exist or is not accessible.', { root_folder_name: rootName });
    }
  } catch (err) {
    addIntegrityIssue(issues, 'critical', 'drive', '', 'STORAGE_ROOT_UNREADABLE', 'Root storage folder cannot be checked.', { error: String(err && err.message ? err.message : err) });
  }
}

function checkDriveFileForMetadata(row, issues) {
  if (!row.drive_file_id) {
    addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_FILES, row.id, 'MISSING_DRIVE_FILE_ID', 'Metadata row has no drive_file_id.', {});
    return;
  }

  try {
    var file = DriveApp.getFileById(row.drive_file_id);
    var access = file.getSharingAccess();
    if (access === DriveApp.Access.ANYONE || access === DriveApp.Access.ANYONE_WITH_LINK) {
      addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_FILES, row.id, 'DRIVE_FILE_PUBLIC', 'Drive file is public or anyone-with-link.', { drive_file_id: row.drive_file_id, sharing_access: String(access) });
    }
  } catch (err) {
    addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_FILES, row.id, 'DRIVE_FILE_NOT_FOUND', 'student_files.drive_file_id cannot be opened in Google Drive.', { drive_file_id: row.drive_file_id, error: String(err && err.message ? err.message : err) });
  }
}

function checkDuplicateActiveStudentFiles(files, issues) {
  var groups = {};
  files.forEach(function(row) {
    var status = String(row.status || '');
    if (status !== 'active') return;
    var key = [row.student_id || '', row.file_type || ''].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  Object.keys(groups).forEach(function(key) {
    if (groups[key].length <= 1) return;
    groups[key].forEach(function(row) {
      addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_FILES, row.id, 'DUPLICATE_ACTIVE_STUDENT_FILE', 'More than one active file exists for student_id + file_type.', { duplicate_key: key, duplicate_count: groups[key].length });
    });
  });
}

function checkNonActiveFilesPointingToActiveDriveFile(files, issues) {
  var activeDriveIds = {};
  files.forEach(function(row) {
    if (row.status === 'active' && row.drive_file_id) {
      activeDriveIds[String(row.drive_file_id)] = row.id;
    }
  });

  files.forEach(function(row) {
    if ((row.status === 'replaced' || row.status === 'archived') && row.drive_file_id && activeDriveIds[String(row.drive_file_id)]) {
      addIntegrityIssue(issues, 'warning', SHEETS.STUDENT_FILES, row.id, 'NON_ACTIVE_FILE_REFERENCED_AS_ACTIVE', 'Replaced/archived metadata points to the same Drive file as an active metadata row.', {
        drive_file_id: row.drive_file_id,
        active_metadata_id: activeDriveIds[String(row.drive_file_id)]
      });
    }
  });
}

function checkDriveFilesWithoutMetadata(metadataDriveIds, issues, limit) {
  if (limit === 0) return;
  try {
    var settings = getAppSettings();
    var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
    var folders = DriveApp.getFoldersByName(rootName);
    if (!folders.hasNext()) return;
    var found = [];
    collectDriveFileIds(folders.next(), found, limit);
    found.forEach(function(fileInfo) {
      if (!metadataDriveIds[fileInfo.id]) {
        addIntegrityIssue(issues, 'warning', 'drive', fileInfo.id, 'DRIVE_FILE_WITHOUT_METADATA', 'Drive file exists under root storage but has no student_files metadata.', fileInfo);
      }
    });
  } catch (err) {
    addIntegrityIssue(issues, 'warning', 'drive', '', 'DRIVE_ORPHAN_SCAN_FAILED', 'Could not scan Drive files without metadata.', { error: String(err && err.message ? err.message : err) });
  }
}

function collectDriveFileIds(folder, found, limit) {
  if (found.length >= limit) return;
  var files = folder.getFiles();
  while (files.hasNext() && found.length < limit) {
    var file = files.next();
    found.push({ id: file.getId(), name: file.getName() });
  }
  var folders = folder.getFolders();
  while (folders.hasNext() && found.length < limit) {
    collectDriveFileIds(folders.next(), found, limit);
  }
}
