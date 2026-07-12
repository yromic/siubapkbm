import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { takeStudentSnapshot } from './snapshotService';

export async function finalizeSemester(semesterId: string, actorId: string) {
  if (!semesterId) {
    throw new AppError('Semester ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sem = await db('semesters').where('id', semesterId).first();
    if (!sem) {
      throw new AppError('Semester not found.', 'ERR_VALIDATION', 404);
    }

    if (sem.lifecycle_status === 'finalized') {
      return { message: 'Semester is already finalized.', is_finalized: true };
    }

    // 1. Check if there are unlocked assessments in this semester
    const unlockedAssessmentsCountRes = await db('academic_assessments')
      .where('semester_id', semesterId)
      .whereNot('status', 'locked')
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const unlockedCount = Number(unlockedAssessmentsCountRes?.count || 0);
    if (unlockedCount > 0) {
      throw new AppError(`Cannot finalize semester. There are ${unlockedCount} unlocked academic assessments. Please lock them first.`, 'ERR_VALIDATION', 400);
    }

    // 2. Take snapshots for all active enrolled students in this semester
    const enrollments = await db('student_enrollments')
      .where({ semester_id: semesterId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted');

    for (const e of enrollments) {
      await takeStudentSnapshot(e.student_id, sem.academic_year_id, semesterId, actorId);
    }

    // 3. Mark semester as finalized
    await db('semesters')
      .where('id', semesterId)
      .update({
        lifecycle_status: 'finalized',
        updated_at: new Date()
      });

    return {
      message: 'Semester finalized successfully.',
      is_finalized: true,
      snapshots_created: enrollments.length
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error finalising semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getFinalizationStatus(semesterId: string) {
  if (!semesterId) {
    throw new AppError('Semester ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sem = await db('semesters').where('id', semesterId).first();
    if (!sem) {
      throw new AppError('Semester not found.', 'ERR_VALIDATION', 404);
    }

    const studentsCountRes = await db('student_enrollments')
      .where({ semester_id: semesterId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const totalStudents = Number(studentsCountRes?.count || 0);

    const snapshotsCountRes = await db('report_snapshots')
      .where({ semester_id: semesterId, snapshot_type: 'student_semester' })
      .count('id as count')
      .first();

    const totalSnapshots = Number(snapshotsCountRes?.count || 0);

    return {
      semester_name: sem.name,
      lifecycle_status: sem.lifecycle_status,
      is_finalized: sem.lifecycle_status === 'finalized',
      total_students: totalStudents,
      total_snapshots: totalSnapshots
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting finalization status',
      'ERR_DATABASE',
      500
    );
  }
}
