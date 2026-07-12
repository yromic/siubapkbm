/**
 * ReportService.gs
 * Logic and security checks for JSON Report Generation (Student, Class, School).
 */

/**
 * Strips sensitive fields (NIK, KK, PIN hashes, and internal locking properties) from student records.
 */
function sanitizeStudentForReport(student) {
  if (!student) return null;
  var copy = JSON.parse(JSON.stringify(student));
  var sensitive = [
    'nik', 'family_card_number', 'family_card_date',
    'mother_nik', 'father_nik', 'guardian_nik',
    'parent_access_pin_hash', 'parent_access_pin_failed_attempts', 'parent_access_pin_locked_until'
  ];
  sensitive.forEach(function(field) {
    delete copy[field];
  });
  return copy;
}

/**
 * Asserts the actor is authorized to export student report.
 * Supports both Staff (actor_user_id) and Parent (parent_access_token) modes.
 */
function assertStudentReportAccess(payload, actor) {
  var studentId = '';
  
  if (payload.parent_access_token) {
    // Parent Mode: student_id is derived from token
    studentId = validateParentToken(payload.parent_access_token);
  } else {
    // Staff Mode
    if (!actor) {
      throw { code: 'ERR_UNAUTHORIZED', message: 'Authentication required.' };
    }
    validateRequiredFields(payload, ['student_id']);
    studentId = payload.student_id;
    
    if (actor.role === ROLES.TEACHER) {
      if (!isTeacherAssignedToStudent(actor.id, studentId)) {
        throw {
          code: 'ERR_FORBIDDEN',
          message: 'Forbidden: You are not assigned to this student\'s class.'
        };
      }
    }
  }
  
  return studentId;
}

/**
 * Asserts actor is authorized to export class report.
 */
function assertClassReportAccess(payload, actor) {
  if (!actor) {
    throw { code: 'ERR_UNAUTHORIZED', message: 'Authentication required.' };
  }
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  if (actor.role === ROLES.TEACHER) {
    var isAssigned = isTeacherAssignedToClass(actor.id, classId, yearId, semesterId);
    if (!isAssigned) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned to this class for the specified period.'
      };
    }
  }
}

/**
 * Helper to check if teacher is assigned to class.
 */
function isTeacherAssignedToClass(teacherUserId, classId, yearId, semesterId) {
  var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
    return a.class_id === classId &&
           a.teacher_user_id === teacherUserId &&
           a.academic_year_id === yearId &&
           a.semester_id === semesterId &&
           a.status === STATUS.ACTIVE;
  });
  return assignments.length > 0;
}

/**
 * Endpoint: export_student_academic_report
 */
function exportStudentAcademicReport(payload, actor) {
  var studentId = assertStudentReportAccess(payload, actor);
  validateRequiredFields(payload, ['academic_year_id', 'semester_id']);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) throw { code: 'ERR_NOT_FOUND', message: 'Student not found.' };
  
  var activeEnroll = getStudentActiveEnrollment(studentId) || listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId && e.academic_year_id === yearId && e.semester_id === semesterId;
  })[0];
  if (!activeEnroll) throw new Error("No enrollment found for the student in this period.");
  
  var classObj = getRecordById(SHEETS.CLASSES, activeEnroll.class_id);
  var yearObj = getRecordById(SHEETS.ACADEMIC_YEARS, yearId);
  var semObj = getRecordById(SHEETS.SEMESTERS, semesterId);
  
  var bypassActor = { id: 'system_reporter', role: ROLES.ADMINISTRATOR, name: 'System Reporter' };
  var summary = getStudentAcademicSummary({
    student_id: studentId,
    academic_year_id: yearId,
    semester_id: semesterId
  }, bypassActor);
  
  var subjectAverages = summary.subject_summaries.map(function(s) {
    return {
      subject_id: s.subject_id,
      subject_name: s.subject_name,
      average_score: s.average
    };
  });
  
  var assessmentsList = [];
  summary.subject_summaries.forEach(function(s) {
    s.scores.forEach(function(scoreItem) {
      assessmentsList.push({
        subject_name: s.subject_name,
        assessment_title: scoreItem.assessment_title,
        assessment_date: scoreItem.assessment_date,
        score: scoreItem.score,
        note: scoreItem.note
      });
    });
  });
  
  return {
    report_type: 'student_academic',
    student: sanitizeStudentForReport(student),
    class: classObj ? { id: classObj.id, code: classObj.code, name: classObj.name, level: classObj.level } : null,
    academic_year: yearObj ? { id: yearObj.id, name: yearObj.name } : null,
    semester: semObj ? { id: semObj.id, name: semObj.name } : null,
    subjects: subjectAverages,
    assessments: assessmentsList,
    overall_average: summary.total_average,
    generated_at: nowIso()
  };
}

/**
 * Endpoint: export_student_character_report
 */
