/**
 * Sprint 11.5A security QA for staff session token enforcement.
 * Run test_runSprint115AQA() from the Apps Script editor after the database exists.
 */

function test_runSprint115AQA() {
  console.log("STARTING SPRINT 11.5A SECURITY QA");
  setupDatabase();
  seedInitialData();
  
  var ctx = setupSprint115ATestContext();
  
  test_sprint115AValidLogin(ctx);
  test_sprint115AInvalidLoginStillFails();
  test_sprint115AProtectedWithoutToken();
  test_sprint115AProtectedWithFakeToken();
  test_sprint115AExpiredAndRevokedTokens(ctx);
  test_sprint115AGuruOwnClassAccess(ctx);
  test_sprint115AGuruOtherClassDenied(ctx);
  test_sprint115AActorUserIdBypassDenied(ctx);
  test_sprint115AActorUserIdMismatchDenied(ctx);
  test_sprint115AGetCurrentUserTokenOnly(ctx);
  test_sprint115AGetCurrentUserIdorDenied(ctx);
  test_sprint115ABootstrapDenied(ctx);
  test_sprint115ACompletenessGuards(ctx);
  test_sprint115ASmokeRegression(ctx);
  
  console.log("SPRINT 11.5A SECURITY QA PASSED");
}

function setupSprint115ATestContext() {
  var adminLogin = test_sprint115ALogin(DEFAULT_ADMIN.username, DEFAULT_ADMIN.password);
  var admin = adminLogin.data.user;
  var adminToken = adminLogin.data.token;
  
  var teacherUsername = 's115a_guru';
  var teacherUser = listRecords(SHEETS.USERS, function(u) { return u.username === teacherUsername; })[0];
  if (!teacherUser) {
    teacherUser = createRecord(SHEETS.USERS, {
      name: 'S115A Guru',
      email: 's115a_guru@example.com',
      username: teacherUsername,
      password_hash: hashPassword('Guru123!'),
      role: ROLES.TEACHER,
      phone: '',
      status: STATUS.ACTIVE,
      failed_login_attempts: 0,
      locked_until: '',
      last_login_at: ''
    }, admin);
  }
  
  var teacherLogin = test_sprint115ALogin(teacherUser.username, 'Guru123!');
  var teacherToken = teacherLogin.data.token;
  
  var yearName = 'S115A Year';
  var year = listAcademicYears().filter(function(y) { return y.name === yearName; })[0];
  if (!year) {
    year = createAcademicYear({
      name: yearName,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    }, admin);
  }
  
  var sem = listSemesters().filter(function(s) { return s.academic_year_id === year.id && s.name === 'Ganjil'; })[0];
  if (!sem) {
    sem = createSemester({
      academic_year_id: year.id,
      name: 'Ganjil',
      start_date: '2026-01-01',
      end_date: '2026-06-30'
    }, admin);
  }
  
  var ownClassCode = 'S115A';
  var ownClass = listClasses().filter(function(c) { return c.code === ownClassCode; })[0];
  if (!ownClass) {
    ownClass = createClass({ code: ownClassCode, name: 'S115A Own', level: '1' }, admin);
  }
  
  var otherClassCode = 'S115B';
  var otherClass = listClasses().filter(function(c) { return c.code === otherClassCode; })[0];
  if (!otherClass) {
    otherClass = createClass({ code: otherClassCode, name: 'S115A Other', level: '2' }, admin);
  }
  
  var activeAssignments = listClassTeacherAssignments().filter(function(item) {
    return item.class_id === ownClass.id &&
           item.teacher_user_id === teacherUser.id &&
           item.academic_year_id === year.id &&
           item.semester_id === sem.id &&
           item.status === STATUS.ACTIVE;
  });
  if (activeAssignments.length === 0) {
    assignClassTeacher({
      class_id: ownClass.id,
      teacher_user_id: teacherUser.id,
      academic_year_id: year.id,
      semester_id: sem.id,
      effective_from: '2026-01-01'
    }, admin);
  }
  
  return {
    admin: admin,
    adminToken: adminToken,
    teacher: teacherUser,
    teacherToken: teacherToken,
    year: year,
    sem: sem,
    ownClass: ownClass,
    otherClass: otherClass
  };
}

