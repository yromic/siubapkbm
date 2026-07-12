/**
 * SemesterLockService.gs
 * Implements report finalization locking and status verification helpers.
 */

/**
 * Endpoint: finalize_semester_reports
 */
function finalizeSemesterReports(payload, actor) {
  assertAdminRole(actor);
  validateRequiredFields(payload, ['academic_year_id', 'semester_id']);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // Verify period exists
  assertRecordExists(SHEETS.ACADEMIC_YEARS, yearId);
  assertRecordExists(SHEETS.SEMESTERS, semesterId);
  
  var key = getSemesterFinalizationKey(yearId, semesterId);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    updateSingleSetting(key, "true", actor);
    
    // Log Audit Action
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'finalize_semester_reports',
      entity_type: SHEETS.APP_SETTINGS,
      entity_id: key,
      old_value: 'false',
      new_value: 'true',
      description: 'Finalized semester reports for academic year ID: ' + yearId + ' and semester ID: ' + semesterId
    });
    
    return {
      academic_year_id: yearId,
      semester_id: semesterId,
      finalized: true
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint: get_semester_finalization_status
 */
function getSemesterFinalizationStatus(payload, actor) {
  validateRequiredFields(payload, ['academic_year_id', 'semester_id']);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var finalized = isSemesterFinalized(yearId, semesterId);
  
  return {
    academic_year_id: yearId,
    semester_id: semesterId,
    finalized: finalized
  };
}

/**
 * Helper to check if a semester is finalized.
 * @param {string} academicYearId
 * @param {string} semesterId
 * @returns {boolean}
 */
function isSemesterFinalized(academicYearId, semesterId) {
  if (!academicYearId || !semesterId) return false;
  var key = getSemesterFinalizationKey(academicYearId, semesterId);
  var rows = listRecords(SHEETS.APP_SETTINGS, function(setting) {
    return setting.setting_key === key;
  });
  
  return rows.some(function(setting) {
    return String(setting.setting_value).toLowerCase() === 'true';
  });
}

function getSemesterFinalizationKey(academicYearId, semesterId) {
  return "semester_finalized_" + academicYearId + "_" + semesterId;
}

function assertSemesterNotFinalized(academicYearId, semesterId) {
  if (isSemesterFinalized(academicYearId, semesterId)) {
    throw {
      code: 'ERR_SEMESTER_FINALIZED',
      message: 'Semester has been finalized and can no longer be modified.'
    };
  }
}
