import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface TeacherProfileInput {
  user_id: string;
  full_name: string;
  gender: 'L' | 'P';
  nip?: string;
  nuptk?: string;
  position?: string;
  address?: string;
  phone?: string;
}

async function ensureAllTeacherProfilesExist() {
  try {
    const teachersWithoutProfile = await db('users')
      .leftJoin('teacher_profiles', 'users.id', 'teacher_profiles.user_id')
      .where('users.role', 'teacher')
      .whereNull('teacher_profiles.id')
      .select('users.id', 'users.name', 'users.phone');

    for (const user of teachersWithoutProfile) {
      const profileId = uuidv4();
      await db('teacher_profiles').insert({
        id: profileId,
        user_id: user.id,
        full_name: user.name,
        gender: 'L',
        phone: user.phone || null,
        address: null,
        nip: null,
        nuptk: null,
        position: 'Guru',
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  } catch (error) {
    console.error('Error synchronizing teacher profiles:', error);
  }
}

export async function listTeacherProfiles(
  filters: { search?: string } = {},
  page = 1,
  limit = 20
) {
  try {
    await ensureAllTeacherProfilesExist();
    const query = db('teacher_profiles')
      .join('users', 'teacher_profiles.user_id', 'users.id')
      .whereNot('teacher_profiles.lifecycle_status', 'soft_deleted')
      .whereNot('users.lifecycle_status', 'soft_deleted');

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query.where(function () {
        this.where('teacher_profiles.full_name', 'like', searchPattern)
          .orWhere('users.email', 'like', searchPattern)
          .orWhere('teacher_profiles.nip', 'like', searchPattern)
          .orWhere('teacher_profiles.nuptk', 'like', searchPattern);
      });
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('teacher_profiles.id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const profiles = await query
      .select(
        'teacher_profiles.*',
        'users.email as user_email',
        'users.username as user_username',
        'users.status as user_status'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('teacher_profiles.created_at', 'desc');

    return {
      data: profiles,
      pagination: {
        page,
        limit,
        total
      }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing teacher profiles',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getTeacherProfileById(id: string) {
  if (!id) {
    throw new AppError('Profile ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const profile = await db('teacher_profiles')
      .join('users', 'teacher_profiles.user_id', 'users.id')
      .where('teacher_profiles.id', id)
      .whereNot('teacher_profiles.lifecycle_status', 'soft_deleted')
      .select(
        'teacher_profiles.*',
        'users.email as user_email',
        'users.username as user_username',
        'users.status as user_status'
      )
      .first();

    if (!profile) {
      throw new AppError(`Teacher profile with ID ${id} not found.`, 'ERR_TEACHER_NOT_FOUND', 404);
    }

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting teacher profile',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getTeacherProfileByUserId(userId: string) {
  if (!userId) {
    throw new AppError('User ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const profile = await db('teacher_profiles')
      .where('user_id', userId)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!profile) {
      throw new AppError(`Teacher profile for User ID ${userId} not found.`, 'ERR_TEACHER_NOT_FOUND', 404);
    }

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting teacher profile by user ID',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createTeacherProfile(input: TeacherProfileInput) {
  // 1. Manual validation
  if (!input.user_id || !input.full_name || !input.gender) {
    throw new AppError('Missing required fields: user_id, full_name, and gender are required.', 'ERR_VALIDATION', 400);
  }

  if (input.gender !== 'L' && input.gender !== 'P') {
    throw new AppError('Gender must be L (Laki-laki) or P (Perempuan).', 'ERR_VALIDATION', 400);
  }

  try {
    // 2. Verify user exists and has the role 'teacher'
    const user = await db('users').where('id', input.user_id).first();
    if (!user) {
      throw new AppError(`User with ID ${input.user_id} does not exist.`, 'ERR_VALIDATION', 400);
    }

    if (user.role !== 'teacher') {
      throw new AppError('The linked user must have the role "teacher".', 'ERR_VALIDATION', 400);
    }

    // 3. Verify 1-to-1 constraint (one teacher profile per user_id)
    const existingProfile = await db('teacher_profiles').where('user_id', input.user_id).first();
    if (existingProfile) {
      throw new AppError('A teacher profile already exists for this user.', 'ERR_VALIDATION', 400);
    }

    // 4. Create profile
    const profileId = uuidv4();
    const newProfile = {
      id: profileId,
      user_id: input.user_id,
      full_name: input.full_name,
      gender: input.gender,
      phone: input.phone || null,
      address: input.address || null,
      nip: input.nip || null,
      nuptk: input.nuptk || null,
      position: input.position || null,
      status: 'active',
      lifecycle_status: 'active'
    };

    await db('teacher_profiles').insert(newProfile);
    return newProfile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating teacher profile',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateTeacherProfile(id: string, input: Partial<Omit<TeacherProfileInput, 'user_id'>>) {
  if (!id) {
    throw new AppError('Profile ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const profile = await db('teacher_profiles').where('id', id).first();
    if (!profile) {
      throw new AppError(`Teacher profile with ID ${id} not found.`, 'ERR_TEACHER_NOT_FOUND', 404);
    }

    const patch: any = {};

    if (input.full_name !== undefined) {
      if (!input.full_name.trim()) throw new AppError('Full name cannot be empty.', 'ERR_VALIDATION', 400);
      patch.full_name = input.full_name;
    }

    if (input.gender !== undefined) {
      if (input.gender !== 'L' && input.gender !== 'P') {
        throw new AppError('Gender must be L or P.', 'ERR_VALIDATION', 400);
      }
      patch.gender = input.gender;
    }

    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.address !== undefined) patch.address = input.address || null;
    if (input.nip !== undefined) patch.nip = input.nip || null;
    if (input.nuptk !== undefined) patch.nuptk = input.nuptk || null;
    if (input.position !== undefined) patch.position = input.position || null;

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date();
      await db('teacher_profiles').where('id', id).update(patch);
    }

    return await getTeacherProfileById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating teacher profile',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deactivateTeacherProfile(id: string) {
  if (!id) {
    throw new AppError('Profile ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const profile = await db('teacher_profiles').where('id', id).first();
    if (!profile) {
      throw new AppError(`Teacher profile with ID ${id} not found.`, 'ERR_TEACHER_NOT_FOUND', 404);
    }

    await db('teacher_profiles').where('id', id).update({
      status: 'inactive',
      lifecycle_status: 'archived',
      updated_at: new Date()
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deactivating teacher profile',
      'ERR_DATABASE',
      500
    );
  }
}
