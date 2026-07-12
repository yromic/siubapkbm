/**
 * ParentPortalService.gs
 * Implements business logic and data aggregation for the secure Parent Portal.
 */

var CHARACTER_MAPPING = {
  'F': { name: 'Fathonah', indicators: ['ASM'] },
  'I': { name: 'Istiqamah', indicators: ['AM'] },
  'T': { name: 'Tanggung Jawab', indicators: ['BR'] },
  'R': { name: 'Ramah', indicators: ['SSS', 'HB'] },
  'A': { name: 'Amanah', indicators: ['AK'] },
  'H': { name: 'Harmonis', indicators: ['TM'] }
};

var VALID_HISTORICAL_STATUSES = ['active', 'promoted', 'repeated', 'graduated', 'transferred'];

function hasStudentPeriodData(studentId, yearId, semesterId) {
  // 1. student_enrollments with valid statuses
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           VALID_HISTORICAL_STATUSES.indexOf(e.status) !== -1;
  });
  if (enrollments.length > 0) return true;
  
  // 2. academic_scores (via academic_assessments)
  var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.academic_year_id === yearId &&
           a.semester_id === semesterId;
  });
  if (assessments.length > 0) {
    var assessmentIds = assessments.map(function(a) { return a.id; });
    var scores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
      return s.student_id === studentId &&
             s.status === STATUS.ACTIVE &&
             assessmentIds.indexOf(s.assessment_id) !== -1;
    });
    if (scores.length > 0) return true;
  }
  
  // 3. culture_scores
  var cultureScores = listRecords(SHEETS.CULTURE_SCORES, function(cs) {
    return cs.student_id === studentId &&
           cs.academic_year_id === yearId &&
           cs.semester_id === semesterId &&
           cs.status === STATUS.ACTIVE;
  });
  if (cultureScores.length > 0) return true;
  
  // 4. character summaries
  var charSem = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           r.academic_year_id === yearId &&
           r.semester_id === semesterId;
  });
  if (charSem.length > 0) return true;
  
  var charMon = listRecords(SHEETS.CHARACTER_MONTHLY_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           r.academic_year_id === yearId &&
           r.semester_id === semesterId;
  });
  if (charMon.length > 0) return true;
  
  // 5. report snapshots
  var snapshots = listRecords(SHEETS.REPORT_SNAPSHOTS, function(r) {
    return r.student_id === studentId &&
           r.academic_year_id === yearId &&
           r.semester_id === semesterId;
  });
  if (snapshots.length > 0) return true;
  
  return false;
}

function validateParentPeriodAccess(studentId, yearId, semesterId) {
  if (!hasStudentPeriodData(studentId, yearId, semesterId)) {
    throw {
      code: 'ERR_PARENT_PERIOD_NOT_AVAILABLE',
      message: 'Periode tidak tersedia untuk siswa ini.'
    };
  }
}

function resolveParentPeriod(payload, studentId) {
  var activeYear = getActiveAcademicYear();
  var activeSem = getActiveSemester(activeYear.id);
  
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  var isCurrent = true;
  var selectedYear = activeYear;
  var selectedSem = activeSem;
  
  if (yearId || semesterId) {
    if (!yearId || !semesterId) {
      throw {
        code: 'ERR_PARENT_PERIOD_NOT_AVAILABLE',
        message: 'Kedua parameter tahun ajaran dan semester harus diisi jika salah satunya diisi.'
      };
    }
    
    validateParentPeriodAccess(studentId, yearId, semesterId);
    
    selectedYear = getRecordById(SHEETS.ACADEMIC_YEARS, yearId);
    selectedSem = getRecordById(SHEETS.SEMESTERS, semesterId);
    
    if (!selectedYear || !selectedSem) {
      throw {
        code: 'ERR_PARENT_PERIOD_NOT_AVAILABLE',
        message: 'Tahun ajaran atau semester tidak ditemukan.'
      };
    }
    
    if (selectedSem.academic_year_id !== selectedYear.id) {
      throw {
        code: 'ERR_ACTIVE_PERIOD_MISMATCH',
        message: 'Semester tidak sesuai dengan tahun ajaran yang dipilih.'
      };
    }
    
    isCurrent = (yearId === activeYear.id && semesterId === activeSem.id);
  }
  
  return {
    year: selectedYear,
    semester: selectedSem,
    is_current_period: isCurrent,
    selected_period: {
      academic_year_id: selectedYear.id,
      academic_year_name: selectedYear.name,
      semester_id: selectedSem.id,
      semester_name: selectedSem.name
    }
  };
}

