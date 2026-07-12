/**
 * ImportTests.gs
 * QA and verification suite for Sprint 9 Backend Import Foundation.
 */

function test_runSprint9QA() {
  console.log(" STARTING SPRINT 9 QA TEST SUITE ");

  runSprint9SmokeRegression();

  console.log("Running Sprint 9 import tests...");

  var suffix = String(Math.floor(Math.random() * 100000));
  var ctx = setupSprint9TestContext(suffix);
  
  // 1. Import session validation
  test_importSessionCreation(ctx, suffix);
  console.log("Import session validation successful.");
  
  // 2. CSV preview validation
  test_importPreviewValidation(ctx, suffix);
  console.log("CSV preview validation successful.");
  
  // 3. Error report validation
  test_importErrorReportValidation(ctx, suffix);
  console.log("Error report validation successful.");
  
  // 4. Student import validation
  test_studentImportValidation(ctx, suffix);
  console.log("Student import validation successful.");
  
  // 5. Teacher import validation
  test_teacherImportValidation(ctx, suffix);
  console.log("Teacher import validation successful.");
  
  // 6. Class import validation
  test_classImportValidation(ctx, suffix);
  console.log("Class import validation successful.");
  
  // 7. Subject import validation
  test_subjectImportValidation(ctx, suffix);
  console.log("Subject import validation successful.");
  
  // 8. Class subject import validation
  test_classSubjectImportValidation(ctx, suffix);
  console.log("Class subject import validation successful.");
  
  // 9. Import log validation
  test_importLogValidation(ctx);
  console.log("Import log validation successful.");
  
  // 10. Import security validation
  test_importSecurityValidation(ctx, suffix);
  console.log("Import security validation successful.");
  
  console.log(" SPRINT 9 QA TEST SUITE PASSED ");
}

/** Focused mock QA for list_import_logs uploader enrichment. */
function test_importLogUploaderNameQA() {
  setupDatabase();
  seedInitialData();

  var admin = getSprint9QaAdmin();
  var prefix = 'uploader-name-' + String(Math.floor(Math.random() * 100000));
  createRecord(SHEETS.IMPORT_LOGS, {
    import_type: 'students', file_name: prefix + '-known.csv', drive_file_id: '',
    uploaded_by: admin.id, total_rows: 2, success_rows: 1, error_rows: 1,
    error_report_file_id: '', status: 'partial_success', error_summary: ''
  }, admin);
  createRecord(SHEETS.IMPORT_LOGS, {
    import_type: 'students', file_name: prefix + '-missing.csv', drive_file_id: '',
    uploaded_by: 'USR_MISSING_UPLOADER_QA', total_rows: 1, success_rows: 0, error_rows: 1,
    error_report_file_id: '', status: 'failed', error_summary: ''
  }, admin);

  var known = listImportLogs({ import_type: 'students', status: 'partial_success', page: 1, page_size: 1 }, admin);
  if (known.logs.length !== 1 || known.logs[0].uploader_name !== admin.name) {
    throw new Error('Focused QA: uploader_name resolution failed.');
  }
  if (known.page !== 1 || known.page_size !== 1 || known.total_pages < 1) {
    throw new Error('Focused QA: filter or pagination metadata failed.');
  }

  var missing = listImportLogs({ import_type: 'students', status: 'failed', page: 1, page_size: 100 }, admin);
  var fallback = missing.logs.filter(function(log) { return log.file_name === prefix + '-missing.csv'; })[0];
  if (!fallback || fallback.uploader_name !== fallback.uploaded_by) {
    throw new Error('Focused QA: missing uploader fallback failed.');
  }

  console.log('LIST IMPORT LOGS UPLOADER NAME QA PASSED');
}

function runSprint9SmokeRegression() {
  setupDatabase();
  seedInitialData();

  runSmokeRegressionSprint1();
  runSmokeRegressionSprint2();
  runSmokeRegressionSprint3();
  runSmokeRegressionSprint4();

  var smokeCtx = setupSprint9SmokeContext();
  runSmokeRegressionSprint5(smokeCtx);
  runSmokeRegressionSprint6();
  runSmokeRegressionSprint7(smokeCtx);
  runSmokeRegressionSprint8();
}

