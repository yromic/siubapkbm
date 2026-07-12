/**
 * CultureTests.gs
 * Verification and regression testing suite for Sprint 5 daily culture scores and character summaries.
 */

function test_runSprint5QA() {
  console.log("=== STARTING SPRINT 5 QA TEST SUITE ===");
  
  // 1. Run Regression Tests from Sprints 1-4
  console.log("Running regression tests for Sprint 1-4...");
  test_runSprint4QA();
  console.log("Regression tests complete.");
  
  // 2. Setup Context for Sprint 5 Tests
  var suffix = String(Math.floor(Math.random() * 100000));
  var ctx = setupSprint4TestContext(suffix);
  
  // 3. Culture Score Validation & Save Tests
  test_cultureScoreValidationAndSave(ctx, suffix);
  console.log("Culture score validation successful.");
  
  // 4. Lock Period Tests
  test_lockPeriodConstraints(ctx);
  console.log("Lock period validation successful.");
  
  // 5. FITRAH & Days Counted Calculation Tests
  test_fitrahAndDaysCounted(ctx);
  console.log("FITRAH calculation validation successful.");
  
  // 6. Character Summary & Delta Update Tests
  test_summaryAndDeltaUpdates(ctx);
  console.log("Character summary validation successful.");
  
  console.log("=== SPRINT 5 QA TEST SUITE PASSED ===");
}

/**
 * Test Culture Score Validation, saving, resaving, and authorization rules.
 */
function test_cultureScoreValidationAndSave(ctx, suffix) {
  var scoreDate = "2026-06-17";
  
  // Guru Wali Kelas saves culture score: Success
  var payloadSuccess = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: scoreDate,
    scores: [
      {
        student_id: ctx.student1Id,
        student_enrollment_id: ctx.enrollment1Id,
        sss: 4,
        am: 3,
        hb: null,
        asm: 2,
        br: 4,
        ak: null,
        tm: 3
      }
    ]
  };
  
  var resSuccess = JSON.parse(route({ action: 'save_culture_scores', payload: payloadSuccess }).getContent());
  console.log("Save 1 response: " + JSON.stringify(resSuccess));
  if (resSuccess.status !== 'success') {
    throw new Error("Wali Kelas failed to save culture score: " + resSuccess.message);
  }
  
  // Assert 1 record active
  var records1 = listRecords(SHEETS.CULTURE_SCORES, function(r) {
    return r.student_id === ctx.student1Id &&
           normalizeDateString(r.score_date) === normalizeDateString(scoreDate) &&
           r.class_id === ctx.classId &&
           r.academic_year_id === ctx.yearId &&
           r.semester_id === ctx.semesterId &&
           r.status === 'active';
  });
  
  if (records1.length !== 1) {
    console.log("Expected key: " + JSON.stringify({
      student_id: ctx.student1Id,
      score_date: normalizeDateString(scoreDate),
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      status: 'active'
    }));
    var candidateRows = listRecords(SHEETS.CULTURE_SCORES, function(r) { return r.student_id === ctx.student1Id; });
    console.log("Culture rows for student: " + JSON.stringify(candidateRows));
    throw new Error("Failed: Save 1 did not result in exactly 1 active record. Got: " + records1.length);
  }
  
  if (records1[0].score_date !== scoreDate) {
    throw new Error("Failed: score_date format changed after save 1. Expected: " + scoreDate + ", got: " + records1[0].score_date);
  }
  
  var firstRecordId = records1[0].id;
  
  // Guru Non-Wali Kelas saves culture score: Forbidden (Rejected)
  var payloadForbidden = JSON.parse(JSON.stringify(payloadSuccess));
  payloadForbidden.actor_user_id = ctx.teacher2.id;
  var resForbidden = JSON.parse(route({ action: 'save_culture_scores', payload: payloadForbidden }).getContent());
  if (resForbidden.status !== 'error' || resForbidden.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-Wali teacher was allowed to save culture scores.");
  }
  
  // Invalid Score Value (5): Rejected
  var payloadInvalidVal = JSON.parse(JSON.stringify(payloadSuccess));
  payloadInvalidVal.scores[0].sss = 5;
  var resInvalidVal = JSON.parse(route({ action: 'save_culture_scores', payload: payloadInvalidVal }).getContent());
  if (resInvalidVal.status !== 'error') {
    throw new Error("Failed: Invalid score value 5 was accepted.");
  }
  
  // Invalid Score Value (0): Rejected
  var payloadInvalidVal2 = JSON.parse(JSON.stringify(payloadSuccess));
  payloadInvalidVal2.scores[0].sss = 0;
  var resInvalidVal2 = JSON.parse(route({ action: 'save_culture_scores', payload: payloadInvalidVal2 }).getContent());
  if (resInvalidVal2.status !== 'error') {
    throw new Error("Failed: Invalid score value 0 was accepted.");
  }
  
  // Resaving: Updates existing active record without creating duplicates
  var payloadUpdate = JSON.parse(JSON.stringify(payloadSuccess));
  payloadUpdate.scores[0].sss = 2; // change sss from 4 to 2
  
  var resUpdate = JSON.parse(route({ action: 'save_culture_scores', payload: payloadUpdate }).getContent());
  console.log("Save 2 response: " + JSON.stringify(resUpdate));
  if (resUpdate.status !== 'success') {
    throw new Error("Resave failed: " + resUpdate.message);
  }
  
  // Assert still 1 record active
  var records2 = listRecords(SHEETS.CULTURE_SCORES, function(r) {
    return r.student_id === ctx.student1Id &&
           normalizeDateString(r.score_date) === normalizeDateString(scoreDate) &&
           r.class_id === ctx.classId &&
           r.academic_year_id === ctx.yearId &&
           r.semester_id === ctx.semesterId &&
           r.status === 'active';
  });
  
  if (records2.length !== 1) {
    console.log("Expected key: " + JSON.stringify({
      student_id: ctx.student1Id,
      score_date: normalizeDateString(scoreDate),
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      status: 'active'
    }));
    var candidateRows = listRecords(SHEETS.CULTURE_SCORES, function(r) { return r.student_id === ctx.student1Id; });
    console.log("Culture rows for student: " + JSON.stringify(candidateRows));
    throw new Error("Failed: Resaving created duplicate record or lost active record. Expected 1 record, got " + records2.length);
  }
  
  if (records2[0].id !== firstRecordId) {
    throw new Error("Failed: Resave did not update the existing row ID. Old ID: " + firstRecordId + ", New ID: " + records2[0].id);
  }
  
  if (records2[0].score_date !== scoreDate) {
    throw new Error("Failed: score_date format changed after resave. Expected: " + scoreDate + ", got: " + records2[0].score_date);
  }
  
  if (Number(records2[0].sss_score) !== 2) {
    throw new Error("Failed: Resaving did not update the score value. Expected 2, got " + records2[0].sss_score);
  }
}

