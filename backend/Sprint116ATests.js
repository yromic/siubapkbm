/**
 * Sprint116ATests.gs
 * QA assertions for Sprint 11.6A Academic Scores Import.
 */

function test_runSprint116AQA() {
  console.log("STARTING SPRINT 11.6A ACADEMIC IMPORT QA");
  setupDatabase();
  seedInitialData();
  
  var adminUser = getSprint11QaAdmin();
  var adminToken = loginSprint11TestUser(adminUser.username, 'Admin123!');
  
  var suffix = createSprint11QaSuffix();
  var period = ensureSprint11Period(adminUser, suffix, adminToken);
  
  // Create Class A
  var classARes = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_116A_A_' + suffix,
    name: 'Kelas 11.6A A ' + suffix,
    level: '5'
  }, adminToken);
  var classAId = classARes.data.id;
  
  // Create Guru 1 (assigned to Class A)
  var guru1 = createRecord(SHEETS.USERS, {
    name: 'Guru 11.6A-1 ' + suffix,
    email: 'guru1_116a_' + suffix + '@example.com',
    username: 'guru1_116a_' + suffix,
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
  
  // Create Guru 2 (not assigned to Class A)
  var guru2 = createRecord(SHEETS.USERS, {
    name: 'Guru 11.6A-2 ' + suffix,
    email: 'guru2_116a_' + suffix + '@example.com',
    username: 'guru2_116a_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, adminUser);
  var guru2Token = loginSprint11TestUser(guru2.username, 'Password123!');
  
  // Create Subject
  var subjectRes = assertSprint11RouteSuccess('create_subject', {
    code: 'SBJ_116A_' + suffix,
    name: 'Subject 11.6A ' + suffix
  }, adminToken);
  var subjectId = subjectRes.data.id;
  
  assertSprint11RouteSuccess('assign_subject_to_class', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);
  
  // Create Student enrolled in Class A
  var nisn1 = createSprint11QaNisn();
  var student1Res = assertSprint11RouteSuccess('create_student', {
    nisn: nisn1,
    nik: '8211111111112222',
    full_name: 'Student 11.6A ' + suffix,
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
  
  // Create Assessments
  var draftAss = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Draft Ass ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken).data;
  
  var pubAss = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Published Ass ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken).data;
  assertSprint11RouteSuccess('publish_academic_assessment', { id: pubAss.id }, adminToken);
  
  var lockedAss = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Locked Ass ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken).data;
  assertSprint11RouteSuccess('publish_academic_assessment', { id: lockedAss.id }, adminToken);
  assertSprint11RouteSuccess('lock_academic_assessment', { id: lockedAss.id }, adminToken);
  
  console.log("1. Testing Guru class assignment validation...");
  // Guru 1 (assigned) preview -> should pass with 0 fatal errors
  var csvGuru1 = "nisn,assessment_id,score,note\n" + nisn1 + "," + pubAss.id + ",85,Good job";
  var sessGuru1 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'guru1_import.csv',
    csv_content: csvGuru1
  }, guru1Token);
  if (sessGuru1.data.invalid_rows !== 0) {
    throw new Error("Expected Guru 1 preview to have 0 invalid rows but got: " + sessGuru1.data.invalid_rows);
  }
  
  // Guru 2 (not assigned) preview -> should have ERR_FORBIDDEN fatal error
  var sessGuru2 = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'guru2_import.csv',
    csv_content: csvGuru1
  }, guru2Token);
  var hasForbidden = sessGuru2.data.errors.some(function(e) { return e.error_code === 'ERR_FORBIDDEN'; });
  if (!hasForbidden) {
    throw new Error("Expected Guru 2 preview to have ERR_FORBIDDEN error.");
  }
  
  console.log("2. Testing Assessment Status validation (Draft/Locked should fail)...");
  // Draft assessment import
  var csvDraft = "nisn,assessment_id,score,note\n" + nisn1 + "," + draftAss.id + ",85,Good job";
  var sessDraft = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'draft_import.csv',
    csv_content: csvDraft
  }, guru1Token);
  var hasDraftErr = sessDraft.data.errors.some(function(e) { return e.error_code === 'INVALID_STATUS'; });
  if (!hasDraftErr) {
    throw new Error("Expected Draft assessment import to fail validation with INVALID_STATUS.");
  }
  
  // Locked assessment import
  var csvLocked = "nisn,assessment_id,score,note\n" + nisn1 + "," + lockedAss.id + ",85,Good job";
  var sessLocked = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'locked_import.csv',
    csv_content: csvLocked
  }, guru1Token);
  var hasLockedErr = sessLocked.data.errors.some(function(e) { return e.error_code === 'INVALID_STATUS'; });
  if (!hasLockedErr) {
    throw new Error("Expected Locked assessment import to fail validation with INVALID_STATUS.");
  }
  
  console.log("3. Testing Score Range validation...");
  // Below min score (e.g. -5)
  var csvLow = "nisn,assessment_id,score,note\n" + nisn1 + "," + pubAss.id + ",-5,Too low";
  var sessLow = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'low_import.csv',
    csv_content: csvLow
  }, guru1Token);
  if (!sessLow.data.errors.some(function(e) { return e.error_code === 'OUT_OF_RANGE'; })) {
    throw new Error("Expected below min score to fail with OUT_OF_RANGE.");
  }
  
  // Above max score (e.g. 105)
  var csvHigh = "nisn,assessment_id,score,note\n" + nisn1 + "," + pubAss.id + ",105,Too high";
  var sessHigh = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'high_import.csv',
    csv_content: csvHigh
  }, guru1Token);
  if (!sessHigh.data.errors.some(function(e) { return e.error_code === 'OUT_OF_RANGE'; })) {
    throw new Error("Expected above max score to fail with OUT_OF_RANGE.");
  }
  
  console.log("4. Testing Enrollment validation (Unenrolled student)...");
  var nisnUnenrolled = createSprint11QaNisn();
  assertSprint11RouteSuccess('create_student', {
    nisn: nisnUnenrolled,
    nik: '8211111111113333',
    full_name: 'Unenrolled Student ' + suffix,
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '1234'
  }, adminToken);
  
  var csvUnenrolled = "nisn,assessment_id,score,note\n" + nisnUnenrolled + "," + pubAss.id + ",80,test";
  var sessUnenrolled = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'unenrolled_import.csv',
    csv_content: csvUnenrolled
  }, guru1Token);
  if (!sessUnenrolled.data.errors.some(function(e) { return e.error_code === 'NO_ACTIVE_ENROLLMENT'; })) {
    throw new Error("Expected student without active enrollment to fail with NO_ACTIVE_ENROLLMENT.");
  }
  
  console.log("5. Testing Empty Score validation (warning & confirm skip)...");
  var csvEmpty = "nisn,assessment_id,score,note\n" + nisn1 + "," + pubAss.id + ",,Missing score note";
  var sessEmpty = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'empty_import.csv',
    csv_content: csvEmpty
  }, guru1Token);
  
  // It should have 0 invalid_rows (valid = true) but 1 error in findings with severity: 'warning'
  if (sessEmpty.data.invalid_rows !== 0) {
    throw new Error("Expected empty score to have 0 invalid_rows but got " + sessEmpty.data.invalid_rows);
  }
  var warning = sessEmpty.data.errors.filter(function(e) { return e.severity === 'warning'; })[0];
  if (!warning || warning.error_code !== 'SCORE_EMPTY') {
    throw new Error("Expected empty score to generate SCORE_EMPTY warning.");
  }
  
  // Confirm the empty score import -> should be processed as skipped
  var confEmpty = assertSprint11RouteSuccess('confirm_import_data', {
    import_log_id: sessEmpty.data.import_log_id
  }, guru1Token);
  if (confEmpty.data.success_rows !== 0) {
    throw new Error("Expected confirm success_rows to be 0 for skipped row but got: " + confEmpty.data.success_rows);
  }
  var skippedProcessed = confEmpty.data.processed_rows[0];
  if (!skippedProcessed || skippedProcessed.action !== 'skipped') {
    throw new Error("Expected action for empty score row to be 'skipped'.");
  }
  
  console.log("6. Testing Revalidation (Preview PASS, Lock before confirm, Confirm FAIL)...");
  var csvReval = "nisn,assessment_id,score,note\n" + nisn1 + "," + pubAss.id + ",90,revalidation test";
  var sessReval = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'reval_import.csv',
    csv_content: csvReval
  }, guru1Token);
  if (sessReval.data.invalid_rows !== 0) {
    throw new Error("Expected preview to pass.");
  }
  
  // Lock the assessment now
  assertSprint11RouteSuccess('lock_academic_assessment', { id: pubAss.id }, adminToken);
  
  // Attempt to confirm -> should fail revalidation because assessment is locked
  var confirmRes = JSON.parse(route({
    action: 'confirm_import_data',
    payload: { import_log_id: sessReval.data.import_log_id },
    token: guru1Token
  }).getContent());
  
  // Wait, does it throw error or return failed status?
  // Let's check implementation: if no valid rows remain to import, confirmImportData throws Error("No valid rows to import.")
  if (confirmRes.status !== 'error' || confirmRes.message !== "No valid rows to import.") {
    throw new Error("Expected confirmation to fail revalidation because assessment was locked. Got: " + JSON.stringify(confirmRes));
  }
  
  console.log("7. Testing Semester Finalization validation...");
  // Re-publish assessment for clean finalization check
  var pubAss2 = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Published Ass 2 ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken).data;
  assertSprint11RouteSuccess('publish_academic_assessment', { id: pubAss2.id }, adminToken);
  
  // Finalize semester
  assertSprint11RouteSuccess('finalize_semester_reports', {
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);
  
  var csvFinalized = "nisn,assessment_id,score,note\n" + nisn1 + "," + pubAss2.id + ",90,finalized test";
  var sessFinalized = assertSprint11RouteSuccess('create_import_session', {
    import_type: 'academic_scores',
    file_name: 'finalized_import.csv',
    csv_content: csvFinalized
  }, guru1Token);
  if (!sessFinalized.data.errors.some(function(e) { return e.error_code === 'ERR_SEMESTER_FINALIZED'; })) {
    throw new Error("Expected finalized semester import to fail with ERR_SEMESTER_FINALIZED.");
  }
  
  console.log("SPRINT 11.6A ACADEMIC IMPORT QA PASSED");
}
