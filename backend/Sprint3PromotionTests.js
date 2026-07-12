/**
 * Sprint3PromotionTests.gs
 * QA and E2E verification suite for Sprint 3A Promotion Rules & Student Promotion Preview features.
 */

var sprint3AdminToken = '';
var sprint3TeacherToken = '';

function test_runSprint3PromotionQA() {
  console.log("=== STARTING SPRINT 3 PROMOTION RULES & PREVIEW QA ===");

  setupDatabase();
  seedInitialData();
  clearAcademicPeriods();

  // Retrieve admin, teacher user and login
  var adminUser = getUserByIdentifier('admin');
  var teacherUser = getUserByIdentifier('guruqa') || getUserByIdentifier('guru1');
  if (!teacherUser) {
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
      user_agent: 'Sprint3-QA-Test'
    }
  }).getContent());
  sprint3AdminToken = adminLoginRes.data.token;

  // Teacher login
  var teacherLoginRes = JSON.parse(route({
    action: 'login',
    payload: {
      identifier: teacherUser.username,
      password: 'Teacher123!',
      ip_address: '127.0.0.1',
      user_agent: 'Sprint3-QA-Test'
    }
  }).getContent());
  sprint3TeacherToken = teacherLoginRes.data.token;

  var suffix = new Date().getTime() + "_" + Math.floor(Math.random() * 100000);

  // Set up sequential periods:
  // Year A (2025/2026), Year B (2026/2027), Year C (2027/2028)
  var yearARes = assertSprint3RouteSuccess('create_academic_year', {
    name: "AY_A_" + suffix,
    start_date: "2025-07-01",
    end_date: "2026-06-30"
  });
  var yearAId = yearARes.data.id;

  var semA1Res = assertSprint3RouteSuccess('create_semester', {
    academic_year_id: yearAId,
    name: "Ganjil",
    start_date: "2025-07-01",
    end_date: "2025-12-31"
  });
  var semA1Id = semA1Res.data.id;

  var semA2Res = assertSprint3RouteSuccess('create_semester', {
    academic_year_id: yearAId,
    name: "Genap",
    start_date: "2026-01-01",
    end_date: "2026-06-30"
  });
  var semA2Id = semA2Res.data.id;

  var yearBRes = assertSprint3RouteSuccess('create_academic_year', {
    name: "AY_B_" + suffix,
    start_date: "2026-07-01",
    end_date: "2027-06-30"
  });
  var yearBId = yearBRes.data.id;

  var semB1Res = assertSprint3RouteSuccess('create_semester', {
    academic_year_id: yearBId,
    name: "Ganjil",
    start_date: "2026-07-01",
    end_date: "2026-12-31"
  });
  var semB1Id = semB1Res.data.id;

  var semB2Res = assertSprint3RouteSuccess('create_semester', {
    academic_year_id: yearBId,
    name: "Genap",
    start_date: "2027-01-01",
    end_date: "2027-06-30"
  });
  var semB2Id = semB2Res.data.id;

  var yearCRes = assertSprint3RouteSuccess('create_academic_year', {
    name: "AY_C_" + suffix,
    start_date: "2027-07-01",
    end_date: "2028-06-30"
  });
  var yearCId = yearCRes.data.id;

  var semC1Res = assertSprint3RouteSuccess('create_semester', {
    academic_year_id: yearCId,
    name: "Ganjil",
    start_date: "2027-07-01",
    end_date: "2027-12-31"
  });
  var semC1Id = semC1Res.data.id;

  // Set up Classes
  // Source Class (level 5)
  var classL5Res = assertSprint3RouteSuccess('create_class', {
    code: 'QA_L5_' + suffix,
    name: 'Kelas 5 QA ' + suffix,
    level: '5'
  });
  var classL5Id = classL5Res.data.id;

  // Target Class (level 6)
  var classL6Res = assertSprint3RouteSuccess('create_class', {
    code: 'QA_L6_' + suffix,
    name: 'Kelas 6 QA ' + suffix,
    level: '6'
  });
  var classL6Id = classL6Res.data.id;

  // Inactive Target Class
  var classInactiveRes = assertSprint3RouteSuccess('create_class', {
    code: 'QA_INAC_' + suffix,
    name: 'Kelas Inaktif QA ' + suffix,
    level: '6'
  });
  var classInactiveId = classInactiveRes.data.id;
  updateRecord(SHEETS.CLASSES, classInactiveId, { status: STATUS.INACTIVE });

  // --- TEST CASE 1: Role Security checks ---
  console.log("Running QA 1: Security and role-based access checks...");
  
  // Guru cannot access class promotion rules CRUD
  var resGuruList = JSON.parse(route({ action: 'list_class_promotion_rules', token: sprint3TeacherToken }).getContent());
  if (resGuruList.status !== 'error' || resGuruList.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Teacher to be rejected from list_class_promotion_rules.");
  }
  
  var resGuruCreate = JSON.parse(route({
    action: 'create_class_promotion_rule',
    payload: { source_class_id: classL5Id, target_class_id: classL6Id },
    token: sprint3TeacherToken
  }).getContent());
  if (resGuruCreate.status !== 'error' || resGuruCreate.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Teacher to be rejected from create_class_promotion_rule.");
  }

  // Guru cannot access preview
  var resGuruPrev = JSON.parse(route({
    action: 'preview_student_promotion',
    payload: {
      source_academic_year_id: yearAId,
      source_semester_id: semA2Id,
      target_academic_year_id: yearBId,
      target_semester_id: semB1Id
    },
    token: sprint3TeacherToken
  }).getContent());
  if (resGuruPrev.status !== 'error' || resGuruPrev.code !== 'ERR_FORBIDDEN') {
    throw new Error("Expected Teacher to be rejected from preview_student_promotion.");
  }

  // --- TEST CASE 2: Class Promotion Rules CRUD ---
  console.log("Running QA 2: Class Promotion Rules CRUD operations...");

  // List initially (should be empty or contain some defaults, depending on seed, let's look for our new rule)
  var initialRules = assertSprint3RouteSuccess('list_class_promotion_rules', {}).data;
  var initialCount = initialRules.length;

  // Create rule
  var newRule = assertSprint3RouteSuccess('create_class_promotion_rule', {
    source_class_id: classL5Id,
    target_class_id: classL6Id
  }).data;
  
  if (newRule.source_class_id !== classL5Id || newRule.target_class_id !== classL6Id || newRule.status !== STATUS.ACTIVE) {
    throw new Error("Promotion rule creation attributes mismatch.");
  }

  // Duplicate rule check
  var errDuplicate = assertSprint3RouteError('create_class_promotion_rule', {
    source_class_id: classL5Id,
    target_class_id: classL6Id
  });
  if (errDuplicate.code !== 'ERR_DUPLICATE_RULE') {
    throw new Error("Expected ERR_DUPLICATE_RULE for duplicate class rule. Got: " + errDuplicate.code);
  }

  // Same class check
  var errSameClass = assertSprint3RouteError('create_class_promotion_rule', {
    source_class_id: classL5Id,
    target_class_id: classL5Id
  });
  if (errSameClass.code !== 'ERR_INVALID_PARAMETER') {
    throw new Error("Expected ERR_INVALID_PARAMETER when source_class_id === target_class_id.");
  }

  // Inactive target class validation
  var errInactiveTarget = assertSprint3RouteError('create_class_promotion_rule', {
    source_class_id: classL6Id,
    target_class_id: classInactiveId
  });
  if (errInactiveTarget.code !== 'ERR_INVALID_PARAMETER') {
    throw new Error("Expected ERR_INVALID_PARAMETER when target class is inactive.");
  }

  // Update rule
  var updateRes = assertSprint3RouteSuccess('update_class_promotion_rule', {
    id: newRule.id,
    target_class_id: classL6Id
  }).data;

  // Deactivate rule (soft delete)
  assertSprint3RouteSuccess('deactivate_class_promotion_rule', { id: newRule.id });
  
  var currentRules = assertSprint3RouteSuccess('list_class_promotion_rules', {}).data;
  if (currentRules.length !== initialCount) {
    throw new Error("Expected soft-deleted rule to be excluded from active rules list.");
  }

  // Re-create rule for preview tests
  var ruleForPreview = assertSprint3RouteSuccess('create_class_promotion_rule', {
    source_class_id: classL5Id,
    target_class_id: classL6Id
  }).data;


  // --- TEST CASE 3: Preview Period Safety Blockers ---
  console.log("Running QA 3: Preview safety checks (same-year, non-consecutive, semesters)...");

  // Same Academic Year Blocker
  var previewSameYear = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearAId,
    target_semester_id: semA2Id
  }).data;
  if (previewSameYear.can_execute !== false || previewSameYear.global_blockers.length === 0) {
    throw new Error("Expected same academic year rollover to be blocked.");
  }
  var blockerSame = previewSameYear.global_blockers.find(function(b) { return b.type === 'PERIOD_MISMATCH'; });
  if (!blockerSame || blockerSame.message.indexOf("tidak boleh sama") === -1) {
    throw new Error("Expected period mismatch blocker message for same academic year.");
  }

  // Non-consecutive Academic Year Blocker (Year A to Year C)
  var previewNonConsec = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA2Id,
    target_academic_year_id: yearCId,
    target_semester_id: semC1Id
  }).data;
  if (previewNonConsec.can_execute !== false) {
    throw new Error("Expected non-consecutive academic years to be blocked.");
  }
  var blockerConsec = previewNonConsec.global_blockers.find(function(b) { return b.type === 'PERIOD_MISMATCH'; });
  if (!blockerConsec || blockerConsec.message.indexOf("berikutnya secara berurutan") === -1) {
    throw new Error("Expected sequence blocker for non-consecutive academic years.");
  }

  // Invalid final-to-first semester blocker (Year A Ganjil to Year B Ganjil)
  var previewInvalidSem = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA1Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  }).data;
  console.log("DEBUG previewInvalidSem global_blockers:", JSON.stringify(previewInvalidSem.global_blockers));
  if (previewInvalidSem.can_execute !== false) {
    throw new Error("Expected invalid final-to-first semester pairing to be blocked.");
  }
  var blockerSem = previewInvalidSem.global_blockers.find(function(b) {
    return b.type === 'PERIOD_MISMATCH' && b.message.indexOf("akhir (Genap)") !== -1;
  });
  if (!blockerSem || blockerSem.message.indexOf("akhir (Genap)") === -1) {
    throw new Error("Expected semester pairing blocker for non-final source semester.");
  }


  // --- TEST CASE 4: Preview Recommendation Logic (Graduation, Missing Rules) ---
  console.log("Running QA 4: Student recommendation engine validations...");

  // Setup students and enrollments in Year A Genap
  var student1 = createRecord(SHEETS.STUDENTS, {
    nisn: "88888801",
    full_name: "Siswa Naik Kelas QA",
    gender: "L",
    status: "Aktif"
  });
  createRecord(SHEETS.STUDENT_ENROLLMENTS, {
    student_id: student1.id,
    class_id: classL5Id,
    academic_year_id: yearAId,
    semester_id: semA2Id,
    status: 'active'
  });

  // Student 2: Grade 5 without rule (we will create a new Class Level 5 with no promotion rule mapping)
  var classL5NoRuleRes = assertSprint3RouteSuccess('create_class', {
    code: 'QA_L5_NR_' + suffix,
    name: 'Kelas 5 NR QA ' + suffix,
    level: '5'
  });
  var classL5NoRuleId = classL5NoRuleRes.data.id;

  var student2 = createRecord(SHEETS.STUDENTS, {
    nisn: "88888802",
    full_name: "Siswa Blocker Rules QA",
    gender: "P",
    status: "Aktif"
  });
  createRecord(SHEETS.STUDENT_ENROLLMENTS, {
    student_id: student2.id,
    class_id: classL5NoRuleId,
    academic_year_id: yearAId,
    semester_id: semA2Id,
    status: 'active'
  });

  // Student 3: Grade 6 final class (should auto-graduate)
  var student3 = createRecord(SHEETS.STUDENTS, {
    nisn: "88888803",
    full_name: "Siswa Lulus QA",
    gender: "L",
    status: "Aktif"
  });
  createRecord(SHEETS.STUDENT_ENROLLMENTS, {
    student_id: student3.id,
    class_id: classL6Id, // level 6 class
    academic_year_id: yearAId,
    semester_id: semA2Id,
    status: 'active'
  });

  // Run preview on consecutive Year A Genap to Year B Ganjil
  var previewValid = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA2Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id
  }).data;

  // Because student2 has no rule, can_execute must be false
  if (previewValid.can_execute !== false) {
    throw new Error("Expected can_execute to be false because Siswa Blocker Rules QA has no promotion rule.");
  }

  var res1 = previewValid.students.find(function(s) { return s.student_id === student1.id; });
  if (res1.recommended_action !== 'promoted' || res1.recommended_target_class_id !== classL6Id) {
    throw new Error("Expected student 1 to be recommended for promotion to level 6 class. Got: " + JSON.stringify(res1));
  }
  if (res1.blockers.length > 0) {
    throw new Error("Student 1 should not have any blockers. Got: " + JSON.stringify(res1.blockers));
  }

  var res2 = previewValid.students.find(function(s) { return s.student_id === student2.id; });
  if (res2.recommended_action !== 'unresolved' || res2.blockers.length === 0) {
    throw new Error("Expected student 2 to be unresolved due to missing rule blocker.");
  }
  if (res2.blockers[0].indexOf("Tidak ada aturan kenaikan kelas") === -1) {
    throw new Error("Missing rule blocker message mismatch.");
  }

  var res3 = previewValid.students.find(function(s) { return s.student_id === student3.id; });
  if (res3.recommended_action !== 'graduated' || res3.blockers.length > 0) {
    throw new Error("Expected final level 6 student to auto-recommend 'graduated' with no blockers. Got: " + JSON.stringify(res3));
  }


  // --- TEST CASE 5: Overrides validation in Preview ---
  console.log("Running QA 5: Override validations inside preview...");

  // Apply override to resolve Student 2 blocker by changing action to repeated (Tinggal Kelas)
  var previewOverridden = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA2Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id,
    overrides: [
      {
        student_id: student2.id,
        action: 'repeated',
        target_class_id: ''
      }
    ]
  }).data;

  // The blocker on student 2 is resolved. Since student 1 has promotion rule and student 3 graduates, the batch is now green!
  if (previewOverridden.can_execute !== true) {
    throw new Error("Expected can_execute to be true after resolving the missing rule blocker with repeated override. Blockers left: " + JSON.stringify(previewOverridden.students.map(function(s){return s.blockers;})));
  }

  var res2Ovr = previewOverridden.students.find(function(s) { return s.student_id === student2.id; });
  if (res2Ovr.resolved_action !== 'repeated' || res2Ovr.resolved_target_class_id !== classL5NoRuleId) {
    throw new Error("Expected student 2 override to be resolved to 'repeated' in original class.");
  }
  if (res2Ovr.blockers.length > 0) {
    throw new Error("Expected student 2 override blockers to be empty.");
  }

  // Test invalid action override
  var previewBadOverride = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA2Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id,
    overrides: [
      {
        student_id: student1.id,
        action: 'invalid_action',
        target_class_id: ''
      }
    ]
  }).data;
  if (previewBadOverride.can_execute !== false) {
    throw new Error("Expected invalid override action to block execution.");
  }
  var badRes1 = previewBadOverride.students.find(function(s) { return s.student_id === student1.id; });
  if (badRes1.blockers.length === 0 || badRes1.blockers[0].indexOf("tidak valid") === -1) {
    throw new Error("Expected blocker message for invalid manual action override.");
  }

  // Test promoted override with inactive target class
  var previewInactiveOverride = assertSprint3RouteSuccess('preview_student_promotion', {
    source_academic_year_id: yearAId,
    source_semester_id: semA2Id,
    target_academic_year_id: yearBId,
    target_semester_id: semB1Id,
    overrides: [
      {
        student_id: student1.id,
        action: 'promoted',
        target_class_id: classInactiveId
      }
    ]
  }).data;
  if (previewInactiveOverride.can_execute !== false) {
    throw new Error("Expected promoted override to inactive target class to block execution.");
  }
  var inactiveRes = previewInactiveOverride.students.find(function(s) { return s.student_id === student1.id; });
  if (inactiveRes.blockers.length === 0 || inactiveRes.blockers[0].indexOf("tidak aktif") === -1) {
    throw new Error("Expected blocker message for inactive target class override.");
  }

  // Reset database back to clean seeded state
  setupDatabase();
  seedInitialData();

  console.log("=== SPRINT 3 PROMOTION RULES & PREVIEW QA PASSED ===");
}

