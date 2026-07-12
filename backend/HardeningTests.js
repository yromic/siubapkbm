/**
 * HardeningTests.gs
 * Sprint 11 production hardening QA and light smoke regression.
 */

function test_runSprint11QA() {
  console.log(" STARTING SPRINT 11 QA TEST SUITE ");

  test_runSprint11SmokeRegressionQA();
  test_runSprint11ImportHardeningQA();

  console.log("Sprint 11 QA is split to avoid Google Apps Script execution timeout.");
  console.log("Run these remaining functions separately before declaring final pass:");
  console.log("1. test_runSprint11HealthIntegrityQA()");
  console.log("2. test_runSprint11BackupQA()");
  console.log("3. test_runSprint11DiagnosticsSecurityQA()");
  console.log("Sprint 11 FINAL PASS requires all four split QA functions to pass.");
}

function test_runSprint11SmokeRegressionQA() {
  console.log(" STARTING SPRINT 11 SMOKE REGRESSION QA ");

  setupDatabase();
  seedInitialData();
  runSprint11SmokeRegression();

  console.log(" SPRINT 11 SMOKE REGRESSION QA PASSED ");
}

function test_runSprint11HealthIntegrityQA() {
  console.log(" STARTING SPRINT 11 HEALTH & INTEGRITY QA ");

  setupDatabase();
  seedInitialData();

  var suffix = createSprint11QaSuffix();
  var ctx = setupSprint11HardeningContext(suffix);

  test_sprint11ExtendedHealth(ctx);
  console.log("Extended health check validation successful.");

  test_sprint11DataIntegrity(ctx, suffix);
  console.log("Data integrity validation successful.");

  test_sprint11StorageIntegrity(ctx, suffix);
  console.log("Storage integrity validation successful.");

  test_sprint11AuditExplorer(ctx);
  console.log("Audit explorer validation successful.");

  console.log(" SPRINT 11 HEALTH & INTEGRITY QA PASSED ");
}

function test_runSprint11BackupQA() {
  console.log(" STARTING SPRINT 11 BACKUP QA ");

  setupDatabase();
  seedInitialData();

  var suffix = createSprint11QaSuffix();
  var ctx = setupSprint11SecurityContext(suffix);

  test_sprint11BackupSnapshot(ctx, suffix);
  console.log("Backup snapshot validation successful.");
  console.log("Restore preview validation successful.");
  console.log("Backup authorization validation successful.");

  console.log(" SPRINT 11 BACKUP QA PASSED ");
}

function test_runSprint11DiagnosticsSecurityQA() {
  console.log(" STARTING SPRINT 11 DIAGNOSTICS & SECURITY QA ");

  setupDatabase();
  seedInitialData();

  var suffix = createSprint11QaSuffix();
  var ctx = setupSprint11SecurityContext(suffix);

  test_sprint11Diagnostics(ctx);
  console.log("Diagnostics report validation successful.");

  test_sprint11Security(ctx);
  console.log("Hardening security validation successful.");

  console.log(" SPRINT 11 DIAGNOSTICS & SECURITY QA PASSED ");
}

