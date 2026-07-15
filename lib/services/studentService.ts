import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { AppError } from '@/lib/errors';
import { validateNisn } from '@/lib/validation/student';

export interface StudentFilters {
  status?: string;
  search?: string;
}

const statusMap: Record<string, string> = {
  'Aktif': 'active',
  'Tidak aktif': 'inactive',
  'Lulus': 'graduated',
  'Pindah': 'transferred',
  'Keluar': 'withdrawn',
  'Meninggal': 'deceased',
  'active': 'active',
  'inactive': 'inactive',
  'graduated': 'graduated',
  'transferred': 'transferred',
  'withdrawn': 'withdrawn',
  'deceased': 'deceased'
};

export interface StudentInput {
  nisn: string;
  nik?: string;
  full_name: string;
  birth_place?: string;
  birth_date: string | Date;
  gender: 'L' | 'P';
  religion?: string;
  phone?: string;
  affirmation?: string;
  special_needs?: string;
  status?: string;
  family_card_number?: string;
  family_card_date?: string | Date;
  mother_name?: string;
  mother_nik?: string;
  father_name?: string;
  father_nik?: string;
  guardian_name?: string;
  guardian_nik?: string;
  address_street?: string;
  rt?: string;
  rw?: string;
  hamlet?: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  spp_amount?: number;
  parent_access_pin?: string;
}