function runSmokeRegressionSprint1() {
  console.log("Running Sprint 1 smoke regression...");

  var admin = getSprint9QaAdmin();
  resetFailedLogin(admin);

  assertSprint9SmokeRouteSuccess('health_check', {}, "Sprint 1 health_check smoke regression failed.");
  assertSprint9SmokeRouteSuccess('login', {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Sprint9-QA-Smoke'
  }, "Sprint 1 admin login smoke regression failed.");

  console.log("Sprint 1 smoke regression passed.");
}

function runSmokeRegressionSprint2() {
  console.log("Running Sprint 2 smoke regression...");

  var admin = getSprint9QaAdmin();
  var payload = { actor_user_id: admin.id };

  assertSprint9SmokeRouteSuccess('list_academic_years', payload, "Sprint 2 list_academic_years smoke regression failed.");
  assertSprint9SmokeRouteSuccess('list_classes', payload, "Sprint 2 list_classes smoke regression failed.");
  assertSprint9SmokeRouteSuccess('list_subjects', payload, "Sprint 2 list_subjects smoke regression failed.");
  assertSprint9SmokeRouteSuccess('get_app_settings', payload, "Sprint 2 get_app_settings smoke regression failed.");

  console.log("Sprint 2 smoke regression passed.");
}

function runSmokeRegressionSprint3() {
  console.log("Running Sprint 3 smoke regression...");

  var admin = getSprint9QaAdmin();
  var payload = { actor_user_id: admin.id };

  assertSprint9SmokeRouteSuccess('list_students', payload, "Sprint 3 list_students smoke regression failed.");
  assertSprint9SmokeRouteSuccess('list_student_enrollments', payload, "Sprint 3 list_student_enrollments smoke regression failed.");

  console.log("Sprint 3 smoke regression passed.");
}

function runSmokeRegressionSprint4() {
  console.log("Running Sprint 4 smoke regression...");

  var admin = getSprint9QaAdmin();
  assertSprint9SmokeRouteSuccess('list_academic_assessments', {
    actor_user_id: admin.id
  }, "Sprint 4 list_academic_assessments smoke regression failed.");

  console.log("Sprint 4 smoke regression passed.");
}

function runSmokeRegressionSprint5(ctx) {
  console.log("Running Sprint 5 smoke regression...");

  assertSprint9SmokeRouteSuccess('get_class_character_summary', {
    actor_user_id: ctx.admin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    week_start_date: '2026-06-15'
  }, "Sprint 5 get_class_character_summary smoke regression failed.");

  console.log("Sprint 5 smoke regression passed.");
}

function runSmokeRegressionSprint6() {
  console.log("Running Sprint 6 smoke regression...");

  var admin = getSprint9QaAdmin();
  assertSprint9SmokeRouteSuccess('get_school_dashboard', {
    actor_user_id: admin.id
  }, "Sprint 6 get_school_dashboard smoke regression failed.");

  console.log("Sprint 6 smoke regression passed.");
}

function runSmokeRegressionSprint7(ctx) {
  console.log("Running Sprint 7 smoke regression...");

  assertSprint9SmokeRouteSuccess('setup_storage_folders', {
    actor_user_id: ctx.admin.id
  }, "Sprint 7 setup_storage_folders smoke regression failed.");

  console.log("Sprint 7 smoke regression passed.");
}

function runSmokeRegressionSprint8() {
  console.log("Running Sprint 8 smoke regression...");

  var result = JSON.parse(route({
    action: 'parent_verify_access',
    payload: {
      nisn: '0000000000',
      birth_date: '1900-01-01',
      pin: '0000',
      ip_address: '127.0.0.1',
      user_agent: 'Sprint9-QA-Smoke'
    }
  }).getContent());

  if (result.status !== 'error' || result.message !== 'Data akses tidak valid.') {
    throw new Error("Sprint 8 parent_verify_access smoke regression failed. Response: " + JSON.stringify(result));
  }

  console.log("Sprint 8 smoke regression passed.");
}

