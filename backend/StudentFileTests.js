/**
 * StudentFileTests.gs
 * QA and verification suite for Sprint 7.
 * Implements thorough validation, verification, and regression tests.
 */

function test_runSprint7QA() {
  console.log("=== STARTING SPRINT 7 QA TEST SUITE ===");

  ensureSprint7QaBaseline();
  test_sprint7RegressionSprint1();
  test_sprint7RegressionSprint2();
  test_sprint7RegressionSprint3();
  test_sprint7RegressionSprint4();

  var suffix = createSprint7QaRunSuffix();
  var ctx = setupSprint7TestContext(suffix);

  test_sprint7RegressionSprint5(ctx);
  test_sprint7RegressionSprint6(ctx);

  console.log("Running Sprint 7 document tests...");

  // 1. Storage setup validation
  test_storageSetup(ctx);
  console.log("Storage setup validation successful.");

  // 2. File upload validation
  test_fileUploadValidation(ctx, suffix);
  console.log("File upload validation successful.");

  // 3. File versioning validation
  test_fileVersioningValidation(ctx, suffix);
  console.log("File versioning validation successful.");

  // 4. File access authorization
  test_fileAccessAuthorization(ctx, suffix);
  console.log("File access authorization successful.");

  // 5. Sensitive document audit validation
  test_sensitiveDocumentAudit(ctx);
  console.log("Sensitive document audit validation successful.");

  // 6. Drive security validation
  test_driveSecurityValidation(ctx);
  console.log("Drive security validation successful.");

  console.log("=== SPRINT 7 QA TEST SUITE PASSED ===");
}

function ensureSprint7QaBaseline() {
  setupDatabase();
  seedInitialData();
}

function createSprint7QaRunSuffix() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function test_sprint7RegressionSprint1() {
  console.log("Running Sprint 1 regression...");

  var admin = getSprint7QaAdmin();
  resetFailedLogin(admin);

  assertSprint7RouteSuccess('health_check', {}, "Sprint 1 health_check regression failed.");
  assertSprint7RouteSuccess('login', {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Sprint7-QA-Regression'
  }, "Sprint 1 admin login regression failed.");

  console.log("Sprint 1 regression passed.");
}

function test_sprint7RegressionSprint2() {
  console.log("Running Sprint 2 regression...");

  var admin = getSprint7QaAdmin();
  var actorPayload = { actor_user_id: admin.id };

  assertSprint7RouteSuccess('list_academic_years', actorPayload, "Sprint 2 list_academic_years regression failed.");
  assertSprint7RouteSuccess('list_classes', actorPayload, "Sprint 2 list_classes regression failed.");
  assertSprint7RouteSuccess('list_subjects', actorPayload, "Sprint 2 list_subjects regression failed.");
  assertSprint7RouteSuccess('get_app_settings', actorPayload, "Sprint 2 get_app_settings regression failed.");

  console.log("Sprint 2 regression passed.");
}

function test_sprint7RegressionSprint3() {
  console.log("Running Sprint 3 regression...");

  var admin = getSprint7QaAdmin();
  var actorPayload = { actor_user_id: admin.id };

  assertSprint7RouteSuccess('list_students', actorPayload, "Sprint 3 list_students regression failed.");
  assertSprint7RouteSuccess('list_student_enrollments', actorPayload, "Sprint 3 list_student_enrollments regression failed.");

  console.log("Sprint 3 regression passed.");
}

function test_sprint7RegressionSprint4() {
  console.log("Running Sprint 4 regression...");

  var admin = getSprint7QaAdmin();

  assertSprint7RouteSuccess('list_academic_assessments', {
    actor_user_id: admin.id
  }, "Sprint 4 list_academic_assessments regression failed.");

  console.log("Sprint 4 regression passed.");
}

function test_sprint7RegressionSprint5(ctx) {
  console.log("Running Sprint 5 regression...");

  assertSprint7RouteSuccess('get_class_character_summary', {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    week_start_date: '2026-06-15'
  }, "Sprint 5 get_class_character_summary regression failed.");

  console.log("Sprint 5 regression passed.");
}

function test_sprint7RegressionSprint6(ctx) {
  console.log("Running Sprint 6 regression...");

  assertSprint7RouteSuccess('get_school_dashboard', {
    actor_user_id: ctx.admin.id
  }, "Sprint 6 get_school_dashboard regression failed.");

  console.log("Sprint 6 regression passed.");
}

function getSprint7QaAdmin() {
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Default admin user not found. Ensure database is setup and seeded.");
  }
  return admin;
}

