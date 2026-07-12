/**
 * StudentFileService.gs
 * Core business logic for Student Document Management & Secure Student Files.
 */

/**
 * Endpoint action: upload_student_file
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Created file record metadata
 */
function uploadStudentFile(payload, actor) {
  assertCanWriteFile(actor);
  validateStudentFilePayload(payload);
  
  var studentId = payload.student_id;
  var fileType = payload.file_type;
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    // 1. Upload to Google Drive first
    var driveFileId = saveFileToDrive(
      studentId,
      fileType,
      payload.file_name,
      payload.mime_type,
      payload.base64_content
    );
    
    // 2. Resolve versioning
    var version = 1;
    var existingActiveFiles = listRecords(SHEETS.STUDENT_FILES, function(f) {
      return f.student_id === studentId && f.file_type === fileType && f.status === 'active';
    });
    
    if (existingActiveFiles.length > 0) {
      var oldFile = existingActiveFiles[0];
      version = (Number(oldFile.version) || 0) + 1;
      
      // Update old file status to replaced
      updateRecord(SHEETS.STUDENT_FILES, oldFile.id, { status: 'replaced' }, actor);
    }
    
    // 3. Save new file record to Spreadsheet
    var sizeInBytes = getBase64SizeInBytes(payload.base64_content);
    var record = {
      student_id: studentId,
      file_type: fileType,
      drive_file_id: driveFileId,
      original_filename: payload.file_name,
      mime_type: payload.mime_type,
      file_size: sizeInBytes,
      version: version,
      status: 'active',
      uploaded_by: actor.id,
      uploaded_at: nowIso()
    };
    
    var createdFile = createRecord(SHEETS.STUDENT_FILES, record, actor);
    
    // 4. Log custom audit log action: student_file_uploaded
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'student_file_uploaded',
      entity_type: SHEETS.STUDENT_FILES,
      entity_id: createdFile.id,
      old_value: '',
      new_value: JSON.stringify(createdFile),
      description: 'Uploaded student file of type ' + fileType + ' for student ID: ' + studentId
    });
    
    return createdFile;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint action: replace_student_file
 * Same validation and versioning logic as upload, but triggers the student_file_replaced audit action.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Created file record metadata
 */
function replaceStudentFile(payload, actor) {
  assertCanWriteFile(actor);
  validateStudentFilePayload(payload);
  
  var studentId = payload.student_id;
  var fileType = payload.file_type;
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    var driveFileId = saveFileToDrive(
      studentId,
      fileType,
      payload.file_name,
      payload.mime_type,
      payload.base64_content
    );
    
    var version = 1;
    var existingActiveFiles = listRecords(SHEETS.STUDENT_FILES, function(f) {
      return f.student_id === studentId && f.file_type === fileType && f.status === 'active';
    });
    
    if (existingActiveFiles.length > 0) {
      var oldFile = existingActiveFiles[0];
      version = (Number(oldFile.version) || 0) + 1;
      
      updateRecord(SHEETS.STUDENT_FILES, oldFile.id, { status: 'replaced' }, actor);
    }
    
    var sizeInBytes = getBase64SizeInBytes(payload.base64_content);
    var record = {
      student_id: studentId,
      file_type: fileType,
      drive_file_id: driveFileId,
      original_filename: payload.file_name,
      mime_type: payload.mime_type,
      file_size: sizeInBytes,
      version: version,
      status: 'active',
      uploaded_by: actor.id,
      uploaded_at: nowIso()
    };
    
    var createdFile = createRecord(SHEETS.STUDENT_FILES, record, actor);
    
    // Log custom audit log action: student_file_replaced
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'student_file_replaced',
      entity_type: SHEETS.STUDENT_FILES,
      entity_id: createdFile.id,
      old_value: existingActiveFiles.length > 0 ? JSON.stringify(existingActiveFiles[0]) : '',
      new_value: JSON.stringify(createdFile),
      description: 'Replaced student file of type ' + fileType + ' for student ID: ' + studentId
    });
    
    return createdFile;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint action: list_student_files
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object[]} Screened and filtered file metadata
 */
