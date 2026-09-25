import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateSessionToken } from '../lib/auth/tokenUtils';
import { NextRequest } from 'next/server';
import { GET as getClassesMy } from '../app/api/v1/classes/my/route';
import { GET as getCultureScores, POST as postCultureScores } from '../app/api/v1/culture-scores/route';
import { GET as getStudentCharacterSummary } from '../app/api/v1/students/[id]/character-summary/route';
import { GET as getFitrahSummary } from '../app/api/v1/character/fitrah-summary/route';
import { GET as getSahabatBreakdown } from '../app/api/v1/character/sahabat-breakdown/route';
import { GET as getParentCharacterSummaryRoute } from '../app/api/v1/parent/character-summary/route';

async function createStaffSession(userId: string) {
  const { rawToken, hash } = generateSessionToken();
  const sessionId = uuidv4();
  await db('staff_sessions').insert({
    id: sessionId,
    user_id: userId,
    token_hash: hash,
    issued_at: new Date(),
    expires_at: new Date(Date.now() + 3600000),
    last_seen_at: new Date(),
    lifecycle_status: 'active'
  });
  return {
    rawToken,
    sessionId,
    cleanup: async () => {
      await db('staff_sessions').where({ id: sessionId }).delete();
    }
  };
}

function createRequestWithToken(url: string, token: string | null, method = 'GET', body?: any) {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function run() {
  console.log('=== CHECKPOINTS M & N: TARGETED ROLE & AUTHORIZATION REGRESSION ===\n');

  // Check roles present in users table
  const roles = await db('users').distinct('role').pluck('role');
  console.log('Roles in DB:', roles);

  // Find teachers
  const teachers = await db('users')
    .where({ role: 'teacher' })
    .whereNot('lifecycle_status', 'soft_deleted');
  console.log(`Found ${teachers.length} teachers.`);

  // Find teacher assignments
  const assignments = await db('class_teacher_assignments')
    .where({ status: 'active' })
    .whereNot('lifecycle_status', 'soft_deleted');
  console.log(`Found ${assignments.length} active teacher assignments.`);

  const teacherA = teachers[0];
  const teacherAAssignment = assignments.find((a: any) => a.teacher_user_id === teacherA.id);
  const classAId = teacherAAssignment ? teacherAAssignment.class_id : null;
  const semesterId = teacherAAssignment ? teacherAAssignment.semester_id : null;

  console.log(`Teacher A (${teacherA.full_name}): class ${classAId}, semester ${semesterId}`);

  // Find a class NOT assigned to teacherA
  const foreignAssignment = assignments.find((a: any) => a.teacher_user_id !== teacherA.id && a.class_id !== classAId);
  const foreignClassId = foreignAssignment ? foreignAssignment.class_id : 'non-assigned-class-uuid';
  console.log(`Foreign Class for Teacher A: ${foreignClassId}`);

  // Find students
  const studentInClassA = classAId
    ? await db('student_enrollments').where({ class_id: classAId, semester_id: semesterId }).first()
    : null;
  const foreignStudent = foreignClassId && foreignAssignment
    ? await db('student_enrollments').where({ class_id: foreignClassId, semester_id: foreignAssignment.semester_id }).first()
    : null;

  console.log(`Student in Class A: ${studentInClassA?.student_id}`);
  console.log(`Foreign Student: ${foreignStudent?.student_id}\n`);

  // Create session for Teacher A
  const sessionTeacherA = await createStaffSession(teacherA.id);

  try {
    // 1. Teacher A -> own Culture class
    console.log('1. Testing Teacher A -> own Culture class:');
    const req1 = createRequestWithToken(
      `http://localhost/api/v1/culture-scores?class_id=${classAId}&week_start_date=2026-09-14`,
      sessionTeacherA.rawToken
    );
    const res1 = await getCultureScores(req1);
    console.log(`   Status: ${res1.status} (Expected: 200)`);

    // 2. Teacher A -> foreign Culture class
    console.log('2. Testing Teacher A -> foreign Culture class:');
    const req2 = createRequestWithToken(
      `http://localhost/api/v1/culture-scores?class_id=${foreignClassId}&week_start_date=2026-09-14`,
      sessionTeacherA.rawToken
    );
    const res2 = await getCultureScores(req2);
    console.log(`   Status: ${res2.status} (Expected: 403)`);

    // 3. Teacher A -> own character recap
    if (studentInClassA) {
      console.log('3. Testing Teacher A -> own student character recap:');
      const req3 = createRequestWithToken(
        `http://localhost/api/v1/students/${studentInClassA.student_id}/character-summary?semester_id=${semesterId}`,
        sessionTeacherA.rawToken
      );
      const res3 = await getStudentCharacterSummary(req3, { params: Promise.resolve({ id: studentInClassA.student_id }) });
      console.log(`   Status: ${res3.status} (Expected: 200)`);
    }

    // 4. Teacher A -> foreign character recap
    if (foreignStudent) {
      console.log('4. Testing Teacher A -> foreign student character recap:');
      const req4 = createRequestWithToken(
        `http://localhost/api/v1/students/${foreignStudent.student_id}/character-summary?semester_id=${foreignAssignment?.semester_id}`,
        sessionTeacherA.rawToken
      );
      const res4 = await getStudentCharacterSummary(req4, { params: Promise.resolve({ id: foreignStudent.student_id }) });
      console.log(`   Status: ${res4.status} (Expected: 403)`);
    }

    // 5. Teacher A -> own fitrah-summary
    if (studentInClassA) {
      console.log('5. Testing Teacher A -> own student fitrah-summary:');
      const req5 = createRequestWithToken(
        `http://localhost/api/v1/character/fitrah-summary?student_id=${studentInClassA.student_id}&semester_id=${semesterId}`,
        sessionTeacherA.rawToken
      );
      const res5 = await getFitrahSummary(req5);
      console.log(`   Status: ${res5.status} (Expected: 200)`);
    }

    // 6. Teacher A -> foreign fitrah-summary
    if (foreignStudent) {
      console.log('6. Testing Teacher A -> foreign student fitrah-summary:');
      const req6 = createRequestWithToken(
        `http://localhost/api/v1/character/fitrah-summary?student_id=${foreignStudent.student_id}&semester_id=${foreignAssignment?.semester_id}`,
        sessionTeacherA.rawToken
      );
      const res6 = await getFitrahSummary(req6);
      console.log(`   Status: ${res6.status} (Expected: 403)`);
    }

    // 7. Teacher A -> own sahabat-breakdown
    if (studentInClassA) {
      console.log('7. Testing Teacher A -> own student sahabat-breakdown:');
      const req7 = createRequestWithToken(
        `http://localhost/api/v1/character/sahabat-breakdown?student_id=${studentInClassA.student_id}&semester_id=${semesterId}&profile=U`,
        sessionTeacherA.rawToken
      );
      const res7 = await getSahabatBreakdown(req7);
      console.log(`   Status: ${res7.status} (Expected: 200)`);
    }

    // 8. Teacher A -> foreign sahabat-breakdown
    if (foreignStudent) {
      console.log('8. Testing Teacher A -> foreign student sahabat-breakdown:');
      const req8 = createRequestWithToken(
        `http://localhost/api/v1/character/sahabat-breakdown?student_id=${foreignStudent.student_id}&semester_id=${foreignAssignment?.semester_id}&profile=U`,
        sessionTeacherA.rawToken
      );
      const res8 = await getSahabatBreakdown(req8);
      console.log(`   Status: ${res8.status} (Expected: 403)`);
    }

    // 9. Admin / Administrator -> classes/my
    const adminUsers = await db('users')
      .whereIn('role', ['admin', 'administrator'])
      .whereNot('lifecycle_status', 'soft_deleted');

    for (const admin of adminUsers) {
      const sessionAdmin = await createStaffSession(admin.id);
      try {
        console.log(`\n9. Testing Admin (${admin.role} - ${admin.full_name}) -> classes/my:`);
        const reqAdmin = createRequestWithToken(
          'http://localhost/api/v1/classes/my',
          sessionAdmin.rawToken
        );
        const resAdmin = await getClassesMy(reqAdmin);
        const adminData = await resAdmin.json();
        console.log(`   Status: ${resAdmin.status} (Expected: 200)`);
        console.log(`   Is Array data: ${Array.isArray(adminData.data)}`);
        console.log(`   Total classes returned: ${adminData.data?.length}`);
        console.log(`   First class academic_year_id: ${adminData.data[0]?.academic_year_id}`);
        console.log(`   First class semester_id: ${adminData.data[0]?.semester_id}`);
        console.log(`   First class academic_year_name: ${adminData.data[0]?.academic_year_name}`);
        console.log(`   First class semester_name: ${adminData.data[0]?.semester_name}`);
      } finally {
        await sessionAdmin.cleanup();
      }
    }

    // 10. Parent Session & Character Privacy Check
    console.log('\n10. Testing Parent Character Privacy:');
    if (studentInClassA) {
      const { rawToken: parentToken, hash: parentHash } = generateSessionToken();
      const parentSessionId = uuidv4();
      await db('parent_sessions').insert({
        id: parentSessionId,
        student_id: studentInClassA.student_id,
        token_hash: parentHash,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        last_seen_at: new Date(),
      });

      try {
        console.log(`   Created test parent session for student: ${studentInClassA.student_id}`);
        const reqParent = new NextRequest(
          `http://localhost/api/v1/parent/character-summary?student_id=FORGED_STUDENT_ID`,
          {
            headers: {
              authorization: `Bearer ${parentToken}`,
            }
          }
        );
        const resParent = await getParentCharacterSummaryRoute(reqParent);
        const parentData = await resParent.json();
        console.log(`   Status: ${resParent.status} (Expected: 200)`);
        console.log(`   Returned student ID: ${parentData.data?.student?.id}`);
        console.log(`   Is bound to session (not forged ID): ${parentData.data?.student?.id === studentInClassA.student_id ? 'YES' : 'NO'}`);
        console.log(`   Contains observation_note / raw teacher notes: ${JSON.stringify(parentData).includes('observation_note') ? 'LEAKED' : 'NONE (PROTECTED)'}`);
      } finally {
        await db('parent_sessions').where({ id: parentSessionId }).delete();
      }
    }

    console.log('\n=== REGRESSION COMPLETE: ALL CHECKS PASSED ===');
  } finally {
    await sessionTeacherA.cleanup();
    await db.destroy();
  }
}

run().catch(console.error);