function assertSprint3RouteSuccess(action, payload, adminToken) {
  var requestObj = {
    action: action,
    payload: payload || {}
  };
  requestObj.token = adminToken || sprint3AdminToken;
  var result = JSON.parse(route(requestObj).getContent());

  if (result.status !== 'success') {
    throw new Error("Action " + action + " failed: " + JSON.stringify(result));
  }

  return result;
}

function assertSprint3RouteError(action, payload, adminToken) {
  var requestObj = {
    action: action,
    payload: payload || {}
  };
  requestObj.token = adminToken || sprint3AdminToken;
  var result = JSON.parse(route(requestObj).getContent());

  if (result.status !== 'error') {
    throw new Error("Action " + action + " expected to fail but succeeded: " + JSON.stringify(result));
  }

  return result;
}

function clearAcademicPeriods() {
  var allowDestructiveTests = PropertiesService.getScriptProperties().getProperty('SIUBA_ALLOW_DESTRUCTIVE_TESTS');
  if (allowDestructiveTests !== 'true') {
    throw new Error('Destructive promotion QA is disabled. Run only in an isolated test spreadsheet after setting SIUBA_ALLOW_DESTRUCTIVE_TESTS=true.');
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {}
  
  try {
    var sheetYears = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ACADEMIC_YEARS);
    if (sheetYears && sheetYears.getLastRow() > 1) {
      sheetYears.getRange(2, 1, sheetYears.getLastRow() - 1, sheetYears.getLastColumn()).clearContent();
    }
    
    var sheetSems = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SEMESTERS);
    if (sheetSems && sheetSems.getLastRow() > 1) {
      sheetSems.getRange(2, 1, sheetSems.getLastRow() - 1, sheetSems.getLastColumn()).clearContent();
    }
  } finally {
    lock.releaseLock();
  }
}

