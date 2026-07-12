/**
 * ImportService.gs
 * Core business logic for Sprint 9 Backend Import Foundation.
 */

var IMPORT_ROW_LIMITS = {
  students: 500,
  teachers: 300,
  classes: 200,
  subjects: 200,
  class_subjects: 500,
  academic_scores: 700,
  culture_scores: 700
};

/**
 * Asserts the actor is authorized to perform import for a given type.
 * @param {Object} actor
 * @param {string} importType
 */
function assertImportPermission(actor, importType) {
  if (!actor) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Unauthorized: Session missing.'
    };
  }
  var role = actor.role;
  var allowedForGuru = ['academic_scores', 'culture_scores'];
  if (role === ROLES.TEACHER) {
    if (allowedForGuru.indexOf(importType) === -1) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: Guru is not authorized to perform import for type: ' + importType
      };
    }
  } else if (role !== ROLES.ADMINISTRATOR && role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to access import actions.'
    };
  }
}


/**
 * Helper to check and create root storage/import folders and save CSV content.
 */
function saveImportCsvToDrive(importType, fileName, csvContent) {
  var settings = getAppSettings();
  var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
  var rootFolder = getOrCreateFolder(null, rootName);
  
  var importFolder = getOrCreateFolder(rootFolder, 'import');
  var typeFolder = getOrCreateFolder(importFolder, importType);
  
  var blob = Utilities.newBlob(csvContent, 'text/csv', fileName);
  var file = typeFolder.createFile(blob);
  
  return file.getId();
}

/**
 * Endpoint: create_import_session
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Preview metrics and session details
 */
function createImportSession(payload, actor) {
  validateRequiredFields(payload, ['import_type', 'file_name', 'csv_content']);
  var importType = payload.import_type;
  assertImportPermission(actor, importType);
  var allowedTypes = ['students', 'teachers', 'classes', 'subjects', 'class_subjects', 'academic_scores', 'culture_scores'];
  if (allowedTypes.indexOf(importType) === -1) {
    throw {
      code: 'ERR_INVALID_IMPORT_TYPE',
      message: 'Invalid import type. Supported: ' + allowedTypes.join(', ')
    };
  }
  
  // Parse CSV content first to enforce limits before saving
  var parsedRows = parseCsvToObject(payload.csv_content);
  
  // Row Limit Protection
  var limit = IMPORT_ROW_LIMITS[importType] || 500;
  if (parsedRows.length > limit) {
    throw {
      code: 'ERR_ROW_LIMIT_EXCEEDED',
      message: 'Import row count (' + parsedRows.length + ') exceeds the allowed limit (' + limit + ') for type: ' + importType
    };
  }
  
  // Save CSV upload file in Google Drive
  var driveFileId = saveImportCsvToDrive(importType, payload.file_name, payload.csv_content);
  
  // Run validation preview
  var errors = validateImportRows(importType, parsedRows, actor);
  
  var totalRows = parsedRows.length;
  var fatalRowNums = {};
  errors.forEach(function(err) {
    if (err.severity !== 'warning') {
      fatalRowNums[err.row_number] = true;
    }
  });
  var invalidRowsCount = Object.keys(fatalRowNums).length;
  var successRowsCount = totalRows - invalidRowsCount;
  
  var errorReportFileId = '';
  var status = 'previewed';
  
  if (invalidRowsCount > 0) {
    // Save error report to Drive
    errorReportFileId = createErrorReportFile(payload.file_name, errors);
    status = (successRowsCount > 0) ? 'partial_success' : 'failed';
  } else {
    status = 'previewed';
  }
  
  // Create import logs record
  var logRecord = {
    import_type: importType,
    file_name: payload.file_name,
    drive_file_id: driveFileId,
    uploaded_by: actor.id,
    total_rows: totalRows,
    success_rows: 0, // Not confirmed yet
    error_rows: invalidRowsCount,
    error_report_file_id: errorReportFileId,
    status: status,
    error_summary: invalidRowsCount > 0 ? ('Validation failed for ' + invalidRowsCount + ' rows.') : ''
  };
  
  var createdLog = createRecord(SHEETS.IMPORT_LOGS, logRecord, actor);
  
  // Generate preview rows & summarize counts
  var previewRows = generatePreviewRows(importType, parsedRows, errors, actor);
  var createCount = 0;
  var updateCount = 0;
  var skipCount = 0;
  var errorCount = 0;
  var warningCount = 0;
  
  previewRows.forEach(function(p) {
    if (p.operation === 'create') createCount++;
    else if (p.operation === 'update') updateCount++;
    else if (p.operation === 'skip') skipCount++;
    else if (p.operation === 'error') errorCount++;
    
    if (p.status === 'warning') warningCount++;
  });
  
  return {
    import_log_id: createdLog.id,
    import_type: importType,
    file_name: payload.file_name,
    total_rows: totalRows,
    valid_rows: successRowsCount,
    invalid_rows: invalidRowsCount,
    create_count: createCount,
    update_count: updateCount,
    skip_count: skipCount,
    error_count: errorCount,
    warning_count: warningCount,
    error_report_file_id: errorReportFileId,
    status: status,
    preview_rows: previewRows,
    errors: errors
  };
}

/**
 * Endpoint: preview_import_data
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Preview summary
 */