function listStudentFiles(payload, actor) {
  var studentId = payload.student_id;
  
  // If studentId specified, validate it
  if (studentId) {
    var student = getRecordById(SHEETS.STUDENTS, studentId);
    if (!student) {
      throw {
        code: 'ERR_NOT_FOUND',
        message: 'Student not found.'
      };
    }
    
    // For Guru, must check class ownership
    if (actor.role === ROLES.TEACHER) {
      if (!isTeacherAssignedToStudent(actor.id, studentId)) {
        throw {
          code: 'ERR_FORBIDDEN',
          message: 'Forbidden: You are not assigned to this student\'s class.'
        };
      }
    }
  } else {
    // If list all and actor is a teacher, restrict it or handle filtering
    if (actor.role === ROLES.TEACHER) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: Teachers must specify student_id to list files.'
      };
    }
  }
  
  var allFiles = listRecords(SHEETS.STUDENT_FILES);
  if (studentId) {
    allFiles = allFiles.filter(function(f) {
      return f.student_id === studentId;
    });
  }
  
  return filterStudentFilesForRole(allFiles, actor);
}

/**
 * Endpoint action: get_student_file_access
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} File details including drive_file_id
 */
function getStudentFileAccess(payload, actor) {
  validateRequiredFields(payload, ['file_id']);
  
  var fileRecord = getRecordById(SHEETS.STUDENT_FILES, payload.file_id);
  if (!fileRecord) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Student file record not found.'
    };
  }
  
  // Enforce access control
  assertCanAccessStudentFile(actor, fileRecord.student_id, fileRecord.file_type);
  
  // If sensitive document, record it in audit logs
  var isSensitive = SENSITIVE_FILE_TYPES.indexOf(fileRecord.file_type) !== -1;
  if (isSensitive) {
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'view_sensitive_document',
      entity_type: SHEETS.STUDENT_FILES,
      entity_id: fileRecord.id,
      old_value: '',
      new_value: '',
      description: 'Viewed sensitive document of type ' + fileRecord.file_type + ' for student ID: ' + fileRecord.student_id
    });
  }
  
  var file;
  try { file = DriveApp.getFileById(fileRecord.drive_file_id); } catch (err) {
    throw { code: 'ERR_FILE_NOT_FOUND', message: 'Student file is no longer available.' };
  }
  
  var base64Content = Utilities.base64Encode(file.getBlob().getBytes());
  
  writeAuditLog({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'download_student_file',
    entity_type: SHEETS.STUDENT_FILES,
    entity_id: fileRecord.id,
    old_value: '',
    new_value: JSON.stringify({ file_id: fileRecord.id, student_id: fileRecord.student_id, file_type: fileRecord.file_type, file_name: fileRecord.original_filename }),
    description: 'Downloaded student file of type ' + fileRecord.file_type + ' for student ID: ' + fileRecord.student_id
  });
  
  return {
    file_id: fileRecord.id,
    file_name: fileRecord.original_filename,
    mime_type: fileRecord.mime_type,
    file_size: Number(fileRecord.file_size) || 0,
    base64_content: base64Content
  };
}

/**
 * Endpoint action: archive_student_file
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Archived file record
 */
function archiveStudentFile(payload, actor) {
  assertCanWriteFile(actor);
  validateRequiredFields(payload, ['file_id']);
  
  var fileRecord = getRecordById(SHEETS.STUDENT_FILES, payload.file_id);
  if (!fileRecord) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Student file record not found.'
    };
  }
  
  var updated = updateRecord(SHEETS.STUDENT_FILES, fileRecord.id, { status: 'archived' }, actor);
  
  // Log audit
  writeAuditLog({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'student_file_archived',
    entity_type: SHEETS.STUDENT_FILES,
    entity_id: fileRecord.id,
    old_value: JSON.stringify(fileRecord),
    new_value: JSON.stringify(updated),
    description: 'Archived student file of type ' + fileRecord.file_type + ' for student ID: ' + fileRecord.student_id
  });
  
  return updated;
}

/**
 * Endpoint action: setup_storage_folders
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Setup status details
 */
function setupStorageFolders(payload, actor) {
  assertCanWriteFile(actor);
  var rootId = getOrCreateStorageRoot();
  return {
    status: 'success',
    storage_root_id: rootId
  };
}
