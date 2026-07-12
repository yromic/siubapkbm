/**
 * IntegrityService.gs
 * Data integrity checker for Sprint 11. This service only reports issues.
 */

function runDataIntegrityCheck(payload, actor) {
  payload = payload || {};
  assertHardeningReadRole(actor);

  var issues = [];
  var rows = {};
  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    rows[sheetName] = listRecords(sheetName);
  });

  var index = {};
  Object.keys(rows).forEach(function(sheetName) {
    index[sheetName] = buildIdIndex(rows[sheetName]);
  });

  checkStudentEnrollments(rows, index, issues);
  checkAcademicScores(rows, index, issues);
  checkCultureScores(rows, index, issues);
  checkStudentFiles(rows, index, issues);
  checkClassTeacherAssignments(rows, index, issues);
  checkClassSubjects(rows, index, issues);
  checkSemesters(rows, index, issues);
  checkActivePeriodUniqueness(rows, issues);

  var summary = summarizeIntegrityIssues(issues, rows);
  var result = {
    status: deriveHardeningStatus(summary.criticals, summary.warnings),
    issues: payload.summary_only ? [] : issues,
    summary: summary
  };

  if (!payload.skip_audit) {
    logHardeningAudit(actor, 'run_data_integrity_check', 'system_integrity', '', {
      status: result.status,
      issue_count: issues.length
    });
  }

  return result;
}

function buildIdIndex(records) {
  var map = {};
  (records || []).forEach(function(record) {
    if (record.id) map[String(record.id)] = record;
  });
  return map;
}

function addIntegrityIssue(issues, severity, entity, entityId, issueCode, message, details) {
  issues.push({
    severity: severity,
    entity: entity,
    entity_id: entityId || '',
    issue_code: issueCode,
    message: message,
    details: details || {}
  });
}

function hasId(index, sheetName, id) {
  return !!(id && index[sheetName] && index[sheetName][String(id)]);
}

function checkStudentEnrollments(rows, index, issues) {
  rows[SHEETS.STUDENT_ENROLLMENTS].forEach(function(row) {
    if (!hasId(index, SHEETS.STUDENTS, row.student_id)) addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_ENROLLMENTS, row.id, 'ORPHAN_STUDENT_ID', 'student_id does not exist in students.', { student_id: row.student_id });
    if (!hasId(index, SHEETS.CLASSES, row.class_id)) addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_ENROLLMENTS, row.id, 'ORPHAN_CLASS_ID', 'class_id does not exist in classes.', { class_id: row.class_id });
    if (!hasId(index, SHEETS.ACADEMIC_YEARS, row.academic_year_id)) addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_ENROLLMENTS, row.id, 'ORPHAN_ACADEMIC_YEAR_ID', 'academic_year_id does not exist.', { academic_year_id: row.academic_year_id });
    if (!hasId(index, SHEETS.SEMESTERS, row.semester_id)) addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_ENROLLMENTS, row.id, 'ORPHAN_SEMESTER_ID', 'semester_id does not exist.', { semester_id: row.semester_id });
  });
  checkDuplicateActive(rows[SHEETS.STUDENT_ENROLLMENTS], ['student_id', 'academic_year_id', 'semester_id'], SHEETS.STUDENT_ENROLLMENTS, 'DUPLICATE_ACTIVE_ENROLLMENT', issues);
}

function checkAcademicScores(rows, index, issues) {
  rows[SHEETS.ACADEMIC_SCORES].forEach(function(row) {
    if (!hasId(index, SHEETS.ACADEMIC_ASSESSMENTS, row.assessment_id)) addIntegrityIssue(issues, 'critical', SHEETS.ACADEMIC_SCORES, row.id, 'ORPHAN_ASSESSMENT_ID', 'assessment_id does not exist.', { assessment_id: row.assessment_id });
    if (!hasId(index, SHEETS.STUDENTS, row.student_id)) addIntegrityIssue(issues, 'critical', SHEETS.ACADEMIC_SCORES, row.id, 'ORPHAN_STUDENT_ID', 'student_id does not exist.', { student_id: row.student_id });
    if (!hasId(index, SHEETS.STUDENT_ENROLLMENTS, row.student_enrollment_id)) addIntegrityIssue(issues, 'critical', SHEETS.ACADEMIC_SCORES, row.id, 'ORPHAN_STUDENT_ENROLLMENT_ID', 'student_enrollment_id does not exist.', { student_enrollment_id: row.student_enrollment_id });
  });
}

function checkCultureScores(rows, index, issues) {
  rows[SHEETS.CULTURE_SCORES].forEach(function(row) {
    if (!hasId(index, SHEETS.STUDENTS, row.student_id)) addIntegrityIssue(issues, 'critical', SHEETS.CULTURE_SCORES, row.id, 'ORPHAN_STUDENT_ID', 'student_id does not exist.', { student_id: row.student_id });
    if (!hasId(index, SHEETS.STUDENT_ENROLLMENTS, row.student_enrollment_id)) addIntegrityIssue(issues, 'critical', SHEETS.CULTURE_SCORES, row.id, 'ORPHAN_STUDENT_ENROLLMENT_ID', 'student_enrollment_id does not exist.', { student_enrollment_id: row.student_enrollment_id });
    if (!hasId(index, SHEETS.CLASSES, row.class_id)) addIntegrityIssue(issues, 'critical', SHEETS.CULTURE_SCORES, row.id, 'ORPHAN_CLASS_ID', 'class_id does not exist.', { class_id: row.class_id });
  });
}