/**
 * Test Lock Period rules.
 * Guru: 7 days window
 * Admin: 30 days window
 * Administrator: unlimited
 */
function test_lockPeriodConstraints(ctx) {
  var suffix = String(Math.floor(Math.random() * 100000));
  
  // Seed a user with Admin role for testing (since getUserByIdentifier('admin') is Administrator)
  var testAdmin = createRecord(SHEETS.USERS, {
    name: 'Admin Wali S5 ' + suffix,
    email: 'admin_wali_s5_' + suffix + '@example.com',
    username: 'admin_wali_s5_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.ADMIN,
    status: STATUS.ACTIVE
  });
  
  // Prepare dates
  var today = new Date();
  
  var date10DaysAgo = new Date();
  date10DaysAgo.setDate(today.getDate() - 10);
  var str10DaysAgo = formatDateString(date10DaysAgo);
  
  var date40DaysAgo = new Date();
  date40DaysAgo.setDate(today.getDate() - 40);
  var str40DaysAgo = formatDateString(date40DaysAgo);
  
  var date5DaysAgo = new Date();
  date5DaysAgo.setDate(today.getDate() - 5);
  var str5DaysAgo = formatDateString(date5DaysAgo);
  
  var date0DaysAgo = new Date();
  var str0DaysAgo = formatDateString(date0DaysAgo);
  
  // 1. Guru Wali: input date 10 days ago (should be rejected)
  var pGuru10 = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: str10DaysAgo,
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4 }]
  };
  var resGuru10 = JSON.parse(route({ action: 'save_culture_scores', payload: pGuru10 }).getContent());
  if (resGuru10.status !== 'error' || resGuru10.code !== 'ERR_PERIOD_LOCKED') {
    throw new Error("Failed: Guru was allowed to edit/input score 10 days ago. Response: " + JSON.stringify(resGuru10));
  }
  
  // 2. Admin: input date 40 days ago (should be rejected)
  var pAdmin40 = {
    actor_user_id: testAdmin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: str40DaysAgo,
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4 }]
  };
  var resAdmin40 = JSON.parse(route({ action: 'save_culture_scores', payload: pAdmin40 }).getContent());
  if (resAdmin40.status !== 'error' || resAdmin40.code !== 'ERR_PERIOD_LOCKED') {
    throw new Error("Failed: Admin was allowed to edit/input score 40 days ago. Response: " + JSON.stringify(resAdmin40));
  }
  
  // 3. Administrator: input date 40 days ago (should be allowed)
  var defaultAdmin = listRecords(SHEETS.USERS, function(u) { return u.role === ROLES.ADMINISTRATOR; })[0];
  var pSuper40 = {
    actor_user_id: defaultAdmin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: str40DaysAgo,
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4 }]
  };
  var resSuper40 = JSON.parse(route({ action: 'save_culture_scores', payload: pSuper40 }).getContent());
  if (resSuper40.status !== 'success') {
    throw new Error("Failed: Administrator was locked from editing 40 days ago: " + resSuper40.message);
  }
  
  // 4. Admin: input date 5 days ago (should be allowed)
  var pAdmin5 = {
    actor_user_id: testAdmin.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: str5DaysAgo,
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4 }]
  };
  var resAdmin5 = JSON.parse(route({ action: 'save_culture_scores', payload: pAdmin5 }).getContent());
  if (resAdmin5.status !== 'success') {
    throw new Error("Failed: Admin was locked from editing 5 days ago: " + resAdmin5.message);
  }
  
  // 5. Guru Wali: input date today (should be allowed)
  var pGuru0 = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: str0DaysAgo,
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4 }]
  };
  var resGuru0 = JSON.parse(route({ action: 'save_culture_scores', payload: pGuru0 }).getContent());
  if (resGuru0.status !== 'success') {
    throw new Error("Failed: Guru was locked from editing today: " + resGuru0.message);
  }
}

