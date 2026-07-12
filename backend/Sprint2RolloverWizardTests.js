/**
 * Sprint2RolloverWizardTests.gs
 * QA and E2E verification suite for Sprint 2 Rollover Setup Wizard features.
 */

var sprint2AdminToken = '';
var sprint2TeacherToken = '';

function test_runSprint2RolloverWizardQA() {
  console.log("=== STARTING SPRINT 2 ROLLOVER SETUP WIZARD QA ===");

  setupDatabase();
  seedInitialData();

  // Retrieve admin, teacher user and login
  var adminUser = getUserByIdentifier('admin');
  var teacherUser = getUserByIdentifier('guru1'); // seed initial has guru1
  if (!teacherUser) {
    // create a teacher if not seeded
    teacherUser = createUser(adminUser, {
      name: "Guru Wali Kelas QA",
      email: "guruqa@example.com",
      username: "guruqa",
      password: "Teacher123!",
      role: ROLES.TEACHER,
      status: STATUS.ACTIVE,
      phone: "0812345678"
    });
  }

  // Admin login
  var adminLoginRes = JSON.parse(route({
    action: 'login',
    payload: {
      identifier: 'admin',
      password: 'Admin123!',
      ip_address: '127.0.0.1',
      user_agent: 'Sprint2-QA-Test'
    }
  }).getContent());
  sprint2AdminToken = adminLoginRes.data.token;

  // Teacher login
  var teacherLoginRes = JSON.parse(route({
    action: 'login',
    payload: {
      identifier: teacherUser.username,
      password: 'Teacher123!',
      ip_address: '127.0.0.1',
      user_agent: 'Sprint2-QA-Test'
    }
  }).getContent());
  sprint2TeacherToken = teacherLoginRes.data.token;

  var suffix = new Date().getTime() + "_" + Math.floor(Math.random() * 100000);

  // Set up periods: Academic Year A (2025/2026) and B (2026/2027)
  var yearARes = assertSprint2RouteSuccess('create_academic_year', {
    name: "AY_A_" + suffix,
    start_date: "2025-07-01",
    end_date: "2026-06-30"
  });
  var yearAId = yearARes.data.id;

  var semA1Res = assertSprint2RouteSuccess('create_semester', {
    academic_year_id: yearAId,
    name: "Ganjil",
    start_date: "2025-07-01",
    end_date: "2025-12-31"
  });
  var semA1Id = semA1Res.data.id;

  var yearBRes = assertSprint2RouteSuccess('create_academic_year', {
    name: "AY_B_" + suffix,
    start_date: "2026-07-01",
    end_date: "2027-06-30"
  });
  var yearBId = yearBRes.data.id;

  var semB1Res = assertSprint2RouteSuccess('create_semester', {
    academic_year_id: yearBId,
    name: "Ganjil",
    start_date: "2026-07-01",
    end_date: "2026-12-31"
  });
  var semB1Id = semB1Res.data.id;

  // 1. Create a class and subject
  var classRes = assertSprint2RouteSuccess('create_class', {
    code: 'CLS_' + suffix,
    name: 'Kelas QA ' + suffix,
    level: '7'
  });
  var classId = classRes.data.id;

  var subjectRes = assertSprint2RouteSuccess('create_subject', {
    code: 'SUB_' + suffix,
    name: 'Subjek QA ' + suffix
  });
  var subjectId = subjectRes.data.id;

  // Set year A and sem A1 active
  assertSprint2RouteSuccess('set_active_academic_year', { id: yearAId });

  // --- TEST CASE 1: Readiness check per class ---
  console.log("Running QA 1: Detailed period setup readiness checks...");
  var readinessRes = assertSprint2RouteSuccess('get_period_setup_readiness', {});
  var readiness = readinessRes.data;
  
  if (readiness.overall_status !== 'not_ready') {
    throw new Error("Expected overall readiness status to be 'not_ready' for empty class setups.");
  }
  if (readiness.summary.total_classes === 0) {
    throw new Error("Expected total classes to be greater than 0.");
  }
  
  var classDetail = readiness.classes.find(function(c) { return c.class_id === classId; });
  if (!classDetail) {
    throw new Error("Active class not found in readiness details.");
  }
  if (classDetail.status !== 'not_ready' || classDetail.has_teacher_assignment !== false || classDetail.has_subject_mapping !== false) {
    throw new Error("Class detail status expected to be 'not_ready' with no mapping/assignments.");
  }
  if (classDetail.issues.length !== 2) {
    throw new Error("Expected 2 issues for not_ready class. Got: " + JSON.stringify(classDetail.issues));
  }

  // --- TEST CASE 2: Rollover Previews Validation ---
  console.log("Running QA 2: Preview parameter validation checks...");
  
  // Source and Target same
  var errSame = assertSprint2RouteError('preview_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearAId,
    target_semester_id: semA1Id
  });
  if (errSame.code !== 'ERR_INVALID_PARAMETER') {
    throw new Error("Expected ERR_INVALID_PARAMETER when source == target.");
  }

  // Source period empty (no assignments in Year A)
  var errEmptySource = assertSprint2RouteError('preview_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (errEmptySource.code !== 'ERR_NOT_FOUND') {
    throw new Error("Expected ERR_NOT_FOUND for empty source period preview. Got: " + JSON.stringify(errEmptySource));
  }

  // Target period missing
  var errMissingTarget = assertSprint2RouteError('preview_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: 'NON_EXISTENT',
    target_semester_id: 'NON_EXISTENT'
  });
  if (errMissingTarget.code !== 'ERR_NOT_FOUND') {
    throw new Error("Expected ERR_NOT_FOUND for non-existent target period.");
  }

  // --- TEST CASE 3: Security checks (Guru & Parent) ---
  console.log("Running QA 3: Endpoint security checks...");
  
  // Guru cannot preview assignment
  var resGuruPrev = JSON.parse(route({
    action: 'preview_assignment_rollover',
    payload: {
      source_academic_year_id: yearAId,
      source_semester_id: semA1Id,
      target_academic_year_id: yearBId,
      target_semester_id: semB1Id
    },
    token: sprint2TeacherToken
  }).getContent());
  if (resGuruPrev.status !== 'error' || resGuruPrev.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Teacher to be rejected with ERR_FORBIDDEN from preview_assignment_rollover.");
  }

  // Guru cannot execute rollover
  var resGuruExec = JSON.parse(route({
    action: 'execute_assignment_rollover',
    payload: {
      source_academic_year_id: yearAId,
      source_semester_id: semA1Id,
      target_academic_year_id: yearBId,
      target_semester_id: semB1Id
    },
    token: sprint2TeacherToken
  }).getContent());
  if (resGuruExec.status !== 'error' || resGuruExec.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Teacher to be rejected with ERR_FORBIDDEN from execute_assignment_rollover.");
  }

  // --- TEST CASE 4: Normal Rollover Copy Operations ---
  console.log("Running QA 4: Normal rollover copying operations...");
  
  // Set up source active data
  assertSprint2RouteSuccess('assign_class_teacher', {
    class_id: classId,
    teacher_user_id: teacherUser.id,
    academic_year_id: yearAId,
    semester_id: semA1Id,
    effective_from: "2025-07-01"
  });

  assertSprint2RouteSuccess('assign_subject_to_class', {
    class_id: classId,
    subject_id: subjectId,
    academic_year_id: yearAId,
    semester_id: semA1Id
  });

  // Verify readiness is now ready!
  var readyRes = assertSprint2RouteSuccess('get_period_setup_readiness', {});
  var readyData = readyRes.data;
  var clReady = readyData.classes.find(function(c) { return c.class_id === classId; });
  if (clReady.status !== 'ready' || clReady.has_teacher_assignment !== true || clReady.has_subject_mapping !== true) {
    throw new Error("Expected class setup readiness status to be 'ready' after assignment & subject mapping.");
  }

  // Preview Assignment Rollover
  var prevAssign = assertSprint2RouteSuccess('preview_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (prevAssign.data.total_found !== 1 || prevAssign.data.assignments[0].teacher_name !== teacherUser.name) {
    throw new Error("Preview assignment data mismatch. Got: " + JSON.stringify(prevAssign.data));
  }

  // Preview Subject Rollover
  var prevSubject = assertSprint2RouteSuccess('preview_subject_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (prevSubject.data.total_found !== 1 || prevSubject.data.subjects[0].subject_id !== subjectId) {
    throw new Error("Preview subject data mismatch. Got: " + JSON.stringify(prevSubject.data));
  }

  // Execute Assignment Rollover
  var execAssign = assertSprint2RouteSuccess('execute_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (execAssign.data.copied !== 1 || execAssign.data.skipped !== 0) {
    throw new Error("Expected 1 copied assignment, got: " + JSON.stringify(execAssign.data));
  }

  // Execute Subject Rollover
  var execSubject = assertSprint2RouteSuccess('execute_subject_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (execSubject.data.copied !== 1 || execSubject.data.skipped !== 0) {
    throw new Error("Expected 1 copied subject mapping, got: " + JSON.stringify(execSubject.data));
  }

  // --- TEST CASE 5: Duplicate and Conflict check on re-rollover ---
  console.log("Running QA 5: Duplicates and conflicts detection...");
  
  // Double executing assignment (should skip since teacher is the same)
  var execAssignDup = assertSprint2RouteSuccess('execute_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (execAssignDup.data.copied !== 0 || execAssignDup.data.skipped !== 1) {
    throw new Error("Expected 0 copied, 1 skipped for same teacher duplicate assignment.");
  }

  // Double executing subject (should skip)
  var execSubDup = assertSprint2RouteSuccess('execute_subject_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  if (execSubDup.data.copied !== 0 || execSubDup.data.skipped !== 1) {
    throw new Error("Expected 0 copied, 1 skipped for duplicate subject mapping.");
  }

  // Conflict Scenario: Create a different teacher in source period or target period
  // Let's create another teacher profile
  var anotherTeacherUser = createUser(adminUser, {
    name: "Guru QA Lainnya",
    email: "guruqa2@example.com",
    username: "guruqa2",
    password: "Teacher123!",
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE,
    phone: "0812345679"
  });

  // Temporarily deactivate old assignment on target period and create a new assignment for another teacher in target period
  // This simulates the target period already having a different teacher assigned.
  var targetAssignRecord = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(ta) {
    return ta.class_id === classId &&
           ta.academic_year_id === yearBId &&
           ta.semester_id === semB1Id &&
           ta.status === STATUS.ACTIVE;
  });
  
  // Update target assignment to represent another teacher in the target period
  updateRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, targetAssignRecord[0].id, {
    teacher_user_id: anotherTeacherUser.id
  });

  // Now, try executing rollover again from source (which has original teacherUser).
  // Target already has Class QA assigned to anotherTeacherUser.
  // Rollover should skip/block overwrite and not create a duplicate.
  var execAssignConf = assertSprint2RouteSuccess('execute_assignment_rollover', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  });
  
  if (execAssignConf.data.copied !== 0 || execAssignConf.data.skipped !== 1) {
    throw new Error("Expected 0 copied, 1 skipped (conflict handled) for different teacher assignment. Got: " + JSON.stringify(execAssignConf.data));
  }

  // Verify that there is still only ONE active teacher assignment for target period class QA
  var finalTargetAssigns = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(ta) {
    return ta.class_id === classId &&
           ta.academic_year_id === yearBId &&
           ta.semester_id === semB1Id &&
           ta.status === STATUS.ACTIVE;
  });
  if (finalTargetAssigns.length !== 1) {
    throw new Error("Integrity broken: more than one active class teacher assignment for target class. Count: " + finalTargetAssigns.length);
  }

  // --- TEST CASE 6: Audit log creation check ---
  console.log("Running QA 6: Audit logging verification...");
  
  var logs = readAuditLogRows();
  var assignAudit = logs.filter(function(l) { return l.action === 'ROLLOVER_COPY_ASSIGNMENTS'; });
  var subAudit = logs.filter(function(l) { return l.action === 'ROLLOVER_COPY_SUBJECTS'; });
  
  if (assignAudit.length === 0) {
    throw new Error("Expected to find ROLLOVER_COPY_ASSIGNMENTS audit log entry.");
  }
  if (subAudit.length === 0) {
    throw new Error("Expected to find ROLLOVER_COPY_SUBJECTS audit log entry.");
  }
  
  var assignMeta = JSON.parse(assignAudit[assignAudit.length - 1].new_value);
  if (assignMeta.source_academic_year_id !== yearAId || assignMeta.target_academic_year_id !== yearBId) {
    throw new Error("Audit log metadata mismatch.");
  }

  // Reset database back to clean seeded state
  setupDatabase();
  seedInitialData();

  console.log("=== SPRINT 2 ROLLOVER SETUP WIZARD QA PASSED ===");
}

function assertSprint2RouteSuccess(action, payload, adminToken) {
  var requestObj = {
    action: action,
    payload: payload || {}
  };
  requestObj.token = adminToken || sprint2AdminToken;
  var result = JSON.parse(route(requestObj).getContent());

  if (result.status !== 'success') {
    throw new Error("Action " + action + " failed: " + JSON.stringify(result));
  }

  return result;
}

function assertSprint2RouteError(action, payload, adminToken) {
  var requestObj = {
    action: action,
    payload: payload || {}
  };
  requestObj.token = adminToken || sprint2AdminToken;
  var result = JSON.parse(route(requestObj).getContent());

  if (result.status !== 'error') {
    throw new Error("Action " + action + " expected to fail but succeeded: " + JSON.stringify(result));
  }

  return result;
}
