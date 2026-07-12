/**
 * RolloverService.gs
 * Implements business logic and engines for academic period rollover,
 * specifically copying class teacher assignments and class subjects.
 */

/**
 * Validates input parameters and existence of source and target periods.
 * @param {Object} payload
 * @returns {Object} Validated period objects and IDs
 */
function validateRolloverPeriods(payload) {
  var srcYearId = payload.source_academic_year_id;
  var srcSemId = payload.source_semester_id;
  var tgtYearId = payload.target_academic_year_id;
  var tgtSemId = payload.target_semester_id;
  
  if (!srcYearId || !srcSemId || !tgtYearId || !tgtSemId) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Source and target academic year and semester parameters are required.'
    };
  }
  
  if (srcYearId === tgtYearId && srcSemId === tgtSemId) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Source and target periods cannot be the same.'
    };
  }
  
  // Validate target period exists
  var targetYear = getRecordById(SHEETS.ACADEMIC_YEARS, tgtYearId);
  var targetSem = getRecordById(SHEETS.SEMESTERS, tgtSemId);
  if (!targetYear || !targetSem) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Target academic year or semester not found.'
    };
  }
  if (targetSem.academic_year_id !== targetYear.id) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Target semester does not belong to the target academic year.'
    };
  }
  
  return {
    source_year_id: srcYearId,
    source_semester_id: srcSemId,
    target_year: targetYear,
    target_semester: targetSem
  };
}

/**
 * Preview class teacher assignments rollover.
 * @param {Object} payload
 * @returns {Object} Preview counts, records, and warnings
 */
function previewAssignmentRollover(payload) {
  var validated = validateRolloverPeriods(payload);
  var srcYearId = validated.source_year_id;
  var srcSemId = validated.source_semester_id;
  var tgtYearId = validated.target_year.id;
  var tgtSemId = validated.target_semester.id;
  
  // Fetch active assignments in source period
  var sourceAssigns = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
    return a.academic_year_id === srcYearId &&
           a.semester_id === srcSemId &&
           a.status === STATUS.ACTIVE;
  });
  
  if (sourceAssigns.length === 0) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Source period has no active teacher assignments.'
    };
  }
  
  // Fetch active assignments in target period to detect conflicts
  var targetAssigns = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(ta) {
    return ta.academic_year_id === tgtYearId &&
           ta.semester_id === tgtSemId &&
           ta.status === STATUS.ACTIVE;
  });
  
  var targetAssignsMap = {};
  targetAssigns.forEach(function(ta) {
    targetAssignsMap[ta.class_id] = ta;
  });
  
  var assignments = [];
  var warnings = [];
  
  sourceAssigns.forEach(function(a) {
    var classRec = getRecordById(SHEETS.CLASSES, a.class_id);
    var className = classRec ? classRec.name : 'Unknown Class';
    
    var teacherProfile = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
      return p.user_id === a.teacher_user_id;
    });
    var teacherName = teacherProfile.length > 0 ? teacherProfile[0].full_name : 'Unknown Teacher';
    
    var status = 'ready';
    var conflict = targetAssignsMap[a.class_id];
    if (conflict) {
      if (conflict.teacher_user_id === a.teacher_user_id) {
        status = 'duplicate';
        warnings.push("Penugasan wali kelas " + teacherName + " untuk " + className + " sudah ada pada periode target (akan dilewati).");
      } else {
        status = 'conflict';
        var otherProfile = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
          return p.user_id === conflict.teacher_user_id;
        });
        var otherName = otherProfile.length > 0 ? otherProfile[0].full_name : 'Wali Kelas Lain';
        warnings.push("Konflik: Kelas " + className + " sudah memiliki wali kelas berbeda (" + otherName + ") pada periode target. Penugasan baru tidak akan menimpa (overwrite) wali kelas saat ini.");
      }
    }
    
    assignments.push({
      class_id: a.class_id,
      class_name: className,
      teacher_user_id: a.teacher_user_id,
      teacher_name: teacherName,
      status: status
    });
  });
  
  return {
    total_found: sourceAssigns.length,
    assignments: assignments,
    warnings: warnings
  };
}

/**
 * Execute class teacher assignments copy rollover.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Execution summary
 */