function previewImportData(payload, actor) {
  validateRequiredFields(payload, ['import_log_id']);
  
  var log = getRecordById(SHEETS.IMPORT_LOGS, payload.import_log_id);
  if (!log) {
    throw { code: 'ERR_NOT_FOUND', message: 'Import session log not found.' };
  }
  assertImportPermission(actor, log.import_type);
  
  var file = DriveApp.getFileById(log.drive_file_id);
  var csvContent = file.getBlob().getDataAsString();
  
  var parsedRows = parseCsvToObject(csvContent);
  
  // Row Limit Protection
  var limit = IMPORT_ROW_LIMITS[log.import_type] || 500;
  if (parsedRows.length > limit) {
    throw {
      code: 'ERR_ROW_LIMIT_EXCEEDED',
      message: 'Import row count (' + parsedRows.length + ') exceeds the allowed limit (' + limit + ') for type: ' + log.import_type
    };
  }
  
  var errors = validateImportRows(log.import_type, parsedRows, actor);
  
  var fatalRowNums = {};
  errors.forEach(function(err) {
    if (err.severity !== 'warning') {
      fatalRowNums[err.row_number] = true;
    }
  });
  var invalidRowsCount = Object.keys(fatalRowNums).length;
  var successRowsCount = parsedRows.length - invalidRowsCount;
  
  // Generate preview rows & summarize counts
  var previewRows = generatePreviewRows(log.import_type, parsedRows, errors, actor);
  var createCount = 0;
  var updateCount = 0;
  var skipCount = 0;
  var errorCount = 0;
  var warningCount = 0;
  
  previewRows.forEach(function(p) {
    if (p.operation === 'create') createCount++;
    else if (p.operation === 'update') updateCount++;
    else if (p.operation === 'skip') skipCount++;
    else if (p.operation === 'error') errorCount++;
    
    if (p.status === 'warning') warningCount++;
  });
  
  return {
    import_log_id: log.id,
    import_type: log.import_type,
    total_rows: parsedRows.length,
    valid_rows: successRowsCount,
    invalid_rows: invalidRowsCount,
    create_count: createCount,
    update_count: updateCount,
    skip_count: skipCount,
    error_count: errorCount,
    warning_count: warningCount,
    status: log.status,
    preview_rows: previewRows,
    errors: errors
  };
}

/**
 * Endpoint: confirm_import_data
 * Processes the import session's valid rows in UPSERT mode.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Import outcome summary
 */
function confirmImportData(payload, actor) {
  validateRequiredFields(payload, ['import_log_id']);
  
  var log = getRecordById(SHEETS.IMPORT_LOGS, payload.import_log_id);
  if (!log) {
    throw { code: 'ERR_NOT_FOUND', message: 'Import session log not found.' };
  }
  assertImportPermission(actor, log.import_type);
  
  var file = DriveApp.getFileById(log.drive_file_id);
  var csvContent = file.getBlob().getDataAsString();
  
  var parsedRows = parseCsvToObject(csvContent);
  
  // Row Limit Protection
  var limit = IMPORT_ROW_LIMITS[log.import_type] || 500;
  if (parsedRows.length > limit) {
    throw {
      code: 'ERR_ROW_LIMIT_EXCEEDED',
      message: 'Import row count (' + parsedRows.length + ') exceeds the allowed limit (' + limit + ') for type: ' + log.import_type
    };
  }
  
  var errors = validateImportRows(log.import_type, parsedRows, actor);
  
  // Get row numbers that have fatal errors (not warnings)
  var errorRowNums = {};
  errors.forEach(function(err) {
    if (err.severity !== 'warning') {
      errorRowNums[err.row_number] = true;
    }
  });
  
  // Filter only valid rows
  var validRows = parsedRows.filter(function(row) {
    return !errorRowNums[row._rowNumber];
  });
  
  if (validRows.length === 0) {
    throw new Error("No valid rows to import.");
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  var importedCount = 0;
  var importedIds = [];
  var processedRows = [];
  try {
    validRows.forEach(function(row) {
      try {
        var processed = null;
        if (log.import_type === 'students') {
          processed = upsertStudentImport(row, actor);
        } else if (log.import_type === 'teachers') {
          processed = upsertTeacherImport(row, actor);
        } else if (log.import_type === 'classes') {
          processed = upsertClassImport(row, actor);
        } else if (log.import_type === 'subjects') {
          processed = upsertSubjectImport(row, actor);
        } else if (log.import_type === 'class_subjects') {
          processed = upsertClassSubjectImport(row, actor);
        } else if (log.import_type === 'academic_scores') {
          processed = upsertAcademicScoresImport(row, actor);
        } else if (log.import_type === 'culture_scores') {
          processed = upsertCultureScoresImport(row, actor);
        }
        
        if (processed && processed._import_action !== 'skipped') {
          importedCount++;
        }
        if (processed && processed.id) {
          importedIds.push(processed.id);
        }
        processedRows.push({
          row_number: row._rowNumber,
          entity_id: processed && processed.id ? processed.id : '',
          action: processed && processed._import_action ? processed._import_action : 'upserted'
        });
      } catch (rowErr) {
        errors.push({
          row_number: row._rowNumber,
          field: 'row',
          error_code: rowErr.code || 'IMPORT_FAILED',
          message: rowErr.message || String(rowErr),
          raw_data: JSON.stringify(row)
        });
      }
    });
    
    // Update log status to confirmed or partial_success
    var fatalErrors = errors.filter(function(e) { return e.severity !== 'warning'; });
    var fatalUniqueRows = {};
    fatalErrors.forEach(function(e) { fatalUniqueRows[e.row_number] = true; });
    var fatalCount = Object.keys(fatalUniqueRows).length;
    
    var finalStatus = fatalCount > 0
      ? (importedCount > 0 ? 'partial_success' : 'failed')
      : 'success';
      
    updateRecord(SHEETS.IMPORT_LOGS, log.id, {
      success_rows: importedCount,
      error_rows: fatalCount,
      status: finalStatus
    }, actor);
    
    // Log audit action
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'import_excel', // Map standard import action
      entity_type: SHEETS.IMPORT_LOGS,
      entity_id: log.id,
      old_value: '',
      new_value: '',
      description: 'Confirmed CSV import of ' + importedCount + ' valid rows for ' + log.import_type
    });
  } finally {
    lock.releaseLock();
  }
  
  return {
    import_log_id: log.id,
    total_rows: parsedRows.length,
    success_rows: importedCount,
    error_rows: errors.length,
    imported_rows: importedCount,
    imported_ids: importedIds,
    processed_rows: processedRows,
    errors: errors,
    status: finalStatus
  };
}

