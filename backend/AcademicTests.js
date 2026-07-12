/**
 * AcademicTests.gs
 * QA verification and regression testing suite for Sprint 4.
 */

function test_runSprint4QA() {
  console.log("=== STARTING SPRINT 4 QA TEST SUITE ===");

  // 1. Regression Checks
  test_regressionSprint1();
  test_regressionSprint2();
  test_regressionSprint3_custom();

  // 2. Sprint 4 Tests Setup
  var suffix = String(Math.floor(Math.random() * 100000));
  var ctx = setupSprint4TestContext(suffix);

  // 3. Assessment Creation Tests
  test_assessmentCreate(ctx, suffix);

  // 4. Assessment Update Tests
  test_assessmentUpdate(ctx);

  // 5. Publish & Lock Tests
  test_publishLock(ctx);

  // 6. Save Scores Tests
  test_saveScores(ctx);

  // 7. Update Single Score Tests
  test_updateSingleScore(ctx);

  // 8. Academic Summary Reports
  test_academicSummaries(ctx);

  console.log("=== SPRINT 4 QA TEST SUITE PASSED ===");
}

/**
 * Custom regression runner for Sprint 3 to avoid database resetting.
 */
function test_regressionSprint3_custom() {
  console.log("Running custom Sprint 3 regression checks...");
  var suffix = String(Math.floor(Math.random() * 100000));
  var context = setupSprint3TestContext(suffix);
  
  test_studentCreate(context, suffix);
  test_studentUpdate(context, suffix);
  test_studentStatus(context);
  test_parentPin(context);
  test_fieldFiltering(context);
  
  test_enrollmentCreate(context);
  test_enrollmentUpdateAndStatus(context);
  test_listStudentsByClass(context);
  console.log("Sprint 3 regression checks complete.");
}

/**
 * Setup context for Sprint 4 testing.
 */
function setupSprint4TestContext(suffix) {
  var admin = getUserByIdentifier('admin');
  
  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;
  
  if (!activeYearId || !activeSemId) {
    var yearRes = JSON.parse(route({
      action: 'create_academic_year',
      payload: {
        actor_user_id: admin.id,
        name: "AY_S4_" + suffix,
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
  
  var teacher1 = createRecord(SHEETS.USERS, {
    name: 'Guru S4 Wali ' + suffix,
    email: 'guru_s4_wali_' + suffix + '@example.com',
    username: 'guru_s4_wali_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });
  
  var teacher2 = createRecord(SHEETS.USERS, {
    name: 'Guru S4 NonWali ' + suffix,
    email: 'guru_s4_nonwali_' + suffix + '@example.com',
    username: 'guru_s4_nonwali_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  });
  
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: admin.id,
      code: 'CLS_S4_' + suffix,
      name: 'Kelas S4 ' + suffix,
      level: '4'
    }
  }).getContent());
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
      code: 'SBJ_S4_' + suffix,
      name: 'Subject S4 ' + suffix
    }
  }).getContent());
  var subjectId = subjRes.data.id;
  
  var subjRes2 = JSON.parse(route({
    action: 'create_subject',
    payload: {
      actor_user_id: admin.id,
      code: 'SBJ_S4_UNMAPPED_' + suffix,
      name: 'Subject Unmapped S4 ' + suffix
    }
  }).getContent());
  var unmappedSubjectId = subjRes2.data.id;
  
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
  
  var s1Res = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: '77771' + suffix.substring(0, 3),
      nik: '1111111111111111',
      full_name: 'Siswa S4 A ' + suffix,
      birth_place: 'Jakarta',
      birth_date: '2016-01-01',
      gender: 'L',
      status: 'Aktif'
    }
  }).getContent());
  var student1Id = s1Res.data.id;
  
  var e1Res = JSON.parse(route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: admin.id,
      student_id: student1Id,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      status: 'active'
    }
  }).getContent());
  var enrollment1Id = e1Res.data.id;
  
  var s2Res = JSON.parse(route({
    action: 'create_student',
    payload: {
      actor_user_id: admin.id,
      nisn: '77772' + suffix.substring(0, 3),
      nik: '2222222222222222',
      full_name: 'Siswa S4 B ' + suffix,
      birth_place: 'Jakarta',
      birth_date: '2016-02-02',
      gender: 'P',
      status: 'Aktif'
    }
  }).getContent());
  var student2Id = s2Res.data.id;
  
  var e2Res = JSON.parse(route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: admin.id,
      student_id: student2Id,
      class_id: classId,
      academic_year_id: activeYearId,
      semester_id: activeSemId,
      status: 'active'
    }
  }).getContent());
  var enrollment2Id = e2Res.data.id;
  
  return {
    adminId: admin.id,
    teacher1: teacher1,
    teacher2: teacher2,
    classId: classId,
    subjectId: subjectId,
    unmappedSubjectId: unmappedSubjectId,
    yearId: activeYearId,
    semesterId: activeSemId,
    student1Id: student1Id,
    enrollment1Id: enrollment1Id,
    student2Id: student2Id,
    enrollment2Id: enrollment2Id
  };
}

