/**
 * CharacterSummaryService.gs
 * Handles summary aggregation and incremental delta updates for student character scores.
 */

/**
 * Updates weekly, monthly, and semester summaries incrementally when a culture score is added or updated.
 * Uses delta calculations for efficiency.
 */
function updateIncrementalSummary(studentId, enrollmentId, classId, yearId, semesterId, scoreDate, oldRow, newRow) {
  var indicators = ['sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
  var dbSuffix = '_score';
  
  var deltaSums = {};
  var deltaCounts = {};
  
  indicators.forEach(function(ind) {
    var oldVal = oldRow ? oldRow[ind + dbSuffix] : null;
    var newVal = newRow ? newRow[ind + dbSuffix] : null;
    
    var oldValNum = (oldVal === undefined || oldVal === null || oldVal === '') ? null : Number(oldVal);
    var newValNum = (newVal === undefined || newVal === null || newVal === '') ? null : Number(newVal);
    
    deltaSums[ind] = (newValNum || 0) - (oldValNum || 0);
    deltaCounts[ind] = (newValNum !== null ? 1 : 0) - (oldValNum !== null ? 1 : 0);
  });
  
  var previouslyHad = hasAnyIndicatorDb(oldRow);
  var currentlyHas = hasAnyIndicatorDb(newRow);
  var deltaDays = 0;
  if (!previouslyHad && currentlyHas) {
    deltaDays = 1;
  } else if (previouslyHad && !currentlyHas) {
    deltaDays = -1;
  }
  
  // 1. Weekly Summary
  var weekRange = getWeekRange(scoreDate);
  var weeklySummary = findOrCreateWeeklySummary(studentId, enrollmentId, yearId, semesterId, weekRange);
  var updatedWeekly = applyDeltasToSummary(weeklySummary, deltaSums, deltaCounts, deltaDays);
  updateRowById(SHEETS.CHARACTER_WEEKLY_SUMMARIES, weeklySummary.id, updatedWeekly);
  
  // 2. Monthly Summary
  var parts = scoreDate.split('-');
  var month = Number(parts[1]); // 1-12
  var year = Number(parts[0]);
  var monthlySummary = findOrCreateMonthlySummary(studentId, enrollmentId, yearId, semesterId, month, year);
  var updatedMonthly = applyDeltasToSummary(monthlySummary, deltaSums, deltaCounts, deltaDays);
  updateRowById(SHEETS.CHARACTER_MONTHLY_SUMMARIES, monthlySummary.id, updatedMonthly);
  
  // 3. Semester Summary
  var semesterSummary = findOrCreateSemesterSummary(studentId, enrollmentId, yearId, semesterId);
  var updatedSemester = applyDeltasToSummary(semesterSummary, deltaSums, deltaCounts, deltaDays);
  updateRowById(SHEETS.CHARACTER_SEMESTER_SUMMARIES, semesterSummary.id, updatedSemester);
}

function hasAnyIndicatorDb(row) {
  if (!row) return false;
  var indicators = ['sss_score', 'am_score', 'hb_score', 'asm_score', 'br_score', 'ak_score', 'tm_score'];
  for (var i = 0; i < indicators.length; i++) {
    var val = row[indicators[i]];
    if (val !== undefined && val !== null && val !== '') {
      return true;
    }
  }
  return false;
}

function applyDeltasToSummary(summaryRow, deltaSums, deltaCounts, deltaDays) {
  var indicators = ['sss', 'am', 'hb', 'asm', 'br', 'ak', 'tm'];
  indicators.forEach(function(ind) {
    var sumField = ind + '_sum';
    var countField = ind + '_count';
    summaryRow[sumField] = (Number(summaryRow[sumField]) || 0) + deltaSums[ind];
    summaryRow[countField] = (Number(summaryRow[countField]) || 0) + deltaCounts[ind];
  });
  summaryRow.days_counted = (Number(summaryRow.days_counted) || 0) + deltaDays;
  if (summaryRow.days_counted < 0) {
    summaryRow.days_counted = 0;
  }
  
  var fitrah = calculateFitrahScores(summaryRow);
  summaryRow.f_score = fitrah.f_score;
  summaryRow.i_score = fitrah.i_score;
  summaryRow.t_score = fitrah.t_score;
  summaryRow.r_score = fitrah.r_score;
  summaryRow.a_score = fitrah.a_score;
  summaryRow.h_score = fitrah.h_score;
  
  return summaryRow;
}

function findOrCreateWeeklySummary(studentId, enrollmentId, yearId, semesterId, weekRange) {
  var records = findRows(SHEETS.CHARACTER_WEEKLY_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           normalizeDateString(r.week_start_date) === normalizeDateString(weekRange.start) &&
           r.student_enrollment_id === enrollmentId;
  });
  if (records.length > 0) {
    return records[0];
  }
  var newRecord = {
    student_id: studentId,
    student_enrollment_id: enrollmentId,
    academic_year_id: yearId,
    semester_id: semesterId,
    week_start_date: weekRange.start,
    week_end_date: weekRange.end,
    f_score: null, i_score: null, t_score: null, r_score: null, a_score: null, h_score: null,
    sss_sum: 0, sss_count: 0,
    am_sum: 0, am_count: 0,
    hb_sum: 0, hb_count: 0,
    asm_sum: 0, asm_count: 0,
    br_sum: 0, br_count: 0,
    ak_sum: 0, ak_count: 0,
    tm_sum: 0, tm_count: 0,
    days_counted: 0
  };
  return createRecord(SHEETS.CHARACTER_WEEKLY_SUMMARIES, newRecord);
}

