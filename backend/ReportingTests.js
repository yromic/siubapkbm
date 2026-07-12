/**
 * ReportingTests.gs
 * QA verification and regression testing suite for Sprint 6.
 */

function test_runSprint6QA() {
  console.log("=== STARTING SPRINT 6 QA TEST SUITE ===");

  // 1. Run Regression Tests for Sprint 1-5
  console.log("Running regression tests for Sprint 1-5...");
  test_runSprint5QA();
  console.log("Regression tests complete.");

  // 2. Setup Context for Sprint 6
  var suffix = String(Math.floor(Math.random() * 100000));
  var ctx = setupSprint6TestContext(suffix);

  // 3. Student Progress Dashboard Tests
  test_studentProgressDashboard(ctx);
  console.log("Student dashboard validation successful.");

  // 4. Class Monitoring Dashboard Tests
  test_classMonitoringDashboard(ctx);
  console.log("Class dashboard validation successful.");

  // 5. Teacher Monitoring Dashboard Tests
  test_teacherMonitoringDashboard(ctx, suffix);
  console.log("Teacher dashboard validation successful.");

  // 6. School Dashboard Tests
  test_schoolDashboard(ctx);
  console.log("School dashboard validation successful.");

  // 7. Watchlist Tests
  test_watchlist(ctx);
  console.log("Watchlist validation successful.");

  // 8. Authorization Tests
  test_reportingAuthorization(ctx, suffix);
  console.log("Authorization validation successful.");

  console.log(" SPRINT 6 QA TEST SUITE PASSED ");
}

/**
 * Sets up test context for Sprint 6.
 */
