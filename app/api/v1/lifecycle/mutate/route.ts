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
          }
        } else if (status === 'archived') {
          patch.archived_at = new Date();
          patch.archived_by = (req as any).user.id;
          if ((entity_type === 'class' || entity_type === 'subject') && entity.code && !entity.code.includes('_archived_')) {
            patch.code = `${entity.code.substring(0, 30)}_archived_${Date.now()}`;
          }
        }

        await (db as any)(tableName).where('id', id).update(patch);

        const updated = await (db as any)(tableName).where('id', id).first();
        return successResponse(updated, `${entity_type} status updated to ${status}.`);
      } catch (error) {
        if (error instanceof AppError) return errorResponse(error.message, error.code, error.statusCode);
        return errorResponse(error instanceof Error ? error.message : 'Error', 'ERR_INTERNAL', 500);
      }
    });
  });
}
