/**
 * CultureService.gs
 * Business logic and database operations for daily culture scores (SAHABAT).
 */

/**
 * Saves (inserts/updates) culture scores for a list of students on a given date.
 */
function saveCultureScores(payload, actor) {
  validateSaveCultureScores(payload, actor);
  
  var scoreDate = payload.score_date;
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  assertSemesterNotFinalized(yearId, semesterId);
  
  var results = [];
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy. Please try again later.");
  }
  
  try {
    payload.scores.forEach(function(scoreItem) {
      // Find existing culture score for student on this date
      var existingRecords = findRows(SHEETS.CULTURE_SCORES, function(r) {
        return r.student_id === scoreItem.student_id &&
               normalizeDateString(r.score_date) === normalizeDateString(scoreDate) &&
               r.status === 'active';
      });
      
      var sssVal = (scoreItem.sss === undefined || scoreItem.sss === null || scoreItem.sss === '') ? null : Number(scoreItem.sss);
      var amVal = (scoreItem.am === undefined || scoreItem.am === null || scoreItem.am === '') ? null : Number(scoreItem.am);
      var hbVal = (scoreItem.hb === undefined || scoreItem.hb === null || scoreItem.hb === '') ? null : Number(scoreItem.hb);
      var asmVal = (scoreItem.asm === undefined || scoreItem.asm === null || scoreItem.asm === '') ? null : Number(scoreItem.asm);
      var brVal = (scoreItem.br === undefined || scoreItem.br === null || scoreItem.br === '') ? null : Number(scoreItem.br);
      var akVal = (scoreItem.ak === undefined || scoreItem.ak === null || scoreItem.ak === '') ? null : Number(scoreItem.ak);
      var tmVal = (scoreItem.tm === undefined || scoreItem.tm === null || scoreItem.tm === '') ? null : Number(scoreItem.tm);
      
      var patch = {
        sss_score: sssVal,
        am_score: amVal,
        hb_score: hbVal,
        asm_score: asmVal,
        br_score: brVal,
        ak_score: akVal,
        tm_score: tmVal
      };
      
      if (existingRecords.length > 0) {
        var existing = existingRecords[0];
        
        // Check if anything has actually changed to prevent duplicate logs
        if (existing.sss_score !== sssVal ||
            existing.am_score !== amVal ||
            existing.hb_score !== hbVal ||
            existing.asm_score !== asmVal ||
            existing.br_score !== brVal ||
            existing.ak_score !== akVal ||
            existing.tm_score !== tmVal) {
          
          var updated = updateRowById(SHEETS.CULTURE_SCORES, existing.id, patch);
          
          // Trigger incremental summary update
          updateIncrementalSummary(
            scoreItem.student_id,
            scoreItem.student_enrollment_id,
            classId,
            yearId,
            semesterId,
            scoreDate,
            existing,
            updated
          );
          
          // Audit Log
          writeAuditLog({
            user_id: actor.id,
            user_name: actor.name,
            user_role: actor.role,
            action: 'update_culture_score',
            entity_type: SHEETS.CULTURE_SCORES,
            entity_id: existing.id,
            old_value: JSON.stringify(existing),
            new_value: JSON.stringify(updated),
            description: 'Updated daily culture score'
          });
          
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        // Create new active record
        var newRecord = {
          student_id: scoreItem.student_id,
          student_enrollment_id: scoreItem.student_enrollment_id,
          class_id: classId,
          teacher_user_id: actor.id,
          academic_year_id: yearId,
          semester_id: semesterId,
          score_date: normalizeDateString(scoreDate),
          sss_score: sssVal,
          am_score: amVal,
          hb_score: hbVal,
          asm_score: asmVal,
          br_score: brVal,
          ak_score: akVal,
          tm_score: tmVal,
          status: 'active'
        };
        
        var created = appendRow(SHEETS.CULTURE_SCORES, newRecord);
        
        // Trigger incremental summary update (oldRow is null)
        updateIncrementalSummary(
          scoreItem.student_id,
          scoreItem.student_enrollment_id,
          classId,
          yearId,
          semesterId,
          scoreDate,
          null,
          created
        );
        
        // Audit Log
        writeAuditLog({
          user_id: actor.id,
          user_name: actor.name,
          user_role: actor.role,
          action: 'input_culture_score',
          entity_type: SHEETS.CULTURE_SCORES,
          entity_id: created.id,
          old_value: '',
          new_value: JSON.stringify(created),
          description: 'Inputted daily culture score'
        });
        
        results.push(created);
      }
    });
  } finally {
    lock.releaseLock();
  }
  
  return results;
}