function findOrCreateMonthlySummary(studentId, enrollmentId, yearId, semesterId, month, year) {
  var records = findRows(SHEETS.CHARACTER_MONTHLY_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           Number(r.month) === Number(month) &&
           Number(r.year) === Number(year) &&
           r.student_enrollment_id === enrollmentId;
  });
  if (records.length > 0) {
    return records[0];
  }
  var newRecord = {
    student_id: studentId,
    student_enrollment_id: enrollmentId,
    academic_year_id: yearId,
    semester_id: semesterId,
    month: Number(month),
    year: Number(year),
    f_score: null, i_score: null, t_score: null, r_score: null, a_score: null, h_score: null,
    sss_sum: 0, sss_count: 0,
    am_sum: 0, am_count: 0,
    hb_sum: 0, hb_count: 0,
    asm_sum: 0, asm_count: 0,
    br_sum: 0, br_count: 0,
    ak_sum: 0, ak_count: 0,
    tm_sum: 0, tm_count: 0,
    days_counted: 0
  };
  return createRecord(SHEETS.CHARACTER_MONTHLY_SUMMARIES, newRecord);
}

function findOrCreateSemesterSummary(studentId, enrollmentId, yearId, semesterId) {
  var records = findRows(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.student_id === studentId &&
           r.academic_year_id === yearId &&
           r.semester_id === semesterId &&
           r.student_enrollment_id === enrollmentId;
  });
  if (records.length > 0) {
    return records[0];
  }
  var newRecord = {
    student_id: studentId,
    student_enrollment_id: enrollmentId,
    academic_year_id: yearId,
    semester_id: semesterId,
    f_score: null, i_score: null, t_score: null, r_score: null, a_score: null, h_score: null,
    sss_sum: 0, sss_count: 0,
    am_sum: 0, am_count: 0,
    hb_sum: 0, hb_count: 0,
    asm_sum: 0, asm_count: 0,
    br_sum: 0, br_count: 0,
    ak_sum: 0, ak_count: 0,
    tm_sum: 0, tm_count: 0,
    days_counted: 0
  };
  return createRecord(SHEETS.CHARACTER_SEMESTER_SUMMARIES, newRecord);
}

/**
 * Endpoint helper to get a student's character summary filtered by period.
 */
