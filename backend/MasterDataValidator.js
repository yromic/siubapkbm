/**
 * MasterDataValidator.gs
 * Shared validation logic for master data entities.
 */

/**
 * Validates that required fields are present in data and not empty.
 * @param {Object} data - Input data.
 * @param {string[]} fields - Required field names.
 */
function validateRequiredFields(data, fields) {
  fields.forEach(function(field) {
    var val = data[field];
    if (val === undefined || val === null || val === '') {
      throw new Error("Field '" + field + "' is required.");
    }
  });
}

/**
 * Validates that start_date is less than or equal to end_date.
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 */
function validateDateOrder(startDate, endDate) {
  if (!startDate || !endDate) return;
  var start = new Date(startDate).getTime();
  var end = new Date(endDate).getTime();
  if (isNaN(start) || isNaN(end)) {
    throw new Error("Invalid date format.");
  }
  if (start > end) {
    throw new Error("Start date cannot be greater than end date.");
  }
}

/**
 * Asserts that a record exists in a sheet.
 * @param {string} sheetName
 * @param {string} id
 * @returns {Object} The found record.
 */
function assertRecordExists(sheetName, id) {
  var record = getRecordById(sheetName, id);
  if (!record) {
    throw new Error("Record with ID '" + id + "' not found in '" + sheetName + "'.");
  }
  return record;
}

/**
 * Checks for duplicate field value in a sheet (e.g. name, code).
 * @param {string} sheetName
 * @param {string} fieldName
 * @param {any} value
 * @param {string} [excludeId]
 */
function assertNoDuplicate(sheetName, fieldName, value, excludeId) {
  if (value === undefined || value === null || value === '') return;
  var valStr = String(value).toLowerCase().trim();
  
  var duplicates = listRecords(sheetName, function(item) {
    if (excludeId && item.id === excludeId) return false;
    var itemVal = item[fieldName];
    return itemVal && String(itemVal).toLowerCase().trim() === valStr;
  });
  
  if (duplicates.length > 0) {
    throw new Error("Record with " + fieldName + " '" + value + "' already exists in '" + sheetName + "'.");
  }
}

/**
 * Validates semester name and asserts no duplicates in the same academic year.
 * @param {string} academicYearId
 * @param {string} semesterName - Must be "Ganjil" or "Genap".
 * @param {string} [excludeId]
 */
function validateSemesterNameAndUniqueness(academicYearId, semesterName, excludeId) {
  var nameClean = String(semesterName).trim();
  if (nameClean !== 'Ganjil' && nameClean !== 'Genap') {
    throw new Error("Semester name must be either 'Ganjil' or 'Genap'.");
  }
  
  var duplicates = listRecords(SHEETS.SEMESTERS, function(item) {
    if (excludeId && item.id === excludeId) return false;
    return item.academic_year_id === academicYearId && String(item.name).trim() === nameClean;
  });
  
  if (duplicates.length > 0) {
    throw new Error("Semester '" + nameClean + "' already exists for this academic year.");
  }
}

/**
 * Checks that user exists and holds a specific role.
 * @param {string} userId
 * @param {string} expectedRole
 */
function assertUserRole(userId, expectedRole) {
  var user = assertRecordExists(SHEETS.USERS, userId);
  if (user.role !== expectedRole) {
    throw new Error("User must have the role '" + expectedRole + "'. Current: '" + user.role + "'.");
  }
}

/**
 * Checks duplicate active class subject mapping.
 */
function assertNoDuplicateClassSubject(classId, subjectId, academicYearId, semesterId, excludeId) {
  var duplicates = listRecords(SHEETS.CLASS_SUBJECTS, function(item) {
    if (excludeId && item.id === excludeId) return false;
    return item.class_id === classId &&
           item.subject_id === subjectId &&
           item.academic_year_id === academicYearId &&
           item.semester_id === semesterId &&
           item.status === STATUS.ACTIVE;
  });
  
  if (duplicates.length > 0) {
    throw new Error("Subject is already assigned to this class for the specified semester.");
  }
}

/**
 * Checks that a user has only one active teacher profile.
 */
function assertNoDuplicateTeacherProfile(userId, excludeId) {
  var duplicates = listRecords(SHEETS.TEACHER_PROFILES, function(item) {
    if (excludeId && item.id === excludeId) return false;
    return item.user_id === userId && item.status === STATUS.ACTIVE;
  });
  
  if (duplicates.length > 0) {
    throw new Error("User already has an active teacher profile.");
  }
}
