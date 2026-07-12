/**
 * ReportingValidator.gs
 * Authorization and payload validation for Sprint 6 reporting endpoints.
 */

/**
 * Validates reporting access for a class.
 */
function assertReportingAccess(actor, classId, yearId, semesterId) {
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return true;
  }
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not authorized to access reporting data for class: ' + classId
      };
    }
    return true;
  }
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: Unauthorized access.'
  };
}

/**
 * Validates reporting access for a student.
 */
function assertStudentReportingAccess(actor, studentId, yearId, semesterId) {
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return true;
  }
  if (actor.role === ROLES.TEACHER) {
    var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
      return e.student_id === studentId &&
             e.academic_year_id === yearId &&
             e.semester_id === semesterId &&
             e.status === 'active';
    });
    if (enrollments.length === 0) {
      throw new Error("No active student enrollment found for the specified period.");
    }
    var classId = enrollments[0].class_id;
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not authorized to view this student\'s dashboard.'
      };
    }
    return true;
  }
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: Unauthorized access.'
  };
}

/**
 * Asserts the actor is an Administrator or Admin.
 */
function assertAdminOrAdministrator(actor) {
  if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Admin access required.'
    };
  }
}
