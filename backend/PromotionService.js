/**
 * PromotionService.gs
 * Implements business logic for annual Academic Year Rollover,
 * class promotion rules CRUD, and student promotion wizard preview.
 */

// --- CLASS PROMOTION RULES CRUD (ADMIN ONLY) ---

/**
 * Lists all active class promotion rules.
 * @returns {Object[]} Active promotion rules
 */
function listClassPromotionRules() {
  return listRecords(SHEETS.CLASS_PROMOTION_RULES, function(r) {
    return r.status === STATUS.ACTIVE;
  });
}

/**
 * Creates a new class promotion rule mapping.
 * @param {Object} payload - { source_class_id, target_class_id }
 * @param {Object} actor - The admin user
 * @returns {Object} Created rule
 */
function createClassPromotionRule(payload, actor) {
  validateRequiredFields(payload, ['source_class_id', 'target_class_id']);
  
  var srcId = payload.source_class_id;
  var tgtId = payload.target_class_id;
  
  if (srcId === tgtId) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Source class and target class must be different.'
    };
  }
  
  assertRecordExists(SHEETS.CLASSES, srcId);
  assertRecordExists(SHEETS.CLASSES, tgtId);
  
  // Verify target class is active
  var targetClass = getRecordById(SHEETS.CLASSES, tgtId);
  if (targetClass.status !== STATUS.ACTIVE) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Target class must be active.'
    };
  }
  
  // Enforce unique active rule per source class
  var existing = listRecords(SHEETS.CLASS_PROMOTION_RULES, function(r) {
    return r.source_class_id === srcId && r.status === STATUS.ACTIVE;
  });
  if (existing.length > 0) {
    throw {
      code: 'ERR_DUPLICATE_RULE',
      message: 'A promotion rule for this source class already exists.'
    };
  }
  
  var record = {
    source_class_id: srcId,
    target_class_id: tgtId,
    status: STATUS.ACTIVE
  };
  
  return createRecord(SHEETS.CLASS_PROMOTION_RULES, record, actor);
}

/**
 * Updates an existing class promotion rule.
 * @param {string} id - Rule ID
 * @param {Object} payload - { source_class_id, target_class_id }
 * @param {Object} actor - The admin user
 * @returns {Object} Updated rule
 */
function updateClassPromotionRule(id, payload, actor) {
  assertRecordExists(SHEETS.CLASS_PROMOTION_RULES, id);
  var existingRule = getRecordById(SHEETS.CLASS_PROMOTION_RULES, id);
  
  var srcId = payload.source_class_id !== undefined ? payload.source_class_id : existingRule.source_class_id;
  var tgtId = payload.target_class_id !== undefined ? payload.target_class_id : existingRule.target_class_id;
  
  if (!srcId || !tgtId) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Source class and target class are required.'
    };
  }
  
  if (srcId === tgtId) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Source class and target class must be different.'
    };
  }
  
  assertRecordExists(SHEETS.CLASSES, srcId);
  assertRecordExists(SHEETS.CLASSES, tgtId);
  
  var targetClass = getRecordById(SHEETS.CLASSES, tgtId);
  if (targetClass.status !== STATUS.ACTIVE) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Target class must be active.'
    };
  }
  
  // Enforce unique active rule per source class if source class is changing
  if (payload.source_class_id !== undefined && payload.source_class_id !== existingRule.source_class_id) {
    var existing = listRecords(SHEETS.CLASS_PROMOTION_RULES, function(r) {
      return r.source_class_id === srcId && r.status === STATUS.ACTIVE;
    });
    if (existing.length > 0) {
      throw {
        code: 'ERR_DUPLICATE_RULE',
        message: 'A promotion rule for this source class already exists.'
      };
    }
  }
  
  var patch = {};
  if (payload.source_class_id !== undefined) patch.source_class_id = payload.source_class_id;
  if (payload.target_class_id !== undefined) patch.target_class_id = payload.target_class_id;
  
  return updateRecord(SHEETS.CLASS_PROMOTION_RULES, id, patch, actor);
}

