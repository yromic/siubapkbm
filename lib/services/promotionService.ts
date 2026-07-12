import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export async function listPromotionRules() {
  try {
    return await db('class_promotion_rules')
      .join('classes as source', 'class_promotion_rules.source_class_id', 'source.id')
      .join('classes as target', 'class_promotion_rules.target_class_id', 'target.id')
      .whereNot('class_promotion_rules.lifecycle_status', 'soft_deleted')
      .select(
        'class_promotion_rules.id',
        'class_promotion_rules.source_class_id',
        'source.name as source_class_name',
        'class_promotion_rules.target_class_id',
        'target.name as target_class_name',
        'class_promotion_rules.status'
      );
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing promotion rules',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createPromotionRule(input: { source_class_id: string; target_class_id: string }) {
  if (!input.source_class_id || !input.target_class_id) {
    throw new AppError('source_class_id and target_class_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('class_promotion_rules')
      .where({
        source_class_id: input.source_class_id,
        target_class_id: input.target_class_id
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (existing) {
      throw new AppError('Promotion rule for this source and target class mapping already exists.', 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    await db('class_promotion_rules').insert({
      id,
      source_class_id: input.source_class_id,
      target_class_id: input.target_class_id,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    return { id, ...input, status: 'active' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating promotion rule',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updatePromotionRule(id: string, body: { source_class_id?: string; target_class_id?: string; status?: string }) {
  try {
    const existing = await db('class_promotion_rules').where('id', id).first();
    if (!existing) {
      throw new AppError('Promotion rule not found.', 'ERR_VALIDATION', 404);
    }

    const updateData = {
      ...body,
      updated_at: new Date()
    };

    await db('class_promotion_rules').where('id', id).update(updateData);
    return { ...existing, ...updateData };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating promotion rule',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deletePromotionRule(id: string) {
  try {
    const existing = await db('class_promotion_rules').where('id', id).first();
    if (!existing) {
      throw new AppError('Promotion rule not found.', 'ERR_VALIDATION', 404);
    }

    await db('class_promotion_rules')
      .where('id', id)
      .update({
        lifecycle_status: 'soft_deleted',
        updated_at: new Date()
      });

    return { id };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deleting promotion rule',
      'ERR_DATABASE',
      500
    );
  }
}

export async function previewPromotion(sourceClassId: string, targetClassId: string, academicYearId: string, semesterId: string) {
  if (!sourceClassId || !targetClassId || !academicYearId || !semesterId) {
    throw new AppError('source_class_id, target_class_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // Tampilkan siswa yang enrollment aktif di kelas sumber (di semester berjalan atau manapun)
    const students = await db('student_enrollments')
      .join('students', 'student_enrollments.student_id', 'students.id')
      .where('student_enrollments.class_id', sourceClassId)
      .where('student_enrollments.status', 'active')
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .select(
        'students.id as student_id',
        'students.nisn',
        'students.full_name',
        'student_enrollments.academic_year_id as current_year_id',
        'student_enrollments.semester_id as current_semester_id'
      );

    return {
      source_class_id: sourceClassId,
      target_class_id: targetClassId,
      target_academic_year_id: academicYearId,
      target_semester_id: semesterId,
      eligible_students: students
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error previewing student promotion',
      'ERR_DATABASE',
      500
    );
  }
}

export async function executePromotion(
  sourceClassId: string,
  targetClassId: string,
  studentIds: string[],
  targetAcademicYearId: string,
  targetSemesterId: string
) {
  if (!sourceClassId || !targetClassId || !studentIds || !Array.isArray(studentIds) || !targetAcademicYearId || !targetSemesterId) {
    throw new AppError('source_class_id, target_class_id, student_ids, target_academic_year_id, and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    let promotedCount = 0;

    await db.transaction(async (trx) => {
      for (const studentId of studentIds) {
        // 1. Deactivate old active enrollments in the source class
        await trx('student_enrollments')
          .where({
            student_id: studentId,
            class_id: sourceClassId,
            status: 'active'
          })
          .update({
            status: 'inactive', // Mark inactive (or transferred/promoted)
            updated_at: new Date()
          });

        // 2. Insert new enrollment in target class
        const newEnrollmentId = uuidv4();
        await trx('student_enrollments').insert({
          id: newEnrollmentId,
          student_id: studentId,
          class_id: targetClassId,
          academic_year_id: targetAcademicYearId,
          semester_id: targetSemesterId,
          status: 'active',
          lifecycle_status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });

        promotedCount++;
      }
    });

    return {
      message: 'Student promotion executed successfully.',
      promoted_count: promotedCount
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error executing student promotion',
      'ERR_DATABASE',
      500
    );
  }
}
