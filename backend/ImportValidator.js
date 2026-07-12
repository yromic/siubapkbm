/**
 * ImportValidator.gs
 * Validates parsed CSV rows before confirming the import.
 * Prevents duplicate keys in files and checks database constraints.
 */

var FORBIDDEN_FIELDS = ['id', 'created_at', 'updated_at', 'password_hash', 'parent_access_pin_hash'];

/**
 * Validates all parsed rows of a given import type.
 * @param {string} importType
 * @param {Object[]} rows
 * @param {Object} actor
 * @returns {Object[]} Collected validation errors
 */
function validateImportRows(importType, rows, actor) {
  var errors = [];
  
  if (importType === 'culture_scores' && rows.length > 0) {
    var expectedHeaders = ['nisn', 'score_date', 'sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
    var firstRow = rows[0];
    expectedHeaders.forEach(function(header) {
      if (firstRow[header] === undefined) {
        errors.push({
          row_number: 1,
          field: header,
          error_code: 'MISSING_HEADER',
          message: 'Header wajib tidak ditemukan atau salah nama: ' + header,
          raw_data: ''
        });
      }
    });
    if (errors.length > 0) return errors;
  }
  
  // 1. Pre-fetch database tables for fast validation caching
  var db = {};
  if (importType === 'students') {
    db.students = listRecords(SHEETS.STUDENTS);
  } else if (importType === 'teachers') {
    db.users = listRecords(SHEETS.USERS);
  } else if (importType === 'classes') {
    db.classes = listRecords(SHEETS.CLASSES);
  } else if (importType === 'subjects') {
    db.subjects = listRecords(SHEETS.SUBJECTS);
  } else if (importType === 'class_subjects') {
    db.classes = listRecords(SHEETS.CLASSES);
    db.subjects = listRecords(SHEETS.SUBJECTS);
    db.years = listRecords(SHEETS.ACADEMIC_YEARS);
    db.semesters = listRecords(SHEETS.SEMESTERS);
  } else if (importType === 'academic_scores') {
    db.assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS);
    db.students = listRecords(SHEETS.STUDENTS);
    db.enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS);
    db.teacher_assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS);
  } else if (importType === 'culture_scores') {
    db.students = listRecords(SHEETS.STUDENTS);
    db.enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS);
    db.teacher_assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS);
    db.semesters = listRecords(SHEETS.SEMESTERS);
  }
  
  // Track unique keys in the current file to prevent duplicate rows in the same file
  var seenKeys = {};
  
  rows.forEach(function(row) {
    var rowNum = row._rowNumber;
    
    // Check forbidden fields first
    FORBIDDEN_FIELDS.forEach(function(field) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        errors.push({
          row_number: rowNum,
          field: field,
          error_code: 'ERR_FORBIDDEN_FIELD',
          message: 'Field ' + field + ' cannot be imported; it is managed by the server.',
          raw_data: JSON.stringify(row)
        });
      }
    });
    
    // Type specific validations
    if (importType === 'students') {
      validateStudentRow(row, rowNum, db, seenKeys, errors);
    } else if (importType === 'teachers') {
      validateTeacherRow(row, rowNum, db, seenKeys, errors);
    } else if (importType === 'classes') {
      validateClassRow(row, rowNum, db, seenKeys, errors);
    } else if (importType === 'subjects') {
      validateSubjectRow(row, rowNum, db, seenKeys, errors);
    } else if (importType === 'class_subjects') {
      validateClassSubjectRow(row, rowNum, db, seenKeys, errors);
    } else if (importType === 'academic_scores') {
      validateAcademicScoreRow(row, rowNum, db, seenKeys, errors, actor);
    } else if (importType === 'culture_scores') {
      validateCultureScoreRow(row, rowNum, db, seenKeys, errors, actor);
    }
  });
  
  return errors;
}