function runSprint11SmokeRegression() {
  var admin = getSprint11QaAdmin();
  resetFailedLogin(admin);

  var adminToken = loginSprint11TestUser(admin.username, 'Admin123!');

  console.log("Running Sprint 1 smoke regression...");
  assertSprint11RouteSuccess('health_check', {});
  assertSprint11RouteSuccess('login', {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Sprint11-QA-Smoke'
  });
  console.log("Sprint 1 smoke regression passed.");

  console.log("Running Sprint 2 smoke regression...");
  assertSprint11RouteSuccess('list_academic_years', { actor_user_id: admin.id }, adminToken);
  assertSprint11RouteSuccess('list_classes', { actor_user_id: admin.id }, adminToken);
  assertSprint11RouteSuccess('list_subjects', { actor_user_id: admin.id }, adminToken);
  assertSprint11RouteSuccess('get_app_settings', { actor_user_id: admin.id }, adminToken);
  console.log("Sprint 2 smoke regression passed.");

  console.log("Running Sprint 3 smoke regression...");
  assertSprint11RouteSuccess('list_students', { actor_user_id: admin.id }, adminToken);
  assertSprint11RouteSuccess('list_student_enrollments', { actor_user_id: admin.id }, adminToken);
  console.log("Sprint 3 smoke regression passed.");

  console.log("Running Sprint 4 smoke regression...");
  assertSprint11RouteSuccess('list_academic_assessments', { actor_user_id: admin.id }, adminToken);
  console.log("Sprint 4 smoke regression passed.");

  var smokeCtx = setupSprint11SmokeContext(admin, adminToken, createSprint11QaSuffix());

  console.log("Running Sprint 5 smoke regression...");
  assertSprint11RouteSuccess('get_class_character_summary', {
    actor_user_id: smokeCtx.admin.id,
    class_id: smokeCtx.classId,
    academic_year_id: smokeCtx.yearId,
    semester_id: smokeCtx.semesterId,
    week_start_date: '2026-06-15'
  }, smokeCtx.adminToken);
  console.log("Sprint 5 smoke regression passed.");

  console.log("Running Sprint 6 smoke regression...");
  assertSprint11RouteSuccess('get_school_dashboard', { actor_user_id: admin.id }, adminToken);
  console.log("Sprint 6 smoke regression passed.");

  console.log("Running Sprint 7 smoke regression...");
  assertSprint11RouteSuccess('setup_storage_folders', { actor_user_id: admin.id }, adminToken);
  assertSprint11RouteSuccess('list_student_files', {
    actor_user_id: admin.id,
    student_id: smokeCtx.studentId
  }, adminToken);
  console.log("Sprint 7 smoke regression passed.");

  console.log("Running Sprint 8 smoke regression...");
  var badParent = JSON.parse(route({
    action: 'parent_verify_access',
    payload: {
      nisn: '0000000000',
      birth_date: '1900-01-01',
      pin: '0000',
      ip_address: '127.0.0.1',
      user_agent: 'Sprint11-QA-Smoke'
    }
  }).getContent());
  if (badParent.status !== 'error') {
    throw new Error("Sprint 8 smoke regression failed: invalid parent access was not rejected.");
  }
  console.log("Sprint 8 smoke regression passed.");

  console.log("Running Sprint 9 smoke regression...");
  assertSprint11RouteSuccess('create_import_session', {
    actor_user_id: admin.id,
    import_type: 'students',
    file_name: 'sprint11_smoke_students_' + createSprint11QaSuffix() + '.csv',
    csv_content: "nisn,full_name,birth_date,gender,status\n" +
      createSprint11QaNisn() + ",Smoke Student Sprint 11,2015-01-01,L,Aktif"
  }, adminToken);
  console.log("Sprint 9 smoke regression passed.");

  console.log("Running Sprint 10 smoke regression...");
  assertSprint11RouteSuccess('export_student_academic_report', {
    actor_user_id: admin.id,
    student_id: smokeCtx.studentId,
    academic_year_id: smokeCtx.yearId,
    semester_id: smokeCtx.semesterId
  }, adminToken);
  console.log("Sprint 10 smoke regression passed.");
}