function setupSprint9SmokeContext() {
  var admin = getSprint9QaAdmin();
  var suffix = createSprint9QaRunSuffix();
  var period = ensureSprint9SmokeActivePeriod(admin, suffix);

  var classRes = assertSprint9SmokeRouteSuccess('create_class', {
    actor_user_id: admin.id,
    code: 'CLS_S9_SMOKE_' + suffix,
    name: 'Kelas S9 Smoke ' + suffix,
    level: '5'
  }, "Sprint 9 smoke context class creation failed.");

  var studentRes = assertSprint9SmokeRouteSuccess('create_student', {
    actor_user_id: admin.id,
    nisn: createSprint9QaNisn(),
    nik: '9000000000000001',
    full_name: 'Siswa S9 Smoke ' + suffix,
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '1234'
  }, "Sprint 9 smoke context student creation failed.");

  assertSprint9SmokeRouteSuccess('create_student_enrollment', {
    actor_user_id: admin.id,
    student_id: studentRes.data.id,
    class_id: classRes.data.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    status: 'active'
  }, "Sprint 9 smoke context enrollment creation failed.");

  return {
    admin: admin,
    classId: classRes.data.id,
    studentId: studentRes.data.id,
    yearId: period.yearId,
    semesterId: period.semesterId
  };
}

function ensureSprint9SmokeActivePeriod(admin, suffix) {
  var settings = getAppSettings();
  var yearId = settings.active_academic_year_id;
  var semesterId = settings.active_semester_id;

  if (!yearId) {
    var existingYears = listRecords(SHEETS.ACADEMIC_YEARS);
    if (existingYears.length > 0) {
      yearId = existingYears[0].id;
    } else {
      var yearRes = assertSprint9SmokeRouteSuccess('create_academic_year', {
        actor_user_id: admin.id,
        name: 'AY_S9_SMOKE_' + suffix,
        start_date: '2026-07-01',
        end_date: '2027-06-30'
      }, "Sprint 9 smoke active year creation failed.");
      yearId = yearRes.data.id;
    }
    assertSprint9SmokeRouteSuccess('set_active_academic_year', {
      actor_user_id: admin.id,
      id: yearId
    }, "Sprint 9 smoke active year setup failed.");
  }

  if (!semesterId) {
    var existingSemesters = listRecords(SHEETS.SEMESTERS, function(semester) {
      return semester.academic_year_id === yearId;
    });
    if (existingSemesters.length > 0) {
      semesterId = existingSemesters[0].id;
    } else {
      var semRes = assertSprint9SmokeRouteSuccess('create_semester', {
        actor_user_id: admin.id,
        academic_year_id: yearId,
        name: 'Ganjil',
        start_date: '2026-07-01',
        end_date: '2026-12-31'
      }, "Sprint 9 smoke active semester creation failed.");
      semesterId = semRes.data.id;
    }
    assertSprint9SmokeRouteSuccess('set_active_semester', {
      actor_user_id: admin.id,
      id: semesterId
    }, "Sprint 9 smoke active semester setup failed.");
  }

  return {
    yearId: yearId,
    semesterId: semesterId
  };
}

function getSprint9QaAdmin() {
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Default admin user not found. Ensure database is setup and seeded.");
  }
  return admin;
}

function assertSprint9SmokeRouteSuccess(action, payload, errorMessage) {
  var result = JSON.parse(route({
    action: action,
    payload: payload || {}
  }).getContent());

  if (result.status !== 'success') {
    throw new Error(errorMessage + " Response: " + JSON.stringify(result));
  }

  return result;
}

