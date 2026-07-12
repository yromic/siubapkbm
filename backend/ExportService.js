/**
 * ExportService.gs
 * Core logic for Sprint 11.6C - Export CSV Compliance.
 * Generates CSV, sanitizes data, saves files to Drive, and returns metadata.
 */

/**
 * Asserts the actor is authorized to perform export.
 * @param {Object} actor
 */
function assertExportPermissionGeneral(actor) {
  if (!actor) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Unauthorized: Session missing.'
    };
  }
  var role = actor.role;
  if (role !== ROLES.TEACHER && role !== ROLES.ADMINISTRATOR && role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to access export actions.'
    };
  }
}

/**
 * Helper to convert headers and rows of objects into a CSV string.
 * Escapes values containing commas, quotes, or newlines.
 * @param {string[]} headers
 * @param {Object[]} rows
 * @returns {string}
 */
function convertToCsvString(headers, rows) {
  var csvLines = [];
  
  // Headers line
  csvLines.push(headers.map(escapeExportCsvValue).join(','));
  
  // Data lines
  rows.forEach(function(row) {
    var line = headers.map(function(h) {
      return escapeExportCsvValue(row[h]);
    }).join(',');
    csvLines.push(line);
  });
  
  return csvLines.join('\n');
}

/**
 * Helper to escape single CSV cell value.
 * @param {*} val
 * @returns {string}
 */
function escapeExportCsvValue(val) {
  if (val === undefined || val === null) return '';
  var str = String(val);
  var trimmed = str.replace(/^\s+/, '');
  if (trimmed && ['=', '+', '-', '@'].indexOf(trimmed.charAt(0)) !== -1) {
    str = str.substring(0, str.length - trimmed.length) + "'" + trimmed;
  }
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Helper to save CSV file to a private directory in Drive.
 * @param {string} exportType - 'students', 'academic', or 'character'
 * @param {string} fileName
 * @param {string} csvContent
 * @returns {string} File ID
 */
function saveExportToDrive(exportType, fileName, csvContent) {
  var settings = getAppSettings();
  var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
  var rootFolder = getOrCreateFolder(null, rootName);
  
  var exportFolder = getOrCreateFolder(rootFolder, 'export');
  var typeFolder = getOrCreateFolder(exportFolder, exportType);
  
  var blob = Utilities.newBlob(csvContent, 'text/csv', fileName);
  var file = typeFolder.createFile(blob);
  
  // Ensure the file is private (explicit check/removal of any inherited public permissions)
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  
  return file.getId();
}

/**
 * Endpoint: export_students_csv
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Export file metadata
 */
function exportStudentsCsv(payload, actor) {
  assertExportPermissionGeneral(actor);
  
  var classId = payload.class_id || '';
  var yearId = payload.academic_year_id || '';
  var semesterId = payload.semester_id || '';
  
  // Get active teacher assignments for validation
  var assignedClassIds = [];
  if (actor.role === ROLES.TEACHER) {
    var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
      return a.teacher_user_id === actor.id && a.status === STATUS.ACTIVE;
    });
    assignedClassIds = assignments.map(function(a) { return a.class_id; });
    
    // If Guru filtered by class_id, verify they are assigned to it
    if (classId && assignedClassIds.indexOf(classId) === -1) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned to export this class.'
      };
    }
  }
  
  // Fetch active enrollments matching filters
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    if (e.status !== 'active') return false;
    if (classId && e.class_id !== classId) return false;
    if (yearId && e.academic_year_id !== yearId) return false;
    if (semesterId && e.semester_id !== semesterId) return false;
    
    // Guru restriction: only matching assigned class_ids
    if (actor.role === ROLES.TEACHER) {
      return assignedClassIds.indexOf(e.class_id) !== -1;
    }
    return true;
  });
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  
  // Fetch matching student records
  var studentRecords = listRecords(SHEETS.STUDENTS, function(s) {
    // If filtered, must match resolved student IDs
    if (classId || yearId || semesterId || actor.role === ROLES.TEACHER) {
      return studentIds.indexOf(s.id) !== -1;
    }
    return true; // Export all if no filters and Administrator/Admin
  });
  
  // Define headers based on Role (Sanitization)
  var headersList;
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    headersList = [
      'nisn', 'nik', 'full_name', 'birth_place', 'birth_date', 'gender', 'religion', 'phone', 
      'affirmation', 'special_needs', 'family_card_number', 'family_card_date', 'mother_name', 
      'mother_nik', 'father_name', 'father_nik', 'guardian_name', 'guardian_nik', 'address_street', 
      'rt', 'rw', 'hamlet', 'village', 'district', 'city', 'province', 'status'
    ];
  } else {
    // Guru headers (sanitized)
    headersList = [
      'nisn', 'full_name', 'birth_place', 'birth_date', 'gender', 'religion', 'phone', 
      'affirmation', 'special_needs', 'mother_name', 'father_name', 'guardian_name', 
      'address_street', 'hamlet', 'village', 'district', 'city', 'province', 'status'
    ];
  }
  
  // Convert to CSV
  var csvString = convertToCsvString(headersList, studentRecords);
  var suffix = String(new Date().getTime());
  var fileName = 'students_export_' + suffix + '.csv';
  var fileId = saveExportToDrive('students', fileName, csvString);
  var artifact = recordCsvExportArtifact({
    report_type: 'students', source_type: 'students_csv', source_id: classId,
    class_id: classId, academic_year_id: yearId, semester_id: semesterId,
    file_id: fileId, file_name: fileName, mime_type: 'text/csv', total_rows: studentRecords.length
  }, actor);
  
  // Audit log
  writeAuditLog({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'export_students_csv',
    entity_type: SHEETS.STUDENTS,
    entity_id: artifact.id,
    old_value: '',
    new_value: JSON.stringify({ export_id: artifact.id, export_type: 'students', file_name: fileName, source_type: 'students_csv', source_id: classId }),
    description: 'Exported students CSV file. Total rows: ' + studentRecords.length
  });
  
  return {
    file_id: fileId,
    file_name: fileName,
    mime_type: 'text/csv',
    created_at: nowIso(),
    export_type: 'students',
    total_rows: studentRecords.length,
    export_id: artifact.id,
    download_available: true
  };
}

