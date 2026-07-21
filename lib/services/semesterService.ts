import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface SemesterFilters {
  academic_year_id?: string;
  is_active?: boolean;
}

export interface SemesterInput {
  academic_year_id: string;
  name: string;
  start_date: string | Date;
  end_date: string | Date;
}

export async function listSemesters(
  filters: SemesterFilters = {},
  page = 1,
  limit = 20
) {
  try {
    const query = db('semesters').whereNot('lifecycle_status', 'soft_deleted');

    if (filters.academic_year_id) {
      query.where('academic_year_id', filters.academic_year_id);
    }

    if (filters.is_active !== undefined) {
      query.where('is_active', filters.is_active ? 1 : 0);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .limit(limit)
      .offset(offset)
      .orderBy('start_date', 'asc');

    return {
      data: items,
      pagination: {
        page,
        limit,
        total
      }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing semesters',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getSemesterById(id: string) {
  if (!id) {
    throw new AppError('Semester ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('semesters')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
    }

    return item;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createSemester(input: SemesterInput) {
  if (!input.academic_year_id || !input.name || !input.start_date || !input.end_date) {
    throw new AppError('Missing required fields: academic_year_id, name, start_date, and end_date are required.', 'ERR_VALIDATION', 400);
  }

  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);

  if (startDate >= endDate) {
    throw new AppError('Start date must be before end date.', 'ERR_VALIDATION', 400);
  }

  try {
    // 1. Verify academic year exists and is not soft_deleted
    const year = await db('academic_years')
      .where('id', input.academic_year_id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!year) {
      throw new AppError(`Academic Year with ID ${input.academic_year_id} not found.`, 'ERR_VALIDATION', 400);
    }

    // 2. Validate uniqueness of name in this academic year
    const existing = await db('semesters')
      .where('academic_year_id', input.academic_year_id)
      .where('name', input.name)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (existing) {
      throw new AppError(`Semester named "${input.name}" is already registered in this academic year.`, 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    const newItem = {
      id,
      academic_year_id: input.academic_year_id,
      name: input.name,
      start_date: startDate,
      end_date: endDate,
      is_active: 0,
      lifecycle_status: 'draft',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('semesters').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateSemester(id: string, input: Partial<Omit<SemesterInput, 'academic_year_id'>>) {
  if (!id) {
    throw new AppError('Semester ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('semesters')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
    }

    // Only allow update if draft or active
    if (item.lifecycle_status !== 'draft' && item.lifecycle_status !== 'active') {
      throw new AppError('Can only update semesters in draft or active status.', 'ERR_VALIDATION', 400);
    }

    const patch: any = { updated_at: new Date() };

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new AppError('Name cannot be empty.', 'ERR_VALIDATION', 400);

      const existing = await db('semesters')
        .where('academic_year_id', item.academic_year_id)
        .where('name', input.name)
        .whereNot('id', id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (existing) {
        throw new AppError(`Semester named "${input.name}" is already registered in this academic year.`, 'ERR_VALIDATION', 400);
      }
      patch.name = input.name;
    }

    const startDate = input.start_date !== undefined ? new Date(input.start_date) : new Date(item.start_date);
    const endDate = input.end_date !== undefined ? new Date(input.end_date) : new Date(item.end_date);

    if (input.start_date !== undefined || input.end_date !== undefined) {
      if (startDate >= endDate) {
        throw new AppError('Start date must be before end date.', 'ERR_VALIDATION', 400);
      }
      if (input.start_date !== undefined) patch.start_date = startDate;
      if (input.end_date !== undefined) patch.end_date = endDate;
    }

    if (Object.keys(patch).length > 1) {
      await db('semesters').where('id', id).update(patch);
    }

    return await getSemesterById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function setActiveSemester(id: string) {
  if (!id) {
    throw new AppError('Semester ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('semesters')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
    }

    if (item.lifecycle_status !== 'draft' && item.lifecycle_status !== 'active') {
      throw new AppError('Only semesters in draft or active status can be activated.', 'ERR_VALIDATION', 400);
    }

    await db.transaction(async (trx: any) => {
      // 1. Pessimistic lock on active academic years to serialize/prevent concurrent activation requests
      const activeYear = await trx('academic_years')
        .where('is_active', 1)
        .whereNot('lifecycle_status', 'soft_deleted')
        .forUpdate()
        .first();

      if (!activeYear) {
        throw new AppError('No active academic year found. Please activate an academic year first.', 'ERR_ACTIVE_PERIOD_MISMATCH', 400);
      }

      // 2. Lock the target semester row
      const targetSemester = await trx('semesters')
        .where('id', id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .forUpdate()
        .first();

      if (!targetSemester) {
        throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
      }

      if (targetSemester.lifecycle_status !== 'draft' && targetSemester.lifecycle_status !== 'active') {
        throw new AppError('Only semesters in draft or active status can be activated.', 'ERR_VALIDATION', 400);
      }

      if (targetSemester.academic_year_id !== activeYear.id) {
        throw new AppError('Semester does not belong to the active academic year.', 'ERR_ACTIVE_PERIOD_MISMATCH', 400);
      }

      // Deactivate ALL other active semesters globally across all years
      await trx('semesters')
        .where('is_active', 1)
        .whereNot('id', id)
        .update({
          is_active: 0,
          updated_at: new Date()
        });

      // Activate target semester
      await trx('semesters')
        .where('id', id)
        .update({
          is_active: 1,
          lifecycle_status: 'active',
          updated_at: new Date()
        });
    });

    return await getSemesterById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error setting active semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function lockSemester(id: string, actorId: string) {
  if (!id || !actorId) {
    throw new AppError('Semester ID and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('semesters')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
    }

    if (item.lifecycle_status !== 'active') {
      throw new AppError('Only active semesters can be locked.', 'ERR_VALIDATION', 400);
    }

    // In the future: check that all assessments in the semester are locked.
    // For now: lock directly as requested.
    await db('semesters').where('id', id).update({
      lifecycle_status: 'locked',
      is_active: 0, // Once locked, it is no longer the active input semester
      locked_at: new Date(),
      locked_by: actorId,
      updated_at: new Date()
    });

    return await getSemesterById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error locking semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function unlockSemester(id: string, actorId: string) {
  if (!id || !actorId) {
    throw new AppError('Semester ID and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('semesters')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
    }

    if (item.lifecycle_status !== 'locked') {
      throw new AppError('Only locked semesters can be unlocked.', 'ERR_VALIDATION', 400);
    }

    await db('semesters').where('id', id).update({
      lifecycle_status: 'active',
      is_active: 1, // Set active again on unlock
      locked_at: null,
      locked_by: null,
      updated_at: new Date()
    });

    return await getSemesterById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error unlocking semester',
      'ERR_DATABASE',
      500
    );
  }
}

export async function archiveSemester(id: string, actorId: string) {
  if (!id || !actorId) {
    throw new AppError('Semester ID and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('semesters')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Semester with ID ${id} not found.`, 'ERR_SEMESTER_NOT_FOUND', 404);
    }

    await db('semesters').where('id', id).update({
      lifecycle_status: 'archived',
      is_active: 0,
      archived_at: new Date(),
      archived_by: actorId,
      updated_at: new Date()
    });

    return await getSemesterById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error archiving semester',
      'ERR_DATABASE',
      500
    );
  }
}

/**
 * Returns the active semester for a given academic year.
 */
export async function getActiveSemester(academicYearId: string): Promise<any> {
  try {
    return await db("semesters")
      .where({ academic_year_id: academicYearId, is_active: 1 })
      .first();
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving active semester',
      'ERR_DATABASE',
      500
    );
  }
}