function executeAssignmentRollover(payload, actor) {
  assertAdminRole(actor);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw {
      code: 'ERR_LOCK_TIMEOUT',
      message: 'Database is busy. Please try again later.'
    };
  }
  
  try {
    var validated = validateRolloverPeriods(payload);
    var srcYearId = validated.source_year_id;
    var srcSemId = validated.source_semester_id;
    var tgtYearId = validated.target_year.id;
    var tgtSemId = validated.target_semester.id;
    var targetSemester = validated.target_semester;
    
    // Fetch active assignments in source period
    var sourceAssigns = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
      return a.academic_year_id === srcYearId &&
             a.semester_id === srcSemId &&
             a.status === STATUS.ACTIVE;
    });
    
    if (sourceAssigns.length === 0) {
      throw {
        code: 'ERR_NOT_FOUND',
        message: 'Source period has no active teacher assignments.'
      };
    }
    
    // Fetch active assignments in target period
    var targetAssigns = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(ta) {
      return ta.academic_year_id === tgtYearId &&
             ta.semester_id === tgtSemId &&
             ta.status === STATUS.ACTIVE;
    });
    
    var targetAssignsMap = {};
    targetAssigns.forEach(function(ta) {
      targetAssignsMap[ta.class_id] = ta;
    });
    
    var copied = 0;
    var skipped = 0;
    
    sourceAssigns.forEach(function(a) {
      var conflict = targetAssignsMap[a.class_id];
      if (conflict) {
        // Skip duplicate or conflict, do NOT overwrite.
        skipped++;
      } else {
        var newAssign = {
          class_id: a.class_id,
          teacher_user_id: a.teacher_user_id,
          academic_year_id: tgtYearId,
          semester_id: tgtSemId,
          effective_from: targetSemester.start_date || '',
          effective_until: targetSemester.end_date || '',
          status: STATUS.ACTIVE
        };
        createRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, newAssign, actor);
        copied++;
      }
    });
    
    // Write central audit log
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'ROLLOVER_COPY_ASSIGNMENTS',
      entity_type: 'rollover',
      entity_id: tgtSemId,
      old_value: '',
      new_value: JSON.stringify({
        source_academic_year_id: srcYearId,
        source_semester_id: srcSemId,
        target_academic_year_id: tgtYearId,
        target_semester_id: tgtSemId,
        copied: copied,
        skipped: skipped
      }),
      description: 'Rollover teacher assignments copied from ' + srcYearId + ' to ' + tgtYearId
    });
    
    return {
      copied: copied,
      skipped: skipped,
      errors: []
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Preview class subjects rollover.
 * @param {Object} payload
 * @returns {Object} Preview counts, records, and warnings
 */
function previewSubjectRollover(payload) {
  var validated = validateRolloverPeriods(payload);
  var srcYearId = validated.source_year_id;
  var srcSemId = validated.source_semester_id;
  var tgtYearId = validated.target_year.id;
  var tgtSemId = validated.target_semester.id;
  
  // Fetch active subject mappings in source period
  var sourceSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
    return cs.academic_year_id === srcYearId &&
           cs.semester_id === srcSemId &&
           cs.status === STATUS.ACTIVE;
  });
  
  if (sourceSubjects.length === 0) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Source period has no active class subjects.'
    };
  }
  
  // Fetch active subject mappings in target period to detect duplicates
  var targetSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(tcs) {
    return tcs.academic_year_id === tgtYearId &&
           tcs.semester_id === tgtSemId &&
           tcs.status === STATUS.ACTIVE;
  });
  
  var targetSubjectsMap = {};
  targetSubjects.forEach(function(tcs) {
    var key = tcs.class_id + '_' + tcs.subject_id;
    targetSubjectsMap[key] = true;
  });
  
  var subjects = [];
  var warnings = [];
  
  sourceSubjects.forEach(function(cs) {
    var classRec = getRecordById(SHEETS.CLASSES, cs.class_id);
    var className = classRec ? classRec.name : 'Unknown Class';
    
    var subjectRec = getRecordById(SHEETS.SUBJECTS, cs.subject_id);
    var subjectName = subjectRec ? subjectRec.name : 'Unknown Subject';
    
    var key = cs.class_id + '_' + cs.subject_id;
    var status = 'ready';
    if (targetSubjectsMap[key]) {
      status = 'duplicate';
      warnings.push("Mapping mata pelajaran " + subjectName + " untuk kelas " + className + " sudah ada pada periode target (akan dilewati).");
    }
    
    subjects.push({
      class_id: cs.class_id,
      class_name: className,
      subject_id: cs.subject_id,
      subject_name: subjectName,
      status: status
    });
  });
  
  return {
    total_found: sourceSubjects.length,
    subjects: subjects,
    warnings: warnings
  };
}

/**
 * Execute class subjects copy rollover.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Execution summary
 */
function executeSubjectRollover(payload, actor) {
  assertAdminRole(actor);
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw {
      code: 'ERR_LOCK_TIMEOUT',
      message: 'Database is busy. Please try again later.'
    };
  }
  
  try {
    var validated = validateRolloverPeriods(payload);
    var srcYearId = validated.source_year_id;
    var srcSemId = validated.source_semester_id;
    var tgtYearId = validated.target_year.id;
    var tgtSemId = validated.target_semester.id;
    
    // Fetch active subject mappings in source period
    var sourceSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
      return cs.academic_year_id === srcYearId &&
             cs.semester_id === srcSemId &&
             cs.status === STATUS.ACTIVE;
    });
    
    if (sourceSubjects.length === 0) {
      throw {
        code: 'ERR_NOT_FOUND',
        message: 'Source period has no active class subjects.'
      };
    }
    
    // Fetch active subject mappings in target period
    var targetSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(tcs) {
      return tcs.academic_year_id === tgtYearId &&
             tcs.semester_id === tgtSemId &&
             tcs.status === STATUS.ACTIVE;
    });
    
    var targetSubjectsMap = {};
    targetSubjects.forEach(function(tcs) {
      var key = tcs.class_id + '_' + tcs.subject_id;
      targetSubjectsMap[key] = true;
    });
    
    var copied = 0;
    var skipped = 0;
    
    sourceSubjects.forEach(function(cs) {
      var key = cs.class_id + '_' + cs.subject_id;
      if (targetSubjectsMap[key]) {
        skipped++;
      } else {
        var newCs = {
          class_id: cs.class_id,
          subject_id: cs.subject_id,
          academic_year_id: tgtYearId,
          semester_id: tgtSemId,
          status: STATUS.ACTIVE
        };
        createRecord(SHEETS.CLASS_SUBJECTS, newCs, actor);
        copied++;
      }
    });
    
    // Write central audit log
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'ROLLOVER_COPY_SUBJECTS',
      entity_type: 'rollover',
      entity_id: tgtSemId,
      old_value: '',
      new_value: JSON.stringify({
        source_academic_year_id: srcYearId,
        source_semester_id: srcSemId,
        target_academic_year_id: tgtYearId,
        target_semester_id: tgtSemId,
        copied: copied,
        skipped: skipped
      }),
      description: 'Rollover class subjects copied from ' + srcYearId + ' to ' + tgtYearId
    });
    
    return {
      copied: copied,
      skipped: skipped,
      errors: []
    };
  } finally {
    lock.releaseLock();
  }
}
