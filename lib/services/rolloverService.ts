import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export async function previewRollover(sourceSemesterId: string, targetSemesterId: string) {
  if (!sourceSemesterId || !targetSemesterId) {
    throw new AppError('source_semester_id and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sourceSem = await db('semesters').where('id', sourceSemesterId).first();
    const targetSem = await db('semesters').where('id', targetSemesterId).first();
    if (!sourceSem || !targetSem) {
      throw new AppError('Source or target semester not found.', 'ERR_VALIDATION', 404);
    }

    const assignments = await db('class_teacher_assignments')
      .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
      .join('users', 'class_teacher_assignments.teacher_user_id', 'users.id')
      .where('class_teacher_assignments.semester_id', sourceSemesterId)
      .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
      .select(
        'class_teacher_assignments.class_id',
        'classes.name as class_name',
        'class_teacher_assignments.teacher_user_id',
        'users.name as teacher_name'
      );

    const classSubjects = await db('class_subjects')
      .join('classes', 'class_subjects.class_id', 'classes.id')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .where('class_subjects.semester_id', sourceSemesterId)
      .whereNot('class_subjects.lifecycle_status', 'soft_deleted')
      .select(
        'class_subjects.class_id',
        'classes.name as class_name',
        'class_subjects.subject_id',
        'subjects.name as subject_name'
      );

    return {
      source_semester: sourceSem.name,
      target_semester: targetSem.name,
      assignments,
      class_subjects: classSubjects
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error previewing rollover',
      'ERR_DATABASE',
      500
    );
  }
}

export async function executeRollover(sourceSemesterId: string, targetSemesterId: string) {
  if (!sourceSemesterId || !targetSemesterId) {
    throw new AppError('source_semester_id and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sourceSem = await db('semesters').where('id', sourceSemesterId).first();
    const targetSem = await db('semesters').where('id', targetSemesterId).first();
    if (!sourceSem || !targetSem) {
      throw new AppError('Source or target semester not found.', 'ERR_VALIDATION', 404);
    }

    const assignments = await db('class_teacher_assignments')
      .where('semester_id', sourceSemesterId)
      .whereNot('lifecycle_status', 'soft_deleted');

    const classSubjects = await db('class_subjects')
      .where('semester_id', sourceSemesterId)
      .whereNot('lifecycle_status', 'soft_deleted');

    let copiedAssignments = 0;
    let copiedSubjects = 0;

    await db.transaction(async (trx) => {
      // 1. Copy Class Teacher Assignments
      for (const a of assignments) {
        const existing = await trx('class_teacher_assignments')
          .where({
            class_id: a.class_id,
            teacher_user_id: a.teacher_user_id,
            academic_year_id: targetSem.academic_year_id,
            semester_id: targetSemesterId
          })
          .whereNot('lifecycle_status', 'soft_deleted')
          .first();

        if (!existing) {
          await trx('class_teacher_assignments').insert({
            id: uuidv4(),
            class_id: a.class_id,
            teacher_user_id: a.teacher_user_id,
            academic_year_id: targetSem.academic_year_id,
            semester_id: targetSemesterId,
            status: 'active',
            lifecycle_status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          });
          copiedAssignments++;
        }
      }

      // 2. Copy Class Subjects
      for (const s of classSubjects) {
        const existing = await trx('class_subjects')
          .where({
            class_id: s.class_id,
            subject_id: s.subject_id,
            academic_year_id: targetSem.academic_year_id,
            semester_id: targetSemesterId
          })
          .whereNot('lifecycle_status', 'soft_deleted')
          .first();

        if (!existing) {
          await trx('class_subjects').insert({
            id: uuidv4(),
            class_id: s.class_id,
            subject_id: s.subject_id,
            academic_year_id: targetSem.academic_year_id,
            semester_id: targetSemesterId,
            status: 'active',
            lifecycle_status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          });
          copiedSubjects++;
        }
      }
    });

    return {
      message: 'Rollover completed successfully.',
      copied_assignments: copiedAssignments,
      copied_subjects: copiedSubjects
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error executing rollover',
      'ERR_DATABASE',
      500
    );
  }
}