function parentGetAvailablePeriods(payload) {
  var token = payload.parent_access_token || '';
  var session = requireParentSession(token);
  var studentId = session.student_id;
  
  var activeYear = getActiveAcademicYear();
  var activeSem = getActiveSemester(activeYear.id);
  
  var semesters = listRecords(SHEETS.SEMESTERS);
  var academicYears = listRecords(SHEETS.ACADEMIC_YEARS);
  
  var yearMap = {};
  academicYears.forEach(function(y) {
    yearMap[y.id] = y;
  });
  
  var available = [];
  semesters.forEach(function(sem) {
    var year = yearMap[sem.academic_year_id];
    if (year) {
      if (hasStudentPeriodData(studentId, year.id, sem.id)) {
        available.push({
          academic_year_id: year.id,
          academic_year_name: year.name,
          semester_id: sem.id,
          semester_name: sem.name,
          is_current_period: (year.id === activeYear.id && sem.id === activeSem.id),
          start_date: sem.start_date || ''
        });
      }
    }
  });
  
  available.sort(function(a, b) {
    return String(b.start_date).localeCompare(String(a.start_date));
  });
  
  return available.map(function(item) {
    return {
      academic_year_id: item.academic_year_id,
      academic_year_name: item.academic_year_name,
      semester_id: item.semester_id,
      semester_name: item.semester_name,
      is_current_period: item.is_current_period
    };
  });
}

/**
 * Helper to log parent access attempts to parent_access_logs.
 * @param {string} studentId
 * @param {string} success - 'success', 'failed', or 'locked'
 * @param {string} [action] - 'LOGIN_SUCCESS', 'LOGIN_FAILED', or 'LOGOUT'
 * @param {Object} [requestMeta]
 */
function logParentAccess(studentId, success, action, requestMeta) {
  // Handle fallback for legacy code calls: logParentAccess(studentId, status, requestMeta)
  if (typeof action === 'object' && !requestMeta) {
    requestMeta = action;
    action = success === 'success' ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED';
  }
  
  var logRecord = {
    student_id: studentId || '',
    action: action || '',
    success: success || '',
    ip_address: requestMeta ? (requestMeta.ip_address || '') : '',
    user_agent: requestMeta ? (requestMeta.user_agent || '') : '',
    attempted_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
  };
  appendRow(SHEETS.PARENT_ACCESS_LOGS, logRecord);
}

/**
 * Helper to normalize date strings to YYYY-MM-DD format.
 */
function normalizeDateString(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0];
  }
  return String(dateVal);
}

/**
 * Endpoint: parent_login
 * @param {Object} payload
 * @param {Object} requestMeta
 * @returns {Object} Token and basic student details
 */
