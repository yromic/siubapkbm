/**
 * StudentService.gs
 * Logic and service definitions for Student Profiles and Enrollment management.
 */

// --- STUDENT OPERATIONS ---

function createStudent(payload, actor) {
  assertAdminOrAdministrator(actor);
  validateStudent(payload, false);
  
  var record = {
    nisn: String(payload.nisn).trim(),
    nik: payload.nik ? String(payload.nik).trim() : '',
    full_name: payload.full_name,
    birth_place: payload.birth_place || '',
    birth_date: payload.birth_date,
    gender: payload.gender,
    religion: payload.religion || '',
    phone: payload.phone || '',
    affirmation: payload.affirmation || '',
    special_needs: payload.special_needs || '',
    family_card_number: payload.family_card_number ? String(payload.family_card_number).trim() : '',
    family_card_date: payload.family_card_date || '',
    mother_name: payload.mother_name || '',
    mother_nik: payload.mother_nik ? String(payload.mother_nik).trim() : '',
    father_name: payload.father_name || '',
    father_nik: payload.father_nik ? String(payload.father_nik).trim() : '',
    guardian_name: payload.guardian_name || '',
    guardian_nik: payload.guardian_nik ? String(payload.guardian_nik).trim() : '',
    address_street: payload.address_street || '',
    rt: payload.rt || '',
    rw: payload.rw || '',
    hamlet: payload.hamlet || '',
    village: payload.village || '',
    district: payload.district || '',
    city: payload.city || '',
    province: payload.province || '',
    spp_amount: payload.spp_amount !== undefined && payload.spp_amount !== null && payload.spp_amount !== '' ? parseFloat(payload.spp_amount) : '',
    parent_access_pin_hash: payload.parent_access_pin ? hashParentPin(payload.parent_access_pin) : '',
    parent_access_pin_failed_attempts: 0,
    parent_access_pin_locked_until: '',
    status: payload.status
  };
  
  var created = createRecord(SHEETS.STUDENTS, record, actor);
  return sanitizeStudentForRole(created, actor.role);
}

function updateStudent(id, payload, actor) {
  assertAdminOrAdministrator(actor);
  assertRecordExists(SHEETS.STUDENTS, id);
  validateStudent(payload, true, id);
  
  var patch = {};
  var fields = [
    'nisn', 'nik', 'full_name', 'birth_place', 'birth_date', 'gender', 'religion', 
    'phone', 'affirmation', 'special_needs', 'family_card_number', 'family_card_date', 
    'mother_name', 'mother_nik', 'father_name', 'father_nik', 'guardian_name', 
    'guardian_nik', 'address_street', 'rt', 'rw', 'hamlet', 'village', 'district', 
    'city', 'province', 'spp_amount', 'status'
  ];
  
  fields.forEach(function(field) {
    if (payload[field] !== undefined) {
      patch[field] = payload[field];
    }
  });
  
  var updated = updateRecord(SHEETS.STUDENTS, id, patch, actor);
  return sanitizeStudentForRole(updated, actor.role);
}

function listStudents(actor, filters) {
  assertAdminOrAdministrator(actor);
  var students = listRecords(SHEETS.STUDENTS);
  var filtered = filterLifecycle(students, filters);
  return sanitizeStudentListForRole(filtered, actor.role);
}

function getStudentDetail(id, actor) {
  var student = assertRecordExists(SHEETS.STUDENTS, id);
  
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToStudent(actor.id, id)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You do not have permissions to view this student detail.'
      };
    }
  }
  
  return sanitizeStudentForRole(student, actor.role);
}

function changeStudentStatus(id, newStatus, actor) {
  assertAdminOrAdministrator(actor);
  assertRecordExists(SHEETS.STUDENTS, id);
  
  var validStatuses = ['Aktif', 'Lulus', 'Pindah', 'Keluar', 'Tidak aktif', 'Meninggal'];
  if (validStatuses.indexOf(newStatus) === -1) {
    throw new Error("Invalid status: must be one of " + validStatuses.join(', '));
  }
  
  var updated = updateRecord(SHEETS.STUDENTS, id, { status: newStatus }, actor);
  return sanitizeStudentForRole(updated, actor.role);
}

function resetStudentParentPin(studentId, newPin, actor) {
  assertAdminOrAdministrator(actor);
  assertRecordExists(SHEETS.STUDENTS, studentId);
  
  var hashed = hashParentPin(newPin);
  
  // Custom update to override password hash safely
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    var oldRecord = findRowById(SHEETS.STUDENTS, studentId);
    var updated = updateRowById(SHEETS.STUDENTS, studentId, {
      parent_access_pin_hash: hashed,
      parent_access_pin_failed_attempts: 0,
      parent_access_pin_locked_until: ''
    });
    
    // Log audit manually to avoid printing plain password details
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'update',
      entity_type: SHEETS.STUDENTS,
      entity_id: studentId,
      old_value: '{"parent_access_pin_hash": "' + oldRecord.parent_access_pin_hash + '"}',
      new_value: '{"parent_access_pin_hash": "' + hashed + '"}',
      description: 'Parent PIN reset'
    });
    
    return sanitizeStudentForRole(updated, actor.role);
  } finally {
    lock.releaseLock();
  }
}

// --- STUDENT ENROLLMENT OPERATIONS ---

