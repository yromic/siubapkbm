/**
 * ReportSnapshotService.gs
 * Handles creation, storage, retrieval, and logging of immutable report snapshots.
 */

/**
 * Endpoint: create_student_report_snapshot
 */
function createStudentReportSnapshot(payload, actor) {
  assertAdminRole(actor);
  validateRequiredFields(payload, ['student_id', 'academic_year_id', 'semester_id']);
  
  var studentId = payload.student_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // 1. Generate full student report
  var reportData = exportStudentFullReport({
    student_id: studentId,
    academic_year_id: yearId,
    semester_id: semesterId
  }, actor);
  
  // Get student enrollment to resolve class
  var enroll = getStudentActiveEnrollment(studentId) || listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId && e.academic_year_id === yearId && e.semester_id === semesterId;
  })[0];
  var classId = enroll ? enroll.class_id : '';
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    // 2. Save snapshot payload
    var snapshot = createRecord(SHEETS.REPORT_SNAPSHOTS, {
      snapshot_type: 'student_full',
      student_id: studentId,
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semesterId,
      snapshot_payload: JSON.stringify(reportData),
      created_by: actor.id
    }, actor);
    
    // 3. Archive inside report_exports
    var archiveLog = createRecord(SHEETS.REPORT_EXPORTS, {
      report_type: 'student_full',
      snapshot_id: snapshot.id,
      student_id: studentId,
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semesterId,
      generated_by: actor.id,
      generated_at: nowIso(),
      status: 'archived'
    }, actor);
    
    // 4. Custom Audit Logging
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'create_report_snapshot',
      entity_type: SHEETS.REPORT_SNAPSHOTS,
      entity_id: snapshot.id,
      old_value: '',
      new_value: JSON.stringify(snapshot),
      description: 'Created student report snapshot for student ID: ' + studentId
    });
    
    return {
      snapshot_id: snapshot.id,
      export_id: archiveLog.id,
      student_id: studentId,
      status: 'success'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint: create_class_report_snapshot
 */
function createClassReportSnapshot(payload, actor) {
  assertAdminRole(actor);
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // 1. Generate full class report
  var reportData = exportClassFullReport({
    class_id: classId,
    academic_year_id: yearId,
    semester_id: semesterId
  }, actor);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    // 2. Save snapshot payload
    var snapshot = createRecord(SHEETS.REPORT_SNAPSHOTS, {
      snapshot_type: 'class_full',
      student_id: '',
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semesterId,
      snapshot_payload: JSON.stringify(reportData),
      created_by: actor.id
    }, actor);
    
    // 3. Archive inside report_exports
    var archiveLog = createRecord(SHEETS.REPORT_EXPORTS, {
      report_type: 'class_full',
      snapshot_id: snapshot.id,
      student_id: '',
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semesterId,
      generated_by: actor.id,
      generated_at: nowIso(),
      status: 'archived'
    }, actor);
    
    // 4. Custom Audit Logging
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'create_report_snapshot',
      entity_type: SHEETS.REPORT_SNAPSHOTS,
      entity_id: snapshot.id,
      old_value: '',
      new_value: JSON.stringify(snapshot),
      description: 'Created class report snapshot for class ID: ' + classId
    });
    
    return {
      snapshot_id: snapshot.id,
      export_id: archiveLog.id,
      class_id: classId,
      status: 'success'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint: get_report_snapshot
 */
function getReportSnapshot(payload, actor) {
  validateRequiredFields(payload, ['snapshot_id']);
  
  var snapshot = getRecordById(SHEETS.REPORT_SNAPSHOTS, payload.snapshot_id);
  if (!snapshot) {
    throw { code: 'ERR_NOT_FOUND', message: 'Report snapshot not found.' };
  }
  
  // Check authorization
  if (actor.role === ROLES.TEACHER) {
    if (snapshot.student_id) {
      if (!isTeacherAssignedToStudent(actor.id, snapshot.student_id)) {
        throw { code: 'ERR_FORBIDDEN', message: 'Forbidden: Unauthorized access.' };
      }
    } else if (snapshot.class_id) {
      var isAssigned = isTeacherAssignedToClass(actor.id, snapshot.class_id, snapshot.academic_year_id, snapshot.semester_id);
      if (!isAssigned) {
        throw { code: 'ERR_FORBIDDEN', message: 'Forbidden: Unauthorized access.' };
      }
    }
  }
  
  // Parse and append output payload object
  var payloadObj = null;
  if (snapshot.snapshot_payload) {
    try {
      payloadObj = JSON.parse(snapshot.snapshot_payload);
    } catch (err) {
      console.error("Failed parsing snapshot payload JSON.");
    }
  }
  
  return {
    id: snapshot.id,
    snapshot_type: snapshot.snapshot_type,
    student_id: snapshot.student_id,
    class_id: snapshot.class_id,
    academic_year_id: snapshot.academic_year_id,
    semester_id: snapshot.semester_id,
    created_by: snapshot.created_by,
    created_at: snapshot.created_at,
    snapshot_payload: payloadObj
  };
}

/**
 * Endpoint: list_report_exports
 */
function listReportExports(payload, actor) {
  var allLogs = listRecords(SHEETS.REPORT_EXPORTS);
  
  if (actor.role === ROLES.TEACHER) {
    // Teachers can only see exports matching their classes
    var teacherClasses = getTeacherActiveClasses(actor.id);
    allLogs = allLogs.filter(function(log) {
      return teacherClasses.indexOf(log.class_id) !== -1;
    });
  } else if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN) {
    throw { code: 'ERR_FORBIDDEN', message: 'Forbidden: Access denied.' };
  }
  
  return allLogs;
}
