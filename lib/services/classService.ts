import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface ClassFilters {
  status?: 'active' | 'inactive';
}

export interface ClassInput {
  code: string;
  name: string;
  level: number;
}

export async function listClasses(filters: ClassFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('classes').whereNot('lifecycle_status', 'soft_deleted');

    if (filters.status) {
      query.where('status', filters.status);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .limit(limit)
      .offset(offset)
      .orderBy('level', 'asc')
      .orderBy('code', 'asc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing classes',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getClassById(id: string) {
  if (!id) {
    throw new AppError('Class ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('classes')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Class with ID ${id} not found.`, 'ERR_CLASS_NOT_FOUND', 404);
    }

    return item;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting class',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createClass(input: ClassInput) {
  if (!input.code || !input.name || input.level === undefined) {
    throw new AppError('Missing required fields: code, name, and level are required.', 'ERR_VALIDATION', 400);
  }

  const levelNum = Number(input.level);
  if (isNaN(levelNum)) {
    throw new AppError('Level must be a valid number.', 'ERR_VALIDATION', 400);
  }

  try {
    // Unique code check (entire table to prevent unique constraint violations)
    const existing = await db('classes')
      .where('code', input.code)
      .first();

    if (existing) {
      throw new AppError(`Class code "${input.code}" is already registered.`, 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    const newItem = {
      id,
      code: input.code,
      name: input.name,
      level: levelNum,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('classes').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating class',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateClass(id: string, input: Partial<ClassInput>) {
  if (!id) {
    throw new AppError('Class ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('classes')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Class with ID ${id} not found.`, 'ERR_CLASS_NOT_FOUND', 404);
    }

    const patch: any = { updated_at: new Date() };

    if (input.code !== undefined) {
      if (!input.code.trim()) throw new AppError('Code cannot be empty.', 'ERR_VALIDATION', 400);
      
      const existing = await db('classes')
        .where('code', input.code)
        .whereNot('id', id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (existing) {
        throw new AppError(`Class code "${input.code}" is already registered by another class.`, 'ERR_VALIDATION', 400);
      }
      patch.code = input.code;
    }

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new AppError('Name cannot be empty.', 'ERR_VALIDATION', 400);
      patch.name = input.name;
    }

    if (input.level !== undefined) {
      const levelNum = Number(input.level);
      if (isNaN(levelNum)) throw new AppError('Level must be a valid number.', 'ERR_VALIDATION', 400);
      patch.level = levelNum;
    }

    if (Object.keys(patch).length > 1) {
      await db('classes').where('id', id).update(patch);
    }

    return await getClassById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating class',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deactivateClass(id: string) {
  if (!id) {
    throw new AppError('Class ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('classes')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Class with ID ${id} not found.`, 'ERR_CLASS_NOT_FOUND', 404);
    }

    // Guard: check for active student_enrollments in this class
    const activeEnrollments = await db('student_enrollments')
      .where('class_id', id)
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const count = Number(activeEnrollments?.count || 0);
    if (count > 0) {
      throw new AppError(
        'Cannot deactivate class because it has active student enrollments.',
        'ERR_CLASS_HAS_ACTIVE_ENROLLMENTS',
        400
      );
    }

    await db('classes').where('id', id).update({
      status: 'inactive',
      lifecycle_status: 'inactive',
      updated_at: new Date()
    });

    return await getClassById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deactivating class',
      'ERR_DATABASE',
      500
    );
  }
}

/**
 * Returns the count of active classes.
 */
export async function countActiveClasses(): Promise<number> {
  try {
    const res = await db("classes")
      .where("lifecycle_status", "active")
      .count("id as count")
      .first();
    return Number(res?.count || 0);
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error counting active classes',
      'ERR_DATABASE',
      500
    );
  }
}
