/**
 * ParentPortalTests.gs
 * QA and verification suite for Sprint 8.
 * Implements thorough validation of the parent portal backend.
 */
var sprint8AdminToken = '';

function test_runSprint8QA() {
  console.log(" STARTING SPRINT 8 QA TEST SUITE ");

  ensureSprint8QaBaseline();
  runSprint1RegressionForSprint8();
  runSprint2RegressionForSprint8();
  runSprint3RegressionForSprint8();

  var suffix = createSprint8QaRunSuffix();
  var ctx = setupSprint8TestContext(suffix);

  runSprint4RegressionForSprint8(ctx);
  runSprint5RegressionForSprint8(ctx);
  runSprint6RegressionForSprint8(ctx);
  runSprint7RegressionForSprint8(ctx);

  console.log("Running Sprint 8 parent portal tests...");

  // 1. Verify Access Validation
  test_parentVerifyAccess(ctx, suffix);
  console.log("Parent verification validation successful.");

  // 2. Lockout Validation
  test_parentLockout(ctx, suffix);
  console.log("Parent lockout validation successful.");

  // 3. Token Validation
  test_parentToken(ctx);
  console.log("Parent token validation successful.");

  // 4. Dashboard Validation
  test_parentDashboard(ctx);
  console.log("Parent dashboard validation successful.");

  // 5. Academic Summary Validation
  test_parentAcademicSummary(ctx);
  console.log("Parent academic summary validation successful.");

  // 5b. Phase 5D-0A Security and Contract Validation
  test_parentAcademicSecurityAndContract_5D_0A(ctx);
  console.log("Phase 5D-0A parent academic security and contract validation successful.");

  // 6. Character Summary Validation
  test_parentCharacterSummary(ctx);
  console.log("Parent character summary validation successful.");

  // 7. Character Detail Validation
  test_parentCharacterDetail(ctx);
  console.log("Parent character detail validation successful.");

  // 8. Access Logging Validation
  test_parentAccessLogging(ctx);
  console.log("Parent access logging validation successful.");

  // 9. Phase 5D-1 Academic Detail Validation
  test_parentAcademicDetail_5D_1(ctx);
  console.log("Parent academic detail 5D-1 validation successful.");

  console.log(" SPRINT 8 QA TEST SUITE PASSED ");
}

function ensureSprint8QaBaseline() {
  setupDatabase();
  seedInitialData();
}

function createSprint8QaRunSuffix() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function runSprint1RegressionForSprint8() {
  console.log("Running Sprint 1 regression...");

  var admin = getSprint8QaAdmin();
  resetFailedLogin(admin);

  assertSprint8RouteSuccess('health_check', {}, "Sprint 1 health_check regression failed.");
  var loginResult = assertSprint8RouteSuccess('login', {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Sprint8-QA-Regression'
  }, "Sprint 1 admin login regression failed.");

  sprint8AdminToken = loginResult.data.token;

  console.log("Sprint 1 regression passed.");
}

function runSprint2RegressionForSprint8() {
  console.log("Running Sprint 2 regression...");

  var admin = getSprint8QaAdmin();
  var actorPayload = { actor_user_id: admin.id };

  assertSprint8RouteSuccess('list_academic_years', actorPayload, "Sprint 2 list_academic_years regression failed.");
  assertSprint8RouteSuccess('list_classes', actorPayload, "Sprint 2 list_classes regression failed.");
  assertSprint8RouteSuccess('list_subjects', actorPayload, "Sprint 2 list_subjects regression failed.");
  assertSprint8RouteSuccess('get_app_settings', actorPayload, "Sprint 2 get_app_settings regression failed.");

  console.log("Sprint 2 regression passed.");
}

function runSprint3RegressionForSprint8() {
  console.log("Running Sprint 3 regression...");

  var admin = getSprint8QaAdmin();
  var actorPayload = { actor_user_id: admin.id };

  assertSprint8RouteSuccess('list_students', actorPayload, "Sprint 3 list_students regression failed.");
  assertSprint8RouteSuccess('list_student_enrollments', actorPayload, "Sprint 3 list_student_enrollments regression failed.");

  console.log("Sprint 3 regression passed.");
}

function runSprint4RegressionForSprint8(ctx) {
  console.log("Running Sprint 4 regression...");

  assertSprint8RouteSuccess('list_academic_assessments', {
    actor_user_id: ctx.admin.id,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  }, "Sprint 4 list_academic_assessments regression failed.");

  assertSprint8RouteSuccess('get_student_academic_summary', {
    actor_user_id: ctx.admin.id,
    student_id: ctx.studentId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  }, "Sprint 4 get_student_academic_summary regression failed.");

  console.log("Sprint 4 regression passed.");
}

