/**
 * ReportingService.gs
 * Handles all reporting and dashboard calculations for Sprint 6.
 */

/**
 * Returns student progress dashboard metrics.
 */
function get_student_progress_dashboard(payload, actor) {
  validateRequiredFields(payload, ['student_id', 'academic_year_id', 'semester_id']);
  
  var studentId = payload.student_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  assertStudentReportingAccess(actor, studentId, yearId, semesterId);
  
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) {
    throw new Error("Student not found.");
  }
  
  var cleanStudent = {
    id: student.id,
    full_name: student.full_name,
    nisn: student.nisn,
    gender: student.gender,
    religion: student.religion,
    birth_place: student.birth_place,
    birth_date: student.birth_date,
    status: student.status
  };
  
  var academicSummary = null;
  try {
    academicSummary = getStudentAcademicSummary({
      student_id: studentId,
      academic_year_id: yearId,
      semester_id: semesterId
    }, actor);
  } catch (err) {
    // Ignore if not enrolled or similar
  }
  
  var classAssessments = [];
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  if (enrollments.length > 0) {
    var classId = enrollments[0].class_id;
    classAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
      return a.class_id === classId &&
             a.academic_year_id === yearId &&
             a.semester_id === semesterId;
    });
  }
  
  var academicObj = {
    subject_count: academicSummary ? academicSummary.subject_summaries.length : 0,
    assessment_count: classAssessments.length,
    average_score: (academicSummary && academicSummary.total_average !== null) ? Number(academicSummary.total_average) : null,
    subject_averages: academicSummary ? academicSummary.subject_summaries.map(function(s) {
      return {
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        average_score: s.average !== null ? Number(s.average) : null
      };
    }) : []
  };
  
  var charSummary = null;
  try {
    charSummary = getStudentCharacterSummary({
      student_id: studentId,
      academic_year_id: yearId,
      semester_id: semesterId
    }, actor);
  } catch (err) {
    // Ignore
  }
  
  var characterObj = {
    F: (charSummary && charSummary.f !== null) ? Number(charSummary.f) : null,
    I: (charSummary && charSummary.i !== null) ? Number(charSummary.i) : null,
    T: (charSummary && charSummary.t !== null) ? Number(charSummary.t) : null,
    R: (charSummary && charSummary.r !== null) ? Number(charSummary.r) : null,
    A: (charSummary && charSummary.a !== null) ? Number(charSummary.a) : null,
    H: (charSummary && charSummary.h !== null) ? Number(charSummary.h) : null,
    days_counted: charSummary ? Number(charSummary.days_counted) : 0
  };
  
  var academicAverage = academicObj.average_score;
  var fitrahVals = [characterObj.F, characterObj.I, characterObj.T, characterObj.R, characterObj.A, characterObj.H].filter(function(v) {
    return v !== null && v !== undefined && v !== '';
  });
  var fitrahAverage = fitrahVals.length > 0 ? Number((fitrahVals.reduce(function(acc, val) { return acc + Number(val); }, 0) / fitrahVals.length).toFixed(2)) : null;
  
  var riskStatus = 'NORMAL';
  if ((academicAverage !== null && academicAverage < 2.0) || (fitrahAverage !== null && fitrahAverage < 2.0)) {
    riskStatus = 'AT_RISK';
  }
  
  var summaryObj = {
    academic_average: academicAverage,
    fitrah_average: fitrahAverage,
    risk_status: riskStatus
  };
  
  return {
    student: cleanStudent,
    academic: academicObj,
    character: characterObj,
    summary: summaryObj
  };
}

/**
 * Returns class monitoring dashboard metrics.
 */