/**
 * 3. Assessment Creation Tests
 */
function test_assessmentCreate(ctx, suffix) {
  console.log("Testing Assessment Creation & Validation rules...");
  
  var payload = {
    class_id: ctx.classId,
    subject_id: ctx.subjectId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    title: 'Evaluasi Harian 1 ' + suffix,
    description: 'Bab 1',
    assessment_date: '2026-08-01',
    score_min: 0,
    score_max: 100
  };

  // Admin create assessment: Success
  var pAdmin = JSON.parse(JSON.stringify(payload));
  pAdmin.actor_user_id = ctx.adminId;
  var resAdmin = JSON.parse(route({ action: 'create_academic_assessment', payload: pAdmin }).getContent());
  if (resAdmin.status !== 'success') {
    throw new Error("Admin failed to create assessment: " + resAdmin.message);
  }
  ctx.assessmentId = resAdmin.data.id;

  // Guru wali kelas create assessment: Success
  var pWali = JSON.parse(JSON.stringify(payload));
  pWali.actor_user_id = ctx.teacher1.id;
  pWali.title = 'Evaluasi Harian 2 ' + suffix;
  var resWali = JSON.parse(route({ action: 'create_academic_assessment', payload: pWali }).getContent());
  if (resWali.status !== 'success') {
    throw new Error("Wali Kelas failed to create assessment: " + resWali.message);
  }
  ctx.assessment2Id = resWali.data.id;

  // Guru non-wali kelas: Rejected
  var pNonWali = JSON.parse(JSON.stringify(payload));
  pNonWali.actor_user_id = ctx.teacher2.id;
  pNonWali.title = 'Evaluasi Harian 3 ' + suffix;
  var resNonWali = JSON.parse(route({ action: 'create_academic_assessment', payload: pNonWali }).getContent());
  if (resNonWali.status !== 'error' || resNonWali.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali teacher was allowed to create assessment.");
  }

  // Subject not registered in class_subjects: Rejected
  var pBadSubj = JSON.parse(JSON.stringify(payload));
  pBadSubj.actor_user_id = ctx.adminId;
  pBadSubj.subject_id = ctx.unmappedSubjectId;
  var resBadSubj = JSON.parse(route({ action: 'create_academic_assessment', payload: pBadSubj }).getContent());
  if (resBadSubj.status !== 'error') {
    throw new Error("Failed: Unmapped class subject was allowed.");
  }

  // score_min > score_max: Rejected
  var pBadRange = JSON.parse(JSON.stringify(payload));
  pBadRange.actor_user_id = ctx.adminId;
  pBadRange.score_min = 100;
  pBadRange.score_max = 50;
  var resBadRange = JSON.parse(route({ action: 'create_academic_assessment', payload: pBadRange }).getContent());
  if (resBadRange.status !== 'error') {
    throw new Error("Failed: score_min > score_max was allowed.");
  }

  // Invalid date: Rejected
  var pBadDate = JSON.parse(JSON.stringify(payload));
  pBadDate.actor_user_id = ctx.adminId;
  pBadDate.assessment_date = 'invalid-date-format';
  var resBadDate = JSON.parse(route({ action: 'create_academic_assessment', payload: pBadDate }).getContent());
  if (resBadDate.status !== 'error') {
    throw new Error("Failed: Invalid assessment date was allowed.");
  }

  // Check draft status by default
  if (resAdmin.data.status !== STATUS.DRAFT) {
    throw new Error("Default status of assessment is not 'draft'. Got: " + resAdmin.data.status);
  }

  console.log("Assessment creation validated successfully.");
}