/**
 * Endpoint: export_academic_scores_csv
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Export file metadata
 */
function exportAcademicScoresCsv(payload, actor) {
  assertExportPermissionGeneral(actor);
  validateRequiredFields(payload, ['class_id', 'subject_id', 'academic_year_id', 'semester_id']);
  
  var classId = payload.class_id;
  var subjectId = payload.subject_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // Guru check
  if (actor.role === ROLES.TEACHER) {
    var isAssigned = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
      return a.teacher_user_id === actor.id &&
             a.class_id === classId &&
             a.academic_year_id === yearId &&
             a.semester_id === semesterId &&
             a.status === STATUS.ACTIVE;
    }).length > 0;
    
    if (!isAssigned) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned to manage this class.'
      };
    }
  }
  
  // Fetch class, subject
  var classObj = getRecordById(SHEETS.CLASSES, classId);
  var subjectObj = getRecordById(SHEETS.SUBJECTS, subjectId);
  if (!classObj || !subjectObj) {
    throw { code: 'ERR_NOT_FOUND', message: 'Class or subject not found.' };
  }
  
  // Fetch matching assessments
  var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.class_id === classId &&
           a.subject_id === subjectId &&
           a.academic_year_id === yearId &&
           a.semester_id === semesterId;
  });
  
  var assessmentIds = assessments.map(function(a) { return a.id; });
  var assessmentMap = {};
  assessments.forEach(function(a) { assessmentMap[a.id] = a; });
  
  // Fetch matching academic scores
  var scores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return assessmentIds.indexOf(s.assessment_id) !== -1;
  });
  
  // Fetch students enrolled in this class to get their names/NISN
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var enrollMap = {};
  enrollments.forEach(function(e) { enrollMap[e.id] = e; });
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return studentIds.indexOf(s.id) !== -1;
  });
  var studentMap = {};
  students.forEach(function(s) { studentMap[s.id] = s; });
  
  // Prepare data rows
  var dataRows = [];
  scores.forEach(function(s) {
    var enroll = enrollMap[s.student_enrollment_id];
    var student = studentMap[s.student_id] || (enroll ? studentMap[enroll.student_id] : null);
    var assessment = assessmentMap[s.assessment_id];
    
    if (student && assessment) {
      dataRows.push({
        nisn: student.nisn,
        student_name: student.full_name,
        class_name: classObj.name,
        subject_name: subjectObj.name,
        assessment_name: assessment.title,
        assessment_date: assessment.assessment_date,
        score: s.score
      });
    }
  });
  
  var headersList = ['nisn', 'student_name', 'class_name', 'subject_name', 'assessment_name', 'assessment_date', 'score'];
  var csvString = convertToCsvString(headersList, dataRows);
  var suffix = String(new Date().getTime());
  var fileName = 'academic_scores_' + suffix + '.csv';
  var fileId = saveExportToDrive('academic', fileName, csvString);
  var artifact = recordCsvExportArtifact({
    report_type: 'academic', source_type: 'academic_scores_csv', source_id: classId,
    class_id: classId, academic_year_id: yearId, semester_id: semesterId,
    file_id: fileId, file_name: fileName, mime_type: 'text/csv', total_rows: dataRows.length
  }, actor);
  
  // Audit log
  writeAuditLog({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'export_academic_scores_csv',
    entity_type: SHEETS.ACADEMIC_SCORES,
    entity_id: artifact.id,
    old_value: '',
    new_value: JSON.stringify({ export_id: artifact.id, export_type: 'academic', file_name: fileName, source_type: 'academic_scores_csv', source_id: classId }),
    description: 'Exported academic scores CSV file. Total rows: ' + dataRows.length
  });
  
  return {
    file_id: fileId,
    file_name: fileName,
    mime_type: 'text/csv',
    created_at: nowIso(),
    export_type: 'academic',
    total_rows: dataRows.length,
    export_id: artifact.id,
    download_available: true
  };
}

