/**
 * UserManagementTests.gs
 * Automated QA Verification Suite for Sprint UM-2 (User Management Backend & Security).
 */

function test_userManagementBackend_UM2() {
  console.log("=== STARTING SPRINT UM-2 USER MANAGEMENT QA TEST SUITE ===");
  
  // 1. Reset state
  setupDatabase();
  seedInitialData();
  
  // 2. Resolve default Administrator
  var defaultAdmin = getUserByIdentifier('admin'); // From seed
  if (!defaultAdmin) {
    throw new Error("Seed failed: default admin not found.");
  }
  
  // Create an Operator (role: admin) and a Teacher (role: teacher) to act as testers
  var actorSystem = { id: 'system_test', name: 'Test Runner', role: ROLES.ADMINISTRATOR };
  
  var opUser = createRecord(SHEETS.USERS, {
    name: 'Operator QA',
    email: 'operator.qa@example.com',
    username: 'operatorqa',
    password_hash: hashPassword('Operator123!'),
    role: ROLES.ADMIN,
    status: STATUS.ACTIVE,
    failed_login_attempts: 0,
    locked_until: '',
    last_login_at: ''
  }, actorSystem);

  var teacherUser = createRecord(SHEETS.USERS, {
    name: 'Teacher QA',
    email: 'teacher.qa@example.com',
    username: 'teacherqa',
    password_hash: hashPassword('Teacher123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE,
    failed_login_attempts: 0,
    locked_until: '',
    last_login_at: ''
  }, actorSystem);

  // Generate tokens for Admin, Operator, and Teacher
  var adminSession = createStaffSession(defaultAdmin);
  var adminToken = adminSession.token;
  
  var opSession = createStaffSession(opUser);
  var opToken = opSession.token;
  
  var teacherSession = createStaffSession(teacherUser);
  var teacherToken = teacherSession.token;

  var suffix = new Date().getTime() + "_" + Math.floor(Math.random() * 1000);

  // -------------------------------------------------------------
  // QA A: Administrator dapat membuat user teacher
  // -------------------------------------------------------------
  console.log("Running QA A: Administrator creates teacher user...");
  var payloadTeacher = {
    name: "Guru Baru QA " + suffix,
    username: "gurubaruqa" + suffix,
    email: "gurubaruqa" + suffix + "@example.com",
    password: "Password123!",
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE,
    gender: "P",
    nip: "12345",
    nuptk: "67890",
    address: "Bandung",
    position: "Wali Kelas 1"
  };
  
  var resCreateTeacher = JSON.parse(route({
    action: 'create_user',
    token: adminToken,
    payload: payloadTeacher
  }).getContent());
  
  if (resCreateTeacher.status !== 'success') {
    throw new Error("QA A Failed: Admin could not create teacher: " + resCreateTeacher.message);
  }
  
  var createdTeacher = resCreateTeacher.data;
  if (createdTeacher.password_hash) {
    throw new Error("QA A Failed: password_hash was leaked in API response.");
  }
  
  // Verify rows are in DB
  var dbTeacherUser = getRecordById(SHEETS.USERS, createdTeacher.id);
  if (!dbTeacherUser || dbTeacherUser.password_hash !== hashPassword('Password123!')) {
    throw new Error("QA A Failed: Teacher user record or password_hash mismatch in db.");
  }
  
  var dbTeacherProfile = createdTeacher.teacher_profile;
  if (!dbTeacherProfile || dbTeacherProfile.user_id !== createdTeacher.id || dbTeacherProfile.full_name !== payloadTeacher.name) {
    throw new Error("QA A Failed: Associated teacher profile row not created or mismatch.");
  }
  console.log("QA A Passed.");

  // -------------------------------------------------------------
  // QA B: Administrator dapat membuat user admin
  // -------------------------------------------------------------
  console.log("Running QA B: Administrator creates admin user...");
  var payloadAdmin = {
    name: "Admin Baru QA " + suffix,
    username: "adminbaruqa" + suffix,
    email: "adminbaruqa" + suffix + "@example.com",
    password: "Password123!",
    role: ROLES.ADMIN,
    status: STATUS.ACTIVE
  };
  
  var resCreateAdmin = JSON.parse(route({
    action: 'create_user',
    token: adminToken,
    payload: payloadAdmin
  }).getContent());
  
  if (resCreateAdmin.status !== 'success') {
    throw new Error("QA B Failed: Admin could not create operator user: " + resCreateAdmin.message);
  }
  
  var createdAdmin = resCreateAdmin.data;
  if (createdAdmin.role !== ROLES.ADMIN || createdAdmin.status !== STATUS.ACTIVE) {
    throw new Error("QA B Failed: Operator user status/role mismatch.");
  }
  console.log("QA B Passed.");

  // -------------------------------------------------------------
  // QA C: Admin/Operator tidak boleh create user
  // -------------------------------------------------------------
  console.log("Running QA C: Admin/Operator is blocked from creating user...");
  var resOpCreate = JSON.parse(route({
    action: 'create_user',
    token: opToken,
    payload: payloadTeacher
  }).getContent());
  
  if (resOpCreate.status !== 'error' || resOpCreate.code !== 'ERR_FORBIDDEN') {
    throw new Error("QA C Failed: Operator was not blocked or returned incorrect status: " + JSON.stringify(resOpCreate));
  }
  console.log("QA C Passed.");

  // -------------------------------------------------------------
  // QA D: Teacher tidak boleh create user
  // -------------------------------------------------------------
  console.log("Running QA D: Teacher is blocked from creating user...");
  var resTeacherCreate = JSON.parse(route({
    action: 'create_user',
    token: teacherToken,
    payload: payloadTeacher
  }).getContent());
  
  if (resTeacherCreate.status !== 'error' || resTeacherCreate.code !== 'ERR_FORBIDDEN') {
    throw new Error("QA D Failed: Teacher was not blocked or returned incorrect status: " + JSON.stringify(resTeacherCreate));
  }
  console.log("QA D Passed.");

  // -------------------------------------------------------------
  // QA E: Username duplicate ditolak
  // -------------------------------------------------------------
  console.log("Running QA E: Duplicate username is rejected...");
  var payloadDupUser = JSON.parse(JSON.stringify(payloadTeacher));
  payloadDupUser.email = "another.email@example.com"; // Unique email, duplicate username
  
  var resDupUser = JSON.parse(route({
    action: 'create_user',
    token: adminToken,
    payload: payloadDupUser
  }).getContent());
  
  if (resDupUser.status !== 'error' || resDupUser.message.indexOf("registered") === -1) {
    throw new Error("QA E Failed: Duplicate username was allowed or wrong error: " + JSON.stringify(resDupUser));
  }
  console.log("QA E Passed.");

  // -------------------------------------------------------------
  // QA F: Email duplicate ditolak
  // -------------------------------------------------------------
  console.log("Running QA F: Duplicate email is rejected...");
  var payloadDupEmail = JSON.parse(JSON.stringify(payloadTeacher));
  payloadDupEmail.username = "anotherusername" + suffix; // Unique username, duplicate email
  
  var resDupEmail = JSON.parse(route({
    action: 'create_user',
    token: adminToken,
    payload: payloadDupEmail
  }).getContent());
  
  if (resDupEmail.status !== 'error' || resDupEmail.message.indexOf("registered") === -1) {
    throw new Error("QA F Failed: Duplicate email was allowed or wrong error: " + JSON.stringify(resDupEmail));
  }
  console.log("QA F Passed.");

  // -------------------------------------------------------------
  // QA G: Administrator dapat reset password user lain
  // -------------------------------------------------------------
  console.log("Running QA G: Administrator resets another user's password...");
  // Let's set some mock lock/attempts first
  updateRecord(SHEETS.USERS, createdTeacher.id, {
    failed_login_attempts: 3,
    locked_until: new Date(new Date().getTime() + 60000).toISOString()
  }, actorSystem);
  
  var resReset = JSON.parse(route({
    action: 'reset_user_password',
    token: adminToken,
    payload: {
      id: createdTeacher.id,
      new_password: "NewPassword123!"
    }
  }).getContent());
  
  if (resReset.status !== 'success') {
    throw new Error("QA G Failed: Reset password action failed: " + resReset.message);
  }
  
  var dbTeacherReset = getRecordById(SHEETS.USERS, createdTeacher.id);
  if (dbTeacherReset.password_hash !== hashPassword('NewPassword123!')) {
    throw new Error("QA G Failed: password_hash was not updated to new value.");
  }
  if (parseInt(dbTeacherReset.failed_login_attempts) !== 0 || dbTeacherReset.locked_until) {
    throw new Error("QA G Failed: Lockout states were not cleared. Failed attempts: " + dbTeacherReset.failed_login_attempts + ", Locked until: " + dbTeacherReset.locked_until);
  }
  
  // Verify password hash is not in audit log description or values
  var resetLogs = readAuditLogRows().filter(function(log) {
    return log.action === 'reset_password' && log.entity_id === createdTeacher.id;
  });
  if (resetLogs.length === 0) {
    throw new Error("QA G Failed: Audit log for reset_password was not written.");
  }
  var logContent = JSON.stringify(resetLogs[0]);
  if (logContent.indexOf(hashPassword('NewPassword123!')) !== -1 || logContent.indexOf('NewPassword123!') !== -1) {
    throw new Error("QA G Failed: Sensitive password/hash leaked in reset_password audit log.");
  }
  console.log("QA G Passed.");

  // -------------------------------------------------------------
  // QA H: User dapat change own password dengan password lama benar
  // -------------------------------------------------------------
  console.log("Running QA H: Change own password with correct old password...");
  var resChangeOwn = JSON.parse(route({
    action: 'change_own_password',
    token: teacherToken,
    payload: {
      old_password: 'Teacher123!',
      new_password: 'NewTeacher123!'
    }
  }).getContent());
  
  if (resChangeOwn.status !== 'success') {
    throw new Error("QA H Failed: Change own password failed: " + resChangeOwn.message);
  }
  
  var dbTeacherSelf = getRecordById(SHEETS.USERS, teacherUser.id);
  if (dbTeacherSelf.password_hash !== hashPassword('NewTeacher123!')) {
    throw new Error("QA H Failed: password_hash not updated on self password change.");
  }
  
  teacherUser = dbTeacherSelf;
  console.log("QA H Passed.");

  // -------------------------------------------------------------
  // QA I: Change own password dengan password lama salah ditolak
  // -------------------------------------------------------------
  console.log("Running QA I: Change own password with incorrect old password...");
  var resChangeOwnWrong = JSON.parse(route({
    action: 'change_own_password',
    token: teacherToken,
    payload: {
      old_password: 'WrongPassword!',
      new_password: 'AnotherNew123!'
    }
  }).getContent());
  
  if (resChangeOwnWrong.status !== 'error' || resChangeOwnWrong.message.indexOf("password") === -1) {
    throw new Error("QA I Failed: Action did not fail or returned wrong error: " + JSON.stringify(resChangeOwnWrong));
  }
  console.log("QA I Passed.");

  // -------------------------------------------------------------
  // QA J: User tidak bisa reset password dirinya sendiri via reset_user_password
  // -------------------------------------------------------------
  console.log("Running QA J: User cannot reset own password via reset_user_password...");
  var resSelfReset = JSON.parse(route({
    action: 'reset_user_password',
    token: adminToken,
    payload: {
      id: defaultAdmin.id,
      new_password: 'NewAdmin123!'
    }
  }).getContent());
  
  if (resSelfReset.status !== 'error' || resSelfReset.message.indexOf("own password") === -1) {
    throw new Error("QA J Failed: Admin was allowed to reset own password via reset_user_password: " + JSON.stringify(resSelfReset));
  }
  console.log("QA J Passed.");

  // -------------------------------------------------------------
  // QA K: Tidak bisa menonaktifkan administrator aktif terakhir
  // -------------------------------------------------------------
  console.log("Running QA K: Deactivating last active Administrator is blocked...");
  var mockAdminActor = { id: 'another_admin_id', name: 'Another Admin', role: ROLES.ADMINISTRATOR };
  try {
    setUserStatus(mockAdminActor, defaultAdmin.id, STATUS.INACTIVE);
    throw new Error("QA K Failed: Deactivating last administrator was allowed.");
  } catch (e) {
    if (e.message.indexOf("last active Administrator") === -1) {
      throw new Error("QA K Failed: Expected last administrator error, got: " + e.message);
    }
  }
  console.log("QA K Passed.");

  // -------------------------------------------------------------
  // QA L: Tidak bisa mengubah role administrator aktif terakhir
  // -------------------------------------------------------------
  console.log("Running QA L: Changing role is blocked on update...");
  var resChangeRole = JSON.parse(route({
    action: 'update_user',
    token: adminToken,
    payload: {
      id: defaultAdmin.id,
      role: ROLES.TEACHER
    }
  }).getContent());
  
  if (resChangeRole.status !== 'error' || resChangeRole.message.indexOf("Role modifications") === -1) {
    throw new Error("QA L Failed: Changing role on update was allowed: " + JSON.stringify(resChangeRole));
  }
  console.log("QA L Passed.");

  // -------------------------------------------------------------
  // QA M: set_user_status teacher inactive juga menonaktifkan teacher_profile
  // -------------------------------------------------------------
  console.log("Running QA M: Deactivating teacher deactivates teacher_profile...");
  var resDeactivateTeacher = JSON.parse(route({
    action: 'set_user_status',
    token: adminToken,
    payload: {
      id: createdTeacher.id,
      status: STATUS.INACTIVE
    }
  }).getContent());
  
  if (resDeactivateTeacher.status !== 'success') {
    throw new Error("QA M Failed: Deactivating teacher failed: " + resDeactivateTeacher.message);
  }
  
  var dbTeacherDeactivated = getRecordById(SHEETS.USERS, createdTeacher.id);
  if (dbTeacherDeactivated.status !== STATUS.INACTIVE) {
    throw new Error("QA M Failed: User status was not set to inactive.");
  }
  
  var dbProfileDeactivated = resDeactivateTeacher.data.teacher_profile;
  if (!dbProfileDeactivated || dbProfileDeactivated.status !== STATUS.INACTIVE) {
    throw new Error("QA M Failed: Associated teacher profile status was not synced to inactive.");
  }
  console.log("QA M Passed.");

  // -------------------------------------------------------------
  // QA N: Audit log redaction
  // -------------------------------------------------------------
  console.log("Running QA N: Audit log redaction checks...");
  writeAuditLog({
    user_id: 'test',
    user_name: 'test',
    user_role: 'system',
    action: 'test_redact',
    entity_type: 'users',
    entity_id: 'test_123',
    old_value: JSON.stringify({ password_hash: 'secret_hash', pin_hash: '123456' }),
    new_value: JSON.stringify({ password_hash: 'new_secret_hash', token_hash: 'abc' }),
    description: 'Updated password_hash to abc and token_hash to xyz'
  });
  
  var mockLogs = readAuditLogRows().filter(function(l) {
    return l.action === 'test_redact';
  });
  if (mockLogs.length === 0) {
    throw new Error("QA N Failed: Mock audit log was not found.");
  }
  var log = mockLogs[0];
  if (log.old_value.indexOf('secret_hash') !== -1 || log.old_value.indexOf('123456') !== -1) {
    throw new Error("QA N Failed: old_value sensitive fields were not redacted: " + log.old_value);
  }
  if (log.new_value.indexOf('new_secret_hash') !== -1 || log.new_value.indexOf('abc') !== -1) {
    throw new Error("QA N Failed: new_value sensitive fields were not redacted: " + log.new_value);
  }
  if (log.description.indexOf('abc') !== -1 || log.description.indexOf('xyz') !== -1) {
    throw new Error("QA N Failed: description sensitive fields were not redacted: " + log.description);
  }
  console.log("QA N Passed.");

  // -------------------------------------------------------------
  // QA O: list_users tidak mengembalikan password_hash
  // -------------------------------------------------------------
  console.log("Running QA O: list_users does not return password_hash...");
  var resList = JSON.parse(route({
    action: 'list_users',
    token: adminToken,
    payload: {}
  }).getContent());
  
  if (resList.status !== 'success') {
    throw new Error("QA O Failed: list_users failed: " + resList.message);
  }
  
  var usersList = resList.data;
  usersList.forEach(function(u) {
    if (u.password_hash || u.failed_login_attempts !== undefined || u.locked_until !== undefined) {
      throw new Error("QA O Failed: Leakage in list_users response. Returned object: " + JSON.stringify(u));
    }
  });
  console.log("QA O Passed.");

  console.log("=== SPRINT UM-2 USER MANAGEMENT QA TEST SUITE PASSED ===");
}