/**
 * 4. Assessment Update Tests
 */
function test_assessmentUpdate(ctx) {
  console.log("Testing Assessment Update & Audit...");
  
  var payload = {
    actor_user_id: ctx.adminId,
    id: ctx.assessmentId,
    title: 'Evaluasi Harian 1 Updated'
  };

  var resUpdate = JSON.parse(route({ action: 'update_academic_assessment', payload: payload }).getContent());
  if (resUpdate.status !== 'success') {
    throw new Error("Failed to update assessment: " + resUpdate.message);
  }
  if (resUpdate.data.title !== 'Evaluasi Harian 1 Updated') {
    throw new Error("Updated title does not match.");
  }

  // Update invalid score range: Rejected
  var badPayload = {
    actor_user_id: ctx.adminId,
    id: ctx.assessmentId,
    score_min: 80,
    score_max: 70
  };
  var resBadRange = JSON.parse(route({ action: 'update_academic_assessment', payload: badPayload }).getContent());
  if (resBadRange.status !== 'error') {
    throw new Error("Failed: Invalid score range update was allowed.");
  }

  // Verify audit log exists
  assertAuditLogExists(ctx.adminId, 'update_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, ctx.assessmentId);
  console.log("Assessment updates and audit logs validated.");
}

/**
 * 5. Publish & Lock Tests
 */
function test_publishLock(ctx) {
  console.log("Testing Assessment Publish and Lock...");

  // Publish
  var resPub = JSON.parse(route({
    action: 'publish_academic_assessment',
    payload: { actor_user_id: ctx.adminId, id: ctx.assessmentId }
  }).getContent());
  if (resPub.status !== 'success' || resPub.data.status !== STATUS.PUBLISHED) {
    throw new Error("Publishing assessment failed.");
  }
  assertAuditLogExists(ctx.adminId, 'publish_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, ctx.assessmentId);

  // Lock
  var resLock = JSON.parse(route({
    action: 'lock_academic_assessment',
    payload: { actor_user_id: ctx.adminId, id: ctx.assessmentId }
  }).getContent());
  if (resLock.status !== 'success' || resLock.data.status !== STATUS.LOCKED) {
    throw new Error("Locking assessment failed.");
  }
  assertAuditLogExists(ctx.adminId, 'lock_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, ctx.assessmentId);

  // Guru cannot input/save scores to locked assessment: Rejected
  var resSaveScore = JSON.parse(route({
    action: 'save_academic_scores',
    payload: {
      actor_user_id: ctx.teacher1.id,
      assessment_id: ctx.assessmentId,
      scores: [
        { student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, score: 90, note: 'Bagus' }
      ]
    }
  }).getContent());
  if (resSaveScore.status !== 'error') {
    throw new Error("Failed: Guru was allowed to input scores to locked assessment.");
  }

  // Publish Assessment 2 for subsequent score testing
  route({
    action: 'publish_academic_assessment',
    payload: { actor_user_id: ctx.adminId, id: ctx.assessment2Id }
  });
  console.log("Publishing and locking validated successfully.");
}

/**
 * 6. Save Scores Tests
 */
function test_saveScores(ctx) {
  console.log("Testing Save Scores validation and upsert...");

  // Save scores: Success
  var payload = {
    actor_user_id: ctx.teacher1.id,
    assessment_id: ctx.assessment2Id,
    scores: [
      { student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, score: 85, note: 'Bagus' },
      { student_id: ctx.student2Id, student_enrollment_id: ctx.enrollment2Id, score: '', note: '' } // score kosong
    ]
  };

  var resSave = JSON.parse(route({ action: 'save_academic_scores', payload: payload }).getContent());
  if (resSave.status !== 'success') {
    throw new Error("Wali Kelas failed to save scores: " + resSave.message);
  }

  // Verify score records
  var scores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.assessment_id === ctx.assessment2Id && s.status === STATUS.ACTIVE;
  });
  if (scores.length !== 2) {
    throw new Error("Expected 2 active scores, got: " + scores.length);
  }

  var s1 = scores.filter(function(s) { return s.student_id === ctx.student1Id; })[0];
  var s2 = scores.filter(function(s) { return s.student_id === ctx.student2Id; })[0];

  if (Number(s1.score) !== 85) {
    throw new Error("Score student 1 mismatch. Got: " + s1.score);
  }
  if (s2.score !== null && s2.score !== '') {
    throw new Error("Score student 2 should be null/empty. Got: " + s2.score);
  }

  // Score out of range (score_max is 100): Rejected
  var badPayload = JSON.parse(JSON.stringify(payload));
  badPayload.scores[0].score = 150;
  var resBad = JSON.parse(route({ action: 'save_academic_scores', payload: badPayload }).getContent());
  if (resBad.status !== 'error') {
    throw new Error("Failed: Score out of range was allowed.");
  }

  // Save again to check row update instead of duplicate
  var updatePayload = {
    actor_user_id: ctx.teacher1.id,
    assessment_id: ctx.assessment2Id,
    scores: [
      { student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, score: 95, note: 'Sangat Bagus' }
    ]
  };

  var resResave = JSON.parse(route({ action: 'save_academic_scores', payload: updatePayload }).getContent());
  if (resResave.status !== 'success') {
    throw new Error("Failed to re-save scores.");
  }

  var scoresAfterUpdate = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.assessment_id === ctx.assessment2Id && s.status === STATUS.ACTIVE;
  });
  if (scoresAfterUpdate.length !== 2) {
    throw new Error("Resave created duplicate score rows!");
  }

  var updatedS1 = scoresAfterUpdate.filter(function(s) { return s.student_id === ctx.student1Id; })[0];
  if (Number(updatedS1.score) !== 95 || updatedS1.note !== 'Sangat Bagus') {
    throw new Error("Upsert update failed.");
  }

  ctx.score1Id = updatedS1.id;
  assertAuditLogExists(ctx.teacher1.id, 'update_academic_score', SHEETS.ACADEMIC_SCORES, updatedS1.id);
  console.log("Score saves and updates validated successfully.");
}