/**
 * Test FITRAH mapping and days_counted logic.
 */
function test_fitrahAndDaysCounted(ctx) {
  // Clear any existing scores for student 1 to isolate calculation tests
  var existing = findRows(SHEETS.CULTURE_SCORES, function(r) {
    return r.student_id === ctx.student1Id;
  });
  existing.forEach(function(r) {
    // Soft delete or status inactive
    updateRowById(SHEETS.CULTURE_SCORES, r.id, { status: 'inactive' });
  });
  
  // Clear summaries too
  var weeklySums = findRows(SHEETS.CHARACTER_WEEKLY_SUMMARIES, function(r) { return r.student_id === ctx.student1Id; });
  weeklySums.forEach(function(r) { updateRowById(SHEETS.CHARACTER_WEEKLY_SUMMARIES, r.id, { days_counted: 0, sss_sum: 0, sss_count: 0, hb_sum: 0, hb_count: 0 }); });
  
  // Let's test FITRAH score mapping:
  // Case A: SSS = 4, HB = kosong. R should be 4 (not 2).
  var p1 = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: '2026-06-15', // Mon
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4, hb: null }]
  };
  route({ action: 'save_culture_scores', payload: p1 });
  
  var summaryA = JSON.parse(route({
    action: 'get_student_character_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.student1Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      week_start_date: '2026-06-15'
    }
  }).getContent()).data;
  
  if (summaryA.r !== 4) {
    throw new Error("FITRAH R calculation failed. Expected R = 4, got: " + summaryA.r);
  }
  if (summaryA.days_counted !== 1) {
    throw new Error("days_counted failed. Expected 1, got: " + summaryA.days_counted);
  }
  
  // Case B: Add another day with SSS = 4, HB = 2. R should be average of all: (4 + 4 + 2)/3 = 3.33
  var p2 = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: '2026-06-16', // Tue
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 4, hb: 2 }]
  };
  route({ action: 'save_culture_scores', payload: p2 });
  
  var summaryB = JSON.parse(route({
    action: 'get_student_character_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.student1Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      week_start_date: '2026-06-15'
    }
  }).getContent()).data;
  
  if (summaryB.r !== 3.33) {
    throw new Error("FITRAH R calculation failed. Expected R = 3.33, got: " + summaryB.r);
  }
  if (summaryB.days_counted !== 2) {
    throw new Error("days_counted failed. Expected 2, got: " + summaryB.days_counted);
  }
  
  // Case C: Add a day with completely empty values. days_counted should still be 2.
  var p3 = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: '2026-06-17', // Wed
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: '', hb: null }]
  };
  route({ action: 'save_culture_scores', payload: p3 });
  
  var summaryC = JSON.parse(route({
    action: 'get_student_character_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.student1Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      week_start_date: '2026-06-15'
    }
  }).getContent()).data;
  
  if (summaryC.days_counted !== 2) {
    throw new Error("days_counted failed on empty score day. Expected 2, got: " + summaryC.days_counted);
  }
}