/**
 * Updates a single culture score row.
 */
function updateCultureScore(id, payload, actor) {
  var existing = assertRecordExists(SHEETS.CULTURE_SCORES, id);
  
  assertSemesterNotFinalized(existing.academic_year_id, existing.semester_id);
  
  assertCultureWritePermission(actor, existing.class_id, existing.academic_year_id, existing.semester_id);
  
  var targetDate = payload.score_date ? normalizeDateString(payload.score_date) : normalizeDateString(existing.score_date);
  assertCultureEditAllowed(actor.role, targetDate);
  
  validateCultureScoreValue(payload.sss, 'sss');
  validateCultureScoreValue(payload.am, 'am');
  validateCultureScoreValue(payload.hb, 'hb');
  validateCultureScoreValue(payload.asm, 'asm');
  validateCultureScoreValue(payload.br, 'br');
  validateCultureScoreValue(payload.ak, 'ak');
  validateCultureScoreValue(payload.tm, 'tm');
  
  var patch = {};
  if (payload.score_date !== undefined) {
    patch.score_date = normalizeDateString(payload.score_date);
  }
  var indicators = ['sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
  indicators.forEach(function(ind) {
    if (payload[ind] !== undefined) {
      patch[ind + '_score'] = (payload[ind] === null || payload[ind] === '') ? null : Number(payload[ind]);
    }
  });
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy. Please try again later.");
  }
  
  try {
    var updated = updateRowById(SHEETS.CULTURE_SCORES, id, patch);
    
    // Trigger incremental summary update
    updateIncrementalSummary(
      existing.student_id,
      existing.student_enrollment_id,
      existing.class_id,
      existing.academic_year_id,
      existing.semester_id,
      existing.score_date,
      existing,
      updated
    );
    
    // Audit Log
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'update_culture_score',
      entity_type: SHEETS.CULTURE_SCORES,
      entity_id: id,
      old_value: JSON.stringify(existing),
      new_value: JSON.stringify(updated),
      description: 'Updated daily culture score'
    });
    
    return updated;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lists culture scores of a class on a specific date.
 */
function listCultureScoresByDate(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'score_date', 'academic_year_id', 'semester_id']);
  
  // Authorization check
  assertCultureReadPermission(actor, payload.class_id, payload.academic_year_id, payload.semester_id);
  
  var normDate = normalizeDateString(payload.score_date);
  return findRows(SHEETS.CULTURE_SCORES, function(r) {
    return r.class_id === payload.class_id &&
           normalizeDateString(r.score_date) === normDate &&
           r.status === 'active';
  });
}

/**
 * Gets student culture scores within a semester.
 */
function getStudentCultureScores(payload, actor) {
  validateRequiredFields(payload, ['student_id', 'academic_year_id', 'semester_id']);
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === payload.student_id &&
           e.academic_year_id === payload.academic_year_id &&
           e.semester_id === payload.semester_id &&
           e.status === 'active';
  });
  if (enrollments.length === 0) {
    throw new Error("No active student enrollment found for the period.");
  }
  var enrollment = enrollments[0];
  
  assertCultureReadPermission(actor, enrollment.class_id, payload.academic_year_id, payload.semester_id);
  
  return findRows(SHEETS.CULTURE_SCORES, function(r) {
    return r.student_id === payload.student_id &&
           r.academic_year_id === payload.academic_year_id &&
           r.semester_id === payload.semester_id &&
           r.status === 'active';
  });
}
