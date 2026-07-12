import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface EnrollmentFilters {
  student_id?: string;
  class_id?: string;
  semester_id?: string;
}

export interface EnrollmentInput {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  semester_id: string;
}

export async function listEnrollments(filters: EnrollmentFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('student_enrollments')
      .join('students', 'student_enrollments.student_id', 'students.id')
      .join('classes', 'student_enrollments.class_id', 'classes.id')
      .join('academic_years', 'student_enrollments.academic_year_id', 'academic_years.id')
      .join('semesters', 'student_enrollments.semester_id', 'semesters.id')
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted');

    if (filters.student_id) {
      query.where('student_enrollments.student_id', filters.student_id);
    }

    if (filters.class_id) {
      query.where('student_enrollments.class_id', filters.class_id);
    }

    if (filters.semester_id) {
      query.where('student_enrollments.semester_id', filters.semester_id);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('student_enrollments.id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .select(
        'student_enrollments.*',
        'students.full_name as student_name',
        'students.full_name as full_name',
        'students.nisn as student_nisn',
        'students.nisn as nisn',
        'students.gender as gender',
        'students.birth_date as birth_date',
        'classes.name as class_name',
        'classes.code as class_code',
        'academic_years.name as academic_year_name',
        'semesters.name as semester_name'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('student_enrollments.created_at', 'desc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing student enrollments',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getEnrollmentById(id: string) {
  if (!id) {
    throw new AppError('Enrollment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('student_enrollments')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Enrollment with ID ${id} not found.`, 'ERR_ENROLLMENT_NOT_FOUND', 404);
    }

    return item;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting student enrollment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createEnrollment(input: EnrollmentInput) {
  if (!input.student_id || !input.class_id || !input.academic_year_id || !input.semester_id) {
    throw new AppError('Missing required fields: student_id, class_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    return await db.transaction(async (trx) => {
      // Validate relations
      const student = await trx('students').where('id', input.student_id).whereNot('status', 'soft_deleted').first();
      if (!student) throw new AppError('Student not found or deleted.', 'ERR_VALIDATION', 400);

      const classItem = await trx('classes').where('id', input.class_id).whereNot('lifecycle_status', 'soft_deleted').first();
      if (!classItem) throw new AppError('Class not found or deleted.', 'ERR_VALIDATION', 400);

      const yearItem = await trx('academic_years').where('id', input.academic_year_id).whereNot('lifecycle_status', 'soft_deleted').first();
      if (!yearItem) throw new AppError('Academic Year not found or deleted.', 'ERR_VALIDATION', 400);

      const semesterItem = await trx('semesters').where('id', input.semester_id).whereNot('lifecycle_status', 'soft_deleted').first();
      if (!semesterItem) throw new AppError('Semester not found or deleted.', 'ERR_VALIDATION', 400);

      // Guard: Only one active enrollment per student per semester using FOR UPDATE lock
      const existingActive = await trx('student_enrollments')
        .where({
          student_id: input.student_id,
          semester_id: input.semester_id,
          status: 'active'
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .forUpdate()
        .first();

      if (existingActive) {
        throw new AppError('Student already has an active enrollment in this semester.', 'ERR_STUDENT_ALREADY_ENROLLED', 400);
      }

      const id = uuidv4();
      const newItem = {
        id,
        student_id: input.student_id,
        class_id: input.class_id,
        academic_year_id: input.academic_year_id,
        semester_id: input.semester_id,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      await trx('student_enrollments').insert(newItem);
      return newItem;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating student enrollment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateEnrollment(id: string, input: { status?: string; lifecycle_status?: string }) {
  if (!id) {
    throw new AppError('Enrollment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('student_enrollments')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Enrollment with ID ${id} not found.`, 'ERR_ENROLLMENT_NOT_FOUND', 404);
    }

    const patch: any = { updated_at: new Date() };

    if (input.status !== undefined) {
      const allowedStatus = ['active', 'promoted', 'repeated', 'graduated', 'transferred', 'inactive'];
      if (!allowedStatus.includes(input.status)) {
        throw new AppError('Invalid enrollment status value.', 'ERR_VALIDATION', 400);
      }
      patch.status = input.status;
    }

    if (input.lifecycle_status !== undefined) {
      const allowedLifecycle = ['active', 'inactive', 'archived', 'soft_deleted'];
      if (!allowedLifecycle.includes(input.lifecycle_status)) {
        throw new AppError('Invalid enrollment lifecycle status value.', 'ERR_VALIDATION', 400);
      }
      patch.lifecycle_status = input.lifecycle_status;
    }

    if (Object.keys(patch).length > 1) {
      await db('student_enrollments').where('id', id).update(patch);
    }

    return await getEnrollmentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating student enrollment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function changeEnrollmentStatus(id: string, status: string) {
  return updateEnrollment(id, { status });
}

export async function getActiveEnrollmentByStudent(studentId: string, semesterId: string) {
  if (!studentId || !semesterId) {
    throw new AppError('Student ID and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('student_enrollments')
      .where({
        student_id: studentId,
        semester_id: semesterId,
        status: 'active',
        lifecycle_status: 'active'
      })
      .first();

    return item || null;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting active student enrollment',
      'ERR_DATABASE',
      500
    );
  }
}