function test_sprint115ALogin(identifier, password) {
  var res = test_sprint115ARoute('login', {
    identifier: identifier,
    password: password
  });
  test_sprint115AAssertSuccess(res, 'login');
  if (!res.data.user || !res.data.token || !res.data.expires_at) {
    throw new Error("Login response must include user, token, and expires_at.");
  }
  return res;
}

function test_sprint115AValidLogin(ctx) {
  var res = test_sprint115ALogin(DEFAULT_ADMIN.username, DEFAULT_ADMIN.password);
  if (res.data.user.id !== ctx.admin.id) {
    throw new Error("Valid login returned unexpected user.");
  }
}

function test_sprint115AInvalidLoginStillFails() {
  var res = test_sprint115ARoute('login', {
    identifier: DEFAULT_ADMIN.username,
    password: 'wrong-password'
  });
  test_sprint115AAssertError(res, 'BAD_REQUEST', 'invalid login');
}

function test_sprint115AProtectedWithoutToken() {
  var res = test_sprint115ARoute('list_classes', {});
  test_sprint115AAssertError(res, 'ERR_UNAUTHORIZED', 'protected without token');
}

function test_sprint115AProtectedWithFakeToken() {
  var res = test_sprint115ARouteWithToken('list_classes', {}, 'fake-token');
  test_sprint115AAssertError(res, 'ERR_UNAUTHORIZED', 'protected fake token');
}

function test_sprint115AExpiredAndRevokedTokens(ctx) {
  var expiredToken = 'expired_' + new Date().getTime();
  appendRow(SHEETS.STAFF_SESSIONS, {
    user_id: ctx.admin.id,
    token_hash: hashStaffSessionToken(expiredToken),
    issued_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2026-01-01T01:00:00.000Z',
    revoked_at: '',
    last_seen_at: '',
    ip_address: '',
    user_agent: ''
  });
  var expiredRes = test_sprint115ARouteWithToken('list_classes', {}, expiredToken);
  test_sprint115AAssertError(expiredRes, 'ERR_UNAUTHORIZED', 'expired token');
  
  var revokedToken = 'revoked_' + new Date().getTime();
  var future = new Date();
  future.setHours(future.getHours() + 1);
  appendRow(SHEETS.STAFF_SESSIONS, {
    user_id: ctx.admin.id,
    token_hash: hashStaffSessionToken(revokedToken),
    issued_at: nowIso(),
    expires_at: future.toISOString(),
    revoked_at: nowIso(),
    last_seen_at: '',
    ip_address: '',
    user_agent: ''
  });
  var revokedRes = test_sprint115ARouteWithToken('list_classes', {}, revokedToken);
  test_sprint115AAssertError(revokedRes, 'ERR_UNAUTHORIZED', 'revoked token');
}

function test_sprint115AGuruOwnClassAccess(ctx) {
  var res = test_sprint115ARouteWithToken('get_class_monitoring_dashboard', {
    class_id: ctx.ownClass.id,
    academic_year_id: ctx.year.id,
    semester_id: ctx.sem.id
  }, ctx.teacherToken);
  test_sprint115AAssertSuccess(res, 'guru own class dashboard');
}

function test_sprint115AGuruOtherClassDenied(ctx) {
  var res = test_sprint115ARouteWithToken('get_class_monitoring_dashboard', {
    class_id: ctx.otherClass.id,
    academic_year_id: ctx.year.id,
    semester_id: ctx.sem.id
  }, ctx.teacherToken);
  test_sprint115AAssertError(res, 'ERR_FORBIDDEN', 'guru other class dashboard');
}

function test_sprint115AActorUserIdBypassDenied(ctx) {
  var res = test_sprint115ARoute('list_classes', { actor_user_id: ctx.admin.id });
  test_sprint115AAssertError(res, 'ERR_UNAUTHORIZED', 'actor_user_id without token');
}

function test_sprint115AActorUserIdMismatchDenied(ctx) {
  var res = test_sprint115ARouteWithToken('list_classes', { actor_user_id: ctx.admin.id }, ctx.teacherToken);
  test_sprint115AAssertError(res, 'ERR_FORBIDDEN', 'teacher token with admin actor_user_id');
}

