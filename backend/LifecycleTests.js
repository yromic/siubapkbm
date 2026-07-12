/**
 * LifecycleTests.gs
 * QA verification and regression testing suite for Enterprise Entity Lifecycle Engine.
 */

function test_runLifecycleTestSuite() {
  console.log("=== STARTING ENTERPRISE LIFECYCLE QA TEST SUITE ===");
  
  var actor = { id: 'admin_test', name: 'Admin Test', role: 'administrator' };
  
  // 1. Test Valid Transitions
  test_validTransitions(actor);
  
  // 2. Test Invalid Transitions (Illegal transitions should fail)
  test_invalidTransitions(actor);
  
  // 3. Test Referential Integrity Guard (deactivating items in use should fail)
  test_referentialIntegrityGuard(actor);
  
  // 4. Test Cascade Actions (archiving student deactivates enrollment)
  test_cascadeActions(actor);
  
  // 5. Test Restore Rules (verifying class and semester status)
  test_restoreRules(actor);
  
  console.log("=== ENTERPRISE LIFECYCLE QA TEST SUITE PASSED ===");
}

function test_validTransitions(actor) {
  console.log("Running valid status transitions tests...");
  
  // Create a student and transition to inactive, then back to active
  var std = createRecord(SHEETS.STUDENTS, {
    nisn: '99999123',
    full_name: 'Lifecycle Student Test',
    gender: 'L',
    status: 'Aktif'
  }, actor);
  
  // Inactive
  updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.INACTIVE }, actor);
  var updated = getRecordById(SHEETS.STUDENTS, std.id);
  if (updated.lifecycle_status !== LIFECYCLE_STATUS.INACTIVE) {
    throw new Error("Expected student to be INACTIVE, got: " + updated.lifecycle_status);
  }
  
  // Active
  updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.ACTIVE }, actor);
  updated = getRecordById(SHEETS.STUDENTS, std.id);
  if (updated.lifecycle_status !== LIFECYCLE_STATUS.ACTIVE) {
    throw new Error("Expected student to be ACTIVE, got: " + updated.lifecycle_status);
  }
  
  console.log("Valid transitions tests passed.");
}

function test_invalidTransitions(actor) {
  console.log("Running invalid/illegal status transitions tests...");
  
  var std = createRecord(SHEETS.STUDENTS, {
    nisn: '99999124',
    full_name: 'Lifecycle Student Test 2',
    gender: 'L',
    status: 'Aktif'
  }, actor);
  
  var failed = false;
  try {
    // Try to transition directly from ACTIVE to ARCHIVED (which is illegal, must go through deactivation first)
    updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.ARCHIVED }, actor);
  } catch (e) {
    failed = true;
  }
  
  if (!failed) {
    throw new Error("Expected transition active -> archived to fail, but it succeeded.");
  }
  
  console.log("Invalid transitions tests passed.");
}

function test_referentialIntegrityGuard(actor) {
  console.log("Running referential integrity guard tests...");
  
  // Create a subject
  var subj = createRecord(SHEETS.SUBJECTS, {
    code: 'TEST_SUBJ_LF',
    name: 'Lifecycle Test Subject',
    status: 'active'
  }, actor);
  
  // Create an assessment referencing it
  var ass = createRecord(SHEETS.ACADEMIC_ASSESSMENTS, {
    teacher_user_id: 'tea_1',
    class_id: 'cls_1',
    subject_id: subj.id,
    academic_year_id: 'year_1',
    semester_id: 'sem_1',
    title: 'Lifecycle Test Ass',
    score_min: 0,
    score_max: 100,
    status: 'active'
  }, actor);
  
  var failed = false;
  try {
    // Try to deactivate the subject while the assessment is active
    updateRecord(SHEETS.SUBJECTS, subj.id, { lifecycle_status: LIFECYCLE_STATUS.INACTIVE }, actor);
  } catch (e) {
    failed = true;
  }
  
  if (!failed) {
    throw new Error("Expected deactivating subject referenced by assessment to fail, but it succeeded.");
  }
  
  console.log("Referential integrity guard tests passed.");
}

function test_cascadeActions(actor) {
  console.log("Running cascade actions tests...");
  
  // Create a student
  var std = createRecord(SHEETS.STUDENTS, {
    nisn: '99999125',
    full_name: 'Lifecycle Cascade Student',
    gender: 'L',
    status: 'Aktif'
  }, actor);
  
  // Create enrollment
  var enroll = createRecord(SHEETS.STUDENT_ENROLLMENTS, {
    student_id: std.id,
    class_id: 'cls_1',
    academic_year_id: 'year_1',
    semester_id: 'sem_1',
    status: 'active'
  }, actor);
  
  // Archive student
  updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.INACTIVE }, actor);
  updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.ARCHIVED }, actor);
  
  // Check if enrollment was updated to inactive
  var updatedEnroll = getRecordById(SHEETS.STUDENT_ENROLLMENTS, enroll.id);
  if (updatedEnroll.lifecycle_status !== LIFECYCLE_STATUS.INACTIVE) {
    throw new Error("Expected enrollment to be cascade deactivated, got: " + updatedEnroll.lifecycle_status);
  }
  
  console.log("Cascade actions tests passed.");
}

function test_restoreRules(actor) {
  console.log("Running restore rules tests...");
  
  // Create inactive class
  var cls = createRecord(SHEETS.CLASSES, {
    code: 'CLS_INACT_LF',
    name: 'Inactive Class LF',
    level: '5',
    status: 'inactive',
    lifecycle_status: 'inactive'
  }, actor);
  
  // Create student
  var std = createRecord(SHEETS.STUDENTS, {
    nisn: '99999126',
    full_name: 'Restore Student Test',
    gender: 'L',
    status: 'Aktif'
  }, actor);
  
  // Enroll in inactive class
  var enroll = createRecord(SHEETS.STUDENT_ENROLLMENTS, {
    student_id: std.id,
    class_id: cls.id,
    academic_year_id: 'year_1',
    semester_id: 'sem_1',
    status: 'active'
  }, actor);
  
  // Archive student
  updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.INACTIVE }, actor);
  updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.ARCHIVED }, actor);
  
  var failed = false;
  try {
    // Try to restore student (which should fail because their class is inactive)
    updateRecord(SHEETS.STUDENTS, std.id, { lifecycle_status: LIFECYCLE_STATUS.ACTIVE }, actor);
  } catch (e) {
    failed = true;
  }
  
  if (!failed) {
    throw new Error("Expected restoring student with inactive class to fail, but it succeeded.");
  }
  
  console.log("Restore rules tests passed.");
}