/**
 * Endpoint: export_character_summary_csv
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object} Export file metadata
 */
function exportCharacterSummaryCsv(payload, actor) {
  assertExportPermissionGeneral(actor);
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // Guru check
  if (actor.role === ROLES.TEACHER) {
    var isAssigned = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
      return a.teacher_user_id === actor.id &&
             a.class_id === classId &&
             a.academic_year_id === yearId &&
             a.semester_id === semesterId &&
             a.status === STATUS.ACTIVE;
    }).length > 0;
    
    if (!isAssigned) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned to manage this class.'
      };
    }
  }
  
  // Fetch class
  var classObj = getRecordById(SHEETS.CLASSES, classId);
  if (!classObj) {
    throw { code: 'ERR_NOT_FOUND', message: 'Class not found.' };
  }
  
  // Fetch enrollments in this class
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var enrollmentIds = enrollments.map(function(e) { return e.id; });
  var enrollMap = {};
  enrollments.forEach(function(e) { enrollMap[e.id] = e; });
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return studentIds.indexOf(s.id) !== -1;
  });
  var studentMap = {};
  students.forEach(function(s) { studentMap[s.id] = s; });
  
  // Fetch semester FITRAH summaries
  var summaries = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.academic_year_id === yearId &&
           r.semester_id === semesterId &&
           enrollmentIds.indexOf(r.student_enrollment_id) !== -1;
  });
  
  // Prepare data rows
  var dataRows = [];
  summaries.forEach(function(s) {
    var enroll = enrollMap[s.student_enrollment_id];
    var student = studentMap[s.student_id] || (enroll ? studentMap[enroll.student_id] : null);
    
    if (student) {
      dataRows.push({
        nisn: student.nisn,
        student_name: student.full_name,
        class_name: classObj.name,
        fathonah: s.f_score || '',
        istiqamah: s.i_score || '',
        tanggung_jawab: s.t_score || '',
        ramah: s.r_score || '',
        amanah: s.a_score || '',
        harmonis: s.h_score || ''
      });
    }
  });
  
  var headersList = ['nisn', 'student_name', 'class_name', 'fathonah', 'istiqamah', 'tanggung_jawab', 'ramah', 'amanah', 'harmonis'];
  var csvString = convertToCsvString(headersList, dataRows);
  var suffix = String(new Date().getTime());
  var fileName = 'character_summary_' + suffix + '.csv';
  var fileId = saveExportToDrive('character', fileName, csvString);
  var artifact = recordCsvExportArtifact({
    report_type: 'character', source_type: 'character_summary_csv', source_id: classId,
    class_id: classId, academic_year_id: yearId, semester_id: semesterId,
    file_id: fileId, file_name: fileName, mime_type: 'text/csv', total_rows: dataRows.length
  }, actor);
  
  // Audit log
  writeAuditLog({
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    action: 'export_character_summary_csv',
    entity_type: SHEETS.CHARACTER_SEMESTER_SUMMARIES,
    entity_id: artifact.id,
    old_value: '',
    new_value: JSON.stringify({ export_id: artifact.id, export_type: 'character', file_name: fileName, source_type: 'character_summary_csv', source_id: classId }),
    description: 'Exported character FITRAH summary CSV file. Total rows: ' + dataRows.length
  });
  
  return {
    file_id: fileId,
    file_name: fileName,
    mime_type: 'text/csv',
    created_at: nowIso(),
    export_type: 'character',
    total_rows: dataRows.length,
    export_id: artifact.id,
    download_available: true
  };
}