function assertSprint7RouteSuccess(action, payload, errorMessage) {
  var result = JSON.parse(route({
    action: action,
    payload: payload || {}
  }).getContent());

  if (result.status !== 'success') {
    throw new Error(errorMessage + " Response: " + JSON.stringify(result));
  }

  return result;
}

/**
 * Setup data dependencies for Sprint 7 test runs.
 */
function setupSprint7TestContext(suffix) {
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Default admin user not found. Ensure database is setup and seeded.");
  }

  // Get active year and semester
  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;

  if (!activeYearId || !activeSemId) {
    // Create new year
    var yearRes = JSON.parse(route({
      action: 'create_academic_year',
      payload: {
        actor_user_id: admin.id,
        name: "AY_S7_" + suffix,
        start_date: "2026-07-01",
        end_date: "2027-06-30"
      }
    }).getContent());
    activeYearId = yearRes.data.id;
    route({ action: 'set_active_academic_year', payload: { actor_user_id: admin.id, id: activeYearId } });

    // Create new semester
    var semRes = JSON.parse(route({
      action: 'create_semester',
      payload: {
        actor_user_id: admin.id,
        academic_year_id: activeYearId,
        name: "Ganjil",
        start_date: "2026-07-01",
        end_date: "2026-12-31"
      }
    }).getContent());
    activeSemId = semRes.data.id;
    route({ action: 'set_active_semester', payload: { actor_user_id: admin.id, id: activeSemId } });
  }

  // Create Teacher 1 (assigned to student class)
  var teacher1 = createRecord(SHEETS.USERS, {
    name: 'Guru S7 Wali ' + suffix,
    email: 'guru_s7_1_' + suffix + '@example.com',
    username: 'guru_s7_1_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });

  // Create Teacher 2 (not assigned)
  var teacher2 = createRecord(SHEETS.USERS, {
    name: 'Guru S7 NonWali ' + suffix,
    email: 'guru_s7_2_' + suffix + '@example.com',
    username: 'guru_s7_2_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });

  // Create Class
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: admin.id,
      code: 'CLS_S7_' + suffix,
      name: 'Kelas S7 ' + suffix,
      level: '6'
    }
  }).getContent());
  var classId = classRes.data.id;

  // Assign teacher1 as wali kelas
  route({
    action: 'assign_class_teacher',
    payload: {
      actor_user_id: admin.id,
      class_id: classId,
      teacher_user_id: teacher1.id,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      effective_from: '2026-07-01'
    }
  });

  // Create Student
  var studentRes = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: createSprint7QaNisn(),
      nik: "1234567890123456",
      full_name: "Siswa S7 Test " + suffix,
      birth_place: "Jakarta",
      birth_date: "2014-04-14",
      gender: "P",
      status: "Aktif",
      parent_access_pin: "1234"
    }
  }).getContent());
  var studentId = studentRes.data.id;

  // Enroll student in Class
  route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: admin.id,
      student_id: studentId,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      status: 'active'
    }
  });

  return {
    admin: admin,
    teacher1: teacher1,
    teacher2: teacher2,
    classId: classId,
    studentId: studentId,
    yearId: activeYearId,
    semesterId: activeSemId
  };
}

function createSprint7QaNisn() {
  var nisn;
  var exists = true;

  while (exists) {
    nisn = String(Math.floor(7000000000 + Math.random() * 1000000000));
    exists = listRecords(SHEETS.STUDENTS, function(student) {
      return String(student.nisn) === nisn;
    }).length > 0;
  }

  return nisn;
}

/**
 * 1. Test setup_storage_folders
 */
function test_storageSetup(ctx) {
  var response = route({
    action: 'setup_storage_folders',
    payload: {
      actor_user_id: ctx.admin.id
    }
  });

  var result = JSON.parse(response.getContent());
  if (result.status !== 'success' || !result.data.storage_root_id) {
    throw new Error("setup_storage_folders failed!");
  }
}

/**
 * 2. Test file upload validations
 */