/**
 * Test Summary Generation & Incremental Delta updates.
 */
function test_summaryAndDeltaUpdates(ctx) {
  var weekDate = "2026-06-15";
  
  // Ensure we have summaries created
  var sSummaryRes = JSON.parse(route({
    action: 'get_student_character_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      student_id: ctx.student1Id,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      week_start_date: weekDate
    }
  }).getContent());
  
  if (sSummaryRes.status !== 'success') {
    throw new Error("Failed to get student character summary: " + sSummaryRes.message);
  }
  
  // Let's get raw summaries from database sheets to verify their existence and values
  var weeklySums = listRecords(SHEETS.CHARACTER_WEEKLY_SUMMARIES, function(r) {
    return r.student_id === ctx.student1Id && normalizeDateString(r.week_start_date) === normalizeDateString(weekDate);
  });
  if (weeklySums.length === 0) {
    throw new Error("Weekly summary record was not created.");
  }
  
  var monthlySums = listRecords(SHEETS.CHARACTER_MONTHLY_SUMMARIES, function(r) {
    return r.student_id === ctx.student1Id && Number(r.month) === 6 && Number(r.year) === 2026;
  });
  if (monthlySums.length === 0) {
    throw new Error("Monthly summary record was not created.");
  }
  
  var semesterSums = listRecords(SHEETS.CHARACTER_SEMESTER_SUMMARIES, function(r) {
    return r.student_id === ctx.student1Id && r.academic_year_id === ctx.yearId && r.semester_id === ctx.semesterId;
  });
  if (semesterSums.length === 0) {
    throw new Error("Semester summary record was not created.");
  }
  
  // Get initial sums
  var initialWeekly = weeklySums[0];
  var initialSssSum = Number(initialWeekly.sss_sum) || 0;
  var initialSssCount = Number(initialWeekly.sss_count) || 0;
  
  // Delta test: Save scores to change SSS value from 4 (which was on 2026-06-15) to 2
  var pUpdate = {
    actor_user_id: ctx.teacher1.id,
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    score_date: '2026-06-15',
    scores: [{ student_id: ctx.student1Id, student_enrollment_id: ctx.enrollment1Id, sss: 2, hb: null }]
  };
  route({ action: 'save_culture_scores', payload: pUpdate });
  
  // Re-read weekly summary
  var updatedWeekly = listRecords(SHEETS.CHARACTER_WEEKLY_SUMMARIES, function(r) {
    return r.student_id === ctx.student1Id && normalizeDateString(r.week_start_date) === normalizeDateString(weekDate);
  })[0];
  
  var newSssSum = Number(updatedWeekly.sss_sum) || 0;
  var newSssCount = Number(updatedWeekly.sss_count) || 0;
  
  if (newSssSum !== initialSssSum - 2) {
    throw new Error("Delta sum update failed. Expected " + (initialSssSum - 2) + ", got: " + newSssSum);
  }
  if (newSssCount !== initialSssCount) {
    throw new Error("Delta count update failed. Expected count to stay the same, got: " + newSssCount);
  }
  
  // Test Class summary API & authorization
  var classSummaryRes = JSON.parse(route({
    action: 'get_class_character_summary',
    payload: {
      actor_user_id: ctx.teacher1.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      week_start_date: weekDate
    }
  }).getContent());
  
  if (classSummaryRes.status !== 'success') {
    throw new Error("Failed to retrieve class character summary: " + classSummaryRes.message);
  }
  
  var teacher2ClassSummary = JSON.parse(route({
    action: 'get_class_character_summary',
    payload: {
      actor_user_id: ctx.teacher2.id,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      week_start_date: weekDate
    }
  }).getContent());
  if (teacher2ClassSummary.status !== 'error' || teacher2ClassSummary.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali was allowed to view class character summary.");
  }
}