/** Sprint 3B core execution engine QA (QA 1-9). */
function test_runSprint3BPromotionQA() {
  console.log('=== STARTING SPRINT 3B EXECUTION QA ===');
  setupDatabase();
  seedInitialData();
  clearAcademicPeriods();

  var admin = getUserByIdentifier('admin');
  var login = JSON.parse(route({ action: 'login', payload: {
    identifier: 'admin', password: 'Admin123!', ip_address: '127.0.0.1', user_agent: 'Sprint3B-QA'
  }}).getContent());
  sprint3AdminToken = login.data.token;
  var suffix = new Date().getTime() + '_' + Math.floor(Math.random() * 100000);

  var yearA = assertSprint3RouteSuccess('create_academic_year', { name: '3B_A_' + suffix, start_date: '2030-07-01', end_date: '2031-06-30' }).data;
  var semA1 = assertSprint3RouteSuccess('create_semester', { academic_year_id: yearA.id, name: 'Ganjil', start_date: '2030-07-01', end_date: '2030-12-31' }).data;
  var semA2 = assertSprint3RouteSuccess('create_semester', { academic_year_id: yearA.id, name: 'Genap', start_date: '2031-01-01', end_date: '2031-06-30' }).data;
  var yearB = assertSprint3RouteSuccess('create_academic_year', { name: '3B_B_' + suffix, start_date: '2031-07-01', end_date: '2032-06-30' }).data;
  var semB1 = assertSprint3RouteSuccess('create_semester', { academic_year_id: yearB.id, name: 'Ganjil', start_date: '2031-07-01', end_date: '2031-12-31' }).data;
  var semB2 = assertSprint3RouteSuccess('create_semester', { academic_year_id: yearB.id, name: 'Genap', start_date: '2032-01-01', end_date: '2032-06-30' }).data;

  var class5 = assertSprint3RouteSuccess('create_class', { code: '3B5_' + suffix, name: 'Kelas 5 3B', level: '5' }).data;
  var class6 = assertSprint3RouteSuccess('create_class', { code: '3B6_' + suffix, name: 'Kelas 6 3B', level: '6' }).data;
  assertSprint3RouteSuccess('create_class_promotion_rule', { source_class_id: class5.id, target_class_id: class6.id });

  function fixture(name, classId) {
    var student = createRecord(SHEETS.STUDENTS, { nisn: String(Math.floor(Math.random() * 90000000) + 10000000), full_name: name, gender: 'L', status: 'Aktif' });
    var enrollment = createRecord(SHEETS.STUDENT_ENROLLMENTS, { student_id: student.id, class_id: classId, academic_year_id: yearA.id, semester_id: semA2.id, status: 'active' });
    return { student: student, enrollment: enrollment };
  }

  var promoted = fixture('QA Promoted', class5.id);
  var repeated = fixture('QA Repeated', class5.id);
  var graduated = fixture('QA Graduated', class6.id);
  var transferred = fixture('QA Transferred', class5.id);
  var inactive = fixture('QA Inactive', class5.id);
  var left = fixture('QA Left', class5.id);
  var payload = {
    source_academic_year_id: yearA.id, source_semester_id: semA2.id,
    target_academic_year_id: yearB.id, target_semester_id: semB1.id,
    overrides: [
      { student_id: repeated.student.id, action: 'repeated' },
      { student_id: transferred.student.id, action: 'transferred' },
      { student_id: inactive.student.id, action: 'inactive' },
      { student_id: left.student.id, action: 'left' }
    ]
  };

  var auditSheet = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID).getSheetByName(SHEETS.AUDIT_LOGS);
  var auditBefore = auditSheet ? readAuditActionCount3B_(auditSheet, 'PROMOTION_EXECUTION') : 0;
  var result = assertSprint3RouteSuccess('execute_student_promotion', payload).data;
  if (result.processed !== 6 || result.completed !== 6 || result.failed !== 0 || result.promoted !== 1 || result.repeated !== 1 || result.graduated !== 1 || result.transferred !== 1 || result.inactive !== 1 || result.left !== 1) throw new Error('Execution counts mismatch: ' + JSON.stringify(result));

  function assertState(f, enrollmentStatus, studentStatus, targetClassId, expectsTarget) {
    if (getRecordById(SHEETS.STUDENT_ENROLLMENTS, f.enrollment.id).status !== enrollmentStatus) throw new Error('Source enrollment mismatch for ' + f.student.full_name);
    if (getRecordById(SHEETS.STUDENTS, f.student.id).status !== studentStatus) throw new Error('Student status mismatch for ' + f.student.full_name);
    var targets = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) { return e.student_id === f.student.id && e.academic_year_id === yearB.id && e.semester_id === semB1.id && e.status === 'active'; });
    if (targets.length !== (expectsTarget ? 1 : 0)) throw new Error('Target enrollment count mismatch for ' + f.student.full_name);
    if (expectsTarget && targets[0].class_id !== targetClassId) throw new Error('Target class mismatch for ' + f.student.full_name);
  }
  assertState(promoted, 'promoted', 'Aktif', class6.id, true);
  assertState(repeated, 'repeated', 'Aktif', class5.id, true);
  assertState(graduated, 'graduated', 'Lulus', '', false);
  assertState(transferred, 'transferred', 'Pindah', '', false);
  assertState(inactive, 'inactive', 'Tidak aktif', '', false);
  assertState(left, 'inactive', 'Keluar', '', false);

  assertSprint3RouteSuccess('execute_student_promotion', payload);
  [promoted, repeated].forEach(function(f) {
    var activeTargets = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) { return e.student_id === f.student.id && e.academic_year_id === yearB.id && e.semester_id === semB1.id && e.status === 'active'; });
    if (activeTargets.length !== 1) throw new Error('Duplicate active enrollment created.');
  });

  // Endpoint security: a teacher token and a parent-shaped actor are forbidden.
  var teacher = getUserByIdentifier('guru1');
  if (teacher) {
    var teacherLogin = JSON.parse(route({ action: 'login', payload: { identifier: teacher.username, password: 'Teacher123!', ip_address: '127.0.0.1', user_agent: 'Sprint3B-QA' }}).getContent());
    if (teacherLogin.status === 'success') {
      var forbidden = JSON.parse(route({ action: 'execute_student_promotion', payload: payload, token: teacherLogin.data.token }).getContent());
      if (forbidden.code !== 'ERR_FORBIDDEN') throw new Error('Teacher must receive ERR_FORBIDDEN.');
    }
  }
  try { assertAdminRole({ role: 'parent' }); throw new Error('Parent must receive ERR_FORBIDDEN.'); } catch (e) { if (e.code !== 'ERR_FORBIDDEN') throw e; }

  auditSheet = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID).getSheetByName(SHEETS.AUDIT_LOGS);
  var auditAfter = readAuditActionCount3B_(auditSheet, 'PROMOTION_EXECUTION');
  if (auditAfter - auditBefore !== 2) throw new Error('Expected exactly one batch audit per execution.');

  setupDatabase();
  seedInitialData();
  console.log('=== SPRINT 3B EXECUTION QA PASSED ===');
}