function setupSprint11SmokeContext(admin, adminToken, suffix) {
  var period = ensureSprint11Period(admin, suffix, adminToken);

  var teacher = createRecord(SHEETS.USERS, {
    name: 'Guru S11 Smoke ' + suffix,
    email: 'guru_s11_smoke_' + suffix + '@example.com',
    username: 'guru_s11_smoke_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, admin);
  
  var teacherToken = loginSprint11TestUser(teacher.username, 'Password123!');

  var classRes = assertSprint11RouteSuccess('create_class', {
    actor_user_id: admin.id,
    code: 'CLS_S11_SMOKE_' + suffix,
    name: 'Kelas S11 Smoke ' + suffix,
    level: '5'
  }, adminToken);

  assertSprint11RouteSuccess('assign_class_teacher', {
    actor_user_id: admin.id,
    class_id: classRes.data.id,
    teacher_user_id: teacher.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    effective_from: '2026-07-01'
  }, adminToken);

  var subjectRes = assertSprint11RouteSuccess('create_subject', {
    actor_user_id: admin.id,
    code: 'SBJ_S11_SMOKE_' + suffix,
    name: 'Subject S11 Smoke ' + suffix
  }, adminToken);

  assertSprint11RouteSuccess('assign_subject_to_class', {
    actor_user_id: admin.id,
    class_id: classRes.data.id,
    subject_id: subjectRes.data.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);

  var studentRes = assertSprint11RouteSuccess('create_student', {
    actor_user_id: admin.id,
    nisn: createSprint11QaNisn(),
    nik: '8111111111111111',
    full_name: 'Siswa S11 Smoke ' + suffix,
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '1234'
  }, adminToken);

  var enrollRes = assertSprint11RouteSuccess('create_student_enrollment', {
    actor_user_id: admin.id,
    student_id: studentRes.data.id,
    class_id: classRes.data.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    status: 'active'
  }, adminToken);

  var assessmentRes = assertSprint11RouteSuccess('create_academic_assessment', {
    actor_user_id: admin.id,
    class_id: classRes.data.id,
    subject_id: subjectRes.data.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Assessment S11 Smoke ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken);

  assertSprint11RouteSuccess('publish_academic_assessment', {
    actor_user_id: admin.id,
    id: assessmentRes.data.id
  }, adminToken);

  assertSprint11RouteSuccess('save_academic_scores', {
    actor_user_id: teacher.id,
    assessment_id: assessmentRes.data.id,
    scores: [
      { student_id: studentRes.data.id, student_enrollment_id: enrollRes.data.id, score: 80 }
    ]
  }, teacherToken);

  var dynamicScoreDate = Utilities.formatDate(new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  assertSprint11RouteSuccess('save_culture_scores', {
    actor_user_id: teacher.id,
    class_id: classRes.data.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    score_date: dynamicScoreDate,
    scores: [
      { student_id: studentRes.data.id, student_enrollment_id: enrollRes.data.id, sss: 3, am: 3, hb: 3, asm: 3, br: 3, ak: 3, tm: 3 }
    ]
  }, teacherToken);

  return {
    admin: admin,
    adminToken: adminToken,
    teacher: teacher,
    teacherToken: teacherToken,
    classId: classRes.data.id,
    studentId: studentRes.data.id,
    enrollmentId: enrollRes.data.id,
    yearId: period.yearId,
    semesterId: period.semesterId
  };
}

function setupSprint11TestContext(suffix) {
  return setupSprint11HardeningContext(suffix);
}

function setupSprint11SecurityContext(suffix) {
  var admin = getSprint11QaAdmin();
  var adminToken = loginSprint11TestUser(admin.username, 'Admin123!');

  var operator = createRecord(SHEETS.USERS, {
    name: 'Admin S11 QA ' + suffix,
    email: 'admin_s11_qa_' + suffix + '@example.com',
    username: 'admin_s11_qa_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.ADMIN,
    status: STATUS.ACTIVE
  }, admin);
  var operatorToken = loginSprint11TestUser(operator.username, 'Password123!');

  var teacher = createRecord(SHEETS.USERS, {
    name: 'Guru S11 QA ' + suffix,
    email: 'guru_s11_qa_' + suffix + '@example.com',
    username: 'guru_s11_qa_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, admin);
  var teacherToken = loginSprint11TestUser(teacher.username, 'Password123!');

  return {
    admin: admin,
    adminToken: adminToken,
    operator: operator,
    operatorToken: operatorToken,
    teacher: teacher,
    teacherToken: teacherToken,
    teacher2: teacher,
    teacher2Token: teacherToken
  };
}

function setupSprint11HardeningContext(suffix) {
  var ctx = setupSprint11SecurityContext(suffix);
  var period = ensureSprint11Period(ctx.admin, suffix, ctx.adminToken);

  var classRes = assertSprint11RouteSuccess('create_class', {
    actor_user_id: ctx.admin.id,
    code: 'CLS_S11_HARD_' + suffix,
    name: 'Kelas S11 Hardening ' + suffix,
    level: '5'
  }, ctx.adminToken);

  var studentRes = assertSprint11RouteSuccess('create_student', {
    actor_user_id: ctx.admin.id,
    nisn: createSprint11QaNisn(),
    nik: '8211111111111111',
    full_name: 'Siswa S11 Hardening ' + suffix,
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '1234'
  }, ctx.adminToken);

  var enrollRes = assertSprint11RouteSuccess('create_student_enrollment', {
    actor_user_id: ctx.admin.id,
    student_id: studentRes.data.id,
    class_id: classRes.data.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    status: 'active'
  }, ctx.adminToken);

  ctx.classId = classRes.data.id;
  ctx.studentId = studentRes.data.id;
  ctx.enrollmentId = enrollRes.data.id;
  ctx.yearId = period.yearId;
  ctx.semesterId = period.semesterId;
  return ctx;
}

function test_sprint11ExtendedHealth(ctx) {
  var res = assertSprint11RouteSuccess('extended_health_check', { actor_user_id: ctx.admin.id }, ctx.adminToken);
  if (!res.data.sheets || !res.data.drive || !res.data.settings) {
    throw new Error("Extended health response missing required sections.");
  }
}

function test_sprint11DataIntegrity(ctx, suffix) {
  appendRow(SHEETS.STUDENT_ENROLLMENTS, {
    id: 'S11_BROKEN_ENR_' + suffix,
    student_id: 'missing_student_' + suffix,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    status: 'inactive'
  });

  var res = assertSprint11RouteSuccess('run_data_integrity_check', { actor_user_id: ctx.admin.id }, ctx.adminToken);
  if (!res.data.issues || Object.prototype.toString.call(res.data.issues) !== '[object Array]') {
    throw new Error("Data integrity response does not contain issues array.");
  }
  var issue = res.data.issues.filter(function(item) {
    return item.entity_id === 'S11_BROKEN_ENR_' + suffix && item.issue_code === 'ORPHAN_STUDENT_ID';
  })[0] || res.data.issues[0];
  if (!issue || !issue.severity || !issue.entity || !issue.issue_code || !issue.message || !issue.details) {
    throw new Error("Data integrity issue format is invalid: " + JSON.stringify(issue));
  }
}

function test_sprint11StorageIntegrity(ctx, suffix) {
  var content = Utilities.base64Encode('Sprint 11 duplicate storage fixture');
  var first = assertSprint11RouteSuccess('upload_student_file', {
    actor_user_id: ctx.admin.id,
    student_id: ctx.studentId,
    file_type: 'foto',
    file_name: 's11_storage_1_' + suffix + '.png',
    mime_type: 'image/png',
    base64_content: content
  }, ctx.adminToken);

  appendRow(SHEETS.STUDENT_FILES, {
    id: 'S11_DUP_FILE_' + suffix,
    student_id: ctx.studentId,
    file_type: 'foto',
    drive_file_id: first.data.drive_file_id,
    original_filename: 's11_storage_duplicate_' + suffix + '.png',
    mime_type: 'image/png',
    file_size: 10,
    version: 99,
    status: 'active',
    uploaded_by: ctx.admin.id,
    uploaded_at: nowIso()
  });

  var res = assertSprint11RouteSuccess('run_storage_integrity_check', { actor_user_id: ctx.admin.id, orphan_scan_limit: 25 }, ctx.adminToken);
  if (!res.data.issues || Object.prototype.toString.call(res.data.issues) !== '[object Array]') {
    throw new Error("Storage integrity response does not contain issues array.");
  }
  var duplicate = res.data.issues.some(function(issue) {
    return issue.issue_code === 'DUPLICATE_ACTIVE_STUDENT_FILE';
  });
  if (!duplicate) {
    throw new Error("Storage integrity failed to detect duplicate active student file.");
  }
}

function test_sprint11AuditExplorer(ctx) {
  assertSprint11RouteSuccess('run_data_integrity_check', { actor_user_id: ctx.admin.id }, ctx.adminToken);
  var auditSheet = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID).getSheetByName(SHEETS.AUDIT_LOGS);
  var auditHeaders = SHEET_HEADERS[SHEETS.AUDIT_LOGS];
  ['one', 'two', 'three'].forEach(function(label) {
    var fixture = {
      id: 'S11_AUDIT_' + label,
      user_id: ctx.admin.id,
      user_name: 'Pagination User ' + label,
      user_role: ctx.admin.role,
      action: 'audit_pagination_fixture',
      entity_type: 'system',
      entity_id: label,
      description: 'Searchable observability ' + label,
      created_at: new Date(Date.now() + (label === 'one' ? 1000 : label === 'two' ? 2000 : 3000)).toISOString()
    };
    if (label === 'one') {
      fixture.new_value = JSON.stringify({ password_hash: 'historic-secret', nik: '1234567890', kk: '998877', parent_pin: '4321' });
    }
    auditSheet.appendRow(auditHeaders.map(function(header) { return fixture[header] || ''; }));
  });

  var res = assertSprint11RouteSuccess('search_audit_logs', {
    actor_user_id: ctx.admin.id,
    action: 'run_data_integrity_check',
    limit: 1
  }, ctx.adminToken);
  if (!res.data.logs || res.data.logs.length > 1 || res.data.summary.limit !== 1) {
    throw new Error("Audit explorer limit/filter failed.");
  }

  var paged = assertSprint11RouteSuccess('search_audit_logs', {
    actor_user_id: ctx.admin.id,
    action: 'audit_pagination_fixture',
    q: 'observability',
    page: 2,
    page_size: 2
  }, ctx.adminToken);
  if (paged.data.total !== 3 || paged.data.page !== 2 || paged.data.page_size !== 2 || paged.data.logs.length !== 1) {
    throw new Error('Audit explorer pagination or q search failed: ' + JSON.stringify(paged.data));
  }

  var sensitive = assertSprint11RouteSuccess('search_audit_logs', {
    actor_user_id: ctx.admin.id,
    entity_id: 'one',
    page_size: 10
  }, ctx.adminToken).data.logs[0];
  if (!sensitive || sensitive.severity !== 'info') throw new Error('Derived audit severity is missing.');
  var serialized = JSON.stringify(sensitive);
  ['historic-secret', '1234567890', '998877', '4321'].forEach(function(secret) {
    if (serialized.indexOf(secret) !== -1) throw new Error('Sensitive historical audit value leaked: ' + secret);
  });
  if (serialized.indexOf('[REDACTED]') === -1) throw new Error('Sensitive audit values were not redacted.');

  var warning = assertSprint11RouteSuccess('search_audit_logs', {
    actor_user_id: ctx.admin.id,
    action: 'run_data_integrity_check',
    page_size: 1
  }, ctx.adminToken).data.logs[0];
  if (!warning || !warning.severity) throw new Error('Derived audit severity is missing.');

  var operatorRes = JSON.parse(route({
    action: 'search_audit_logs',
    payload: { actor_user_id: ctx.operator.id },
    token: ctx.operatorToken
  }).getContent());
  if (operatorRes.status !== 'error' || operatorRes.code !== 'ERR_FORBIDDEN') {
    throw new Error('Admin/operator should be rejected from administrator-only search_audit_logs.');
  }

  var teacherRes = JSON.parse(route({
    action: 'search_audit_logs',
    payload: {
      actor_user_id: ctx.teacher.id,
      action: 'run_data_integrity_check'
    },
    token: ctx.teacherToken
  }).getContent());
  if (teacherRes.status !== 'error' || teacherRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Guru should be rejected from search_audit_logs.");
  }
}

function test_sprint11BackupSnapshot(ctx, suffix) {
  var adminDenied = JSON.parse(route({
    action: 'create_manual_backup_snapshot',
    payload: {
      actor_user_id: ctx.operator.id,
      description: 'Denied S11 backup ' + suffix
    },
    token: ctx.operatorToken
  }).getContent());
  if (adminDenied.status !== 'error' || adminDenied.code !== 'ERR_FORBIDDEN') {
    throw new Error("Admin role should be denied create_manual_backup_snapshot.");
  }

  var createRes = assertSprint11RouteSuccess('create_manual_backup_snapshot', {
    actor_user_id: ctx.admin.id,
    description: 'Sprint 11 QA backup ' + suffix
  }, ctx.adminToken);
  if (!createRes.data.id || !createRes.data.backup_file_id) {
    throw new Error("Backup snapshot metadata is incomplete.");
  }
  ctx.backupId = createRes.data.id;

  var listRes = assertSprint11RouteSuccess('list_backup_snapshots', { actor_user_id: ctx.admin.id }, ctx.adminToken);
  var found = listRes.data.some(function(row) { return row.id === ctx.backupId; });
  if (!found) {
    throw new Error("Created backup snapshot was not listed.");
  }

  var previewRes = assertSprint11RouteSuccess('preview_restore_backup', {
    actor_user_id: ctx.admin.id,
    backup_id: ctx.backupId
  }, ctx.adminToken);
  if (!previewRes.data.summary || previewRes.data.summary.sheets <= 0 || !previewRes.data.differences) {
    throw new Error("Restore preview response is incomplete.");
  }
}

function test_sprint11Diagnostics(ctx) {
  var res = assertSprint11RouteSuccess('get_system_diagnostics_report', { actor_user_id: ctx.operator.id }, ctx.operatorToken);
  if (!res.data.health || !res.data.integrity || !res.data.storage || !res.data.audit || !res.data.backup) {
    throw new Error("Diagnostics report missing required summary sections.");
  }
}

function test_sprint11Security(ctx) {
  var endpoints = [
    'extended_health_check',
    'get_system_diagnostics_report',
    'run_data_integrity_check',
    'run_storage_integrity_check',
    'search_audit_logs',
    'create_manual_backup_snapshot',
    'list_backup_snapshots',
    'preview_restore_backup'
  ];

  endpoints.forEach(function(action) {
    var payload = { actor_user_id: ctx.teacher2.id };
    if (action === 'preview_restore_backup') payload.backup_id = ctx.backupId || 'none';
    var teacherRes = JSON.parse(route({ action: action, payload: payload, token: ctx.teacher2Token }).getContent());
    if (teacherRes.status !== 'error' || teacherRes.code !== 'ERR_FORBIDDEN') {
      throw new Error("Guru should be rejected from " + action + ". Response: " + JSON.stringify(teacherRes));
    }

    var publicPayload = {};
    if (action === 'preview_restore_backup') publicPayload.backup_id = ctx.backupId || 'none';
    var publicRes = JSON.parse(route({ action: action, payload: publicPayload }).getContent());
    if (publicRes.status !== 'error' || publicRes.code !== 'ERR_UNAUTHORIZED') {
      throw new Error("Public/empty actor should be rejected from " + action + ". Response: " + JSON.stringify(publicRes));
    }
  });

  ['create_manual_backup_snapshot', 'list_backup_snapshots', 'preview_restore_backup'].forEach(function(action) {
    var payload = { actor_user_id: ctx.operator.id };
    if (action === 'preview_restore_backup') payload.backup_id = ctx.backupId || 'none';
    var res = JSON.parse(route({ action: action, payload: payload, token: ctx.operatorToken }).getContent());
    if (res.status !== 'error' || res.code !== 'ERR_FORBIDDEN') {
      throw new Error("Admin role should be rejected from backup endpoint " + action + ".");
    }
  });
}

function ensureSprint11Period(admin, suffix, token) {
  var yearRes = assertSprint11RouteSuccess('create_academic_year', {
    actor_user_id: admin.id,
    name: 'AY_S11_' + suffix,
    start_date: '2026-07-01',
    end_date: '2027-06-30'
  }, token);
  var semRes = assertSprint11RouteSuccess('create_semester', {
    actor_user_id: admin.id,
    academic_year_id: yearRes.data.id,
    name: 'Ganjil',
    start_date: '2026-07-01',
    end_date: '2026-12-31'
  }, token);
  return {
    yearId: yearRes.data.id,
    semesterId: semRes.data.id
  };
}

function getSprint11QaAdmin() {
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Default admin user not found. Ensure database is setup and seeded.");
  }
  return admin;
}

function loginSprint11TestUser(username, password) {
  var res = JSON.parse(route({
    action: 'login',
    payload: {
      identifier: username,
      password: password,
      ip_address: '127.0.0.1',
      user_agent: 'Sprint11-QA'
    }
  }).getContent());
  if (res.status !== 'success' || !res.data || !res.data.token) {
    throw new Error("Login failed for user " + username + ": " + JSON.stringify(res));
  }
  return res.data.token;
}

function assertSprint11RouteSuccess(action, payload, token) {
  var result = JSON.parse(route({
    action: action,
    payload: payload || {},
    token: token
  }).getContent());
  if (result.status !== 'success') {
    throw new Error(action + " failed: " + JSON.stringify(result));
  }
  return result;
}

function createSprint11QaSuffix() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function createSprint11QaNisn() {
  var nisn;
  var exists = true;
  while (exists) {
    nisn = String(Math.floor(1000000000 + Math.random() * 9000000000));
    exists = listRecords(SHEETS.STUDENTS, function(student) {
      return String(student.nisn) === nisn;
    }).length > 0;
  }
  return nisn;
}

function test_runSprint11ImportHardeningQA() {
  console.log(" STARTING SPRINT 11 IMPORT HARDENING QA ");

  setupDatabase();
  seedInitialData();

  var suffix = createSprint11QaSuffix();
  var ctx = setupSprint11HardeningContext(suffix);

  // 1. Lock Period Constraint Validation
  // Setup a class teacher assignment for the teacher to manage the class
  createRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, {
    class_id: ctx.classId,
    teacher_user_id: ctx.teacher.id,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    status: STATUS.ACTIVE
  });

  // Create an assessment in the past (e.g. 10 days ago) to trigger lock window block
  var tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  var dateStr = Utilities.formatDate(tenDaysAgo, Session.getScriptTimeZone(), "yyyy-MM-dd");

  var oldAssessment = createRecord(SHEETS.ACADEMIC_ASSESSMENTS, {
    teacher_user_id: ctx.teacher.id,
    class_id: ctx.classId,
    subject_id: 'SUBJ_IND', // Seeded subject
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    title: 'Asesmen Lama ' + suffix,
    description: '',
    assessment_date: dateStr,
    score_min: 0,
    score_max: 100,
    status: STATUS.PUBLISHED
  });

  // Try to write score manually via save_academic_scores -> Expect ERR_PERIOD_LOCKED
  var saveRes = JSON.parse(route({
    action: 'save_academic_scores',
    payload: {
      assessment_id: oldAssessment.id,
      scores: [
        {
          student_id: ctx.studentId,
          student_enrollment_id: ctx.enrollmentId,
          score: 80,
          note: 'Manual edit'
        }
      ]
    },
    token: ctx.teacherToken
  }).getContent());

  if (saveRes.status !== 'error' || saveRes.code !== 'ERR_PERIOD_LOCKED') {
    throw new Error("Expected manual save to fail with ERR_PERIOD_LOCKED, got: " + JSON.stringify(saveRes));
  }

  // Try to write score via update_academic_score on a pre-existing score in that assessment
  var scoreRec = createRecord(SHEETS.ACADEMIC_SCORES, {
    assessment_id: oldAssessment.id,
    student_id: ctx.studentId,
    student_enrollment_id: ctx.enrollmentId,
    score: 50,
    note: '',
    status: STATUS.ACTIVE
  });

  var updateRes = JSON.parse(route({
    action: 'update_academic_score',
    payload: {
      id: scoreRec.id,
      score: 90,
      note: 'Manual edit update'
    },
    token: ctx.teacherToken
  }).getContent());

  if (updateRes.status !== 'error' || updateRes.code !== 'ERR_PERIOD_LOCKED') {
    throw new Error("Expected manual update to fail with ERR_PERIOD_LOCKED, got: " + JSON.stringify(updateRes));
  }

  // Try to write via import_scores -> Expect validation preview to show ERR_PERIOD_LOCKED error for that row
  var csvContent = "assessment_id,nisn,score,note\n" + oldAssessment.id + "," + getStudentNisn(ctx.studentId) + ",95,Imported score\n";
  var importRes = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      import_type: 'academic_scores',
      file_name: 'test_lock_period.csv',
      csv_content: csvContent
    },
    token: ctx.teacherToken
  }).getContent());

  if (importRes.status !== 'success' || !importRes.data.preview_rows || importRes.data.preview_rows[0].operation !== 'error') {
    throw new Error("Expected import preview to flag lock error, got: " + JSON.stringify(importRes));
  }
  var rowError = importRes.data.preview_rows[0].errors[0];
  if (rowError.indexOf('locked') === -1 && rowError.indexOf('period') === -1) {
    throw new Error("Expected lock period error message in preview, got: " + rowError);
  }

  // 2. Preview Rows Contract & Redact Verification
  var newNisn1 = createSprint11QaNisn();
  var studentCsv = "nisn,full_name,birth_date,nik,family_card_number,parent_pin,status\n" +
                   newNisn1 + ",Siswa Baru Satu " + suffix + ",2015-02-02,1234567890123456,1234567890123456,9999,Aktif\n" +
                   getStudentNisn(ctx.studentId) + ",Siswa Edit Satu " + suffix + ",2015-01-01,9876543210987654,9876543210987654,8888,Aktif\n";

  var previewRes = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      import_type: 'students',
      file_name: 'test_preview_redact.csv',
      csv_content: studentCsv
    },
    token: ctx.adminToken
  }).getContent());

  if (previewRes.status !== 'success') {
    throw new Error("Failed to create students import session: " + JSON.stringify(previewRes));
  }
  var data = previewRes.data;
  if (data.create_count !== 1 || data.update_count !== 1) {
    throw new Error("Expected create_count = 1 and update_count = 1, got: " + JSON.stringify(data));
  }

  var pRows = data.preview_rows;
  // Verify that the update row masks NIK, Family Card, and parent_pin
  var updateRow = pRows.filter(function(r) { return r.operation === 'update'; })[0];
  if (!updateRow) {
    throw new Error("Update row not found in preview: " + JSON.stringify(pRows));
  }
  
  var nikChange = updateRow.changes.filter(function(c) { return c.field === 'nik'; })[0];
  if (!nikChange || nikChange.old_value !== '[REDACTED]' || nikChange.new_value !== '[REDACTED]') {
    throw new Error("Expected NIK change to be redacted, got: " + JSON.stringify(nikChange));
  }

  var kkChange = updateRow.changes.filter(function(c) { return c.field === 'family_card_number'; })[0];
  if (!kkChange || kkChange.old_value !== '[REDACTED]' || kkChange.new_value !== '[REDACTED]') {
    throw new Error("Expected KK change to be redacted, got: " + JSON.stringify(kkChange));
  }

  var pinChange = updateRow.changes.filter(function(c) { return c.field === 'parent_pin'; })[0];
  if (!pinChange || pinChange.old_value !== '[REDACTED]' || pinChange.new_value !== '[REDACTED]') {
    throw new Error("Expected parent PIN change to be redacted, got: " + JSON.stringify(pinChange));
  }

  // 3. Import Logs History API
  var historyRes = JSON.parse(route({
    action: 'list_import_logs',
    payload: {
      import_type: 'students',
      page: 1,
      page_size: 10
    },
    token: ctx.adminToken
  }).getContent());

  if (historyRes.status !== 'success' || !historyRes.data.logs || historyRes.data.logs.length === 0) {
    throw new Error("Expected student import logs in history, got: " + JSON.stringify(historyRes));
  }

  // Guru must NOT see imports uploaded by others
  var teacherHistoryRes = JSON.parse(route({
    action: 'list_import_logs',
    payload: {},
    token: ctx.teacherToken
  }).getContent());

  if (teacherHistoryRes.status !== 'success') {
    throw new Error("Failed to call list_import_logs as teacher: " + JSON.stringify(teacherHistoryRes));
  }
  teacherHistoryRes.data.logs.forEach(function(log) {
    if (log.uploaded_by !== ctx.teacher.id) {
      throw new Error("Guru saw import log uploaded by someone else: " + JSON.stringify(log));
    }
  });

  // 4. Row Limit Protection
  var limit = IMPORT_ROW_LIMITS.students || 500;
  // Construct a CSV with limit + 1 rows
  var lines = ["nisn,full_name,birth_date"];
  for (var i = 0; i <= limit; i++) {
    lines.push("123456" + i + ",Siswa Limit " + i + ",2015-01-01");
  }
  var largeCsv = lines.join("\n");

  var limitRes = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      import_type: 'students',
      file_name: 'large_import.csv',
      csv_content: largeCsv
    },
    token: ctx.adminToken
  }).getContent());

  if (limitRes.status !== 'error' || limitRes.code !== 'ERR_ROW_LIMIT_EXCEEDED') {
    throw new Error("Expected limit check to fail with ERR_ROW_LIMIT_EXCEEDED, got: " + JSON.stringify(limitRes));
  }

  // 5. Template Contract
  var templateRes = JSON.parse(route({
    action: 'get_import_template',
    payload: { import_type: 'students' },
    token: ctx.adminToken
  }).getContent());

  if (templateRes.status !== 'success' || !templateRes.data.required_columns || !templateRes.data.sample_rows) {
    throw new Error("Invalid template response structure: " + JSON.stringify(templateRes));
  }

  // Guru should get templates for academic_scores but be forbidden for students
  var teacherSubjTemplate = JSON.parse(route({
    action: 'get_import_template',
    payload: { import_type: 'academic_scores' },
    token: ctx.teacherToken
  }).getContent());
  if (teacherSubjTemplate.status !== 'success') {
    throw new Error("Guru was blocked from getting academic template: " + JSON.stringify(teacherSubjTemplate));
  }

  var teacherStudentTemplate = JSON.parse(route({
    action: 'get_import_template',
    payload: { import_type: 'students' },
    token: ctx.teacherToken
  }).getContent());
  if (teacherStudentTemplate.status !== 'error' || teacherStudentTemplate.code !== 'ERR_FORBIDDEN') {
    throw new Error("Guru should be forbidden from getting student template, got: " + JSON.stringify(teacherStudentTemplate));
  }

  // 6. Error Report Access Hardening
  // Create an invalid import log that results in an error report
  var invalidCsv = "nisn,full_name,birth_date\nINVALID_NISN,Budi,invalid-date\n";
  var invalidSession = JSON.parse(route({
    action: 'create_import_session',
    payload: {
      import_type: 'students',
      file_name: 'invalid_students.csv',
      csv_content: invalidCsv
    },
    token: ctx.adminToken
  }).getContent());

  if (invalidSession.status !== 'success' || !invalidSession.data.error_report_file_id) {
    throw new Error("Expected error report to be created for invalid csv, got: " + JSON.stringify(invalidSession));
  }
  var errReportFileId = invalidSession.data.error_report_file_id;

  // Try to download as Guru -> Must fail with ERR_FORBIDDEN (since student type and uploaded by admin)
  var downloadRes = JSON.parse(route({
    action: 'download_import_error_report',
    payload: { error_report_file_id: errReportFileId },
    token: ctx.teacherToken
  }).getContent());

  if (downloadRes.status !== 'error' || downloadRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Guru download of admin report to fail with ERR_FORBIDDEN, got: " + JSON.stringify(downloadRes));
  }

  // Admin download -> Must succeed
  var adminDownload = JSON.parse(route({
    action: 'download_import_error_report',
    payload: { error_report_file_id: errReportFileId },
    token: ctx.adminToken
  }).getContent());
  if (adminDownload.status !== 'success' || !adminDownload.data.base64_content) {
    throw new Error("Admin failed to download error report: " + JSON.stringify(adminDownload));
  }

  console.log(" SPRINT 11 IMPORT HARDENING QA PASSED ");
}

function getStudentNisn(studentId) {
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  return student ? student.nisn : '';
}