function setupSprint6TestContext(suffix) {
  var admin = getUserByIdentifier('admin');
  
  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;
  
  if (!activeYearId || !activeSemId) {
    var yearRes = JSON.parse(route({
      action: 'create_academic_year',
      payload: {
        actor_user_id: admin.id,
        name: "AY_S6_" + suffix,
        start_date: "2026-07-01",
        end_date: "2027-06-30"
      }
    }).getContent());
    activeYearId = yearRes.data.id;
    route({ action: 'set_active_academic_year', payload: { actor_user_id: admin.id, id: activeYearId } });
    
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

  // Teacher 1 (Wali Kelas)
  var teacher1 = createRecord(SHEETS.USERS, {
    name: 'Guru S6 Wali ' + suffix,
    email: 'guru_s6_wali_' + suffix + '@example.com',
    username: 'guru_s6_wali_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });

  // Teacher 2 (Non-Wali Kelas)
  var teacher2 = createRecord(SHEETS.USERS, {
    name: 'Guru S6 NonWali ' + suffix,
    email: 'guru_s6_nonwali_' + suffix + '@example.com',
    username: 'guru_s6_nonwali_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });

  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: admin.id,
      code: 'CLS_S6_' + suffix,
      name: 'Kelas S6 ' + suffix,
      level: '6'
    }
  }).getContent());
  assertSuccessResponse(classRes, "Create Class");
  var classId = classRes.data.id;

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

  var subjRes = JSON.parse(route({
    action: 'create_subject',
    payload: {
      actor_user_id: admin.id,
      code: 'SBJ_S6_' + suffix,
      name: 'Subject S6 ' + suffix
    }
  }).getContent());
  assertSuccessResponse(subjRes, "Create Subject");
  var subjectId = subjRes.data.id;

  route({
    action: 'assign_subject_to_class',
    payload: {
      actor_user_id: admin.id,
      class_id: classId,
      subject_id: subjectId,
      academic_year_id: activeYearId,
      semester_id: activeSemId
    }
  });

  // Student A: academic_average < 2.0 (1.5)
  var sARes = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: generateTestNisn(),
      nik: '6111111111111111',
      full_name: 'Siswa S6 A ' + suffix,
      birth_date: '2015-01-01',
      gender: 'L',
      status: 'Aktif'
    }
  }).getContent());
  assertSuccessResponse(sARes, "Create Student A");
  var studentAId = sARes.data.id;

  var eARes = JSON.parse(route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: admin.id,
      student_id: studentAId,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      status: 'active'
    }
  }).getContent());
  assertSuccessResponse(eARes, "Enroll Student A");
  var enrollmentAId = eARes.data.id;

  // Student B: fitrah_average < 2.0 (1.92)
  var sBRes = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: generateTestNisn(),
      nik: '6222222222222222',
      full_name: 'Siswa S6 B ' + suffix,
      birth_date: '2015-02-02',
      gender: 'P',
      status: 'Aktif'
    }
  }).getContent());
  assertSuccessResponse(sBRes, "Create Student B");
  var studentBId = sBRes.data.id;

  var eBRes = JSON.parse(route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: admin.id,
      student_id: studentBId,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      status: 'active'
    }
  }).getContent());
  assertSuccessResponse(eBRes, "Enroll Student B");
  var enrollmentBId = eBRes.data.id;

  // Student C: NORMAL (acad=3.0, fitrah=3.08)
  var sCRes = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: generateTestNisn(),
      nik: '6333333333333333',
      full_name: 'Siswa S6 C ' + suffix,
      birth_date: '2015-03-03',
      gender: 'L',
      status: 'Aktif'
    }
  }).getContent());
  assertSuccessResponse(sCRes, "Create Student C");
  var studentCId = sCRes.data.id;

  var eCRes = JSON.parse(route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: admin.id,
      student_id: studentCId,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      status: 'active'
    }
  }).getContent());
  assertSuccessResponse(eCRes, "Enroll Student C");
  var enrollmentCId = eCRes.data.id;

  // Create & Publish Assessment 1
  var assessRes = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      class_id: classId,
      subject_id: subjectId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      title: 'Assessment S6 ' + suffix,
      assessment_date: '2026-06-15',
      score_min: 0,
      score_max: 4
    }
  }).getContent());
  assertSuccessResponse(assessRes, "Create Academic Assessment");
  var assessmentId = assessRes.data.id;

  route({
    action: 'publish_academic_assessment',
    payload: {
      actor_user_id: admin.id,
      id: assessmentId
    }
  });

  // Save Academic Scores
  route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: teacher1.id,
      assessment_id: assessmentId,
      scores: [
        { student_id: studentAId, student_enrollment_id: enrollmentAId, score: 1.5, note: 'Need Improvement' },
        { student_id: studentBId, student_enrollment_id: enrollmentBId, score: 3.5, note: 'Good' },
        { student_id: studentCId, student_enrollment_id: enrollmentCId, score: 3.0, note: 'Average' }
      ]
    }
  });

  // Save Culture Scores (Mon 2026-06-15)
  // Student A: sss=3, am=3, hb=3, asm=3, br=3, ak=3, tm=3 (fitrah = 3.0)
  route({
    action: 'save_culture_scores',
    payload: {
      actor_user_id: teacher1.id,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      score_date: '2026-06-15',
      scores: [
        { student_id: studentAId, student_enrollment_id: enrollmentAId, sss: 3, am: 3, hb: 3, asm: 3, br: 3, ak: 3, tm: 3 }
      ]
    }
  });

  // Student B: sss=1, am=2, hb=2, asm=2, br=2, ak=2, tm=2 (fitrah R = 1.5, others = 2.0. average = 1.92)
  route({
    action: 'save_culture_scores',
    payload: {
      actor_user_id: teacher1.id,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      score_date: '2026-06-15',
      scores: [
        { student_id: studentBId, student_enrollment_id: enrollmentBId, sss: 1, am: 2, hb: 2, asm: 2, br: 2, ak: 2, tm: 2 }
      ]
    }
  });

  // Student C: sss=3, am=3, hb=4, asm=3, br=3, ak=3, tm=3 (fitrah R = 3.5, others = 3.0. average = 3.08)
  route({
    action: 'save_culture_scores',
    payload: {
      actor_user_id: teacher1.id,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      score_date: '2026-06-15',
      scores: [
        { student_id: studentCId, student_enrollment_id: enrollmentCId, sss: 3, am: 3, hb: 4, asm: 3, br: 3, ak: 3, tm: 3 }
      ]
    }
  });

  return {
    admin: admin,
    teacher1: teacher1,
    teacher2: teacher2,
    classId: classId,
    subjectId: subjectId,
    yearId: activeYearId,
    semesterId: activeSemId,
    studentAId: studentAId,
    studentBId: studentBId,
    studentCId: studentCId,
    assessmentId: assessmentId
  };
}