function runSprint5RegressionForSprint8(ctx) {
  console.log("Running Sprint 5 regression...");

  assertSprint8RouteSuccess('get_class_character_summary', {
    actor_user_id: ctx.admin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    week_start_date: '2026-06-15'
  }, "Sprint 5 get_class_character_summary regression failed.");

  console.log("Sprint 5 regression passed.");
}

function runSprint6RegressionForSprint8(ctx) {
  console.log("Running Sprint 6 regression...");

  assertSprint8RouteSuccess('get_school_dashboard', {
    actor_user_id: ctx.admin.id
  }, "Sprint 6 get_school_dashboard regression failed.");

  console.log("Sprint 6 regression passed.");
}

function runSprint7RegressionForSprint8(ctx) {
  console.log("Running Sprint 7 regression...");

  assertSprint8RouteSuccess('setup_storage_folders', {
    actor_user_id: ctx.admin.id
  }, "Sprint 7 setup_storage_folders regression failed.");

  assertSprint8RouteSuccess('list_student_files', {
    actor_user_id: ctx.admin.id,
    student_id: ctx.studentId
  }, "Sprint 7 list_student_files regression failed.");

  console.log("Sprint 7 regression passed.");
}

function getSprint8QaAdmin() {
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Default admin user not found. Ensure database is setup and seeded.");
  }
  return admin;
}

function assertSprint8RouteSuccess(action, payload, errorMessage) {
  var requestObj = {
    action: action,
    payload: payload || {}
  };
  if (sprint8AdminToken) {
    requestObj.token = sprint8AdminToken;
  }
  var result = JSON.parse(route(requestObj).getContent());

  if (result.status !== 'success') {
    throw new Error(errorMessage + " Response: " + JSON.stringify(result));
  }

  return result;
}

/**
 * Setup data dependencies for Sprint 8 test runs.
 */
function setupSprint8TestContext(suffix) {
  var admin = getUserByIdentifier('admin');

  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;

  if (!activeYearId || !activeSemId) {
    var yearRes = JSON.parse(route({
      action: 'create_academic_year',
      payload: { actor_user_id: admin.id, name: "AY_S8_" + suffix, start_date: "2026-07-01", end_date: "2027-06-30" },
      token: sprint8AdminToken
    }).getContent());
    activeYearId = yearRes.data.id;
    route({ action: 'set_active_academic_year', payload: { actor_user_id: admin.id, id: activeYearId }, token: sprint8AdminToken });

    var semRes = JSON.parse(route({
      action: 'create_semester',
      payload: { actor_user_id: admin.id, academic_year_id: activeYearId, name: "Ganjil", start_date: "2026-07-01", end_date: "2026-12-31" },
      token: sprint8AdminToken
    }).getContent());
    activeSemId = semRes.data.id;
    route({ action: 'set_active_semester', payload: { actor_user_id: admin.id, id: activeSemId }, token: sprint8AdminToken });
  }

  // Create Student
  var pinVal = "4321";
  var nisn = createSprint8QaNisn();
  var studentRes = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: nisn,
      nik: "9876543210987654",
      full_name: "Siswa S8 Test " + suffix,
      birth_place: "Bandung",
      birth_date: "2015-05-15",
      gender: "L",
      status: "Aktif",
      parent_access_pin: pinVal
    },
    token: sprint8AdminToken
  }).getContent());
  var studentId = studentRes.data.id;

  // Create Class
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: { actor_user_id: admin.id, code: 'CLS_S8_' + suffix, name: 'Kelas S8 ' + suffix, level: '5' },
    token: sprint8AdminToken
  }).getContent());
  var classId = classRes.data.id;

  // Enroll Student
  route({
    action: 'create_student_enrollment',
    payload: { actor_user_id: admin.id, student_id: studentId, class_id: classId, academic_year_id: activeYearId, semester_id: activeSemId, status: 'active' },
    token: sprint8AdminToken
  });

  return {
    admin: admin,
    studentId: studentId,
    classId: classId,
    nisn: nisn,
    birthDate: "2015-05-15",
    pin: pinVal,
    yearId: activeYearId,
    semesterId: activeSemId
  };
}

function createSprint8QaNisn() {
  var nisn;
  var exists = true;

  while (exists) {
    nisn = String(Math.floor(6000000000 + Math.random() * 1000000000));
    exists = listRecords(SHEETS.STUDENTS, function(student) {
      return String(student.nisn) === nisn;
    }).length > 0;
  }

  return nisn;
}

/**
 * 1. Test parent verification success and failure
 */
