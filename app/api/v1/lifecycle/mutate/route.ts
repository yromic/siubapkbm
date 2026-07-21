import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

// Valid lifecycle transitions per entity type
const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  academic_year: {
    draft: ['active'],
    active: ['locked', 'archived'],
    locked: ['active', 'archived'],
    archived: []
  },
  semester: {
    draft: ['active'],
    active: ['locked'],
    locked: ['active', 'archived', 'finalized'],
    finalized: [],
    archived: []
  },
  user: {
    active: ['inactive', 'suspended', 'archived', 'soft_deleted'],
    inactive: ['active', 'archived', 'soft_deleted'],
    suspended: ['active', 'soft_deleted'],
    archived: ['active', 'soft_deleted'],
    soft_deleted: ['active']
  },
  student: {
    active: ['inactive', 'archived', 'soft_deleted'],
    inactive: ['active', 'archived', 'soft_deleted'],
    archived: ['active', 'soft_deleted'],
    soft_deleted: ['active']
  },
  class: {
    active: ['inactive', 'archived', 'soft_deleted'],
    inactive: ['active', 'archived', 'soft_deleted'],
    archived: ['active', 'soft_deleted'],
    soft_deleted: ['active']
  },
  subject: {
    active: ['inactive', 'archived', 'soft_deleted'],
    inactive: ['active', 'archived', 'soft_deleted'],
    archived: ['active', 'soft_deleted'],
    soft_deleted: ['active']
  },
  teacher_profile: {
    active: ['inactive', 'archived', 'soft_deleted'],
    inactive: ['active', 'archived', 'soft_deleted'],
    archived: ['active', 'soft_deleted'],
    soft_deleted: ['active']
  },
  class_teacher_assignment: {
    active: ['inactive', 'archived', 'soft_deleted'],
    inactive: ['active', 'archived', 'soft_deleted'],
    archived: ['active', 'soft_deleted'],
    soft_deleted: ['active']
  }
};

// Table map
const ENTITY_TABLE_MAP: Record<string, string> = {
  academic_year: 'academic_years',
  semester: 'semesters',
  user: 'users',
  student: 'students',
  class: 'classes',
  subject: 'subjects',
  teacher_profile: 'teacher_profiles',
  class_teacher_assignment: 'class_teacher_assignments'
};

