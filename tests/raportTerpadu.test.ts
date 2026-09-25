import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateAcademicOverallAverage,
  getAcademicCategory,
  generateRaportDocumentNumber,
} from '../lib/utils/raportCalculationUtils';
import {
  getRaportTerpaduAcademicSummary,
  getClassRaportReadiness,
  saveSemesterTutorNote,
} from '../lib/services/raportTerpaduService';
import {
  getOrCreateKKTPAssessment,
  configureAssessmentTPs,
  saveKKTPMatrixScores,
} from '../lib/services/kktpAssessmentService';

describe('Raport Terpadu — Core & Lembar 1 Architecture Test Suite', () => {
  let testClassId: string;
  let testSubjectMathId: string;
  let testSubjectIndoId: string;
  let testSubjectPancasilaId: string;
  let testAcademicYearId: string;
  let testSemester1Id: string;
  let testSemester2Id: string;
  let studentAId: string;
  let studentBId: string;
  let mathAssessmentId: string;
  let indoAssessmentId: string;
  let mathTpIds: string[] = [];
  let indoTpIds: string[] = [];

  before(async () => {
    // 1. Resolve or create active academic year & semesters
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

    let sem1 = await db('semesters').where({ academic_year_id: testAcademicYearId, is_active: 1 }).first();
    if (!sem1) {
      const semId = uuidv4();
      await db('semesters').insert({
        id: semId,
        academic_year_id: testAcademicYearId,
        name: 'Semester 1 (Ganjil)',
        is_active: 1,
        created_at: new Date(),
        updated_at: new Date(),
      });
      sem1 = { id: semId };
    }
    testSemester1Id = sem1.id;

    // Semester 2 for isolation testing
    let sem2 = await db('semesters').where({ academic_year_id: testAcademicYearId, is_active: 0 }).first();
    if (!sem2) {
      const sem2Id = uuidv4();
      await db('semesters').insert({
        id: sem2Id,
        academic_year_id: testAcademicYearId,
        name: 'Semester 2 (Genap)',
        is_active: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
      sem2 = { id: sem2Id };
    }
    testSemester2Id = sem2.id;

    // Clean up any stale records from previous interrupted runs
    const staleClasses = await db('classes').where('name', 'like', '%Raport Test%').select('id');
    const staleClassIds = staleClasses.map((c: any) => c.id);
    if (staleClassIds.length > 0) {
      await db('class_subjects').whereIn('class_id', staleClassIds).delete();
      await db('student_enrollments').whereIn('class_id', staleClassIds).delete();
      await db('classes').whereIn('id', staleClassIds).delete();
    }
    await db('subjects').where('name', 'like', '%Raport Test%').delete();

    const runId = uuidv4().slice(0, 6);

    // 2. Create test class
    testClassId = uuidv4();
    await db('classes').insert({
      id: testClassId,
      name: `Kelas 10 Raport Test ${runId}`,
      code: `K10R_${runId}`,
      level: 10,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 3. Create test subjects
    testSubjectMathId = uuidv4();
    await db('subjects').insert({
      id: testSubjectMathId,
      name: `Matematika Raport Test ${runId}`,
      code: `MTK_${runId}`,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    testSubjectIndoId = uuidv4();
    await db('subjects').insert({
      id: testSubjectIndoId,
      name: `Bahasa Indonesia Raport Test ${runId}`,
      code: `BIN_${runId}`,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    testSubjectPancasilaId = uuidv4();
    await db('subjects').insert({
      id: testSubjectPancasilaId,
      name: `Pancasila Raport Test ${runId}`,
      code: `PAN_${runId}`,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 4. Map class_subjects for the class (so discovery knows exactly these 3 subjects belong to the class)
    await db('class_subjects').insert([
      {
        id: uuidv4(),
        class_id: testClassId,
        subject_id: testSubjectMathId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        class_id: testClassId,
        subject_id: testSubjectIndoId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        class_id: testClassId,
        subject_id: testSubjectPancasilaId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // 5. Create test students & enrollments
    studentAId = uuidv4();
    await db('students').insert({
      id: studentAId,
      full_name: 'Santri A Raport Test',
      nisn: '9900112233',
      gender: 'L',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    studentBId = uuidv4();
    await db('students').insert({
      id: studentBId,
      full_name: 'Santri B Raport Test',
      nisn: '9900112244',
      gender: 'P',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Enrol students in class for Semester 1
    await db('student_enrollments').insert([
      {
        id: uuidv4(),
        student_id: studentAId,
        class_id: testClassId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        student_id: studentBId,
        class_id: testClassId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  });

  after(async () => {
    // Clean up test data
    if (testClassId) {
      const assList = await db('kktp_assessments').where('class_id', testClassId).select('id');
      const aIds = assList.map((a: any) => a.id);
      if (aIds.length > 0) {
        await db('kktp_student_scores').whereIn('assessment_id', aIds).delete();
        await db('kktp_student_summaries').whereIn('assessment_id', aIds).delete();
        await db('kktp_assessment_tps').whereIn('assessment_id', aIds).delete();
        await db('kktp_assessments').whereIn('id', aIds).delete();
      }
      await db('teacher_notes').whereIn('student_id', [studentAId, studentBId]).delete();
      await db('student_enrollments').whereIn('student_id', [studentAId, studentBId]).delete();
      await db('students').whereIn('id', [studentAId, studentBId]).delete();
      await db('class_subjects').where('class_id', testClassId).delete();
      await db('subjects').whereIn('id', [testSubjectMathId, testSubjectIndoId, testSubjectPancasilaId]).delete();
      await db('classes').where('id', testClassId).delete();
    }
  });

  // ─── 1. PURE DOMAIN CALCULATION LOGIC ───────────────────────────────────────
  describe('1. Pure Domain Calculation Logic', () => {
    it('calculates academic overall average correctly across complete subjects: 91, 84, 88 -> 87.7', () => {
      const avg = calculateAcademicOverallAverage([91, 84, 88]);
      assert.strictEqual(avg, 87.7);
    });

    it('calculates average correctly for standard 9-subject report card: 91, 84, 88, 91, 84, 95, 85, 89, 95 -> 89.1', () => {
      const avg = calculateAcademicOverallAverage([91, 84, 88, 91, 84, 95, 85, 89, 95]);
      assert.strictEqual(avg, 89.1);
    });

    it('strictly excludes null or undefined scores from the divisor', () => {
      const avg = calculateAcademicOverallAverage([90, null, 80, undefined]);
      assert.strictEqual(avg, 85.0);
    });

    it('returns null when scores array is empty or contains only nulls', () => {
      assert.strictEqual(calculateAcademicOverallAverage([]), null);
      assert.strictEqual(calculateAcademicOverallAverage([null, null]), null);
    });

    it('resolves canonical academic categories according to PKBM standard thresholds', () => {
      assert.strictEqual(getAcademicCategory(95)?.label, 'Sangat Baik');
      assert.strictEqual(getAcademicCategory(90)?.label, 'Sangat Baik');
      assert.strictEqual(getAcademicCategory(89.1)?.label, 'Baik');
      assert.strictEqual(getAcademicCategory(75)?.label, 'Baik');
      assert.strictEqual(getAcademicCategory(65)?.label, 'Cukup');
      assert.strictEqual(getAcademicCategory(55)?.label, 'Perlu Bimbingan');
      assert.strictEqual(getAcademicCategory(null), null);
    });

    it('formats authoritative document numbers correctly', () => {
      const docNum = generateRaportDocumentNumber('2026/2027', 'Semester 1', 'Kelas 10', '00123');
      assert.strictEqual(docNum, 'BLC/RAPORT/20262027/SEME/KELAS1/0123');
    });
  });

  // ─── 2. COMPLETION SEMANTICS & ISOLATION IN LEMBAR 1 ────────────────────────
  describe('2. Subject Completion Semantics & Isolation', () => {
    it('creates KKTP assessment for Math and configures 4 shared TPs', async () => {
      const ass = await getOrCreateKKTPAssessment({
        class_id: testClassId,
        subject_id: testSubjectMathId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
        title: 'Penilaian Matematika Semester 1',
      });
      mathAssessmentId = ass.id;
      assert.ok(mathAssessmentId);

      await configureAssessmentTPs(mathAssessmentId, [
        { tp_code: 'TP-M1', tp_text_snapshot: 'Memahami Aljabar Linier', order_index: 1 },
        { tp_code: 'TP-M2', tp_text_snapshot: 'Menyelesaikan Persamaan Kuadrat', order_index: 2 },
        { tp_code: 'TP-M3', tp_text_snapshot: 'Aplikasi Geometri Ruang', order_index: 3 },
        { tp_code: 'TP-M4', tp_text_snapshot: 'Statistika dan Probabilitas', order_index: 4 },
      ]);
      const mathRows = await db('kktp_assessment_tps')
        .where('assessment_id', mathAssessmentId)
        .orderBy('order_index', 'asc');
      mathTpIds = mathRows.map((t: any) => t.id);
      assert.strictEqual(mathTpIds.length, 4);
    });

    it('proves complete subject (4/4 TP): 90, 85, 89, 88 -> average 88 -> final_score is 88', async () => {
      // Score all 4 TPs for Student A
      await saveKKTPMatrixScores(mathAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [mathTpIds[0]]: { score: 90 },
            [mathTpIds[1]]: { score: 85 },
            [mathTpIds[2]]: { score: 89 },
            [mathTpIds[3]]: { score: 88 },
          },
          competency_description: 'Sangat menguasai konsep aljabar dan geometri.',
        },
      ]);

      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      const mathRow = report.subjects.find((s) => s.subject_id === testSubjectMathId);
      assert.ok(mathRow);
      assert.strictEqual(mathRow.is_complete, true);
      assert.strictEqual(mathRow.final_score, 88);
      assert.strictEqual(mathRow.provisional_average, null);
      assert.strictEqual(mathRow.scored_tp_count, 4);
      assert.strictEqual(mathRow.total_tp_count, 4);
      assert.strictEqual(mathRow.competency_description, 'Sangat menguasai konsep aljabar dan geometri.');
    });

    it('proves partial subject (2/4 TP): 90, 80, null, null -> provisional 85 -> final_score is STRICTLY NULL', async () => {
      // Create and configure Indonesian subject with 4 TPs
      const indoAss = await getOrCreateKKTPAssessment({
        class_id: testClassId,
        subject_id: testSubjectIndoId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
      });
      indoAssessmentId = indoAss.id;

      await configureAssessmentTPs(indoAssessmentId, [
        { tp_code: 'TP-B1', tp_text_snapshot: 'Menulis Teks Prosedur', order_index: 1 },
        { tp_code: 'TP-B2', tp_text_snapshot: 'Menganalisis Teks Eksplanasi', order_index: 2 },
        { tp_code: 'TP-B3', tp_text_snapshot: 'Menyusun Cerita Pendek', order_index: 3 },
        { tp_code: 'TP-B4', tp_text_snapshot: 'Debat dan Retorika', order_index: 4 },
      ]);
      const indoRows = await db('kktp_assessment_tps')
        .where('assessment_id', indoAssessmentId)
        .orderBy('order_index', 'asc');
      indoTpIds = indoRows.map((t: any) => t.id);

      // Score only 2 of 4 TPs for Student A (90, 80)
      await saveKKTPMatrixScores(indoAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [indoTpIds[0]]: { score: 90 },
            [indoTpIds[1]]: { score: 80 },
            [indoTpIds[2]]: { score: null },
            [indoTpIds[3]]: { score: null },
          },
        },
      ]);

      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      const indoRow = report.subjects.find((s) => s.subject_id === testSubjectIndoId);
      assert.ok(indoRow);
      assert.strictEqual(indoRow.is_complete, false);
      assert.strictEqual(indoRow.scored_tp_count, 2);
      assert.strictEqual(indoRow.total_tp_count, 4);
      assert.strictEqual(indoRow.provisional_average, 85);
      // CRITICAL INVARIANT: Incomplete assessment does NOT yield a final report score!
      assert.strictEqual(indoRow.final_score, null);
    });

    it('proves empty subject (0/4 TP) has provisional null and final_score null', async () => {
      // Student B has no scores yet in Indonesian
      const reportB = await getRaportTerpaduAcademicSummary({
        studentId: studentBId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      const indoRow = reportB.subjects.find((s) => s.subject_id === testSubjectIndoId);
      assert.ok(indoRow);
      assert.strictEqual(indoRow.is_complete, false);
      assert.strictEqual(indoRow.scored_tp_count, 0);
      assert.strictEqual(indoRow.total_tp_count, 4);
      assert.strictEqual(indoRow.provisional_average, null);
      assert.strictEqual(indoRow.final_score, null);
    });
  });

  // ─── 3. MISSING ASSESSMENTS & READINESS RULES ────────────────────────────────
  describe('3. Missing Subject Assessments & Raport Readiness', () => {
    it('discovers Pancasila from class configuration even though no KKTP assessment exists yet', async () => {
      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      const pancasilaRow = report.subjects.find((s) => s.subject_id === testSubjectPancasilaId);
      assert.ok(pancasilaRow, 'Expected subject must not disappear from the report card');
      assert.strictEqual(pancasilaRow.assessment_id, null);
      assert.strictEqual(pancasilaRow.is_complete, false);
      assert.strictEqual(pancasilaRow.final_score, null);
    });

    it('flags report as INCOMPLETE when at least one required subject is incomplete or unassessed', async () => {
      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      assert.strictEqual(report.readiness.is_ready, false);
      assert.strictEqual(report.readiness.status, 'INCOMPLETE');
      assert.strictEqual(report.academic_summary.is_complete, false);
      // Overall average must NOT be published as complete when subjects are incomplete
      assert.strictEqual(report.academic_summary.overall_average, null);
      assert.strictEqual(report.academic_summary.completed_subject_count, 1); // Only Math is complete
      assert.strictEqual(report.academic_summary.total_subject_count, 3);
      assert.ok(report.readiness.reasons.length > 0);
    });

    it('marks report as READY with valid overall average when ALL subjects are complete', async () => {
      // 1. Complete Bahasa Indonesia for Student A: score remaining 2 TPs with 80 and 86 -> avg 84
      await saveKKTPMatrixScores(indoAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [indoTpIds[0]]: { score: 90 },
            [indoTpIds[1]]: { score: 80 },
            [indoTpIds[2]]: { score: 80 },
            [indoTpIds[3]]: { score: 86 },
          },
        },
      ]);

      // 2. Create and complete Pancasila for Student A: 2 TPs, 90 and 92 -> avg 91
      const pancasilaAss = await getOrCreateKKTPAssessment({
        class_id: testClassId,
        subject_id: testSubjectPancasilaId,
        academic_year_id: testAcademicYearId,
        semester_id: testSemester1Id,
      });
      await configureAssessmentTPs(pancasilaAss.id, [
        { tp_code: 'TP-P1', tp_text_snapshot: 'Penerapan Sila Pancasila', order_index: 1 },
        { tp_code: 'TP-P2', tp_text_snapshot: 'Harmonisasi Hak dan Kewajiban', order_index: 2 },
      ]);
      const pTpRows = await db('kktp_assessment_tps')
        .where('assessment_id', pancasilaAss.id)
        .orderBy('order_index', 'asc');

      await saveKKTPMatrixScores(pancasilaAss.id, [
        {
          student_id: studentAId,
          scores: {
            [pTpRows[0].id]: { score: 90 },
            [pTpRows[1].id]: { score: 92 },
          },
        },
      ]);

      // Now all 3 subjects (Math = 88, Indo = 84, Pancasila = 91) are complete!
      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      assert.strictEqual(report.readiness.is_ready, true);
      assert.strictEqual(report.readiness.status, 'READY');
      assert.strictEqual(report.academic_summary.is_complete, true);
      assert.strictEqual(report.academic_summary.completed_subject_count, 3);
      assert.strictEqual(report.academic_summary.total_subject_count, 3);
      // Math: 88, Indo: 84, Pancasila: 91 -> (88 + 84 + 91) / 3 = 87.7
      assert.strictEqual(report.academic_summary.overall_average, 87.7);
      assert.strictEqual(report.academic_summary.category?.label, 'Baik');
    });
  });

  // ─── 4. SOURCE OF TRUTH REGRESSION ──────────────────────────────────────────
  describe('4. Source of Truth Chain & Regression Invariant', () => {
    it('proves updating a TP score in KKTP immediately updates Raport Lembar 1 without duplicate manual entry', async () => {
      // Initial state: Math = 88, Indo = 84, Pancasila = 91 -> Overall = 87.7
      // Now update Math TP-M4 score for Student A from 88 to 96
      // New Math scores: 90, 85, 89, 96 -> average = 90
      await saveKKTPMatrixScores(mathAssessmentId, [
        {
          student_id: studentAId,
          scores: {
            [mathTpIds[0]]: { score: 90 },
            [mathTpIds[1]]: { score: 85 },
            [mathTpIds[2]]: { score: 89 },
            [mathTpIds[3]]: { score: 96 },
          },
        },
      ]);

      // Query Raport Terpadu Academic Summary
      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      const mathRow = report.subjects.find((s) => s.subject_id === testSubjectMathId);
      assert.strictEqual(mathRow?.final_score, 90, 'Math subject score must update immediately');
      assert.strictEqual(mathRow?.predicate?.label, 'Sangat Baik');

      // Math = 90, Indo = 84, Pancasila = 91 -> (90 + 84 + 91) / 3 = 265 / 3 = 88.3
      assert.strictEqual(report.academic_summary.overall_average, 88.3, 'Raport overall average must update deterministically');
    });
  });

  // ─── 5. SEMESTER & STUDENT ISOLATION ────────────────────────────────────────
  describe('5. Semester and Student Data Isolation', () => {
    it('isolates student scores: Student B does not inherit Student A scores', async () => {
      const reportB = await getRaportTerpaduAcademicSummary({
        studentId: studentBId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      const mathRow = reportB.subjects.find((s) => s.subject_id === testSubjectMathId);
      assert.strictEqual(mathRow?.final_score, null);
      assert.strictEqual(mathRow?.is_complete, false);
      assert.strictEqual(reportB.readiness.is_ready, false);
    });

    it('isolates semester scores: Semester 2 query rejects or excludes Semester 1 assessments', async () => {
      // Student A has no active enrollment in Semester 2
      await assert.rejects(
        async () => {
          await getRaportTerpaduAcademicSummary({
            studentId: studentAId,
            academicYearId: testAcademicYearId,
            semesterId: testSemester2Id,
          });
        },
        (err: any) => err.code === 'ERR_NOT_ENROLLED'
      );
    });
  });

  // ─── 6. SEMESTER TUTOR NOTE PERSISTENCE ─────────────────────────────────────
  describe('6. Semester Tutor Note Persistence', () => {
    it('persists and retrieves overall semester-level tutor note in teacher_notes', async () => {
      const saved = await saveSemesterTutorNote({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
        content: 'Ananda menunjukkan kemandirian belajar dan penalaran kritis yang luar biasa.',
      });

      assert.ok(saved.id);
      assert.strictEqual(saved.content, 'Ananda menunjukkan kemandirian belajar dan penalaran kritis yang luar biasa.');

      const report = await getRaportTerpaduAcademicSummary({
        studentId: studentAId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      assert.strictEqual(report.semester_tutor_note.id, saved.id);
      assert.strictEqual(report.semester_tutor_note.content, saved.content);
    });
  });

  // ─── 7. CLASS READINESS BATCH PERFORMANCE ───────────────────────────────────
  describe('7. Class Readiness Batch Performance & Evaluation', () => {
    it('evaluates readiness for all students in the class without N+1 query loop', async () => {
      const readiness = await getClassRaportReadiness({
        classId: testClassId,
        academicYearId: testAcademicYearId,
        semesterId: testSemester1Id,
      });

      assert.strictEqual(readiness.class_id, testClassId);
      assert.strictEqual(readiness.total_students, 2);
      assert.strictEqual(readiness.ready_students_count, 1); // Student A is ready
      assert.strictEqual(readiness.incomplete_students_count, 1); // Student B is incomplete
      assert.strictEqual(readiness.class_completion_percentage, 50);

      const stdA = readiness.students.find((s) => s.student_id === studentAId);
      assert.ok(stdA);
      assert.strictEqual(stdA.is_ready, true);
      assert.strictEqual(stdA.status, 'READY');
      assert.strictEqual(stdA.overall_average, 88.3);

      const stdB = readiness.students.find((s) => s.student_id === studentBId);
      assert.ok(stdB);
      assert.strictEqual(stdB.is_ready, false);
      assert.strictEqual(stdB.status, 'INCOMPLETE');
      assert.strictEqual(stdB.overall_average, null);
    });
  });
});