/**
 * Endpoint: get_import_log
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Import log entry details
 */
function getImportLog(payload, actor) {
  assertAdminOrAdministrator(actor);
  validateRequiredFields(payload, ['import_log_id']);
  
  var log = getRecordById(SHEETS.IMPORT_LOGS, payload.import_log_id);
  if (!log) {
    throw { code: 'ERR_NOT_FOUND', message: 'Import log not found.' };
  }
  return log;
}

/**
 * Helper to check if a teacher (Guru) is authorized to download/view the import error report.
 * Guru is authorized if they uploaded the session themselves, OR if it's academic/culture scores
 * and all rows in the CSV belong to class/assessments under their teaching assignment (Wali Kelas / Class Teacher).
 */
function isTeacherAuthorizedForImportFile(actor, log) {
  if (log.uploaded_by === actor.id) {
    return true;
  }
  
  if (log.import_type === 'academic_scores') {
    var file = DriveApp.getFileById(log.drive_file_id);
    var csvContent = file.getBlob().getDataAsString();
    var parsedRows = parseCsvToObject(csvContent);
    
    for (var i = 0; i < parsedRows.length; i++) {
      var row = parsedRows[i];
      var assessmentId = row.assessment_id;
      if (!assessmentId) continue;
      
      var assessment = getRecordById(SHEETS.ACADEMIC_ASSESSMENTS, assessmentId);
      if (!assessment) continue;
      
      // Verify teaching assignment for this assessment's class/year/semester
      if (!isTeacherAssignedToClass(actor.id, assessment.class_id, assessment.academic_year_id, assessment.semester_id)) {
        return false;
      }
    }
    return true;
  }
  
  if (log.import_type === 'culture_scores') {
    var file = DriveApp.getFileById(log.drive_file_id);
    var csvContent = file.getBlob().getDataAsString();
    var parsedRows = parseCsvToObject(csvContent);
    
    var students = listRecords(SHEETS.STUDENTS);
    var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS);
    var semesters = listRecords(SHEETS.SEMESTERS);
    
    for (var i = 0; i < parsedRows.length; i++) {
      var row = parsedRows[i];
      var nisnVal = String(row.nisn).trim();
      if (!nisnVal) continue;
      
      var student = students.filter(function(s) {
        return String(s.nisn).trim() === nisnVal;
      })[0];
      if (!student) continue;
      
      var scoreDate = row.score_date;
      if (!scoreDate) continue;
      
      var matchingSemesters = semesters.filter(function(sem) {
        var sStart = typeof sem.start_date === 'string' ? sem.start_date : normalizeDateString(sem.start_date);
        var sEnd = typeof sem.end_date === 'string' ? sem.end_date : normalizeDateString(sem.end_date);
        var target = normalizeDateString(scoreDate);
        return target >= sStart && target <= sEnd;
      });
      
      var resolvedSemester = matchingSemesters[0];
      for (var k = 0; k < matchingSemesters.length; k++) {
        var sem = matchingSemesters[k];
        var hasEnroll = enrollments.filter(function(e) {
          return e.student_id === student.id &&
                 e.academic_year_id === sem.academic_year_id &&
                 e.semester_id === sem.id &&
                 e.status === 'active';
        }).length > 0;
        if (hasEnroll) {
          resolvedSemester = sem;
          break;
        }
      }
      
      if (!resolvedSemester) continue;
      
      var yearId = resolvedSemester.academic_year_id;
      var semesterId = resolvedSemester.id;
      
      var enrollment = enrollments.filter(function(e) {
        return e.student_id === student.id &&
               e.academic_year_id === yearId &&
               e.semester_id === semesterId &&
               e.status === 'active';
      })[0];
      
      if (!enrollment) continue;
      
      if (!isTeacherAssignedToClass(actor.id, enrollment.class_id, yearId, semesterId)) {
        return false;
      }
    }
    return true;
  }
  
  return false;
}

/**
 * Endpoint: download_import_error_report
 * Returns details for downloading error report from Drive.
 * Supports Guru with strict class authority checks.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Download details
 */
function downloadImportErrorReport(payload, actor) {
  validateRequiredFields(payload, ['error_report_file_id']);
  
  var fileId = payload.error_report_file_id;
  
  // Find the import log by error_report_file_id
  var logs = findRows(SHEETS.IMPORT_LOGS, function(l) {
    return l.error_report_file_id === fileId;
  });
  
  if (logs.length === 0) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Import log with this error report file ID not found.'
    };
  }
  var log = logs[0];
  
  // Check authorization
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAuthorizedForImportFile(actor, log)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not authorized to download this import error report.'
      };
    }
  } else if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to download import error reports.'
    };
  }
  
  var file = DriveApp.getFileById(fileId);
  var base64Content = Utilities.base64Encode(file.getBlob().getBytes());
  var result = {
    file_id: fileId,
    file_name: file.getName(),
    mime_type: 'text/csv',
    file_size: file.getSize(),
    base64_content: base64Content
  };
  
  writeAuditLog({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'download_import_error_report',
    entity_type: SHEETS.IMPORT_LOGS,
    entity_id: log.id,
    old_value: '',
    new_value: JSON.stringify({ import_log_id: log.id, file_name: file.getName(), error_report_file_id: fileId }),
    description: 'Downloaded import error report: ' + file.getName()
  });
  
  return result;
}

/**
 * Endpoint: list_import_logs
 * Lists import logs with pagination, filtering, and sorting (created_at descending).
 * Supports Guru (sees only their own uploads).
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Paginated logs list
 */
