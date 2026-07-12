/**
 * Sprint4A0Tests.gs
 * QA assertions for Phase 4A-0 academic backend contract alignment.
 */

function test_runPhase4A0QA() {
  console.log("STARTING PHASE 4A-0 ACADEMIC BACKEND CONTRACT QA");
  setupDatabase();
  seedInitialData();

  var adminUser = getSprint11QaAdmin();
  var adminToken = loginSprint11TestUser(adminUser.username, 'Admin123!');
  var suffix = createSprint11QaSuffix();
  var period = ensureSprint11Period(adminUser, suffix, adminToken);

  var classA = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_4A0_A_' + suffix,
    name: 'Kelas 4A0 A ' + suffix,
    level: '5'
  }, adminToken).data;

  var classB = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_4A0_B_' + suffix,
    name: 'Kelas 4A0 B ' + suffix,
    level: '5'
  }, adminToken).data;

  var teacherA = createRecord(SHEETS.USERS, {
    name: 'Guru 4A0 A ' + suffix,
    email: 'guru4a0a_' + suffix + '@example.com',
    username: 'guru4a0a_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, adminUser);
  var teacherAToken = loginSprint11TestUser(teacherA.username, 'Password123!');

  var teacherB = createRecord(SHEETS.USERS, {
    name: 'Guru 4A0 B ' + suffix,
    email: 'guru4a0b_' + suffix + '@example.com',
    username: 'guru4a0b_' + suffix,
    password_hash: hashPassword('Password123!'),
    role: ROLES.TEACHER,
    status: STATUS.ACTIVE
  }, adminUser);
  var teacherBToken = loginSprint11TestUser(teacherB.username, 'Password123!');

  assertSprint11RouteSuccess('assign_class_teacher', {
    class_id: classA.id,
    teacher_user_id: teacherA.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    effective_from: '2026-07-01'
  }, adminToken);

  assertSprint11RouteSuccess('assign_class_teacher', {
    class_id: classB.id,
    teacher_user_id: teacherB.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    effective_from: '2026-07-01'
  }, adminToken);

  var subjectActive = assertSprint11RouteSuccess('create_subject', {
    code: 'SBJ_4A0_ACTIVE_' + suffix,
    name: 'Subject 4A0 Active ' + suffix
  }, adminToken).data;

  var subjectInactiveMapping = assertSprint11RouteSuccess('create_subject', {
    code: 'SBJ_4A0_INACTIVE_MAP_' + suffix,
    name: 'Subject 4A0 Inactive Mapping ' + suffix
  }, adminToken).data;

  var subjectInactive = assertSprint11RouteSuccess('create_subject', {
    code: 'SBJ_4A0_INACTIVE_' + suffix,
    name: 'Subject 4A0 Inactive ' + suffix
  }, adminToken).data;

  assertSprint11RouteSuccess('assign_subject_to_class', {
    class_id: classA.id,
    subject_id: subjectActive.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);

  var inactiveMapping = assertSprint11RouteSuccess('assign_subject_to_class', {
    class_id: classA.id,
    subject_id: subjectInactiveMapping.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken).data;
  assertSprint11RouteSuccess('unassign_subject_from_class', { id: inactiveMapping.id }, adminToken);

  assertSprint11RouteSuccess('assign_subject_to_class', {
    class_id: classA.id,
    subject_id: subjectInactive.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);
  assertSprint11RouteSuccess('deactivate_subject', { id: subjectInactive.id }, adminToken);

  console.log("1. Testing list_my_class_subjects security and active filtering...");
  var subjectsA = assertSprint11RouteSuccess('list_my_class_subjects', {
    class_id: classA.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, teacherAToken).data;
  if (subjectsA.length !== 1 || subjectsA[0].subject_id !== subjectActive.id) {
    throw new Error("Expected only the active class subject for assigned teacher. Got: " + JSON.stringify(subjectsA));
  }
  if (subjectsA[0].subject_name !== subjectActive.name || subjectsA[0].subject_code !== subjectActive.code) {
    throw new Error("Teacher subject response did not include expected joined subject fields.");
  }
  if (subjectsA[0].description || subjectsA[0].created_at || subjectsA[0].updated_at) {
    throw new Error("list_my_class_subjects returned extra master data fields.");
  }

  var otherClassSubjectRes = JSON.parse(route({
    action: 'list_my_class_subjects',
    payload: {
      class_id: classB.id,
      academic_year_id: period.yearId,
      semester_id: period.semesterId
    },
    token: teacherAToken
  }).getContent());
  if (otherClassSubjectRes.status !== 'error' || otherClassSubjectRes.code !== 'ERR_FORBIDDEN') {
    throw new Error("Teacher was allowed to view subjects for another class.");
  }

  var unauthSubjectRes = JSON.parse(route({
    action: 'list_my_class_subjects',
    payload: {
      class_id: classA.id,
      academic_year_id: period.yearId,
      semester_id: period.semesterId
    }
  }).getContent());
  if (unauthSubjectRes.status !== 'error' || unauthSubjectRes.code !== 'ERR_UNAUTHORIZED') {
    throw new Error("Unauthenticated list_my_class_subjects should be rejected.");
  }

  console.log("2. Testing list_students_by_class enrollment id and field filtering...");
  var studentRes = assertSprint11RouteSuccess('create_student', {
    nisn: createSprint11QaNisn(),
    nik: '8211111111115555',
    full_name: 'Student 4A0 ' + suffix,
    birth_place: 'Bandung',
    birth_date: '2015-01-01',
    gender: 'L',
    status: 'Aktif',
    parent_access_pin: '1234',
    family_card_number: '3200000000000000',
    mother_name: 'Mother 4A0'
  }, adminToken);
  var enrollment = assertSprint11RouteSuccess('create_student_enrollment', {
    student_id: studentRes.data.id,
    class_id: classA.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    status: 'active'
  }, adminToken).data;

  var roster = assertSprint11RouteSuccess('list_students_by_class', {
    class_id: classA.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, teacherAToken).data;
  var rosterRow = roster.filter(function(row) { return row.id === studentRes.data.id; })[0];
  if (!rosterRow || rosterRow.student_enrollment_id !== enrollment.id) {
    throw new Error("Teacher roster did not include the correct student_enrollment_id.");
  }
  if (rosterRow.nik || rosterRow.family_card_number || rosterRow.mother_name || rosterRow.parent_access_pin_hash) {
    throw new Error("Teacher roster leaked sensitive student fields.");
  }

  var otherClassRoster = JSON.parse(route({
    action: 'list_students_by_class',
    payload: {
      class_id: classA.id,
      academic_year_id: period.yearId,
      semester_id: period.semesterId
    },
    token: teacherBToken
  }).getContent());
  if (otherClassRoster.status !== 'error' || otherClassRoster.code !== 'ERR_FORBIDDEN') {
    throw new Error("Teacher from another class was allowed to fetch roster.");
  }

  console.log("3. Testing assessment metadata write hardening...");
  var draftAssessment = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classA.id,
    subject_id: subjectActive.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Draft 4A0 ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, teacherAToken).data;

  var draftUpdate = assertSprint11RouteSuccess('update_academic_assessment', {
    id: draftAssessment.id,
    title: 'Draft 4A0 Updated ' + suffix,
    class_id: classB.id,
    status: STATUS.LOCKED
  }, teacherAToken).data;
  if (draftUpdate.class_id !== classA.id || draftUpdate.status !== STATUS.DRAFT || draftUpdate.title !== 'Draft 4A0 Updated ' + suffix) {
    throw new Error("Assessment update allowed forbidden fields or failed allowed field update.");
  }

  var published = assertSprint11RouteSuccess('publish_academic_assessment', { id: draftAssessment.id }, teacherAToken).data;
  if (published.status !== STATUS.PUBLISHED) {
    throw new Error("Draft assessment was not published.");
  }

  var republishRes = JSON.parse(route({
    action: 'publish_academic_assessment',
    payload: { id: draftAssessment.id },
    token: teacherAToken
  }).getContent());
  if (republishRes.status !== 'error' || republishRes.code !== 'ERR_INVALID_ASSESSMENT_STATUS') {
    throw new Error("Published assessment was allowed to publish again.");
  }

  var publishedUpdate = assertSprint11RouteSuccess('update_academic_assessment', {
    id: draftAssessment.id,
    title: 'Published 4A0 Updated ' + suffix
  }, teacherAToken).data;
  if (publishedUpdate.title !== 'Published 4A0 Updated ' + suffix) {
    throw new Error("Published assessment update should be allowed before lock/finalization.");
  }

  assertSprint11RouteSuccess('lock_academic_assessment', { id: draftAssessment.id }, adminToken);
  var lockedUpdate = JSON.parse(route({
    action: 'update_academic_assessment',
    payload: { id: draftAssessment.id, title: 'Should fail' },
    token: teacherAToken
  }).getContent());
  if (lockedUpdate.status !== 'error' || lockedUpdate.code !== 'ERR_ASSESSMENT_LOCKED') {
    throw new Error("Locked assessment update was not rejected.");
  }
  var lockedPublish = JSON.parse(route({
    action: 'publish_academic_assessment',
    payload: { id: draftAssessment.id },
    token: teacherAToken
  }).getContent());
  if (lockedPublish.status !== 'error' || lockedPublish.code !== 'ERR_ASSESSMENT_LOCKED') {
    throw new Error("Locked assessment publish was not rejected.");
  }

  var foreignAssessment = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: classA.id,
    subject_id: subjectActive.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Foreign 4A0 ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, adminToken).data;
  var foreignPublish = JSON.parse(route({
    action: 'publish_academic_assessment',
    payload: { id: foreignAssessment.id },
    token: teacherBToken
  }).getContent());
  if (foreignPublish.status !== 'error' || foreignPublish.code !== 'ERR_FORBIDDEN') {
    throw new Error("Teacher from another class was allowed to publish assessment.");
  }

  console.log("4. Testing semester finalization blocks create/update/publish...");
  var finalizedClass = assertSprint11RouteSuccess('create_class', {
    code: 'CLS_4A0_FINAL_' + suffix,
    name: 'Kelas 4A0 Final ' + suffix,
    level: '5'
  }, adminToken).data;
  assertSprint11RouteSuccess('assign_class_teacher', {
    class_id: finalizedClass.id,
    teacher_user_id: teacherA.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    effective_from: '2026-07-01'
  }, adminToken);
  assertSprint11RouteSuccess('assign_subject_to_class', {
    class_id: finalizedClass.id,
    subject_id: subjectActive.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);
  var finalDraft = assertSprint11RouteSuccess('create_academic_assessment', {
    class_id: finalizedClass.id,
    subject_id: subjectActive.id,
    academic_year_id: period.yearId,
    semester_id: period.semesterId,
    title: 'Finalized Draft 4A0 ' + suffix,
    assessment_date: '2026-07-10',
    score_min: 0,
    score_max: 100
  }, teacherAToken).data;
  assertSprint11RouteSuccess('finalize_semester_reports', {
    academic_year_id: period.yearId,
    semester_id: period.semesterId
  }, adminToken);

  var finalizedCreate = JSON.parse(route({
    action: 'create_academic_assessment',
    payload: {
      class_id: finalizedClass.id,
      subject_id: subjectActive.id,
      academic_year_id: period.yearId,
      semester_id: period.semesterId,
      title: 'Should fail create',
      assessment_date: '2026-07-10',
      score_min: 0,
      score_max: 100
    },
    token: teacherAToken
  }).getContent());
  if (finalizedCreate.status !== 'error' || finalizedCreate.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Create assessment in finalized semester was not rejected.");
  }

  var finalizedUpdate = JSON.parse(route({
    action: 'update_academic_assessment',
    payload: { id: finalDraft.id, title: 'Should fail update' },
    token: teacherAToken
  }).getContent());
  if (finalizedUpdate.status !== 'error' || finalizedUpdate.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Update assessment in finalized semester was not rejected.");
  }

  var finalizedPublish = JSON.parse(route({
    action: 'publish_academic_assessment',
    payload: { id: finalDraft.id },
    token: teacherAToken
  }).getContent());
  if (finalizedPublish.status !== 'error' || finalizedPublish.code !== 'ERR_SEMESTER_FINALIZED') {
    throw new Error("Publish assessment in finalized semester was not rejected.");
  }

  console.log("PHASE 4A-0 ACADEMIC BACKEND CONTRACT QA PASSED");
}