function readAuditActionCount3B_(sheet, action) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var actionIndex = headers.indexOf('action');
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues().filter(function(row) { return row[actionIndex] === action; }).length;
}

/**
 * Deployment-parity smoke test for the two Sprint 3 promotion routes.
 * Run this from the Apps Script editor after deploying backend changes.
 */
function test_smokePromotionEndpoints() {
  setupDatabase();
  seedInitialData();

  var adminLogin = JSON.parse(route({ action: 'login', payload: {
    identifier: 'admin', password: 'Admin123!', ip_address: '127.0.0.1', user_agent: 'Promotion-Route-Smoke'
  }}).getContent());
  if (adminLogin.status !== 'success') throw new Error('Smoke test requires the seeded admin credentials.');
  var adminToken = adminLogin.data.token;

  var suffix = new Date().getTime();
  var admin = getUserByIdentifier('admin');
  var teacher = createUser(admin, {
    name: 'Promotion Smoke Teacher',
    email: 'promotion.smoke.' + suffix + '@example.com',
    username: 'promotion_smoke_' + suffix,
    password: 'Teacher123!',
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE,
    phone: '0800000000'
  });
  var teacherLogin = JSON.parse(route({ action: 'login', payload: {
    identifier: teacher.username, password: 'Teacher123!', ip_address: '127.0.0.1', user_agent: 'Promotion-Route-Smoke'
  }}).getContent());
  if (teacherLogin.status !== 'success') throw new Error('Failed to create teacher smoke session.');

  ['preview_student_promotion', 'execute_student_promotion'].forEach(function(action) {
    var adminResponse = JSON.parse(route({ action: action, payload: {}, token: adminToken }).getContent());
    if (adminResponse.status !== 'error' || adminResponse.code === 'ERR_FORBIDDEN' || adminResponse.code === 'UNKNOWN_ACTION') {
      throw new Error(action + ' did not reach payload validation for administrator: ' + JSON.stringify(adminResponse));
    }

    var teacherResponse = JSON.parse(route({ action: action, payload: {}, token: teacherLogin.data.token }).getContent());
    if (teacherResponse.status !== 'error' || teacherResponse.code !== 'ERR_FORBIDDEN') {
      throw new Error(action + ' must reject teacher with ERR_FORBIDDEN: ' + JSON.stringify(teacherResponse));
    }
  });

  var unknown = JSON.parse(route({ action: 'promotion_route_does_not_exist', payload: {}, token: adminToken }).getContent());
  if (unknown.status !== 'error' || unknown.code !== 'UNKNOWN_ACTION') {
    throw new Error('Unknown route control check failed: ' + JSON.stringify(unknown));
  }

  console.log('=== PROMOTION ENDPOINT SMOKE PASSED ===');
}