function listImportLogs(payload, actor) {
  var isTeacher = actor.role === ROLES.TEACHER;
  var users = listRecords(SHEETS.USERS);
  var userNamesById = {};

  users.forEach(function(user) {
    userNamesById[user.id] = user.name || user.id;
  });
  
  var logs = listRecords(SHEETS.IMPORT_LOGS);
  
  // Filter logs
  logs = logs.filter(function(log) {
    if (isTeacher) {
      if (log.uploaded_by !== actor.id) {
        return false;
      }
    }
    
    if (payload.import_type && log.import_type !== payload.import_type) {
      return false;
    }
    if (payload.status && log.status !== payload.status) {
      return false;
    }
    if (payload.uploaded_by && log.uploaded_by !== payload.uploaded_by) {
      return false;
    }
    return true;
  });
  
  // Sort by created_at descending
  logs.sort(function(a, b) {
    var tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    var tB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tB - tA;
  });
  
  // Pagination
  var page = Number(payload.page || 1);
  var pageSize = Number(payload.page_size || 20);
  if (pageSize > 100) pageSize = 100;
  if (pageSize < 1) pageSize = 1;
  if (page < 1) page = 1;
  
  var totalCount = logs.length;
  var startIndex = (page - 1) * pageSize;
  var paginatedLogs = logs.slice(startIndex, startIndex + pageSize).map(function(log) {
    var enrichedLog = {};
    Object.keys(log).forEach(function(key) {
      enrichedLog[key] = log[key];
    });
    enrichedLog.uploader_name = userNamesById[log.uploaded_by] || log.uploaded_by;
    return enrichedLog;
  });
  
  return {
    logs: paginatedLogs,
    page: page,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: Math.ceil(totalCount / pageSize)
  };
}

/**
 * Endpoint: get_import_template
 * Returns columns, required columns, and sample rows for a given import type.
 * Supports Guru for academic and culture score types.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Template metadata
 */
function getImportTemplate(payload, actor) {
  validateRequiredFields(payload, ['import_type']);
  var importType = payload.import_type;
  
  assertImportPermission(actor, importType);
  
  var templates = {
    students: {
      required_columns: ['nisn', 'full_name', 'birth_date'],
      optional_columns: [
        'nik', 'birth_place', 'gender', 'religion', 'phone', 'affirmation',
        'special_needs', 'family_card_number', 'family_card_date', 'mother_name',
        'mother_nik', 'father_name', 'father_nik', 'guardian_name', 'guardian_nik',
        'address_street', 'rt', 'rw', 'hamlet', 'village', 'district', 'city', 'province',
        'status', 'parent_pin'
      ],
      sample_rows: [
        {
          nisn: '1234567890',
          full_name: 'Budi Santoso',
          birth_date: '2010-05-15',
          gender: 'L',
          status: 'Aktif',
          parent_pin: '1234'
        }
      ]
    },
    teachers: {
      required_columns: ['full_name', 'email'],
      optional_columns: ['username', 'password', 'phone', 'status', 'gender', 'address', 'nip', 'nuptk', 'position'],
      sample_rows: [
        {
          full_name: 'Siti Rahma',
          email: 'siti.rahma@pkbm.sch.id',
          username: 'sitirahma',
          password: 'Password123!',
          status: 'Aktif'
        }
      ]
    },
    classes: {
      required_columns: ['code', 'name', 'level'],
      optional_columns: ['status'],
      sample_rows: [
        {
          code: 'X-A',
          name: 'Kelas 10 A',
          level: '10',
          status: 'Aktif'
        }
      ]
    },
    subjects: {
      required_columns: ['code', 'name'],
      optional_columns: ['description', 'status'],
      sample_rows: [
        {
          code: 'MAT-10',
          name: 'Matematika Kelas 10',
          description: 'Mata pelajaran Matematika wajib Kelas 10',
          status: 'Aktif'
        }
      ]
    },
    class_subjects: {
      required_columns: ['class_code', 'subject_code', 'academic_year', 'semester'],
      optional_columns: ['status'],
      sample_rows: [
        {
          class_code: 'X-A',
          subject_code: 'MAT-10',
          academic_year: '2025/2026',
          semester: 'Ganjil',
          status: 'Aktif'
        }
      ]
    },
    academic_scores: {
      required_columns: ['assessment_id', 'nisn', 'score'],
      optional_columns: ['note'],
      sample_rows: [
        {
          assessment_id: 'ASM_171887361_1234',
          nisn: '1234567890',
          score: '85',
          note: 'Tugas diselesaikan dengan baik'
        }
      ]
    },
    culture_scores: {
      required_columns: ['nisn', 'score_date', 'sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'],
      optional_columns: [],
      sample_rows: [
        {
          nisn: '1234567890',
          score_date: '2026-06-20',
          sss: '4',
          am: '3',
          hb: '4',
          asm: '4',
          br: '3',
          ak: '4',
          tm: '4'
        }
      ]
    }
  };
  
  var template = templates[importType];
  if (!template) {
    throw {
      code: 'ERR_INVALID_IMPORT_TYPE',
      message: 'Invalid import type. Supported: ' + Object.keys(templates).join(', ')
    };
  }
  
  return template;
}

// --- SPECIFIC UPSERT PROCESSORS ---