function createSprint9QaRunSuffix() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function createSprint9QaNisn() {
  var nisn;
  var exists = true;

  while (exists) {
    nisn = String(Math.floor(9000000000 + Math.random() * 1000000000));
    exists = listRecords(SHEETS.STUDENTS, function(student) {
      return String(student.nisn) === nisn;
    }).length > 0;
  }

  return nisn;
}

/**
 * Sets up base test parameters.
 */
function setupSprint9TestContext(suffix) {
  var admin = getUserByIdentifier('admin');
  
  // Create a dummy teacher to test authorization block
  var teacher = createRecord(SHEETS.USERS, {
    name: 'Guru S9 QA ' + suffix,
    email: 'guru_s9_qa_' + suffix + '@example.com',
    username: 'guru_s9_qa_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });
  
  return {
    admin: admin,
    teacher: teacher
  };
}

/**
 * 1. Test create_import_session
 */
function test_importSessionCreation(ctx, suffix) {
  var nisnA = createSprint9QaNisn();
  var nisnB = createSprint9QaNisn();
  while (nisnB === nisnA) {
    nisnB = createSprint9QaNisn();
  }
  var csvContent = "nisn,full_name,birth_date,gender,status\n" +
                   nisnA + ",Siswa S9 A " + suffix + ",2015-05-15,L,Aktif\n" +
                   nisnB + ",Siswa S9 B " + suffix + ",2015-06-16,P,Aktif";
                   
  // Admin makes import session -> Success
  var resAdmin = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      actor_user_id: ctx.admin.id,
      import_type: 'students',
      file_name: 'test_students_' + suffix + '.csv',
      csv_content: csvContent
    }
  }).getContent());
  
  if (resAdmin.status !== 'success' || !resAdmin.data.import_log_id) {
    throw new Error("Admin failed to create import session: " + JSON.stringify(resAdmin));
  }
  ctx.importLogId = resAdmin.data.import_log_id;
  
  // Guru makes import session -> Rejected
  var resGuru = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      actor_user_id: ctx.teacher.id,
      import_type: 'students',
      file_name: 'test_students_' + suffix + '.csv',
      csv_content: csvContent
    }
  }).getContent());
  
  if (resGuru.status !== 'error' || resGuru.code !== 'ERR_FORBIDDEN') {
    throw new Error("Security breach: Guru was allowed to create an import session.");
  }
}

/**
 * 2. Test preview_import_data
 */