/**
 * 3. Student Progress Dashboard Tests
 */
function test_studentProgressDashboard(ctx) {
  // Student A
  var resA = JSON.parse(route({
    action: 'get_student_progress_dashboard',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentAId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  
  if (resA.status !== 'success') {
    throw new Error("Failed to get progress dashboard for Student A: " + resA.message);
  }
  
  var dataA = resA.data;
  if (Number(dataA.summary.academic_average) !== 1.5) {
    throw new Error("Student A academic average incorrect. Got: " + dataA.summary.academic_average);
  }
  if (dataA.summary.risk_status !== 'AT_RISK') {
    throw new Error("Student A should be AT_RISK. Got: " + dataA.summary.risk_status);
  }

  // Student B
  var resB = JSON.parse(route({
    action: 'get_student_progress_dashboard',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentBId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  var dataB = resB.data;
  if (Number(dataB.summary.academic_average) !== 3.5) {
    throw new Error("Student B academic average incorrect. Got: " + dataB.summary.academic_average);
  }
  if (Number(dataB.summary.fitrah_average) !== 1.92) {
    throw new Error("Student B fitrah average incorrect. Got: " + dataB.summary.fitrah_average);
  }
  if (dataB.summary.risk_status !== 'AT_RISK') {
    throw new Error("Student B should be AT_RISK due to fitrah average. Got: " + dataB.summary.risk_status);
  }

  // Student C
  var resC = JSON.parse(route({
    action: 'get_student_progress_dashboard',
    payload: {
      actor_user_id: ctx.admin.id,
      student_id: ctx.studentCId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  var dataC = resC.data;
  if (dataC.summary.risk_status !== 'NORMAL') {
    throw new Error("Student C should be NORMAL. Got: " + dataC.summary.risk_status);
  }
}

/**
 * 4. Class Monitoring Dashboard Tests
 */
function test_classMonitoringDashboard(ctx) {
  var res = JSON.parse(route({
    action: 'get_class_monitoring_dashboard',
    payload: {
      actor_user_id: ctx.admin.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to get class monitoring dashboard: " + res.message);
  }
  
  var data = res.data;
  if (data.student_count !== 3) {
    throw new Error("Class student_count incorrect. Expected 3, got: " + data.student_count);
  }
  if (data.academic_completeness.completion_rate !== 100) {
    throw new Error("Academic completeness should be 100%. Got: " + data.academic_completeness.completion_rate);
  }
  if (data.culture_completeness.completion_rate !== 100) {
    throw new Error("Culture completeness should be 100%. Got: " + data.culture_completeness.completion_rate);
  }
}

/**
 * 5. Teacher Monitoring Dashboard Tests
 */
function test_teacherMonitoringDashboard(ctx, suffix) {
  var res = JSON.parse(route({
    action: 'get_teacher_monitoring_dashboard',
    payload: {
      actor_user_id: ctx.teacher1.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to get teacher dashboard: " + res.message);
  }
  
  var data = res.data;
  if (data.classes.length !== 1) {
    throw new Error("Teacher assigned classes incorrect. Expected 1, got: " + data.classes.length);
  }
  if (data.active_assessments !== 1) {
    throw new Error("Teacher active assessments incorrect. Expected 1, got: " + data.active_assessments);
  }
  if (data.pending_assessments !== 0) {
    throw new Error("Teacher pending assessments incorrect. Expected 0, got: " + data.pending_assessments);
  }

  // Create a second published assessment but don't save scores for anyone to make it pending
  var assessRes2 = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      actor_user_id: ctx.admin.id,
      class_id: ctx.classId,
      subject_id: ctx.subjectId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      title: 'Assessment S6 Pending ' + suffix,
      assessment_date: '2026-06-16',
      score_min: 0,
      score_max: 100
    }
  }).getContent());
  var assessmentId2 = assessRes2.data.id;

  route({
    action: 'publish_academic_assessment',
    payload: { actor_user_id: ctx.admin.id, id: assessmentId2 }
  });

  var res2 = JSON.parse(route({
    action: 'get_teacher_monitoring_dashboard',
    payload: {
      actor_user_id: ctx.teacher1.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  
  if (res2.data.pending_assessments !== 1) {
    throw new Error("Teacher pending assessments incorrect after adding ungraded assessment. Expected 1, got: " + res2.data.pending_assessments);
  }
}

/**
 * 6. School Dashboard Tests
 */
function test_schoolDashboard(ctx) {
  var res = JSON.parse(route({
    action: 'get_school_dashboard',
    payload: {
      actor_user_id: ctx.admin.id
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to get school dashboard: " + res.message);
  }
  
  var data = res.data;
  if (data.active_students < 3) {
    throw new Error("School dashboard active_students count incorrect. Got: " + data.active_students);
  }
}

/**
 * 7. Watchlist Tests
 */
function test_watchlist(ctx) {
  var res = JSON.parse(route({
    action: 'get_student_watchlist',
    payload: {
      actor_user_id: ctx.admin.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  
  if (res.status !== 'success') {
    throw new Error("Failed to get watchlist: " + res.message);
  }
  
  var data = res.data;
  var hasA = data.some(function(s) { return s.student_id === ctx.studentAId; });
  var hasB = data.some(function(s) { return s.student_id === ctx.studentBId; });
  var hasC = data.some(function(s) { return s.student_id === ctx.studentCId; });

  if (!hasA) {
    throw new Error("Student A should be in the watchlist (academic average 1.5).");
  }
  if (!hasB) {
    throw new Error("Student B should be in the watchlist (fitrah average 1.92).");
  }
  if (hasC) {
    throw new Error("Student C should not be in the watchlist (academic 3.0, fitrah 3.08).");
  }
}

/**
 * 8. Authorization Tests
 */
function test_reportingAuthorization(ctx, suffix) {
  // Create another class & assign Guru 2 (NonWali of Class 1)
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: ctx.admin.id,
      code: 'CLS_S6_ALT_' + suffix,
      name: 'Kelas S6 Alt ' + suffix,
      level: '6'
    }
  }).getContent());
  var altClassId = classRes.data.id;

  route({
    action: 'assign_class_teacher',
    payload: {
      actor_user_id: ctx.admin.id,
      class_id: altClassId,
      teacher_user_id: ctx.teacher2.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      effective_from: '2026-07-01'
    }
  });

  // Guru 2 tries to view dashboard for Student A (enrolled in Class 1) -> Forbidden
  var resA = JSON.parse(route({
    action: 'get_student_progress_dashboard',
    payload: {
      actor_user_id: ctx.teacher2.id,
      student_id: ctx.studentAId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (resA.status !== 'error' || resA.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Teacher 2 was allowed to view student in Class 1.");
  }

  // Guru 2 tries to view watchlist -> should only return students in Class Alt (which is empty)
  var resW = JSON.parse(route({
    action: 'get_student_watchlist',
    payload: {
      actor_user_id: ctx.teacher2.id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (resW.status !== 'success') {
    throw new Error("Failed to query watchlist for Teacher 2.");
  }
  if (resW.data.length !== 0) {
    throw new Error("Watchlist for Teacher 2 should be empty. Got: " + resW.data.length);
  }
}

/**
 * Asserts that a response is successful.
 */
function assertSuccessResponse(response, label) {
  if (!response || response.status !== "success") {
    throw new Error(label + " failed: " + JSON.stringify(response));
  }
}

/**
 * Generates a unique 10-digit NISN.
 */
function generateTestNisn() {
  var num = Math.floor(1000000000 + Math.random() * 9000000000);
  return String(num);
}