function getStudentCharacterSummary(payload, actor) {
  validateRequiredFields(payload, ['student_id', 'academic_year_id', 'semester_id']);
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === payload.student_id &&
           e.academic_year_id === payload.academic_year_id &&
           e.semester_id === payload.semester_id &&
           e.status === 'active';
  });
  if (enrollments.length === 0) {
    throw new Error("No active student enrollment found for the period.");
  }
  var enrollment = enrollments[0];
  
  // Authorization check
  assertCultureReadPermission(actor, enrollment.class_id, payload.academic_year_id, payload.semester_id);
  
  var summaryRecord = null;
  var periodInfo = '';
  var semester = assertRecordExists(SHEETS.SEMESTERS, payload.semester_id);
  var coverageRange = { start_date: semester.start_date, end_date: semester.end_date };
  
  if (payload.week_start_date) {
    var records = listRecords(SHEETS.CHARACTER_WEEKLY_SUMMARIES, function(r) {
      return r.student_id === payload.student_id &&
             normalizeDateString(r.week_start_date) === normalizeDateString(payload.week_start_date);
    });
    summaryRecord = records.length > 0 ? records[0] : null;
    periodInfo = 'Week of ' + payload.week_start_date;
    var requestedWeek = getWeekRange(normalizeDateString(payload.week_start_date));
    coverageRange = { start_date: requestedWeek.start, end_date: requestedWeek.end };
  } else if (payload.month && payload.year) {
    var records = listRecords(SHEETS.CHARACTER_MONTHLY_SUMMARIES, function(r) {
      return r.student_id === payload.student_id &&
             Number(r.month) === Number(payload.month) &&
             Number(r.year) === Number(payload.year);
    });
    summaryRecord = records.length > 0 ? records[0] : null;
    periodInfo = 'Month ' + payload.month + ', ' + payload.year;
    coverageRange = {
      start_date: String(payload.year) + '-' + (Number(payload.month) < 10 ? '0' : '') + Number(payload.month) + '-01',
      end_date: formatDateString(new Date(Number(payload.year), Number(payload.month), 0))
    };
  } else {
    var records = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
      return r.student_id === payload.student_id &&
             r.academic_year_id === payload.academic_year_id &&
             r.semester_id === payload.semester_id;
    });
    summaryRecord = records.length > 0 ? records[0] : null;
    periodInfo = 'Semester Summary';
  }
  
  var coverage = calculateStudentCultureCoverage(payload.student_id, payload.academic_year_id, payload.semester_id, coverageRange);
  if (!summaryRecord) {
    return {
      f: null, i: null, t: null, r: null, a: null, h: null,
      days_counted: 0,
      period_information: periodInfo,
      coverage: coverage
    };
  }
  
  return {
    f: summaryRecord.f_score !== null ? Number(summaryRecord.f_score) : null,
    i: summaryRecord.i_score !== null ? Number(summaryRecord.i_score) : null,
    t: summaryRecord.t_score !== null ? Number(summaryRecord.t_score) : null,
    r: summaryRecord.r_score !== null ? Number(summaryRecord.r_score) : null,
    a: summaryRecord.a_score !== null ? Number(summaryRecord.a_score) : null,
    h: summaryRecord.h_score !== null ? Number(summaryRecord.h_score) : null,
    days_counted: Number(summaryRecord.days_counted) || 0,
    period_information: periodInfo,
    coverage: coverage
  };
}

/**
 * Endpoint helper to get class character summary filtered by period.
 */
function getClassCharacterSummary(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  // Authorization check
  assertCultureReadPermission(actor, payload.class_id, payload.academic_year_id, payload.semester_id);
  
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
  
  var summaries = [];
  var semester = assertRecordExists(SHEETS.SEMESTERS, payload.semester_id);
  var coverageRange = { start_date: semester.start_date, end_date: semester.end_date };
  if (payload.week_start_date) {
    summaries = listRecords(SHEETS.CHARACTER_WEEKLY_SUMMARIES, function(r) {
      return normalizeDateString(r.week_start_date) === normalizeDateString(payload.week_start_date) && studentIds.indexOf(r.student_id) !== -1;
    });
    var requestedWeek = getWeekRange(normalizeDateString(payload.week_start_date));
    coverageRange = { start_date: requestedWeek.start, end_date: requestedWeek.end };
  } else if (payload.month && payload.year) {
    summaries = listRecords(SHEETS.CHARACTER_MONTHLY_SUMMARIES, function(r) {
      return Number(r.month) === Number(payload.month) &&
             Number(r.year) === Number(payload.year) &&
             studentIds.indexOf(r.student_id) !== -1;
    });
    coverageRange = {
      start_date: String(payload.year) + '-' + (Number(payload.month) < 10 ? '0' : '') + Number(payload.month) + '-01',
      end_date: formatDateString(new Date(Number(payload.year), Number(payload.month), 0))
    };
  } else {
    summaries = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
      return r.academic_year_id === payload.academic_year_id &&
             r.semester_id === payload.semester_id &&
             studentIds.indexOf(r.student_id) !== -1;
    });
  }
  
  var summaryMap = {};
  summaries.forEach(function(s) {
    summaryMap[s.student_id] = s;
  });
  
  var list = students.map(function(student) {
    var summary = summaryMap[student.id];
    var coverage = calculateStudentCultureCoverage(student.id, payload.academic_year_id, payload.semester_id, coverageRange);
    return {
      student_id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      f: summary && summary.f_score !== null ? Number(summary.f_score) : null,
      i: summary && summary.i_score !== null ? Number(summary.i_score) : null,
      t: summary && summary.t_score !== null ? Number(summary.t_score) : null,
      r: summary && summary.r_score !== null ? Number(summary.r_score) : null,
      a: summary && summary.a_score !== null ? Number(summary.a_score) : null,
      h: summary && summary.h_score !== null ? Number(summary.h_score) : null,
      days_counted: summary ? Number(summary.days_counted) || 0 : 0,
      coverage: coverage
    };
  });
  
  return list;
}

/**
 * Asserts read permission. Shared logic.
 */
function assertCultureReadPermission(actor, classId, yearId, semesterId) {
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return;
  }
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not authorized to view culture summaries for this class.'
      };
    }
    return;
  }
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: Unauthorized access.'
  };
}