function test_importPreviewValidation(ctx, suffix) {
  var res = JSON.parse(route({
    action: 'preview_import_data',
    payload: {
      actor_user_id: ctx.admin.id,
      import_log_id: ctx.importLogId
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to preview import data: " + res.message);
  }
  
  var data = res.data;
  if (data.total_rows !== 2 || data.valid_rows !== 2 || data.invalid_rows !== 0) {
    throw new Error("Import preview row count calculation mismatch. Got: " + JSON.stringify(data));
  }
}

/**
 * 3. Test error report creation
 */
function test_importErrorReportValidation(ctx, suffix) {
  // Upload CSV containing errors (invalid birth_date format and duplicate NISN in file)
  var duplicateNisn = createSprint9QaNisn();
  var badCsvContent = "nisn,full_name,birth_date,gender,status\n" +
                      duplicateNisn + ",Siswa Bad A,2015/05/15,L,Aktif\n" +
                      duplicateNisn + ",Siswa Bad B,2015-05-15,P,Aktif";
                      
  var res = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      actor_user_id: ctx.admin.id,
      import_type: 'students',
      file_name: 'bad_students_' + suffix + '.csv',
      csv_content: badCsvContent
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to create bad import session.");
  }
  
  var data = res.data;
  if (data.invalid_rows !== 2 || !data.error_report_file_id) {
    throw new Error("Error report file was not generated or invalid rows count incorrect. Got: " + JSON.stringify(data));
  }
  
  // Verify error report file is downloadable
  var downloadRes = JSON.parse(route({
    action: 'download_import_error_report',
    payload: {
      actor_user_id: ctx.admin.id,
      error_report_file_id: data.error_report_file_id
    }
  }).getContent());
  
  if (downloadRes.status !== 'success' || !downloadRes.data.base64_content) {
    throw new Error("Failed to retrieve error report download URL.");
  }
}

/**
 * 4. Test student import upsert
 */
function test_studentImportValidation(ctx, suffix) {
  var nisn1 = createSprint9QaNisn();
  var csvContent = "nisn,full_name,birth_date,gender,status,parent_pin\n" +
                   nisn1 + ",Siswa S9 Student A " + suffix + ",2015-05-15,L,Aktif,1234";
                   
  var sessionRes = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'students', file_name: 'stud_imp_' + suffix + '.csv', csv_content: csvContent }
  }).getContent());
  
  var previewRes = JSON.parse(route({
    action: 'preview_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes.data.import_log_id }
  }).getContent());
  
  var confirmRes = JSON.parse(route({
    action: 'confirm_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes.data.import_log_id }
  }).getContent());
  
  if (
    confirmRes.status !== 'success' ||
    confirmRes.data.imported_rows !== 1 ||
    confirmRes.data.total_rows !== 1 ||
    confirmRes.data.success_rows !== 1 ||
    confirmRes.data.error_rows !== 0 ||
    !confirmRes.data.imported_ids ||
    confirmRes.data.imported_ids.length !== 1 ||
    !confirmRes.data.processed_rows ||
    confirmRes.data.processed_rows.length !== 1
  ) {
    logSprint9StudentImportDebug(nisn1, sessionRes, previewRes, confirmRes, []);
    throw new Error("Student import confirmation failed: " + JSON.stringify(confirmRes));
  }
  
  // Verify in database
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return String(s.nisn).trim() === String(nisn1).trim();
  });
  if (students.length === 0) {
    logSprint9StudentImportDebug(nisn1, sessionRes, previewRes, confirmRes, students);
    throw new Error("Imported student was not found in the database.");
  }
  var student = students[0];
  if (!student.parent_access_pin_hash) {
    throw new Error("Imported parent_pin was not hashed and stored.");
  }
  
  // Upsert check: import same student with updated full name
  var csvContent2 = "nisn,full_name,birth_date,gender,status\n" +
                    nisn1 + ",Siswa S9 Student A Updated " + suffix + ",2015-05-15,L,Aktif";
                    
  var sessionRes2 = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'students', file_name: 'stud_imp2_' + suffix + '.csv', csv_content: csvContent2 }
  }).getContent());
  
  var confirmRes2 = JSON.parse(route({
    action: 'confirm_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes2.data.import_log_id }
  }).getContent());
  if (confirmRes2.status !== 'success' || confirmRes2.data.success_rows !== 1 || confirmRes2.data.error_rows !== 0) {
    logSprint9StudentImportDebug(nisn1, sessionRes2, null, confirmRes2, students);
    throw new Error("Student upsert import failed: " + JSON.stringify(confirmRes2));
  }
  
  var students2 = listRecords(SHEETS.STUDENTS, function(s) {
    return String(s.nisn).trim() === String(nisn1).trim();
  });
  if (students2.length !== 1) {
    logSprint9StudentImportDebug(nisn1, sessionRes2, null, confirmRes2, students2);
    throw new Error("Student import upsert created duplicate rows.");
  }
  if (students2[0].full_name !== "Siswa S9 Student A Updated " + suffix) {
    logSprint9StudentImportDebug(nisn1, sessionRes2, null, confirmRes2, students2);
    throw new Error("Upsert update failed to refresh student full name. Got: " + students2[0].full_name);
  }
}

