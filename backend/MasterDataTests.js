/**
 * MasterDataTests.gs
 * QA Verification Suite for Sprint 2 Master Data.
 */

function test_runSprint2QA() {
  console.log("=== STARTING SPRINT 2 QA TEST SUITE ===");
  
  // 1. Setup Database & Seed
  setupDatabase();
  seedInitialData();
  
  var admin = getUserByIdentifier('admin');
  if (!admin) {
    throw new Error("Admin user not found. Seeding failed.");
  }
  
  var runSuffix = createQaRunSuffix();
  var guruUser = createQaTeacherUser(runSuffix);
  console.log("Dummy guru user created for this QA run: " + guruUser.username);
  
  // Run individual test modules
  var testContext = {
    adminId: admin.id,
    guruId: guruUser.id,
    runSuffix: runSuffix
  };
  
  test_authorization(testContext);
  test_academicYears(testContext);
  test_semesters(testContext);
  test_classes(testContext);
  test_subjects(testContext);
  test_classSubjects(testContext);
  test_teacherProfiles(testContext);
  test_classTeacherAssignments(testContext);
  test_appSettings(testContext);
  test_auditLogs(testContext);
  test_regressionSprint1();
  
  console.log("=== SPRINT 2 QA TEST SUITE PASSED ===");
}

function createQaRunSuffix() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function createQaTeacherUser(runSuffix) {
  return createRecord(SHEETS.USERS, {
    name: 'Guru Test ' + runSuffix,
    email: 'guru_' + runSuffix + '@example.com',
    username: 'guru_test_' + runSuffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE,
    failed_login_attempts: 0,
    locked_until: '',
    last_login_at: ''
  }, { id: 'test', name: 'Test Runner', role: 'system' });
}

/**
 * 1. Authorization checks
 */
function test_authorization(ctx) {
  console.log("Testing authorization guards...");
  
  // Guru tries to create class - should fail with ERR_FORBIDDEN
  var payload = {
    actor_user_id: ctx.guruId,
    code: 'CLS_GURU_TEST',
    name: 'Class Guru Test',
    level: '1'
  };
  
  var response = route({ action: 'create_class', payload: payload });
  var result = JSON.parse(response.getContent());
  
  if (result.status !== 'error' || result.code !== 'ERR_FORBIDDEN') {
    throw new Error("Authorization failed: Guru was allowed to create class or incorrect error code returned: " + JSON.stringify(result));
  }
  console.log("Authorization guard validated successfully (Guru was rejected).");
}

/**
 * 2. Academic Years
 */
