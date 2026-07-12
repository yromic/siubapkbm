/**
 * DashboardCalculator.gs
 * Internal helper functions for calculating academic and culture completeness rates.
 */

/**
 * Calculates academic completeness for a class in a given period.
 * @param {string} classId
 * @param {string} yearId
 * @param {string} semesterId
 * @returns {Object} { completed_students, pending_students, completion_rate }
 */
function assertCompletenessAccess(actor, classId, yearId, semesterId) {
  validateRequiredFields({
    class_id: classId,
    academic_year_id: yearId,
    semester_id: semesterId
  }, ['class_id', 'academic_year_id', 'semester_id']);
  
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return;
  }
  
  if (actor.role === ROLES.TEACHER && isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
    return;
  }
  
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: You are not authorized to calculate completeness for this class.'
  };
}

function calculateAcademicCompleteness(classId, yearId, semesterId) {
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var total = enrollments.length;
  if (total === 0) {
    return {
      completed_students: 0,
      pending_students: 0,
      completion_rate: 0
    };
  }
  
  var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.class_id === classId &&
           a.academic_year_id === yearId &&
           a.semester_id === semesterId;
  });
  
  var assessmentIds = assessments.map(function(a) { return a.id; });
  
  var scores = [];
  if (assessmentIds.length > 0) {
    scores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
      return s.status === STATUS.ACTIVE &&
             s.score !== null &&
             s.score !== '' &&
             assessmentIds.indexOf(s.assessment_id) !== -1;
    });
  }
  
  var studentHasScore = {};
  scores.forEach(function(s) {
    studentHasScore[s.student_id] = true;
  });
  
  var completed = 0;
  enrollments.forEach(function(e) {
    if (studentHasScore[e.student_id]) {
      completed++;
    }
  });
  
  var pending = total - completed;
  var rate = (completed / total) * 100;
  
  return {
    completed_students: completed,
    pending_students: pending,
    completion_rate: Number(rate.toFixed(2))
  };
}

function calculate_academic_completeness(classId, yearId, semesterId) {
  return calculateAcademicCompleteness(classId, yearId, semesterId);
}

/**
 * Calculates culture completeness for a class in a given period.
 * @param {string} classId
 * @param {string} yearId
 * @param {string} semesterId
 * @returns {Object} { completed_students, pending_students, completion_rate }
 */
function calculateCultureCompleteness(classId, yearId, semesterId) {
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var total = enrollments.length;
  if (total === 0) {
    return {
      completed_students: 0,
      pending_students: 0,
      completion_rate: 0
    };
  }
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  
  var summaries = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.academic_year_id === yearId &&
           r.semester_id === semesterId &&
           studentIds.indexOf(r.student_id) !== -1;
  });
  
  var studentHasCulture = {};
  summaries.forEach(function(s) {
    if (s.days_counted !== null && Number(s.days_counted) > 0) {
      studentHasCulture[s.student_id] = true;
    }
  });
  
  var completed = 0;
  enrollments.forEach(function(e) {
    if (studentHasCulture[e.student_id]) {
      completed++;
    }
  });
  
  var pending = total - completed;
  var rate = (completed / total) * 100;
  
  return {
    completed_students: completed,
    pending_students: pending,
    completion_rate: Number(rate.toFixed(2))
  };
}

function calculate_culture_completeness(classId, yearId, semesterId) {
  return calculateCultureCompleteness(classId, yearId, semesterId);
}