function logSprint9StudentImportDebug(expectedNisn, sessionResponse, previewResponse, confirmResponse, matches) {
  logSprint9ImportDebug("Expected imported NISN: " + expectedNisn);
  logSprint9ImportDebug("Response create_import_session: " + JSON.stringify(sessionResponse));
  logSprint9ImportDebug("Response preview_import_data: " + JSON.stringify(previewResponse));
  logSprint9ImportDebug("Response confirm_import_data: " + JSON.stringify(confirmResponse));
  logSprint9ImportDebug("Matched student rows: " + JSON.stringify(matches || []));
  
  if (!matches || matches.length === 0) {
    var allStudents = listRecords(SHEETS.STUDENTS);
    logSprint9ImportDebug("Last 5 student rows: " + JSON.stringify(allStudents.slice(Math.max(allStudents.length - 5, 0))));
  }
}

function logSprint9ImportDebug(message) {
  console.log(message);
  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(message);
  }
}

/**
 * 5. Test teacher import
 */
function test_teacherImportValidation(ctx, suffix) {
  var email = "guru_s9_imp_" + suffix + "@example.com";
  var csvContent = "email,username,full_name,phone,position,address\n" +
                   email + ",guru_s9_imp_" + suffix + ",Guru S9 Import " + suffix + ",0812,Wali Kelas,Bandung";
                   
  var sessionRes = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'teachers', file_name: 'teach_imp_' + suffix + '.csv', csv_content: csvContent }
  }).getContent());
  
  var confirmRes = JSON.parse(route({
    action: 'confirm_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes.data.import_log_id }
  }).getContent());
  
  if (confirmRes.status !== 'success') {
    throw new Error("Teacher import confirmation failed.");
  }
  
  // Verify User & Profile exists
  var user = getUserByIdentifier(email);
  if (!user || user.role !== ROLES.TEACHER) {
    throw new Error("Imported teacher user record not found or incorrect role.");
  }
  
  var profiles = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
    return p.user_id === user.id;
  });
  if (profiles.length === 0) {
    throw new Error("Imported teacher profile record was not created.");
  }
}

/**
 * 6. Test class import
 */
function test_classImportValidation(ctx, suffix) {
  var code = "CLS_S9_IMP_" + suffix;
  var csvContent = "code,name,level\n" +
                   code + ",Kelas S9 Imp " + suffix + ",5";
                   
  var sessionRes = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'classes', file_name: 'class_imp_' + suffix + '.csv', csv_content: csvContent }
  }).getContent());
  
  route({
    action: 'confirm_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes.data.import_log_id }
  });
  
  var records = listRecords(SHEETS.CLASSES, function(c) { return c.code === code; });
  if (records.length === 0) {
    throw new Error("Imported class was not found in sheet.");
  }
}

/**
 * 7. Test subject import
 */
function test_subjectImportValidation(ctx, suffix) {
  var code = "SBJ_S9_IMP_" + suffix;
  var csvContent = "code,name,description\n" +
                   code + ",Mapel S9 Imp " + suffix + ",Mapel Desc";
                   
  var sessionRes = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'subjects', file_name: 'subj_imp_' + suffix + '.csv', csv_content: csvContent }
  }).getContent());
  
  route({
    action: 'confirm_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes.data.import_log_id }
  });
  
  var records = listRecords(SHEETS.SUBJECTS, function(s) { return s.code === code; });
  if (records.length === 0) {
    throw new Error("Imported subject was not found in sheet.");
  }
}

/**
 * 8. Test class subject import
 */
function test_classSubjectImportValidation(ctx, suffix) {
  // Retrieve names of active academic year & semester
  var year = getActiveAcademicYear();
  var sem = getActiveSemester(year.id);
  
  var classCode = "CLS_S9_CS_" + suffix;
  var subjectCode = "SBJ_S9_CS_" + suffix;
  
  // Create dependencies
  createRecord(SHEETS.CLASSES, { code: classCode, name: 'CS Class', level: '5', status: STATUS.ACTIVE });
  createRecord(SHEETS.SUBJECTS, { code: subjectCode, name: 'CS Subject', status: STATUS.ACTIVE });
  
  var csvContent = "class_code,subject_code,academic_year,semester\n" +
                   classCode + "," + subjectCode + "," + year.name + "," + sem.name;
                   
  var sessionRes = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'class_subjects', file_name: 'cs_imp_' + suffix + '.csv', csv_content: csvContent }
  }).getContent());
  
  if (sessionRes.data.invalid_rows > 0) {
    throw new Error("Class subject import validation failed unexpectedly: " + JSON.stringify(sessionRes.data.errors));
  }
  
  var confirmRes = JSON.parse(route({
    action: 'confirm_import_data',
    payload: { actor_user_id: ctx.admin.id, import_log_id: sessionRes.data.import_log_id }
  }).getContent());
  
  if (confirmRes.status !== 'success') {
    throw new Error("Class subject import confirmation failed.");
  }
}

