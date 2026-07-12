import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { getStudentAcademicSummary } from './academicScoreService';
import { calculateAndGetSemesterSummary } from './characterSummaryService';

export async function takeStudentSnapshot(studentId: string, academicYearId: string, semesterId: string, actorId: string) {
  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError('student_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const student = await db('students').where('id', studentId).first();
    if (!student) {
      throw new AppError('Student not found.', 'ERR_VALIDATION', 404);
    }

    const enrollment = await db('student_enrollments')
      .join('classes', 'student_enrollments.class_id', 'classes.id')
      .where({
        'student_enrollments.student_id': studentId,
        'student_enrollments.academic_year_id': academicYearId,
        'student_enrollments.semester_id': semesterId,
        'student_enrollments.status': 'active'
      })
      .select('student_enrollments.class_id', 'classes.name as class_name')
      .first();

    if (!enrollment) {
      throw new AppError('No active student enrollment found for the specified period.', 'ERR_VALIDATION', 400);
    }

    // Get academic summary and character summary
    const academicSummary = await getStudentAcademicSummary(studentId, academicYearId, semesterId);
    let characterSummary = null;
    try {
      characterSummary = await calculateAndGetSemesterSummary(studentId, academicYearId, semesterId, true);
    } catch (e) {
      // character summary might be empty or error, handle gracefully
    }

    const payload = {
      student_id: studentId,
      student_name: student.full_name,
      student_nisn: student.nisn,
      class_id: enrollment.class_id,
      class_name: enrollment.class_name,
      academic_year_id: academicYearId,
      semester_id: semesterId,
      academic_summary: academicSummary,
      character_summary: characterSummary,
      created_at: new Date().toISOString()
    };

    const existing = await db('report_snapshots')
      .where({
        student_id: studentId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        snapshot_type: 'student_semester'
      })
      .first();

    if (existing) {
      await db('report_snapshots')
        .where('id', existing.id)
        .update({
          snapshot_payload: JSON.stringify(payload),
          created_by: actorId
        });
      return { id: existing.id, ...payload };
    } else {
      const id = uuidv4();
      await db('report_snapshots').insert({
        id,
        snapshot_type: 'student_semester',
        student_id: studentId,
        class_id: enrollment.class_id,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        snapshot_payload: JSON.stringify(payload),
        created_by: actorId,
        created_at: new Date()
      });
      return { id, ...payload };
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating student snapshot',
      'ERR_DATABASE',
      500
    );
  }
}

export async function takeClassSnapshot(classId: string, academicYearId: string, semesterId: string, actorId: string) {
  if (!classId || !academicYearId || !semesterId) {
    throw new AppError('class_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const enrollments = await db('student_enrollments')
      .where({
        class_id: classId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        status: 'active'
      })
      .whereNot('lifecycle_status', 'soft_deleted');

    const results = [];
    for (const e of enrollments) {
      const res = await takeStudentSnapshot(e.student_id, academicYearId, semesterId, actorId);
      results.push(res);
    }
    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating class snapshot',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getSnapshot(studentId: string, academicYearId: string, semesterId: string) {
  try {
    const snap = await db('report_snapshots')
      .where({
        student_id: studentId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        snapshot_type: 'student_semester'
      })
      .first();

    if (!snap) {
      throw new AppError('Snapshot not found.', 'ERR_VALIDATION', 404);
    }

    return JSON.parse(snap.snapshot_payload);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting snapshot',
      'ERR_DATABASE',
      500
    );
  }
}
