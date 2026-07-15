import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export async function getPeriodSetupReadiness() {
  const activeSem = await db('semesters')
    .where('is_active', 1)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!activeSem) {
    throw new AppError('No active semester found.', 'ERR_VALIDATION', 404);
  }

  const activeYear = await db('academic_years')
    .where('id', activeSem.academic_year_id)
    .first();

  if (!activeYear) {
    throw new AppError('No active academic year found.', 'ERR_VALIDATION', 404);
  }

  const classes = await db('classes')
    .where('status', 'active')
    .whereNot('lifecycle_status', 'soft_deleted');

  const enrollments = await db('student_enrollments')
    .where('semester_id', activeSem.id)
    .where('status', 'active')
    .whereNot('lifecycle_status', 'soft_deleted');

  const assignments = await db('class_teacher_assignments')
    .where('semester_id', activeSem.id)
    .whereNot('lifecycle_status', 'soft_deleted');

  const classSubjects = await db('class_subjects')
    .where('semester_id', activeSem.id)
    .whereNot('lifecycle_status', 'soft_deleted');

  const classReadinessList = classes.map(c => {
    const classEnrollments = enrollments.filter(e => e.class_id === c.id);
    const hasEnrollments = classEnrollments.length > 0;
    const enrollmentCount = classEnrollments.length;

    const classAssignments = assignments.filter(a => a.class_id === c.id);
    const hasTeacherAssignment = classAssignments.length > 0;

    const classSubjs = classSubjects.filter(s => s.class_id === c.id);
    const hasSubjectMapping = classSubjs.length > 0;

    const issues: string[] = [];
    if (!hasTeacherAssignment) {
      issues.push('Wali kelas belum ditugaskan.');
    }
    if (!hasSubjectMapping) {
      issues.push('Mata pelajaran belum dipetakan.');
    }

    let status: 'ready' | 'warning' | 'not_ready' = 'ready';
    if (!hasTeacherAssignment && !hasSubjectMapping) {
      status = 'not_ready';
    } else if (!hasTeacherAssignment || !hasSubjectMapping) {
      status = 'warning';
    }

    return {
      class_id: c.id,
      class_name: c.name,
      has_enrollments: hasEnrollments,
      enrollment_count: enrollmentCount,
      has_teacher_assignment: hasTeacherAssignment,
      has_subject_mapping: hasSubjectMapping,
      status,
      issues
    };
  });

  const totalClasses = classReadinessList.length;
  const readyClasses = classReadinessList.filter(c => c.status === 'ready').length;
  const warningClasses = classReadinessList.filter(c => c.status === 'warning').length;
  const notReadyClasses = classReadinessList.filter(c => c.status === 'not_ready').length;

  let overallStatus: 'ready' | 'warning' | 'not_ready' = 'ready';
  if (notReadyClasses > 0) {
    overallStatus = 'not_ready';
  } else if (warningClasses > 0) {
    overallStatus = 'warning';
  }

  return {
    period: {
      academic_year_id: activeYear.id,
      academic_year_name: activeYear.name,
      semester_id: activeSem.id,
      semester_name: activeSem.name
    },
    overall_status: overallStatus,
    summary: {
      total_classes: totalClasses,
      ready_classes: readyClasses,
      warning_classes: warningClasses,
      not_ready_classes: notReadyClasses
    },
    classes: classReadinessList
  };
}