function exportStudentCharacterReport(payload, actor) {
  var studentId = assertStudentReportAccess(payload, actor);
  validateRequiredFields(payload, ['academic_year_id', 'semester_id']);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) throw { code: 'ERR_NOT_FOUND', message: 'Student not found.' };
  
  var activeEnroll = getStudentActiveEnrollment(studentId) || listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId && e.academic_year_id === yearId && e.semester_id === semesterId;
  })[0];
  if (!activeEnroll) throw new Error("No enrollment found for the student in this period.");
  
  var classObj = getRecordById(SHEETS.CLASSES, activeEnroll.class_id);
  var yearObj = getRecordById(SHEETS.ACADEMIC_YEARS, yearId);
  var semObj = getRecordById(SHEETS.SEMESTERS, semesterId);
  
  var records = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           r.academic_year_id === yearId &&
           r.semester_id === semesterId;
  });
  
  var latest = records.length > 0 ? records[0] : null;
  
  return {
    report_type: 'student_character',
    student: sanitizeStudentForReport(student),
    class: classObj ? { id: classObj.id, code: classObj.code, name: classObj.name, level: classObj.level } : null,
    academic_year: yearObj ? { id: yearObj.id, name: yearObj.name } : null,
    semester: semObj ? { id: semObj.id, name: semObj.name } : null,
    fitrah: {
      F: latest && latest.f_score !== null ? Number(latest.f_score) : null,
      I: latest && latest.i_score !== null ? Number(latest.i_score) : null,
      T: latest && latest.t_score !== null ? Number(latest.t_score) : null,
      R: latest && latest.r_score !== null ? Number(latest.r_score) : null,
      A: latest && latest.a_score !== null ? Number(latest.a_score) : null,
      H: latest && latest.h_score !== null ? Number(latest.h_score) : null
    },
    days_counted: latest ? (Number(latest.days_counted) || 0) : 0,
    source: 'character_semester_summaries',
    generated_at: nowIso()
  };
}

/**
 * Endpoint: export_student_full_report
 */
function exportStudentFullReport(payload, actor) {
  var studentId = assertStudentReportAccess(payload, actor);
  validateRequiredFields(payload, ['academic_year_id', 'semester_id']);
  
  var acad = exportStudentAcademicReport(payload, actor);
  var charReport = exportStudentCharacterReport(payload, actor);
  
  var fitrahVals = [charReport.fitrah.F, charReport.fitrah.I, charReport.fitrah.T, charReport.fitrah.R, charReport.fitrah.A, charReport.fitrah.H].filter(function(v) {
    return v !== null && v !== undefined;
  });
  var fitrahAverage = fitrahVals.length > 0 ? Number((fitrahVals.reduce(function(acc, val) { return acc + val; }, 0) / fitrahVals.length).toFixed(2)) : null;
  
  var riskStatus = 'NORMAL';
  if ((acad.overall_average !== null && acad.overall_average < 2.0) || (fitrahAverage !== null && fitrahAverage < 2.0)) {
    riskStatus = 'AT_RISK';
  }
  
  return {
    report_type: 'student_full',
    student: acad.student,
    class: acad.class,
    academic_year: acad.academic_year,
    semester: acad.semester,
    academic: acad,
    character: charReport,
    summary: {
      academic_average: acad.overall_average,
      fitrah_average: fitrahAverage,
      risk_status: riskStatus
    },
    generated_at: nowIso()
  };
}

/**
 * Endpoint: export_class_academic_report
 */
function exportClassAcademicReport(payload, actor) {
  assertClassReportAccess(payload, actor);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var classObj = getRecordById(SHEETS.CLASSES, classId);
  var yearObj = getRecordById(SHEETS.ACADEMIC_YEARS, yearId);
  var semObj = getRecordById(SHEETS.SEMESTERS, semesterId);
  
  var bypassActor = { id: 'system_reporter', role: ROLES.ADMINISTRATOR, name: 'System Reporter' };
  
  // Find enrollments
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var studentSummaries = enrollments.map(function(e) {
    var summary = getStudentAcademicSummary({
      student_id: e.student_id,
      academic_year_id: yearId,
      semester_id: semesterId
    }, bypassActor);
    
    var student = getRecordById(SHEETS.STUDENTS, e.student_id);
    
    return {
      student_id: e.student_id,
      student_name: student ? student.full_name : 'Unknown',
      total_average: summary.total_average
    };
  });
  
  // Calculate class average
  var totalSum = 0;
  var totalCount = 0;
  studentSummaries.forEach(function(s) {
    if (s.total_average !== null) {
      totalSum += s.total_average;
      totalCount++;
    }
  });
  var classAverage = totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : null;
  
  var completeness = calculateAcademicCompleteness(classId, yearId, semesterId);
  
  return {
    report_type: 'class_academic',
    class: classObj ? { id: classObj.id, code: classObj.code, name: classObj.name } : null,
    academic_year: yearObj ? { id: yearObj.id, name: yearObj.name } : null,
    semester: semObj ? { id: semObj.id, name: semObj.name } : null,
    students: studentSummaries,
    class_average: classAverage,
    academic_completeness: completeness,
    generated_at: nowIso()
  };
}