function upsertStudentImport(row, actor) {
  var nisnVal = String(row.nisn).trim();
  var existing = listRecords(SHEETS.STUDENTS, function(s) {
    return String(s.nisn).trim() === nisnVal;
  });
  
  var studentData = {
    nisn: nisnVal,
    nik: row.nik || '',
    full_name: row.full_name,
    birth_place: row.birth_place || '',
    birth_date: row.birth_date,
    gender: row.gender || '',
    religion: row.religion || '',
    phone: row.phone || '',
    affirmation: row.affirmation || '',
    special_needs: row.special_needs || '',
    family_card_number: row.family_card_number || '',
    family_card_date: row.family_card_date || '',
    mother_name: row.mother_name || '',
    mother_nik: row.mother_nik || '',
    father_name: row.father_name || '',
    father_nik: row.father_nik || '',
    guardian_name: row.guardian_name || '',
    guardian_nik: row.guardian_nik || '',
    address_street: row.address_street || '',
    rt: row.rt || '',
    rw: row.rw || '',
    hamlet: row.hamlet || '',
    village: row.village || '',
    district: row.district || '',
    city: row.city || '',
    province: row.province || '',
    status: row.status || 'Aktif'
  };
  
  if (row.parent_pin) {
    studentData.parent_access_pin = row.parent_pin;
  }
  
  var result;
  if (existing.length > 0) {
    var updateData = {};
    Object.keys(studentData).forEach(function(key) {
      if (key !== 'parent_access_pin') {
        updateData[key] = studentData[key];
      }
    });
    result = updateStudent(existing[0].id, updateData, actor);
    if (row.parent_pin) {
      result = resetStudentParentPin(existing[0].id, row.parent_pin, actor);
    }
    result._import_action = 'updated';
  } else {
    result = createStudent(studentData, actor);
    result._import_action = 'created';
  }
  
  return result;
}

function upsertTeacherImport(row, actor) {
  var email = String(row.email || '').trim();
  var username = String(row.username || '').trim();
  if (!username && email) {
    username = email.split('@')[0];
  }
  
  var existingUser = getUserByIdentifier(email) || getUserByIdentifier(username);
  
  var userRecord;
  if (existingUser) {
    var userPatch = {
      name: row.full_name || existingUser.name,
      phone: row.phone || existingUser.phone,
      status: row.status || existingUser.status
    };
    userRecord = updateRecord(SHEETS.USERS, existingUser.id, userPatch, actor);
  } else {
    var rawPassword = row.password || 'Guru123!';
    var newUser = {
      name: row.full_name,
      email: email,
      username: username,
      password_hash: hashPassword(rawPassword),
      role: ROLES.TEACHER,
      phone: row.phone || '',
      status: row.status || STATUS.ACTIVE,
      failed_login_attempts: 0,
      locked_until: ''
    };
    userRecord = createRecord(SHEETS.USERS, newUser, actor);
  }
  
  var existingProfiles = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
    return p.user_id === userRecord.id;
  });
  
  var profileData = {
    user_id: userRecord.id,
    full_name: row.full_name,
    gender: row.gender || '',
    phone: row.phone || '',
    address: row.address || '',
    nip: row.nip || '',
    nuptk: row.nuptk || '',
    position: row.position || '',
    status: row.status || STATUS.ACTIVE
  };
  
  if (existingProfiles.length > 0) {
    updateRecord(SHEETS.TEACHER_PROFILES, existingProfiles[0].id, profileData, actor);
  } else {
    createRecord(SHEETS.TEACHER_PROFILES, profileData, actor);
  }
}

function upsertClassImport(row, actor) {
  var codeVal = String(row.code).trim();
  var existing = listRecords(SHEETS.CLASSES, function(c) {
    return c.code === codeVal;
  });
  
  var classData = {
    code: codeVal,
    name: row.name,
    level: row.level,
    status: row.status || STATUS.ACTIVE
  };
  
  if (existing.length > 0) {
    updateRecord(SHEETS.CLASSES, existing[0].id, classData, actor);
  } else {
    createRecord(SHEETS.CLASSES, classData, actor);
  }
}

function upsertSubjectImport(row, actor) {
  var codeVal = String(row.code).trim();
  var existing = listRecords(SHEETS.SUBJECTS, function(s) {
    return s.code === codeVal;
  });
  
  var subjData = {
    code: codeVal,
    name: row.name,
    description: row.description || '',
    status: row.status || STATUS.ACTIVE
  };
  
  if (existing.length > 0) {
    updateRecord(SHEETS.SUBJECTS, existing[0].id, subjData, actor);
  } else {
    createRecord(SHEETS.SUBJECTS, subjData, actor);
  }
}

function upsertClassSubjectImport(row, actor) {
  var classCode = String(row.class_code).trim();
  var subjectCode = String(row.subject_code).trim();
  var academicYear = String(row.academic_year).trim();
  var semester = String(row.semester).trim();
  
  var classObj = listRecords(SHEETS.CLASSES, function(c) { return c.code === classCode; })[0];
  var subjectObj = listRecords(SHEETS.SUBJECTS, function(s) { return s.code === subjectCode; })[0];
  var yearObj = listRecords(SHEETS.ACADEMIC_YEARS, function(y) { return y.name === academicYear; })[0];
  var semesterObj = listRecords(SHEETS.SEMESTERS, function(sem) {
    return sem.name === semester && sem.academic_year_id === yearObj.id;
  })[0];
  
  var existing = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
    return cs.class_id === classObj.id &&
           cs.subject_id === subjectObj.id &&
           cs.academic_year_id === yearObj.id &&
           cs.semester_id === semesterObj.id;
  });
  
  var classSubjData = {
    class_id: classObj.id,
    subject_id: subjectObj.id,
    academic_year_id: yearObj.id,
    semester_id: semesterObj.id,
    status: row.status || STATUS.ACTIVE
  };
  
  if (existing.length > 0) {
    updateRecord(SHEETS.CLASS_SUBJECTS, existing[0].id, classSubjData, actor);
  } else {
    createRecord(SHEETS.CLASS_SUBJECTS, classSubjData, actor);
  }
}

