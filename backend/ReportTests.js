/**
 * ReportTests.gs
 * QA verification and regression testing suite for Sprint 10.
 */

function test_runSprint10QA() {
  console.log("=== STARTING SPRINT 10 QA TEST SUITE ===");

  test_runSprint10SmokeRegressionQA();
  test_runSprint10ReportsQA();

  console.log("Run test_runSprint10SnapshotQA() and test_runSprint10FinalizationQA() separately for complete Sprint 10 validation.");
  console.log("=== SPRINT 10 CORE QA PASSED ===");
}

function test_runSprint10SmokeRegressionQA() {
  console.log("=== STARTING SPRINT 10 SMOKE REGRESSION QA ===");

  setupDatabase();
  seedInitialData();
  runSprint10SmokeRegressions();

  console.log("=== SPRINT 10 SMOKE REGRESSION QA PASSED ===");
}

function test_runSprint10ReportsQA() {
  console.log("=== STARTING SPRINT 10 REPORTS QA ===");

  var suffix = createSprint10SmokeSuffix();
  var ctx = setupSprint10TestContext(suffix);

  test_studentReports(ctx);
  console.log("Student report validation successful.");

  test_classReports(ctx);
  console.log("Class report validation successful.");

  test_schoolReport(ctx);
  console.log("School report validation successful.");

  test_reportSecurity(ctx, suffix);
  console.log("Report security validation successful.");

  console.log("=== SPRINT 10 REPORTS QA PASSED ===");
}

function test_runSprint10SnapshotQA() {
  console.log("=== STARTING SPRINT 10 SNAPSHOT QA ===");

  var suffix = createSprint10SmokeSuffix();
  var ctx = setupSprint10TestContext(suffix);

  test_snapshotArchive(ctx);
  console.log("Snapshot archive validation successful.");

  test_snapshotImmutability(ctx);
  console.log("Snapshot immutability validation successful.");

  console.log("=== SPRINT 10 SNAPSHOT QA PASSED ===");
}

function test_runSprint10FinalizationQA() {
  console.log("=== STARTING SPRINT 10 FINALIZATION QA ===");

  var suffix = createSprint10SmokeSuffix();
  var ctx = setupSprint10TestContext(suffix);

  test_semesterFinalizationLock(ctx);

  console.log("=== SPRINT 10 FINALIZATION QA PASSED ===");
}

