/** Coverage-aware culture completeness QA. Run separately in Apps Script. */
function test_runCultureCompletenessHardeningQA() {
  console.log('STARTING CULTURE COMPLETENESS HARDENING QA');
  setupDatabase();
  seedInitialData();
  var suffix = String(Math.floor(Math.random() * 100000));
  var admin = getUserByIdentifier(DEFAULT_ADMIN.username);

  updateSingleSetting('culture_school_days', 'monday,tuesday,wednesday,thursday,friday', admin);
  updateSingleSetting('culture_minimum_coverage_percent', '80', admin);
  updateSingleSetting('culture_warning_coverage_percent', '60', admin);

  var expected = getExpectedCultureDates({ start_date: '2026-06-01', end_date: '2026-06-07', today: '2026-06-05' });
  cultureCoverageAssert(expected.expected_days === 5, 'Expected Monday-Friday and future exclusion to produce 5 days.');
  cultureCoverageAssert(expected.expected_dates[0] === '2026-06-01' && expected.expected_dates[4] === '2026-06-05', 'Expected date list is incorrect.');
  cultureCoverageAssert(buildCultureCoverage(5, expected).completeness_status === 'complete', '5/5 must be complete.');
  cultureCoverageAssert(buildCultureCoverage(3, expected).completeness_status === 'partial', '3/5 must be partial at 60% warning threshold.');
  cultureCoverageAssert(buildCultureCoverage(2, expected).completeness_status === 'low', '2/5 must be low.');
  cultureCoverageAssert(buildCultureCoverage(0, expected).completeness_status === 'empty', '0/5 must be empty.');
  var zeroExpected = buildCultureCoverage(0, { expected_days: 0, expected_dates: [] });
  cultureCoverageAssert(zeroExpected.coverage_percent === 0 && zeroExpected.completeness_status === 'empty', 'Zero expected days fallback must be safe.');

  var year = createRecord(SHEETS.ACADEMIC_YEARS, { name: 'Coverage AY ' + suffix, start_date: '2026-01-01', end_date: '2026-12-31', is_active: true }, admin);
  var semester = createRecord(SHEETS.SEMESTERS, { academic_year_id: year.id, name: 'Coverage Semester', start_date: '2026-06-01', end_date: '2026-06-30', is_active: true }, admin);
  updateSingleSetting('active_academic_year_id', year.id, admin);
  updateSingleSetting('active_semester_id', semester.id, admin);
  var cls = createRecord(SHEETS.CLASSES, { code: 'COV_' + suffix, name: 'Coverage Class', level: '6', status: STATUS.ACTIVE }, admin);
  var otherClass = createRecord(SHEETS.CLASSES, { code: 'COV_OTHER_' + suffix, name: 'Other Coverage Class', level: '6', status: STATUS.ACTIVE }, admin);
  var teacher = createRecord(SHEETS.USERS, { name: 'Coverage Teacher', email: 'coverage_' + suffix + '@example.com', username: 'coverage_' + suffix, password_hash: hashPassword('Password123!'), role: ROLES.TEACHER, status: STATUS.ACTIVE }, admin);
  var otherTeacher = createRecord(SHEETS.USERS, { name: 'Other Teacher', email: 'coverage_other_' + suffix + '@example.com', username: 'coverage_other_' + suffix, password_hash: hashPassword('Password123!'), role: ROLES.TEACHER, status: STATUS.ACTIVE }, admin);
  createRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, { class_id: cls.id, teacher_user_id: teacher.id, academic_year_id: year.id, semester_id: semester.id, effective_from: '2026-06-01', effective_until: '', status: STATUS.ACTIVE }, admin);
  createRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, { class_id: otherClass.id, teacher_user_id: otherTeacher.id, academic_year_id: year.id, semester_id: semester.id, effective_from: '2026-06-01', effective_until: '', status: STATUS.ACTIVE }, admin);

  var student1 = createRecord(SHEETS.STUDENTS, { nisn: 'COV1' + suffix, full_name: 'Coverage Student One', birth_date: '2014-01-01', gender: 'L', status: STATUS.ACTIVE }, admin);
  var student2 = createRecord(SHEETS.STUDENTS, { nisn: 'COV2' + suffix, full_name: 'Coverage Student Two', birth_date: '2014-01-02', gender: 'P', status: STATUS.ACTIVE }, admin);
  var enrollment1 = createRecord(SHEETS.STUDENT_ENROLLMENTS, { student_id: student1.id, class_id: cls.id, academic_year_id: year.id, semester_id: semester.id, status: STATUS.ACTIVE }, admin);
  createRecord(SHEETS.STUDENT_ENROLLMENTS, { student_id: student2.id, class_id: cls.id, academic_year_id: year.id, semester_id: semester.id, status: STATUS.ACTIVE }, admin);
  ['2026-06-01','2026-06-02','2026-06-03'].forEach(function(date) {
    createRecord(SHEETS.CULTURE_SCORES, { student_id: student1.id, student_enrollment_id: enrollment1.id, class_id: cls.id, teacher_user_id: teacher.id, academic_year_id: year.id, semester_id: semester.id, score_date: date, sss_score: 3, status: STATUS.ACTIVE }, admin);
  });

  var studentCoverage = calculateStudentCultureCoverage(student1.id, year.id, semester.id, { start_date: '2026-06-01', end_date: '2026-06-05', today: '2026-06-05' });
  cultureCoverageAssert(studentCoverage.missing_dates.length === 2 && studentCoverage.missing_dates[0].reason === 'no_culture_score', 'Student missing dates were not detected.');

  var teacherResult = getTeacherCultureCompleteness({ period_mode: 'month', class_id: cls.id, today: '2026-06-05' }, teacher);
  cultureCoverageAssert(teacherResult.expected_days === 5, 'Teacher endpoint expected days mismatch.');
  cultureCoverageAssert(teacherResult.class_summary.total_students === 2 && teacherResult.class_summary.partial_students === 1 && teacherResult.class_summary.empty_students === 1, 'Teacher class summary mismatch.');
  cultureCoverageAssert(teacherResult.missing_dates.length === 5 && teacherResult.missing_dates[0].expected_students === 2, 'Class-level missing dates were not detected.');
  cultureCoverageAssert(teacherResult.students[0].coverage_percent === 60, 'Teacher student coverage mismatch.');
  cultureCoverageAssert(getTeacherCultureCompleteness({ period_mode: 'week', class_id: cls.id, today: '2026-06-05' }, admin).class_summary.total_students === 2, 'Admin access failed.');

  var forbidden = false;
  try { getTeacherCultureCompleteness({ period_mode: 'week', class_id: cls.id, today: '2026-06-05' }, otherTeacher); } catch (err) { forbidden = err && err.code === 'ERR_FORBIDDEN'; }
  cultureCoverageAssert(forbidden, 'Teacher accessed a class outside the active assignment.');
  cultureCoverageAssert(getCultureCoverageNotice(studentCoverage).indexOf('60%') !== -1 && getCultureCoverageNotice(studentCoverage).indexOf('gambaran sementara') !== -1, 'Parent warning is not coverage-aware.');

  createRecord(SHEETS.CHARACTER_SEMESTER_SUMMARIES, { student_id: student1.id, student_enrollment_id: enrollment1.id, academic_year_id: year.id, semester_id: semester.id, f_score: 2, i_score: 2, t_score: 2, r_score: 2, a_score: 2, h_score: 2, days_counted: 3 }, admin);
  var character = getStudentCharacterSummary({ student_id: student1.id, academic_year_id: year.id, semester_id: semester.id }, admin);
  cultureCoverageAssert(character.days_counted === 3 && character.f === 2 && character.coverage !== undefined, 'Character summary backward-compatible fields or additive coverage missing.');
  var watchlist = get_student_watchlist({ academic_year_id: year.id, semester_id: semester.id }, admin);
  var watchItem = watchlist.filter(function(item) { return item.student_id === student1.id; })[0];
  cultureCoverageAssert(watchItem && watchItem.quality_status === 'low_coverage' && watchItem.risk_status === 'NEEDS_DATA', 'Watchlist quality guard failed.');

  console.log('CULTURE COMPLETENESS HARDENING QA PASSED');
}

function cultureCoverageAssert(condition, message) {
  if (!condition) throw new Error(message);
}