function upsertAcademicScoresImport(row, actor) {
  var scoreRaw = row.score;
  if (scoreRaw === undefined || scoreRaw === null || String(scoreRaw).trim() === '') {
    return {
      id: '',
      _import_action: 'skipped'
    };
  }
  
  var nisnVal = String(row.nisn).trim();
  var student = listRecords(SHEETS.STUDENTS, function(s) {
    return String(s.nisn).trim() === nisnVal;
  })[0];
  
  var assessment = getRecordById(SHEETS.ACADEMIC_ASSESSMENTS, row.assessment_id);
  var enrollment = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === student.id &&
           e.class_id === assessment.class_id &&
           e.academic_year_id === assessment.academic_year_id &&
           e.semester_id === assessment.semester_id &&
           e.status === 'active';
  })[0];
  
  var payload = {
    assessment_id: row.assessment_id,
    scores: [
      {
        student_id: student.id,
        student_enrollment_id: enrollment.id,
        score: Number(scoreRaw),
        note: row.note || ''
      }
    ]
  };
  
  var results = saveAcademicScores(payload, actor);
  var result = results[0];
  result._import_action = 'upserted';
  return result;
}

function upsertCultureScoresImport(row, actor) {
  var indicators = ['sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
  var allEmpty = true;
  indicators.forEach(function(ind) {
    if (row[ind] !== undefined && row[ind] !== null && String(row[ind]).trim() !== '') {
      allEmpty = false;
    }
  });
  if (allEmpty) {
    return {
      id: '',
      _import_action: 'skipped'
    };
  }
  
  var nisnVal = String(row.nisn).trim();
  var student = listRecords(SHEETS.STUDENTS, function(s) {
    return String(s.nisn).trim() === nisnVal;
  })[0];
  
  var matchingSemesters = listRecords(SHEETS.SEMESTERS, function(sem) {
    var sStart = typeof sem.start_date === 'string' ? sem.start_date : normalizeDateString(sem.start_date);
    var sEnd = typeof sem.end_date === 'string' ? sem.end_date : normalizeDateString(sem.end_date);
    var target = normalizeDateString(row.score_date);
    return target >= sStart && target <= sEnd;
  });
  
  var resolvedSemester = matchingSemesters[0];
  for (var k = 0; k < matchingSemesters.length; k++) {
    var sem = matchingSemesters[k];
    var hasEnroll = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
      return e.student_id === student.id &&
             e.academic_year_id === sem.academic_year_id &&
             e.semester_id === sem.id &&
             e.status === 'active';
    }).length > 0;
    if (hasEnroll) {
      resolvedSemester = sem;
      break;
    }
  }
  
  var yearId = resolvedSemester.academic_year_id;
  var semesterId = resolvedSemester.id;
  
  var enrollment = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === student.id &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  })[0];
  var classId = enrollment.class_id;
  
  var existingRecords = listRecords(SHEETS.CULTURE_SCORES, function(r) {
    return r.student_id === student.id &&
           normalizeDateString(r.score_date) === normalizeDateString(row.score_date) &&
           r.status === 'active';
  });
  
  var sssVal = (row.sss === undefined || row.sss === null || String(row.sss).trim() === '') ? null : Number(row.sss);
  var amVal = (row.am === undefined || row.am === null || String(row.am).trim() === '') ? null : Number(row.am);
  var hbVal = (row.hb === undefined || row.hb === null || String(row.hb).trim() === '') ? null : Number(row.hb);
  var asmVal = (row.asm === undefined || row.asm === null || String(row.asm).trim() === '') ? null : Number(row.asm);
  var brVal = (row.br === undefined || row.br === null || String(row.br).trim() === '') ? null : Number(row.br);
  var akVal = (row.ak === undefined || row.ak === null || String(row.ak).trim() === '') ? null : Number(row.ak);
  var tmVal = (row.tm === undefined || row.tm === null || String(row.tm).trim() === '') ? null : Number(row.tm);
  
  if (existingRecords.length > 0) {
    var existing = existingRecords[0];
    if (sssVal === null && existing.sss_score !== null && existing.sss_score !== '') sssVal = Number(existing.sss_score);
    if (amVal === null && existing.am_score !== null && existing.am_score !== '') amVal = Number(existing.am_score);
    if (hbVal === null && existing.hb_score !== null && existing.hb_score !== '') hbVal = Number(existing.hb_score);
    if (asmVal === null && existing.asm_score !== null && existing.asm_score !== '') asmVal = Number(existing.asm_score);
    if (brVal === null && existing.br_score !== null && existing.br_score !== '') brVal = Number(existing.br_score);
    if (akVal === null && existing.ak_score !== null && existing.ak_score !== '') akVal = Number(existing.ak_score);
    if (tmVal === null && existing.tm_score !== null && existing.tm_score !== '') tmVal = Number(existing.tm_score);
  }
  
  var payload = {
    class_id: classId,
    academic_year_id: yearId,
    semester_id: semesterId,
    score_date: row.score_date,
    scores: [
      {
        student_id: student.id,
        student_enrollment_id: enrollment.id,
        sss: sssVal,
        am: amVal,
        hb: hbVal,
        asm: asmVal,
        br: brVal,
        ak: akVal,
        tm: tmVal
      }
    ]
  };
  
  var results = saveCultureScores(payload, actor);
  var result = results[0];
  result._import_action = existingRecords.length > 0 ? 'updated' : 'created';
  return result;
}

/**
 * Compares CSV rows with database entries to identify operations, field level changes,
 * and masks sensitive fields for frontend UI preview mapping.
 */
