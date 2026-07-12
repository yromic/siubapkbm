/**
 * StudentValidator.gs
 * Validation logic for student profiles and enrollment records.
 */

/**
 * Validates student data payload.
 * @param {Object} data - Student payload.
 * @param {boolean} isUpdate - True if updating existing record.
 * @param {string} [excludeId] - Existing student ID.
 */
function validateStudent(data, isUpdate, excludeId) {
  // Reject parent_access_pin_hash directly from client
  if (data.parent_access_pin_hash !== undefined) {
    throw new Error("Direct modification of parent_access_pin_hash is not allowed.");
  }
  
  if (!isUpdate) {
    validateRequiredFields(data, ['nisn', 'full_name', 'birth_date', 'gender', 'status']);
  }
  
  // NISN format and uniqueness
  if (data.nisn) {
    var nisnStr = String(data.nisn).trim();
    if (!/^\d{8,12}$/.test(nisnStr)) {
      throw new Error("NISN must be numeric and between 8 to 12 digits.");
    }
    assertNoDuplicate(SHEETS.STUDENTS, 'nisn', nisnStr, excludeId);
  }
  
  // NIK formats if filled
  var nikFields = ['nik', 'mother_nik', 'father_nik', 'guardian_nik'];
  nikFields.forEach(function(field) {
    var val = data[field];
    if (val !== undefined && val !== null && val !== '') {
      var valStr = String(val).trim();
      if (!/^\d{16}$/.test(valStr)) {
        throw new Error(field.toUpperCase() + " must be a 16-digit numeric string.");
      }
    }
  });
  
  // Dates validation
  if (data.birth_date) {
    if (isNaN(Date.parse(data.birth_date))) {
      throw new Error("birth_date must be a valid date.");
    }
  }
  if (data.family_card_date) {
    if (isNaN(Date.parse(data.family_card_date))) {
      throw new Error("family_card_date must be a valid date.");
    }
  }
  
  // Gender enum validation
  if (data.gender) {
    if (data.gender !== 'L' && data.gender !== 'P') {
      throw new Error("Gender must be 'L' or 'P'.");
    }
  }
  
  // Status enum validation
  if (data.status) {
    var validStatuses = ['Aktif', 'Lulus', 'Pindah', 'Keluar', 'Tidak aktif', 'Meninggal'];
    if (validStatuses.indexOf(data.status) === -1) {
      throw new Error("Status must be one of: " + validStatuses.join(', '));
    }
  }
}

/**
 * Validates student enrollment data.
 * @param {Object} data - Enrollment payload.
 * @param {boolean} isUpdate - True if updating existing record.
 * @param {string} [excludeId] - Existing enrollment ID.
 */
function validateStudentEnrollment(data, isUpdate, excludeId) {
  if (!isUpdate) {
    validateRequiredFields(data, ['student_id', 'class_id', 'academic_year_id', 'semester_id', 'status']);
  }
  
  // Resolve current database details if update
  var studentId = data.student_id;
  var classId = data.class_id;
  var yearId = data.academic_year_id;
  var semesterId = data.semester_id;
  var status = data.status;
  
  if (isUpdate) {
    var existing = assertRecordExists(SHEETS.STUDENT_ENROLLMENTS, excludeId);
    studentId = studentId || existing.student_id;
    classId = classId || existing.class_id;
    yearId = yearId || existing.academic_year_id;
    semesterId = semesterId || existing.semester_id;
    status = status || existing.status;
  }
  
  // Assert existence of related records
  assertRecordExists(SHEETS.STUDENTS, studentId);
  assertRecordExists(SHEETS.CLASSES, classId);
  assertRecordExists(SHEETS.ACADEMIC_YEARS, yearId);
  var sem = assertRecordExists(SHEETS.SEMESTERS, semesterId);
  
  // Semester academic_year_id verification
  if (sem.academic_year_id !== yearId) {
    throw new Error("The specified semester does not belong to the selected academic year.");
  }
  
  // Status verification
  var validStatuses = ['active', 'promoted', 'repeated', 'graduated', 'transferred', 'inactive'];
  if (validStatuses.indexOf(status) === -1) {
    throw new Error("Enrollment status must be one of: " + validStatuses.join(', '));
  }
  
  // Single active enrollment invariant
  if (status === 'active') {
    var duplicates = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(item) {
      if (excludeId && item.id === excludeId) return false;
      return item.student_id === studentId &&
             item.academic_year_id === yearId &&
             item.semester_id === semesterId &&
             item.status === 'active';
    });
    
    if (duplicates.length > 0) {
      throw new Error("Student already has an active enrollment in this semester.");
    }
  }
}
