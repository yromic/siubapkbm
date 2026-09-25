import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
  getOrCreateKKTPAssessment,
  configureAssessmentTPs,
  getKKTPMatrixData,
  saveKKTPMatrixScores,
  getStudentKKTPReport,
  calculateSubjectScore,
} from '../lib/services/kktpAssessmentService';

async function runSmokeTest() {
  console.log('=== STARTING KKTP V2 INTEGRATION SMOKE TEST ===');
  const logs: Array<{ step: string; status: 'PASS' | 'FAIL'; details: any }> = [];

  let testClassId: string = '';
  let testSubjectId: string = '';
  let testAyId: string = '';
  let testSem1Id: string = '';
  let testSem2Id: string = '';
  let studentAId: string = '';
  let studentBId: string = '';
  let studentCId: string = '';
  let studentOutsideId: string = '';
  let assessment1Id: string = '';
  let assessment2Id: string = '';
  let configuredTpIds: string[] = [];

  try {
    // Setup isolated test fixtures
    let ay = await db('academic_years').where('is_active', 1).first();
    if (!ay) {
      testAyId = uuidv4();
      await db('academic_years').insert({
        id: testAyId,
        name: 'SmokeTest AY 2026/2027',
        is_active: 1,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      testAyId = ay.id;
    }

    // Ensure testSem1Id is an active, unfinalized semester
    const activeSem = await db('semesters')
      .where('academic_year_id', testAyId)
      .where('is_active', 1)
      .whereNot('lifecycle_status', 'finalized')
      .first();

    if (activeSem) {
      testSem1Id = activeSem.id;
    } else {
      testSem1Id = uuidv4();
      await db('semesters').insert({
        id: testSem1Id,
        academic_year_id: testAyId,
        name: 'Smoke Active Sem 1',
        semester_type: 'ganjil',
        is_active: 1,
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Secondary semester for isolation test
    const otherSem = await db('semesters')
      .where('academic_year_id', testAyId)
      .whereNot('id', testSem1Id)
      .first();

    if (otherSem) {
      testSem2Id = otherSem.id;
    } else {
      testSem2Id = uuidv4();
      await db('semesters').insert({
        id: testSem2Id,
        academic_year_id: testAyId,
        name: 'Smoke Inactive Sem 2',
        semester_type: 'genap',
        is_active: 0,
        lifecycle_status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    testClassId = `smoke-cls-${uuidv4().slice(0, 8)}`;
    await db('classes').insert({
      id: testClassId,
      name: 'Smoke Test Class',
      level: 4,
      code: `SMK-${uuidv4().slice(0, 4)}`,
      created_at: new Date(),
      updated_at: new Date(),
    });

    testSubjectId = `smoke-sbj-${uuidv4().slice(0, 8)}`;
    await db('subjects').insert({
      id: testSubjectId,
      name: 'Smoke Matematika',
      code: `MAT-${uuidv4().slice(0, 4)}`,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 3 Enrolled students
    studentAId = `smoke-stu-a-${uuidv4().slice(0, 6)}`;
    await db('students').insert({
      id: studentAId,
      full_name: 'Siswa Smoke Alpha',
      nisn: `NS-${uuidv4().slice(0, 8)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('student_enrollments').insert({
      id: uuidv4(),
      student_id: studentAId,
      class_id: testClassId,
      academic_year_id: testAyId,
      semester_id: testSem1Id,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    studentBId = `smoke-stu-b-${uuidv4().slice(0, 6)}`;
    await db('students').insert({
      id: studentBId,
      full_name: 'Siswa Smoke Beta',
      nisn: `NS-${uuidv4().slice(0, 8)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('student_enrollments').insert({
      id: uuidv4(),
      student_id: studentBId,
      class_id: testClassId,
      academic_year_id: testAyId,
      semester_id: testSem1Id,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    studentCId = `smoke-stu-c-${uuidv4().slice(0, 6)}`;
    await db('students').insert({
      id: studentCId,
      full_name: 'Siswa Smoke Gamma',
      nisn: `NS-${uuidv4().slice(0, 8)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('student_enrollments').insert({
      id: uuidv4(),
      student_id: studentCId,
      class_id: testClassId,
      academic_year_id: testAyId,
      semester_id: testSem1Id,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Student Outside
    studentOutsideId = `smoke-stu-out-${uuidv4().slice(0, 6)}`;
    await db('students').insert({
      id: studentOutsideId,
      full_name: 'Siswa Smoke Outside',
      nisn: `NS-${uuidv4().slice(0, 8)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Create/Open Assessment
    // ─────────────────────────────────────────────────────────────
    const ass1 = await getOrCreateKKTPAssessment({
      class_id: testClassId,
      subject_id: testSubjectId,
      academic_year_id: testAyId,
      semester_id: testSem1Id,
    });
    assessment1Id = ass1.id;

    // Check duplicate prevention
    const ass1DuplicateCall = await getOrCreateKKTPAssessment({
      class_id: testClassId,
      subject_id: testSubjectId,
      academic_year_id: testAyId,
      semester_id: testSem1Id,
    });
    const step1Pass = assessment1Id === ass1DuplicateCall.id;
    logs.push({
      step: 'Step 1 — Create/Open Assessment',
      status: step1Pass ? 'PASS' : 'FAIL',
      details: { assessmentId: assessment1Id, duplicateSameId: step1Pass },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Configure 4 Shared TPs
    // ─────────────────────────────────────────────────────────────
    await configureAssessmentTPs(assessment1Id, [
      { tp_code: 'TP-01', tp_text_snapshot: 'Memahami konsep pecahan senilai', order_index: 1 },
      { tp_code: 'TP-02', tp_text_snapshot: 'Menyederhanakan pecahan biasa', order_index: 2 },
      { tp_code: 'TP-03', tp_text_snapshot: 'Menjumlahkan pecahan beda penyebut', order_index: 3 },
      { tp_code: 'TP-04', tp_text_snapshot: 'Menyelesaikan soal cerita pecahan', order_index: 4 },
    ]);

    const matrixInitial = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment1Id,
    });

    configuredTpIds = matrixInitial.tps.map((t: any) => t.id);
    const step2Pass =
      matrixInitial.tps.length === 4 &&
      matrixInitial.students.length === 3 &&
      matrixInitial.students.every((s: any) =>
        configuredTpIds.every((tpId) => tpId in s.scores)
      );

    logs.push({
      step: 'Step 2 — Configure 4 Shared TPs',
      status: step2Pass ? 'PASS' : 'FAIL',
      details: {
        tpsCount: matrixInitial.tps.length,
        studentCount: matrixInitial.students.length,
        allStudentsSeeAllTps: step2Pass,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Score Student A: 90, 85, 89, 88 -> average 88
    // ─────────────────────────────────────────────────────────────
    await saveKKTPMatrixScores(assessment1Id, [
      {
        student_id: studentAId,
        scores: {
          [configuredTpIds[0]]: { score: 90 },
          [configuredTpIds[1]]: { score: 85 },
          [configuredTpIds[2]]: { score: 89 },
          [configuredTpIds[3]]: { score: 88 },
        },
      },
    ]);

    const matrixA = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment1Id,
    });
    const sA = matrixA.students.find((s: any) => s.student_id === studentAId);
    // (90 + 85 + 89 + 88)/4 = 352 / 4 = 88
    const step3Pass = sA && sA.summary.average_score === 88;
    logs.push({
      step: 'Step 3 — Score Student A (90, 85, 89, 88)',
      status: step3Pass ? 'PASS' : 'FAIL',
      details: { average: sA?.summary.average_score, expected: 88 },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Score Student B: 80, 84, 86, 81 -> Student A remains unchanged
    // ─────────────────────────────────────────────────────────────
    await saveKKTPMatrixScores(assessment1Id, [
      {
        student_id: studentBId,
        scores: {
          [configuredTpIds[0]]: { score: 80 },
          [configuredTpIds[1]]: { score: 84 },
          [configuredTpIds[2]]: { score: 86 },
          [configuredTpIds[3]]: { score: 81 },
        },
      },
    ]);

    const matrixB = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment1Id,
    });
    const sA_afterB = matrixB.students.find((s: any) => s.student_id === studentAId);
    const sB = matrixB.students.find((s: any) => s.student_id === studentBId);
    // (80 + 84 + 86 + 81)/4 = 331 / 4 = 82.75
    const step4Pass =
      sA_afterB.summary.average_score === 88 &&
      sB.summary.average_score === 82.75;

    logs.push({
      step: 'Step 4 — Score Student B & Verify Student A Unchanged',
      status: step4Pass ? 'PASS' : 'FAIL',
      details: {
        studentAAvg: sA_afterB.summary.average_score,
        studentBAvg: sB.summary.average_score,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Partial Score Student C: 90, 80, NULL, NULL -> average 85
    // ─────────────────────────────────────────────────────────────
    await saveKKTPMatrixScores(assessment1Id, [
      {
        student_id: studentCId,
        scores: {
          [configuredTpIds[0]]: { score: 90 },
          [configuredTpIds[1]]: { score: 80 },
          [configuredTpIds[2]]: { score: null },
          [configuredTpIds[3]]: { score: null },
        },
      },
    ]);

    const matrixC = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment1Id,
    });
    const sC = matrixC.students.find((s: any) => s.student_id === studentCId);
    const step5Pass = sC && sC.summary.average_score === 85;

    logs.push({
      step: 'Step 5 — Partial Score Student C (90, 80, null, null)',
      status: step5Pass ? 'PASS' : 'FAIL',
      details: {
        studentCAvg: sC?.summary.average_score,
        expected: 85,
        status: sC?.summary.status,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 6: Reload & State Persistence Check
    // ─────────────────────────────────────────────────────────────
    const matrixReload = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment1Id,
    });
    const reloadA = matrixReload.students.find((s: any) => s.student_id === studentAId);
    const reloadB = matrixReload.students.find((s: any) => s.student_id === studentBId);
    const reloadC = matrixReload.students.find((s: any) => s.student_id === studentCId);

    const step6Pass =
      matrixReload.tps.length === 4 &&
      reloadA.summary.average_score === 88 &&
      reloadB.summary.average_score === 82.75 &&
      reloadC.summary.average_score === 85;

    logs.push({
      step: 'Step 6 — Reload Matrix from DB & Persistence Verification',
      status: step6Pass ? 'PASS' : 'FAIL',
      details: { step6Pass },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 7: Edit Existing Score: Student A TP-02: 85 -> 95 -> expected 90.5
    // ─────────────────────────────────────────────────────────────
    await saveKKTPMatrixScores(assessment1Id, [
      {
        student_id: studentAId,
        scores: {
          [configuredTpIds[1]]: { score: 95 },
        },
      },
    ]);

    const matrixA_edited = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment1Id,
    });
    const sA_edited = matrixA_edited.students.find((s: any) => s.student_id === studentAId);
    // (90 + 95 + 89 + 88)/4 = 362 / 4 = 90.5
    const step7Pass = sA_edited && sA_edited.summary.average_score === 90.5;

    // Direct check in kktp_student_summaries table
    const summaryRowA = await db('kktp_student_summaries')
      .where({ assessment_id: assessment1Id, student_id: studentAId })
      .first();

    const summaryAgrees = Number(summaryRowA.average_score) === 90.5;

    logs.push({
      step: 'Step 7 — Edit Existing Score (TP-02: 85 -> 95 -> 90.5)',
      status: step7Pass && summaryAgrees ? 'PASS' : 'FAIL',
      details: {
        matrixAverage: sA_edited?.summary.average_score,
        persistedSummaryAverage: Number(summaryRowA.average_score),
        expected: 90.5,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 8: Individual KKTP Report Verification
    // ─────────────────────────────────────────────────────────────
    const reportA = await getStudentKKTPReport(assessment1Id, studentAId);
    const step8Pass =
      reportA.student.id === studentAId &&
      reportA.assessment.id === assessment1Id &&
      reportA.tps.length === 4 &&
      reportA.tps[1].score === 95 &&
      reportA.summary.average_score === 90.5;

    logs.push({
      step: 'Step 8 — Individual KKTP Report Consistency',
      status: step8Pass ? 'PASS' : 'FAIL',
      details: {
        reportStudentId: reportA.student.id,
        tpsCount: reportA.tps.length,
        tp2Score: reportA.tps[1].score,
        reportAvg: reportA.summary.average_score,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 9: Semester Isolation Check
    // ─────────────────────────────────────────────────────────────
    const ass2 = await getOrCreateKKTPAssessment({
      class_id: testClassId,
      subject_id: testSubjectId,
      academic_year_id: testAyId,
      semester_id: testSem2Id,
    });
    assessment2Id = ass2.id;

    const matrixSem2 = await getKKTPMatrixData({
      class_id: testClassId,
      subject_id: testSubjectId,
      assessment_id: assessment2Id,
    });

    const step9Pass =
      assessment1Id !== assessment2Id &&
      matrixSem2.tps.length === 0; // Sem 2 has not had TPs configured yet

    logs.push({
      step: 'Step 9 — Semester Isolation (Different Assessment & No Cross-Pollution)',
      status: step9Pass ? 'PASS' : 'FAIL',
      details: {
        ass1Id: assessment1Id,
        ass2Id: assessment2Id,
        sem2TpsCount: matrixSem2.tps.length,
      },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 10: Unauthorized / Invalid Writes
    // ─────────────────────────────────────────────────────────────
    let outsideRejected = false;
    try {
      await saveKKTPMatrixScores(assessment1Id, [
        {
          student_id: studentOutsideId,
          scores: { [configuredTpIds[0]]: { score: 90 } },
        },
      ]);
    } catch (e: any) {
      if (e.code === 'ERR_STUDENT_NOT_ENROLLED') outsideRejected = true;
    }

    let invalidTpRejected = false;
    try {
      await saveKKTPMatrixScores(assessment1Id, [
        {
          student_id: studentAId,
          scores: { [uuidv4()]: { score: 90 } },
        },
      ]);
    } catch (e: any) {
      if (e.code === 'ERR_INVALID_TP') invalidTpRejected = true;
    }

    const step10Pass = outsideRejected && invalidTpRejected;
    logs.push({
      step: 'Step 10 — Unauthorized / Invalid Writes Rejected',
      status: step10Pass ? 'PASS' : 'FAIL',
      details: { outsideRejected, invalidTpRejected },
    });

  } catch (error: any) {
    console.error('Smoke test exception:', error);
    logs.push({
      step: 'EXECUTION EXCEPTION',
      status: 'FAIL',
      details: error.message,
    });
  } finally {
    // Cleanup smoke test fixtures
    if (assessment1Id) {
      await db('kktp_student_summaries').where('assessment_id', assessment1Id).delete();
      await db('kktp_student_scores').where('assessment_id', assessment1Id).delete();
      await db('kktp_assessment_tps').where('assessment_id', assessment1Id).delete();
      await db('kktp_assessments').where('id', assessment1Id).delete();
    }
    if (assessment2Id) {
      await db('kktp_student_summaries').where('assessment_id', assessment2Id).delete();
      await db('kktp_student_scores').where('assessment_id', assessment2Id).delete();
      await db('kktp_assessment_tps').where('assessment_id', assessment2Id).delete();
      await db('kktp_assessments').where('id', assessment2Id).delete();
    }
    if (testClassId) {
      await db('student_enrollments').where('class_id', testClassId).delete();
      await db('classes').where('id', testClassId).delete();
    }
    if (testSubjectId) {
      await db('subjects').where('id', testSubjectId).delete();
    }
    const studentIds = [studentAId, studentBId, studentCId, studentOutsideId].filter(Boolean);
    if (studentIds.length > 0) {
      await db('students').whereIn('id', studentIds).delete();
    }
    await db.destroy();
  }

  console.log(JSON.stringify(logs, null, 2));
}

runSmokeTest();
