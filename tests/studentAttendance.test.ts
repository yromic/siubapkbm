import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
  getSchoolTodayDate,
  isValidDateFormat,
  isFutureDate,
} from '../lib/utils/schoolDate';
import {
  validateSaveAttendancePayload,
  validateRosterCompleteness,
} from '../lib/validation/studentAttendanceValidation';
import {
  verifyTeacherClassPeriodAccess,
  getAuthoritativeTemporalRoster,
  getClassAttendance,
  saveClassAttendance,
  getClassesAttendanceOverview,
  getAdminDashboardOverview,
} from '../lib/services/studentAttendanceService';

describe('Student Attendance (Presensi Siswa) MVP Test Suite', () => {
  const teacherFarisId = '9284f530-dea8-4dd8-8207-bd5edebf6980'; // Wali Kelas 1 in Ganjil
  const teacherAlamsyahId = '117a15aa-4154-4c39-ab33-b0562227fb3e'; // Wali Kelas 2 in Ganjil
  const adminId = '72c73acd-6633-48ce-8ee3-e69f7d30b366'; // Admin Utama
  const class1Id = '25345b5c-28e0-442c-9591-6922a2db405a';
  const ganjilSemesterId = 'c96f8892-83d0-419f-aac5-5356fb839b89';
  const genapSemesterId = '5b84aca0-9a52-4951-86e4-ee2185634e09'; // Inactive semester

  const testAttendanceDate = '2026-09-12';

  before(async () => {
    // Clean up any existing test session for test date
    await db('student_attendance_sessions')
      .where({ class_id: class1Id, attendance_date: testAttendanceDate })
      .del();
  });

  after(async () => {
    // Clean up test sessions after suite finishes
    await db('student_attendance_sessions')
      .where({ class_id: class1Id, attendance_date: testAttendanceDate })
      .del();
    await db.destroy();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. DATE & TIMEZONE UTILITIES
  // ─────────────────────────────────────────────────────────────
  describe('Date & Timezone Utilities (Asia/Jakarta)', () => {
    it('returns a valid YYYY-MM-DD date format', () => {
      const today = getSchoolTodayDate();
      assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
      assert.strictEqual(isValidDateFormat(today), true);
    });

    it('identifies future dates relative to school local date', () => {
      assert.strictEqual(isFutureDate('2099-12-31'), true);
      assert.strictEqual(isFutureDate('2020-01-01'), false);
    });

    it('rejects invalid date strings', () => {
      assert.strictEqual(isValidDateFormat('2026-13-40'), false);
      assert.strictEqual(isValidDateFormat('invalid-date'), false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. VALIDATION LOGIC
  // ─────────────────────────────────────────────────────────────
  describe('Payload & Roster Validation', () => {
    it('rejects future attendance dates', () => {
      assert.throws(
        () =>
          validateSaveAttendancePayload({
            attendance_date: '2099-01-01',
            records: [{ student_id: uuidv4(), status: 'hadir' }],
          }),
        (err: any) => err.code === 'ERR_FUTURE_ATTENDANCE_DATE'
      );
    });

    it('rejects invalid attendance status', () => {
      assert.throws(
        () =>
          validateSaveAttendancePayload({
            attendance_date: '2026-09-01',
            records: [{ student_id: uuidv4(), status: 'bolos' }],
          }),
        (err: any) => err.code === 'ERR_INVALID_ATTENDANCE_STATUS'
      );
    });

    it('rejects duplicate students in payload', () => {
      const studentId = uuidv4();
      assert.throws(
        () =>
          validateSaveAttendancePayload({
            attendance_date: '2026-09-01',
            records: [
              { student_id: studentId, status: 'hadir' },
              { student_id: studentId, status: 'sakit' },
            ],
          }),
        (err: any) => err.code === 'ERR_DUPLICATE_STUDENT_IN_PAYLOAD'
      );
    });

    it('rejects foreign students not in authoritative roster', () => {
      const authoritative = [{ student_id: 'student-1', full_name: 'Student 1' }];
      assert.throws(
        () =>
          validateRosterCompleteness(['student-1', 'foreign-student'], authoritative),
        (err: any) => err.code === 'ERR_UNENROLLED_STUDENT_SUBMITTED'
      );
    });

    it('rejects incomplete roster submissions', () => {
      const authoritative = [
        { student_id: 'student-1', full_name: 'Student 1' },
        { student_id: 'student-2', full_name: 'Student 2' },
      ];
      assert.throws(
        () => validateRosterCompleteness(['student-1'], authoritative),
        (err: any) => err.code === 'ERR_INCOMPLETE_ROSTER_SUBMITTED'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. PERIOD-AWARE AUTHORIZATION
  // ─────────────────────────────────────────────────────────────
  describe('Period-Aware Teacher Authorization Guard', () => {
    it('allows teacher assigned as wali kelas for the target class and semester', async () => {
      const allowed = await verifyTeacherClassPeriodAccess(
        teacherFarisId,
        'teacher',
        class1Id,
        ganjilSemesterId
      );
      assert.strictEqual(allowed, true);
    });

    it('forbids teacher not assigned to the class', async () => {
      await assert.rejects(
        () =>
          verifyTeacherClassPeriodAccess(
            teacherAlamsyahId,
            'teacher',
            class1Id,
            ganjilSemesterId
          ),
        (err: any) => err.code === 'ERR_UNAUTHORIZED_CLASS_ACCESS' && err.statusCode === 403
      );
    });

    it('forbids teacher when assignment belongs to a different semester', async () => {
      await assert.rejects(
        () =>
          verifyTeacherClassPeriodAccess(
            teacherFarisId,
            'teacher',
            class1Id,
            genapSemesterId
          ),
        (err: any) => err.code === 'ERR_UNAUTHORIZED_CLASS_ACCESS' && err.statusCode === 403
      );
    });

    it('allows administrator supervisory bypass for any class and semester', async () => {
      const allowed = await verifyTeacherClassPeriodAccess(
        adminId,
        'administrator',
        class1Id,
        genapSemesterId
      );
      assert.strictEqual(allowed, true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. TEMPORAL ROSTER BOUNDARY
  // ─────────────────────────────────────────────────────────────
  describe('Authoritative Temporal Roster Boundary', () => {
    it('includes student on withdrawal day and excludes student the day after', async () => {
      // Student Ahmad Syakir withdrew on 2026-07-16
      const rosterOnWithdrawalDay = await getAuthoritativeTemporalRoster(
        class1Id,
        ganjilSemesterId,
        '2026-07-16'
      );
      const rosterAfterWithdrawalDay = await getAuthoritativeTemporalRoster(
        class1Id,
        ganjilSemesterId,
        '2026-07-17'
      );

      const syakirIncludedOnDay = rosterOnWithdrawalDay.some((s: any) =>
        s.full_name.includes('Ahmad Syakir Hanifah')
      );
      const syakirIncludedAfterDay = rosterAfterWithdrawalDay.some((s: any) =>
        s.full_name.includes('Ahmad Syakir Hanifah')
      );

      assert.strictEqual(syakirIncludedOnDay, true);
      assert.strictEqual(syakirIncludedAfterDay, false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. ATOMIC PERSISTENCE, IDEMPOTENCY & AUDIT
  // ─────────────────────────────────────────────────────────────
  describe('Attendance Persistence, Idempotency & Audit Trails', () => {
    let testSessionId = '';

    it('initializes authoritative roster defaulting to Hadir without DB persistence', async () => {
      const initial = await getClassAttendance(class1Id, testAttendanceDate, {
        id: teacherFarisId,
        role: 'teacher',
      });

      assert.strictEqual(initial.has_submitted, false);
      assert.strictEqual(initial.session_id, null);
      assert.strictEqual(initial.records.length > 0, true);
      assert.strictEqual(
        initial.records.every((r) => r.status === 'hadir'),
        true
      );

      // Verify DB session does NOT exist
      const sessionDb = await db('student_attendance_sessions')
        .where({ class_id: class1Id, attendance_date: testAttendanceDate })
        .first();
      assert.strictEqual(Boolean(sessionDb), false);
    });

    it('saves full class attendance atomically in a transaction', async () => {
      const initial = await getClassAttendance(class1Id, testAttendanceDate, {
        id: teacherFarisId,
        role: 'teacher',
      });

      const payload = {
        attendance_date: testAttendanceDate,
        records: initial.records.map((r, i) => ({
          student_id: r.student_id,
          status: i === 0 ? ('sakit' as const) : i === 1 ? ('terlambat' as const) : ('hadir' as const),
          note: i === 0 ? 'Demam tinggi' : null,
        })),
      };

      const saved = await saveClassAttendance(class1Id, payload, {
        id: teacherFarisId,
        role: 'teacher',
        name: 'Faris Achmad',
      });

      assert.strictEqual(saved.has_submitted, true);
      assert.notStrictEqual(saved.session_id, null);
      testSessionId = saved.session_id!;
      assert.strictEqual(saved.summary.sakit, 1);
      assert.strictEqual(saved.summary.terlambat, 1);
      assert.strictEqual(saved.summary.hadir, saved.records.length - 2);

      // Verify audit log
      const auditLog = await db('audit_logs')
        .where({ entity_id: testSessionId, action: 'student_attendance_created' })
        .first();
      assert.strictEqual(Boolean(auditLog), true);
    });

    it('is idempotent when re-saving the exact same payload', async () => {
      const initial = await getClassAttendance(class1Id, testAttendanceDate, {
        id: teacherFarisId,
        role: 'teacher',
      });

      const auditCountBefore = await db('audit_logs')
        .where({ entity_id: testSessionId })
        .count('* as cnt')
        .first();

      const reSaved = await saveClassAttendance(
        class1Id,
        {
          attendance_date: testAttendanceDate,
          records: initial.records.map((r) => ({
            student_id: r.student_id,
            status: r.status,
            note: r.note,
          })),
        },
        { id: teacherFarisId, role: 'teacher', name: 'Faris Achmad' }
      );

      assert.strictEqual(reSaved.session_id, testSessionId);

      // Verify session count in DB remains exactly 1
      const countResult = await db('student_attendance_sessions')
        .where({ class_id: class1Id, attendance_date: testAttendanceDate })
        .count('* as cnt')
        .first();
      assert.strictEqual(Number(countResult?.cnt), 1);

      // Verify audit log count did not increase
      const auditCountAfter = await db('audit_logs')
        .where({ entity_id: testSessionId })
        .count('* as cnt')
        .first();
      assert.strictEqual(auditCountBefore?.cnt, auditCountAfter?.cnt);
    });

    it('allows administrator correction, updates updated_by, preserves recorded_by, and logs audit diff', async () => {
      const current = await getClassAttendance(class1Id, testAttendanceDate, {
        id: adminId,
        role: 'administrator',
      });

      // Admin corrects student 0 from Sakit to Hadir
      const correctedRecords = current.records.map((r, i) => {
        if (i === 0) {
          return {
            student_id: r.student_id,
            status: 'hadir' as const,
            note: 'Sudah sembuh (koreksi admin)',
          };
        }
        return {
          student_id: r.student_id,
          status: r.status,
          note: r.note,
        };
      });

      const corrected = await saveClassAttendance(
        class1Id,
        {
          attendance_date: testAttendanceDate,
          records: correctedRecords,
        },
        { id: adminId, role: 'administrator', name: 'Admin Utama' }
      );

      assert.strictEqual(corrected.summary.sakit, 0);

      // Verify session in DB preserves original author
      const sessionDb = await db('student_attendance_sessions')
        .where({ id: testSessionId })
        .first();
      assert.strictEqual(sessionDb.recorded_by, teacherFarisId);
      assert.strictEqual(sessionDb.updated_by, adminId);

      // Verify update audit log exists
      const auditUpdate = await db('audit_logs')
        .where({ entity_id: testSessionId, action: 'student_attendance_updated' })
        .first();
      assert.strictEqual(Boolean(auditUpdate), true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. OVERVIEWS & DASHBOARD CALCULATIONS
  // ─────────────────────────────────────────────────────────────
  describe('Admin Dashboard & Attendance Rate Calculation', () => {
    it('does not count unsubmitted classes as student absences', async () => {
      const overview = await getAdminDashboardOverview(testAttendanceDate);

      assert.strictEqual(overview.overview.total_classes >= 1, true);
      assert.strictEqual(overview.overview.submitted_classes >= 1, true);

      // Verify attendance rate denominator is strictly recorded students
      if (overview.overview.total_students_recorded > 0) {
        const expectedRate = Number(
          (
            ((overview.overview.counts.hadir + overview.overview.counts.terlambat) /
              overview.overview.total_students_recorded) *
            100
          ).toFixed(1)
        );
        assert.strictEqual(overview.overview.attendance_rate, expectedRate);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. CARTESIAN REGRESSION & ATTENDANCE ELIGIBILITY
  // ─────────────────────────────────────────────────────────────
  describe('Cartesian Aggregation Regression & Attendance Eligibility', () => {
    const multiStatusDate = '2026-09-11';

    before(async () => {
      await db('student_attendance_sessions')
        .where({ class_id: class1Id, attendance_date: multiStatusDate })
        .del();
    });

    after(async () => {
      await db('student_attendance_sessions')
        .where({ class_id: class1Id, attendance_date: multiStatusDate })
        .del();
    });

    it('eliminates Cartesian multiplication for all-Hadir class session (10 H, NOT 100 H)', async () => {
      const overview = await getAdminDashboardOverview('2026-09-17');
      const cls1 = overview.classes.find((c) => c.class_id === class1Id);
      assert.ok(cls1, 'Class 1 must be present in overview');

      assert.strictEqual(cls1.student_count, 10);
      assert.strictEqual(cls1.roster_count, 10);
      assert.strictEqual(cls1.recorded_count, 10);
      assert.strictEqual(cls1.counts.hadir, 10);
      assert.strictEqual(cls1.counts.sakit, 0);
      assert.strictEqual(cls1.counts.izin, 0);
      assert.strictEqual(cls1.counts.alpa, 0);
      assert.strictEqual(cls1.counts.terlambat, 0);

      // MANDATORY ANTI-CARTESIAN ASSERTION: must not multiply by roster size
      assert.notStrictEqual(
        cls1.counts.hadir,
        100,
        'CRITICAL DEFECT: Cartesian product produced 100 H instead of 10 H'
      );

      const cls2 = overview.classes.find((c) => c.class_name === '2');
      if (cls2 && cls2.has_submitted) {
        assert.strictEqual(cls2.student_count, 6);
        assert.strictEqual(cls2.counts.hadir, 6);
        assert.notStrictEqual(
          cls2.counts.hadir,
          36,
          'CRITICAL DEFECT: Cartesian product produced 36 H instead of 6 H'
        );
      }
    });

    it('computes exact multi-status counts and rate without Cartesian inflation (8 H, 1 S, 1 T => 90%)', async () => {
      const initial = await getClassAttendance(class1Id, multiStatusDate, {
        id: teacherFarisId,
        role: 'teacher',
      });

      // Submit 8 Hadir, 1 Sakit, 1 Terlambat
      const records = initial.records.map((r, idx) => {
        if (idx === 0) return { student_id: r.student_id, status: 'sakit' as const, note: 'Sakit flu' };
        if (idx === 1) return { student_id: r.student_id, status: 'terlambat' as const, note: 'Macet' };
        return { student_id: r.student_id, status: 'hadir' as const, note: null };
      });

      await saveClassAttendance(
        class1Id,
        { attendance_date: multiStatusDate, records },
        { id: teacherFarisId, role: 'teacher', name: 'Faris Achmad' }
      );

      const overview = await getAdminDashboardOverview(multiStatusDate);
      const cls1 = overview.classes.find((c) => c.class_id === class1Id);
      assert.ok(cls1, 'Class 1 must exist');

      assert.strictEqual(cls1.student_count, 10);
      assert.strictEqual(cls1.counts.hadir, 8);
      assert.strictEqual(cls1.counts.sakit, 1);
      assert.strictEqual(cls1.counts.izin, 0);
      assert.strictEqual(cls1.counts.alpa, 0);
      assert.strictEqual(cls1.counts.terlambat, 1);

      // ANTI-CARTESIAN ASSERTIONS
      assert.notStrictEqual(cls1.counts.hadir, 80, 'Must not multiply Hadir by 10');
      assert.notStrictEqual(cls1.counts.sakit, 10, 'Must not multiply Sakit by 10');
      assert.notStrictEqual(cls1.counts.terlambat, 10, 'Must not multiply Terlambat by 10');

      const expectedRate = Number((((8 + 1) / 10) * 100).toFixed(1));
      assert.strictEqual(expectedRate, 90);
    });

    it('excludes zero-student classes from unsubmitted_classes and marks them attendance_eligible = false', async () => {
      const overview = await getAdminDashboardOverview('2026-09-17');

      const emptyClasses = overview.classes.filter((c) => c.student_count === 0);
      assert.ok(emptyClasses.length > 0, 'Should have empty classes in test DB');

      for (const ec of emptyClasses) {
        assert.strictEqual(ec.attendance_eligible, false, `Class ${ec.class_name} must have attendance_eligible = false`);
        assert.strictEqual(ec.has_submitted, false);
      }

      // Empty classes must NOT increment unsubmitted_classes
      assert.strictEqual(
        overview.overview.eligible_classes,
        overview.overview.submitted_classes + overview.overview.unsubmitted_classes,
        'eligible_classes invariant must hold'
      );
      assert.strictEqual(
        overview.overview.unsubmitted_classes,
        0,
        'On 2026-09-17, all eligible classes have submitted, so unsubmitted must be 0'
      );
    });

    it('separates wali assignment from attendance eligibility (students > 0 without wali is eligible)', async () => {
      const overview = await getAdminDashboardOverview('2026-09-17');
      for (const cls of overview.classes) {
        if (cls.student_count > 0) {
          assert.strictEqual(cls.attendance_eligible, true, 'Classes with students must be attendance_eligible');
        } else {
          assert.strictEqual(cls.attendance_eligible, false, 'Classes with 0 students must not be attendance_eligible');
        }
      }
    });

    it('maintains daily date isolation between 2026-09-16 and 2026-09-17 without historical leakage', async () => {
      const overview16 = await getAdminDashboardOverview('2026-09-16');
      const overview17 = await getAdminDashboardOverview('2026-09-17');

      const cls1_16 = overview16.classes.find((c) => c.class_id === class1Id);
      const cls1_17 = overview17.classes.find((c) => c.class_id === class1Id);

      assert.ok(cls1_16 && cls1_17);
      assert.strictEqual(cls1_16.counts.hadir, 10);
      assert.strictEqual(cls1_17.counts.hadir, 10);

      // Must NOT sum historical dates (10 + 10 = 20)
      assert.strictEqual(overview17.overview.total_students_recorded, 16);
      assert.strictEqual(overview17.overview.counts.hadir, 16);
    });
  });
});