export async function listStudents(filters: StudentFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('students');

    if (filters.status === 'soft_deleted') {
      query.where('status', 'soft_deleted');
    } else {
      query.whereNot('status', 'soft_deleted');
      if (filters.status) {
        query.where('status', filters.status);
      }
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query.where(function () {
        this.where('full_name', 'like', searchPattern)
          .orWhere('nisn', 'like', searchPattern)
          .orWhere('nik', 'like', searchPattern);
      });
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .limit(limit)
      .offset(offset)
      .orderBy('full_name', 'asc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing students',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getStudentById(id: string) {
  if (!id) {
    throw new AppError('Student ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('students')
      .where('id', id)
      .whereNot('status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Student with ID ${id} not found.`, 'ERR_STUDENT_NOT_FOUND', 404);
    }

    // Sanitize pin hash
    const { parent_access_pin_hash, ...sanitizedItem } = item;
    return sanitizedItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting student',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createStudent(input: StudentInput) {
  if (!input.nisn || !input.full_name || !input.birth_date || !input.gender) {
    throw new AppError('Missing required fields: nisn, full_name, birth_date, and gender are required.', 'ERR_VALIDATION', 400);
  }

  const nisnError = validateNisn(input.nisn);
  if (nisnError) {
    throw new AppError(nisnError, 'ERR_VALIDATION', 400);
  }

  const birthDate = new Date(input.birth_date);
  if (birthDate > new Date()) {
    throw new AppError('Birth date cannot be in the future.', 'ERR_VALIDATION', 400);
  }

  if (input.gender !== 'L' && input.gender !== 'P') {
    throw new AppError('Gender must be L or P.', 'ERR_VALIDATION', 400);
  }

  try {
    // Unique NISN check (entire table to prevent unique constraint violations)
    const existing = await db('students')
      .where('nisn', input.nisn)
      .first();

    if (existing) {
      throw new AppError(`Student with NISN "${input.nisn}" is already registered.`, 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    
    // Hash PIN if provided
    let pinHash: string | null = null;
    if (input.parent_access_pin) {
      pinHash = await bcrypt.hash(input.parent_access_pin, 10);
    }

    const newItem: any = {
      id,
      nisn: input.nisn,
      nik: input.nik || null,
      full_name: input.full_name,
      birth_place: input.birth_place || null,
      birth_date: birthDate,
      gender: input.gender,
      religion: input.religion || null,
      phone: input.phone || null,
      affirmation: input.affirmation || null,
      special_needs: input.special_needs || null,
      family_card_number: input.family_card_number || null,
      family_card_date: input.family_card_date ? new Date(input.family_card_date) : null,
      mother_name: input.mother_name || null,
      mother_nik: input.mother_nik || null,
      father_name: input.father_name || null,
      father_nik: input.father_nik || null,
      guardian_name: input.guardian_name || null,
      guardian_nik: input.guardian_nik || null,
      address_street: input.address_street || null,
      rt: input.rt || null,
      rw: input.rw || null,
      hamlet: input.hamlet || null,
      village: input.village || null,
      district: input.district || null,
      city: input.city || null,
      province: input.province || null,
      spp_amount: input.spp_amount || null,
      parent_access_pin_hash: pinHash,
      status: statusMap[input.status || ''] || 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('students').insert(newItem);
    
    const { parent_access_pin_hash, ...sanitizedItem } = newItem;
    return sanitizedItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating student',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateStudent(id: string, input: Partial<Omit<StudentInput, 'parent_access_pin'>>) {
  if (!id) {
    throw new AppError('Student ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('students').where('id', id).whereNot('status', 'soft_deleted').first();
    if (!item) {
      throw new AppError(`Student with ID ${id} not found.`, 'ERR_STUDENT_NOT_FOUND', 404);
    }

    const patch: any = { updated_at: new Date() };

    if (input.nisn !== undefined) {
      if (!input.nisn.trim()) throw new AppError('NISN cannot be empty.', 'ERR_VALIDATION', 400);
      
      const nisnError = validateNisn(input.nisn);
      if (nisnError) {
        throw new AppError(nisnError, 'ERR_VALIDATION', 400);
      }
      
      const existing = await db('students')
        .where('nisn', input.nisn)
        .whereNot('id', id)
        .whereNot('status', 'soft_deleted')
        .first();

      if (existing) {
        throw new AppError(`Student with NISN "${input.nisn}" is already registered.`, 'ERR_VALIDATION', 400);
      }
      patch.nisn = input.nisn;
    }

    if (input.full_name !== undefined) {
      if (!input.full_name.trim()) throw new AppError('Full name cannot be empty.', 'ERR_VALIDATION', 400);
      patch.full_name = input.full_name;
    }

    if (input.birth_date !== undefined) {
      const birthDate = new Date(input.birth_date);
      if (birthDate > new Date()) {
        throw new AppError('Birth date cannot be in the future.', 'ERR_VALIDATION', 400);
      }
      patch.birth_date = birthDate;
    }

    if (input.gender !== undefined) {
      if (input.gender !== 'L' && input.gender !== 'P') {
        throw new AppError('Gender must be L or P.', 'ERR_VALIDATION', 400);
      }
      patch.gender = input.gender;
    }

    // Map other fields
    const optionalFields = [
      'nik', 'birth_place', 'religion', 'phone', 'affirmation', 'special_needs',
      'family_card_number', 'mother_name', 'mother_nik', 'father_name', 'father_nik',
      'guardian_name', 'guardian_nik', 'address_street', 'rt', 'rw', 'hamlet',
      'village', 'district', 'city', 'province', 'spp_amount', 'status'
    ];

    for (const f of optionalFields) {
      if ((input as any)[f] !== undefined) {
        if (f === 'status') {
          patch[f] = statusMap[(input as any)[f] || ''] || 'active';
        } else {
          patch[f] = (input as any)[f] || null;
        }
      }
    }

    if (input.family_card_date !== undefined) {
      patch.family_card_date = input.family_card_date ? new Date(input.family_card_date) : null;
    }

    if (Object.keys(patch).length > 1) {
      await db('students').where('id', id).update(patch);
    }

    return await getStudentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating student',
      'ERR_DATABASE',
      500
    );
  }
}

export async function changeStudentStatus(id: string, status: string, actorId: string) {
  if (!id || !status || !actorId) {
    throw new AppError('Student ID, status, and actor ID are required.', 'ERR_VALIDATION', 400);
  }

  const allowedStatus = ['active', 'inactive', 'graduated', 'transferred', 'withdrawn', 'deceased', 'archived', 'soft_deleted'];
  if (!allowedStatus.includes(status)) {
    throw new AppError('Invalid status value.', 'ERR_VALIDATION', 400);
  }

  try {
    const student = await db('students').where('id', id).whereNot('status', 'soft_deleted').first();
    if (!student) {
      throw new AppError(`Student with ID ${id} not found.`, 'ERR_STUDENT_NOT_FOUND', 404);
    }

    await db.transaction(async (trx) => {
      const patch: any = { status, updated_at: new Date() };

      if (status === 'archived') {
        patch.archived_at = new Date();
        patch.archived_by = actorId;
      } else if (status === 'soft_deleted') {
        patch.deleted_at = new Date();
        patch.deleted_by = actorId;
      }

      // Cascading deactivation logic if status becomes inactive, graduated, transferred, withdrawn, deceased, or soft_deleted
      const isDeactivating = ['inactive', 'graduated', 'transferred', 'withdrawn', 'deceased', 'soft_deleted'].includes(status);
      
      if (isDeactivating) {
        // 1. Set all active student_enrollments to inactive
        await trx('student_enrollments')
          .where('student_id', id)
          .where('status', 'active')
          .update({
            status: 'inactive',
            lifecycle_status: 'inactive',
            updated_at: new Date()
          });

        // 2. Set all student_files to archived lifecycle_status
        await trx('student_files')
          .where('student_id', id)
          .whereNot('lifecycle_status', 'soft_deleted')
          .update({
            lifecycle_status: 'archived',
            updated_at: new Date()
          });

        // 3. Revoke parent PIN
        patch.parent_access_pin_hash = null;
        patch.parent_access_pin_failed_attempts = 0;
        patch.parent_access_pin_locked_until = null;
      }

      await trx('students').where('id', id).update(patch);
    });

    if (status === 'soft_deleted') {
      return null;
    }
    return await getStudentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error changing student status',
      'ERR_DATABASE',
      500
    );
  }
}

export async function resetParentPin(id: string, parentPin: string) {
  if (!id || !parentPin) {
    throw new AppError('Student ID and parent PIN are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const student = await db('students').where('id', id).whereNot('status', 'soft_deleted').first();
    if (!student) {
      throw new AppError(`Student with ID ${id} not found.`, 'ERR_STUDENT_NOT_FOUND', 404);
    }

    const pinHash = await bcrypt.hash(parentPin, 10);

    await db('students').where('id', id).update({
      parent_access_pin_hash: pinHash,
      parent_access_pin_failed_attempts: 0,
      parent_access_pin_locked_until: null,
      updated_at: new Date()
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error resetting parent PIN',
      'ERR_DATABASE',
      500
    );
  }
}