function parentLogin(payload, requestMeta) {
  if (!payload.nisn || !payload.birth_date || !payload.pin) {
    logParentAccess('', 'failed', 'LOGIN_FAILED', requestMeta);
    throw {
      code: 'ERR_PARENT_VERIFICATION_FAILED',
      message: 'Data akses tidak valid.'
    };
  }
  
  var nisnInput = String(payload.nisn).trim();
  var birthInput = normalizeDateString(payload.birth_date);
  
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return String(s.nisn).trim() === nisnInput && normalizeDateString(s.birth_date) === birthInput;
  });
  
  if (students.length === 0) {
    logParentAccess('', 'failed', 'LOGIN_FAILED', requestMeta);
    throw {
      code: 'ERR_PARENT_VERIFICATION_FAILED',
      message: 'Data akses tidak valid.'
    };
  }
  
  var student = students[0];
  
  // Check lockout status
  if (isParentAccessLocked(student)) {
    logParentAccess(student.id, 'locked', 'LOGIN_FAILED', requestMeta);
    throw {
      code: 'LOCKED',
      locked_until: student.parent_access_pin_locked_until,
      message: 'Terlalu banyak percobaan masuk. Akun dikunci demi keamanan.'
    };
  }
  
  // Verify PIN (passing student.id for auto-upgrade if legacy hash)
  if (verifyParentPin(payload.pin, student.parent_access_pin_hash, student.id)) {
    // Reset failed attempts
    var patch = {
      parent_access_pin_failed_attempts: 0,
      parent_access_pin_locked_until: ''
    };
    updateRecord(SHEETS.STUDENTS, student.id, patch);
    
    // Log success login
    logParentAccess(student.id, 'success', 'LOGIN_SUCCESS', requestMeta);
    
    // Generate token
    var token = generateParentToken();
    saveParentToken(token, student.id, student.nisn);
    
    return {
      parent_access_token: token,
      student: {
        full_name: student.full_name,
        nisn: student.nisn
      }
    };
  } else {
    // PIN incorrect: increment attempts
    var failedAttempts = (Number(student.parent_access_pin_failed_attempts) || 0) + 1;
    var patch = {
      parent_access_pin_failed_attempts: failedAttempts
    };
    
    var status = 'failed';
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      patch.parent_access_pin_locked_until = new Date(new Date().getTime() + LOCKOUT_DURATION_MS).toISOString();
      status = 'locked';
    }
    
    updateRecord(SHEETS.STUDENTS, student.id, patch);
    
    // Log failure
    logParentAccess(student.id, status, 'LOGIN_FAILED', requestMeta);
    
    if (status === 'locked') {
      throw {
        code: 'LOCKED',
        locked_until: patch.parent_access_pin_locked_until,
        message: 'Terlalu banyak percobaan masuk. Akun dikunci demi keamanan.'
      };
    }
    
    throw {
      code: 'ERR_PARENT_VERIFICATION_FAILED',
      message: 'Data akses tidak valid.'
    };
  }
}

/**
 * Endpoint: parent_verify_access
 * Wrapper for backward compatibility.
 */
function parentVerifyAccess(payload, requestMeta) {
  return parentLogin(payload, requestMeta);
}

/**
 * Endpoint: parent_logout
 * Idempotent logout handler for parents.
 * @param {Object} payload
 * @param {Object} requestMeta
 * @returns {Object} Success object
 */
function parentLogout(payload, requestMeta) {
  var token = payload.parent_access_token || '';
  var studentId = '';
  
  if (token) {
    try {
      var session = requireParentSession(token);
      studentId = session.student_id;
    } catch (e) {
      try {
        studentId = validateParentToken(token);
      } catch (e2) {}
    }
    
    var cache = CacheService.getScriptCache();
    cache.remove(token);
    
    // Log logout action
    logParentAccess(studentId, 'success', 'LOGOUT', requestMeta);
  }
  
  return { success: true };
}

/**
 * Endpoint: parent_me
 * Retrieves current parent profile details (whitelist only).
 * @param {Object} payload
 * @returns {Object} Safe student profile
 */
function parentMe(payload) {
  var token = payload.parent_access_token || '';
  var session = requireParentSession(token);
  var studentId = session.student_id;
  
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Siswa tidak ditemukan.'
    };
  }
  
  var resolved = resolveParentPeriod(payload, studentId);
  var targetYear = resolved.year;
  var targetSem = resolved.semester;
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === targetYear.id &&
           e.semester_id === targetSem.id &&
           VALID_HISTORICAL_STATUSES.indexOf(e.status) !== -1;
  });
  
  var profile = {
    full_name: student.full_name,
    nisn: student.nisn
  };
  
  if (enrollments.length > 0) {
    var classObj = getRecordById(SHEETS.CLASSES, enrollments[0].class_id);
    if (classObj) {
      profile.class_name = classObj.name;
    }
  }
  
  profile.academic_year_name = targetYear.name;
  profile.semester_name = targetSem.name;
  profile.selected_period = resolved.selected_period;
  profile.is_current_period = resolved.is_current_period;
  
  return profile;
}

/**
 * Endpoint: parent_get_dashboard
 * @param {Object} payload
 * @returns {Object} Dashboard aggregate data
 */