/**
 * Endpoint: export_class_character_report
 */
function exportClassCharacterReport(payload, actor) {
  assertClassReportAccess(payload, actor);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var classObj = getRecordById(SHEETS.CLASSES, classId);
  var yearObj = getRecordById(SHEETS.ACADEMIC_YEARS, yearId);
  var semObj = getRecordById(SHEETS.SEMESTERS, semesterId);
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  
  var semesterSums = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.academic_year_id === yearId &&
           r.semester_id === semesterId &&
           studentIds.indexOf(r.student_id) !== -1;
  });
  
  var studentMap = {};
  var students = listRecords(SHEETS.STUDENTS, function(s) { return studentIds.indexOf(s.id) !== -1; });
  students.forEach(function(s) { studentMap[s.id] = s; });
  
  var summaries = semesterSums.map(function(s) {
    return {
      student_id: s.student_id,
      student_name: studentMap[s.student_id] ? studentMap[s.student_id].full_name : 'Unknown',
      fitrah: {
        F: s.f_score !== null ? Number(s.f_score) : null,
        I: s.i_score !== null ? Number(s.i_score) : null,
        T: s.t_score !== null ? Number(s.t_score) : null,
        R: s.r_score !== null ? Number(s.r_score) : null,
        A: s.a_score !== null ? Number(s.a_score) : null,
        H: s.h_score !== null ? Number(s.h_score) : null
      },
      days_counted: Number(s.days_counted) || 0
    };
  });
  
  // Calculate average FITRAH per indicators
  var sums = { F: 0, I: 0, T: 0, R: 0, A: 0, H: 0 };
  var counts = { F: 0, I: 0, T: 0, R: 0, A: 0, H: 0 };
  
  summaries.forEach(function(s) {
    ['F', 'I', 'T', 'R', 'A', 'H'].forEach(function(key) {
      var val = s.fitrah[key];
      if (val !== null && val !== undefined) {
        sums[key] += val;
        counts[key]++;
      }
    });
  });
  
  var classFitrahAverage = {
    F: counts.F > 0 ? Number((sums.F / counts.F).toFixed(2)) : null,
    I: counts.I > 0 ? Number((sums.I / counts.I).toFixed(2)) : null,
    T: counts.T > 0 ? Number((sums.T / counts.T).toFixed(2)) : null,
    R: counts.R > 0 ? Number((sums.R / counts.R).toFixed(2)) : null,
    A: counts.A > 0 ? Number((sums.A / counts.A).toFixed(2)) : null,
    H: counts.H > 0 ? Number((sums.H / counts.H).toFixed(2)) : null
  };
  
  var totalDaysCounted = summaries.reduce(function(acc, s) { return acc + s.days_counted; }, 0);
  
  return {
    report_type: 'class_character',
    class: classObj ? { id: classObj.id, code: classObj.code, name: classObj.name } : null,
    academic_year: yearObj ? { id: yearObj.id, name: yearObj.name } : null,
    semester: semObj ? { id: semObj.id, name: semObj.name } : null,
    students: summaries,
    class_fitrah_average: classFitrahAverage,
    total_days_counted: totalDaysCounted,
    generated_at: nowIso()
  };
}

/**
 * Endpoint: export_class_full_report
 */
function exportClassFullReport(payload, actor) {
  assertClassReportAccess(payload, actor);
  
  var academic = exportClassAcademicReport(payload, actor);
  var character = exportClassCharacterReport(payload, actor);
  var cultureCompleteness = calculateCultureCompleteness(payload.class_id, payload.academic_year_id, payload.semester_id);
  
  return {
    report_type: 'class_full',
    class: academic.class,
    academic_year: academic.academic_year,
    semester: academic.semester,
    academic: academic,
    character: character,
    culture_completeness: cultureCompleteness,
    generated_at: nowIso()
  };
}

/**
 * Endpoint: export_school_summary_report
 */
function exportSchoolSummaryReport(payload, actor) {
  assertAdminRole(actor);
  var schoolDash = get_school_dashboard(payload, actor);
  return {
    report_type: 'school_summary',
    active_students: schoolDash.active_students,
    active_teachers: schoolDash.active_teachers,
    active_classes: schoolDash.active_classes,
    academic_completion_rate: schoolDash.academic_completion_rate,
    culture_completion_rate: schoolDash.culture_completion_rate,
    at_risk_students: schoolDash.at_risk_students,
    generated_at: nowIso()
  };
}