/**
 * 7. Update Single Score Tests
 */
function test_updateSingleScore(ctx) {
  console.log("Testing Single Score Update...");

  var payload = {
    actor_user_id: ctx.teacher1.id,
    id: ctx.score1Id,
    score: 98,
    note: 'Luar Biasa'
  };

  var resUpdate = JSON.parse(route({ action: 'update_academic_score', payload: payload }).getContent());
  if (resUpdate.status !== 'success') {
    throw new Error("Failed to update single score: " + resUpdate.message);
  }

  var score = getRecordById(SHEETS.ACADEMIC_SCORES, ctx.score1Id);
  if (Number(score.score) !== 98 || score.note !== 'Luar Biasa') {
    throw new Error("Single score update values mismatch.");
  }

  // Update out of range: Rejected
  var badPayload = JSON.parse(JSON.stringify(payload));
  badPayload.score = 200;
  var resBadRange = JSON.parse(route({ action: 'update_academic_score', payload: badPayload }).getContent());
  if (resBadRange.status !== 'error') {
    throw new Error("Failed: Out of range single score update allowed.");
  }

  // Non-wali update: Rejected
  var nonWaliPayload = JSON.parse(JSON.stringify(payload));
  nonWaliPayload.actor_user_id = ctx.teacher2.id;
  var resNonWali = JSON.parse(route({ action: 'update_academic_score', payload: nonWaliPayload }).getContent());
  if (resNonWali.status !== 'error' || resNonWali.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali teacher allowed to update score.");
  }

  assertAuditLogExists(ctx.teacher1.id, 'update_academic_score', SHEETS.ACADEMIC_SCORES, ctx.score1Id);
  console.log("Single score updates validated.");
}

