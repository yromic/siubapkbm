import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/db';
import {
  getAdminDashboardAggregate,
  getTeacherDashboardAggregate,
} from '../lib/services/dashboardService';
import {
  getParentDashboard,
  getParentStudentAttendanceSummary,
  getParentAcademicSummary,
  getParentAcademicDetail,
} from '../lib/services/parentService';

describe('Dashboard Multi-Role Alignment Test Suite', () => {
  after(async () => {
    await db.destroy();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. TEACHER AUTHORIZATION (SEC-DASH-01) & AGGREGATE CONTRACT
  // ─────────────────────────────────────────────────────────────
  describe('Teacher Dashboard Contract & Authorization (SEC-DASH-01)', () => {
    it('generates a valid teacher dashboard aggregate for an authorized teacher', async () => {
      const teacher = await db('users')
        .where({ role: 'teacher' })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      assert.ok(teacher, 'At least one teacher must exist in the database');

      const data = await getTeacherDashboardAggregate(teacher.id);

      assert.ok(data.context, 'Must contain context');
      assert.strictEqual(data.context.teacher_id, teacher.id);
      assert.ok(data.context.teacher_name);
      assert.ok(data.today, 'Must contain today section');
      assert.ok(data.pending_work, 'Must contain pending work counts');
      assert.strictEqual(typeof data.pending_work.draft_assessments_count, 'number');
      assert.strictEqual(typeof data.pending_work.kktp_pending_count, 'number');
      assert.strictEqual(typeof data.pending_work.rpm_count, 'number');
      assert.strictEqual(typeof data.pending_work.trisula_draft_count, 'number');

      // Verify no fake timetable/schedule exists
      assert.strictEqual((data as any).schedule, undefined, 'No fake schedule contract permitted');
      assert.strictEqual((data as any).jadwal_mengajar, undefined, 'No fake jadwal_mengajar allowed');
    });

    it('rejects an invalid or missing teacher ID cleanly', async () => {
      await assert.rejects(
        async () => {
          await getTeacherDashboardAggregate('');
        },
        { name: 'AppError' }
      );

      await assert.rejects(
        async () => {
          await getTeacherDashboardAggregate('non-existent-uuid');
        },
        { name: 'AppError' }
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ADMIN DASHBOARD SERVER AGGREGATE CONTRACT
  // ─────────────────────────────────────────────────────────────
  describe('Admin Dashboard Aggregate Contract', () => {
    it('returns schoolwide operational overview without raw limit:1000 waterfalls', async () => {
      const data = await getAdminDashboardAggregate();

      assert.ok(data.context, 'Must contain academic period context');
      assert.ok(data.school_overview, 'Must contain school overview');
      assert.strictEqual(typeof data.school_overview.total_students, 'number');
      assert.strictEqual(typeof data.school_overview.total_teachers, 'number');
      assert.strictEqual(typeof data.school_overview.total_classes, 'number');

      assert.ok(data.today, 'Must contain today operasional');
      assert.ok(data.today.student_attendance, 'Must contain student attendance');
      assert.ok(data.today.teacher_attendance, 'Must contain teacher attendance');

      assert.ok(data.academic_completeness, 'Must contain academic completeness');
      assert.ok(data.academic_completeness.academic_scores, 'Must contain academic scores summary');
      assert.ok(data.academic_completeness.culture, 'Must contain culture completeness summary');
      assert.ok(data.academic_completeness.kktp, 'Must contain KKTP document existence summary');
      assert.ok(data.academic_completeness.rpm, 'Must contain RPM document count');
      assert.ok(data.academic_completeness.trisula, 'Must contain Trisula workflow summary');

      // Verify truthful KKTP semantics: no fake student mastery percentage
      assert.strictEqual(
        (data.academic_completeness.kktp as any).mastery_percent,
        undefined,
        'KKTP must not derive fake student mastery'
      );

      assert.ok(Array.isArray(data.actionable_alerts), 'Must contain actionable alerts list');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. PARENT DASHBOARD & ATTENDANCE AGGREGATION
  // ─────────────────────────────────────────────────────────────
  describe('Parent Dashboard & Semester Attendance Aggregation', () => {
    it('correctly aggregates student attendance or provides null when total_days === 0', async () => {
      const student = await db('students').where({ status: 'active' }).first();
      assert.ok(student, 'Active student required');

      const attendance = await getParentStudentAttendanceSummary(student.id);
      assert.strictEqual(typeof attendance.hadir, 'number');
      assert.strictEqual(typeof attendance.sakit, 'number');
      assert.strictEqual(typeof attendance.izin, 'number');
      assert.strictEqual(typeof attendance.alpa, 'number');
      assert.strictEqual(typeof attendance.terlambat, 'number');
      assert.strictEqual(typeof attendance.total_days, 'number');

      const expectedTotal =
        attendance.hadir +
        attendance.sakit +
        attendance.izin +
        attendance.alpa +
        attendance.terlambat;
      assert.strictEqual(attendance.total_days, expectedTotal, 'total_days must equal sum of statuses');

      if (attendance.total_days === 0) {
        assert.strictEqual(
          attendance.attendance_rate,
          null,
          'attendance_rate must be null when total_days is 0 to avoid false 0%'
        );
      } else {
        assert.ok(
          attendance.attendance_rate !== null &&
            attendance.attendance_rate >= 0 &&
            attendance.attendance_rate <= 100,
          'attendance_rate must be between 0 and 100'
        );
      }
    });

    it('returns parent dashboard with canonical UTSMAN dimensions and attendance', async () => {
      const student = await db('students').where({ status: 'active' }).first();
      assert.ok(student);

      const data = await getParentDashboard(student.id);

      assert.ok(data.student, 'Must contain student identity');
      assert.strictEqual(data.student.id, student.id);
      assert.ok(data.student_attendance, 'Must contain student_attendance aggregate');

      // Verify UTSMAN contract if character data exists
      if (data.character_summary) {
        const u = data.character_summary;
        assert.ok('u' in u, 'Must contain Ulet dimension');
        assert.ok('t' in u, 'Must contain Tekun dimension');
        assert.ok('s' in u, 'Must contain Santun dimension');
        assert.ok('m' in u, 'Must contain Mandiri dimension');
        assert.ok('a' in u, 'Must contain Amanah dimension');
        assert.ok('n' in u, 'Must contain Nalar dimension');
      }


      // Verify no teacher internal RPM or Trisula workflow leak to parent
      assert.strictEqual((data as any).rpm, undefined, 'RPM must not be exposed to parents');
      assert.strictEqual((data as any).trisula_workflow, undefined, 'Trisula workflow must not leak');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. PARENT ACADEMIC DETAIL (BUG-DASH-01)
  // ─────────────────────────────────────────────────────────────
  describe('Parent Academic Detail (BUG-DASH-01)', () => {
    it('returns only published and locked assessments, never draft assessments', async () => {
      const enrolled = await db('student_enrollments')
        .join('students', 'student_enrollments.student_id', 'students.id')
        .where('student_enrollments.status', 'active')
        .where('students.status', 'active')
        .select('students.id as student_id', 'student_enrollments.class_id')
        .first();

      if (!enrolled) return;

      const subject = await db('subjects')
        .where('status', 'active')
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (!subject) return;

      try {
        const detail = await getParentAcademicDetail(enrolled.student_id, subject.code);
        assert.ok(detail.subject_name);
        assert.ok(Array.isArray(detail.assessments));

        for (const item of detail.assessments) {
          assert.ok(
            item.assessment_status === 'published' || item.assessment_status === 'locked',
            `Assessment ${item.assessment_title} must be published or locked, got ${item.assessment_status}`
          );
        }
      } catch (err: any) {
        // If subject is not in curriculum for class, 404 is allowed
        if (err?.statusCode === 404) {
          assert.strictEqual(err.statusCode, 404);
        } else {
          throw err;
        }
      }
    });

    it('returns valid academic summary matching ParentAcademicSummary contract', async () => {
      const enrolled = await db('student_enrollments')
        .join('students', 'student_enrollments.student_id', 'students.id')
        .where('student_enrollments.status', 'active')
        .where('students.status', 'active')
        .select('students.id as student_id')
        .first();

      if (!enrolled) return;

      const summary = await getParentAcademicSummary(enrolled.student_id);
      assert.ok(summary.student, 'Must contain student object');
      assert.ok(summary.student.full_name);
      assert.ok(summary.period, 'Must contain period object');
      assert.strictEqual(typeof summary.total_assessments, 'number');
      assert.strictEqual(typeof summary.completed_assessments, 'number');
      assert.ok(Array.isArray(summary.subject_averages), 'Must contain subject_averages array');

      if (summary.overall_average !== null) {
        assert.strictEqual(typeof summary.overall_average, 'number');
        assert.ok(!isNaN(summary.overall_average));
      }
    });
  });
});
