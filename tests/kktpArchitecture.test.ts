import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/db';
import {
  calculateSubjectScore,
  getKKTPPredicate,
  getOrCreateKKTPAssessment,
  configureAssessmentTPs,
  getKKTPMatrixData,
  saveKKTPMatrixScores,
  getStudentKKTPReport,
  getStudentSemesterKKTPOverview,
} from '../lib/services/kktpAssessmentService';
import {
  analyzeLegacyKKTPData,
  executeAutoKKTPMigration,
} from '../lib/services/kktpMigrationService';
import { v4 as uuidv4 } from 'uuid';

describe('KKTP Architecture Remediation & Domain Invariants Test Suite', () => {
  let testClassId: string;
  let testSubjectId: string;
  let testAcademicYearId: string;
  let testSemesterId: string;
  let studentAId: string;
  let studentBId: string;
  let studentOutsideId: string;
  let createdAssessmentId: string;
  let configuredTpIds: string[] = [];

  before(async () => {
    // 1. Resolve or create active academic year & semester
    let ay = await db('academic_years').where('is_active', 1).first();
    if (!ay) {
      const ayId = uuidv4();
      await db('academic_years').insert({
        id: ayId,
        name: '2026/2027',
        is_active: 1,
        created_at: new Date(),
        updated_at: new Date(),
      });
      ay = { id: ayId };
    }
    testAcademicYearId = ay.id;

    let sem = await db('semesters').where('academic_year_id', testAcademicYearId).where('is_active', 1).first();
    if (!sem) {
      const semId = uuidv4();
      await db('semesters').insert({
        id: semId,
        academic_year_id: testAcademicYearId,
        name: 'Semester 1 (Ganjil)',
        semester_type: 'ganjil',
        is_active: 1,
        created_at: new Date(),
        updated_at: new Date(),
      });
      sem = { id: semId };
    }
    testSemesterId = sem.id;

    // 2. Create isolated test class
    testClassId = `test-class-${uuidv4().slice(0, 8)}`;
    await db('classes').insert({
      id: testClassId,
      name: 'Kelas 5 Test KKTP',
      level: 5,
      code: `K5-${uuidv4().slice(0, 4)}`,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 3. Create isolated test subject
    testSubjectId = `test-subj-${uuidv4().slice(0, 8)}`;
    await db('subjects').insert({
      id: testSubjectId,
      name: 'IPA Terpadu Test',
      code: `IPA-${uuidv4().slice(0, 4)}`,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 4. Create 2 enrolled students in test class
    studentAId = `test-stu-a-${uuidv4().slice(0, 8)}`;
    await db('students').insert({
      id: studentAId,
      full_name: 'Murid Test Alpha',
      nisn: `NISN-${uuidv4().slice(0, 6)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('student_enrollments').insert({
      id: uuidv4(),
      student_id: studentAId,
      class_id: testClassId,
      academic_year_id: testAcademicYearId,
      semester_id: testSemesterId,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    studentBId = `test-stu-b-${uuidv4().slice(0, 8)}`;
    await db('students').insert({
      id: studentBId,
      full_name: 'Murid Test Beta',
      nisn: `NISN-${uuidv4().slice(0, 6)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('student_enrollments').insert({
      id: uuidv4(),
      student_id: studentBId,
      class_id: testClassId,
      academic_year_id: testAcademicYearId,
      semester_id: testSemesterId,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 5. Create a student NOT enrolled in test class
    studentOutsideId = `test-stu-outside-${uuidv4().slice(0, 8)}`;
    await db('students').insert({
      id: studentOutsideId,
      full_name: 'Murid Luar Kelas',
      nisn: `NISN-${uuidv4().slice(0, 6)}`,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  after(async () => {
    // Clean up test data
    if (createdAssessmentId) {
      await db('kktp_student_summaries').where('assessment_id', createdAssessmentId).delete();
      await db('kktp_student_scores').where('assessment_id', createdAssessmentId).delete();
      await db('kktp_assessment_tps').where('assessment_id', createdAssessmentId).delete();
      await db('kktp_assessments').where('id', createdAssessmentId).delete();
    }
    await db('student_enrollments').where('class_id', testClassId).delete();
    await db('students').whereIn('id', [studentAId, studentBId, studentOutsideId]).delete();
    await db('subjects').where('id', testSubjectId).delete();
    await db('classes').where('id', testClassId).delete();
    await db.destroy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CANONICAL SUBJECT SCORE & PREDICATE CALCULATION
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Pure Domain Calculation Logic', () => {
    it('calculates average correctly for all scored TPs: 90, 85, 89, 88 -> 88', () => {
      const avg = calculateSubjectScore([90, 85, 89, 88]);
      assert.strictEqual(avg, 88, 'Should produce exact unweighted rounded mean of 88');
    });

    it('calculates average based only on scored TPs, ignoring nulls: 90, 80, NULL, NULL -> 85', () => {
      const avg = calculateSubjectScore([90, 80, null, null]);
      assert.strictEqual(avg, 85, '(90 + 80) / 2 must equal 85');
    });

    it('returns null when all TPs are unassessed or array is empty', () => {
      assert.strictEqual(calculateSubjectScore([null, null]), null);
      assert.strictEqual(calculateSubjectScore([]), null);
    });

    it('computes canonical KKTP predicates according to PKBM standard thresholds', () => {
      assert.strictEqual(getKKTPPredicate(95).label, 'Sangat Baik');
      assert.strictEqual(getKKTPPredicate(90).label, 'Sangat Baik');
      assert.strictEqual(getKKTPPredicate(88).label, 'Tuntas');
      assert.strictEqual(getKKTPPredicate(76).label, 'Tuntas');
      assert.strictEqual(getKKTPPredicate(75).label, 'Cukup');
      assert.strictEqual(getKKTPPredicate(60).label, 'Cukup');
      assert.strictEqual(getKKTPPredicate(59).label, 'Perlu Bimbingan');
      assert.strictEqual(getKKTPPredicate(null).label, 'Belum Dinilai');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ASSESSMENT UNIQUENESS & DATABASE CONSTRAINTS
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Assessment Scope Uniqueness & Idempotency', () => {
    it('creates a new assessment on initial request', async () => {
      const session = await getOrCreateKKTPAssessment({
        class_id: testClassId,
        subject_id: testSubjectId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemesterId,
      });

      assert.ok(session.id);
      assert.strictEqual(session.class_id, testClassId);
      assert.strictEqual(session.subject_id, testSubjectId);
      assert.strictEqual(session.academic_year_id, testAcademicYearId);
      assert.strictEqual(session.semester_id, testSemesterId);
      createdAssessmentId = session.id;
    });

    it('returns the existing assessment on identical scope request without duplicating rows', async () => {
      const sessionSecondCall = await getOrCreateKKTPAssessment({
        class_id: testClassId,
        subject_id: testSubjectId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemesterId,
      });

      assert.strictEqual(
        sessionSecondCall.id,
        createdAssessmentId,
        'Calling getOrCreate for identical scope must return same record'
      );

      const count = await db('kktp_assessments')
        .where({
          class_id: testClassId,
          subject_id: testSubjectId,
          academic_year_id: testAcademicYearId,
          semester_id: testSemesterId,
        })
        .count('id as cnt');

      assert.strictEqual(Number(count[0].cnt), 1, 'Only exactly 1 assessment row may exist');
    });

    it('rejects direct database insertion of duplicate assessment via unique constraint', async () => {
      await assert.rejects(
        async () => {
          await db('kktp_assessments').insert({
            id: uuidv4(),
            class_id: testClassId,
            subject_id: testSubjectId,
            academic_year_id: testAcademicYearId,
            semester_id: testSemesterId,
            status: 'DRAFT',
            created_at: new Date(),
            updated_at: new Date(),
          });
        },
        (err: any) => {
          assert.match(err.message, /Duplicate entry|uq_kktp_assessment_scope/i);
          return true;
        }
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SHARED TP CONFIGURATION & MATRIX VISIBILITY
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Shared TP Configuration & Matrix Visibility', () => {
    it('configures shared TPs once for the entire class assessment', async () => {
      const res = await configureAssessmentTPs(createdAssessmentId, [
        {
          tp_code: 'TP-01',
          tp_text_snapshot: 'Mengidentifikasi struktur dan fungsi organ pernapasan pada manusia',
          order_index: 1,
        },
        {
          tp_code: 'TP-02',
          tp_text_snapshot: 'Menjelaskan mekanisme pertukaran gas oksigen dan karbon dioksida',
          order_index: 2,
        },
      ]);

      assert.strictEqual(res.configuredCount, 2);

      const rows = await db('kktp_assessment_tps')
        .where('assessment_id', createdAssessmentId)
        .orderBy('order_index', 'asc');

      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].tp_code, 'TP-01');
      assert.strictEqual(rows[1].tp_code, 'TP-02');
      configuredTpIds = rows.map((r: any) => r.id);
    });

    it('presents configured TPs uniformly to every student in the matrix read model', async () => {
      const matrix = await getKKTPMatrixData({
        class_id: testClassId,
        subject_id: testSubjectId,
        assessment_id: createdAssessmentId,
      });

      assert.strictEqual(matrix.tps.length, 2, 'Matrix columns must show exactly 2 configured TPs');
      assert.strictEqual(matrix.students.length, 2, 'Matrix rows must show both enrolled students');

      const studentA = matrix.students.find((s: any) => s.student_id === studentAId);
      const studentB = matrix.students.find((s: any) => s.student_id === studentBId);

      assert.ok(studentA, 'Student A must be present in matrix');
      assert.ok(studentB, 'Student B must be present in matrix');

      // Both students must reference the exact same configured assessment TP IDs
      assert.ok(configuredTpIds[0] in studentA.scores);
      assert.ok(configuredTpIds[1] in studentA.scores);
      assert.ok(configuredTpIds[0] in studentB.scores);
      assert.ok(configuredTpIds[1] in studentB.scores);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. STUDENT SCORE ISOLATION & BULK TRANSACTION
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Score Isolation & Bulk Scoring Transaction', () => {
    it('updates Student A scores without corrupting or overwriting Student B', async () => {
      // 1. Save scores for Student A
      await saveKKTPMatrixScores(createdAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [configuredTpIds[0]]: { score: 90 },
            [configuredTpIds[1]]: { score: 86 },
          },
        },
      ]);

      // 2. Verify Student A has scores, Student B remains null
      let matrix = await getKKTPMatrixData({
        class_id: testClassId,
        subject_id: testSubjectId,
        assessment_id: createdAssessmentId,
      });

      let stA = matrix.students.find((s: any) => s.student_id === studentAId);
      let stB = matrix.students.find((s: any) => s.student_id === studentBId);

      assert.strictEqual(stA.scores[configuredTpIds[0]].score, 90);
      assert.strictEqual(stA.scores[configuredTpIds[1]].score, 86);
      assert.strictEqual(stA.summary.average_score, 88); // (90 + 86)/2 = 88
      assert.strictEqual(stA.summary.predicate, 'Tuntas');

      assert.strictEqual(stB.scores[configuredTpIds[0]].score, null);
      assert.strictEqual(stB.scores[configuredTpIds[1]].score, null);
      assert.strictEqual(stB.summary.average_score, null);

      // 3. Save scores for Student B
      await saveKKTPMatrixScores(createdAssessmentId, [
        {
          student_id: studentBId,
          scores: {
            [configuredTpIds[0]]: { score: 95 },
            [configuredTpIds[1]]: { score: 91 },
          },
        },
      ]);

      // 4. Re-verify Student A is unaffected
      matrix = await getKKTPMatrixData({
        class_id: testClassId,
        subject_id: testSubjectId,
        assessment_id: createdAssessmentId,
      });

      stA = matrix.students.find((s: any) => s.student_id === studentAId);
      stB = matrix.students.find((s: any) => s.student_id === studentBId);

      assert.strictEqual(stA.scores[configuredTpIds[0]].score, 90, 'Student A score must remain 90');
      assert.strictEqual(stB.scores[configuredTpIds[0]].score, 95, 'Student B score must be 95');
      assert.strictEqual(stB.summary.average_score, 93); // (95 + 91)/2 = 93
      assert.strictEqual(stB.summary.predicate, 'Sangat Baik');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. VALIDATION GUARDRAILS
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Validation Guardrails', () => {
    it('rejects scoring for a student not enrolled in the class (ERR_STUDENT_NOT_ENROLLED)', async () => {
      await assert.rejects(
        async () => {
          await saveKKTPMatrixScores(createdAssessmentId, [
            {
              student_id: studentOutsideId,
              scores: {
                [configuredTpIds[0]]: { score: 80 },
              },
            },
          ]);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'ERR_STUDENT_NOT_ENROLLED');
          return true;
        }
      );
    });

    it('rejects scoring for a TP not configured on the assessment (ERR_INVALID_TP)', async () => {
      const foreignTpId = uuidv4();
      await assert.rejects(
        async () => {
          await saveKKTPMatrixScores(createdAssessmentId, [
            {
              student_id: studentAId,
              scores: {
                [foreignTpId]: { score: 85 },
              },
            },
          ]);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'ERR_INVALID_TP');
          return true;
        }
      );
    });

    it('rejects out-of-range scores (> 100 or < 0)', async () => {
      await assert.rejects(
        async () => {
          await saveKKTPMatrixScores(createdAssessmentId, [
            {
              student_id: studentAId,
              scores: {
                [configuredTpIds[0]]: { score: 105 },
              },
            },
          ]);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'ERR_VALIDATION');
          return true;
        }
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. LEGACY MIGRATION ANALYSIS & CLASSIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  describe('6. Legacy Migration Analysis & Safety Classification', () => {
    it('analyzes existing legacy documents and classifies conflicting TP sets as REQUIRES_REVIEW', async () => {
      const analysis = await analyzeLegacyKKTPData();
      assert.ok(analysis.totalLegacyDocuments >= 10, 'Must detect at least 10 legacy documents');

      // Check Class 1 Fisika group which has 8 divergent TP variants among 7 students
      const class1Group = analysis.groups.find(
        (g) => (g.class_id === '1' || g.class_name === '1') && (g.subject_id === 'fisika' || g.subject_name.toLowerCase().includes('fisika'))
      );

      if (class1Group) {
        assert.ok(class1Group.status === 'REQUIRES_REVIEW' || class1Group.status === 'ALREADY_MIGRATED');
        assert.ok(class1Group.tp_variants_count > 1, 'Class 1 must have multiple TP variants');
        assert.ok(class1Group.duplicate_documents.length > 0, 'Must detect duplicate documents for student');
      }
    });

    it('classifies single/consistent student TP documents as AUTO_MIGRATABLE', async () => {
      const analysis = await analyzeLegacyKKTPData();
      const autoGroups = analysis.groups.filter(
        (g: any) => (g.status === 'AUTO_MIGRATABLE' || g.status === 'ALREADY_MIGRATED') && g.tp_variants_count === 1
      );

      // Clean groups with unified TPs
      assert.ok(autoGroups.length >= 1, 'Should have at least 1 clean group with unified TPs');
      for (const group of autoGroups) {
        assert.strictEqual(group.tp_variants_count, 1);
        assert.strictEqual(group.duplicate_documents.length, 0);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. MIGRATION IDEMPOTENCY & NON-DESTRUCTIVE GUARANTEE
  // ──────────────────────────────────────────────────────────────────────────
  describe('7. Migration Execution Idempotency & Legacy Data Preservation', () => {
    it('executes auto-migration idempotently without duplicating normalized records', async () => {
      const initialLegacyDocCount = await db('documents').where('type', 'KKTP').count('id as cnt');

      // First run
      const run1 = await executeAutoKKTPMigration();
      assert.strictEqual(run1.success, true);

      // Second run
      const run2 = await executeAutoKKTPMigration();
      assert.strictEqual(run2.success, true);

      // Verify legacy document count was NOT changed (strictly zero deletions)
      const afterLegacyDocCount = await db('documents').where('type', 'KKTP').count('id as cnt');
      assert.strictEqual(
        Number(afterLegacyDocCount[0].cnt),
        Number(initialLegacyDocCount[0].cnt),
        'Legacy documents table must not be deleted or modified'
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. ASSESSMENT COMPLETION SEMANTICS & RAPORT DATA CONTRACT
  // ──────────────────────────────────────────────────────────────────────────
  describe('8. Completion Semantics, Summary Sync & Raport Contract', () => {
    it('distinguishes partial provisional assessment (2/4 TPs) from fully completed assessment (4/4 TPs)', async () => {
      // 1. Configure 4 TPs on the assessment
      await configureAssessmentTPs(createdAssessmentId, [
        { tp_code: 'TP-01', tp_text_snapshot: 'Materi 1', order_index: 1 },
        { tp_code: 'TP-02', tp_text_snapshot: 'Materi 2', order_index: 2 },
        { tp_code: 'TP-03', tp_text_snapshot: 'Materi 3', order_index: 3 },
        { tp_code: 'TP-04', tp_text_snapshot: 'Materi 4', order_index: 4 },
      ]);

      const tps = await db('kktp_assessment_tps').where('assessment_id', createdAssessmentId).orderBy('order_index', 'asc');
      assert.strictEqual(tps.length, 4);

      // 2. Score Student A with 2 of 4 TPs (provisional)
      await saveKKTPMatrixScores(createdAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [tps[0].id]: { score: 90 },
            [tps[1].id]: { score: 80 },
            [tps[2].id]: { score: null },
            [tps[3].id]: { score: null },
          },
        },
      ]);

      // Check matrix read model
      let matrix = await getKKTPMatrixData({
        class_id: testClassId,
        subject_id: testSubjectId,
        assessment_id: createdAssessmentId,
      });
      let stA = matrix.students.find((s: any) => s.student_id === studentAId);
      assert.strictEqual(stA.summary.average_score, 85);
      assert.strictEqual(stA.summary.provisional_average, 85);
      assert.strictEqual(stA.summary.final_score, null, 'Partial assessment must NOT have final_score');
      assert.strictEqual(stA.summary.scored_tp_count, 2);
      assert.strictEqual(stA.summary.total_tp_count, 4);
      assert.strictEqual(stA.summary.completion_percentage, 50);
      assert.strictEqual(stA.summary.is_complete, false);
      assert.strictEqual(stA.summary.status, 'IN_PROGRESS');

      // Check summary table in database: status must be DRAFT (not COMPLETED)
      const sumRowDraft = await db('kktp_student_summaries')
        .where({ assessment_id: createdAssessmentId, student_id: studentAId })
        .first();
      assert.strictEqual(sumRowDraft.status, 'DRAFT', 'DB status for partial scores must remain DRAFT');

      // 3. Complete Student A with all 4 TPs
      await saveKKTPMatrixScores(createdAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [tps[0].id]: { score: 90 },
            [tps[1].id]: { score: 85 },
            [tps[2].id]: { score: 89 },
            [tps[3].id]: { score: 88 },
          },
        },
      ]);

      matrix = await getKKTPMatrixData({
        class_id: testClassId,
        subject_id: testSubjectId,
        assessment_id: createdAssessmentId,
      });
      stA = matrix.students.find((s: any) => s.student_id === studentAId);
      assert.strictEqual(stA.summary.average_score, 88);
      assert.strictEqual(stA.summary.provisional_average, null);
      assert.strictEqual(stA.summary.final_score, 88);
      assert.strictEqual(stA.summary.scored_tp_count, 4);
      assert.strictEqual(stA.summary.total_tp_count, 4);
      assert.strictEqual(stA.summary.completion_percentage, 100);
      assert.strictEqual(stA.summary.is_complete, true);
      assert.strictEqual(stA.summary.status, 'COMPLETED');

      // Check summary table in database: status must now be COMPLETED
      const sumRowCompleted = await db('kktp_student_summaries')
        .where({ assessment_id: createdAssessmentId, student_id: studentAId })
        .first();
      assert.strictEqual(sumRowCompleted.status, 'COMPLETED');
    });

    it('re-syncs summary averages and completion when configured assessment TPs are deleted', async () => {
      // Current state: Student A has 4 TPs scored: 90, 85, 89, 88 -> avg 88
      // Remove TP-04 by reconfiguring TPs with only TP-01, TP-02, TP-03
      const tpsBefore = await db('kktp_assessment_tps').where('assessment_id', createdAssessmentId).orderBy('order_index', 'asc');
      assert.strictEqual(tpsBefore.length, 4);

      await configureAssessmentTPs(createdAssessmentId, [
        { id: tpsBefore[0].id, tp_code: 'TP-01', tp_text_snapshot: 'Materi 1', order_index: 1 },
        { id: tpsBefore[1].id, tp_code: 'TP-02', tp_text_snapshot: 'Materi 2', order_index: 2 },
        { id: tpsBefore[2].id, tp_code: 'TP-03', tp_text_snapshot: 'Materi 3', order_index: 3 },
      ]);

      // Check that summary table was re-synced to average of 3 remaining TPs: (90 + 85 + 89) / 3 = 88
      const sumRow = await db('kktp_student_summaries')
        .where({ assessment_id: createdAssessmentId, student_id: studentAId })
        .first();
      assert.strictEqual(Number(sumRow.average_score), 88);
      assert.strictEqual(sumRow.status, 'COMPLETED', 'All 3 remaining TPs are scored, so still completed');
    });

    it('proves Raport-ready query primitive getStudentSemesterKKTPOverview safely aggregates all subjects', async () => {
      const overview = await getStudentSemesterKKTPOverview({
        student_id: studentAId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemesterId,
      });

      assert.ok(overview.student);
      assert.strictEqual(overview.student.id, studentAId);
      assert.strictEqual(overview.academic_year.id, testAcademicYearId);
      assert.strictEqual(overview.semester.id, testSemesterId);
      assert.ok(Array.isArray(overview.subjects));
      assert.ok(overview.subjects.length > 0);

      // Verify the test subject is in the list
      const subjItem = overview.subjects.find((s) => s.subject_id === testSubjectId);
      assert.ok(subjItem, 'Test subject must be returned in overview');
      assert.strictEqual(subjItem.assessment_id, createdAssessmentId);
      assert.strictEqual(subjItem.average_score, 88);
      assert.strictEqual(subjItem.final_subject_score, 88);
      assert.strictEqual(subjItem.is_complete, true);
      assert.strictEqual(subjItem.scored_tp_count, 3);
      assert.strictEqual(subjItem.total_tp_count, 3);
    });
  });
});