/**
 * Soft deletes/deactivates an existing class promotion rule.
 * @param {string} id - Rule ID
 * @param {Object} actor - The admin user
 * @returns {Object} Deactivated rule
 */
function deactivateClassPromotionRule(id, actor) {
  assertRecordExists(SHEETS.CLASS_PROMOTION_RULES, id);
  return updateRecord(SHEETS.CLASS_PROMOTION_RULES, id, { status: STATUS.INACTIVE }, actor);
}

// --- STUDENT PROMOTION PREVIEW ENGINE ---

/**
 * Previews class promotion recommendations for a cohort of students.
 * @param {Object} payload - { source_academic_year_id, source_semester_id, target_academic_year_id, target_semester_id, overrides }
 * @returns {Object} Promotion checklist, blockers, counts and execution status
 */
function previewStudentPromotion(payload) {
  validateRequiredFields(payload, ['source_academic_year_id', 'source_semester_id', 'target_academic_year_id', 'target_semester_id']);
  
  var srcYearId = payload.source_academic_year_id;
  var srcSemId = payload.source_semester_id;
  var tgtYearId = payload.target_academic_year_id;
  var tgtSemId = payload.target_semester_id;
  var overrides = payload.overrides || [];
  
  var srcYear = getRecordById(SHEETS.ACADEMIC_YEARS, srcYearId);
  var srcSem = getRecordById(SHEETS.SEMESTERS, srcSemId);
  var tgtYear = getRecordById(SHEETS.ACADEMIC_YEARS, tgtYearId);
  var tgtSem = getRecordById(SHEETS.SEMESTERS, tgtSemId);
  
  if (!srcYear || !srcSem || !tgtYear || !tgtSem) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Source or target academic year or semester not found.'
    };
  }
  
  if (srcSem.academic_year_id !== srcYearId || tgtSem.academic_year_id !== tgtYearId) {
    throw {
      code: 'ERR_INVALID_PARAMETER',
      message: 'Semester does not belong to the corresponding academic year.'
    };
  }
  
  var globalBlockers = [];
  var canExecute = true;
  
  // 1. Same Academic Year Rollover blocker
  if (srcYearId === tgtYearId) {
    globalBlockers.push({
      type: 'PERIOD_MISMATCH',
      message: 'Tahun ajaran sumber dan target tidak boleh sama (semester rollover bukan bagian dari kenaikan kelas).'
    });
    canExecute = false;
  }
  
  // 2. Start Date Order blocker
  var srcStartDate = srcYear.start_date ? new Date(srcYear.start_date).getTime() : 0;
  var tgtStartDate = tgtYear.start_date ? new Date(tgtYear.start_date).getTime() : 0;
  if (isNaN(srcStartDate) || isNaN(tgtStartDate) || tgtStartDate <= srcStartDate) {
    globalBlockers.push({
      type: 'PERIOD_MISMATCH',
      message: 'Tanggal mulai tahun ajaran target harus lebih besar dari tahun ajaran sumber.'
    });
    canExecute = false;
  }
  
  // 3. Consecutive Academic Years sequence verification
  var srcStart = srcYear.start_date ? new Date(srcYear.start_date).getTime() : 0;
  var tgtStart = tgtYear.start_date ? new Date(tgtYear.start_date).getTime() : 0;
  var allYears = listRecords(SHEETS.ACADEMIC_YEARS);
  var intermediateYears = allYears.filter(function(y) {
    if (y.id === srcYearId || y.id === tgtYearId) return false;
    var yStart = y.start_date ? new Date(y.start_date).getTime() : 0;
    return yStart > srcStart && yStart < tgtStart;
  });
  if (intermediateYears.length > 0) {
    globalBlockers.push({
      type: 'PERIOD_MISMATCH',
      message: 'Tahun ajaran target harus merupakan tahun ajaran berikutnya secara berurutan.'
    });
    canExecute = false;
  }
  
  // 4. Invalid final-to-first semester blocker
  var srcSemesters = listRecords(SHEETS.SEMESTERS, function(s) {
    return s.academic_year_id === srcYearId;
  });
  srcSemesters.sort(function(a, b) {
    var dA = a.start_date ? new Date(a.start_date).getTime() : 0;
    var dB = b.start_date ? new Date(b.start_date).getTime() : 0;
    return dA - dB;
  });
  var lastSrcSem = srcSemesters.length > 0 ? srcSemesters[srcSemesters.length - 1] : null;
  
  var tgtSemesters = listRecords(SHEETS.SEMESTERS, function(s) {
    return s.academic_year_id === tgtYearId;
  });
  tgtSemesters.sort(function(a, b) {
    var dA = a.start_date ? new Date(a.start_date).getTime() : 0;
    var dB = b.start_date ? new Date(b.start_date).getTime() : 0;
    return dA - dB;
  });
  var firstTgtSem = tgtSemesters.length > 0 ? tgtSemesters[0] : null;
  
  if (!lastSrcSem || !firstTgtSem || srcSemId !== lastSrcSem.id || tgtSemId !== firstTgtSem.id) {
    globalBlockers.push({
      type: 'PERIOD_MISMATCH',
      message: 'Semester sumber harus merupakan semester akhir (Genap) dan semester target harus merupakan semester awal (Ganjil).'
    });
    canExecute = false;
  }
  
  // Build lookup maps
  var activeRules = listRecords(SHEETS.CLASS_PROMOTION_RULES, function(r) {
    return r.status === STATUS.ACTIVE;
  });
  var rulesMap = {};
  activeRules.forEach(function(r) {
    rulesMap[r.source_class_id] = r;
  });
  
  var activeClasses = listRecords(SHEETS.CLASSES, function(c) {
    return c.status === STATUS.ACTIVE;
  });
  var classesMap = {};
  activeClasses.forEach(function(c) {
    classesMap[c.id] = c;
  });
  
  // Fetch active enrollments in the source period
  var sourceEnrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.academic_year_id === srcYearId &&
           e.semester_id === srcSemId &&
           e.status === 'active';
  });
  
  var studentList = [];
  var counts = {
    total: sourceEnrollments.length,
    promoted: 0,
    repeated: 0,
    graduated: 0,
    transferred: 0,
    inactive: 0,
    left: 0,
    unresolved: 0
  };
  
  // Map overrides for direct access
  var overridesMap = {};
  overrides.forEach(function(ov) {
    overridesMap[ov.student_id] = ov;
  });
  
  sourceEnrollments.forEach(function(e) {
    var student = getRecordById(SHEETS.STUDENTS, e.student_id);
    if (!student) return;
    
    var sourceClass = classesMap[e.class_id] || getRecordById(SHEETS.CLASSES, e.class_id);
    var sourceClassName = sourceClass ? sourceClass.name : 'Unknown Class';
    var sourceClassLevel = sourceClass ? sourceClass.level : '';
    
    var recAction = 'unresolved';
    var recTargetClassId = '';
    var recTargetClassName = '';
    var studentBlockers = [];
    
    var rule = rulesMap[e.class_id];
    if (rule) {
      var tgtClass = classesMap[rule.target_class_id] || getRecordById(SHEETS.CLASSES, rule.target_class_id);
      if (tgtClass) {
        if (tgtClass.status === STATUS.ACTIVE) {
          recAction = 'promoted';
          recTargetClassId = tgtClass.id;
          recTargetClassName = tgtClass.name;
        } else {
          studentBlockers.push("Kelas tujuan (" + tgtClass.name + ") berstatus tidak aktif.");
        }
      } else {
        studentBlockers.push("Kelas tujuan untuk aturan kenaikan kelas tidak ditemukan.");
      }
    } else {
      if (sourceClassLevel === '6' || parseInt(sourceClassLevel, 10) === 6) {
        recAction = 'graduated';
      } else {
        studentBlockers.push("Tidak ada aturan kenaikan kelas untuk kelas " + sourceClassName + ".");
      }
    }
    
    // Resolve overrides
    var resolvedAction = recAction;
    var resolvedTargetClassId = recTargetClassId;
    var resolvedTargetClassName = recTargetClassName;
    
    var override = overridesMap[student.id];
    if (override) {
      var ovAction = override.action;
      var ovTargetClassId = override.target_class_id;
      
      var validActions = ['promoted', 'repeated', 'graduated', 'transferred', 'inactive', 'left'];
      if (validActions.indexOf(ovAction) === -1) {
        studentBlockers = ["Pilihan aksi manual '" + ovAction + "' tidak valid."];
        resolvedAction = 'unresolved';
        resolvedTargetClassId = '';
        resolvedTargetClassName = '';
      } else {
        // Clear automatic rule blockers as admin took manual action
        studentBlockers = [];
        
        if (ovAction === 'promoted') {
          if (!ovTargetClassId) {
            studentBlockers.push("Kelas tujuan wajib ditentukan untuk siswa yang naik kelas.");
            resolvedAction = 'unresolved';
            resolvedTargetClassId = '';
            resolvedTargetClassName = '';
          } else {
            var tgtClass = classesMap[ovTargetClassId] || getRecordById(SHEETS.CLASSES, ovTargetClassId);
            if (!tgtClass) {
              studentBlockers.push("Kelas tujuan yang ditentukan tidak ditemukan.");
              resolvedAction = 'unresolved';
              resolvedTargetClassId = '';
              resolvedTargetClassName = '';
            } else if (tgtClass.status !== STATUS.ACTIVE) {
              studentBlockers.push("Kelas tujuan (" + tgtClass.name + ") berstatus tidak aktif.");
              resolvedAction = 'unresolved';
              resolvedTargetClassId = '';
              resolvedTargetClassName = '';
            } else {
              resolvedAction = 'promoted';
              resolvedTargetClassId = tgtClass.id;
              resolvedTargetClassName = tgtClass.name;
            }
          }
        } else if (ovAction === 'repeated') {
          // Tinggal kelas maps to the same class
          resolvedAction = 'repeated';
          resolvedTargetClassId = e.class_id;
          resolvedTargetClassName = sourceClassName;
          if (sourceClass && sourceClass.status !== STATUS.ACTIVE) {
            studentBlockers.push("Kelas asal (" + sourceClassName + ") berstatus tidak aktif.");
            resolvedAction = 'unresolved';
            resolvedTargetClassId = '';
            resolvedTargetClassName = '';
          }
        } else {
          // graduated, transferred, inactive, left
          resolvedAction = ovAction;
          resolvedTargetClassId = '';
          resolvedTargetClassName = '';
        }
      }
    }
    
    if (studentBlockers.length > 0 || resolvedAction === 'unresolved') {
      canExecute = false;
    }
    
    // Increment count
    if (counts[resolvedAction] !== undefined) {
      counts[resolvedAction]++;
    } else {
      counts.unresolved++;
    }
    
    studentList.push({
      student_id: student.id,
      student_name: student.full_name,
      nisn: student.nisn || '',
      source_class_id: e.class_id,
      source_class_name: sourceClassName,
      recommended_action: recAction,
      recommended_target_class_id: recTargetClassId,
      recommended_target_class_name: recTargetClassName,
      resolved_action: resolvedAction,
      resolved_target_class_id: resolvedTargetClassId,
      resolved_target_class_name: resolvedTargetClassName,
      blockers: studentBlockers
    });
  });
  
  // If period configuration blocks execution, enforce canExecute = false
  if (globalBlockers.length > 0) {
    canExecute = false;
  }
  
  return {
    can_execute: canExecute,
    source_academic_year_id: srcYearId,
    source_semester_id: srcSemId,
    target_academic_year_id: tgtYearId,
    target_semester_id: tgtSemId,
    students: studentList,
    global_blockers: globalBlockers,
    counts: counts
  };
}