function runSprint10SmokeRegressions() {
  var admin = getUserByIdentifier('admin');
  if (!admin) throw new Error("Admin user not found.");
  resetFailedLogin(admin);

  var actorPayload = { actor_user_id: admin.id };

  // Sprint 1
  assertSprint10RouteSuccess('health_check', {});
  assertSprint10RouteSuccess('login', {
    identifier: 'admin',
    password: 'Admin123!',
    ip_address: '127.0.0.1',
    user_agent: 'Sprint10-Smoke-Test'
  });
  console.log("Sprint 1 smoke regression passed.");

  // Sprint 2
  assertSprint10RouteSuccess('list_academic_years', actorPayload);
  assertSprint10RouteSuccess('list_classes', actorPayload);
  assertSprint10RouteSuccess('list_subjects', actorPayload);
  assertSprint10RouteSuccess('get_app_settings', actorPayload);
  console.log("Sprint 2 smoke regression passed.");

  // Sprint 3
  assertSprint10RouteSuccess('list_students', actorPayload);
  assertSprint10RouteSuccess('list_student_enrollments', actorPayload);
  console.log("Sprint 3 smoke regression passed.");

  // Sprint 4
  assertSprint10RouteSuccess('list_academic_assessments', actorPayload);
  console.log("Sprint 4 smoke regression passed.");

  // Sprint 5
  assertSprint10RouteSuccess('get_student_character_summary', {
    actor_user_id: admin.id,
    student_id: listRecords(SHEETS.STUDENTS)[0].id,
    academic_year_id: getAppSettings().active_academic_year_id,
    semester_id: getAppSettings().active_semester_id
  });
  console.log("Sprint 5 smoke regression passed.");

  // Sprint 6
  assertSprint10RouteSuccess('get_school_dashboard', actorPayload);
  console.log("Sprint 6 smoke regression passed.");

  // Sprint 7
  assertSprint10RouteSuccess('setup_storage_folders', actorPayload);
  assertSprint10RouteSuccess('list_student_files', {
    actor_user_id: admin.id,
    student_id: listRecords(SHEETS.STUDENTS)[0].id
  });
  console.log("Sprint 7 smoke regression passed.");

  // Sprint 8
  // Verify access for parent
  var parentStudent = listRecords(SHEETS.STUDENTS, function(s) { return s.parent_access_pin; })[0];
  if (parentStudent) {
    var parentRes = assertSprint10RouteSuccess('parent_verify_access', {
      nisn: parentStudent.nisn,
      birth_date: parentStudent.birth_date,
      pin: '1234' // default seed PIN is '1234'
    });
    assertSprint10RouteSuccess('parent_get_dashboard', {
      parent_access_token: parentRes.data.parent_access_token
    });
  }
  console.log("Sprint 8 smoke regression passed.");

  // Sprint 9
  var sprint9SmokeSuffix = createSprint10SmokeSuffix();
  var sprint9SmokeNisn = createSprint10SmokeNisn();
  assertSprint10RouteSuccess('create_import_session', {
    actor_user_id: admin.id,
    import_type: 'students',
    file_name: 'sprint10_smoke_students_' + sprint9SmokeSuffix + '.csv',
    csv_content: "nisn,full_name,birth_date,gender,status\n" +
      sprint9SmokeNisn + ",Smoke Student Sprint 10 " + sprint9SmokeSuffix + ",2015-01-01,L,Aktif"
  }, "Sprint 9 import session smoke failed");
  console.log("Sprint 9 smoke regression passed.");
}

function assertSprint10RouteSuccess(action, payload, errorMsg) {
  payload = payload || {};
  if (isSprint10ProtectedRoute(action) && !payload.actor_user_id && !payload.parent_access_token) {
    throw new Error("Test payload missing actor_user_id or parent_access_token for protected endpoint: " + action);
  }
  
  var response = route({ action: action, payload: payload });
  var result = JSON.parse(response.getContent());
  if (result.status !== 'success') {
    throw new Error((errorMsg || (action + " failed")) + ": " + JSON.stringify(result));
  }
  return result;
}

function isSprint10ProtectedRoute(action) {
  return [
    'export_student_academic_report',
    'export_student_character_report',
    'export_student_full_report',
    'export_class_academic_report',
    'export_class_character_report',
    'export_class_full_report',
    'export_school_summary_report',
    'create_student_report_snapshot',
    'create_class_report_snapshot',
    'get_report_snapshot',
    'list_report_exports',
    'finalize_semester_reports',
    'get_semester_finalization_status'
  ].indexOf(action) !== -1;
}

function createSprint10SmokeSuffix() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 100000);
}

function createSprint10SmokeNisn() {
  var nisn;
  var exists = true;

  while (exists) {
    nisn = String(Math.floor(9000000000 + Math.random() * 1000000000));
    exists = listRecords(SHEETS.STUDENTS, function(student) {
      return String(student.nisn).trim() === nisn;
    }).length > 0;
  }

  return nisn;
}