/**
 * 9. Test import log lookups
 */
function test_importLogValidation(ctx) {
  var res = JSON.parse(route({
    action: 'get_import_log',
    payload: {
      actor_user_id: ctx.admin.id,
      import_log_id: ctx.importLogId
    }
  }).getContent());
  
  if (res.status !== 'success' || res.data.id !== ctx.importLogId) {
    throw new Error("Failed to get import log details.");
  }

  var listRes = JSON.parse(route({
    action: 'list_import_logs',
    payload: {
      actor_user_id: ctx.admin.id,
      import_type: 'students',
      page: 1,
      page_size: 1
    }
  }).getContent());

  if (listRes.status !== 'success' || listRes.data.logs.length !== 1) {
    throw new Error("Import log filtering or pagination failed.");
  }
  if (listRes.data.logs[0].uploader_name !== ctx.admin.name) {
    throw new Error("Import log uploader_name was not resolved from users.");
  }
  if (listRes.data.page !== 1 || listRes.data.page_size !== 1 || listRes.data.total_pages < 1) {
    throw new Error("Import log pagination metadata is invalid.");
  }

  var missingUserId = 'USR_MISSING_SPRINT9_QA';
  createRecord(SHEETS.IMPORT_LOGS, {
    import_type: 'subjects',
    file_name: 'missing-uploader.csv',
    drive_file_id: '',
    uploaded_by: missingUserId,
    total_rows: 0,
    success_rows: 0,
    error_rows: 0,
    error_report_file_id: '',
    status: 'failed',
    error_summary: 'QA fallback record'
  }, ctx.admin);

  var fallbackRes = JSON.parse(route({
    action: 'list_import_logs',
    payload: {
      actor_user_id: ctx.admin.id,
      import_type: 'subjects',
      status: 'failed',
      page: 1,
      page_size: 100
    }
  }).getContent());
  var fallbackLog = fallbackRes.data.logs.filter(function(log) {
    return log.uploaded_by === missingUserId;
  })[0];

  if (!fallbackLog || fallbackLog.uploader_name !== missingUserId) {
    throw new Error("Import log uploader_name fallback is unsafe.");
  }
}

/**
 * 10. Test import security block
 */
function test_importSecurityValidation(ctx, suffix) {
  var nisnVal = createSprint9QaNisn();
  
  // Try importing a forbidden field: parent_access_pin_hash
  var csvContent = "nisn,full_name,birth_date,gender,status,parent_access_pin_hash\n" +
                   nisnVal + ",Siswa S9 Sec A,2015-05-15,L,Aktif,somehashedvalue";
                   
  var sessionRes = JSON.parse(route({
    action: 'create_import_session',
    payload: { actor_user_id: ctx.admin.id, import_type: 'students', file_name: 'sec_imp_' + suffix + '.csv', csv_content: csvContent }
  }).getContent());
  
  if (sessionRes.data.invalid_rows === 0) {
    throw new Error("Security check failed: Forbidden field 'parent_access_pin_hash' was not blocked.");
  }
  
  var hasForbiddenError = sessionRes.data.errors.some(function(e) {
    return e.error_code === 'ERR_FORBIDDEN_FIELD' && e.field === 'parent_access_pin_hash';
  });
  if (!hasForbiddenError) {
    throw new Error("Forbidden field error code or message incorrect. Got: " + JSON.stringify(sessionRes.data.errors));
  }
}