function parentGetDashboard(payload) {
  var token = payload.parent_access_token || '';
  var session = requireParentSession(token);
  var studentId = session.student_id;
  
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Siswa tidak ditemukan.'
    };
  }
  
  var resolved = resolveParentPeriod(payload, studentId);
  var targetYear = resolved.year;
  var targetSem = resolved.semester;
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === targetYear.id &&
           e.semester_id === targetSem.id &&
           VALID_HISTORICAL_STATUSES.indexOf(e.status) !== -1;
  });
  
  var className = null;
  if (enrollments.length > 0) {
    var classObj = getRecordById(SHEETS.CLASSES, enrollments[0].class_id);
    if (classObj) {
      className = classObj.name;
    }
  }
  
  var studentData = {
    full_name: student.full_name,
    nisn: student.nisn,
    class_name: className,
    academic_year_name: targetYear ? targetYear.name : null,
    semester_name: targetSem ? targetSem.name : null
  };
  
  var academicSummary = {
    average_score: null,
    completed_assessments: 0,
    total_assessments: 0,
    latest_assessment_date: null
  };
  
  if (enrollments.length > 0) {
    var classId = enrollments[0].class_id;
    var classAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
      return a.class_id === classId &&
             a.academic_year_id === targetYear.id &&
             a.semester_id === targetSem.id &&
             (a.status === STATUS.PUBLISHED || a.status === STATUS.LOCKED);
    });
    
    var assessmentIds = classAssessments.map(function(a) { return a.id; });
    var studentScores = [];
    if (assessmentIds.length > 0) {
      studentScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
        return s.student_id === studentId &&
               s.status === STATUS.ACTIVE &&
               assessmentIds.indexOf(s.assessment_id) !== -1;
      });
    }
    
    var scoreMap = {};
    studentScores.forEach(function(s) {
      if (s.score !== null && s.score !== undefined && s.score !== '') {
        scoreMap[s.assessment_id] = Number(s.score);
      }
    });
    
    var scoreSum = 0;
    var scoreCount = 0;
    var latestDate = null;
    
    classAssessments.forEach(function(a) {
      var scoreVal = scoreMap[a.id];
      if (scoreVal !== undefined && scoreVal !== null) {
        scoreSum += scoreVal;
        scoreCount++;
        
        if (a.assessment_date) {
          var dateStr = normalizeDateString(a.assessment_date);
          if (!latestDate || dateStr > latestDate) {
            latestDate = dateStr;
          }
        }
      }
    });
    
    academicSummary.total_assessments = classAssessments.length;
    academicSummary.completed_assessments = scoreCount;
    academicSummary.average_score = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : null;
    academicSummary.latest_assessment_date = latestDate;
  }
  
  var charRecords = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           r.academic_year_id === targetYear.id &&
           r.semester_id === targetSem.id;
  });
  
  var characterSummary = {
    f: null,
    i: null,
    t: null,
    r: null,
    a: null,
    h: null,
    overall_average: null,
    days_counted: 0,
    period_label: (targetSem ? targetSem.name : '') + " " + (targetYear ? targetYear.name : ''),
    coverage: calculateStudentCultureCoverage(studentId, targetYear.id, targetSem.id, {
      start_date: targetSem.start_date,
      end_date: targetSem.end_date
    })
  };
  
  if (charRecords.length > 0) {
    var rec = charRecords[0];
    characterSummary.f = (rec.f_score !== null && rec.f_score !== undefined && rec.f_score !== '') ? Number(rec.f_score) : null;
    characterSummary.i = (rec.i_score !== null && rec.i_score !== undefined && rec.i_score !== '') ? Number(rec.i_score) : null;
    characterSummary.t = (rec.t_score !== null && rec.t_score !== undefined && rec.t_score !== '') ? Number(rec.t_score) : null;
    characterSummary.r = (rec.r_score !== null && rec.r_score !== undefined && rec.r_score !== '') ? Number(rec.r_score) : null;
    characterSummary.a = (rec.a_score !== null && rec.a_score !== undefined && rec.a_score !== '') ? Number(rec.a_score) : null;
    characterSummary.h = (rec.h_score !== null && rec.h_score !== undefined && rec.h_score !== '') ? Number(rec.h_score) : null;
    characterSummary.days_counted = (rec.days_counted !== null && rec.days_counted !== undefined && rec.days_counted !== '') ? Number(rec.days_counted) : 0;
    
    var fitrahVals = [
      characterSummary.f,
      characterSummary.i,
      characterSummary.t,
      characterSummary.r,
      characterSummary.a,
      characterSummary.h
    ].filter(function(v) {
      return v !== null && v !== undefined;
    });
    
    if (fitrahVals.length > 0) {
      var sum = fitrahVals.reduce(function(acc, val) { return acc + val; }, 0);
      characterSummary.overall_average = Number((sum / fitrahVals.length).toFixed(2));
    }
  }
  
  return {
    student: studentData,
    academic_summary: academicSummary,
    character_summary: characterSummary,
    selected_period: resolved.selected_period,
    is_current_period: resolved.is_current_period
  };
}