function test_fileUploadValidation(ctx, suffix) {
  var validBase64 = Utilities.base64Encode("Small test file content");

  // Test 2.1: Valid upload foto
  var uploadRes1 = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'foto',
      file_name: 'test_foto_' + suffix + '.png',
      mime_type: 'image/png',
      base64_content: validBase64
    }
  }).getContent());

  if (uploadRes1.status !== 'success') {
    throw new Error("Valid file upload failed: " + uploadRes1.message);
  }

  // Test 2.2: Valid upload KK
  var uploadRes2 = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'kk',
      file_name: 'test_kk_' + suffix + '.pdf',
      mime_type: 'application/pdf',
      base64_content: validBase64
    }
  }).getContent());

  if (uploadRes2.status !== 'success') {
    throw new Error("Valid KK upload failed: " + uploadRes2.message);
  }

  // Test 2.3: Upload file size limit > 2MB check
  // Create a large simulated base64 string (> 2MB)
  var largeBase64 = "";
  for (var i = 0; i < 30; i++) {
    largeBase64 += new Array(100000).join("A");
  }

  var uploadRes3 = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'foto',
      file_name: 'large_file_' + suffix + '.png',
      mime_type: 'image/png',
      base64_content: largeBase64
    }
  }).getContent());

  if (uploadRes3.status !== 'error' || uploadRes3.code !== 'ERR_FILE_TOO_LARGE') {
    throw new Error("Failed size validation: Large file size > 2MB was not rejected correctly. Got status: " + uploadRes3.status + ", code: " + uploadRes3.code);
  }

  // Test 2.4: Upload invalid MIME type
  var uploadRes4 = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'foto',
      file_name: 'bad_mime_' + suffix + '.txt',
      mime_type: 'text/plain',
      base64_content: validBase64
    }
  }).getContent());

  if (uploadRes4.status !== 'error' || uploadRes4.code !== 'ERR_INVALID_MIME_TYPE') {
    throw new Error("Failed MIME validation: Invalid MIME type was not rejected. Got: " + JSON.stringify(uploadRes4));
  }

  // Test 2.5: Upload invalid file type
  var uploadRes5 = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'raport', // invalid file type
      file_name: 'bad_type_' + suffix + '.pdf',
      mime_type: 'application/pdf',
      base64_content: validBase64
    }
  }).getContent());

  if (uploadRes5.status !== 'error' || uploadRes5.code !== 'ERR_INVALID_FILE_TYPE') {
    throw new Error("Failed file_type validation: Invalid file_type was not rejected. Got: " + JSON.stringify(uploadRes5));
  }
}

/**
 * 3. Test versioning logic
 */
function test_fileVersioningValidation(ctx, suffix) {
  var validBase64 = Utilities.base64Encode("Version 1 content");
  var validBase64_v2 = Utilities.base64Encode("Version 2 content");

  // Upload Version 1
  var v1Res = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'pas_foto',
      file_name: 'pas_foto_v1_' + suffix + '.png',
      mime_type: 'image/png',
      base64_content: validBase64
    }
  }).getContent());

  var fileIdV1 = v1Res.data.id;
  if (v1Res.data.version !== 1 || v1Res.data.status !== 'active') {
    throw new Error("Initial versioning metadata setup failed.");
  }

  // Replace with Version 2
  var v2Res = JSON.parse(route({
    action: 'replace_student_file',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentId,
      file_type: 'pas_foto',
      file_name: 'pas_foto_v2_' + suffix + '.png',
      mime_type: 'image/png',
      base64_content: validBase64_v2
    }
  }).getContent());

  if (v2Res.status !== 'success') {
    throw new Error("Replace student file action failed: " + v2Res.message);
  }
  if (v2Res.data.version !== 2 || v2Res.data.status !== 'active') {
    throw new Error("Versioning mismatch on replace file. Got version: " + v2Res.data.version + ", status: " + v2Res.data.status);
  }

  // Check that old record status is now 'replaced'
  var oldRecord = getRecordById(SHEETS.STUDENT_FILES, fileIdV1);
  if (oldRecord.status !== 'replaced') {
    throw new Error("Old file status was not updated to 'replaced' after replace action. Got: " + oldRecord.status);
  }
}

/**
 * 4. Test file access and role authorization
 */
