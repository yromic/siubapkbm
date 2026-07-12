/**
 * Coverage-aware culture completeness helpers.
 * The legacy calculateCultureCompleteness() intentionally remains unchanged for
 * backward compatibility; it means "students with at least one culture day".
 */

var CULTURE_COVERAGE_DEFAULTS = {
  culture_school_days: 'monday,tuesday,wednesday,thursday,friday',
  culture_minimum_coverage_percent: 80,
  culture_warning_coverage_percent: 60
};

function getCultureCoverageSettings() {
  var settings = getAppSettings() || {};
  var schoolDaysRaw = settings.culture_school_days || CULTURE_COVERAGE_DEFAULTS.culture_school_days;
  var validDays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var schoolDays = String(schoolDaysRaw).toLowerCase().split(',').map(function(v) { return v.trim(); }).filter(function(v, i, arr) {
    return validDays.indexOf(v) !== -1 && arr.indexOf(v) === i;
  });
  if (schoolDays.length === 0) schoolDays = CULTURE_COVERAGE_DEFAULTS.culture_school_days.split(',');

  var minimum = Number(settings.culture_minimum_coverage_percent);
  var warning = Number(settings.culture_warning_coverage_percent);
  if (isNaN(minimum) || minimum < 0 || minimum > 100) minimum = CULTURE_COVERAGE_DEFAULTS.culture_minimum_coverage_percent;
  if (isNaN(warning) || warning < 0 || warning > 100 || warning > minimum) warning = CULTURE_COVERAGE_DEFAULTS.culture_warning_coverage_percent;
  return { school_days: schoolDays, minimum_coverage_percent: minimum, warning_coverage_percent: warning };
}

function parseLocalDate(dateStr) {
  var normalized = normalizeDateString(dateStr);
  var parts = normalized.split('-');
  if (parts.length !== 3) throw new Error('Invalid date. Expected YYYY-MM-DD.');
  var result = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  if (isNaN(result.getTime())) throw new Error('Invalid date. Expected YYYY-MM-DD.');
  return result;
}

function getExpectedCultureDates(range) {
  validateRequiredFields(range, ['start_date', 'end_date']);
  var start = parseLocalDate(range.start_date);
  var end = parseLocalDate(range.end_date);
  var now = range.today ? parseLocalDate(range.today) : new Date();
  now = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (end > now) end = now;
  if (end < start) return { expected_dates: [], expected_days: 0 };

  var settings = getCultureCoverageSettings();
  var names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var dates = [];
  for (var cursor = new Date(start.getTime()); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (settings.school_days.indexOf(names[cursor.getDay()]) !== -1) dates.push(formatDateString(cursor));
  }
  return { expected_dates: dates, expected_days: dates.length };
}

function buildCultureCoverage(daysCounted, expectedInfo) {
  var settings = getCultureCoverageSettings();
  var expectedDays = Number(expectedInfo.expected_days) || 0;
  var counted = Math.max(0, Number(daysCounted) || 0);
  if (expectedDays > 0 && counted > expectedDays) counted = expectedDays;
  var percent = expectedDays > 0 ? Number(((counted / expectedDays) * 100).toFixed(2)) : 0;
  var status = 'empty';
  if (counted > 0 && percent >= settings.minimum_coverage_percent) status = 'complete';
  else if (counted > 0 && percent >= settings.warning_coverage_percent) status = 'partial';
  else if (counted > 0) status = 'low';
  return {
    expected_days: expectedDays,
    days_counted: counted,
    missing_days: Math.max(0, expectedDays - counted),
    coverage_percent: percent,
    completeness_status: status
  };
}

function getCultureCoverageNotice(coverage) {
  if (coverage && coverage.completeness_status === 'complete') return null;
  var percent = coverage ? coverage.coverage_percent : 0;
  return "Data budaya pada periode ini baru mencakup " + percent + "% hari input dan belum lengkap. Hasil karakter perlu dibaca sebagai gambaran sementara.";
}

function cultureRowHasData(row) {
  return hasAnyIndicatorDb(row) && row.status === 'active';
}