function checkStudentFiles(rows, index, issues) {
  rows[SHEETS.STUDENT_FILES].forEach(function(row) {
    if (!hasId(index, SHEETS.STUDENTS, row.student_id)) addIntegrityIssue(issues, 'critical', SHEETS.STUDENT_FILES, row.id, 'ORPHAN_STUDENT_ID', 'student_id does not exist.', { student_id: row.student_id });
  });
}

function checkClassTeacherAssignments(rows, index, issues) {
  rows[SHEETS.CLASS_TEACHER_ASSIGNMENTS].forEach(function(row) {
    var user = row.teacher_user_id ? index[SHEETS.USERS][String(row.teacher_user_id)] : null;
    if (!user) {
      addIntegrityIssue(issues, 'critical', SHEETS.CLASS_TEACHER_ASSIGNMENTS, row.id, 'ORPHAN_TEACHER_USER_ID', 'teacher_user_id does not exist.', { teacher_user_id: row.teacher_user_id });
    } else if (user.role !== ROLES.TEACHER) {
      addIntegrityIssue(issues, 'critical', SHEETS.CLASS_TEACHER_ASSIGNMENTS, row.id, 'INVALID_TEACHER_ROLE', 'teacher_user_id exists but role is not teacher.', { teacher_user_id: row.teacher_user_id, role: user.role });
    }
    if (!hasId(index, SHEETS.CLASSES, row.class_id)) addIntegrityIssue(issues, 'critical', SHEETS.CLASS_TEACHER_ASSIGNMENTS, row.id, 'ORPHAN_CLASS_ID', 'class_id does not exist.', { class_id: row.class_id });
  });
  checkDuplicateActive(rows[SHEETS.CLASS_TEACHER_ASSIGNMENTS], ['class_id', 'academic_year_id', 'semester_id'], SHEETS.CLASS_TEACHER_ASSIGNMENTS, 'DUPLICATE_ACTIVE_CLASS_TEACHER_ASSIGNMENT', issues);
}

function checkClassSubjects(rows, index, issues) {
  rows[SHEETS.CLASS_SUBJECTS].forEach(function(row) {
    if (!hasId(index, SHEETS.CLASSES, row.class_id)) addIntegrityIssue(issues, 'critical', SHEETS.CLASS_SUBJECTS, row.id, 'ORPHAN_CLASS_ID', 'class_id does not exist.', { class_id: row.class_id });
    if (!hasId(index, SHEETS.SUBJECTS, row.subject_id)) addIntegrityIssue(issues, 'critical', SHEETS.CLASS_SUBJECTS, row.id, 'ORPHAN_SUBJECT_ID', 'subject_id does not exist.', { subject_id: row.subject_id });
  });
}

function checkSemesters(rows, index, issues) {
  rows[SHEETS.SEMESTERS].forEach(function(row) {
    if (!hasId(index, SHEETS.ACADEMIC_YEARS, row.academic_year_id)) addIntegrityIssue(issues, 'critical', SHEETS.SEMESTERS, row.id, 'ORPHAN_ACADEMIC_YEAR_ID', 'academic_year_id does not exist.', { academic_year_id: row.academic_year_id });
  });
}

function checkDuplicateActive(records, fields, entity, issueCode, issues) {
  var groups = {};
  records.forEach(function(row) {
    if (String(row.status || '').toLowerCase() !== 'active') return;
    var key = fields.map(function(field) { return row[field] || ''; }).join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  Object.keys(groups).forEach(function(key) {
    if (groups[key].length <= 1) return;
    groups[key].forEach(function(row) {
      addIntegrityIssue(issues, 'critical', entity, row.id, issueCode, 'More than one active row exists for key: ' + key, { duplicate_key: key, duplicate_count: groups[key].length });
    });
  });
}

function checkActivePeriodUniqueness(rows, issues) {
  var activeYears = rows[SHEETS.ACADEMIC_YEARS].filter(function(row) {
    return String(row.is_active).toLowerCase() === 'true';
  });
  if (activeYears.length > 1) {
    activeYears.forEach(function(row) {
      addIntegrityIssue(issues, 'critical', SHEETS.ACADEMIC_YEARS, row.id, 'MULTIPLE_ACTIVE_ACADEMIC_YEARS', 'More than one active academic year exists.', { active_count: activeYears.length });
    });
  }

  var byYear = {};
  rows[SHEETS.SEMESTERS].forEach(function(row) {
    if (String(row.is_active).toLowerCase() !== 'true') return;
    var key = row.academic_year_id || '';
    if (!byYear[key]) byYear[key] = [];
    byYear[key].push(row);
  });
  Object.keys(byYear).forEach(function(yearId) {
    if (byYear[yearId].length <= 1) return;
    byYear[yearId].forEach(function(row) {
      addIntegrityIssue(issues, 'critical', SHEETS.SEMESTERS, row.id, 'MULTIPLE_ACTIVE_SEMESTERS_IN_YEAR', 'More than one active semester exists in the same academic year.', { academic_year_id: yearId, active_count: byYear[yearId].length });
    });
  });
}

function summarizeIntegrityIssues(issues, rows) {
  var criticals = issues.filter(function(issue) { return issue.severity === 'critical'; }).length;
  var warnings = issues.filter(function(issue) { return issue.severity === 'warning'; }).length;
  return {
    checked_at: nowIso(),
    issue_count: issues.length,
    criticals: criticals,
    warnings: warnings,
    sheet_count: Object.keys(rows).length
  };
}