function test_parentVerifyAccess(ctx, suffix) {
  // PIN salah -> gagal
  var failRes = JSON.parse(route({
    action: 'parent_verify_access',
    payload: {
      nisn: ctx.nisn,
      birth_date: ctx.birthDate,
      pin: "9999" // wrong pin
    }
  }).getContent());
  
  if (failRes.status !== 'error' || failRes.message !== "Data akses tidak valid.") {
    throw new Error("Failed verification did not return the exact generic error message.");
  }
  
  // Verify failed attempts count
  var studentRow = getRecordById(SHEETS.STUDENTS, ctx.studentId);
  if (Number(studentRow.parent_access_pin_failed_attempts) !== 1) {
    throw new Error("Failed attempts count did not increment. Got: " + studentRow.parent_access_pin_failed_attempts);
  }
  
  // PIN benar -> sukses
  var successRes = JSON.parse(route({
    action: 'parent_verify_access',
    payload: {
      nisn: ctx.nisn,
      birth_date: ctx.birthDate,
      pin: ctx.pin
    }
  }).getContent());
  
  if (successRes.status !== 'success' || !successRes.data.parent_access_token) {
    throw new Error("Successful parent verification failed: " + JSON.stringify(successRes));
  }
  
  // Verify token format
  var token = successRes.data.parent_access_token;
  if (token.length !== 64) {
    throw new Error("Token length must be 64 characters.");
  }
  
  // Verify attempts reset
  var studentRow2 = getRecordById(SHEETS.STUDENTS, ctx.studentId);
  if (Number(studentRow2.parent_access_pin_failed_attempts) !== 0) {
    throw new Error("Failed attempts count was not reset to 0 after success login.");
  }
  
  ctx.token = token;
}

/**
 * 2. Test lockout mechanism
 */
function test_parentLockout(ctx, suffix) {
  // Reset student attempts manually for fresh test
  var patch = {
    parent_access_pin_failed_attempts: 0,
    parent_access_pin_locked_until: ''
  };
  updateRecord(SHEETS.STUDENTS, ctx.studentId, patch);
  
  // Perform 5 failed attempts
  for (var i = 1; i <= 5; i++) {
    var res = JSON.parse(route({
      action: 'parent_verify_access',
      payload: {
        nisn: ctx.nisn,
        birth_date: ctx.birthDate,
        pin: "9999"
      }
    }).getContent());
    
    if (res.status !== 'error') {
      throw new Error("Failed attempt " + i + " succeeded unexpectedly.");
    }
  }
  
  // Check lockout values in sheet
  var student = getRecordById(SHEETS.STUDENTS, ctx.studentId);
  if (Number(student.parent_access_pin_failed_attempts) < 5 || !student.parent_access_pin_locked_until) {
    throw new Error("Lockout was not activated after 5 failed attempts.");
  }
  
  // Try 6th attempt (even with correct PIN) -> must be rejected
  var lockedRes = JSON.parse(route({
    action: 'parent_verify_access',
    payload: {
      nisn: ctx.nisn,
      birth_date: ctx.birthDate,
      pin: ctx.pin // Correct PIN but locked
    }
  }).getContent());
  
  if (lockedRes.status !== 'error' || lockedRes.message !== "Terlalu banyak percobaan masuk. Akun dikunci demi keamanan.") {
    throw new Error("Lockout was not enforced or incorrect error message returned. Got: " + JSON.stringify(lockedRes));
  }
  
  // Clean up lockout for subsequent tests
  updateRecord(SHEETS.STUDENTS, ctx.studentId, {
    parent_access_pin_failed_attempts: 0,
    parent_access_pin_locked_until: ''
  });
}

/**
 * 3. Test token access validations
 */
function test_parentToken(ctx) {
  // Access with random token -> must fail
  var randomRes = JSON.parse(route({
    action: 'parent_get_dashboard',
    payload: {
      parent_access_token: "invalid_random_token_12345"
    }
  }).getContent());
  
  if (randomRes.status !== 'error' || randomRes.code !== 'ERR_UNAUTHORIZED') {
    throw new Error("Unauthorized token was allowed to access dashboard.");
  }
}

/**
 * 4. Test dashboard values and sensitive fields stripping
 */