function get_class_monitoring_dashboard(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  assertReportingAccess(actor, classId, yearId, semesterId);
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var studentCount = enrollments.length;
  if (studentCount === 0) {
    return {
      student_count: 0,
      academic_average: null,
      fitrah_average: null,
      academic_completeness: { completed_students: 0, pending_students: 0, completion_rate: 0 },
      culture_completeness: { completed_students: 0, pending_students: 0, completion_rate: 0 }
    };
  }
  
  var totalAcademicSum = 0;
  var totalAcademicCount = 0;
  
  enrollments.forEach(function(e) {
    try {
      var summary = getStudentAcademicSummary({
        student_id: e.student_id,
        academic_year_id: yearId,
        semester_id: semesterId
      }, actor);
      if (summary && summary.total_average !== null) {
        totalAcademicSum += Number(summary.total_average);
        totalAcademicCount++;
      }
    } catch (err) {}
  });
  
  var academicAverage = totalAcademicCount > 0 ? Number((totalAcademicSum / totalAcademicCount).toFixed(2)) : null;
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  var semesterSums = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.academic_year_id === yearId &&
           r.semester_id === semesterId &&
           studentIds.indexOf(r.student_id) !== -1;
  });
  
  var totalFitrahSum = 0;
  var totalFitrahCount = 0;
  
  semesterSums.forEach(function(s) {
    var fitrahVals = [s.f_score, s.i_score, s.t_score, s.r_score, s.a_score, s.h_score].filter(function(v) {
      return v !== null && v !== undefined && v !== '';
    });
    if (fitrahVals.length > 0) {
      var avg = fitrahVals.reduce(function(acc, val) { return acc + Number(val); }, 0) / fitrahVals.length;
      totalFitrahSum += avg;
      totalFitrahCount++;
    }
  });
  
  var fitrahAverage = totalFitrahCount > 0 ? Number((totalFitrahSum / totalFitrahCount).toFixed(2)) : null;
  
  var academicCompleteness = calculateAcademicCompleteness(classId, yearId, semesterId);
  var cultureCompleteness = calculateCultureCompleteness(classId, yearId, semesterId);
  
  return {
    student_count: studentCount,
    academic_average: academicAverage,
    fitrah_average: fitrahAverage,
    academic_completeness: academicCompleteness,
    culture_completeness: cultureCompleteness
  };
}

/**
 * Returns teacher dashboard monitoring metrics.
 */
function get_teacher_monitoring_dashboard(payload, actor) {
  // 1. Pastikan role guru/admin/administrator
  if (!actor || (actor.role !== ROLES.TEACHER && actor.role !== ROLES.ADMIN && actor.role !== ROLES.ADMINISTRATOR)) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Unauthorized access.'
    };
  }

  // 2. Tentukan academicYear dan semester
  var activeYear = null;
  if (payload.academic_year_id) {
    activeYear = getRecordById(SHEETS.ACADEMIC_YEARS, payload.academic_year_id);
    if (!activeYear) {
      throw new Error("Academic year not found.");
    }
  } else {
    activeYear = getActiveAcademicYear();
  }

  var activeSem = null;
  if (payload.semester_id) {
    activeSem = getRecordById(SHEETS.SEMESTERS, payload.semester_id);
    if (!activeSem) {
      throw new Error("Semester not found.");
    }
  } else {
    activeSem = getActiveSemester(activeYear ? activeYear.id : null);
  }

  if (!activeYear || !activeSem) {
    throw {
      code: 'ERR_ACTIVE_PERIOD_NOT_SET',
      message: 'Active academic year or semester is not set.'
    };
  }
  
  var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
    return a.teacher_user_id === actor.id &&
           a.academic_year_id === activeYear.id &&
           a.semester_id === activeSem.id &&
           a.status === 'active';
  });
  
  var classIds = assignments.map(function(a) { return a.class_id; });
  
  var classes = [];
  if (classIds.length > 0) {
    classes = listRecords(SHEETS.CLASSES, function(c) {
      return classIds.indexOf(c.id) !== -1;
    });
  }
  
  var enrollments = [];
  if (classIds.length > 0) {
    enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
      return classIds.indexOf(e.class_id) !== -1 &&
             e.academic_year_id === activeYear.id &&
             e.semester_id === activeSem.id &&
             e.status === 'active';
    });
  }
  var studentCount = enrollments.length;
  
  var assessments = [];
  if (classIds.length > 0) {
    assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
      return classIds.indexOf(a.class_id) !== -1 &&
             a.academic_year_id === activeYear.id &&
             a.semester_id === activeSem.id;
    });
  }
  
  var activeAssessments = assessments.filter(function(a) {
    return a.status === STATUS.PUBLISHED;
  }).length;
  
  var pendingAssessments = 0;
  var publishedAssessments = assessments.filter(function(a) {
    return a.status === STATUS.PUBLISHED;
  });
  
  var enrollmentsByClass = {};
  enrollments.forEach(function(e) {
    if (!enrollmentsByClass[e.class_id]) {
      enrollmentsByClass[e.class_id] = [];
    }
    enrollmentsByClass[e.class_id].push(e.student_id);
  });
  
  publishedAssessments.forEach(function(a) {
    var classStudents = enrollmentsByClass[a.class_id] || [];
    var totalClassStudents = classStudents.length;
    if (totalClassStudents > 0) {
      var scores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
        return s.assessment_id === a.id &&
               s.status === STATUS.ACTIVE &&
               s.score !== null &&
               s.score !== '' &&
               classStudents.indexOf(s.student_id) !== -1;
      });
      if (scores.length < totalClassStudents) {
        pendingAssessments++;
      }
    }
  });
  
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var todayEntries = listRecords(SHEETS.CULTURE_SCORES, function(c) {
    return c.teacher_user_id === actor.id &&
           normalizeDateString(c.score_date) === today &&
           c.status === 'active';
  });
  var todayCultureEntries = todayEntries.length;
  
  return {
    classes: classes.map(function(c) { return { id: c.id, code: c.code, name: c.name }; }),
    student_count: studentCount,
    active_assessments: activeAssessments,
    pending_assessments: pendingAssessments,
    today_culture_entries: todayCultureEntries
  };
}