/**
 * Endpoint: parent_get_academic_summary
 * @param {Object} payload
 * @returns {Object} Academic summary details
 */
function getParentAcademicSummaryData(studentId, yearId, semesterId) {
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           VALID_HISTORICAL_STATUSES.indexOf(e.status) !== -1;
  });
  if (enrollments.length === 0) {
    throw new Error("No student enrollment found for the specified period.");
  }
  var enrollment = enrollments[0];
  var classId = enrollment.class_id;
  
  var classAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.class_id === classId &&
           a.academic_year_id === yearId &&
           a.semester_id === semesterId &&
           (a.status === STATUS.PUBLISHED || a.status === STATUS.LOCKED);
  });
  
  var assessmentIds = classAssessments.map(function(a) { return a.id; });
  var studentScores = [];
  if (assessmentIds.length > 0) {
    studentScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
      return s.student_id === studentId &&
             s.status === STATUS.ACTIVE &&
             assessmentIds.indexOf(s.assessment_id) !== -1;
    });
  }
  
  var scoreMap = {};
  studentScores.forEach(function(s) {
    scoreMap[s.assessment_id] = s;
  });
  
  var subjects = listRecords(SHEETS.SUBJECTS);
  var subjectMap = {};
  subjects.forEach(function(subj) {
    subjectMap[subj.id] = subj;
  });
  
  var subjectSummaries = {};
  var totalScoreSum = 0;
  var totalScoreCount = 0;
  
  classAssessments.forEach(function(a) {
    var subjId = a.subject_id;
    var subj = subjectMap[subjId];
    var subjName = subj ? subj.name : 'Unknown Subject';
    
    var subjCode = subj ? subj.code : '';
    
    if (!subjectSummaries[subjId]) {
      subjectSummaries[subjId] = {
        subject_code: subjCode,
        subject_name: subjName,
        sum: 0,
        count: 0,
        average: null,
        assessment_count: 0
      };
    }
    
    subjectSummaries[subjId].assessment_count++;
    
    var scoreRec = scoreMap[a.id];
    var scoreVal = (scoreRec && scoreRec.score !== null && scoreRec.score !== '') ? Number(scoreRec.score) : null;
    
    if (scoreVal !== null) {
      subjectSummaries[subjId].sum += scoreVal;
      subjectSummaries[subjId].count += 1;
      
      totalScoreSum += scoreVal;
      totalScoreCount += 1;
    }
  });
  
  var subjectList = [];
  for (var key in subjectSummaries) {
    var summ = subjectSummaries[key];
    if (summ.count > 0) {
      summ.average = Number((summ.sum / summ.count).toFixed(2));
    }
    subjectList.push({
      subject_code: summ.subject_code,
      subject_name: summ.subject_name,
      average_score: summ.average,
      assessment_count: summ.assessment_count
    });
  }
  
  var totalAverage = totalScoreCount > 0 ? Number((totalScoreSum / totalScoreCount).toFixed(2)) : null;
  
  return {
    subject_averages: subjectList,
    overall_average: totalAverage,
    total_assessments: classAssessments.length,
    completed_assessments: totalScoreCount
  };
}

function parentGetAcademicSummary(payload) {
  var studentId = validateParentToken(payload.parent_access_token);
  
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Siswa tidak ditemukan.'
    };
  }
  
  var resolved = resolveParentPeriod(payload, studentId);
  var targetYear = resolved.year;
  var targetSem = resolved.semester;
  
  var data = getParentAcademicSummaryData(studentId, targetYear.id, targetSem.id);
  
  return {
    student: {
      full_name: student.full_name,
      nisn: student.nisn
    },
    period: {
      academic_year_name: targetYear.name,
      semester_name: targetSem.name
    },
    subject_averages: data.subject_averages,
    overall_average: data.overall_average,
    total_assessments: data.total_assessments,
    completed_assessments: data.completed_assessments,
    selected_period: resolved.selected_period,
    is_current_period: resolved.is_current_period
  };
}