function test_fileAccessAuthorization(ctx, suffix) {
  // Try uploading via Guru profile - should fail
  var guruUploadRes = JSON.parse(route({
    action: 'upload_student_file',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.studentId,
      file_type: 'foto',
      file_name: 'guru_upload_' + suffix + '.png',
      mime_type: 'image/png',
      base64_content: Utilities.base64Encode("guru content")
    }
  }).getContent());

  if (guruUploadRes.status !== 'error' || guruUploadRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed authorization: Guru was allowed to upload a file.");
  }

  // Get active KK file for student
  var activeKKs = listRecords(SHEETS.STUDENT_FILES, function(f) {
    return f.student_id === ctx.studentId && f.file_type === 'kk' && f.status === 'active';
  });
  if (activeKKs.length === 0) {
    throw new Error("Active KK file not found for student.");
  }
  var kkFileId = activeKKs[0].id;

  // Guru attempts to access KK file - should fail
  var guruAccessKKRes = JSON.parse(route({
    action: 'get_student_file_access',
    payload: {
      actor_user_id: ctx.teacher1.id,
      file_id: kkFileId
    }
  }).getContent());

  if (guruAccessKKRes.status !== 'error' || guruAccessKKRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed authorization: Guru was allowed to access KK file details.");
  }

  // Get active foto file for student
  var activeFotos = listRecords(SHEETS.STUDENT_FILES, function(f) {
    return f.student_id === ctx.studentId && f.file_type === 'foto' && f.status === 'active';
  });
  if (activeFotos.length === 0) {
    throw new Error("Active Foto file not found for student.");
  }
  var fotoFileId = activeFotos[0].id;

  // Guru 1 (wali) attempts to access foto - should succeed
  var guru1AccessFotoRes = JSON.parse(route({
    action: 'get_student_file_access',
    payload: {
      actor_user_id: ctx.teacher1.id,
      file_id: fotoFileId
    }
  }).getContent());

  if (guru1AccessFotoRes.status !== 'success') {
    throw new Error("Wali Kelas failed to access student foto: " + guru1AccessFotoRes.message);
  }

  // Guru 2 (non-wali) attempts to access foto - should fail
  var guru2AccessFotoRes = JSON.parse(route({
    action: 'get_student_file_access',
    payload: {
      actor_user_id: ctx.teacher2.id,
      file_id: fotoFileId
    }
  }).getContent());

  if (guru2AccessFotoRes.status !== 'error' || guru2AccessFotoRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed authorization: Non-wali kelas was allowed to access student foto.");
  }

  // List files for Guru 1 (wali) - should filter out sensitive metadata
  var guruListRes = JSON.parse(route({
    action: 'list_student_files',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.studentId
    }
  }).getContent());

  if (guruListRes.status !== 'success') {
    throw new Error("Wali Kelas failed to list student files.");
  }

  var sensitiveFound = guruListRes.data.some(function(f) {
    return SENSITIVE_FILE_TYPES.indexOf(f.file_type) !== -1;
  });
  if (sensitiveFound) {
    throw new Error("Security breach: Sensitive files found in Guru's list_student_files response!");
  }
}

/**
 * 5. Test auditing of sensitive files
 */
function test_sensitiveDocumentAudit(ctx) {
  var activeKKs = listRecords(SHEETS.STUDENT_FILES, function(f) {
    return f.student_id === ctx.studentId && f.file_type === 'kk' && f.status === 'active';
  });
  var kkFileId = activeKKs[0].id;

  // Log count before access
  var auditsBefore = listRecords(SHEETS.AUDIT_LOGS, function(a) {
    return a.action === 'view_sensitive_document' && a.entity_id === kkFileId;
  }).length;

  // Admin accesses KK file
  var adminAccessRes = JSON.parse(route({
    action: 'get_student_file_access',
    payload: {
      actor_user_id: ctx.admin.id,
      file_id: kkFileId
    }
  }).getContent());

  if (adminAccessRes.status !== 'success') {
    throw new Error("Admin failed to access KK file.");
  }

  // Log count after access
  var auditsAfter = listRecords(SHEETS.AUDIT_LOGS, function(a) {
    return a.action === 'view_sensitive_document' && a.entity_id === kkFileId;
  }).length;

  if (auditsAfter !== auditsBefore + 1) {
    throw new Error("Audit check failed: view_sensitive_document was not recorded in audit logs.");
  }
}

/**
 * 6. Test Drive file/sharing security
 */
function test_driveSecurityValidation(ctx) {
  var activeKKs = listRecords(SHEETS.STUDENT_FILES, function(f) {
    return f.student_id === ctx.studentId && f.file_type === 'kk' && f.status === 'active';
  });
  var driveFileId = activeKKs[0].drive_file_id;

  var driveFile = DriveApp.getFileById(driveFileId);
  var sharingAccess = driveFile.getSharingAccess();

  // Verify it is not public/anyone-with-link
  if (sharingAccess !== MimeType.FOLDER && sharingAccess === DriveApp.Access.ANYONE || sharingAccess === DriveApp.Access.ANYONE_WITH_LINK) {
    throw new Error("Security breach: Drive file was shared publicly!");
  }
}