function validateStudentRow(row, rowNum, db, seenKeys, errors) {
  if (!row.nisn) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'MISSING_REQUIRED', message: 'NISN is required.', raw_data: JSON.stringify(row) });
  } else {
    var nisn = String(row.nisn).trim();
    if (!/^\d{8,12}$/.test(nisn)) {
      errors.push({ row_number: rowNum, field: 'nisn', error_code: 'INVALID_FORMAT', message: 'NISN must be numeric and between 8 to 12 digits.', raw_data: JSON.stringify(row) });
    }
    if (seenKeys[nisn]) {
      errors.push({ row_number: rowNum, field: 'nisn', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate NISN in CSV file.', raw_data: JSON.stringify(row) });
    }
    seenKeys[nisn] = true;
  }
  
  if (!row.full_name) {
    errors.push({ row_number: rowNum, field: 'full_name', error_code: 'MISSING_REQUIRED', message: 'Full name is required.', raw_data: JSON.stringify(row) });
  }
  
  if (!row.birth_date) {
    errors.push({ row_number: rowNum, field: 'birth_date', error_code: 'MISSING_REQUIRED', message: 'Birth date is required.', raw_data: JSON.stringify(row) });
  } else {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) {
      errors.push({ row_number: rowNum, field: 'birth_date', error_code: 'INVALID_FORMAT', message: 'Birth date must be in YYYY-MM-DD format.', raw_data: JSON.stringify(row) });
    }
  }
  
  if (row.gender) {
    var gen = String(row.gender).trim().toUpperCase();
    if (gen !== 'L' && gen !== 'P') {
      errors.push({ row_number: rowNum, field: 'gender', error_code: 'INVALID_VALUE', message: 'Gender must be L or P.', raw_data: JSON.stringify(row) });
    }
  }
  
  if (row.status) {
    var validStatuses = ['Aktif', 'Lulus', 'Pindah', 'Keluar', 'Tidak aktif', 'Meninggal'];
    if (validStatuses.indexOf(row.status) === -1) {
      errors.push({ row_number: rowNum, field: 'status', error_code: 'INVALID_VALUE', message: 'Status must be one of: ' + validStatuses.join(', '), raw_data: JSON.stringify(row) });
    }
  }
  
  if (row.parent_pin) {
    if (!/^\d{4,8}$/.test(row.parent_pin)) {
      errors.push({ row_number: rowNum, field: 'parent_pin', error_code: 'INVALID_FORMAT', message: 'PIN must be numeric and between 4 to 8 digits.', raw_data: JSON.stringify(row) });
    }
  }
}

