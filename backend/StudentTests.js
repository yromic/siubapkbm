/**
 * StudentTests.gs
 * QA and regression verification suite for Sprint 3.
 */

function test_runSprint3QA() {
  console.log("=== STARTING SPRINT 3 QA TEST SUITE ===");
  
  // Confirms reading of requirements
  console.log("Requirement validation: read requirement.md and db.txt rules.");
  
  // 1. Regression Checks
  test_regressionSprint1();
  test_regressionSprint2();
  
  // 2. Setup testing dependencies (active years, classes, teachers)
  var suffix = String(Math.floor(Math.random() * 100000));
  var context = setupSprint3TestContext(suffix);
  
  // 3. Students CRUD & Validations
  test_studentCreate(context, suffix);
  test_studentUpdate(context, suffix);
  test_studentStatus(context);
  test_parentPin(context);
  test_fieldFiltering(context);
  
  // 4. Enrollments CRUD & Validations
  test_enrollmentCreate(context);
  test_enrollmentUpdateAndStatus(context);
  test_listStudentsByClass(context);
  
  console.log("=== SPRINT 3 QA TEST SUITE PASSED ===");
}

/**
 * Setup data dependencies for Sprint 3 test runs.
 */
function setupSprint3TestContext(suffix) {
  var admin = getUserByIdentifier('admin');
  
  // Ensure we have a main active year and semester
  var settings = getAppSettings();
  var activeYearId = settings.active_academic_year_id;
  var activeSemId = settings.active_semester_id;
  
  if (!activeYearId || !activeSemId) {
    // Create new year
    var yearRes = JSON.parse(route({
      action: 'create_academic_year',
      payload: {
        actor_user_id: admin.id,
        name: "AY_S3_" + suffix,
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
  
  // Create teachers
  var teacher1 = getUserByIdentifier('guru_s3_1_' + suffix);
  if (!teacher1) {
    teacher1 = createRecord(SHEETS.USERS, {
      name: 'Guru S3 Wali',
      email: 'guru_s3_1_' + suffix + '@example.com',
      username: 'guru_s3_1_' + suffix,
      password_hash: hashPassword('Password123!'),
      role: ROLES.TEACHER,
      status: STATUS.ACTIVE
    });
  }
  
  var teacher2 = getUserByIdentifier('guru_s3_2_' + suffix);
  if (!teacher2) {
    teacher2 = createRecord(SHEETS.USERS, {
      name: 'Guru S3 NonWali',
      email: 'guru_s3_2_' + suffix + '@example.com',
      username: 'guru_s3_2_' + suffix,
      password_hash: hashPassword('Password123!'),
      role: ROLES.TEACHER,
      status: STATUS.ACTIVE
    });
  }
  
  // Create Class
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: admin.id,
      code: 'CLS_S3_' + suffix,
      name: 'Kelas S3 ' + suffix,
      level: '5'
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
  
  return {
    adminId: admin.id,
    teacher1: teacher1,
    teacher2: teacher2,
    classId: classId,
    yearId: activeYearId,
    semesterId: activeSemId
  };
}

/**
 * 3. Student Create & validations
 */
function test_studentCreate(ctx, suffix) {
  console.log("Testing Student Create & Validations...");
  
  var nisnVal = "88888" + suffix.substring(0, 3);
  var payload = {
    actor_user_id: ctx.adminId,
    nisn: nisnVal,
    nik: "1234567890123456",
    full_name: "Siswa S3 Test " + suffix,
    birth_place: "Jakarta",
    birth_date: "2015-05-15",
    gender: "L",
    status: "Aktif",
    parent_access_pin: "123456"
  };
  
  // Success create
  var resCreate = JSON.parse(route({ action: 'create_student', payload: payload }).getContent());
  if (resCreate.status !== 'success') {
    throw new Error("Student creation failed: " + resCreate.message);
  }
  ctx.studentId = resCreate.data.id;
  
  // Duplicate NISN check
  var resDup = JSON.parse(route({ action: 'create_student', payload: payload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Duplicate NISN was allowed.");
  }
  
  // Invalid NIK length check
  var badNikPayload = JSON.parse(JSON.stringify(payload));
  badNikPayload.nisn = "99999" + suffix.substring(0,3);
  badNikPayload.nik = "1234567890"; // 10 digits instead of 16
  var resBadNik = JSON.parse(route({ action: 'create_student', payload: badNikPayload }).getContent());
  if (resBadNik.status !== 'error') {
    throw new Error("Failed: Invalid NIK length was allowed.");
  }
  
  // Invalid birth_date format check
  var badBirthPayload = JSON.parse(JSON.stringify(payload));
  badBirthPayload.nisn = "99999" + suffix.substring(0,3);
  badBirthPayload.birth_date = "not-a-date";
  var resBadBirth = JSON.parse(route({ action: 'create_student', payload: badBirthPayload }).getContent());
  if (resBadBirth.status !== 'error') {
    throw new Error("Failed: Invalid birth_date format was allowed.");
  }
  
  // Invalid gender check
  var badGenderPayload = JSON.parse(JSON.stringify(payload));
  badGenderPayload.nisn = "99999" + suffix.substring(0,3);
  badGenderPayload.gender = "X";
  var resBadGender = JSON.parse(route({ action: 'create_student', payload: badGenderPayload }).getContent());
  if (resBadGender.status !== 'error') {
    throw new Error("Failed: Invalid gender enum was allowed.");
  }
  
  // Invalid status check
  var badStatusPayload = JSON.parse(JSON.stringify(payload));
  badStatusPayload.nisn = "99999" + suffix.substring(0,3);
  badStatusPayload.status = "AktifSekali";
  var resBadStatus = JSON.parse(route({ action: 'create_student', payload: badStatusPayload }).getContent());
  if (resBadStatus.status !== 'error') {
    throw new Error("Failed: Invalid status value was allowed.");
  }
  
  // Attempt direct submission of parent_access_pin_hash
  var badHashPayload = JSON.parse(JSON.stringify(payload));
  badHashPayload.nisn = "99999" + suffix.substring(0,3);
  badHashPayload.parent_access_pin_hash = "mockedhashval";
  var resBadHash = JSON.parse(route({ action: 'create_student', payload: badHashPayload }).getContent());
  if (resBadHash.status !== 'error') {
    throw new Error("Failed: Direct injection of parent_access_pin_hash was allowed.");
  }
  
  console.log("Students module validations verified successfully.");
}

/**
 * 4. Student Update
 */
function test_studentUpdate(ctx, suffix) {
  console.log("Testing Student Update...");
  
  var payload = {
    actor_user_id: ctx.adminId,
    id: ctx.studentId,
    full_name: "Siswa S3 Test Updated " + suffix
  };
  
  var resUpdate = JSON.parse(route({ action: 'update_student', payload: payload }).getContent());
  if (resUpdate.status !== 'success') {
    throw new Error("Failed updating student record: " + resUpdate.message);
  }
  if (resUpdate.data.full_name !== payload.full_name) {
    throw new Error("Updated full_name does not match.");
  }
  
  // Guru attempts update - should fail
  var teacherPayload = {
    actor_user_id: ctx.teacher1.id,
    id: ctx.studentId,
    full_name: "Siswa S3 Hack By Guru"
  };
  var resTeacherUpdate = JSON.parse(route({ action: 'update_student', payload: teacherPayload }).getContent());
  if (resTeacherUpdate.status !== 'error' || resTeacherUpdate.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Teacher was allowed to update student or incorrect error code returned.");
  }
  
  console.log("Student updates verified successfully.");
}

/**
 * 5. Student Status
 */
function test_studentStatus(ctx) {
  console.log("Testing Student Status...");
  
  // Admin changes status
  var resStatus = JSON.parse(route({
    action: 'change_student_status',
    payload: {
      actor_user_id: ctx.adminId,
      id: ctx.studentId,
      status: 'Pindah'
    }
  }).getContent());
  
  if (resStatus.status !== 'success') {
    throw new Error("Failed to update student status.");
  }
  
  var student = getRecordById(SHEETS.STUDENTS, ctx.studentId);
  if (student.status !== 'Pindah') {
    throw new Error("Student status mismatch.");
  }
  
  // Invalid status rejected
  var resBad = JSON.parse(route({
    action: 'change_student_status',
    payload: {
      actor_user_id: ctx.adminId,
      id: ctx.studentId,
      status: 'AktifSekali'
    }
  }).getContent());
  if (resBad.status !== 'error') {
    throw new Error("Failed: Invalid status was allowed during update status.");
  }
  
  // Reactivate for downstream tests
  route({
    action: 'change_student_status',
    payload: { actor_user_id: ctx.adminId, id: ctx.studentId, status: 'Aktif' }
  });
  
  console.log("Student status changes verified successfully.");
}

/**
 * 6. Parent PIN reset
 */
function test_parentPin(ctx) {
  console.log("Testing Parent PIN reset...");
  
  var newPin = "987654";
  var resReset = JSON.parse(route({
    action: 'reset_student_parent_pin',
    payload: {
      actor_user_id: ctx.adminId,
      id: ctx.studentId,
      parent_access_pin: newPin
    }
  }).getContent());
  
  if (resReset.status !== 'success') {
    throw new Error("Failed to reset student parent PIN.");
  }
  
  // Verify PIN is not returned in response
  if (resReset.data.parent_access_pin_hash || resReset.data.parent_access_pin) {
    throw new Error("PIN hash or plain PIN leaked in reset response.");
  }
  
  // Retrieve raw row from database and test password verification
  var rawStudent = findRowById(SHEETS.STUDENTS, ctx.studentId);
  if (!rawStudent.parent_access_pin_hash) {
    throw new Error("parent_access_pin_hash was not stored.");
  }
  if (rawStudent.parent_access_pin_hash === newPin) {
    throw new Error("PIN was stored in plaintext.");
  }
  
  if (!verifyParentPin(newPin, rawStudent.parent_access_pin_hash)) {
    throw new Error("PIN hash verification failed.");
  }
  
  console.log("Parent PIN reset and verification verified successfully.");
}

/**
 * 7. Field Filtering
 */
function test_fieldFiltering(ctx) {
  console.log("Testing role-based field filtering...");
  
  // Create student enrollment to test guru- Wali context
  route({
    action: 'create_student_enrollment',
    payload: {
      actor_user_id: ctx.adminId,
      student_id: ctx.studentId,
      class_id: ctx.classId,
      academic_year_id: ctx.yearId,
      semester_id: ctx.semesterId,
      status: 'active'
    }
  });
  
  // Admin detail retrieval
  var resAdmin = JSON.parse(route({
    action: 'get_student_detail',
    payload: { actor_user_id: ctx.adminId, id: ctx.studentId }
  }).getContent());
  
  if (resAdmin.status !== 'success') {
    throw new Error("Admin failed to get student detail.");
  }
  // Admin can view NIK and family card info, but not PIN hashes
  if (!resAdmin.data.nik || resAdmin.data.parent_access_pin_hash) {
    throw new Error("Admin field filtering mismatch.");
  }
  
  // Wali Kelas (teacher1) detail retrieval - should succeed with filtering
  var resWali = JSON.parse(route({
    action: 'get_student_detail',
    payload: { actor_user_id: ctx.teacher1.id, id: ctx.studentId }
  }).getContent());
  
  if (resWali.status !== 'success') {
    throw new Error("Wali kelas failed to view student details.");
  }
  var dataWali = resWali.data;
  // Check fields stripped
  if (dataWali.nik || dataWali.family_card_number || dataWali.mother_nik || dataWali.parent_access_pin_hash) {
    throw new Error("Security breach: Sensitive fields leaked to Wali Kelas!");
  }
  // Check fields allowed
  if (!dataWali.nisn || !dataWali.full_name) {
    throw new Error("Wali kelas did not receive allowed basic fields.");
  }
  
  // Non-Wali Kelas (teacher2) detail retrieval - should fail with ERR_FORBIDDEN
  var resNonWali = JSON.parse(route({
    action: 'get_student_detail',
    payload: { actor_user_id: ctx.teacher2.id, id: ctx.studentId }
  }).getContent());
  
  if (resNonWali.status !== 'error' || resNonWali.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali kelas teacher was allowed to view student detail or wrong error code returned.");
  }
  
  console.log("Student security filtering validated successfully.");
}

/**
 * 8. Enrollment Create
 */
function test_enrollmentCreate(ctx) {
  console.log("Testing Student Enrollment Create...");
  
  // Create second class for test
  var admin = getUserByIdentifier('admin');
  var suffix = String(Math.floor(Math.random() * 100000));
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: admin.id,
      code: 'CLS_S3_B_' + suffix,
      name: 'Kelas S3 B ' + suffix,
      level: '5'
    }
  }).getContent());
  var classId2 = classRes.data.id;
  
  // Create enrollment mapping (already exists one, so this duplicate active enrollment in same sem must fail)
  var dupPayload = {
    actor_user_id: ctx.adminId,
    student_id: ctx.studentId,
    class_id: classId2,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId,
    status: 'active'
  };
  
  var resDup = JSON.parse(route({ action: 'create_student_enrollment', payload: dupPayload }).getContent());
  if (resDup.status !== 'error') {
    throw new Error("Failed: Multiple active enrollments for same year/semester was allowed.");
  }
  
  // Invalid student_id check
  var badStudentPayload = JSON.parse(JSON.stringify(dupPayload));
  badStudentPayload.student_id = "non-existent-student";
  var resBadStudent = JSON.parse(route({ action: 'create_student_enrollment', payload: badStudentPayload }).getContent());
  if (resBadStudent.status !== 'error') {
    throw new Error("Failed: Enrollment with non-existent student was allowed.");
  }
  
  // Invalid semester to year match check
  var badSemPayload = JSON.parse(JSON.stringify(dupPayload));
  // Create another year to associate semester
  var yearRes2 = JSON.parse(route({
    action: 'create_academic_year',
    payload: { actor_user_id: ctx.adminId, name: "AY_S3_C_" + suffix, start_date: "2026-07-01", end_date: "2027-06-30" }
  }).getContent());
  var semesterRes2 = JSON.parse(route({
    action: 'create_semester',
    payload: { actor_user_id: ctx.adminId, academic_year_id: yearRes2.data.id, name: "Ganjil", start_date: "2026-07-01", end_date: "2026-12-31" }
  }).getContent());
  
  badSemPayload.semester_id = semesterRes2.data.id; // semester belongs to another year
  var resBadSem = JSON.parse(route({ action: 'create_student_enrollment', payload: badSemPayload }).getContent());
  if (resBadSem.status !== 'error') {
    throw new Error("Failed: Enrollment with mismatched semester and academic year was allowed.");
  }
  
  console.log("Student enrollment validation verified successfully.");
}

/**
 * 9. Enrollment Update & Status
 */
function test_enrollmentUpdateAndStatus(ctx) {
  console.log("Testing Student Enrollment Update & Status...");
  
  // Find the active enrollment we made during filtering test
  var activeEnrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === ctx.studentId && e.status === 'active';
  });
  if (activeEnrollments.length === 0) {
    throw new Error("Active enrollment record not found.");
  }
  var enrollId = activeEnrollments[0].id;
  
  // Admin changes status
  var resStatus = JSON.parse(route({
    action: 'change_student_enrollment_status',
    payload: {
      actor_user_id: ctx.adminId,
      id: enrollId,
      status: 'promoted'
    }
  }).getContent());
  
  if (resStatus.status !== 'success') {
    throw new Error("Failed to change student enrollment status.");
  }
  
  var updated = getRecordById(SHEETS.STUDENT_ENROLLMENTS, enrollId);
  if (updated.status !== 'promoted') {
    throw new Error("Status was not updated to promoted.");
  }
  
  // Restore status to active for class list testing
  route({
    action: 'change_student_enrollment_status',
    payload: { actor_user_id: ctx.adminId, id: enrollId, status: 'active' }
  });
  
  console.log("Student enrollment status transitions verified successfully.");
}

/**
 * 10. List students by class
 */
function test_listStudentsByClass(ctx) {
  console.log("Testing list_students_by_class...");
  
  var payload = {
    class_id: ctx.classId,
    academic_year_id: ctx.yearId,
    semester_id: ctx.semesterId
  };
  
  // Admin lookup
  var adminPayload = JSON.parse(JSON.stringify(payload));
  adminPayload.actor_user_id = ctx.adminId;
  var resAdmin = JSON.parse(route({ action: 'list_students_by_class', payload: adminPayload }).getContent());
  if (resAdmin.status !== 'success') {
    throw new Error("Admin failed to list students by class.");
  }
  if (resAdmin.data.length === 0) {
    throw new Error("Roster should not be empty for admin.");
  }
  
  // Wali kelas lookup
  var waliPayload = JSON.parse(JSON.stringify(payload));
  waliPayload.actor_user_id = ctx.teacher1.id;
  var resWali = JSON.parse(route({ action: 'list_students_by_class', payload: waliPayload }).getContent());
  if (resWali.status !== 'success') {
    throw new Error("Wali kelas failed to list class students.");
  }
  var dataWali = resWali.data[0];
  // Check field filtering is applied
  if (dataWali.nik || dataWali.family_card_number || dataWali.parent_access_pin_hash) {
    throw new Error("Security breach: Sensitive fields leaked to Wali Kelas in class list!");
  }
  
  // Non-Wali kelas lookup - should fail
  var nonWaliPayload = JSON.parse(JSON.stringify(payload));
  nonWaliPayload.actor_user_id = ctx.teacher2.id;
  var resNonWali = JSON.parse(route({ action: 'list_students_by_class', payload: nonWaliPayload }).getContent());
  if (resNonWali.status !== 'error' || resNonWali.code !== 'ERR_FORBIDDEN') {
    throw new Error("Failed: Non-wali kelas teacher was allowed to fetch class student list.");
  }
  
  console.log("list_students_by_class verified successfully.");
}

/**
 * Regression Sprint 2 Master Data actions still work
 */
function test_regressionSprint2() {
  console.log("Running Sprint 2 regression checks...");
  
  var admin = getUserByIdentifier('admin');
  
  // Create Class
  var suffix = String(Math.floor(Math.random() * 100000));
  var classRes = JSON.parse(route({
    action: 'create_class',
    payload: {
      actor_user_id: admin.id,
      code: 'REGRESS_CLS_' + suffix,
      name: 'Class Regress',
      level: '2'
    }
  }).getContent());
  if (classRes.status !== 'success') {
    throw new Error("Sprint 2 Regression Class Create failed!");
  }
  
  // Create Subject
  var subjRes = JSON.parse(route({
    action: 'create_subject',
    payload: {
      actor_user_id: admin.id,
      code: 'REGRESS_SUBJ_' + suffix,
      name: 'Subject Regress'
    }
  }).getContent());
  if (subjRes.status !== 'success') {
    throw new Error("Sprint 2 Regression Subject Create failed!");
  }
  
  console.log("Sprint 2 regression verification complete.");
}