function createStudentEnrollment(payload, actor) {
  assertAdminOrAdministrator(actor);
  validateStudentEnrollment(payload, false);
  
  var record = {
    student_id: payload.student_id,
    class_id: payload.class_id,
    academic_year_id: payload.academic_year_id,
    semester_id: payload.semester_id,
    status: payload.status
  };
  
  return createRecord(SHEETS.STUDENT_ENROLLMENTS, record, actor);
}

function updateStudentEnrollment(id, payload, actor) {
  assertAdminOrAdministrator(actor);
  assertRecordExists(SHEETS.STUDENT_ENROLLMENTS, id);
  validateStudentEnrollment(payload, true, id);
  
  var patch = {};
  if (payload.student_id) patch.student_id = payload.student_id;
  if (payload.class_id) patch.class_id = payload.class_id;
  if (payload.academic_year_id) patch.academic_year_id = payload.academic_year_id;
  if (payload.semester_id) patch.semester_id = payload.semester_id;
  if (payload.status) patch.status = payload.status;
  
  return updateRecord(SHEETS.STUDENT_ENROLLMENTS, id, patch, actor);
}

function listStudentEnrollments(actor) {
  assertAdminOrAdministrator(actor);
  return listRecords(SHEETS.STUDENT_ENROLLMENTS).map(enrichStudentEnrollment);
}

function getStudentActiveEnrollment(studentId) {
  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;
  if (!activeYearId || !activeSemId) return null;
  
  var activeEnrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === activeYearId &&
           e.semester_id === activeSemId &&
           e.status === 'active';
  });
  
  return activeEnrollments.length > 0 ? enrichStudentEnrollment(activeEnrollments[0]) : null;
}

function enrichStudentEnrollment(enrollment) {
  if (!enrollment) return null;
  var classRecord = getRecordById(SHEETS.CLASSES, enrollment.class_id);
  var yearRecord = getRecordById(SHEETS.ACADEMIC_YEARS, enrollment.academic_year_id);
  var semesterRecord = getRecordById(SHEETS.SEMESTERS, enrollment.semester_id);
  var enriched = {};
  Object.keys(enrollment).forEach(function(key) { enriched[key] = enrollment[key]; });
  enriched.class_name = classRecord ? String(classRecord.name || '') : '';
  enriched.class_code = classRecord ? String(classRecord.code || '') : '';
  enriched.academic_year_name = yearRecord ? String(yearRecord.name || '') : '';
  enriched.semester_name = semesterRecord ? String(semesterRecord.name || '') : '';
  return enriched;
}

function changeStudentEnrollmentStatus(id, newStatus, actor) {
  assertAdminOrAdministrator(actor);
  assertRecordExists(SHEETS.STUDENT_ENROLLMENTS, id);
  
  var validStatuses = ['active', 'promoted', 'repeated', 'graduated', 'transferred', 'inactive'];
  if (validStatuses.indexOf(newStatus) === -1) {
    throw new Error("Invalid status: must be one of " + validStatuses.join(', '));
  }
  
  return updateRecord(SHEETS.STUDENT_ENROLLMENTS, id, { status: newStatus }, actor);
}

function listStudentsByClass(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  if (actor.role === ROLES.TEACHER) {
    // Assert teacher is assigned as wali kelas
    var activeAssignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
      return a.class_id === payload.class_id &&
             a.teacher_user_id === actor.id &&
             a.academic_year_id === payload.academic_year_id &&
             a.semester_id === payload.semester_id &&
             a.status === STATUS.ACTIVE;
    });
    
    if (activeAssignments.length === 0) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned to this class for the specified period.'
      };
    }
  }
  
  // Find active enrollments
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === payload.class_id &&
           e.academic_year_id === payload.academic_year_id &&
           e.semester_id === payload.semester_id &&
           e.status === 'active';
  });
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return studentIds.indexOf(s.id) !== -1;
  });

  var enrollmentByStudentId = {};
  enrollments.forEach(function(enrollment) {
    enrollmentByStudentId[enrollment.student_id] = enrollment.id;
  });

  return students.map(function(student) {
    var keysBefore = Object.keys(student);
    var sanitized = sanitizeStudentForRole(student, actor.role);
    var keysAfter = Object.keys(sanitized);
    sanitized.student_enrollment_id = enrollmentByStudentId[student.id] || '';
    sanitized._debug = {
      actor_id: actor.id,
      actor_role: actor.role,
      roles_teacher_val: ROLES.TEACHER,
      keys_before: keysBefore,
      keys_after: keysAfter,
      student_enrollment_id_assigned: sanitized.student_enrollment_id
    };
    return sanitized;
  });
}

// --- PRIVATES / HELPERS ---

function assertAdminOrAdministrator(actor) {
  if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to modify student/enrollment records.'
    };
  }
}

/**
 * Checks if a teacher is currently assigned to a student's class for the active period.
 */
function isTeacherAssignedToStudent(teacherUserId, studentId) {
  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;
  if (!activeYearId || !activeSemId) return false;
  
  var activeEnrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === activeYearId &&
           e.semester_id === activeSemId &&
           e.status === 'active';
  });
  if (activeEnrollments.length === 0) return false;
  
  var classId = activeEnrollments[0].class_id;
  
  var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
    return a.class_id === classId &&
           a.teacher_user_id === teacherUserId &&
           a.academic_year_id === activeYearId &&
           a.semester_id === activeSemId &&
           a.status === STATUS.ACTIVE;
  });
  
  return assignments.length > 0;
}