function setupSprint10TestContext(suffix) {
  var admin = getUserByIdentifier('admin');
  
  // Create a unique academic year and semester to avoid locking shared test contexts
  var yearRes = assertSprint10RouteSuccess('create_academic_year', {
    actor_user_id: admin.id,
    name: "AY_S10_" + suffix,
    start_date: "2026-07-01",
    end_date: "2027-06-30"
  });
  var yearId = yearRes.data.id;
  
  var semRes = assertSprint10RouteSuccess('create_semester', {
    actor_user_id: admin.id,
    academic_year_id: yearId,
    name: "Ganjil",
    start_date: "2026-07-01",
    end_date: "2026-12-31"
  });
  var semesterId = semRes.data.id;

  // Create Class
  var classRes = assertSprint10RouteSuccess('create_class', {
    actor_user_id: admin.id,
    code: 'CLS_S10_' + suffix,
    name: 'Kelas S10 ' + suffix,
    level: '6'
  });
  var classId = classRes.data.id;

  // Create Teachers
  var teacher1 = createRecord(SHEETS.USERS, {
    name: 'Guru S10 Assigned ' + suffix,
    email: 'guru_s10_a_' + suffix + '@example.com',
    username: 'guru_s10_a_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });

  var teacher2 = createRecord(SHEETS.USERS, {
    name: 'Guru S10 Unassigned ' + suffix,
    email: 'guru_s10_b_' + suffix + '@example.com',
    username: 'guru_s10_b_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });

  // Assign Teacher 1 to Class
  route({
    action: 'assign_class_teacher',
    payload: {
      actor_user_id: admin.id,
      class_id: classId,
      teacher_user_id: teacher1.id,
      academic_year_id: yearId,
      semester_id: semesterId,
      effective_from: '2026-07-01'
    }
  });

  // Create Subject
  var subjRes = assertSprint10RouteSuccess('create_subject', {
    actor_user_id: admin.id,
    code: 'SBJ_S10_' + suffix,
    name: 'Subject S10 ' + suffix
  });
  var subjectId = subjRes.data.id;

  route({
    action: 'assign_subject_to_class',
    payload: {
      actor_user_id: admin.id,
      class_id: classId,
      subject_id: subjectId,
      academic_year_id: yearId,
      semester_id: semesterId
    }
  });

  // Create Student
  var studentRes = assertSprint10RouteSuccess('create_student', {
    actor_user_id: admin.id,
    nisn: String(Math.floor(1000000000 + Math.random() * 9000000000)),
    nik: '7100000000000000',
    full_name: 'Siswa S10 ' + suffix,
    birth_date: '2015-05-15',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '9876'
  });
  var studentId = studentRes.data.id;

  // Enroll Student
  var enrollRes = assertSprint10RouteSuccess('create_student_enrollment', {
    actor_user_id: admin.id,
    student_id: studentId,
    class_id: classId,
    academic_year_id: yearId,
    semester_id: semesterId,
    status: 'active'
  });
  var enrollmentId = enrollRes.data.id;

  // Create Assessment & Score
  var assessRes = assertSprint10RouteSuccess('create_academic_assessment', {
    actor_user_id: admin.id,
    class_id: classId,
    subject_id: subjectId,
    academic_year_id: yearId,
    semester_id: semesterId,
    title: 'Assess S10 ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  });
  var assessmentId = assessRes.data.id;

  route({
    action: 'publish_academic_assessment',
    payload: { actor_user_id: admin.id, id: assessmentId }
  });

  route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: teacher1.id,
      assessment_id: assessmentId,
      scores: [
        { student_id: studentId, student_enrollment_id: enrollmentId, score: 85, note: 'Great job!' }
      ]
    }
  });

  // Create Culture Scores
  route({
    action: 'save_culture_scores',
    payload: {
      actor_user_id: teacher1.id,
      class_id: classId,
      academic_year_id: yearId,
      semester_id: semesterId,
      score_date: '2026-07-10',
      scores: [
        { student_id: studentId, student_enrollment_id: enrollmentId, sss: 3, am: 4, hb: 3, asm: 4, br: 3, ak: 4, tm: 3 }
      ]
    }
  });

  return {
    admin: admin,
    teacher1: teacher1,
    teacher2: teacher2,
    studentId: studentId,
    enrollmentId: enrollmentId,
    classId: classId,
    yearId: yearId,
    semesterId: semesterId,
    assessmentId: assessmentId,
    subjectId: subjectId
  };
}

function test_studentReports(ctx) {
  var payload = {
    actor_user_id: ctx.admin.id,
    student_id: ctx.studentId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  };

  // Student Academic Report
  var resAcad = assertSprint10RouteSuccess('export_student_academic_report', payload);
  var dataAcad = resAcad.data;
  if (dataAcad.report_type !== 'student_academic') throw new Error("Incorrect report_type for academic report.");
  if (dataAcad.student.nik !== undefined || dataAcad.student.parent_access_pin_hash !== undefined) {
    throw new Error("Student academic report leaked sensitive fields.");
  }
  if (dataAcad.overall_average !== 85) throw new Error("Incorrect student academic average score.");

  // Student Character Report
  var resChar = assertSprint10RouteSuccess('export_student_character_report', payload);
  var dataChar = resChar.data;
  if (dataChar.report_type !== 'student_character') throw new Error("Incorrect report_type for character report.");
  if (dataChar.fitrah.F === null) throw new Error("Missing fitrah scores in character report.");

  // Student Full Report
  var resFull = assertSprint10RouteSuccess('export_student_full_report', payload);
  var dataFull = resFull.data;
  if (dataFull.report_type !== 'student_full') throw new Error("Incorrect report_type for full report.");
  if (!dataFull.academic || !dataFull.character || !dataFull.summary) {
    throw new Error("Missing composite sections in full student report.");
  }
  
  var unauthRes = JSON.parse(route({
    action: 'export_student_academic_report',
    payload: {
      student_id: ctx.studentId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (unauthRes.status !== 'error' || unauthRes.code !== 'ERR_UNAUTHORIZED') {
    throw new Error("Student report without actor/token should be unauthorized. Response: " + JSON.stringify(unauthRes));
  }
}

function test_classReports(ctx) {
  var payload = {
    actor_user_id: ctx.admin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  };

  // Class Academic Report
  var resAcad = assertSprint10RouteSuccess('export_class_academic_report', payload);
  if (resAcad.data.report_type !== 'class_academic') throw new Error("Incorrect class academic report type.");
  if (resAcad.data.class_average !== 85) throw new Error("Incorrect class average calculated.");

  // Class Character Report
  var resChar = assertSprint10RouteSuccess('export_class_character_report', payload);
  if (resChar.data.report_type !== 'class_character') throw new Error("Incorrect class character report type.");

  // Class Full Report
  var resFull = assertSprint10RouteSuccess('export_class_full_report', payload);
  if (resFull.data.report_type !== 'class_full') throw new Error("Incorrect class full report type.");
}

function test_schoolReport(ctx) {
  var res = assertSprint10RouteSuccess('export_school_summary_report', {
    actor_user_id: ctx.admin.id
  });
  if (res.data.report_type !== 'school_summary') throw new Error("Incorrect school summary report type.");
}

function test_reportSecurity(ctx, suffix) {
  // Assigned teacher should have access to class reports
  assertSprint10RouteSuccess('export_class_full_report', {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });

  // Unassigned teacher should not have access to class reports
  var failRes = JSON.parse(route({
    action: 'export_class_full_report',
    payload: {
      actor_user_id: ctx.teacher2.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (failRes.status !== 'error' || failRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Unassigned teacher was allowed to export class report.");
  }

  // Parent Token mode test
  var student = getRecordById(SHEETS.STUDENTS, ctx.studentId);
  var parentVerify = assertSprint10RouteSuccess('parent_verify_access', {
    nisn: student.nisn,
    birth_date: student.birth_date,
    pin: '9876'
  });
  var parentToken = parentVerify.data.parent_access_token;

  var parentAcadRep = assertSprint10RouteSuccess('export_student_academic_report', {
    parent_access_token: parentToken,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  if (parentAcadRep.data.report_type !== 'student_academic') {
    throw new Error("Parent mode failed to retrieve student report.");
  }
}

function test_snapshotArchive(ctx) {
  // Create Student snapshot
  var snapRes = assertSprint10RouteSuccess('create_student_report_snapshot', {
    actor_user_id: ctx.admin.id,
    student_id: ctx.studentId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  var snapshotId = snapRes.data.snapshot_id;

  // Get report snapshot details
  var getSnap = assertSprint10RouteSuccess('get_report_snapshot', {
    actor_user_id: ctx.admin.id,
    snapshot_id: snapshotId
  });
  if (!getSnap.data.snapshot_payload || getSnap.data.snapshot_payload.report_type !== 'student_full') {
    throw new Error("Student snapshot payload not correctly stored or retrieved.");
  }

  // Create Class snapshot
  var classSnapRes = assertSprint10RouteSuccess('create_class_report_snapshot', {
    actor_user_id: ctx.admin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  var classSnapshotId = classSnapRes.data.snapshot_id;

  var getClassSnap = assertSprint10RouteSuccess('get_report_snapshot', {
    actor_user_id: ctx.admin.id,
    snapshot_id: classSnapshotId
  });
  if (!getClassSnap.data.snapshot_payload || getClassSnap.data.snapshot_payload.report_type !== 'class_full') {
    throw new Error("Class snapshot payload not correctly stored or retrieved.");
  }

  // List Exports check
  var listExports = assertSprint10RouteSuccess('list_report_exports', {
    actor_user_id: ctx.admin.id
  });
  var foundStudent = listExports.data.some(function(exp) { return exp.snapshot_id === snapshotId; });
  var foundClass = listExports.data.some(function(exp) { return exp.snapshot_id === classSnapshotId; });
  if (!foundStudent || !foundClass) throw new Error("Snapshot was not recorded in report_exports archive log.");
  
  ctx.snapshotId = snapshotId;
  ctx.classSnapshotId = classSnapshotId;
}

function test_snapshotImmutability(ctx) {
  // Retrieve original snapshot score
  var originalSnap = assertSprint10RouteSuccess('get_report_snapshot', {
    actor_user_id: ctx.admin.id,
    snapshot_id: ctx.snapshotId
  });
  var originalScore = originalSnap.data.snapshot_payload.overall_average;

  // Let's modify the academic score for the student
  var activeScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.assessment_id === ctx.assessmentId && s.student_id === ctx.studentId;
  });
  if (activeScores.length === 0) throw new Error("No academic score found to edit.");
  
  // Update score from 85 to 95
  route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: ctx.teacher1.id,
      assessment_id: ctx.assessmentId,
      scores: [
        { student_id: ctx.studentId, student_enrollment_id: ctx.enrollmentId, score: 95, note: 'Updated note' }
      ]
    }
  });

  // Verify real-time report returns updated score (95)
  var freshReport = assertSprint10RouteSuccess('export_student_academic_report', {
    actor_user_id: ctx.admin.id,
    student_id: ctx.studentId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  if (freshReport.data.overall_average !== 95) {
    throw new Error("Realtime report failed to reflect updated score. Got: " + freshReport.data.overall_average);
  }

  // Verify snapshot still returns original score (85)
  var fetchedSnap = assertSprint10RouteSuccess('get_report_snapshot', {
    actor_user_id: ctx.admin.id,
    snapshot_id: ctx.snapshotId
  });
  if (fetchedSnap.data.snapshot_payload.overall_average !== originalScore) {
    throw new Error("Snapshot is not immutable! Score changed from " + originalScore + " to " + fetchedSnap.data.snapshot_payload.overall_average);
  }
}

function test_semesterFinalizationLock(ctx) {
  // Check semester lock state is active=false initially
  var statusRes = assertSprint10RouteSuccess('get_semester_finalization_status', {
    actor_user_id: ctx.admin.id,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  if (statusRes.data.finalized !== false) throw new Error("Semester should start unfinalized.");

  var unauthStatusRes = JSON.parse(route({
    action: 'get_semester_finalization_status',
    payload: {
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (unauthStatusRes.status !== 'error' || unauthStatusRes.code !== 'ERR_UNAUTHORIZED') {
    throw new Error("Semester finalization status without actor should be unauthorized. Response: " + JSON.stringify(unauthStatusRes));
  }

  var teacherFinalizeRes = JSON.parse(route({
    action: 'finalize_semester_reports',
    payload: {
      actor_user_id: ctx.teacher1.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (teacherFinalizeRes.status !== 'error' || teacherFinalizeRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Teacher should not be allowed to finalize semester reports. Response: " + JSON.stringify(teacherFinalizeRes));
  }

  // Finalize semester reports
  var finalizeRes = assertSprint10RouteSuccess('finalize_semester_reports', {
    actor_user_id: ctx.admin.id,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  if (finalizeRes.data.finalized !== true) throw new Error("Finalize endpoint did not lock the semester.");
  
  var finalizedStatusRes = assertSprint10RouteSuccess('get_semester_finalization_status', {
    actor_user_id: ctx.admin.id,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  });
  if (finalizedStatusRes.data.finalized !== true) {
    throw new Error("Semester finalization status endpoint did not report finalized=true after finalize. Response: " + JSON.stringify(finalizedStatusRes));
  }
  
  if (isSemesterFinalized(ctx.yearId, ctx.semesterId) !== true) {
    throw new Error("isSemesterFinalized returned false after finalize for key " + getSemesterFinalizationKey(ctx.yearId, ctx.semesterId));
  }
  console.log("Semester finalization validation successful.");

  // Try updating Academic Score -> Must throw ERR_SEMESTER_FINALIZED
  var activeScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.assessment_id === ctx.assessmentId &&
           s.student_id === ctx.studentId &&
           s.status === STATUS.ACTIVE;
  });
  if (activeScores.length === 0) {
    throw new Error("No academic score found for finalization lock test.");
  }
  
  var acadLockTest = JSON.parse(route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: ctx.teacher1.id,
      assessment_id: ctx.assessmentId,
      scores: [
        { student_id: ctx.studentId, student_enrollment_id: ctx.enrollmentId, score: 90 }
      ]
    }
  }).getContent());
  if (acadLockTest.status !== 'error' || acadLockTest.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Academic score modification allowed in finalized semester! Response: " + JSON.stringify(acadLockTest));
  }

  var singleAcadLockTest = JSON.parse(route({
    action: 'update_academic_score',
    payload: {
      actor_user_id: ctx.teacher1.id,
      id: activeScores[0].id,
      score: 91
    }
  }).getContent());
  if (singleAcadLockTest.status !== 'error' || singleAcadLockTest.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Single academic score update allowed in finalized semester! Response: " + JSON.stringify(singleAcadLockTest));
  }
  console.log("Academic finalized lock validation successful.");

  // Try updating Culture Score -> Must throw ERR_SEMESTER_FINALIZED
  var activeCultureScores = listRecords(SHEETS.CULTURE_SCORES, function(s) {
    return s.class_id === ctx.classId &&
           s.student_id === ctx.studentId &&
           s.academic_year_id === ctx.yearId &&
           s.semester_id === ctx.semesterId &&
           s.status === 'active';
  });
  if (activeCultureScores.length === 0) {
    throw new Error("No culture score found for finalization lock test.");
  }
  
  var cultureLockTest = JSON.parse(route({
    action: 'save_culture_scores',
    payload: {
      actor_user_id: ctx.teacher1.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      score_date: '2026-07-10',
      scores: [
        { student_id: ctx.studentId, student_enrollment_id: ctx.enrollmentId, sss: 4 }
      ]
    }
  }).getContent());
  if (cultureLockTest.status !== 'error' || cultureLockTest.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Culture score modification allowed in finalized semester! Response: " + JSON.stringify(cultureLockTest));
  }

  var singleCultureLockTest = JSON.parse(route({
    action: 'update_culture_score',
    payload: {
      actor_user_id: ctx.teacher1.id,
      id: activeCultureScores[0].id,
      sss: 4
    }
  }).getContent());
  if (singleCultureLockTest.status !== 'error' || singleCultureLockTest.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Single culture score update allowed in finalized semester! Response: " + JSON.stringify(singleCultureLockTest));
  }
  console.log("Culture finalized lock validation successful.");
}
