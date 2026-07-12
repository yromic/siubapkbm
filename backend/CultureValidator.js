/**
 * CultureValidator.gs
 * Validates daily culture scores and lock period edit windows.
 */

/**
 * Checks if the actor's role is allowed to edit culture scores for a specific date.
 * Guru: 7 days window (diffDays <= 7)
 * Admin: 30 days window (diffDays <= 30)
 * Administrator: Unlimited
 * @param {string} actorRole
 * @param {string} scoreDateStr - Date string (YYYY-MM-DD).
 * @returns {boolean}
 */
function assertCultureEditAllowed(actorRole, scoreDate) {
  if (!actorRole) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Unauthorized: Actor role is missing.'
    };
  }
  
  var normRole = String(actorRole).toLowerCase().trim();
  if (normRole === 'administrator') {
    return;
  }
  
  var normDateStr = normalizeDateString(scoreDate);
  if (!normDateStr || isNaN(Date.parse(normDateStr))) {
    throw {
      code: 'ERR_VALIDATION',
      message: 'Invalid score date format.'
    };
  }
  
  var parts = normDateStr.split('-');
  var targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  
  var diffTime = now.getTime() - targetDate.getTime();
  var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (normRole === 'guru' || normRole === 'teacher') {
    if (diffDays > 7) {
      throw {
        code: 'ERR_PERIOD_LOCKED',
        message: 'Error: The period for editing culture scores on this date is locked.'
      };
    }
  } else if (normRole === 'admin') {
    if (diffDays > 30) {
      throw {
        code: 'ERR_PERIOD_LOCKED',
        message: 'Error: The period for editing culture scores on this date is locked.'
      };
    }
  } else {
    throw {
      code: 'ERR_PERIOD_LOCKED',
      message: 'Error: Unknown role or locked period.'
    };
  }
}

function canEditCultureDate(actorRole, scoreDateStr) {
  try {
    assertCultureEditAllowed(actorRole, scoreDateStr);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Asserts that the actor is authorized to write culture scores for a class.
 * Guru: can only write for assigned classes.
 * Admin/Administrator: can write for any class.
 */
function assertCultureWritePermission(actor, classId, yearId, semesterId) {
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return;
  }
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned as the class teacher for this class.'
      };
    }
    return;
  }
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: Unauthorized access.'
  };
}

/**
 * Validates a single culture score entry.
 * Indicators must be null, empty, or 1-4.
 */
function validateCultureScoreValue(val, indicatorName) {
  if (val === undefined || val === null || val === '') {
    return; // Allow empty
  }
  var num = Number(val);
  if (isNaN(num) || num < 1 || num > 4 || Math.floor(num) !== num) {
    throw {
      code: 'ERR_VALIDATION',
      message: 'Invalid score for ' + indicatorName + ': must be an integer between 1 and 4, or empty.'
    };
  }
}

/**
 * Validates save_culture_scores payload.
 */
function validateSaveCultureScores(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id', 'score_date', 'scores']);
  
  // 1. score_date wajib valid
  var normDate = normalizeDateString(payload.score_date);
  if (!normDate || isNaN(Date.parse(normDate))) {
    throw {
      code: 'ERR_VALIDATION',
      message: 'Invalid score_date format.'
    };
  }
  payload.score_date = normDate;
  
  // Lock Period check
  assertCultureEditAllowed(actor.role, payload.score_date);
  
  // Authorization check
  assertCultureWritePermission(actor, payload.class_id, payload.academic_year_id, payload.semester_id);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  var classId = payload.class_id;
  
  payload.scores.forEach(function(scoreItem) {
    validateRequiredFields(scoreItem, ['student_id', 'student_enrollment_id']);
    
    // 2. student must exist
    assertRecordExists(SHEETS.STUDENTS, scoreItem.student_id);
    
    // 3. enrollment must exist
    var enrollment = assertRecordExists(SHEETS.STUDENT_ENROLLMENTS, scoreItem.student_enrollment_id);
    
    // 4. enrollment must match student
    if (enrollment.student_id !== scoreItem.student_id) {
      throw {
        code: 'ERR_VALIDATION',
        message: 'Enrollment does not match the student.'
      };
    }
    
    // 5. enrollment must match class, academic year, semester
    if (enrollment.class_id !== classId ||
        enrollment.academic_year_id !== yearId ||
        enrollment.semester_id !== semesterId) {
      throw {
        code: 'ERR_VALIDATION',
        message: 'Enrollment does not match the class or academic period.'
      };
    }
    
    // 7. Indicators must be 1-4 or null/empty
    validateCultureScoreValue(scoreItem.sss, 'sss');
    validateCultureScoreValue(scoreItem.am, 'am');
    validateCultureScoreValue(scoreItem.hb, 'hb');
    validateCultureScoreValue(scoreItem.asm, 'asm');
    validateCultureScoreValue(scoreItem.br, 'br');
    validateCultureScoreValue(scoreItem.ak, 'ak');
    validateCultureScoreValue(scoreItem.tm, 'tm');
  });
}