/**
 * Endpoint: parent_get_character_summary
 * @param {Object} payload
 * @returns {Object} Nested Phase 5C response contract
 */
function parentGetCharacterSummary(payload) {
  var token = payload.parent_access_token || '';
  var session = requireParentSession(token);
  var studentId = session.student_id;

  var periodMode = payload.period_mode || 'semester';

  // Extract current month/year for normalization
  var now = new Date();
  var curMonth = now.getMonth() + 1; // 1-12
  var curYear = now.getFullYear();

  var requestedYear = payload.year !== undefined ? Number(payload.year) : curYear;
  var requestedMonth = payload.month !== undefined ? Number(payload.month) : curMonth;

  if (isNaN(requestedYear)) requestedYear = curYear;
  if (isNaN(requestedMonth)) requestedMonth = curMonth;

  // Normalize future month/year requests to the current month/year
  if (requestedYear > curYear || (requestedYear === curYear && requestedMonth > curMonth)) {
    requestedYear = curYear;
    requestedMonth = curMonth;
  }

  var latest = null;
  var periodLabel = '';
  
  var resolved = resolveParentPeriod(payload, studentId);
  var targetYear = resolved.year;
  var targetSem = resolved.semester;

  if (periodMode === 'month') {
    var monthlySums = listRecords(SHEETS.CHARACTER_MONTHLY_SUMMARIES, function(r) {
      return r.student_id === studentId &&
             Number(r.year) === requestedYear &&
             Number(r.month) === requestedMonth;
    });
    latest = monthlySums.length > 0 ? monthlySums[0] : null;
    
    var INDO_MONTHS = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    periodLabel = (INDO_MONTHS[requestedMonth] || '') + " " + requestedYear;
  } else {
    periodMode = 'semester'; // Enforce semester as fallback
    if (targetYear && targetSem) {
      var semesterSums = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
        return r.student_id === studentId &&
               r.academic_year_id === targetYear.id &&
               r.semester_id === targetSem.id;
      });
      latest = semesterSums.length > 0 ? semesterSums[0] : null;
      periodLabel = (targetSem.name || '') + " " + (targetYear.name || '');
    } else {
      periodLabel = 'Semester';
    }
  }

  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Siswa tidak ditemukan.'
    };
  }

  var className = null;
  if (targetYear && targetSem) {
    var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
      return e.student_id === studentId &&
             e.academic_year_id === targetYear.id &&
             e.semester_id === targetSem.id &&
             VALID_HISTORICAL_STATUSES.indexOf(e.status) !== -1;
    });
    if (enrollments.length > 0) {
      var classObj = getRecordById(SHEETS.CLASSES, enrollments[0].class_id);
      if (classObj) {
        className = classObj.name;
      }
    }
  }

  var f = (latest && latest.f_score !== null && latest.f_score !== undefined && latest.f_score !== '') ? Number(latest.f_score) : null;
  var i = (latest && latest.i_score !== null && latest.i_score !== undefined && latest.i_score !== '') ? Number(latest.i_score) : null;
  var t = (latest && latest.t_score !== null && latest.t_score !== undefined && latest.t_score !== '') ? Number(latest.t_score) : null;
  var r = (latest && latest.r_score !== null && latest.r_score !== undefined && latest.r_score !== '') ? Number(latest.r_score) : null;
  var a = (latest && latest.a_score !== null && latest.a_score !== undefined && latest.a_score !== '') ? Number(latest.a_score) : null;
  var h = (latest && latest.h_score !== null && latest.h_score !== undefined && latest.h_score !== '') ? Number(latest.h_score) : null;
  var daysCounted = latest ? (Number(latest.days_counted) || 0) : 0;
  var coverageRange;
  if (periodMode === 'month') {
    coverageRange = {
      start_date: requestedYear + '-' + (requestedMonth < 10 ? '0' : '') + requestedMonth + '-01',
      end_date: formatDateString(new Date(requestedYear, requestedMonth, 0))
    };
  } else {
    coverageRange = { start_date: targetSem.start_date, end_date: targetSem.end_date };
  }
  var coverage = calculateStudentCultureCoverage(studentId, targetYear.id, targetSem.id, coverageRange);

  var fitrahVals = [f, i, t, r, a, h].filter(function(v) { return v !== null && v !== undefined; });
  var overall_average = fitrahVals.length > 0 ? Number((fitrahVals.reduce(function(acc, val) { return acc + val; }, 0) / fitrahVals.length).toFixed(2)) : null;

  var PARENT_EXPLANATIONS = {
    f: "Kemampuan bernalar, belajar, dan memahami hal baik.",
    i: "Konsistensi dalam kebiasaan baik dan tanggung jawab sehari-hari.",
    t: "Kedisiplinan dan kesungguhan dalam menjalankan tugas.",
    r: "Sikap santun, hormat, dan kepedulian dalam berinteraksi.",
    a: "Kejujuran dan kemampuan menjaga kepercayaan.",
    h: "Kemampuan bekerja sama dan menjaga hubungan baik dengan orang lain."
  };

  var charValues = listRecords(SHEETS.CHARACTER_VALUES) || [];
  var systemDescMap = {};
  charValues.forEach(function(cv) {
    if (cv.code) {
      systemDescMap[cv.code.toLowerCase()] = cv.description || '';
    }
  });

  // Deterministic tie-breaking using F-I-T-R-A-H order
  var fitrahKeys = ['f', 'i', 't', 'r', 'a', 'h'];
  var fitrahNames = {
    f: 'Fathonah',
    i: 'Istiqamah',
    t: 'Tanggung Jawab',
    r: 'Ramah',
    a: 'Amanah',
    h: 'Harmonis'
  };

  var strongest = null;
  var strengthening = null;
  var scores = { f: f, i: i, t: t, r: r, a: a, h: h };

  fitrahKeys.forEach(function(key) {
    var score = scores[key];
    if (score !== null && score !== undefined) {
      if (strongest === null || score > strongest.score) {
        strongest = { key: key, name: fitrahNames[key], score: score };
      }
      if (strengthening === null || score < strengthening.score) {
        strengthening = { key: key, name: fitrahNames[key], score: score };
      }
    }
  });

  var completenessNotice = getCultureCoverageNotice(coverage);

  var result = {
    student: {
      full_name: student.full_name,
      nisn: student.nisn,
      class_name: className,
      academic_year_name: targetYear ? targetYear.name : null,
      semester_name: targetSem ? targetSem.name : null
    },
    period: {
      mode: periodMode,
      label: periodLabel,
      days_counted: daysCounted,
      coverage: coverage
    },
    fitrah: {
      f: f,
      i: i,
      t: t,
      r: r,
      a: a,
      h: h,
      overall_average: overall_average
    },
    dimensions: [
      {
        key: 'f',
        name: 'Fathonah',
        score: f,
        description: systemDescMap['f'] || '',
        parent_explanation: PARENT_EXPLANATIONS.f
      },
      {
        key: 'i',
        name: 'Istiqamah',
        score: i,
        description: systemDescMap['i'] || '',
        parent_explanation: PARENT_EXPLANATIONS.i
      },
      {
        key: 't',
        name: 'Tanggung Jawab',
        score: t,
        description: systemDescMap['t'] || '',
        parent_explanation: PARENT_EXPLANATIONS.t
      },
      {
        key: 'r',
        name: 'Ramah',
        score: r,
        description: systemDescMap['r'] || '',
        parent_explanation: PARENT_EXPLANATIONS.r
      },
      {
        key: 'a',
        name: 'Amanah',
        score: a,
        description: systemDescMap['a'] || '',
        parent_explanation: PARENT_EXPLANATIONS.a
      },
      {
        key: 'h',
        name: 'Harmonis',
        score: h,
        description: systemDescMap['h'] || '',
        parent_explanation: PARENT_EXPLANATIONS.h
      }
    ],
    interpretation: {
      strongest_dimension: strongest,
      strengthening_area: strengthening,
      completeness_notice: completenessNotice
    },
    selected_period: resolved.selected_period,
    is_current_period: resolved.is_current_period
  };

  result.coverage = coverage;

  return result;
}