function test_sprint115AGetCurrentUserTokenOnly(ctx) {
  var res = test_sprint115ARouteWithToken('get_current_user', {}, ctx.teacherToken);
  test_sprint115AAssertSuccess(res, 'get_current_user token');
  if (res.data.user.id !== ctx.teacher.id) {
    throw new Error("get_current_user returned a user other than the token actor.");
  }
}

function test_sprint115AGetCurrentUserIdorDenied(ctx) {
  var res = test_sprint115ARoute('get_current_user', { user_id: DEFAULT_ADMIN.username });
  test_sprint115AAssertError(res, 'ERR_UNAUTHORIZED', 'get_current_user without token');
  
  var tokenRes = test_sprint115ARouteWithToken('get_current_user', { user_id: ctx.admin.id }, ctx.teacherToken);
  test_sprint115AAssertError(tokenRes, 'ERR_FORBIDDEN', 'get_current_user with user_id');
}

function test_sprint115ABootstrapDenied(ctx) {
  var noTokenSetup = test_sprint115ARoute('setup_database', {});
  test_sprint115AAssertError(noTokenSetup, 'ERR_UNAUTHORIZED', 'setup without token');
  
  var adminSetup = test_sprint115ARouteWithToken('setup_database', {}, ctx.adminToken);
  test_sprint115AAssertError(adminSetup, 'ERR_FORBIDDEN', 'setup admin bootstrap disabled');
  
  var noTokenSeed = test_sprint115ARoute('seed_initial_data', {});
  test_sprint115AAssertError(noTokenSeed, 'ERR_UNAUTHORIZED', 'seed without token');
}

function test_sprint115ACompletenessGuards(ctx) {
  var ownAcademic = test_sprint115ARouteWithToken('calculate_academic_completeness', {
    class_id: ctx.ownClass.id,
    academic_year_id: ctx.year.id,
    semester_id: ctx.sem.id
  }, ctx.teacherToken);
  test_sprint115AAssertSuccess(ownAcademic, 'academic completeness own class');
  
  var otherAcademic = test_sprint115ARouteWithToken('calculate_academic_completeness', {
    class_id: ctx.otherClass.id,
    academic_year_id: ctx.year.id,
    semester_id: ctx.sem.id
  }, ctx.teacherToken);
  test_sprint115AAssertError(otherAcademic, 'ERR_FORBIDDEN', 'academic completeness other class');
  
  var ownCulture = test_sprint115ARouteWithToken('calculate_culture_completeness', {
    class_id: ctx.ownClass.id,
    academic_year_id: ctx.year.id,
    semester_id: ctx.sem.id
  }, ctx.teacherToken);
  test_sprint115AAssertSuccess(ownCulture, 'culture completeness own class');
  
  var otherCulture = test_sprint115ARouteWithToken('calculate_culture_completeness', {
    class_id: ctx.otherClass.id,
    academic_year_id: ctx.year.id,
    semester_id: ctx.sem.id
  }, ctx.teacherToken);
  test_sprint115AAssertError(otherCulture, 'ERR_FORBIDDEN', 'culture completeness other class');
}

function test_sprint115ASmokeRegression(ctx) {
  test_sprint115AAssertSuccess(test_sprint115ARoute('health_check', {}), 'health_check');
  test_sprint115AAssertSuccess(test_sprint115ARouteWithToken('list_classes', {}, ctx.adminToken), 'list_classes token');
  test_sprint115AAssertSuccess(test_sprint115ARouteWithToken('get_master_data_basic', {}, ctx.adminToken), 'get_master_data_basic token');
}

function test_sprint115ARoute(action, payload) {
  return test_sprint115AParse(route({
    action: action,
    payload: payload || {}
  }, { parameter: {} }));
}

function test_sprint115ARouteWithToken(action, payload, token) {
  return test_sprint115AParse(route({
    action: action,
    payload: payload || {},
    token: token
  }, { parameter: {} }));
}

function test_sprint115AParse(output) {
  return JSON.parse(output.getContent());
}

function test_sprint115AAssertSuccess(res, label) {
  if (!res || res.status !== 'success') {
    throw new Error(label + " expected success but got: " + JSON.stringify(res));
  }
}

function test_sprint115AAssertError(res, expectedCode, label) {
  if (!res || res.status !== 'error' || res.code !== expectedCode) {
    throw new Error(label + " expected " + expectedCode + " but got: " + JSON.stringify(res));
  }
}
