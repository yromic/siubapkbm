/**
 * Sprint116CTests.gs
 * QA assertions for Sprint 11.6C Export CSV Compliance.
 */

function test_runSprint116CQA() {
  console.log("STARTING SPRINT 11.6C EXPORT CSV QA");
  setupDatabase();
  seedInitialData();
  
  var adminUser = getSprint11QaAdmin();
  var adminToken = loginSprint11TestUser(adminUser.username, 'Admin123!');
  
  var suffix = createSprint11QaSuffix();
  var period = ensureSprint11Period(adminUser, suffix, adminToken);
  
  // Create Class C
  var classARes = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_116C_' + suffix,
    name: 'Kelas 11.6C ' + suffix,
    level: '5'
  }, adminToken);
  var classAId = classARes.data.id;
  
  // Create Class D (unassigned to Guru 1)
  var classBRes = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_116C_OTHER_' + suffix,
    name: 'Kelas 11.6C Lain ' + suffix,
    level: '5'
  }, adminToken);
  var classBId = classBRes.data.id;
  
  // Create Guru 1 (assigned to Class C)
  var guru1 = createRecord(SHEETS.USERS, {
    name: 'Guru 11.6C-1 ' + suffix,
    email: 'guru1_116c_' + suffix + '@example.com',
    username: 'guru1_116c_' + suffix,
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
  
  // Create Subject
  var subjectRes = assertSprint11RouteSuccess('create_subject', {
    code: 'SBJ_116C_' + suffix,
    name: 'Subject 11.6C ' + suffix
  }, adminToken);
  var subjectId = subjectRes.data.id;
  
  assertSprint11RouteSuccess('assign_subject_to_class', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);
  
  // Create Student enrolled in Class C
  var nisn1 = createSprint11QaNisn();
  var student1Res = assertSprint11RouteSuccess('create_student', {
    nisn: nisn1,
    nik: '8211111111115555',
    full_name: 'Student 11.6C ' + suffix,
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    family_card_number: '1234567890123456',
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
  
  // Create Student enrolled in Class D (Guru 1 has no assignment here)
  var nisn2 = createSprint11QaNisn();
  var student2Res = assertSprint11RouteSuccess('create_student', {
    nisn: nisn2,
    nik: '8211111111116666',
    full_name: 'Student 11.6C Other ' + suffix,
    birth_date: '2015-01-01',
    gender: 'P',
    status: 'Aktif',
    parent_access_pin: '5678'
  }, adminToken);
  var student2Id = student2Res.data.id;
  
  assertSprint11RouteSuccess('create_student_enrollment', {
    student_id: student2Id,
    class_id: classBId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    status: 'active'
  }, adminToken);
  
  console.log("1. Testing Student Export Access & Sanitization...");
  // Admin exports -> NIK must be present
  var adminExpRes = assertSprint11RouteSuccess('export_students_csv', {
    class_id: classAId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken).data;
  
  if (!adminExpRes.file_id || !adminExpRes.export_id || adminExpRes.download_available !== true || adminExpRes.export_type !== 'students' || adminExpRes.total_rows !== 1) {
    throw new Error("Invalid student export details for Admin. Got: " + JSON.stringify(adminExpRes));
  }
  
  var adminFileContent = DriveApp.getFileById(adminExpRes.file_id).getBlob().getDataAsString();
  if (adminFileContent.indexOf('8211111111115555') === -1 || adminFileContent.indexOf('nik') === -1) {
    throw new Error("Expected NIK to be present in Admin student export CSV.");
  }
  
  // Guru exports assigned class -> NIK must NOT be present
  var guruExpRes = assertSprint11RouteSuccess('export_students_csv', {
    class_id: classAId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, guru1Token).data;
  
  var guruFileContent = DriveApp.getFileById(guruExpRes.file_id).getBlob().getDataAsString();
  if (guruFileContent.indexOf('8211111111115555') !== -1 || guruFileContent.indexOf(',nik') !== -1 || guruFileContent.indexOf('family_card_number') !== -1) {
    throw new Error("Security breach: Sensitive fields (nik/no_kk) present in Guru student export CSV.");
  }

  if (!guruExpRes.export_id) throw new Error("Guru student export did not return export_id.");
  
  // Guru exports other class -> Must fail
  var otherClassRes = JSON.parse(route({
    action: 'export_students_csv',
    payload: {
      class_id: classBId,
      academic_year_id: period.yearId,
      semester_id: period.semesterId
    },
    token: guru1Token
  }).getContent());
  
  if (otherClassRes.status !== 'error' || otherClassRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Guru export for other class to fail with ERR_FORBIDDEN. Got: " + JSON.stringify(otherClassRes));
  }
  
  console.log("2. Testing Academic Score Export...");
  // Create Assessment in Class C
  var assessmentRes = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Quiz 1 ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken).data;
  assertSprint11RouteSuccess('publish_academic_assessment', { id: assessmentRes.id }, adminToken);
  
  // Save academic scores
  var enrolls = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === student1Id && e.class_id === classAId;
  });
  assertSprint11RouteSuccess('save_academic_scores', {
    assessment_id: assessmentRes.id,
    scores: [
      { student_id: student1Id, student_enrollment_id: enrolls[0].id, score: 95, note: 'Superb' }
    ]
  }, adminToken);
  
  // Export academic scores
  var acadExpRes = assertSprint11RouteSuccess('export_academic_scores_csv', {
    class_id: classAId,
    subject_id: subjectId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken).data;
  
  if (!acadExpRes.file_id || !acadExpRes.export_id || acadExpRes.export_type !== 'academic' || acadExpRes.total_rows !== 1) {
    throw new Error("Invalid academic export details for Admin. Got: " + JSON.stringify(acadExpRes));
  }
  
  var acadFileContent = DriveApp.getFileById(acadExpRes.file_id).getBlob().getDataAsString();
  if (acadFileContent.indexOf('Quiz 1') === -1 || acadFileContent.indexOf('95') === -1) {
    throw new Error("Expected assessment title and score to be present in academic CSV.");
  }
  
  console.log("3. Testing Character Summary Export...");
  // Seed culture scores to generate FITRAH summary
  assertSprint11RouteSuccess('save_culture_scores', {
    class_id: classAId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    score_date: '2026-07-10',
    scores: [
      { student_id: student1Id, student_enrollment_id: enrolls[0].id, sss: 4, am: 4, hb: 4, asm: 4, br: 4, ak: 4, tm: 4 }
    ]
  }, adminToken);
  
  // Export character summary
  var charExpRes = assertSprint11RouteSuccess('export_character_summary_csv', {
    class_id: classAId,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken).data;
  
  if (!charExpRes.file_id || !charExpRes.export_id || charExpRes.export_type !== 'character' || charExpRes.total_rows !== 1) {
    throw new Error("Invalid character summary export details for Admin. Got: " + JSON.stringify(charExpRes));
  }
  
  var charFileContent = DriveApp.getFileById(charExpRes.file_id).getBlob().getDataAsString();
  if (charFileContent.indexOf('ramah') === -1 || charFileContent.indexOf('fathonah') === -1) {
    throw new Error("Expected character/FITRAH fields to be present in character summary CSV.");
  }
  
  console.log("4. Testing Drive file private security...");
  var fileMock = DriveApp.getFileById(adminExpRes.file_id);
  if (fileMock.getSharingAccess() !== DriveApp.Access.PRIVATE || fileMock.getSharingPermission() !== DriveApp.Permission.NONE) {
    throw new Error("Security breach: Generated export file is not private in Drive.");
  }

  console.log("5. Testing artifact metadata, history, and authorized download...");
  [adminExpRes, guruExpRes, acadExpRes, charExpRes].forEach(function(exp) {
    var artifact = getRecordById(SHEETS.REPORT_EXPORTS, exp.export_id);
    if (!artifact || artifact.file_id !== exp.file_id || artifact.status !== 'completed' || !artifact.source_type) {
      throw new Error("CSV export artifact metadata was not persisted: " + JSON.stringify(exp));
    }
  });

  var adminHistory = assertSprint11RouteSuccess('list_export_history', { page: 1, page_size: 100 }, adminToken).data;
  if (!adminHistory.exports.some(function(item) { return item.export_id === adminExpRes.export_id; })) {
    throw new Error("Admin export history did not include generated CSV artifact.");
  }
  var guruHistory = assertSprint11RouteSuccess('list_export_history', { page: 1, page_size: 100 }, guru1Token).data;
  if (!guruHistory.exports.some(function(item) { return item.export_id === guruExpRes.export_id; })) {
    throw new Error("Guru export history did not include own artifact.");
  }

  var adminDownload = assertSprint11RouteSuccess('download_report_export', { export_id: adminExpRes.export_id }, adminToken).data;
  if (!adminDownload.base64_content || adminDownload.export_id !== adminExpRes.export_id) {
    throw new Error("Admin authorized download contract is incomplete.");
  }
  assertSprint11RouteSuccess('download_report_export', { export_id: guruExpRes.export_id }, guru1Token);

  var otherClassArtifact = recordCsvExportArtifact({
    report_type: 'students', source_type: 'students_csv', source_id: classBId,
    class_id: classBId, academic_year_id: period.yearId, semester_id: period.semesterId,
    file_id: adminExpRes.file_id, file_name: 'other-class.csv', mime_type: 'text/csv', total_rows: 1
  }, adminUser);
  var forbiddenDownload = JSON.parse(route({
    action: 'download_report_export', payload: { export_id: otherClassArtifact.id }, token: guru1Token
  }).getContent());
  if (forbiddenDownload.status !== 'error' || forbiddenDownload.code !== 'ERR_FORBIDDEN') {
    throw new Error("Guru downloaded another class export.");
  }
  var filteredGuruHistory = assertSprint11RouteSuccess('list_export_history', { page: 1, page_size: 100 }, guru1Token).data;
  if (filteredGuruHistory.exports.some(function(item) { return item.export_id === otherClassArtifact.id; })) {
    throw new Error("Guru history leaked another class export.");
  }

  var missingDownload = JSON.parse(route({
    action: 'download_report_export', payload: { export_id: 'missing-export-id' }, token: adminToken
  }).getContent());
  if (missingDownload.status !== 'error' || missingDownload.code !== 'ERR_NOT_FOUND') {
    throw new Error("Missing export_id did not return ERR_NOT_FOUND.");
  }
  var rawFileDownload = JSON.parse(route({
    action: 'download_report_export', payload: { file_id: adminExpRes.file_id }, token: adminToken
  }).getContent());
  if (rawFileDownload.status !== 'error') throw new Error("Raw file_id download was accepted.");

  console.log("6. Testing CSV injection and standard escaping...");
  if (escapeExportCsvValue('=SUM(A1:A2)') !== "'=SUM(A1:A2)") throw new Error("Equals formula was not neutralized.");
  if (escapeExportCsvValue('+cmd') !== "'+cmd") throw new Error("Plus formula was not neutralized.");
  if (escapeExportCsvValue('a,"b"\nline') !== '"a,""b""\nline"') throw new Error("CSV quote/comma/newline escaping regressed.");
  
  console.log("7. Testing Export Audit Logs...");
  var auditLogs = readAuditLogRows().filter(function(log) {
    return log.action === 'export_students_csv' ||
           log.action === 'export_academic_scores_csv' ||
           log.action === 'export_character_summary_csv';
  });
  
  if (auditLogs.length < 3) {
    throw new Error("Expected at least 3 export audit log entries, but found: " + auditLogs.length);
  }
  var downloadLogs = readAuditLogRows().filter(function(log) {
    return log.action === 'download_export' && (log.entity_id === adminExpRes.export_id || log.entity_id === guruExpRes.export_id);
  });
  if (downloadLogs.length < 2) throw new Error("Expected authorized export download audit logs.");
  
  console.log("8. Running Regression Tests...");
  console.log(
    "Regression QA must be executed separately to avoid GAS timeout."
  );
  console.log(
    "Run separately:"
  );
  console.log(
    "1. test_runSprint115AQA()"
  );
  console.log(
    "2. test_runSprint115BQA()"
  );
  console.log(
    "3. test_runSprint116AQA()"
  );
  console.log(
    "4. test_runSprint116BQA()"
  );
  
  console.log("SPRINT 11.6C EXPORT CSV QA PASSED");
}
