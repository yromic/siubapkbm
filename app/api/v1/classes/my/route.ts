import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/classes/my
 *
 * Returns classes scoped to the current user's role:
 * - ADMIN / ADMINISTRATOR: all active classes
 * - TEACHER: only classes currently assigned to that teacher
 *   (via class_teacher_assignments, status = active)
 *
 * This is the canonical role-scoped class list for KKTP and Trisula
 * landing pages. Never returns unauthorized classes.
 *
 * Response format:
 *  { items: [{ id, code, name, level, class_id, class_name, class_level, ... }], total }
 *
 * For backwards compat, each item includes both `id` and `class_id` pointing to the class.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const isAdmin = user.role === 'administrator' || user.role === 'admin';

        if (isAdmin) {
          // Admin: all active classes
          const classes = await db('classes')
            .where('status', 'active')
            .whereNot('lifecycle_status', 'soft_deleted')
            .orderBy('level', 'asc')
            .orderBy('code', 'asc')
            .select('id', 'id as class_id', 'code', 'code as class_code', 'name', 'name as class_name', 'level', 'level as class_level', 'status');

          return successResponse(
            { items: classes, total: classes.length, data: classes },
            'Kelas berhasil dimuat.'
          );
        } else {
          // Teacher: only assigned classes
          const userId = user.id;
          const assignments = await db('class_teacher_assignments')
            .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
            .join('academic_years', 'class_teacher_assignments.academic_year_id', 'academic_years.id')
            .join('semesters', 'class_teacher_assignments.semester_id', 'semesters.id')
            .where('class_teacher_assignments.teacher_user_id', userId)
            .where('class_teacher_assignments.status', 'active')
            .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
            .where('classes.status', 'active')
            .whereNot('classes.lifecycle_status', 'soft_deleted')
            .orderBy('classes.level', 'asc')
            .orderBy('classes.code', 'asc')
            .select(
              'class_teacher_assignments.id as assignment_id',
              'class_teacher_assignments.academic_year_id',
              'class_teacher_assignments.semester_id',
              'class_teacher_assignments.effective_from',
              'classes.id as class_id',
              'classes.id as id',
              'classes.code as class_code',
              'classes.code as code',
              'classes.name as class_name',
              'classes.name as name',
              'classes.level as class_level',
              'classes.level as level',
              'academic_years.name as academic_year_name',
              'semesters.name as semester_name'
            );

          // Deduplicate by class_id
          const seen = new Set<string>();
          const items = assignments.filter((c: any) => {
            if (seen.has(c.class_id)) return false;
            seen.add(c.class_id);
            return true;
          });

          return successResponse(
            { items, total: items.length, data: items },
            'Assigned classes retrieved.'
          );
        }
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal memuat daftar kelas.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