function validateTeacherRow(row, rowNum, db, seenKeys, errors) {
  var email = String(row.email || '').trim();
  var username = String(row.username || '').trim();
  
  if (!email && !username) {
    errors.push({ row_number: rowNum, field: 'email/username', error_code: 'MISSING_REQUIRED', message: 'Either email or username is required.', raw_data: JSON.stringify(row) });
  }
  
  if (email) {
    if (seenKeys['e_' + email]) {
      errors.push({ row_number: rowNum, field: 'email', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate email in CSV file.', raw_data: JSON.stringify(row) });
    }
    seenKeys['e_' + email] = true;
  }
  if (username) {
    if (seenKeys['u_' + username]) {
      errors.push({ row_number: rowNum, field: 'username', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate username in CSV file.', raw_data: JSON.stringify(row) });
    }
    seenKeys['u_' + username] = true;
  }
  
  if (!row.full_name) {
    errors.push({ row_number: rowNum, field: 'full_name', error_code: 'MISSING_REQUIRED', message: 'Full name is required.', raw_data: JSON.stringify(row) });
  }
}

function validateClassRow(row, rowNum, db, seenKeys, errors) {
  if (!row.code) {
    errors.push({ row_number: rowNum, field: 'code', error_code: 'MISSING_REQUIRED', message: 'Class code is required.', raw_data: JSON.stringify(row) });
  } else {
    var code = String(row.code).trim();
    if (seenKeys[code]) {
      errors.push({ row_number: rowNum, field: 'code', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate class code in CSV file.', raw_data: JSON.stringify(row) });
    }
    seenKeys[code] = true;
  }
  if (!row.name) {
    errors.push({ row_number: rowNum, field: 'name', error_code: 'MISSING_REQUIRED', message: 'Class name is required.', raw_data: JSON.stringify(row) });
  }
  if (!row.level) {
    errors.push({ row_number: rowNum, field: 'level', error_code: 'MISSING_REQUIRED', message: 'Class level is required.', raw_data: JSON.stringify(row) });
  }
}

function validateSubjectRow(row, rowNum, db, seenKeys, errors) {
  if (!row.code) {
    errors.push({ row_number: rowNum, field: 'code', error_code: 'MISSING_REQUIRED', message: 'Subject code is required.', raw_data: JSON.stringify(row) });
  } else {
    var code = String(row.code).trim();
    if (seenKeys[code]) {
      errors.push({ row_number: rowNum, field: 'code', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate subject code in CSV file.', raw_data: JSON.stringify(row) });
    }
    seenKeys[code] = true;
  }
  if (!row.name) {
    errors.push({ row_number: rowNum, field: 'name', error_code: 'MISSING_REQUIRED', message: 'Subject name is required.', raw_data: JSON.stringify(row) });
  }
}

function validateClassSubjectRow(row, rowNum, db, seenKeys, errors) {
  var classCode = String(row.class_code || '').trim();
  var subjectCode = String(row.subject_code || '').trim();
  var academicYear = String(row.academic_year || '').trim();
  var semester = String(row.semester || '').trim();
  
  if (!classCode) errors.push({ row_number: rowNum, field: 'class_code', error_code: 'MISSING_REQUIRED', message: 'Class code is required.', raw_data: JSON.stringify(row) });
  if (!subjectCode) errors.push({ row_number: rowNum, field: 'subject_code', error_code: 'MISSING_REQUIRED', message: 'Subject code is required.', raw_data: JSON.stringify(row) });
  if (!academicYear) errors.push({ row_number: rowNum, field: 'academic_year', error_code: 'MISSING_REQUIRED', message: 'Academic year is required.', raw_data: JSON.stringify(row) });
  if (!semester) errors.push({ row_number: rowNum, field: 'semester', error_code: 'MISSING_REQUIRED', message: 'Semester is required.', raw_data: JSON.stringify(row) });
  
  if (!classCode || !subjectCode || !academicYear || !semester) return;
  
  // Composite unique key in file
  var key = classCode + '::' + subjectCode + '::' + academicYear + '::' + semester;
  if (seenKeys[key]) {
    errors.push({ row_number: rowNum, field: 'composite_key', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate class subject assignment in CSV file.', raw_data: JSON.stringify(row) });
  }
  seenKeys[key] = true;
  
  // Validate database existence
  var matchingClasses = db.classes.filter(function(c) { return c.code === classCode; });
  if (matchingClasses.length === 0) {
    errors.push({ row_number: rowNum, field: 'class_code', error_code: 'NOT_FOUND', message: 'Class code ' + classCode + ' does not exist.', raw_data: JSON.stringify(row) });
  }
  
  var matchingSubjects = db.subjects.filter(function(s) { return s.code === subjectCode; });
  if (matchingSubjects.length === 0) {
    errors.push({ row_number: rowNum, field: 'subject_code', error_code: 'NOT_FOUND', message: 'Subject code ' + subjectCode + ' does not exist.', raw_data: JSON.stringify(row) });
  }
  
  var matchingYears = db.years.filter(function(y) { return y.name === academicYear; });
  if (matchingYears.length === 0) {
    errors.push({ row_number: rowNum, field: 'academic_year', error_code: 'NOT_FOUND', message: 'Academic year ' + academicYear + ' does not exist.', raw_data: JSON.stringify(row) });
  }
  
  if (matchingYears.length > 0) {
    var yearId = matchingYears[0].id;
    var matchingSemesters = db.semesters.filter(function(s) {
      return s.name === semester && s.academic_year_id === yearId;
    });
    if (matchingSemesters.length === 0) {
      errors.push({ row_number: rowNum, field: 'semester', error_code: 'NOT_FOUND', message: 'Semester ' + semester + ' does not exist or does not belong to academic year ' + academicYear + '.', raw_data: JSON.stringify(row) });
    }
  }
}

function validateAcademicScoreRow(row, rowNum, db, seenKeys, errors, actor) {
  var nisn = String(row.nisn || '').trim();
  var assessmentId = String(row.assessment_id || '').trim();
  var scoreRaw = row.score;
  
  if (!nisn) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'MISSING_REQUIRED', message: 'NISN is required.', raw_data: JSON.stringify(row) });
    return;
  }
  
  if (!assessmentId) {
    errors.push({ row_number: rowNum, field: 'assessment_id', error_code: 'MISSING_REQUIRED', message: 'Assessment ID is required.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // Composite unique check in current CSV file to avoid duplicates
  var compositeKey = nisn + '::' + assessmentId;
  if (seenKeys[compositeKey]) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate NISN + Assessment ID in CSV file.', raw_data: JSON.stringify(row) });
    return;
  }
  seenKeys[compositeKey] = true;
  
  // 1. Resolve Assessment
  var assessment = (db.assessments || []).filter(function(a) { return a.id === assessmentId; })[0];
  if (!assessment) {
    errors.push({ row_number: rowNum, field: 'assessment_id', error_code: 'NOT_FOUND', message: 'Assessment with ID ' + assessmentId + ' does not exist.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // 2. Check Assessment Status
  if (assessment.status === STATUS.DRAFT || assessment.status === STATUS.LOCKED) {
    errors.push({ row_number: rowNum, field: 'assessment_id', error_code: 'INVALID_STATUS', message: 'Cannot import scores for draft or locked assessment.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // 3. Check Guru Assignment (Authorization)
  if (actor && actor.role === ROLES.TEACHER) {
    var isAssigned = (db.teacher_assignments || []).some(function(a) {
      return a.class_id === assessment.class_id &&
             a.teacher_user_id === actor.id &&
             a.academic_year_id === assessment.academic_year_id &&
             a.semester_id === assessment.semester_id &&
             a.status === STATUS.ACTIVE;
    });
    if (!isAssigned) {
      errors.push({ row_number: rowNum, field: 'assessment_id', error_code: 'ERR_FORBIDDEN', message: 'Forbidden: You are not assigned to manage the class for this assessment.', raw_data: JSON.stringify(row) });
      return;
    }
  }
  
  // 4. Resolve Student
  var student = (db.students || []).filter(function(s) { return String(s.nisn).trim() === nisn; })[0];
  if (!student) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'NOT_FOUND', message: 'Student with NISN ' + nisn + ' does not exist.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // 5. Verify Student Active Enrollment in Class & Period of Assessment
  var hasEnrollment = (db.enrollments || []).some(function(e) {
    return e.student_id === student.id &&
           e.class_id === assessment.class_id &&
           e.academic_year_id === assessment.academic_year_id &&
           e.semester_id === assessment.semester_id &&
           e.status === 'active';
  });
  if (!hasEnrollment) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'NO_ACTIVE_ENROLLMENT', message: 'Student is not actively enrolled in the class and period for this assessment.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // 6. Lock Period & Semester Finalization & Locked Status Checks via shared validator
  try {
    assertAcademicEditAllowed(actor, assessment);
  } catch (e) {
    errors.push({
      row_number: rowNum,
      field: 'assessment_id',
      error_code: e.code || 'ERR_PERIOD_LOCKED',
      message: e.message || 'The period for editing scores is locked.',
      raw_data: JSON.stringify(row)
    });
    return;
  }
  
  // 8. Validate Score Value
  if (scoreRaw === undefined || scoreRaw === null || String(scoreRaw).trim() === '') {
    // Empty score -> Preview warning, skipped in confirm
    errors.push({
      row_number: rowNum,
      field: 'score',
      error_code: 'SCORE_EMPTY',
      message: 'Score kosong, row dilewati',
      severity: 'warning',
      raw_data: JSON.stringify(row)
    });
  } else {
    var scoreNum = Number(scoreRaw);
    if (isNaN(scoreNum)) {
      errors.push({ row_number: rowNum, field: 'score', error_code: 'INVALID_FORMAT', message: 'Score must be numeric.', raw_data: JSON.stringify(row) });
      return;
    }
    if (scoreNum < Number(assessment.score_min) || scoreNum > Number(assessment.score_max)) {
      errors.push({ row_number: rowNum, field: 'score', error_code: 'OUT_OF_RANGE', message: 'Score (' + scoreNum + ') is out of valid range [' + assessment.score_min + ', ' + assessment.score_max + '].', raw_data: JSON.stringify(row) });
      return;
    }
  }
}

function validateCultureScoreRow(row, rowNum, db, seenKeys, errors, actor) {
  var nisn = String(row.nisn || '').trim();
  var scoreDate = String(row.score_date || '').trim();
  
  if (!nisn) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'MISSING_REQUIRED', message: 'NISN is required.', raw_data: JSON.stringify(row) });
    return;
  }
  if (!scoreDate) {
    errors.push({ row_number: rowNum, field: 'score_date', error_code: 'MISSING_REQUIRED', message: 'Score date is required.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // 1. Calendar Date Validation (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scoreDate) || isNaN(Date.parse(scoreDate))) {
    errors.push({ row_number: rowNum, field: 'score_date', error_code: 'INVALID_FORMAT', message: 'Score date must be a valid calendar date in YYYY-MM-DD format.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // Composite unique key in file: student_id (or nisn) + score_date
  var compositeKey = nisn + '::' + scoreDate;
  if (seenKeys[compositeKey]) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'ERR_DUPLICATE_IN_FILE', message: 'Duplicate NISN + Score Date in CSV file.', raw_data: JSON.stringify(row) });
    return;
  }
  seenKeys[compositeKey] = true;
  
  // 2. Resolve Student
  var student = (db.students || []).filter(function(s) { return String(s.nisn).trim() === nisn; })[0];
  if (!student) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'NOT_FOUND', message: 'Student with NISN ' + nisn + ' does not exist.', raw_data: JSON.stringify(row) });
    return;
  }
  
  // 3. Resolve Academic Year and Semester from score_date
  var matchingSemesters = (db.semesters || []).filter(function(sem) {
    var sStart = typeof sem.start_date === 'string' ? sem.start_date : normalizeDateString(sem.start_date);
    var sEnd = typeof sem.end_date === 'string' ? sem.end_date : normalizeDateString(sem.end_date);
    var target = normalizeDateString(scoreDate);
    return target >= sStart && target <= sEnd;
  });
  
  if (matchingSemesters.length === 0) {
    errors.push({ row_number: rowNum, field: 'score_date', error_code: 'NO_MATCHING_PERIOD', message: 'No registered academic period covers the score date: ' + scoreDate, raw_data: JSON.stringify(row) });
    return;
  }
  
  // Find which of these semesters the student is actively enrolled in
  var resolvedSemester = matchingSemesters[0];
  for (var k = 0; k < matchingSemesters.length; k++) {
    var sem = matchingSemesters[k];
    var hasEnroll = (db.enrollments || []).some(function(e) {
      return e.student_id === student.id &&
             e.academic_year_id === sem.academic_year_id &&
             e.semester_id === sem.id &&
             e.status === 'active';
    });
    if (hasEnroll) {
      resolvedSemester = sem;
      break;
    }
  }
  
  var yearId = resolvedSemester.academic_year_id;
  var semesterId = resolvedSemester.id;
  
  // 4. Verify Active Enrollment matching Period
  var enrollment = (db.enrollments || []).filter(function(e) {
    return e.student_id === student.id &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  })[0];
  if (!enrollment) {
    errors.push({ row_number: rowNum, field: 'nisn', error_code: 'NO_ACTIVE_ENROLLMENT', message: 'Student is not actively enrolled for the academic period covering score date ' + scoreDate, raw_data: JSON.stringify(row) });
    return;
  }
  
  var classId = enrollment.class_id;
  
  // 5. Guru Authorization Check
  if (actor && actor.role === ROLES.TEACHER) {
    var isAssigned = (db.teacher_assignments || []).some(function(a) {
      return a.class_id === classId &&
             a.teacher_user_id === actor.id &&
             a.academic_year_id === yearId &&
             a.semester_id === semesterId &&
             a.status === STATUS.ACTIVE;
    });
    if (!isAssigned) {
      errors.push({ row_number: rowNum, field: 'nisn', error_code: 'ERR_FORBIDDEN', message: 'Forbidden: You are not assigned to manage the class for this student on this date.', raw_data: JSON.stringify(row) });
      return;
    }
  }
  
  // 6. Lock Period & Semester Finalization Checks via shared validator
  try {
    assertSemesterNotFinalized(yearId, semesterId);
    assertCultureEditAllowed(actor.role, scoreDate);
  } catch (e) {
    errors.push({
      row_number: rowNum,
      field: 'score_date',
      error_code: e.code || 'ERR_PERIOD_LOCKED',
      message: e.message || 'The period for editing culture scores is locked.',
      raw_data: JSON.stringify(row)
    });
    return;
  }
  
  // 8. Indicators validation
  var indicators = ['sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
  var allEmpty = true;
  var validationFailed = false;
  
  indicators.forEach(function(ind) {
    var val = row[ind];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      allEmpty = false;
      var num = Number(val);
      if (isNaN(num) || num < 1 || num > 4 || Math.floor(num) !== num) {
        errors.push({ row_number: rowNum, field: ind, error_code: 'INVALID_VALUE', message: 'Score for ' + ind + ' must be an integer between 1 and 4.', raw_data: JSON.stringify(row) });
        validationFailed = true;
      }
    }
  });
  
  if (validationFailed) return;
  
  // 9. All Empty Warning
  if (allEmpty) {
    errors.push({
      row_number: rowNum,
      field: 'score_date',
      error_code: 'CULTURE_ALL_EMPTY',
      message: 'Semua nilai budaya kosong, row dilewati',
      severity: 'warning',
      raw_data: JSON.stringify(row)
    });
  }
}