function generatePreviewRows(importType, parsedRows, errors, actor) {
  var previewRows = [];
  
  // 1. Group errors and warnings by row number
  var errorsByRow = {};
  var warningsByRow = {};
  errors.forEach(function(err) {
    var r = err.row_number;
    if (err.severity === 'warning') {
      if (!warningsByRow[r]) warningsByRow[r] = [];
      warningsByRow[r].push(err.message || '');
    } else {
      if (!errorsByRow[r]) errorsByRow[r] = [];
      errorsByRow[r].push(err.message || '');
    }
  });
  
  // 2. Pre-fetch relevant DB tables to avoid N+1 queries
  var db = {};
  if (importType === 'students') {
    db.students = listRecords(SHEETS.STUDENTS);
  } else if (importType === 'teachers') {
    db.users = listRecords(SHEETS.USERS);
    db.profiles = listRecords(SHEETS.TEACHER_PROFILES);
  } else if (importType === 'classes') {
    db.classes = listRecords(SHEETS.CLASSES);
  } else if (importType === 'subjects') {
    db.subjects = listRecords(SHEETS.SUBJECTS);
  } else if (importType === 'class_subjects') {
    db.classes = listRecords(SHEETS.CLASSES);
    db.subjects = listRecords(SHEETS.SUBJECTS);
    db.years = listRecords(SHEETS.ACADEMIC_YEARS);
    db.semesters = listRecords(SHEETS.SEMESTERS);
    db.class_subjects = listRecords(SHEETS.CLASS_SUBJECTS);
  } else if (importType === 'academic_scores') {
    db.assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS);
    db.students = listRecords(SHEETS.STUDENTS);
    db.enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS);
    db.scores = listRecords(SHEETS.ACADEMIC_SCORES);
  } else if (importType === 'culture_scores') {
    db.students = listRecords(SHEETS.STUDENTS);
    db.enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS);
    db.semesters = listRecords(SHEETS.SEMESTERS);
    db.scores = listRecords(SHEETS.CULTURE_SCORES);
  }
  
  // Fields that must be redacted in the changes list
  var sensitiveFields = [
    'nik', 'family_card_number', 'parent_pin', 'parent_access_pin_hash',
    'password', 'password_hash', 'mother_nik', 'father_nik', 'guardian_nik'
  ];
  
  parsedRows.forEach(function(row) {
    var rowNum = row._rowNumber;
    var rowErrors = errorsByRow[rowNum] || [];
    var rowWarnings = warningsByRow[rowNum] || [];
    
    var status = 'valid';
    if (rowErrors.length > 0) {
      status = 'invalid';
    } else if (rowWarnings.length > 0) {
      status = 'warning';
    }
    
    var operation = 'create';
    var identifier = '';
    var displayName = '';
    var changes = [];
    
    if (status === 'invalid') {
      operation = 'error';
    }
    
    var existingRecord = null;
    
    if (importType === 'students') {
      identifier = String(row.nisn || '').trim();
      displayName = row.full_name || '';
      
      if (identifier) {
        existingRecord = db.students.filter(function(s) {
          return String(s.nisn).trim() === identifier;
        })[0];
      }
      
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        var fieldsToCompare = [
          'nik', 'full_name', 'birth_place', 'birth_date', 'gender', 'religion',
          'phone', 'affirmation', 'special_needs', 'family_card_number',
          'family_card_date', 'mother_name', 'mother_nik', 'father_name',
          'father_nik', 'guardian_name', 'guardian_nik', 'address_street',
          'rt', 'rw', 'hamlet', 'village', 'district', 'city', 'province', 'status'
        ];
        
        fieldsToCompare.forEach(function(f) {
          var newVal = row[f] !== undefined ? String(row[f]).trim() : '';
          var oldVal = existingRecord[f] !== undefined ? String(existingRecord[f]).trim() : '';
          
          if (f === 'birth_date' && oldVal) {
            oldVal = oldVal.split('T')[0];
          }
          if (f === 'gender') {
            newVal = newVal.toUpperCase();
            oldVal = oldVal.toUpperCase();
          }
          
          if (newVal !== oldVal) {
            var isSensitive = sensitiveFields.indexOf(f) !== -1;
            changes.push({
              field: f,
              old_value: isSensitive ? '[REDACTED]' : oldVal,
              new_value: isSensitive ? '[REDACTED]' : newVal
            });
          }
        });
        
        if (row.parent_pin !== undefined && row.parent_pin !== '') {
          changes.push({
            field: 'parent_pin',
            old_value: '[REDACTED]',
            new_value: '[REDACTED]'
          });
        }
      }
    } else if (importType === 'teachers') {
      var email = String(row.email || '').trim();
      var username = String(row.username || '').trim();
      identifier = email || username;
      displayName = row.full_name || '';
      
      if (email || username) {
        existingRecord = db.users.filter(function(u) {
          return (email && String(u.email).trim() === email) || (username && String(u.username).trim() === username);
        })[0];
      }
      
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        var profile = db.profiles.filter(function(p) { return p.user_id === existingRecord.id; })[0];
        
        var userCompare = {
          name: row.full_name,
          phone: row.phone,
          status: row.status
        };
        Object.keys(userCompare).forEach(function(f) {
          var newVal = userCompare[f] !== undefined ? String(userCompare[f]).trim() : '';
          var oldVal = existingRecord[f] !== undefined ? String(existingRecord[f]).trim() : '';
          if (newVal && newVal !== oldVal) {
            changes.push({ field: f, old_value: oldVal, new_value: newVal });
          }
        });
        
        if (profile) {
          var profileCompare = {
            gender: row.gender,
            address: row.address,
            nip: row.nip,
            nuptk: row.nuptk,
            position: row.position
          };
          Object.keys(profileCompare).forEach(function(f) {
            var newVal = profileCompare[f] !== undefined ? String(profileCompare[f]).trim() : '';
            var oldVal = profile[f] !== undefined ? String(profile[f]).trim() : '';
            if (newVal && newVal !== oldVal) {
              changes.push({ field: f, old_value: oldVal, new_value: newVal });
            }
          });
        }
        
        if (row.password !== undefined && row.password !== '') {
          changes.push({ field: 'password', old_value: '[REDACTED]', new_value: '[REDACTED]' });
        }
      }
    } else if (importType === 'classes') {
      identifier = String(row.code || '').trim();
      displayName = row.name || '';
      
      if (identifier) {
        existingRecord = db.classes.filter(function(c) { return String(c.code).trim() === identifier; })[0];
      }
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        ['name', 'level', 'status'].forEach(function(f) {
          var newVal = row[f] !== undefined ? String(row[f]).trim() : '';
          var oldVal = existingRecord[f] !== undefined ? String(existingRecord[f]).trim() : '';
          if (newVal && newVal !== oldVal) {
            changes.push({ field: f, old_value: oldVal, new_value: newVal });
          }
        });
      }
    } else if (importType === 'subjects') {
      identifier = String(row.code || '').trim();
      displayName = row.name || '';
      
      if (identifier) {
        existingRecord = db.subjects.filter(function(s) { return String(s.code).trim() === identifier; })[0];
      }
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        ['name', 'description', 'status'].forEach(function(f) {
          var newVal = row[f] !== undefined ? String(row[f]).trim() : '';
          var oldVal = existingRecord[f] !== undefined ? String(existingRecord[f]).trim() : '';
          if (newVal && newVal !== oldVal) {
            changes.push({ field: f, old_value: oldVal, new_value: newVal });
          }
        });
      }
    } else if (importType === 'class_subjects') {
      var classCode = String(row.class_code || '').trim();
      var subjectCode = String(row.subject_code || '').trim();
      var academicYear = String(row.academic_year || '').trim();
      var semester = String(row.semester || '').trim();
      identifier = classCode + '::' + subjectCode + '::' + academicYear + '::' + semester;
      displayName = classCode + ' - ' + subjectCode;
      
      if (classCode && subjectCode && academicYear && semester && status !== 'invalid') {
        var classObj = db.classes.filter(function(c) { return c.code === classCode; })[0];
        var subjectObj = db.subjects.filter(function(s) { return s.code === subjectCode; })[0];
        var yearObj = db.years.filter(function(y) { return y.name === academicYear; })[0];
        var semesterObj = yearObj ? db.semesters.filter(function(sem) { return sem.name === semester && sem.academic_year_id === yearObj.id; })[0] : null;
        
        if (classObj && subjectObj && yearObj && semesterObj) {
          existingRecord = db.class_subjects.filter(function(cs) {
            return cs.class_id === classObj.id &&
                   cs.subject_id === subjectObj.id &&
                   cs.academic_year_id === yearObj.id &&
                   cs.semester_id === semesterObj.id;
          })[0];
        }
      }
      
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        var newVal = row.status !== undefined ? String(row.status).trim() : 'active';
        var oldVal = existingRecord.status || '';
        if (newVal !== oldVal) {
          changes.push({ field: 'status', old_value: oldVal, new_value: newVal });
        }
      }
    } else if (importType === 'academic_scores') {
      var nisn = String(row.nisn || '').trim();
      var assessmentId = String(row.assessment_id || '').trim();
      identifier = nisn + '::' + assessmentId;
      
      var student = db.students.filter(function(s) { return String(s.nisn).trim() === nisn; })[0];
      var assessment = db.assessments.filter(function(a) { return a.id === assessmentId; })[0];
      displayName = (student ? student.full_name : 'Siswa ' + nisn) + ' - ' + (assessment ? assessment.title : 'Asesmen ' + assessmentId);
      
      if (student && assessment && status !== 'invalid') {
        existingRecord = db.scores.filter(function(s) {
          return s.student_id === student.id && s.assessment_id === assessment.id && s.status === STATUS.ACTIVE;
        })[0];
      }
      
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        var newVal = (row.score === undefined || row.score === null || String(row.score).trim() === '') ? null : Number(row.score);
        var oldVal = (existingRecord.score === null || existingRecord.score === '') ? null : Number(existingRecord.score);
        
        if (newVal !== oldVal) {
          changes.push({
            field: 'score',
            old_value: oldVal === null ? '' : String(oldVal),
            new_value: newVal === null ? '' : String(newVal)
          });
        }
        var newNote = row.note || '';
        var oldNote = existingRecord.note || '';
        if (newNote !== oldNote) {
          changes.push({ field: 'note', old_value: oldNote, new_value: newNote });
        }
      }
    } else if (importType === 'culture_scores') {
      var nisn = String(row.nisn || '').trim();
      var scoreDate = String(row.score_date || '').trim();
      identifier = nisn + '::' + scoreDate;
      
      var student = db.students.filter(function(s) { return String(s.nisn).trim() === nisn; })[0];
      displayName = (student ? student.full_name : 'Siswa ' + nisn) + ' - ' + scoreDate;
      
      if (student && scoreDate && status !== 'invalid') {
        existingRecord = db.scores.filter(function(r) {
          return r.student_id === student.id && normalizeDateString(r.score_date) === normalizeDateString(scoreDate) && r.status === 'active';
        })[0];
      }
      
      if (existingRecord && status !== 'invalid') {
        operation = 'update';
        var indicators = ['sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
        indicators.forEach(function(ind) {
          var newVal = (row[ind] === undefined || row[ind] === null || String(row[ind]).trim() === '') ? null : Number(row[ind]);
          var oldVal = (existingRecord[ind + '_score'] === null || existingRecord[ind + '_score'] === '') ? null : Number(existingRecord[ind + '_score']);
          
          if (newVal !== null && newVal !== oldVal) {
            changes.push({
              field: ind,
              old_value: oldVal === null ? '' : String(oldVal),
              new_value: String(newVal)
            });
          }
        });
      }
    }
    
    if (operation === 'update' && changes.length === 0) {
      operation = 'skip';
    }
    
    previewRows.push({
      row_number: rowNum,
      operation: operation,
      status: status,
      identifier: identifier,
      display_name: displayName,
      changes: changes,
      warnings: rowWarnings,
      errors: rowErrors
    });
  });
  
  return previewRows;
}