// --- STUDENT PROMOTION EXECUTION ENGINE ---

/**
 * Executes an annual student promotion from a fresh backend preview.
 * The batch owns one script lock and writes one aggregate audit entry.
 * @param {Object} payload Promotion preview contract, including overrides
 * @param {Object} actor Authenticated administrator/admin
 * @returns {Object} Aggregate execution counts
 */
function executeStudentPromotion(payload, actor) {
  validateRequiredFields(payload, ['source_academic_year_id', 'source_semester_id', 'target_academic_year_id', 'target_semester_id']);

  if (payload.source_academic_year_id === payload.target_academic_year_id) {
    throw {
      code: 'ERR_INVALID_PERIOD_TYPE',
      message: 'Student promotion only supports academic year rollover.'
    };
  }

  // Never trust a previous/client preview. This also revalidates year ordering,
  // consecutiveness, semester ownership, and final-to-first semester pairing.
  var preview = previewStudentPromotion(payload);
  if (!preview.can_execute) {
    throw {
      code: 'ERR_PROMOTION_BLOCKED',
      message: 'Promotion execution is blocked: ' + JSON.stringify({
        global_blockers: preview.global_blockers,
        students: preview.students.filter(function(s) { return s.blockers && s.blockers.length > 0; })
      })
    };
  }

  var result = {
    processed: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    promoted: 0,
    repeated: 0,
    graduated: 0,
    transferred: 0,
    inactive: 0,
    left: 0
  };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockError) {
    throw { code: 'ERR_RESOURCE_BUSY', message: 'Promotion resource is busy. Please try again.' };
  }

  try {
    preview.students.forEach(function(item) {
      result.processed++;
      try {
        var action = item.resolved_action;
        var sourceEnrollment = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
          return e.student_id === item.student_id &&
            e.class_id === item.source_class_id &&
            e.academic_year_id === payload.source_academic_year_id &&
            e.semester_id === payload.source_semester_id &&
            e.status === 'active';
        })[0];

        // A repeated execution has no active source enrollment. It is safely skipped.
        if (!sourceEnrollment) {
          result.skipped++;
          return;
        }

        if (action === 'promoted' || action === 'repeated') {
          var duplicateTarget = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
            return e.student_id === item.student_id &&
              e.academic_year_id === payload.target_academic_year_id &&
              e.semester_id === payload.target_semester_id &&
              e.status === 'active';
          })[0];
          if (duplicateTarget) {
            result.skipped++;
            return;
          }

          updateRowById(SHEETS.STUDENT_ENROLLMENTS, sourceEnrollment.id, { status: action });
          appendRow(SHEETS.STUDENT_ENROLLMENTS, {
            student_id: item.student_id,
            class_id: item.resolved_target_class_id,
            academic_year_id: payload.target_academic_year_id,
            semester_id: payload.target_semester_id,
            status: 'active'
          });
          updateRowById(SHEETS.STUDENTS, item.student_id, { status: 'Aktif' });
        } else {
          var enrollmentStatus = action === 'left' ? 'inactive' : action;
          var studentStatusMap = {
            graduated: 'Lulus',
            transferred: 'Pindah',
            inactive: 'Tidak aktif',
            left: 'Keluar'
          };
          updateRowById(SHEETS.STUDENT_ENROLLMENTS, sourceEnrollment.id, { status: enrollmentStatus });
          updateRowById(SHEETS.STUDENTS, item.student_id, { status: studentStatusMap[action] });
        }

        result[action]++;
        result.completed++;
      } catch (studentError) {
        result.failed++;
        console.error('Promotion failed for student ' + item.student_id + ': ' + studentError);
      }
    });
  } finally {
    lock.releaseLock();
  }

  // One batch audit only; record-level repository audit helpers are intentionally
  // not used by the locked batch mutations above.
  writeAuditLog({
    user_id: actor ? actor.id : 'system',
    user_name: actor ? actor.name : 'System',
    user_role: actor ? actor.role : 'system',
    action: 'PROMOTION_EXECUTION',
    entity_type: 'student_enrollments',
    entity_id: '',
    old_value: '',
    new_value: JSON.stringify({
      source_academic_year_id: payload.source_academic_year_id,
      source_semester_id: payload.source_semester_id,
      target_academic_year_id: payload.target_academic_year_id,
      target_semester_id: payload.target_semester_id,
      counts: result
    }),
    description: 'Executed annual student promotion batch.'
  });

  return result;
}