/**
 * Returns school level dashboard metrics.
 */
function get_school_dashboard(payload, actor) {
  assertAdminOrAdministrator(actor);
  
  var activeYear = null;
  var activeSem = null;
  try {
    activeYear = getActiveAcademicYear();
    activeSem = getActiveSemester(activeYear ? activeYear.id : null);
  } catch (err) {
    if (err && err.code !== 'ERR_ACTIVE_PERIOD_NOT_SET') {
      throw err;
    }
  }
  
  var activeStudents = listRecords(SHEETS.STUDENTS, function(s) {
    return s.status === 'Aktif' || s.status === 'active';
  }).length;
  
  var activeTeachers = listRecords(SHEETS.USERS, function(u) {
    return u.role === 'teacher' && u.status === 'active';
  }).length;
  
  var activeClasses = listRecords(SHEETS.CLASSES, function(c) {
    return c.status === 'active';
  }).length;
  
  if (!activeYear || !activeSem) {
    return {
      active_students: activeStudents,
      active_teachers: activeTeachers,
      active_classes: activeClasses,
      academic_completion_rate: 0,
      culture_completion_rate: 0,
      at_risk_students: 0
    };
  }
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.academic_year_id === activeYear.id &&
           e.semester_id === activeSem.id &&
           e.status === 'active';
  });
  
  var totalStudents = enrollments.length;
  var academicRate = 0;
  var cultureRate = 0;
  
  if (totalStudents > 0) {
    var allAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
      return a.academic_year_id === activeYear.id &&
             a.semester_id === activeSem.id;
    });
    var assessmentIds = allAssessments.map(function(a) { return a.id; });
    var academicScores = [];
    if (assessmentIds.length > 0) {
      academicScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
        return s.status === STATUS.ACTIVE &&
               s.score !== null &&
               s.score !== '' &&
               assessmentIds.indexOf(s.assessment_id) !== -1;
      });
    }
    
    var academicCompletedMap = {};
    academicScores.forEach(function(s) {
      academicCompletedMap[s.student_id] = true;
    });
    
    var completedAcademicCount = 0;
    enrollments.forEach(function(e) {
      if (academicCompletedMap[e.student_id]) {
        completedAcademicCount++;
      }
    });
    
    academicRate = Number(((completedAcademicCount / totalStudents) * 100).toFixed(2));
    
    var summaries = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
      return r.academic_year_id === activeYear.id &&
             r.semester_id === activeSem.id;
    });
    
    var cultureCompletedMap = {};
    summaries.forEach(function(s) {
      if (s.days_counted !== null && Number(s.days_counted) > 0) {
        cultureCompletedMap[s.student_id] = true;
      }
    });
    
    var completedCultureCount = 0;
    enrollments.forEach(function(e) {
      if (cultureCompletedMap[e.student_id]) {
        completedCultureCount++;
      }
    });
    
    cultureRate = Number(((completedCultureCount / totalStudents) * 100).toFixed(2));
  }
  
  var atRiskStudents = 0;
  if (totalStudents > 0) {
    enrollments.forEach(function(e) {
      var summaryResult = null;
      try {
        summaryResult = getStudentAcademicSummary({
          student_id: e.student_id,
          academic_year_id: activeYear.id,
          semester_id: activeSem.id
        }, actor);
      } catch (err) {}
      
      var acadAverage = (summaryResult && summaryResult.total_average !== null) ? Number(summaryResult.total_average) : null;
      
      var semesterSummaries = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
        return r.student_id === e.student_id &&
               r.academic_year_id === activeYear.id &&
               r.semester_id === activeSem.id;
      });
      
      var fitrahAverage = null;
      if (semesterSummaries.length > 0) {
        var s = semesterSummaries[0];
        var fitrahVals = [s.f_score, s.i_score, s.t_score, s.r_score, s.a_score, s.h_score].filter(function(v) {
          return v !== null && v !== undefined && v !== '';
        });
        if (fitrahVals.length > 0) {
          fitrahAverage = fitrahVals.reduce(function(acc, val) { return acc + Number(val); }, 0) / fitrahVals.length;
        }
      }
      
      if ((acadAverage !== null && acadAverage < 2.0) || (fitrahAverage !== null && fitrahAverage < 2.0)) {
        atRiskStudents++;
      }
    });
  }
  
  return {
    active_students: activeStudents,
    active_teachers: activeTeachers,
    active_classes: activeClasses,
    academic_completion_rate: academicRate,
    culture_completion_rate: cultureRate,
    at_risk_students: atRiskStudents
  };
}