/**
 * Endpoint: parent_get_character_detail
 * @param {Object} payload
 * @returns {Object} Character indicators mapping
 */
function parentGetCharacterDetail(payload) {
  var session = requireParentSession(payload.parent_access_token || '');
  var studentId = session.student_id;
  
  var charCode = payload.character_code;
  if (!charCode) {
    throw new Error("character_code is required.");
  }
  
  var mapped = CHARACTER_MAPPING[charCode];
  if (!mapped) {
    throw new Error("Invalid character_code: " + charCode);
  }
  
  var resolved = resolveParentPeriod(payload, studentId);
  var targetYear = resolved.year;
  var targetSem = resolved.semester;
  
  var coverage = calculateStudentCultureCoverage(studentId, targetYear.id, targetSem.id, {
    start_date: targetSem.start_date,
    end_date: targetSem.end_date
  });
  
  return {
    character_code: charCode,
    character_name: mapped.name,
    source_indicators: mapped.indicators,
    coverage: coverage,
    selected_period: resolved.selected_period,
    is_current_period: resolved.is_current_period
  };
}

/**
 * Endpoint: parent_get_academic_detail
 * @param {Object} payload
 * @returns {Object} Safe academic details and assessments for the requested subject
 */
function parentGetAcademicDetail(payload) {
  var token = payload.parent_access_token || '';
  var session = requireParentSession(token);
  var studentId = session.student_id;
  
  var subjectCodeInput = String(payload.subject_code || '').trim();
  
  var resolved = resolveParentPeriod(payload, studentId);
  var targetYear = resolved.year;
  var targetSem = resolved.semester;
  
  // Find enrollment
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === targetYear.id &&
           e.semester_id === targetSem.id &&
           VALID_HISTORICAL_STATUSES.indexOf(e.status) !== -1;
  });
  
  if (enrollments.length === 0) {
    return {
      subject_code: subjectCodeInput,
      subject_name: null,
      assessments: [],
      selected_period: resolved.selected_period,
      is_current_period: resolved.is_current_period
    };
  }
  
  var classId = enrollments[0].class_id;
  
  // Get all subjects
  var allSubjects = listRecords(SHEETS.SUBJECTS, function(s) {
    return s.status === STATUS.ACTIVE;
  });
  
  // Filter class subjects
  var classSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
    return cs.class_id === classId &&
           cs.academic_year_id === targetYear.id &&
           cs.semester_id === targetSem.id &&
           cs.status === STATUS.ACTIVE;
  });
  
  var classSubjectIds = classSubjects.map(function(cs) { return cs.subject_id; });
  
  // Find target subject matching code (case-insensitive)
  var targetSubject = null;
  for (var i = 0; i < allSubjects.length; i++) {
    var s = allSubjects[i];
    if (String(s.code).toLowerCase() === subjectCodeInput.toLowerCase() && classSubjectIds.indexOf(s.id) !== -1) {
      targetSubject = s;
      break;
    }
  }
  
  if (!targetSubject) {
    return {
      subject_code: subjectCodeInput,
      subject_name: null,
      assessments: [],
      selected_period: resolved.selected_period,
      is_current_period: resolved.is_current_period
    };
  }
  
  var subjectId = targetSubject.id;
  var canonicalSubjectCode = targetSubject.code;
  var subjectName = targetSubject.name;
  
  // Get assessments for class, subject, active year/sem, and published or locked status
  var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.class_id === classId &&
           a.subject_id === subjectId &&
           a.academic_year_id === targetYear.id &&
           a.semester_id === targetSem.id &&
           (a.status === STATUS.PUBLISHED || a.status === STATUS.LOCKED);
  });
  
  var assessmentIds = assessments.map(function(a) { return a.id; });
  
  var scoresMap = {};
  if (assessmentIds.length > 0) {
    var studentScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
      return s.student_id === studentId &&
             s.status === STATUS.ACTIVE &&
             assessmentIds.indexOf(s.assessment_id) !== -1;
    });
    studentScores.forEach(function(s) {
      scoresMap[s.assessment_id] = s.score;
    });
  }
  
  // Map to whitelisted response contract
  var mappedAssessments = assessments.map(function(a) {
    var rawScore = scoresMap[a.id];
    var scoreVal = null;
    if (rawScore !== undefined && rawScore !== null && rawScore !== '') {
      scoreVal = Number(rawScore);
    }
    
    return {
      assessment_title: a.title,
      assessment_date: normalizeDateString(a.assessment_date),
      score_min: Number(a.score_min),
      score_max: Number(a.score_max),
      score: scoreVal,
      assessment_status: a.status
    };
  });
  
  return {
    subject_code: canonicalSubjectCode,
    subject_name: subjectName,
    assessments: mappedAssessments,
    selected_period: resolved.selected_period,
    is_current_period: resolved.is_current_period
  };
}