function test_parentDashboard(ctx) {
  var res = JSON.parse(route({
    action: 'parent_get_dashboard',
    payload: {
      parent_access_token: ctx.token
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to retrieve parent dashboard: " + res.message);
  }
  
  var data = res.data;
  
  // 1. Strict Root Keys Check
  var expectedRootKeys = ['student', 'academic_summary', 'character_summary', 'selected_period', 'is_current_period'];
  var actualRootKeys = Object.keys(data);
  if (actualRootKeys.length !== expectedRootKeys.length) {
    throw new Error("Response has incorrect number of root keys. Expected " + expectedRootKeys.join(', ') + ", got keys: " + actualRootKeys.join(', '));
  }
  expectedRootKeys.forEach(function(key) {
    if (data[key] === undefined) {
      throw new Error("Missing key '" + key + "' in parent dashboard response.");
    }
  });
  
  // 2. Strict Student Keys Whitelist Check
  var expectedStudentKeys = ['full_name', 'nisn', 'class_name', 'academic_year_name', 'semester_name'];
  var actualStudentKeys = Object.keys(data.student);
  if (actualStudentKeys.length !== expectedStudentKeys.length) {
    throw new Error("Student object has incorrect number of keys. Expected: " + expectedStudentKeys.join(', ') + ". Got keys: " + actualStudentKeys.join(', '));
  }
  expectedStudentKeys.forEach(function(key) {
    if (data.student[key] === undefined) {
      throw new Error("Missing student key: " + key);
    }
  });
  
  // 3. Strict Academic Summary Keys Whitelist Check
  var expectedAcademicKeys = ['average_score', 'completed_assessments', 'total_assessments', 'latest_assessment_date'];
  var actualAcademicKeys = Object.keys(data.academic_summary);
  if (actualAcademicKeys.length !== expectedAcademicKeys.length) {
    throw new Error("academic_summary has incorrect number of keys. Expected: " + expectedAcademicKeys.join(', ') + ". Got keys: " + actualAcademicKeys.join(', '));
  }
  expectedAcademicKeys.forEach(function(key) {
    if (data.academic_summary[key] === undefined) {
      throw new Error("Missing academic_summary key: " + key);
    }
  });
  
  // 4. Strict Character Summary Keys Whitelist Check
  var expectedCharacterKeys = ['f', 'i', 't', 'r', 'a', 'h', 'overall_average', 'days_counted', 'period_label', 'coverage'];
  var actualCharacterKeys = Object.keys(data.character_summary);
  if (actualCharacterKeys.length !== expectedCharacterKeys.length) {
    throw new Error("character_summary has incorrect number of keys. Expected: " + expectedCharacterKeys.join(', ') + ". Got keys: " + actualCharacterKeys.join(', '));
  }
  expectedCharacterKeys.forEach(function(key) {
    if (data.character_summary[key] === undefined) {
      throw new Error("Missing character_summary key: " + key);
    }
  });
}

/**
 * 5. Test academic summary
 */
function test_parentAcademicSummary(ctx) {
  var res = JSON.parse(route({
    action: 'parent_get_academic_summary',
    payload: {
      parent_access_token: ctx.token
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to retrieve parent academic summary.");
  }
  
  var data = res.data;
  if (data.ranking !== undefined || data.percentile !== undefined || data.comparison !== undefined) {
    throw new Error("Security breach: Ranking or percentile details leaked in parent academic summary.");
  }
  
  if (data.subject_averages && Array.isArray(data.subject_averages)) {
    data.subject_averages.forEach(function(sa) {
      if (!sa.subject_code || typeof sa.subject_code !== 'string') {
        throw new Error("Expected sa.subject_code to be a non-empty string, got: " + JSON.stringify(sa));
      }
      if (sa.subject_id !== undefined) {
        throw new Error("Security leak: subject_id found in parent academic summary averages!");
      }
    });
  }
}

/**
 * 6. Test character summary
 */
/**
 * 6. Test character summary
 */
function test_parentCharacterSummary(ctx) {
  // 1. Fetch Semester Mode
  var res = JSON.parse(route({
    action: 'parent_get_character_summary',
    payload: {
      parent_access_token: ctx.token,
      period_mode: 'semester'
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to retrieve parent character summary for semester: " + res.message);
  }
  
  var data = res.data;
  
  // Exact Root Keys validation
  var expectedRootKeys = ['student', 'period', 'fitrah', 'dimensions', 'interpretation', 'coverage', 'selected_period', 'is_current_period'];
  var actualRootKeys = Object.keys(data);
  if (actualRootKeys.length !== expectedRootKeys.length) {
    throw new Error("Root keys mismatch. Expected: " + expectedRootKeys.join(', ') + ", Got: " + actualRootKeys.join(', '));
  }
  expectedRootKeys.forEach(function(key) {
    if (data[key] === undefined) throw new Error("Missing root key: " + key);
  });

  // Student keys validation
  var expectedStudentKeys = ['full_name', 'nisn', 'class_name', 'academic_year_name', 'semester_name'];
  var actualStudentKeys = Object.keys(data.student);
  if (actualStudentKeys.length !== expectedStudentKeys.length) {
    throw new Error("Student keys mismatch. Expected: " + expectedStudentKeys.join(', ') + ", Got: " + actualStudentKeys.join(', '));
  }
  expectedStudentKeys.forEach(function(key) {
    if (data.student[key] === undefined) throw new Error("Missing student key: " + key);
  });

  // Period keys validation
  var expectedPeriodKeys = ['mode', 'label', 'days_counted', 'coverage'];
  var actualPeriodKeys = Object.keys(data.period);
  if (actualPeriodKeys.length !== expectedPeriodKeys.length) {
    throw new Error("Period keys mismatch. Expected: " + expectedPeriodKeys.join(', ') + ", Got: " + actualPeriodKeys.join(', '));
  }
  expectedPeriodKeys.forEach(function(key) {
    if (data.period[key] === undefined) throw new Error("Missing period key: " + key);
  });

  // Fitrah keys validation
  var expectedFitrahKeys = ['f', 'i', 't', 'r', 'a', 'h', 'overall_average'];
  var actualFitrahKeys = Object.keys(data.fitrah);
  if (actualFitrahKeys.length !== expectedFitrahKeys.length) {
    throw new Error("Fitrah keys mismatch. Expected: " + expectedFitrahKeys.join(', ') + ", Got: " + actualFitrahKeys.join(', '));
  }
  expectedFitrahKeys.forEach(function(key) {
    if (data.fitrah[key] === undefined) throw new Error("Missing fitrah key: " + key);
  });

  // Dimensions validation
  if (!Array.isArray(data.dimensions) || data.dimensions.length !== 6) {
    throw new Error("Dimensions must be an array of size 6. Got: " + JSON.stringify(data.dimensions));
  }
  var expectedDimKeys = ['key', 'name', 'score', 'description', 'parent_explanation'];
  data.dimensions.forEach(function(dim) {
    var actualDimKeys = Object.keys(dim);
    if (actualDimKeys.length !== expectedDimKeys.length) {
      throw new Error("Dimension item keys mismatch. Expected: " + expectedDimKeys.join(', ') + ", Got: " + actualDimKeys.join(', '));
    }
    expectedDimKeys.forEach(function(key) {
      if (dim[key] === undefined) throw new Error("Missing dimension item key: " + key);
    });
  });

  // Interpretation validation
  var expectedInterKeys = ['strongest_dimension', 'strengthening_area', 'completeness_notice'];
  var actualInterKeys = Object.keys(data.interpretation);
  if (actualInterKeys.length !== expectedInterKeys.length) {
    throw new Error("Interpretation keys mismatch. Expected: " + expectedInterKeys.join(', ') + ", Got: " + actualInterKeys.join(', '));
  }
  expectedInterKeys.forEach(function(key) {
    if (data.interpretation[key] === undefined) throw new Error("Missing interpretation key: " + key);
  });

  // 2. Future Period Normalization Test
  var futureYear = new Date().getFullYear() + 2;
  var futureRes = JSON.parse(route({
    action: 'parent_get_character_summary',
    payload: {
      parent_access_token: ctx.token,
      period_mode: 'month',
      month: 12,
      year: futureYear
    }
  }).getContent());
  
  if (futureRes.status !== 'success') {
    throw new Error("Future month/year query failed: " + futureRes.message);
  }
  var curYear = new Date().getFullYear();
  var curMonth = new Date().getMonth() + 1;
  var INDO_MONTHS = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var expectedLabel = INDO_MONTHS[curMonth] + " " + curYear;
  if (futureRes.data.period.label !== expectedLabel) {
    throw new Error("Future period was not normalized to current month/year. Got label: " + futureRes.data.period.label + ", Expected: " + expectedLabel);
  }

  // 3. QA for Valid Month with No Summary Data
  var emptyRes = JSON.parse(route({
    action: 'parent_get_character_summary',
    payload: {
      parent_access_token: ctx.token,
      period_mode: 'month',
      month: 1,
      year: 2026
    }
  }).getContent());
  
  if (emptyRes.status !== 'success') {
    throw new Error("Valid month query with no data failed: " + emptyRes.message);
  }
  var emptyData = emptyRes.data;
  if (emptyData.period.days_counted !== 0) {
    throw new Error("Expected 0 days counted for empty month. Got: " + emptyData.period.days_counted);
  }
  if (emptyData.fitrah.overall_average !== null) {
    throw new Error("Expected overall_average to be null for empty month. Got: " + emptyData.fitrah.overall_average);
  }
  if (emptyData.interpretation.strongest_dimension !== null || emptyData.interpretation.strengthening_area !== null) {
    throw new Error("Expected strongest_dimension and strengthening_area to be null for empty month.");
  }
  if (!emptyData.interpretation.completeness_notice || emptyData.interpretation.completeness_notice.indexOf('gambaran sementara') === -1) {
    throw new Error("Coverage-aware completeness notice missing for 0 days counted. Got: " + emptyData.interpretation.completeness_notice);
  }
}

/**
 * 7. Test character indicator detail mappings
 */
function test_parentCharacterDetail(ctx) {
  // Test Ramah (R) -> SSS + HB
  var resR = JSON.parse(route({
    action: 'parent_get_character_detail',
    payload: {
      parent_access_token: ctx.token,
      character_code: 'R'
    }
  }).getContent());
  
  if (resR.status !== 'success') {
    throw new Error("Failed to retrieve character detail mapping for code R.");
  }
  
  var dataR = resR.data;
  if (dataR.source_indicators.indexOf('SSS') === -1 || dataR.source_indicators.indexOf('HB') === -1) {
    throw new Error("Invalid indicator mapping for Ramah. Got: " + JSON.stringify(dataR.source_indicators));
  }
  
  // Test Fathonah (F) -> ASM
  var resF = JSON.parse(route({
    action: 'parent_get_character_detail',
    payload: {
      parent_access_token: ctx.token,
      character_code: 'F'
    }
  }).getContent());
  
  var dataF = resF.data;
  if (dataF.source_indicators.indexOf('ASM') === -1) {
    throw new Error("Invalid indicator mapping for Fathonah. Got: " + JSON.stringify(dataF.source_indicators));
  }
}

/**
 * 8. Verify access logging
 */
function test_parentAccessLogging(ctx) {
  var logs = listRecords(SHEETS.PARENT_ACCESS_LOGS, function(log) {
    return log.student_id === ctx.studentId;
  });
  
  var hasSuccess = logs.some(function(l) { return l.success === 'success'; });
  var hasFailed = logs.some(function(l) { return l.success === 'failed'; });
  var hasLocked = logs.some(function(l) { return l.success === 'locked'; });
  
  if (!hasSuccess || !hasFailed || !hasLocked) {
    throw new Error("Parent access logging verification failed. Missing log categories. Got: " + JSON.stringify(logs));
  }
}

/**
 * Phase 5D-0A Security and Contract Validation Test
 */
function test_parentAcademicSecurityAndContract_5D_0A(ctx) {
  var admin = getSprint8QaAdmin();
  
  var subjects = listSubjects();
  if (subjects.length === 0) {
    throw new Error("No subjects found for test.");
  }
  var subjectId = subjects[0].id;
  
  route({
    action: 'assign_subject_to_class',
    payload: {
      actor_user_id: admin.id,
      class_id: ctx.classId,
      subject_id: subjectId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      status: 'active'
    },
    token: sprint8AdminToken
  });
  
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === ctx.studentId && e.status === 'active';
  });
  if (enrollments.length === 0) {
    throw new Error("No enrollment found for student.");
  }
  var studentEnrollmentId = enrollments[0].id;
  
  var draftAssessment = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      class_id: ctx.classId,
      subject_id: subjectId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      title: "Draft Test Assessment 5D-0A",
      description: "Should not be visible to parents",
      assessment_date: "2026-06-20",
      score_min: 0,
      score_max: 100
    },
    token: sprint8AdminToken
  }).getContent()).data;
  
  var pubAssessment = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      class_id: ctx.classId,
      subject_id: subjectId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      title: "Published Test Assessment 5D-0A",
      description: "Should be visible to parents",
      assessment_date: "2026-06-20",
      score_min: 0,
      score_max: 100
    },
    token: sprint8AdminToken
  }).getContent()).data;
  
  route({
    action: 'publish_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      id: pubAssessment.id
    },
    token: sprint8AdminToken
  });
  
  route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: admin.id,
      assessment_id: pubAssessment.id,
      scores: [
        { student_id: ctx.studentId, student_enrollment_id: studentEnrollmentId, score: 90, note: "Good work" }
      ]
    },
    token: sprint8AdminToken
  });
  
  var saveDraftErr = false;
  try {
    route({
      action: 'save_academic_scores',
      payload: {
        actor_user_id: admin.id,
        assessment_id: draftAssessment.id,
        scores: [
          { student_id: ctx.studentId, score: 85, note: "Draft work" }
        ]
      },
      token: sprint8AdminToken
    });
  } catch (e) {
    saveDraftErr = true;
  }
  
  var res = JSON.parse(route({
    action: 'parent_get_academic_summary',
    payload: {
      parent_access_token: ctx.token
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to retrieve academic summary: " + res.message);
  }
  
  var data = res.data;
  
  if (data.total_assessments !== 1) {
    throw new Error("Draft assessment was counted in total_assessments! Expected 1, got " + data.total_assessments);
  }
  if (data.completed_assessments !== 1) {
    throw new Error("Draft assessment was counted in completed_assessments! Expected 1, got " + data.completed_assessments);
  }
  if (data.overall_average !== 90) {
    throw new Error("Overall average calculation includes draft score! Expected 90, got " + data.overall_average);
  }
  
  data.subject_averages.forEach(function(sa) {
    if (sa.subject_id !== undefined) {
      throw new Error("Security leak: subject_id found in parent academic summary averages!");
    }
    if (!sa.subject_code || typeof sa.subject_code !== 'string') {
      throw new Error("Expected sa.subject_code to be a non-empty string, got: " + JSON.stringify(sa));
    }
  });
  
  if (data.assessment_averages !== undefined) {
    throw new Error("Contract violation: assessment_averages leaked in parent academic summary!");
  }
  if (data.student.student_id !== undefined || data.student.id !== undefined) {
    throw new Error("Security leak: student_id / id found in parent info!");
  }
}

/**
 * Phase 5D-1 Academic Detail Endpoint Validation Test
 */
function test_parentAcademicDetail_5D_1(ctx) {
  var admin = getSprint8QaAdmin();
  
  // 1. Setup subject in class
  var subjects = listSubjects();
  if (subjects.length === 0) {
    throw new Error("No subjects found for test.");
  }
  
  // Create a specific subject code "MTK" to be sure it matches contract example
  var subjectMTK = listRecords(SHEETS.SUBJECTS, function(s) {
    return s.code === 'MTK';
  })[0];
  if (!subjectMTK) {
    subjectMTK = JSON.parse(route({
      action: 'create_subject',
      payload: { actor_user_id: admin.id, code: 'MTK', name: 'Matematika', status: 'active' },
      token: sprint8AdminToken
    }).getContent()).data;
  }
  
  // Assign MTK to class if not assigned
  var classSubjs = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
    return cs.class_id === ctx.classId && cs.subject_id === subjectMTK.id && cs.status === 'active';
  });
  if (classSubjs.length === 0) {
    route({
      action: 'assign_subject_to_class',
      payload: {
        actor_user_id: admin.id,
        class_id: ctx.classId,
        subject_id: subjectMTK.id,
        academic_year_id: ctx.yearId,
        semester_id: ctx.semesterId,
        status: 'active'
      },
      token: sprint8AdminToken
    });
  }
  
  // Find enrollment id
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === ctx.studentId && e.status === 'active';
  });
  var studentEnrollmentId = enrollments[0].id;
  
  // Create draft assessment for MTK
  var draftMTK = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      class_id: ctx.classId,
      subject_id: subjectMTK.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      title: "Draft Ujian MTK",
      description: "Draft",
      assessment_date: "2026-06-15",
      score_min: 0,
      score_max: 100
    },
    token: sprint8AdminToken
  }).getContent()).data;
  
  // Create published assessment for MTK
  var publishedMTK = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      class_id: ctx.classId,
      subject_id: subjectMTK.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      title: "Published Ujian MTK",
      description: "Published",
      assessment_date: "2026-06-16",
      score_min: 0,
      score_max: 100
    },
    token: sprint8AdminToken
  }).getContent()).data;
  route({
    action: 'publish_academic_assessment',
    payload: { actor_user_id: admin.id, id: publishedMTK.id },
    token: sprint8AdminToken
  });
  
  // Save score for published assessment
  route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: admin.id,
      assessment_id: publishedMTK.id,
      scores: [
        { student_id: ctx.studentId, student_enrollment_id: studentEnrollmentId, score: 85, note: "Keep it up!" }
      ]
    },
    token: sprint8AdminToken
  });
  
  // Create locked assessment for MTK (no score saved to test score = null)
  var lockedMTK = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      class_id: ctx.classId,
      subject_id: subjectMTK.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      title: "Locked Ujian MTK",
      description: "Locked",
      assessment_date: "2026-06-17",
      score_min: 0,
      score_max: 100
    },
    token: sprint8AdminToken
  }).getContent()).data;
  route({
    action: 'lock_academic_assessment',
    payload: { actor_user_id: admin.id, id: lockedMTK.id },
    token: sprint8AdminToken
  });
  
  // --- RUN QA TESTS ---
  
  // QA A: Valid token + valid subject_code
  var resA = JSON.parse(route({
    action: 'parent_get_academic_detail',
    payload: {
      parent_access_token: ctx.token,
      subject_code: 'mtk' // test case-insensitivity
    }
  }).getContent());
  
  if (resA.status !== 'success') {
    throw new Error("QA A failed: API returned error " + JSON.stringify(resA));
  }
  
  var dataA = resA.data;
  if (dataA.subject_code !== 'MTK') {
    throw new Error("QA A failed: Expected canonical subject_code 'MTK', got " + dataA.subject_code);
  }
  if (dataA.subject_name !== 'Matematika') {
    throw new Error("QA A failed: Expected subject_name 'Matematika', got " + dataA.subject_name);
  }
  
  // QA C, D, E, F: check assessments content
  var assessmentsA = dataA.assessments;
  if (!assessmentsA || assessmentsA.length !== 2) {
    throw new Error("QA C/D/E failed: Expected exactly 2 assessments (published and locked), got " + (assessmentsA ? assessmentsA.length : 0));
  }
  
  // Check Draft assessment is NOT present (QA C)
  var hasDraft = assessmentsA.some(function(a) { return a.assessment_title === "Draft Ujian MTK"; });
  if (hasDraft) {
    throw new Error("QA C failed: Draft assessment was returned in parent detail payload!");
  }
  
  // Check Published assessment is present and has correct score (QA D)
  var publishedRes = assessmentsA.filter(function(a) { return a.assessment_title === "Published Ujian MTK"; })[0];
  if (!publishedRes) {
    throw new Error("QA D failed: Published assessment not found.");
  }
  if (publishedRes.score !== 85) {
    throw new Error("QA D failed: Expected score to be 85, got " + publishedRes.score);
  }
  if (publishedRes.assessment_status !== 'published') {
    throw new Error("QA D failed: Expected status 'published', got " + publishedRes.assessment_status);
  }
  
  // Check Locked assessment is present and has null score (QA E & QA F)
  var lockedRes = assessmentsA.filter(function(a) { return a.assessment_title === "Locked Ujian MTK"; })[0];
  if (!lockedRes) {
    throw new Error("QA E failed: Locked assessment not found.");
  }
  if (lockedRes.score !== null) {
    throw new Error("QA F failed: Expected score to be null for ungraded locked assessment, got " + lockedRes.score);
  }
  if (lockedRes.assessment_status !== 'locked') {
    throw new Error("QA E failed: Expected status 'locked', got " + lockedRes.assessment_status);
  }
  
  // QA B: Invalid subject_code
  var resB = JSON.parse(route({
    action: 'parent_get_academic_detail',
    payload: {
      parent_access_token: ctx.token,
      subject_code: 'IPA'
    }
  }).getContent());
  
  if (resB.status !== 'success') {
    throw new Error("QA B failed: Invalid subject_code should return success, got " + JSON.stringify(resB));
  }
  if (resB.data.subject_code !== 'IPA') {
    throw new Error("QA B failed: Expected subject_code 'IPA', got " + resB.data.subject_code);
  }
  if (resB.data.subject_name !== null) {
    throw new Error("QA B failed: Expected subject_name to be null, got " + resB.data.subject_name);
  }
  if (resB.data.assessments.length !== 0) {
    throw new Error("QA B failed: Expected empty assessments array, got " + resB.data.assessments.length);
  }
  
  // QA G: Inspect payload for blacklisted fields
  var cleanDataForBlacklist = JSON.parse(JSON.stringify(resA.data));
  if (cleanDataForBlacklist.selected_period) {
    delete cleanDataForBlacklist.selected_period;
  }
  var testPayload = JSON.stringify(cleanDataForBlacklist);
  var blacklist = [
    'student_id', 'class_id', 'subject_id', 'assessment_id',
    'teacher_user_id', 'teacher_id', 'enrollment_id', 'student_enrollment_id',
    'academic_year_id', 'semester_id', 'created_at', 'updated_at', 'note'
  ];
  blacklist.forEach(function(field) {
    if (testPayload.indexOf('"' + field + '"') !== -1) {
      throw new Error("QA G failed: Blacklisted field '" + field + "' leaked in payload! Payload: " + testPayload);
    }
  });
  
  // QA H: Payload tampering check
  var resH = JSON.parse(route({
    action: 'parent_get_academic_detail',
    payload: {
      parent_access_token: ctx.token,
      subject_code: 'MTK',
      student_id: 'HACK',
      class_id: 'HACK',
      enrollment_id: 'HACK'
    }
  }).getContent());
  
  if (resH.status !== 'success') {
    throw new Error("QA H failed: Tampering payload request failed unexpectedly.");
  }
  if (resH.data.subject_code !== 'MTK' || resH.data.subject_name !== 'Matematika') {
    throw new Error("QA H failed: Subject resolution incorrect during tampering attempt.");
  }
  
  // QA I-1: Legacy parent_token parameter must be rejected
  var resI1Err = false;
  try {
    var rawResI1 = route({
      action: 'parent_get_academic_detail',
      payload: {
        parent_token: ctx.token,
        subject_code: 'MTK'
      }
    });
    var resI1 = JSON.parse(rawResI1.getContent());
    if (resI1.status === 'error' && resI1.code === 'ERR_UNAUTHORIZED') {
      resI1Err = true;
    }
  } catch (e) {
    // Fallback if it throws directly
    if (e.code === 'ERR_UNAUTHORIZED') {
      resI1Err = true;
    }
  }
  if (!resI1Err) {
    throw new Error("QA I-1 failed: legacy parent_token parameter was not rejected with ERR_UNAUTHORIZED.");
  }
  
  // QA I-2: Invalid/revoked parent_access_token must be rejected
  var resI2Err = false;
  try {
    var rawResI2 = route({
      action: 'parent_get_academic_detail',
      payload: {
        parent_access_token: 'INVALID_TOKEN_123_XYZ',
        subject_code: 'MTK'
      }
    });
    var resI2 = JSON.parse(rawResI2.getContent());
    if (resI2.status === 'error' && resI2.code === 'ERR_UNAUTHORIZED') {
      resI2Err = true;
    }
  } catch (e) {
    // Fallback if it throws directly
    if (e.code === 'ERR_UNAUTHORIZED') {
      resI2Err = true;
    }
  }
  if (!resI2Err) {
    throw new Error("QA I-2 failed: invalid/revoked parent_access_token was not rejected with ERR_UNAUTHORIZED.");
  }
}