/**
 * Returns student watchlist.
 */
function get_student_watchlist(payload, actor) {
  validateRequiredFields(payload, ['academic_year_id', 'semester_id']);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var allowedClassIds = [];
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    var classes = listRecords(SHEETS.CLASSES, function(c) { return c.status === 'active'; });
    allowedClassIds = classes.map(function(c) { return c.id; });
  } else if (actor.role === ROLES.TEACHER) {
    allowedClassIds = getTeacherActiveClasses(actor.id);
  } else {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Unauthorized access.'
    };
  }
  
  if (allowedClassIds.length === 0) {
    return [];
  }
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return allowedClassIds.indexOf(e.class_id) !== -1 &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return studentIds.indexOf(s.id) !== -1;
  });
  var studentMap = {};
  students.forEach(function(s) {
    studentMap[s.id] = s;
  });
  
  var semesterSums = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.academic_year_id === yearId &&
           r.semester_id === semesterId &&
           studentIds.indexOf(r.student_id) !== -1;
  });
  
  var fitrahMap = {};
  var summaryMap = {};
  semesterSums.forEach(function(s) {
    summaryMap[s.student_id] = s;
    var fitrahVals = [s.f_score, s.i_score, s.t_score, s.r_score, s.a_score, s.h_score].filter(function(v) {
      return v !== null && v !== undefined && v !== '';
    });
    if (fitrahVals.length > 0) {
      var avg = fitrahVals.reduce(function(acc, val) { return acc + Number(val); }, 0) / fitrahVals.length;
      fitrahMap[s.student_id] = Number(avg.toFixed(2));
    }
  });
  
  var watchlist = [];
  
  // Retrieve settings with fallbacks
  var settings = getAppSettings() || {};
  var acadThreshold = Number(settings.watchlist_academic_threshold) || 70;
  var fitrahThreshold = Number(settings.watchlist_fitrah_threshold) || 2.0;
  var semester = assertRecordExists(SHEETS.SEMESTERS, semesterId);
  
  enrollments.forEach(function(e) {
    var acadAverage = null;
    try {
      var summaryResult = getStudentAcademicSummary({
        student_id: e.student_id,
        academic_year_id: yearId,
        semester_id: semesterId
      }, actor);
      if (summaryResult && summaryResult.total_average !== null) {
        acadAverage = Number(summaryResult.total_average);
      }
    } catch (err) {}
    
    var fitrahAverage = fitrahMap[e.student_id] !== undefined ? fitrahMap[e.student_id] : null;
    var summary = summaryMap[e.student_id];
    var coverage = calculateStudentCultureCoverage(e.student_id, yearId, semesterId, {
      start_date: semester.start_date,
      end_date: semester.end_date
    });
    var qualityStatus = coverage.completeness_status === 'empty' ? 'no_data' :
      (coverage.completeness_status === 'complete' ? 'sufficient' : 'low_coverage');
    
    var riskStatus = 'NORMAL';
    var riskReasons = [];
    
    var noCharData = !summary || 
                     summary.days_counted === null || 
                     summary.days_counted === undefined || 
                     Number(summary.days_counted) === 0 || 
                     fitrahAverage === null;
    
    if (noCharData) {
      riskReasons.push('NO_CHARACTER_DATA');
    } else if (qualityStatus === 'low_coverage') {
      riskReasons.push('LOW_CULTURE_COVERAGE');
    } else if (fitrahAverage !== null && fitrahAverage < fitrahThreshold) {
      riskReasons.push('FITRAH_BELOW_THRESHOLD');
    }
    
    if (acadAverage !== null && acadAverage < acadThreshold) {
      riskReasons.push('ACADEMIC_BELOW_THRESHOLD');
    }
    
    if (riskReasons.length > 0) {
      if (riskReasons.indexOf('ACADEMIC_BELOW_THRESHOLD') !== -1 || riskReasons.indexOf('FITRAH_BELOW_THRESHOLD') !== -1) {
        riskStatus = 'AT_RISK';
      } else {
        riskStatus = 'NEEDS_DATA';
      }
    }
    
    if (riskStatus !== 'NORMAL') {
      var s = studentMap[e.student_id];
      watchlist.push({
        student_id: e.student_id,
        student_name: s ? s.full_name : 'Unknown Student',
        academic_average: acadAverage,
        fitrah_average: fitrahAverage,
        risk_status: riskStatus,
        risk_reasons: riskReasons,
        quality_status: qualityStatus,
        coverage: coverage
      });
    }
  });
  
  return watchlist;
}
