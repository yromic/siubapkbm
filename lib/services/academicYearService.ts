import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface AcademicYearFilters {
  is_active?: boolean;
  lifecycle_status?: 'draft' | 'active' | 'locked' | 'archived';
}

export interface AcademicYearInput {
  name: string;
  start_date: string | Date;
  end_date: string | Date;
}

export async function listAcademicYears(
  filters: AcademicYearFilters = {},
  page = 1,
  limit = 20
) {
  try {
    const query = db('academic_years').whereNot('lifecycle_status', 'soft_deleted');

    if (filters.is_active !== undefined) {
      query.where('is_active', filters.is_active ? 1 : 0);
    }

    if (filters.lifecycle_status) {
      query.where('lifecycle_status', filters.lifecycle_status);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .limit(limit)
      .offset(offset)
      .orderBy('start_date', 'desc');

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
      error instanceof Error ? error.message : 'Database error listing academic years',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getAcademicYearById(id: string) {
  if (!id) {
    throw new AppError('Academic Year ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_years')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Year with ID ${id} not found.`, 'ERR_ACADEMIC_YEAR_NOT_FOUND', 404);
    }

    return item;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting academic year',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createAcademicYear(input: AcademicYearInput) {
  if (!input.name || !input.start_date || !input.end_date) {
    throw new AppError('Missing required fields: name, start_date, and end_date are required.', 'ERR_VALIDATION', 400);
  }

  const startDate = new Date(input.start_date);
  const endDate = new Date(input.end_date);

  if (startDate >= endDate) {
    throw new AppError('Start date must be before end date.', 'ERR_VALIDATION', 400);
  }

  try {
    // Check unique name (non soft_deleted)
    const existing = await db('academic_years')
      .where('name', input.name)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (existing) {
      throw new AppError(`Academic Year name "${input.name}" is already registered.`, 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    const newItem = {
      id,
      name: input.name,
      start_date: startDate,
      end_date: endDate,
      is_active: 0,
      lifecycle_status: 'draft',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('academic_years').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating academic year',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateAcademicYear(id: string, input: Partial<AcademicYearInput>) {
  if (!id) {
    throw new AppError('Academic Year ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_years')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Year with ID ${id} not found.`, 'ERR_ACADEMIC_YEAR_NOT_FOUND', 404);
    }

    // Only allow update if draft or active
    if (item.lifecycle_status !== 'draft' && item.lifecycle_status !== 'active') {
      throw new AppError('Can only update academic year in draft or active status.', 'ERR_VALIDATION', 400);
    }

    const patch: any = { updated_at: new Date() };

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new AppError('Name cannot be empty.', 'ERR_VALIDATION', 400);
      
      const existing = await db('academic_years')
        .where('name', input.name)
        .whereNot('id', id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (existing) {
        throw new AppError(`Academic Year name "${input.name}" is already registered.`, 'ERR_VALIDATION', 400);
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
      await db('academic_years').where('id', id).update(patch);
    }

    return await getAcademicYearById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating academic year',
      'ERR_DATABASE',
      500
    );
  }
}

export async function setActiveAcademicYear(id: string) {
  if (!id) {
    throw new AppError('Academic Year ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_years')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Year with ID ${id} not found.`, 'ERR_ACADEMIC_YEAR_NOT_FOUND', 404);
    }

    if (item.lifecycle_status !== 'draft' && item.lifecycle_status !== 'active') {
      throw new AppError('Only academic years in draft or active status can be activated.', 'ERR_VALIDATION', 400);
    }

    await db.transaction(async (trx) => {
      // Find semesters for this academic year
      const semesters = await trx('semesters')
        .where('academic_year_id', id)
        .whereNot('lifecycle_status', 'soft_deleted');

      if (semesters.length === 0) {
        throw new AppError(
          'No semesters found for this academic year. Please create a semester first.',
          'ERR_ACTIVE_SEMESTER_NOT_SET',
          400
        );
      }

      // Choose target semester deterministically:
      // 1. Semester that has is_active = 1
      // 2. Otherwise 'Ganjil' (case-insensitive)
      // 3. Otherwise first semester in alphabetical order of name
      let targetSemester = semesters.find((s) => s.is_active == 1);
      if (!targetSemester) {
        targetSemester = semesters.find((s) => s.name?.toLowerCase() === 'ganjil');
      }
      if (!targetSemester) {
        semesters.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        targetSemester = semesters[0];
      }

      if (!targetSemester) {
        throw new AppError(
          'No valid semester found for this academic year.',
          'ERR_ACTIVE_SEMESTER_NOT_SET',
          400
        );
      }

      // Deactivate all currently active academic years
      await trx('academic_years').where('is_active', 1).update({
        is_active: 0,
        updated_at: new Date()
      });

      // Activate the target academic year
      await trx('academic_years').where('id', id).update({
        is_active: 1,
        lifecycle_status: 'active',
        updated_at: new Date()
      });

      // Deactivate all semesters globally to prevent multiple active semesters in database
      await trx('semesters').where('is_active', 1).update({
        is_active: 0,
        updated_at: new Date()
      });

      // Activate the chosen semester
      await trx('semesters').where('id', targetSemester.id).update({
        is_active: 1,
        lifecycle_status: 'active',
        updated_at: new Date()
      });
    });

    // Schedule SPP record generation for all enrolled students in the activated year.
    // Run in the background so activation is not blocked by SPP generation failures.
    setImmediate(async () => {
      try {
        const { generateSppRecordsForStudent } = await import('@/lib/services/sppService');
        const enrollments = await db('student_enrollments')
          .where({ academic_year_id: id, status: 'active' })
          .whereNot('lifecycle_status', 'soft_deleted')
          .select('student_id', 'academic_year_id', 'created_at');
        for (const e of enrollments) {
          // Pass the enrollment date so months before enrollment are not generated.
          const enrollmentDate = e.created_at ? new Date(e.created_at) : undefined;
          await generateSppRecordsForStudent(e.student_id, e.academic_year_id, enrollmentDate);
        }
        console.log(`[setActiveAcademicYear] Generated SPP records for ${enrollments.length} enrollments in year ${id}`);
      } catch (err) {
        console.warn('[setActiveAcademicYear] SPP bulk-generate failed (non-fatal):', err);
      }
    });

    return await getAcademicYearById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error setting active academic year',
      'ERR_DATABASE',
      500
    );
  }
}


export async function lockAcademicYear(id: string, actorId: string) {
  if (!id || !actorId) {
    throw new AppError('Academic Year ID and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_years')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Year with ID ${id} not found.`, 'ERR_ACADEMIC_YEAR_NOT_FOUND', 404);
    }

    if (item.lifecycle_status !== 'active') {
      throw new AppError('Only active academic years can be locked.', 'ERR_VALIDATION', 400);
    }

    // Guard: check if all semesters associated are locked
    const activeOrDraftSemesters = await db('semesters')
      .where('academic_year_id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .whereNot('lifecycle_status', 'locked')
      .whereNot('lifecycle_status', 'archived')
      .count('id as count')
      .first();

    const count = Number(activeOrDraftSemesters?.count || 0);
    if (count > 0) {
      throw new AppError(
        'Cannot lock academic year because not all semesters are locked.',
        'ERR_SEMESTERS_NOT_LOCKED',
        400
      );
    }

    await db('academic_years').where('id', id).update({
      lifecycle_status: 'locked',
      is_active: 0,
      locked_at: new Date(),
      locked_by: actorId,
      updated_at: new Date()
    });

    return await getAcademicYearById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error locking academic year',
      'ERR_DATABASE',
      500
    );
  }
}

