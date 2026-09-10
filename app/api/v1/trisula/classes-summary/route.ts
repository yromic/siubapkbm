import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import { resolvePhaseByClassLevel } from '@/lib/utils/academicUtils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/trisula/classes-summary
 *
 * Returns lightweight class-level summary for Trisula class card landing.
 * Role-scoped:
 *   Admin → all active classes
 *   Teacher → assigned classes only
 *
 * For each class, returns:
 *   - class metadata + fase
 *   - total enrolled student count
 *   - per-pillar completion: literasi / numerasi / diniyyah scored counts
 *   - overall complete count (all 3 pillars scored)
 *   - assessment_id if one exists for this class
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(['administrator', 'admin', 'teacher', 'guru'], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const isAdmin = user.role === 'administrator' || user.role === 'admin';

        // Step 1: Get accessible classes (role-scoped)
        let accessibleClasses: { id: string; name: string; code: string; level: number }[];

        if (isAdmin) {
          accessibleClasses = await db('classes')
            .where('status', 'active')
            .whereNot('lifecycle_status', 'soft_deleted')
            .orderBy('level', 'asc')
            .orderBy('code', 'asc')
            .select('id', 'code', 'name', 'level');
        } else {
          const assignments = await db('class_teacher_assignments')
            .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
            .where('class_teacher_assignments.teacher_user_id', user.id)
            .where('class_teacher_assignments.status', 'active')
            .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
            .where('classes.status', 'active')
            .whereNot('classes.lifecycle_status', 'soft_deleted')
            .orderBy('classes.level', 'asc')
            .orderBy('classes.code', 'asc')
            .select('classes.id', 'classes.code', 'classes.name', 'classes.level');

          const seen = new Set<string>();
          accessibleClasses = assignments.filter((c: any) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        }

        if (accessibleClasses.length === 0) {
          return successResponse({ items: [], total: 0 }, 'Tidak ada kelas yang dapat diakses.');
        }

        const classIds = accessibleClasses.map((c) => c.id);

        // Step 2: Get enrolled student counts per class
        const enrollmentCounts: { class_id: string; count: string }[] = await db('student_enrollments')
          .whereIn('class_id', classIds)
          .where('status', 'active')
          .whereNot('lifecycle_status', 'soft_deleted')
          .groupBy('class_id')
          .select('class_id')
          .count('id as count') as any;

        const enrollmentMap = new Map(enrollmentCounts.map((e) => [e.class_id, Number(e.count)]));

        // Step 3: Get trisula assessments for these classes (latest per class)
        let assessments: any[] = [];
        const hasTrisulaTable = await db.schema.hasTable('trisula_assessments');
        if (hasTrisulaTable) {
          assessments = await db('trisula_assessments')
            .whereIn('class_id', classIds)
            .orderBy('created_at', 'desc')
            .select('id', 'class_id', 'status');
        }

        // Map class → latest assessment
        const assessmentByClass = new Map<string, string>(); // class_id → assessment_id
        for (const a of assessments) {
          if (!assessmentByClass.has(a.class_id)) {
            assessmentByClass.set(a.class_id, a.id);
          }
        }

        // Step 4: Get gradebook scores for assessments
        const assessmentIds = Array.from(assessmentByClass.values());
        let scoreCounts: { assessment_id: string; lit: number; num: number; din: number; complete: number }[] = [];

        if (assessmentIds.length > 0) {
          const hasSummaries = await db.schema.hasTable('trisula_student_summaries');
          if (hasSummaries) {
            // Count students with each pillar scored per assessment from trisula_student_summaries
            const summaries = await db('trisula_student_summaries')
              .whereIn('assessment_id', assessmentIds)
              .select('assessment_id', 'literasi_score', 'numerasi_score', 'diniyyah_score') as any[];

            // Group manually
            const scoreMap = new Map<string, { lit: number; num: number; din: number; complete: number }>();
            for (const s of summaries) {
              if (!scoreMap.has(s.assessment_id)) {
                scoreMap.set(s.assessment_id, { lit: 0, num: 0, din: 0, complete: 0 });
              }
              const entry = scoreMap.get(s.assessment_id)!;
              if (s.literasi_score !== null && s.literasi_score !== undefined) entry.lit++;
              if (s.numerasi_score !== null && s.numerasi_score !== undefined) entry.num++;
              if (s.diniyyah_score !== null && s.diniyyah_score !== undefined) entry.din++;
              if (
                s.literasi_score !== null && s.literasi_score !== undefined &&
                s.numerasi_score !== null && s.numerasi_score !== undefined &&
                s.diniyyah_score !== null && s.diniyyah_score !== undefined
              ) {
                entry.complete++;
              }
            }

            scoreCounts = assessmentIds.map((id) => ({
              assessment_id: id,
              ...(scoreMap.get(id) || { lit: 0, num: 0, din: 0, complete: 0 }),
            }));
          } else {
            // Fallback: check trisula_student_scores if summaries table does not exist
            const hasScores = await db.schema.hasTable('trisula_student_scores');
            if (hasScores) {
              const scores = await db('trisula_student_scores')
                .whereIn('assessment_id', assessmentIds)
                .whereNotNull('score')
                .select('assessment_id', 'student_id', 'pillar') as any[];

              const studentPillars = new Map<string, Map<string, Set<string>>>();
              for (const s of scores) {
                if (!studentPillars.has(s.assessment_id)) {
                  studentPillars.set(s.assessment_id, new Map());
                }
                const studMap = studentPillars.get(s.assessment_id)!;
                if (!studMap.has(s.student_id)) {
                  studMap.set(s.student_id, new Set());
                }
                studMap.get(s.student_id)!.add(s.pillar);
              }

              scoreCounts = assessmentIds.map((id) => {
                const studMap = studentPillars.get(id) || new Map();
                let lit = 0, num = 0, din = 0, complete = 0;
                studMap.forEach((pillars) => {
                  if (pillars.has('LITERASI')) lit++;
                  if (pillars.has('NUMERASI')) num++;
                  if (pillars.has('DINIYYAH')) din++;
                  if (pillars.has('LITERASI') && pillars.has('NUMERASI') && pillars.has('DINIYYAH')) complete++;
                });
                return { assessment_id: id, lit, num, din, complete };
              });
            }
          }
        }

        const scoreByAssessment = new Map(scoreCounts.map((s) => [s.assessment_id, s]));

        // Step 5: Build summary per class
        const items = accessibleClasses.map((cls) => {
          const studentCount = enrollmentMap.get(cls.id) || 0;
          const assessmentId = assessmentByClass.get(cls.id) || null;
          const scoreData = assessmentId ? scoreByAssessment.get(assessmentId) : null;
          const fase = resolvePhaseByClassLevel(cls.level);

          return {
            class_id: cls.id,
            class_name: cls.name,
            class_code: cls.code,
            class_level: cls.level,
            fase,
            student_count: studentCount,
            assessment_id: assessmentId,
            literasi_count: scoreData?.lit || 0,
            numerasi_count: scoreData?.num || 0,
            diniyyah_count: scoreData?.din || 0,
            complete_count: scoreData?.complete || 0,
            has_assessment: !!assessmentId,
          };
        });

        return successResponse(
          { items, total: items.length },
          'Ringkasan Trisula per kelas berhasil dimuat.'
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Gagal memuat ringkasan Trisula.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
