import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface AssignmentFilters {
  class_id?: string;
  academic_year_id?: string;
  semester_id?: string;
  teacher_user_id?: string;
}

export interface AssignmentInput {
  class_id: string;
  teacher_user_id: string;
  academic_year_id: string;
  semester_id: string;
  effective_from?: string | Date;
  effective_until?: string | Date;
}

export async function listAssignments(filters: AssignmentFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('class_teacher_assignments')
      .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
      .join('users', 'class_teacher_assignments.teacher_user_id', 'users.id')
      .join('academic_years', 'class_teacher_assignments.academic_year_id', 'academic_years.id')
      .join('semesters', 'class_teacher_assignments.semester_id', 'semesters.id')
      .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted');

    if (filters.class_id) {
      query.where('class_teacher_assignments.class_id', filters.class_id);
    }

    if (filters.academic_year_id) {
      query.where('class_teacher_assignments.academic_year_id', filters.academic_year_id);
    }

    if (filters.semester_id) {
      query.where('class_teacher_assignments.semester_id', filters.semester_id);
    }

    if (filters.teacher_user_id) {
      query.where('class_teacher_assignments.teacher_user_id', filters.teacher_user_id);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('class_teacher_assignments.id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .select(
        'class_teacher_assignments.*',
        'classes.name as class_name',
        'classes.code as class_code',
        'users.name as teacher_name',
        'users.email as teacher_email',
        'academic_years.name as academic_year_name',
        'semesters.name as semester_name'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('class_teacher_assignments.created_at', 'desc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing class teacher assignments',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createAssignment(input: AssignmentInput) {
  if (!input.class_id || !input.teacher_user_id || !input.academic_year_id || !input.semester_id) {
    throw new AppError('Missing required fields: class_id, teacher_user_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // Validate relations
    const classItem = await db('classes').where('id', input.class_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!classItem) throw new AppError('Class not found or deleted.', 'ERR_VALIDATION', 400);

    const teacherUser = await db('users').where('id', input.teacher_user_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!teacherUser) throw new AppError('Teacher user not found or deleted.', 'ERR_VALIDATION', 400);
    if (teacherUser.role !== 'teacher') throw new AppError('User assigned must have the role "teacher".', 'ERR_VALIDATION', 400);

    const yearItem = await db('academic_years').where('id', input.academic_year_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!yearItem) throw new AppError('Academic Year not found or deleted.', 'ERR_VALIDATION', 400);

    const semesterItem = await db('semesters').where('id', input.semester_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!semesterItem) throw new AppError('Semester not found or deleted.', 'ERR_VALIDATION', 400);

    // Validate that the target class doesn't already have an active class teacher for the specified period/semester
    const activeHomeroom = await db('class_teacher_assignments')
      .where({
        class_id: input.class_id,
        semester_id: input.semester_id,
        status: 'active',
        lifecycle_status: 'active'
      })
      .first();

    if (activeHomeroom) {
      throw new AppError('Kelas ini sudah memiliki wali kelas aktif untuk semester terpilih.', 'ERR_VALIDATION', 400);
    }

    // Validate unique active assignment for teacher-class-period
    const existing = await db('class_teacher_assignments')
      .where({
        class_id: input.class_id,
        teacher_user_id: input.teacher_user_id,
        academic_year_id: input.academic_year_id,
        semester_id: input.semester_id,
        status: 'active'
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (existing) {
      throw new AppError('Guru tersebut sudah aktif ditugaskan di kelas ini untuk periode yang sama.', 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    const newItem = {
      id,
      class_id: input.class_id,
      teacher_user_id: input.teacher_user_id,
      academic_year_id: input.academic_year_id,
      semester_id: input.semester_id,
      effective_from: input.effective_from ? new Date(input.effective_from) : new Date(),
      effective_until: input.effective_until ? new Date(input.effective_until) : null,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('class_teacher_assignments').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating class teacher assignment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function terminateAssignment(id: string) {
  if (!id) {
    throw new AppError('Assignment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('class_teacher_assignments')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Class teacher assignment with ID ${id} not found.`, 'ERR_VALIDATION', 404);
    }

    await db('class_teacher_assignments').where('id', id).update({
      effective_until: new Date(),
      status: 'inactive',
      lifecycle_status: 'inactive',
      updated_at: new Date()
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error terminating class teacher assignment',
      'ERR_DATABASE',
      500
    );
  }
}