export async function unlockAcademicYear(id: string, actorId: string) {
  if (!id || !actorId) {
    throw new AppError('Academic Year ID and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_years')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Year with ID ${id} not found.`, 'ERR_ACADEMIC_YEAR_NOT_FOUND', 404);
    }

    if (item.lifecycle_status !== 'locked') {
      throw new AppError('Only locked academic years can be unlocked.', 'ERR_VALIDATION', 400);
    }

    await db('academic_years').where('id', id).update({
      lifecycle_status: 'active',
      is_active: 1, // Set active again since it is unlocked
      locked_at: null,
      locked_by: null,
      updated_at: new Date()
    });

    return await getAcademicYearById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error unlocking academic year',
      'ERR_DATABASE',
      500
    );
  }
}

export async function archiveAcademicYear(id: string, actorId: string) {
  if (!id || !actorId) {
    throw new AppError('Academic Year ID and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_years')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Year with ID ${id} not found.`, 'ERR_ACADEMIC_YEAR_NOT_FOUND', 404);
    }

    // active -> archived (only if semesters are locked/archived). Let's verify:
    if (item.lifecycle_status === 'active') {
      const activeOrDraftSemesters = await db('semesters')
        .where('academic_year_id', id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .whereNot('lifecycle_status', 'locked')
        .whereNot('lifecycle_status', 'archived')
        .count('id as count')
        .first();

      const count = Number(activeOrDraftSemesters?.count || 0);
      if (count > 0) {
        throw new AppError(
          'Cannot archive active academic year because not all semesters are locked or archived.',
          'ERR_SEMESTERS_NOT_LOCKED',
          400
        );
      }
    }

    await db('academic_years').where('id', id).update({
      lifecycle_status: 'archived',
      is_active: 0,
      archived_at: new Date(),
      archived_by: actorId,
      updated_at: new Date()
    });

    return await getAcademicYearById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error archiving academic year',
      'ERR_DATABASE',
      500
    );
  }
}

/**
 * Returns the active academic year if it exists.
 */
export async function getActiveAcademicYear(): Promise<any> {
  try {
    return await db("academic_years").where("is_active", 1).first();
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving active academic year',
      'ERR_DATABASE',
      500
    );
  }
}
