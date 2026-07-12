/**
 * Sprint1PeriodSafetyTests.gs
 * QA and verification suite for Sprint 1 safety layers and historical parent access.
 */

var sprint1AdminToken = '';

function test_runSprint1PeriodSafetyQA() {
  console.log("=== STARTING SPRINT 1 PERIOD SAFETY & PARENT HISTORICAL ACCESS QA ===");

  setupDatabase();
  seedInitialData();

  // Retrieve admin user and login
  var adminUser = getSprint1QaAdmin();
  var loginResult = JSON.parse(route({
    action: 'login',
    payload: {
      identifier: 'admin',
      password: 'Admin123!',
      ip_address: '127.0.0.1',
      user_agent: 'Sprint1-QA-Test'
    }
  }).getContent());
  
  if (loginResult.status !== 'success') {
    throw new Error("Admin login failed during QA setup: " + JSON.stringify(loginResult));
  }
  sprint1AdminToken = loginResult.data.token;

  var suffix = new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
  
  // 1. Create multiple academic years and semesters to test alignment
  console.log("Setting up academic periods for QA...");
  
  // Academic Year A (2025/2026)
  var yearARes = assertSprint1RouteSuccess('create_academic_year', {
    name: "AY_A_" + suffix,
    start_date: "2025-07-01",
    end_date: "2026-06-30"
  });
  var yearAId = yearARes.data.id;
  
  var semA1Res = assertSprint1RouteSuccess('create_semester', {
    academic_year_id: yearAId,
    name: "Ganjil",
    start_date: "2025-07-01",
    end_date: "2025-12-31"
  });
  var semA1Id = semA1Res.data.id;
  
  var semA2Res = assertSprint1RouteSuccess('create_semester', {
    academic_year_id: yearAId,
    name: "Genap",
    start_date: "2026-01-01",
    end_date: "2026-06-30"
  });
  var semA2Id = semA2Res.data.id;
  
  // Academic Year B (2026/2027)
  var yearBRes = assertSprint1RouteSuccess('create_academic_year', {
    name: "AY_B_" + suffix,
    start_date: "2026-07-01",
    end_date: "2027-06-30"
  });
  var yearBId = yearBRes.data.id;
  
  var semB1Res = assertSprint1RouteSuccess('create_semester', {
    academic_year_id: yearBId,
    name: "Ganjil",
    start_date: "2026-07-01",
    end_date: "2026-12-31"
  });
  var semB1Id = semB1Res.data.id;

  // Set Year A and Semester A1 active
  assertSprint1RouteSuccess('set_active_academic_year', { id: yearAId });
  assertSprint1RouteSuccess('set_active_semester', { id: semA1Id });
  
  // Verify setup is active
  var settings = getAppSettings();
  if (settings.active_academic_year_id !== yearAId || settings.active_semester_id !== semA1Id) {
    throw new Error("Initial period setup activation failed.");
  }
  
  // --- TEST CASE 1: setActiveSemester rejects semester from another year ---
  console.log("Running QA 1: Mismatch active semester rejection...");
  var resSemMismatch = JSON.parse(route({
    action: 'set_active_semester',
    payload: { id: semB1Id },
    token: sprint1AdminToken
  }).getContent());
  
  if (resSemMismatch.status !== 'error' || resSemMismatch.code !== 'ERR_ACTIVE_PERIOD_MISMATCH') {
    throw new Error("Expected setActiveSemester to reject mismatched semester with ERR_ACTIVE_PERIOD_MISMATCH. Got: " + JSON.stringify(resSemMismatch));
  }
  
  // --- TEST CASE 2: setActiveAcademicYear automatically activates a deterministic valid semester ---
  console.log("Running QA 2: Deterministic semester activation in setActiveAcademicYear...");
  // Make semA2 is_active = true and semA1 is_active = false, so when we reactivate yearA, it should prioritize semA2
  updateRecord(SHEETS.SEMESTERS, semA1Id, { is_active: false });
  updateRecord(SHEETS.SEMESTERS, semA2Id, { is_active: true });
  
  // Activate Academic Year B. Year B only has semB1, which is Ganjil. It should automatically activate semB1.
  assertSprint1RouteSuccess('set_active_academic_year', { id: yearBId });
  var settingsB = getAppSettings();
  if (settingsB.active_academic_year_id !== yearBId || settingsB.active_semester_id !== semB1Id) {
    throw new Error("setActiveAcademicYear failed to automatically set active semester to semB1.");
  }
  
  // Reactivate Academic Year A. It should pick semA2 (since its is_active was true).
  assertSprint1RouteSuccess('set_active_academic_year', { id: yearAId });
  var settingsA = getAppSettings();
  if (settingsA.active_academic_year_id !== yearAId || settingsA.active_semester_id !== semA2Id) {
    throw new Error("setActiveAcademicYear failed to prioritize previously active semester semA2. Settings: " + JSON.stringify(settingsA));
  }

  // Test error code when activating year with no semesters
  var yearCRes = assertSprint1RouteSuccess('create_academic_year', {
    name: "AY_C_" + suffix,
    start_date: "2027-07-01",
    end_date: "2028-06-30"
  });
  var yearCId = yearCRes.data.id;
  
  var resYearCErr = JSON.parse(route({
    action: 'set_active_academic_year',
    payload: { id: yearCId },
    token: sprint1AdminToken
  }).getContent());
  
  if (resYearCErr.status !== 'error' || resYearCErr.code !== 'ERR_ACTIVE_SEMESTER_NOT_SET') {
    throw new Error("Expected set_active_academic_year to throw ERR_ACTIVE_SEMESTER_NOT_SET for semester-less year. Got: " + JSON.stringify(resYearCErr));
  }
  
  // --- TEST CASE 3: Active Period Resolvers reject mismatch and raise errors ---
  console.log("Running QA 3: Hardened active period resolvers...");
  // Manually force a mismatch in settings to test resolver behavior
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    updateSingleSetting('active_semester_id', semB1Id, adminUser); // semB1 belongs to Year B, but Year A is active
  } finally {
    lock.releaseLock();
  }
  
  try {
    getActiveSemester();
    throw new Error("Expected getActiveSemester to throw ERR_ACTIVE_PERIOD_MISMATCH.");
  } catch (err) {
    if (err.code !== 'ERR_ACTIVE_PERIOD_MISMATCH') {
      throw new Error("Expected ERR_ACTIVE_PERIOD_MISMATCH error from getActiveSemester. Got: " + JSON.stringify(err));
    }
  }

  // Restore alignment
  assertSprint1RouteSuccess('set_active_academic_year', { id: yearAId });
  assertSprint1RouteSuccess('set_active_semester', { id: semA1Id });
  
  // --- TEST CASE 4: setup readiness check diagnostic checks ---
  console.log("Running QA 4: Setup readiness check diagnostic...");
  var readinessRes = assertSprint1RouteSuccess('get_period_setup_readiness', {});
  var readiness = readinessRes.data;
  
  if (readiness.status !== 'warning' && readiness.status !== 'not_ready') {
    throw new Error("Readiness check should be warning or not_ready because no classes, teacher assignments, or class subjects exist for the current active period.");
  }
  
  var checks = readiness.checks;
  var keysChecked = checks.map(function(c) { return c.key; });
  var expectedKeys = ["active_period", "enrollments", "teacher_assignments", "class_subjects", "classes", "historical_periods"];
  expectedKeys.forEach(function(key) {
    if (keysChecked.indexOf(key) === -1) {
      throw new Error("Readiness check is missing check key: " + key);
    }
  });

  // --- TEST CASE 5: Parent Portal available periods retrieve ---
  console.log("Running QA 5: Parent available periods list and security checks...");
  // Create Student
  var pinVal = "1111";
  var nisnVal = createSprint1QaNisn();
  var studentRes = assertSprint1RouteSuccess('create_student', {
    nisn: nisnVal,
    nik: "1234567890123455",
    full_name: "Student S1 QA " + suffix,
    birth_date: "2015-05-15",
    gender: "L",
    status: "Aktif",
    parent_access_pin: pinVal
  });
  var studentId = studentRes.data.id;
  
  // Create Student 2 (for cross-access verification)
  var student2Res = assertSprint1RouteSuccess('create_student', {
    nisn: createSprint1QaNisn(),
    nik: "1234567890123444",
    full_name: "Student S1 QA 2 " + suffix,
    birth_date: "2015-05-15",
    gender: "P",
    status: "Aktif",
    parent_access_pin: pinVal
  });
  var student2Id = student2Res.data.id;

  // Create Class
  var classRes = assertSprint1RouteSuccess('create_class', {
    code: 'CLS_S1_' + suffix,
    name: 'Kelas S1 QA ' + suffix,
    level: '5'
  });
  var classId = classRes.data.id;
  
  // Enroll student in Year A Semester A1
  assertSprint1RouteSuccess('create_student_enrollment', {
    student_id: studentId,
    class_id: classId,
    academic_year_id: yearAId,
    semester_id: semA1Id,
    status: 'active'
  });
  
  // Enroll student 2 in Year B Semester B1
  assertSprint1RouteSuccess('create_student_enrollment', {
    student_id: student2Id,
    class_id: classId,
    academic_year_id: yearBId,
    semester_id: semB1Id,
    status: 'active'
  });

  // Parent login for student 1
  var parentLoginRes = JSON.parse(route({
    action: 'parent_login',
    payload: {
      nisn: nisnVal,
      birth_date: "2015-05-15",
      pin: pinVal
    }
  }).getContent());
  
  if (parentLoginRes.status !== 'success') {
    throw new Error("Parent login failed: " + JSON.stringify(parentLoginRes));
  }
  var parentToken = parentLoginRes.data.parent_access_token;
  
  // Retrieve available periods
  var availablePeriodsRes = JSON.parse(route({
    action: 'parent_get_available_periods',
    payload: { parent_access_token: parentToken }
  }).getContent());
  
  if (availablePeriodsRes.status !== 'success') {
    throw new Error("Failed to retrieve available periods: " + JSON.stringify(availablePeriodsRes));
  }
  
  var periods = availablePeriodsRes.data;
  if (periods.length !== 1 || periods[0].academic_year_id !== yearAId || periods[0].semester_id !== semA1Id) {
    throw new Error("Student 1 periods expected to only contain Year A Semester A1. Got: " + JSON.stringify(periods));
  }
  
  // --- TEST CASE 6: Parent cannot access another child's periods ---
  console.log("Running QA 6: Period token security isolation...");
  
  // Try querying parent_get_dashboard for Student 1 but passing student_id in payload?
  // Wait! Our endpoints resolve the studentId from session token, so payload student_id is ignored or disallowed.
  // Let's verify that querying with parameter yearBId, semB1Id fails since Student 1 has no records in that period.
  var resDashboardMismatch = JSON.parse(route({
    action: 'parent_get_dashboard',
    payload: {
      parent_access_token: parentToken,
      academic_year_id: yearBId,
      semester_id: semB1Id
    }
  }).getContent());
  
  if (resDashboardMismatch.status !== 'error' || resDashboardMismatch.code !== 'ERR_PARENT_PERIOD_NOT_AVAILABLE') {
    throw new Error("Expected parent_get_dashboard to throw ERR_PARENT_PERIOD_NOT_AVAILABLE for unavailable period. Got: " + JSON.stringify(resDashboardMismatch));
  }

  // --- TEST CASE 7 & 8: Backward compatibility & historical queries ---
  console.log("Running QA 7 & 8: Backward compatibility and historical querying...");
  
  // Query dashboard with empty parameters (resolves to active Year A Sem A1)
  var dashboardCompatRes = JSON.parse(route({
    action: 'parent_get_dashboard',
    payload: { parent_access_token: parentToken }
  }).getContent());
  
  if (dashboardCompatRes.status !== 'success') {
    throw new Error("Backward compatibility check failed on dashboard query: " + JSON.stringify(dashboardCompatRes));
  }
  
  var compatData = dashboardCompatRes.data;
  if (!compatData.selected_period || compatData.is_current_period !== true) {
    throw new Error("Missing selected_period or invalid is_current_period in dashboard backward compatible response: " + JSON.stringify(compatData));
  }
  
  // Enroll Student 1 in Year B Semester B1 with historical status: promoted
  assertSprint1RouteSuccess('create_student_enrollment', {
    student_id: studentId,
    class_id: classId,
    academic_year_id: yearBId,
    semester_id: semB1Id,
    status: 'promoted'
  });
  
  // Now Student 1 has historical enrollment in Year B Sem B1. Available periods should contain both.
  var availablePeriodsUpdatedRes = JSON.parse(route({
    action: 'parent_get_available_periods',
    payload: { parent_access_token: parentToken }
  }).getContent());
  var updatedPeriods = availablePeriodsUpdatedRes.data;
  if (updatedPeriods.length !== 2) {
    throw new Error("Available periods list did not pick up historical 'promoted' enrollment status. Got: " + JSON.stringify(updatedPeriods));
  }
  
  // Set Year B and Semester B1 active
  assertSprint1RouteSuccess('set_active_academic_year', { id: yearBId });
  assertSprint1RouteSuccess('set_active_semester', { id: semB1Id });
  
  // Query dashboard for historical Year A Sem A1
  var dashboardHistoricalRes = JSON.parse(route({
    action: 'parent_get_dashboard',
    payload: {
      parent_access_token: parentToken,
      academic_year_id: yearAId,
      semester_id: semA1Id
    }
  }).getContent());
  
  if (dashboardHistoricalRes.status !== 'success') {
    throw new Error("Failed to query historical dashboard: " + JSON.stringify(dashboardHistoricalRes));
  }
  
  var historicalData = dashboardHistoricalRes.data;
  if (historicalData.selected_period.academic_year_id !== yearAId || historicalData.is_current_period !== false) {
    throw new Error("Selected historical period mismatch or is_current_period not false. Got: " + JSON.stringify(historicalData));
  }
  
  // Clean up and restore default settings
  setupDatabase();
  seedInitialData();

  console.log("=== SPRINT 1 PERIOD SAFETY & PARENT HISTORICAL ACCESS QA PASSED ===");
}

function assertSprint1RouteSuccess(action, payload, adminToken) {
  var requestObj = {
    action: action,
    payload: payload || {}
  };
  requestObj.token = adminToken || sprint1AdminToken;
  var result = JSON.parse(route(requestObj).getContent());

  if (result.status !== 'success') {
    throw new Error("Action " + action + " failed: " + JSON.stringify(result));
  }

  return result;
}

function getSprint1QaAdmin() {
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Default admin user not found.");
  }
  return admin;
}

function createSprint1QaNisn() {
  var nisn;
  var exists = true;

  while (exists) {
    nisn = String(Math.floor(5000000000 + Math.random() * 1000000000));
    exists = listRecords(SHEETS.STUDENTS, function(student) {
      return String(student.nisn) === nisn;
    }).length > 0;
  }

  return nisn;
}
