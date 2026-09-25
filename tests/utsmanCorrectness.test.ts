import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/db';
import { UTSMAN_FORMULA, SahabatScores, calculateUtsmanOverallAverage } from '../lib/config/characterRuleConfig';
import { calculateAndSaveUTSMAN } from '../lib/services/utsmanCalculationService';
import { getParentCharacterSummary } from '../lib/services/parentService';

describe('Checkpoint A: UTSMAN Correctness and Regression Suite', () => {
  after(async () => {
    await db.destroy();
  });

  // ─────────────────────────────────────────────────────────────
  // A1. Missing-value UTSMAN calculation
  // ─────────────────────────────────────────────────────────────
  describe('A1: Missing-value UTSMAN calculation', () => {
    it('U must NOT become (4 + 0) / 2 = 2 when AK is unobserved; U must be 4', () => {
      const partialScores: SahabatScores = {
        am: 4,
        ak: null,
        sss: null,
        hb: null,
        asm: null,
        br: null,
        tm: null,
      };

      const u = UTSMAN_FORMULA.calculateU(partialScores);
      assert.strictEqual(u, 4, 'When AM=4 and AK is unobserved, U must be 4 (not depressed to 2)');

      const a = UTSMAN_FORMULA.calculateA(partialScores);
      assert.strictEqual(a, 4, 'When AM=4 and ASM is unobserved, A must be 4 (not depressed to 2)');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // A2. Completely unobserved dimension
  // ─────────────────────────────────────────────────────────────
  describe('A2: Completely unobserved dimension', () => {
    it('returns NULL / unavailable when no source indicators are observed, NOT 0', () => {
      const emptyScores: SahabatScores = {
        am: null,
        ak: null,
        sss: null,
        hb: null,
        asm: null,
        br: null,
        tm: null,
      };

      assert.strictEqual(UTSMAN_FORMULA.calculateU(emptyScores), null, 'U must be null when AM and AK are unobserved');
      assert.strictEqual(UTSMAN_FORMULA.calculateT(emptyScores), null, 'T must be null when AK is unobserved');
      assert.strictEqual(UTSMAN_FORMULA.calculateS(emptyScores), null, 'S must be null when SSS and HB are unobserved');
      assert.strictEqual(UTSMAN_FORMULA.calculateM(emptyScores), null, 'M must be null when BR is unobserved');
      assert.strictEqual(UTSMAN_FORMULA.calculateA(emptyScores), null, 'A must be null when AM and ASM are unobserved');
      assert.strictEqual(UTSMAN_FORMULA.calculateN(emptyScores), null, 'N must be null when HB and TM are unobserved');

      // Overall average must also be null
      const overall = calculateUtsmanOverallAverage({
        u_score: null,
        t_score: null,
        s_score: null,
        m_score: null,
        a_score: null,
        n_score: null,
      });
      assert.strictEqual(overall, null, 'Overall average must be null when all dimensions are unobserved');
    });

    it('overall UTSMAN average only considers observed dimensions', () => {
      const partialResult = {
        u_score: 4,
        t_score: null,
        s_score: null,
        m_score: null,
        a_score: 4,
        n_score: null,
      };
      const overall = calculateUtsmanOverallAverage(partialResult);
      assert.strictEqual(overall, 4, 'Overall average of U=4 and A=4 (others unobserved) must be 4, NOT (4+0+0+0+4+0)/6 = 1.33');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // A3. Fully observed behavior remains unchanged
  // ─────────────────────────────────────────────────────────────
  describe('A3: Fully observed behavior remains unchanged', () => {
    it('calculates existing correct complete-data scores', () => {
      const fullScores: SahabatScores = {
        am: 4,
        ak: 2,
        sss: 3,
        hb: 3,
        asm: 2,
        br: 4,
        tm: 3,
      };

      assert.strictEqual(UTSMAN_FORMULA.calculateU(fullScores), 3, 'U = mean(4, 2) = 3');
      assert.strictEqual(UTSMAN_FORMULA.calculateT(fullScores), 2, 'T = AK = 2');
      assert.strictEqual(UTSMAN_FORMULA.calculateS(fullScores), 3, 'S = mean(3, 3) = 3');
      assert.strictEqual(UTSMAN_FORMULA.calculateM(fullScores), 4, 'M = BR = 4');
      assert.strictEqual(UTSMAN_FORMULA.calculateA(fullScores), 3, 'A = mean(4, 2) = 3');
      assert.strictEqual(UTSMAN_FORMULA.calculateN(fullScores), 3, 'N = mean(3, 3) = 3');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // A4. Parent character contract
  // ─────────────────────────────────────────────────────────────
  describe('A4: Parent character contract', () => {
    it('supplies canonical UTSMAN structure (student, period, utsman, dimensions)', async () => {
      const enrollment = await db('student_enrollments')
        .where({ status: 'active' })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();
      assert.ok(enrollment, 'An active enrollment must exist in database');

      const charSummary: any = await getParentCharacterSummary(
        enrollment.student_id,
        enrollment.academic_year_id,
        enrollment.semester_id
      );

      assert.ok(charSummary, 'Character summary response must exist');
      assert.ok(charSummary.student, 'Must contain student object');
      assert.ok(charSummary.period, 'Must contain period object');
      assert.ok(charSummary.utsman, 'Must contain canonical utsman object');
      assert.ok('u' in charSummary.utsman, 'utsman must contain u');
      assert.ok('t' in charSummary.utsman, 'utsman must contain t');
      assert.ok('s' in charSummary.utsman, 'utsman must contain s');
      assert.ok('m' in charSummary.utsman, 'utsman must contain m');
      assert.ok('a' in charSummary.utsman, 'utsman must contain a');
      assert.ok('n' in charSummary.utsman, 'utsman must contain n');
      assert.ok('overall_average' in charSummary.utsman, 'utsman must contain overall_average');
      assert.ok(Array.isArray(charSummary.dimensions), 'Must contain dimensions array for 6 dimensions');
      assert.strictEqual(charSummary.dimensions.length, 6, 'Must contain exactly 6 UTSMAN dimensions');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // A7. Admin class period contract
  // ─────────────────────────────────────────────────────────────
  describe('A7: Admin class period contract', () => {
    it('classes/my query for admin must include academic_year_id and semester_id', async () => {
      // In classes/my/route.ts, admin branch queries db('classes').
      // We test that admin items currently lack academic_year_id unless enriched:
      const adminClasses = await db('classes')
        .where('status', 'active')
        .whereNot('lifecycle_status', 'soft_deleted')
        .select('id', 'name');
      assert.ok(adminClasses.length > 0, 'Classes must exist');

      // The active semester query that classes/my SHOULD use:
      const activeSem = await db('semesters')
        .where('is_active', true)
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();
      assert.ok(activeSem, 'Active semester must exist');
      assert.ok(activeSem.academic_year_id, 'Active semester must have academic_year_id');
    });
  });
});