export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const { entity_type, id, status } = body;

        if (!entity_type || !id || !status) {
          throw new AppError('entity_type, id, and status are required.', 'ERR_VALIDATION', 400);
        }

        const tableName = ENTITY_TABLE_MAP[entity_type];
        if (!tableName) {
          throw new AppError(`Unknown entity_type: ${entity_type}. Valid types: ${Object.keys(ENTITY_TABLE_MAP).join(', ')}`, 'ERR_VALIDATION', 400);
        }

        const entity = await (db as any)(tableName).where('id', id).first();
        if (!entity) {
          throw new AppError(`${entity_type} with ID ${id} not found.`, 'ERR_VALIDATION', 404);
        }

        const isStudent = entity_type === 'student';
        const currentStatus = isStudent ? entity.status : entity.lifecycle_status;
        const transitions = VALID_TRANSITIONS[entity_type];

        if (transitions) {
          const allowedStatuses = transitions[currentStatus] || [];
          if (!allowedStatuses.includes(status)) {
            throw new AppError(
              `Invalid transition for ${entity_type}: ${currentStatus} → ${status}. Allowed: [${allowedStatuses.join(', ') || 'none'}]`,
              'ERR_INVALID_TRANSITION',
              400
            );
          }
        }

        const patch: any = { updated_at: new Date() };
        if (isStudent) {
          patch.status = status;
        } else {
          patch.lifecycle_status = status;
        }

        // Additional fields for specific transitions
        if (status === 'soft_deleted') {
          patch.deleted_at = new Date();
          patch.deleted_by = (req as any).user.id;
          if ((entity_type === 'class' || entity_type === 'subject') && entity.code && !entity.code.includes('_soft_deleted_')) {
            patch.code = `${entity.code.substring(0, 30)}_soft_deleted_${Date.now()}`;
          } else if (entity_type === 'user') {
            const { generateSoftDeletedIdentifier } = require('@/lib/services/userService');
            patch.email = generateSoftDeletedIdentifier(entity.email);
            patch.username = generateSoftDeletedIdentifier(entity.username);
          }
        } else if (status === 'active') {
          if (entity_type === 'user') {
            const { extractOriginalIdentifier, validateUserIdentifiers } = require('@/lib/services/userService');
            const originalEmail = extractOriginalIdentifier(entity.email);
            const originalUsername = extractOriginalIdentifier(entity.username);
            
            // Check conflicts (excluding this user)
            await validateUserIdentifiers(originalEmail, originalUsername, id);
            
            patch.email = originalEmail;
            patch.username = originalUsername;
            patch.deleted_at = null;
            patch.deleted_by = null;
          } else if (entity_type === 'class' || entity_type === 'subject') {
            patch.deleted_at = null;
            patch.deleted_by = null;
            if (entity.code && entity.code.includes('_soft_deleted_')) {
              const originalCode = entity.code.split('_soft_deleted_')[0];
              const existing = await db(tableName)
                .where('code', originalCode)
                .whereNot('id', id)
                .whereNot('lifecycle_status', 'soft_deleted')
                .first();
              if (existing) {
                throw new AppError(`Cannot restore ${entity_type}. The original code (${originalCode}) is already taken.`, 'ERR_VALIDATION', 400);
              }
              patch.code = originalCode;
            }
          }
        } else if (status === 'archived') {
          patch.archived_at = new Date();
          patch.archived_by = (req as any).user.id;
          if ((entity_type === 'class' || entity_type === 'subject') && entity.code && !entity.code.includes('_archived_')) {
            patch.code = `${entity.code.substring(0, 30)}_archived_${Date.now()}`;
          }
        }

        // Check if teacher has active homeroom assignments before soft delete
        let hasActiveAssignments = false;
        if (entity_type === 'user' && status === 'soft_deleted' && entity.role === 'teacher') {
          const activeAssignment = await db('class_teacher_assignments')
            .where({
              teacher_user_id: id,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();
          if (activeAssignment) {
            hasActiveAssignments = true;
          }
        }

        // Check active student enrollments and active teacher assignments for classes
        let classAssignmentsToTerminate: string[] = [];
        if (entity_type === 'class' && status === 'soft_deleted') {
          const activeEnrollment = await db('student_enrollments')
            .where({
              class_id: id,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .first();

          if (activeEnrollment) {
            throw new AppError(
              'Kelas tidak dapat dihapus karena masih memiliki siswa aktif. Pindahkan atau nonaktifkan enrollment terlebih dahulu.',
              'ERR_VALIDATION',
              400
            );
          }

          const activeAssignments = await db('class_teacher_assignments')
            .where({
              class_id: id,
              status: 'active'
            })
            .whereNot('lifecycle_status', 'soft_deleted')
            .select('id');

          classAssignmentsToTerminate = activeAssignments.map((a: any) => a.id);
        }

        await db.transaction(async (trx: any) => {
          await trx(tableName).where('id', id).update(patch);

          if (entity_type === 'class' && status === 'soft_deleted' && classAssignmentsToTerminate.length > 0) {
            await trx('class_teacher_assignments')
              .whereIn('id', classAssignmentsToTerminate)
              .update({
                status: 'inactive',
                lifecycle_status: 'inactive',
                effective_until: new Date(),
                updated_at: new Date()
              });
          }

          if (entity_type === 'user' && entity.role === 'teacher') {
            if (status === 'soft_deleted') {
              await trx('teacher_profiles')
                .where('user_id', id)
                .update({
                  lifecycle_status: 'soft_deleted',
                  deleted_at: patch.deleted_at,
                  deleted_by: patch.deleted_by,
                  updated_at: new Date()
                });

              // Terminate all active assignments for the soft deleted teacher
              await trx('class_teacher_assignments')
                .where({
                  teacher_user_id: id,
                  status: 'active'
                })
                .whereNot('lifecycle_status', 'soft_deleted')
                .update({
                  status: 'inactive',
                  lifecycle_status: 'inactive',
                  effective_until: new Date(),
                  updated_at: new Date()
                });
            } else if (status === 'active') {
              await trx('teacher_profiles')
                .where('user_id', id)
                .update({
                  lifecycle_status: 'active',
                  deleted_at: null,
                  deleted_by: null,
                  updated_at: new Date()
                });
            }
          }
        });

        const updated = await db(tableName).where('id', id).first();
        let message = `${entity_type} status updated to ${status}.`;
        if (hasActiveAssignments) {
          message += ` Warning: Penugasan wali kelas aktif guru ini otomatis diakhiri karena akun guru dihapus.`;
        }
        if (entity_type === 'class' && status === 'soft_deleted' && classAssignmentsToTerminate.length > 0) {
          message += ` Warning: Penugasan wali kelas aktif pada kelas ini otomatis diakhiri karena kelas dihapus.`;
        }
        return successResponse(updated, message);
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