export async function previewAssignmentRollover(sourceSemesterId: string, targetSemesterId: string) {
  if (!sourceSemesterId || !targetSemesterId) {
    throw new AppError('source_semester_id and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sourceSem = await db('semesters').where('id', sourceSemesterId).first();
    const targetSem = await db('semesters').where('id', targetSemesterId).first();
    if (!sourceSem || !targetSem) {
      throw new AppError('Source or target semester not found.', 'ERR_VALIDATION', 404);
    }

    if (['locked', 'finalized', 'archived'].includes(targetSem.lifecycle_status)) {
      throw new AppError('Target semester is locked, finalized, or archived.', 'ERR_VALIDATION', 400);
    }

    const sourceAssignments = await db('class_teacher_assignments')
      .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
      .join('users', 'class_teacher_assignments.teacher_user_id', 'users.id')
      .where('class_teacher_assignments.semester_id', sourceSemesterId)
      .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
      .where('classes.status', 'active')
      .whereNot('classes.lifecycle_status', 'soft_deleted')
      .select(
        'class_teacher_assignments.class_id',
        'classes.name as class_name',
        'class_teacher_assignments.teacher_user_id',
        'users.name as teacher_name',
        'users.status as teacher_status',
        'users.lifecycle_status as teacher_lifecycle_status'
      );

    const targetAssignments = await db('class_teacher_assignments')
      .where('semester_id', targetSemesterId)
      .whereNot('lifecycle_status', 'soft_deleted');

    const assignments = [];
    const warnings: string[] = [];

    for (const a of sourceAssignments) {
      const isTeacherInactive = a.teacher_status !== 'active' || a.teacher_lifecycle_status === 'soft_deleted';

      if (isTeacherInactive) {
        assignments.push({
          class_id: a.class_id,
          class_name: a.class_name,
          teacher_user_id: a.teacher_user_id,
          teacher_name: a.teacher_name,
          status: 'conflict'
        });
        warnings.push(`Guru ${a.teacher_name} (Wali Kelas ${a.class_name}) dilewati karena status guru tidak aktif.`);
        continue;
      }

      const duplicate = targetAssignments.find(
        ta => ta.class_id === a.class_id && ta.teacher_user_id === a.teacher_user_id
      );
      const conflict = targetAssignments.find(
        ta => ta.class_id === a.class_id && ta.teacher_user_id !== a.teacher_user_id
      );

      let status: 'ready' | 'duplicate' | 'conflict' = 'ready';
      if (duplicate) {
        status = 'duplicate';
      } else if (conflict) {
        status = 'conflict';
      }

      assignments.push({
        class_id: a.class_id,
        class_name: a.class_name,
        teacher_user_id: a.teacher_user_id,
        teacher_name: a.teacher_name,
        status
      });
    }

    return {
      total_found: assignments.length,
      assignments,
      warnings
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error previewing assignment rollover',
      'ERR_DATABASE',
      500
    );
  }
}

export async function executeAssignmentRollover(sourceSemesterId: string, targetSemesterId: string) {
  if (!sourceSemesterId || !targetSemesterId) {
    throw new AppError('source_semester_id and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sourceSem = await db('semesters').where('id', sourceSemesterId).first();
    const targetSem = await db('semesters').where('id', targetSemesterId).first();
    if (!sourceSem || !targetSem) {
      throw new AppError('Source or target semester not found.', 'ERR_VALIDATION', 404);
    }

    if (['locked', 'finalized', 'archived'].includes(targetSem.lifecycle_status)) {
      throw new AppError('Target semester is locked, finalized, or archived and cannot be modified.', 'ERR_VALIDATION', 400);
    }

    const sourceAssignments = await db('class_teacher_assignments')
      .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
      .join('users', 'class_teacher_assignments.teacher_user_id', 'users.id')
      .where('class_teacher_assignments.semester_id', sourceSemesterId)
      .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
      .where('classes.status', 'active')
      .whereNot('classes.lifecycle_status', 'soft_deleted')
      .select(
        'class_teacher_assignments.*',
        'users.name as teacher_name',
        'users.status as teacher_status',
        'users.lifecycle_status as teacher_lifecycle_status'
      );

    let copied = 0;
    let skipped = 0;
    const errors: string[] = [];

    await db.transaction(async (trx) => {
      for (const a of sourceAssignments) {
        const isTeacherInactive = a.teacher_status !== 'active' || a.teacher_lifecycle_status === 'soft_deleted';

        if (isTeacherInactive) {
          skipped++;
          errors.push(`Guru ${a.teacher_name} dilewati karena status guru tidak aktif.`);
          continue;
        }

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
          copied++;
        } else {
          skipped++;
        }
      }
    });

    return {
      message: 'Rollover completed successfully.',
      copied,
      skipped,
      errors
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error executing assignment rollover',
      'ERR_DATABASE',
      500
    );
  }
}

export async function previewSubjectRollover(sourceSemesterId: string, targetSemesterId: string) {
  if (!sourceSemesterId || !targetSemesterId) {
    throw new AppError('source_semester_id and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sourceSem = await db('semesters').where('id', sourceSemesterId).first();
    const targetSem = await db('semesters').where('id', targetSemesterId).first();
    if (!sourceSem || !targetSem) {
      throw new AppError('Source or target semester not found.', 'ERR_VALIDATION', 404);
    }

    if (['locked', 'finalized', 'archived'].includes(targetSem.lifecycle_status)) {
      throw new AppError('Target semester is locked, finalized, or archived.', 'ERR_VALIDATION', 400);
    }

    const sourceSubjects = await db('class_subjects')
      .join('classes', 'class_subjects.class_id', 'classes.id')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .where('class_subjects.semester_id', sourceSemesterId)
      .whereNot('class_subjects.lifecycle_status', 'soft_deleted')
      .where('classes.status', 'active')
      .whereNot('classes.lifecycle_status', 'soft_deleted')
      .select(
        'class_subjects.class_id',
        'classes.name as class_name',
        'class_subjects.subject_id',
        'subjects.name as subject_name'
      );

    const targetSubjects = await db('class_subjects')
      .where('semester_id', targetSemesterId)
      .whereNot('lifecycle_status', 'soft_deleted');

    const subjects = sourceSubjects.map(s => {
      const isDuplicate = targetSubjects.some(
        ts => ts.class_id === s.class_id && ts.subject_id === s.subject_id
      );
      return {
        class_id: s.class_id,
        class_name: s.class_name,
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        status: isDuplicate ? 'duplicate' : 'ready'
      };
    });

    return {
      total_found: subjects.length,
      subjects,
      warnings: []
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error previewing subject rollover',
      'ERR_DATABASE',
      500
    );
  }
}

export async function executeSubjectRollover(sourceSemesterId: string, targetSemesterId: string) {
  if (!sourceSemesterId || !targetSemesterId) {
    throw new AppError('source_semester_id and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const sourceSem = await db('semesters').where('id', sourceSemesterId).first();
    const targetSem = await db('semesters').where('id', targetSemesterId).first();
    if (!sourceSem || !targetSem) {
      throw new AppError('Source or target semester not found.', 'ERR_VALIDATION', 404);
    }

    if (['locked', 'finalized', 'archived'].includes(targetSem.lifecycle_status)) {
      throw new AppError('Target semester is locked, finalized, or archived and cannot be modified.', 'ERR_VALIDATION', 400);
    }

    const classSubjects = await db('class_subjects')
      .join('classes', 'class_subjects.class_id', 'classes.id')
      .where('class_subjects.semester_id', sourceSemesterId)
      .whereNot('class_subjects.lifecycle_status', 'soft_deleted')
      .where('classes.status', 'active')
      .whereNot('classes.lifecycle_status', 'soft_deleted')
      .select('class_subjects.*');

    let copied = 0;
    let skipped = 0;

    await db.transaction(async (trx) => {
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
          copied++;
        } else {
          skipped++;
        }
      }
    });

    return {
      message: 'Rollover completed successfully.',
      copied,
      skipped,
      errors: []
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error executing subject rollover',
      'ERR_DATABASE',
      500
    );
  }
}

// Deprecated original executeRollover for backward compatibility if any test or script calls it.
export async function executeRollover(sourceSemesterId: string, targetSemesterId: string) {
  const assignmentsRes = await executeAssignmentRollover(sourceSemesterId, targetSemesterId);
  const subjectsRes = await executeSubjectRollover(sourceSemesterId, targetSemesterId);
  return {
    message: 'Rollover completed successfully.',
    copied_assignments: assignmentsRes.copied,
    copied_subjects: subjectsRes.copied
  };
}

// Deprecated original previewRollover for backward compatibility if any test or script calls it.
export async function previewRollover(sourceSemesterId: string, targetSemesterId: string) {
  const assignmentsRes = await previewAssignmentRollover(sourceSemesterId, targetSemesterId);
  const subjectsRes = await previewSubjectRollover(sourceSemesterId, targetSemesterId);
  return {
    source_semester: '',
    target_semester: '',
    assignments: assignmentsRes.assignments,
    class_subjects: subjectsRes.subjects
  };
}
