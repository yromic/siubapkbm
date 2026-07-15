import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface ClassSubjectFilters {
  class_id?: string;
  academic_year_id?: string;
  semester_id?: string;
}

export interface ClassSubjectInput {
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
}

export async function listClassSubjects(filters: ClassSubjectFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('class_subjects')
      .join('classes', 'class_subjects.class_id', 'classes.id')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .join('academic_years', 'class_subjects.academic_year_id', 'academic_years.id')
      .join('semesters', 'class_subjects.semester_id', 'semesters.id')
      .whereNot('class_subjects.lifecycle_status', 'soft_deleted');

    if (filters.class_id) {
      query.where('class_subjects.class_id', filters.class_id);
    }

    if (filters.academic_year_id) {
      query.where('class_subjects.academic_year_id', filters.academic_year_id);
    }

    if (filters.semester_id) {
      query.where('class_subjects.semester_id', filters.semester_id);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('class_subjects.id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .select(
        'class_subjects.*',
        'classes.name as class_name',
        'classes.code as class_code',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'academic_years.name as academic_year_name',
        'semesters.name as semester_name'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('classes.level', 'asc')
      .orderBy('subjects.code', 'asc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing class subjects',
      'ERR_DATABASE',
      500
    );
  }
}

export async function assignSubjectToClass(input: ClassSubjectInput) {
  if (!input.class_id || !input.subject_id || !input.academic_year_id || !input.semester_id) {
    throw new AppError('Missing required fields: class_id, subject_id, academic_year_id, and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // Validate relations
    const classItem = await db('classes').where('id', input.class_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!classItem) throw new AppError('Class not found or deleted.', 'ERR_VALIDATION', 400);

    const subjectItem = await db('subjects').where('id', input.subject_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!subjectItem) throw new AppError('Subject not found or deleted.', 'ERR_VALIDATION', 400);

    const yearItem = await db('academic_years').where('id', input.academic_year_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!yearItem) throw new AppError('Academic Year not found or deleted.', 'ERR_VALIDATION', 400);

    const semesterItem = await db('semesters').where('id', input.semester_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!semesterItem) throw new AppError('Semester not found or deleted.', 'ERR_VALIDATION', 400);

    // Validate unique combination (non soft_deleted)
    const existing = await db('class_subjects')
      .where({
        class_id: input.class_id,
        subject_id: input.subject_id,
        academic_year_id: input.academic_year_id,
        semester_id: input.semester_id
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (existing) {
      throw new AppError('Subject is already assigned to this class for the specified period.', 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    const newItem = {
      id,
      class_id: input.class_id,
      subject_id: input.subject_id,
      academic_year_id: input.academic_year_id,
      semester_id: input.semester_id,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('class_subjects').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error assigning subject to class',
      'ERR_DATABASE',
      500
    );
  }
}

export async function unassignSubjectFromClass(id: string, actorId?: string) {
  if (!id) {
    throw new AppError('Assignment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('class_subjects')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Class subject assignment with ID ${id} not found.`, 'ERR_VALIDATION', 404);
    }

    await db('class_subjects').where('id', id).update({
      status: 'inactive',
      lifecycle_status: 'soft_deleted',
      deleted_at: new Date(),
      deleted_by: actorId || null,
      updated_at: new Date()
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error unassigning subject from class',
      'ERR_DATABASE',
      500
    );
  }
}

export interface ClassSubjectUpdateInput {
  academic_year_id?: string;
  semester_id?: string;
  status?: string;
}

export async function updateClassSubject(id: string, input: ClassSubjectUpdateInput) {
  if (!id) {
    throw new AppError('Assignment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('class_subjects')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!existing) {
      throw new AppError(`Class subject assignment with ID ${id} not found.`, 'ERR_VALIDATION', 404);
    }

    const updatedYearId = input.academic_year_id || existing.academic_year_id;
    const updatedSemesterId = input.semester_id || existing.semester_id;

    // Check if new combination conflicts with another active assignment
    const conflict = await db('class_subjects')
      .where({
        class_id: existing.class_id,
        subject_id: existing.subject_id,
        academic_year_id: updatedYearId,
        semester_id: updatedSemesterId
      })
      .whereNot('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (conflict) {
      throw new AppError('Subject is already assigned to this class for the specified period.', 'ERR_VALIDATION', 400);
    }

    const patch: any = {
      updated_at: new Date()
    };

    if (input.academic_year_id !== undefined) {
      const yearItem = await db('academic_years').where('id', input.academic_year_id).whereNot('lifecycle_status', 'soft_deleted').first();
      if (!yearItem) throw new AppError('Academic Year not found or deleted.', 'ERR_VALIDATION', 400);
      patch.academic_year_id = input.academic_year_id;
    }

    if (input.semester_id !== undefined) {
      const semesterItem = await db('semesters').where('id', input.semester_id).whereNot('lifecycle_status', 'soft_deleted').first();
      if (!semesterItem) throw new AppError('Semester not found or deleted.', 'ERR_VALIDATION', 400);
      patch.semester_id = input.semester_id;
    }

    if (input.status !== undefined) {
      patch.status = input.status;
    }

    await db('class_subjects').where('id', id).update(patch);
    
    return await db('class_subjects')
      .where('id', id)
      .first();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating class subject assignment',
      'ERR_DATABASE',
      500
    );
  }
}