function test_academicYears(ctx) {
  console.log("Testing academic years...");
  
  var yearName = "2026/2027_" + ctx.runSuffix;
  var payload = {
    actor_user_id: ctx.adminId,
    name: yearName,
    start_date: "2026-07-01",
    end_date: "2027-06-30"
  };
  
  // Create Academic Year
  var resCreate = JSON.parse(route({ action: 'create_academic_year', payload: payload }).getContent());
  if (resCreate.status !== 'success') {
    throw new Error("Failed to create academic year: " + resCreate.message);
  }
  var yearId = resCreate.data.id;
  
  // Duplicate Name check
  var resDup = JSON.parse(route({ action: 'create_academic_year', payload: payload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate academic year name was allowed.");
  }
  
  // Date order check
  var badPayload = {
    actor_user_id: ctx.adminId,
    name: "BadDatesYear",
    start_date: "2027-07-01",
    end_date: "2026-06-30"
  };
  var resBadDate = JSON.parse(route({ action: 'create_academic_year', payload: badPayload }).getContent());
  if (resBadDate.status !== 'error') {
    throw new Error("Failed: Academic year start_date > end_date was allowed.");
  }
  
  // Set Active
  var resActive = JSON.parse(route({ action: 'set_active_academic_year', payload: { actor_user_id: ctx.adminId, id: yearId } }).getContent());
  if (resActive.status !== 'success') {
    throw new Error("Failed to set active academic year.");
  }
  
  // Verify active-single invariant
  var years = listAcademicYears();
  var activeCount = 0;
  years.forEach(function(y) {
    if (y.is_active === true || y.is_active === 'true') activeCount++;
  });
  if (activeCount !== 1) {
    throw new Error("Failed active-single invariant check: multiple or zero active years found: " + activeCount);
  }
  
  // Verify settings update
  var settings = getAppSettings();
  if (settings.active_academic_year_id !== yearId) {
    throw new Error("Failed to update active_academic_year_id in app settings.");
  }
  
  ctx.yearId = yearId;
  console.log("Academic years module validated successfully.");
}

/**
 * 3. Semesters
 */
function test_semesters(ctx) {
  console.log("Testing semesters...");
  
  var payloadGanjil = {
    actor_user_id: ctx.adminId,
    academic_year_id: ctx.yearId,
    name: "Ganjil",
    start_date: "2026-07-01",
    end_date: "2026-12-31"
  };
  
  var resGanjil = JSON.parse(route({ action: 'create_semester', payload: payloadGanjil }).getContent());
  if (resGanjil.status !== 'success') {
    throw new Error("Failed to create Ganjil semester: " + resGanjil.message);
  }
  var ganjilId = resGanjil.data.id;
  
  var payloadGenap = {
    actor_user_id: ctx.adminId,
    academic_year_id: ctx.yearId,
    name: "Genap",
    start_date: "2027-01-01",
    end_date: "2027-06-30"
  };
  var resGenap = JSON.parse(route({ action: 'create_semester', payload: payloadGenap }).getContent());
  if (resGenap.status !== 'success') {
    throw new Error("Failed to create Genap semester: " + resGenap.message);
  }
  var genapId = resGenap.data.id;
  
  // Duplicate semester check in same year
  var resDup = JSON.parse(route({ action: 'create_semester', payload: payloadGanjil }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate semester name in same year was allowed.");
  }
  
  // Set Active
  var resActive = JSON.parse(route({ action: 'set_active_semester', payload: { actor_user_id: ctx.adminId, id: ganjilId } }).getContent());
  if (resActive.status !== 'success') {
    throw new Error("Failed to set active semester.");
  }
  
  // Verify settings
  var settings = getAppSettings();
  if (settings.active_semester_id !== ganjilId) {
    throw new Error("Failed to update active_semester_id in app settings.");
  }
  
  ctx.semesterId = ganjilId;
  console.log("Semesters module validated successfully.");
}

/**
 * 4. Classes
 */
function test_classes(ctx) {
  console.log("Testing classes...");
  
  var classCode = "CLASS_" + ctx.runSuffix;
  var payload = {
    actor_user_id: ctx.adminId,
    code: classCode,
    name: "Kelas Test 1",
    level: "3"
  };
  
  var resCreate = JSON.parse(route({ action: 'create_class', payload: payload }).getContent());
  if (resCreate.status !== 'success') {
    throw new Error("Failed to create class: " + resCreate.message);
  }
  var classId = resCreate.data.id;
  
  // Duplicate check
  var resDup = JSON.parse(route({ action: 'create_class', payload: payload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate class code allowed.");
  }
  
  // Deactivate check
  var resDeactivate = JSON.parse(route({ action: 'deactivate_class', payload: { actor_user_id: ctx.adminId, id: classId } }).getContent());
  if (resDeactivate.status !== 'success') {
    throw new Error("Failed to deactivate class.");
  }
  
  var cls = getRecordById(SHEETS.CLASSES, classId);
  if (cls.status !== STATUS.INACTIVE) {
    throw new Error("Class deactivation did not set status to inactive.");
  }
  
  // Reactivate for downstream mappings
  updateRecord(SHEETS.CLASSES, classId, { status: STATUS.ACTIVE }, { id: 'test', name: 'Test', role: 'system' });
  
  ctx.classId = classId;
  console.log("Classes module validated successfully.");
}

/**
 * 5. Subjects
 */
function test_subjects(ctx) {
  console.log("Testing subjects...");
  
  var subjCode = "SUBJ_" + ctx.runSuffix;
  var payload = {
    actor_user_id: ctx.adminId,
    code: subjCode,
    name: "Mata Pelajaran Test"
  };
  
  var resCreate = JSON.parse(route({ action: 'create_subject', payload: payload }).getContent());
  if (resCreate.status !== 'success') {
    throw new Error("Failed to create subject: " + resCreate.message);
  }
  var subjectId = resCreate.data.id;
  
  // Duplicate check
  var resDup = JSON.parse(route({ action: 'create_subject', payload: payload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate subject code allowed.");
  }
  
  ctx.subjectId = subjectId;
  console.log("Subjects module validated successfully.");
}

/**
 * 6. Class Subjects
 */
function test_classSubjects(ctx) {
  console.log("Testing class subjects mapping...");
  
  var payload = {
    actor_user_id: ctx.adminId,
    class_id: ctx.classId,
    subject_id: ctx.subjectId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  };
  
  var resAssign = JSON.parse(route({ action: 'assign_subject_to_class', payload: payload }).getContent());
  if (resAssign.status !== 'success') {
    throw new Error("Failed to assign subject to class: " + resAssign.message);
  }
  var mappingId = resAssign.data.id;
  
  // Duplicate assignment check
  var resDup = JSON.parse(route({ action: 'assign_subject_to_class', payload: payload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate active class subject assignment allowed.");
  }
  
  // Unassign (deactivate) check
  var resUnassign = JSON.parse(route({ action: 'unassign_subject_from_class', payload: { actor_user_id: ctx.adminId, id: mappingId } }).getContent());
  if (resUnassign.status !== 'success') {
    throw new Error("Failed to unassign subject.");
  }
  var mapping = getRecordById(SHEETS.CLASS_SUBJECTS, mappingId);
  if (mapping.status !== STATUS.INACTIVE) {
    throw new Error("Unassign class subject did not set status to inactive.");
  }
  
  console.log("Class subjects module validated successfully.");
}

/**
 * 7. Teacher Profiles
 */
function test_teacherProfiles(ctx) {
  console.log("Testing teacher profiles...");
  
  var payload = {
    actor_user_id: ctx.adminId,
    user_id: ctx.guruId,
    full_name: "Guru Penguji QA " + ctx.runSuffix,
    gender: "L",
    phone: "080000" + ctx.runSuffix,
    address: "Alamat QA",
    nip: "NIP" + ctx.runSuffix,
    nuptk: "NUPTK" + ctx.runSuffix,
    position: "Guru QA"
  };
  
  var resCreate = JSON.parse(route({ action: 'create_teacher_profile', payload: payload }).getContent());
  if (resCreate.status !== 'success') {
    throw new Error("Failed to create teacher profile: " + resCreate.message);
  }
  var profileId = resCreate.data.id;
  
  // Duplicate profile check for same user
  var resDup = JSON.parse(route({ action: 'create_teacher_profile', payload: payload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate teacher profile was allowed.");
  }

  // Deactivate must soft-update the row, not delete it.
  var resDeactivate = JSON.parse(route({ action: 'deactivate_teacher_profile', payload: { actor_user_id: ctx.adminId, id: profileId } }).getContent());
  if (resDeactivate.status !== 'success') {
    throw new Error("Failed to deactivate teacher profile: " + resDeactivate.message);
  }
  
  var inactiveProfile = getRecordById(SHEETS.TEACHER_PROFILES, profileId);
  if (!inactiveProfile) {
    throw new Error("Teacher profile row was removed instead of deactivated.");
  }
  if (inactiveProfile.status !== STATUS.INACTIVE) {
    throw new Error("Teacher profile deactivation did not set status to inactive.");
  }
  
  // After deactivation, the active-duplicate rule should allow a new active profile for the same user.
  var payloadRecreate = JSON.parse(JSON.stringify(payload));
  payloadRecreate.full_name = payload.full_name + " Recreated";
  var resRecreate = JSON.parse(route({ action: 'create_teacher_profile', payload: payloadRecreate }).getContent());
  if (resRecreate.status !== 'success') {
    throw new Error("Failed to recreate teacher profile after deactivation: " + resRecreate.message);
  }
  
  assertAuditLogExists(ctx.adminId, 'create_record', SHEETS.TEACHER_PROFILES, profileId);
  assertAuditLogExists(ctx.adminId, 'update_record', SHEETS.TEACHER_PROFILES, profileId);
  
  ctx.teacherProfileId = resRecreate.data.id;
  console.log("Teacher profiles module validated successfully.");
}

function assertAuditLogExists(userId, action, entityType, entityId) {
  var logs = listRecords(SHEETS.AUDIT_LOGS, function(log) {
    return log.user_id === userId &&
           log.action === action &&
           log.entity_type === entityType &&
           log.entity_id === entityId;
  });
  
  if (logs.length === 0) {
    throw new Error("Expected audit log not found for action '" + action + "' on " + entityType + " ID " + entityId + ".");
  }
}

/**
 * 8. Class Teacher Assignments
 */
function test_classTeacherAssignments(ctx) {
  console.log("Testing class teacher assignments & handover...");
  
  var payload1 = {
    actor_user_id: ctx.adminId,
    class_id: ctx.classId,
    teacher_user_id: ctx.guruId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    effective_from: "2026-07-01",
    effective_until: "2026-10-31"
  };
  
  // Create first assignment
  var resAssign1 = JSON.parse(route({ action: 'assign_class_teacher', payload: payload1 }).getContent());
  if (resAssign1.status !== 'success') {
    throw new Error("Failed to assign first class teacher: " + resAssign1.message);
  }
  var assignId1 = resAssign1.data.id;
  
  // Try to assign teacher overlapping (from 2026-08-01 to 2026-12-31) - should fail
  var payloadOverlap = {
    actor_user_id: ctx.adminId,
    class_id: ctx.classId,
    teacher_user_id: ctx.guruId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    effective_from: "2026-08-01",
    effective_until: "2026-12-31"
  };
  var resOverlap = JSON.parse(route({ action: 'assign_class_teacher', payload: payloadOverlap }).getContent());
  if (resOverlap.status !== 'error') {
    throw new Error("Failed: Overlapping teacher assignment was allowed.");
  }
  
  // End first assignment (handover)
  var resEnd = JSON.parse(route({ action: 'end_class_teacher_assignment', payload: { actor_user_id: ctx.adminId, id: assignId1 } }).getContent());
  if (resEnd.status !== 'success') {
    throw new Error("Failed to end class teacher assignment.");
  }
  
  var endedAssign = getRecordById(SHEETS.CLASS_TEACHER_ASSIGNMENTS, assignId1);
  if (endedAssign.status !== 'ended' || !endedAssign.effective_until) {
    throw new Error("Ending assignment failed to set status to 'ended' or fill effective_until.");
  }
  
  // Try assigning new teacher (effective from 2026-11-01) - should succeed now
  var payload2 = {
    actor_user_id: ctx.adminId,
    class_id: ctx.classId,
    teacher_user_id: ctx.guruId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    effective_from: "2026-11-01",
    effective_until: "2026-12-31"
  };
  var resAssign2 = JSON.parse(route({ action: 'assign_class_teacher', payload: payload2 }).getContent());
  if (resAssign2.status !== 'success') {
    throw new Error("Failed to assign teacher after handover: " + resAssign2.message);
  }
  
  console.log("Class teacher assignments module validated successfully.");
}

/**
 * 9. App Settings
 */
function test_appSettings(ctx) {
  console.log("Testing app settings...");
  
  var expected = {
    school_name: "PKBM Mandiri Jaya",
    parent_portal_enabled: "true",
    culture_edit_limit_days_teacher: "7",
    culture_edit_limit_days_admin: "30",
    active_academic_year_id: String(ctx.yearId),
    active_semester_id: String(ctx.semesterId),
    school_logo_file_id: "qa_logo_" + ctx.runSuffix
  };
  
  var payload = {
    actor_user_id: ctx.adminId,
    settings: expected
  };
  
  var resUpdate = JSON.parse(route({ action: 'update_app_settings', payload: payload }).getContent());
  if (resUpdate.status !== 'success') {
    throw new Error("Failed to update app settings.");
  }
  
  var resGet = JSON.parse(route({ action: 'get_app_settings', payload: { actor_user_id: ctx.adminId } }).getContent());
  if (resGet.status !== 'success') {
    throw new Error("Failed to get app settings.");
  }
  
  var settingsMap = appSettingsToMap(resGet.data);
  Object.keys(expected).forEach(function(key) {
    if (String(settingsMap[key]) !== expected[key]) {
      logQaDebug("Expected app settings: " + JSON.stringify(expected));
      logQaDebug("Actual app settings: " + JSON.stringify(settingsMap));
      throw new Error("App settings values mismatch for '" + key + "'. Expected '" + expected[key] + "', got '" + settingsMap[key] + "'.");
    }
  });
  
  // Test invalid setting validation
  var badPayload = {
    actor_user_id: ctx.adminId,
    settings: {
      parent_portal_enabled: "yes" // invalid boolean string
    }
  };
  var resBad = JSON.parse(route({ action: 'update_app_settings', payload: badPayload }).getContent());
  if (resBad.status !== 'error') {
    throw new Error("Failed: Invalid parent_portal_enabled value was allowed.");
  }
  
  console.log("App settings module validated successfully.");
}

function appSettingsToMap(settings) {
  if (Array.isArray(settings)) {
    var map = {};
    settings.forEach(function(row) {
      map[row.setting_key] = row.setting_value;
    });
    return map;
  }
  return settings || {};
}

function logQaDebug(message) {
  console.log(message);
  if (typeof Logger !== 'undefined' && Logger.log) {
    Logger.log(message);
  }
}

/**
 * 10. Audit Logs
 */
function test_auditLogs(ctx) {
  console.log("Testing audit logs existence...");
  
  var logs = listRecords(SHEETS.AUDIT_LOGS);
  if (logs.length === 0) {
    throw new Error("No audit logs recorded during tests.");
  }
  
  // Verify at least some logs correspond to our test admin
  var adminLogs = logs.filter(function(log) {
    return log.user_id === ctx.adminId;
  });
  
  if (adminLogs.length === 0) {
    throw new Error("No audit logs matching admin actor ID found.");
  }
  
  console.log("Audit log verification successful.");
}

/**
 * 11. Regression Sprint 1
 */
function test_regressionSprint1() {
  console.log("Running Sprint 1 regression checks...");
  
  // health_check
  test_healthCheck();
  
  // login verification
  test_loginSuccess();
}
