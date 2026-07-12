/**
 * Sprint116BTests.gs
 * QA assertions for Sprint 11.6B Culture Scores Import.
 */

function test_runSprint116BQA() {
  console.log("STARTING SPRINT 11.6B CULTURE IMPORT QA");
  setupDatabase();
  seedInitialData();
  
  var adminUser = getSprint11QaAdmin();
  var adminToken = loginSprint11TestUser(adminUser.username, 'Admin123!');
  
  var suffix = createSprint11QaSuffix();
  var period = ensureSprint11Period(adminUser, suffix, adminToken);
  
  // Create Class B
  var classARes = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_116B_B_' + suffix,
    name: 'Kelas 11.6B B ' + suffix,
    level: '5'
  }, adminToken);
  var classAId = classARes.data.id;
  
  // Create Guru 1 (assigned to Class B)
  var guru1 = createRecord(SHEETS.USERS, {
    name: 'Guru 11.6B-1 ' + suffix,
    email: 'guru1_116b_' + suffix + '@example.com',
    username: 'guru1_116b_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, adminUser);
  var guru1Token = loginSprint11TestUser(guru1.username, 'Password123!');
  
  assertSprint11RouteSuccess('assign_class_teacher', {
    class_id: classAId,
    teacher_user_id: guru1.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    effective_from: '2026-07-01'
  }, adminToken);
  
  // Create Guru 2 (not assigned)
  var guru2 = createRecord(SHEETS.USERS, {
    name: 'Guru 11.6B-2 ' + suffix,
    email: 'guru2_116b_' + suffix + '@example.com',
    username: 'guru2_116b_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, adminUser);
  var guru2Token = loginSprint11TestUser(guru2.username, 'Password123!');
  
  // Create Student enrolled in Class B
  var nisn1 = createSprint11QaNisn();
  var student1Res = assertSprint11RouteSuccess('create_student', {
    nisn: nisn1,
    nik: '8211111111114444',
    full_name: 'Student 11.6B ' + suffix,
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '1234'
  }, adminToken);
  var student1Id = student1Res.data.id;
  
  assertSprint11RouteSuccess('create_student_enrollment', {
    student_id: student1Id,
    class_id: classAId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    status: 'active'
  }, adminToken);
  
  console.log("1. Testing Guru class assignment validation for culture scores...");
  var csvGuru1 = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + ",2026-07-10,4,3,4,3,4,3,4";
  var sessGuru1 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'guru1_culture_import.csv',
    csv_content: csvGuru1
  }, guru1Token);
  if (sessGuru1.data.invalid_rows !== 0) {
    throw new Error("Expected Guru 1 preview to have 0 invalid rows but got: " + sessGuru1.data.invalid_rows);
  }
  
  var sessGuru2 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'guru2_culture_import.csv',
    csv_content: csvGuru1
  }, guru2Token);
  if (!sessGuru2.data.errors.some(function(e) { return e.error_code === 'ERR_FORBIDDEN'; })) {
    throw new Error("Expected Guru 2 preview to fail with ERR_FORBIDDEN.");
  }
  
  console.log("2. Testing Indicator boundaries validation...");
  var csvInvalidScore = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + ",2026-07-10,5,3,4,0,4,abc,4";
  var sessInvalidScore = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'invalid_score_import.csv',
    csv_content: csvInvalidScore
  }, guru1Token);
  if (sessInvalidScore.data.invalid_rows !== 1) {
    throw new Error("Expected 1 invalid row for incorrect score values, got: " + sessInvalidScore.data.invalid_rows);
  }
  var indicatorErrors = sessInvalidScore.data.errors.filter(function(e) { return e.error_code === 'INVALID_VALUE'; });
  if (indicatorErrors.length < 3) { // 5 (out of bounds), 0 (out of bounds), abc (nan)
    throw new Error("Expected at least 3 INVALID_VALUE errors for indicators, got: " + indicatorErrors.length);
  }
  
  console.log("3. Testing All Empty warning...");
  var csvAllEmpty = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + ",2026-07-10,,,,,,,,";
  var sessAllEmpty = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'all_empty_import.csv',
    csv_content: csvAllEmpty
  }, guru1Token);
  if (sessAllEmpty.data.invalid_rows !== 0) {
    throw new Error("Expected all empty row to have 0 invalid rows (warnings are not fatal).");
  }
  var warning = sessAllEmpty.data.errors.filter(function(e) { return e.severity === 'warning'; })[0];
  if (!warning || warning.error_code !== 'CULTURE_ALL_EMPTY' || warning.message !== "Semua nilai budaya kosong, row dilewati") {
    throw new Error("Expected CULTURE_ALL_EMPTY warning with exact warning message.");
  }
  
  // Confirming should result in skipped action
  var confAllEmpty = assertSprint11RouteSuccess('confirm_import_data', {
    import_log_id: sessAllEmpty.data.import_log_id
  }, guru1Token);
  var processedAllEmpty = confAllEmpty.data.processed_rows[0];
  if (!processedAllEmpty || processedAllEmpty.action !== 'skipped') {
    throw new Error("Expected all empty row to be skipped on confirm.");
  }
  
  console.log("4. Testing Partial Empty merge behavior...");
  // First, input some initial culture scores via standard API or CSV
  var csvInitial = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + ",2026-07-10,4,3,4,3,4,3,4";
  var sessInitial = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'initial.csv',
    csv_content: csvInitial
  }, guru1Token);
  assertSprint11RouteSuccess('confirm_import_data', { import_log_id: sessInitial.data.import_log_id }, guru1Token);
  
  // Now, upload a CSV with partial empty indicators: sss=2, am is empty, hb=2, others empty
  var csvPartial = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + ",2026-07-10,2,,2,,,,,";
  var sessPartial = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'partial.csv',
    csv_content: csvPartial
  }, guru1Token);
  var confPartial = assertSprint11RouteSuccess('confirm_import_data', { import_log_id: sessPartial.data.import_log_id }, guru1Token);
  
  // Fetch via getStudentCultureScores and assert values
  var scores = assertSprint11RouteSuccess('get_student_culture_scores', {
    student_id: student1Id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, guru1Token).data;
  
  var scoreRow = scores.filter(function(r) { return normalizeDateString(r.score_date) === '2026-07-10'; })[0];
  if (!scoreRow) {
    throw new Error("Expected culture score row to exist for 2026-07-10.");
  }
  if (Number(scoreRow.sss_score) !== 2 || Number(scoreRow.hb_score) !== 2) {
    throw new Error("Expected sss and hb to be updated to 2.");
  }
  if (Number(scoreRow.am_score) !== 3) {
    throw new Error("Expected am to remain 3 (from initial, not overwritten by empty/null).");
  }
  if (Number(scoreRow.asm_score) !== 3 || Number(scoreRow.br_score) !== 4) {
    throw new Error("Expected other indicators to remain at their initial values.");
  }
  
  console.log("5. Testing Lock Periods (Guru vs Admin vs Administrator)...");
  // Set score date to 10 days ago
  var tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  var dateStr10 = Utilities.formatDate(tenDaysAgo, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  var fortyDaysAgo = new Date();
  fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
  var dateStr40 = Utilities.formatDate(fortyDaysAgo, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  // Make sure the active semester starts before 40 days ago so NO_MATCHING_PERIOD or NO_ACTIVE_ENROLLMENT is not thrown
  var semSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SEMESTERS);
  var semData = semSheet.getRange(2, 1, semSheet.getLastRow() - 1, semSheet.getLastColumn()).getValues();
  for (var i = 0; i < semData.length; i++) {
    if (semData[i][0] === period.semesterId) {
      var fiftyDaysAgo = new Date();
      fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50);
      var fiftyDaysAgoStr = Utilities.formatDate(fiftyDaysAgo, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      semSheet.getRange(i + 2, 4).setValue(fiftyDaysAgoStr); // start_date is column 4 (1-indexed)
      break;
    }
  }
  
  // Refresh validation caches by clearing cache or using new DB list call if we were using cached DB,
  // but in validateImportRows, db.semesters is fetched fresh on call.
  
  var csv10Days = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + "," + dateStr10 + ",3,3,3,3,3,3,3";
  // Guru should fail
  var sessGuru10 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'guru_10days.csv',
    csv_content: csv10Days
  }, guru1Token);
  if (!sessGuru10.data.errors.some(function(e) { return e.error_code === 'ERR_PERIOD_LOCKED'; })) {
    throw new Error("Expected Guru import for score_date 10 days ago to fail with ERR_PERIOD_LOCKED.");
  }
  
  // Admin should pass
  var sessAdmin10 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'admin_10days.csv',
    csv_content: csv10Days
  }, adminToken);
  if (sessAdmin10.data.invalid_rows !== 0) {
    throw new Error("Expected Admin import for score_date 10 days ago to pass.");
  }
  
  var csv40Days = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + "," + dateStr40 + ",3,3,3,3,3,3,3";
  // Create an Operator (ROLES.ADMIN) to test the 30-day limit
  var operatorUser = createRecord(SHEETS.USERS, {
    name: 'Operator 11.6B ' + suffix,
    email: 'operator_116b_' + suffix + '@example.com',
    username: 'operator_116b_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.ADMIN,
    status: STATUS.ACTIVE
  }, adminUser);
  var operatorToken = loginSprint11TestUser(operatorUser.username, 'Password123!');
  
  // Admin (Operator) should fail for 40 days
  var sessAdmin40 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'admin_40days.csv',
    csv_content: csv40Days
  }, operatorToken);
  if (!sessAdmin40.data.errors.some(function(e) { return e.error_code === 'ERR_PERIOD_LOCKED'; })) {
    throw new Error("Expected Admin import for score_date 40 days ago to fail with ERR_PERIOD_LOCKED.");
  }
  
  // Administrator (adminToken) should pass
  var sessSuper40 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'super_40days.csv',
    csv_content: csv40Days
  }, adminToken);
  if (sessSuper40.data.invalid_rows !== 0) {
    throw new Error("Expected Administrator import for score_date 40 days ago to pass.");
  }
  
  console.log("6. Testing Revalidation during confirmation...");
  var csvReval = "nisn,score_date,sss,am,hb,asm,br,ak,tm\n" + nisn1 + ",2026-07-10,3,3,3,3,3,3,3";
  var sessReval = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'culture_scores',
    file_name: 'reval_culture.csv',
    csv_content: csvReval
  }, guru1Token);
  if (sessReval.data.invalid_rows !== 0) {
    throw new Error("Expected preview to pass.");
  }
  
  // Finalize semester
  assertSprint11RouteSuccess('finalize_semester_reports', {
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);
  
  // Confirm should now fail revalidation because semester is finalized
  var confirmRes = JSON.parse(route({
    action: 'confirm_import_data',
    payload: { import_log_id: sessReval.data.import_log_id },
    token: guru1Token
  }).getContent());
  
  if (confirmRes.status !== 'error' || confirmRes.message !== "No valid rows to import.") {
    throw new Error("Expected confirmation to fail revalidation because semester was finalized. Got: " + JSON.stringify(confirmRes));
  }
  
  console.log("SPRINT 11.6B CULTURE IMPORT QA PASSED");
}