function calculateStudentCultureCoverage(studentId, yearId, semesterId, range) {
  var effectiveRange = { start_date: range.start_date, end_date: range.end_date, today: range.today };
  var semester = getRecordById(SHEETS.SEMESTERS, semesterId);
  if (semester) {
    if (normalizeDateString(effectiveRange.start_date) < normalizeDateString(semester.start_date)) effectiveRange.start_date = semester.start_date;
    if (normalizeDateString(effectiveRange.end_date) > normalizeDateString(semester.end_date)) effectiveRange.end_date = semester.end_date;
  }
  var expected = getExpectedCultureDates(effectiveRange);
  var expectedMap = {};
  expected.expected_dates.forEach(function(d) { expectedMap[d] = true; });
  var completedMap = {};
  listRecords(SHEETS.CULTURE_SCORES, function(r) {
    return r.student_id === studentId && r.academic_year_id === yearId && r.semester_id === semesterId && cultureRowHasData(r);
  }).forEach(function(r) {
    var date = normalizeDateString(r.score_date);
    if (expectedMap[date]) completedMap[date] = true;
  });
  var coverage = buildCultureCoverage(Object.keys(completedMap).length, expected);
  coverage.missing_dates = expected.expected_dates.filter(function(d) { return !completedMap[d]; }).map(function(d) {
    return { date: d, reason: 'no_culture_score' };
  });
  return coverage;
}

function resolveCulturePeriod(periodMode, semester, nowOverride) {
  var now = nowOverride ? parseLocalDate(nowOverride) : new Date();
  now = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var mode = ['week','month','semester'].indexOf(periodMode) !== -1 ? periodMode : 'semester';
  var start;
  var end = new Date(now.getTime());
  if (mode === 'week') start = parseLocalDate(getWeekRange(formatDateString(now)).start);
  else if (mode === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else {
    start = parseLocalDate(semester.start_date);
    end = parseLocalDate(semester.end_date);
  }
  var semStart = parseLocalDate(semester.start_date);
  var semEnd = parseLocalDate(semester.end_date);
  if (start < semStart) start = semStart;
  if (end > semEnd) end = semEnd;
  if (end > now) end = now;
  return { mode: mode, start_date: formatDateString(start), end_date: formatDateString(end) };
}

function getTeacherCultureCompleteness(payload, actor) {
  var activeYear = getActiveAcademicYear();
  var activeSemester = getActiveSemester(activeYear.id);
  var classId = payload.class_id || '';
  if (!classId && actor.role === ROLES.TEACHER) {
    var assigned = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
      return a.teacher_user_id === actor.id && a.academic_year_id === activeYear.id && a.semester_id === activeSemester.id && a.status === STATUS.ACTIVE;
    });
    if (assigned.length === 0) throw { code: 'ERR_FORBIDDEN', message: 'Anda belum memiliki assignment kelas aktif.' };
    classId = assigned[0].class_id;
  }
  if (!classId) throw { code: 'MISSING_PARAMETER', message: 'class_id is required.' };
  assertCultureReadPermission(actor, classId, activeYear.id, activeSemester.id);

  var period = resolveCulturePeriod(payload.period_mode || 'semester', activeSemester, payload.today);
  var expected = getExpectedCultureDates({ start_date: period.start_date, end_date: period.end_date, today: payload.today });
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId && e.academic_year_id === activeYear.id && e.semester_id === activeSemester.id && e.status === STATUS.ACTIVE;
  });
  var studentMap = {};
  listRecords(SHEETS.STUDENTS).forEach(function(s) { studentMap[s.id] = s; });
  var students = enrollments.map(function(e) {
    var coverage = calculateStudentCultureCoverage(e.student_id, activeYear.id, activeSemester.id, period);
    return {
      student_id: e.student_id,
      student_name: studentMap[e.student_id] ? studentMap[e.student_id].full_name : 'Unknown Student',
      days_counted: coverage.days_counted,
      expected_days: coverage.expected_days,
      missing_days: coverage.missing_days,
      coverage_percent: coverage.coverage_percent,
      completeness_status: coverage.completeness_status,
      missing_dates: coverage.missing_dates
    };
  });
  var counts = { complete: 0, partial: 0, low: 0, empty: 0 };
  var coverageSum = 0;
  students.forEach(function(s) { counts[s.completeness_status]++; coverageSum += s.coverage_percent; });

  var missingDates = expected.expected_dates.map(function(date) {
    var completed = students.filter(function(s) { return !s.missing_dates.some(function(m) { return m.date === date; }); }).length;
    var total = students.length;
    return { date: date, expected_students: total, completed_students: completed, missing_students: total - completed, completion_percent: total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0 };
  }).filter(function(d) { return d.missing_students > 0; });

  return {
    period: period,
    expected_days: expected.expected_days,
    class_summary: {
      total_students: students.length,
      complete_students: counts.complete,
      partial_students: counts.partial,
      low_students: counts.low,
      empty_students: counts.empty,
      average_coverage_percent: students.length > 0 ? Number((coverageSum / students.length).toFixed(2)) : 0
    },
    missing_dates: missingDates,
    students: students
  };
}