/**
 * 8. Academic Summary Reports
 */
function test_academicSummaries(ctx) {
  console.log("Testing academic summaries...");

  // Student academic summary
  var sSummaryRes = JSON.parse(route({
    action: 'get_student_academic_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.student1Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());

  if (sSummaryRes.status !== 'success') {
    throw new Error("Failed to retrieve student academic summary: " + sSummaryRes.message);
  }

  var studentData = sSummaryRes.data;
  // Student 1 has score 98. Assessment 1 (Draft/Locked) has no score (so not counted).
  // Thus total average must be 98.
  if (Number(studentData.total_average) !== 98) {
    throw new Error("Student average calculation incorrect. Expected 98, got: " + studentData.total_average);
  }

  // Student 2 has score '' (empty). Rata-rata per subject & total should be null/empty, not 0.
  var s2SummaryRes = JSON.parse(route({
    action: 'get_student_academic_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.student2Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (s2SummaryRes.data.total_average !== null) {
    throw new Error("Empty score counted as non-null total average.");
  }

  // Guru non-wali cannot view student summary: Rejected
  var nonWaliStudentSummary = JSON.parse(route({
    action: 'get_student_academic_summary',
    payload: {
      actor_user_id: ctx.teacher2.id,
      student_id: ctx.student1Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (nonWaliStudentSummary.status !== 'error' || nonWaliStudentSummary.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali was allowed to view student academic summary.");
  }

  // Class academic summary
  var cSummaryRes = JSON.parse(route({
    action: 'get_class_academic_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());

  if (cSummaryRes.status !== 'success') {
    throw new Error("Failed to retrieve class academic summary: " + cSummaryRes.message);
  }

  var classData = cSummaryRes.data;
  // Check student averages
  var summS1 = classData.student_summaries.filter(function(s) { return s.student_id === ctx.student1Id; })[0];
  var summS2 = classData.student_summaries.filter(function(s) { return s.student_id === ctx.student2Id; })[0];
  if (Number(summS1.average_score) !== 98) {
    throw new Error("Class summary: Student 1 average score incorrect.");
  }
  if (summS2.average_score !== null) {
    throw new Error("Class summary: Student 2 average score should be null.");
  }

  // Check ungraded count per assessment
  // Assessment 2 (published): s1 is graded (98), s2 is ungraded (''). Roster size is 2. Ungraded students count should be 1.
  var assessment2Summ = classData.assessment_summaries.filter(function(a) { return a.assessment_id === ctx.assessment2Id; })[0];
  if (assessment2Summ.ungraded_students !== 1) {
    throw new Error("Ungraded students count incorrect. Expected 1, got: " + assessment2Summ.ungraded_students);
  }

  // Guru non-wali cannot view class summary: Rejected
  var nonWaliClassSummary = JSON.parse(route({
    action: 'get_class_academic_summary',
    payload: {
      actor_user_id: ctx.teacher2.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId
    }
  }).getContent());
  if (nonWaliClassSummary.status !== 'error' || nonWaliClassSummary.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali was allowed to view class academic summary.");
  }

  console.log("Academic summary reports validated successfully.");
}
