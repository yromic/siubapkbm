import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface SubjectFilters {
  status?: 'active' | 'inactive';
}

export interface SubjectInput {
  code: string;
  name: string;
  description?: string;
}

export async function listSubjects(filters: SubjectFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('subjects').whereNot('lifecycle_status', 'soft_deleted');

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
      .orderBy('code', 'asc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing subjects',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getSubjectById(id: string) {
  if (!id) {
    throw new AppError('Subject ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('subjects')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Subject with ID ${id} not found.`, 'ERR_SUBJECT_NOT_FOUND', 404);
    }

    return item;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting subject',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createSubject(input: SubjectInput) {
  if (!input.code || !input.name) {
    throw new AppError('Missing required fields: code and name are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('subjects')
      .where('code', input.code)
      .first();

    if (existing) {
      throw new AppError(`Subject code "${input.code}" is already registered.`, 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    const newItem = {
      id,
      code: input.code,
      name: input.name,
      description: input.description || null,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('subjects').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating subject',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateSubject(id: string, input: Partial<SubjectInput>) {
  if (!id) {
    throw new AppError('Subject ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('subjects')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Subject with ID ${id} not found.`, 'ERR_SUBJECT_NOT_FOUND', 404);
    }

    const patch: any = { updated_at: new Date() };

    if (input.code !== undefined) {
      if (!input.code.trim()) throw new AppError('Code cannot be empty.', 'ERR_VALIDATION', 400);

      const existing = await db('subjects')
        .where('code', input.code)
        .whereNot('id', id)
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (existing) {
        throw new AppError(`Subject code "${input.code}" is already registered by another subject.`, 'ERR_VALIDATION', 400);
      }
      patch.code = input.code;
    }

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new AppError('Name cannot be empty.', 'ERR_VALIDATION', 400);
      patch.name = input.name;
    }

    if (input.description !== undefined) {
      patch.description = input.description || null;
    }

    if (Object.keys(patch).length > 1) {
      await db('subjects').where('id', id).update(patch);
    }

    return await getSubjectById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating subject',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deactivateSubject(id: string) {
  if (!id) {
    throw new AppError('Subject ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('subjects')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Subject with ID ${id} not found.`, 'ERR_SUBJECT_NOT_FOUND', 404);
    }

    // Guard: check for active class_subjects mapped to this subject
    const activeClassSubjects = await db('class_subjects')
      .where('subject_id', id)
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const count = Number(activeClassSubjects?.count || 0);
    if (count > 0) {
      throw new AppError(
        'Cannot deactivate subject because it is currently assigned active to classes.',
        'ERR_SUBJECT_HAS_ACTIVE_CLASSES',
        400
      );
    }

    await db('subjects').where('id', id).update({
      status: 'inactive',
      lifecycle_status: 'inactive',
      updated_at: new Date()
    });

    return await getSubjectById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deactivating subject',
      'ERR_DATABASE',
      500
    );
  }
}
