/**
 * Character Summary Service
 *
 * PARTIALLY DEPRECATED (Sprint 7):
 * - `calculateAndGetSemesterSummary` → @deprecated — throws ERR_DEPRECATED immediately.
 *   Use `utsmanCalculationService.calculateAndSaveUTSMAN()` instead.
 * - `calculateSummaryFromScores`, `groupScoresByWeek`, `groupScoresByMonth` →
 *   @deprecated internal helpers for the dropped legacy FITRAH tables.
 *
 * ACTIVE PRODUCTION FUNCTIONS (still used by dashboard + character-recap):
 * - `getClassCharacterSummary` — queries culture_scores + character_utsman_semester_summary
 * - `getFitrahRadarDataForSemester` — name kept for backwards compat; now reads UTSMAN table
 * - `getBestCultureClassAverage` — name kept for backwards compat; now reads UTSMAN table
 */
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';

/**
 * Re-export legacy functions from ./legacy/characterSummaryService.legacy
 * @deprecated Kept for historical reference.
 */
export {
  calculateAndGetSemesterSummary,
  calculateSummaryFromScores,
  groupScoresByWeek,
  groupScoresByMonth,
} from './legacy/characterSummaryService.legacy';



export async function getClassCharacterSummary(
  classId: string,
  academicYearId: string,
  semesterId: string,
  filters: { week_start_date?: string; month?: number; year?: number } = {}
) {
  if (!classId || !academicYearId || !semesterId) {
    throw new AppError('Class ID, Academic Year ID, and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // 1. Get all active student enrollments for the class in this period
    const enrollments = await db('student_enrollments')
      .where({
        class_id: classId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        status: 'active'
      })
      .whereNot('lifecycle_status', 'soft_deleted');

    const studentIds = enrollments.map((e: any) => e.student_id);
    if (studentIds.length === 0) {
      return [];
    }

    // 2. Fetch the student details
    const students = await db('students')
      .whereIn('id', studentIds)
      .whereNot('status', 'soft_deleted')
      .orderBy('full_name', 'asc');

    const list = [];

    if (filters.week_start_date) {
      // ── Weekly mode: query culture_scores directly ──────────────────────
      // character_weekly_summaries was dropped in migration 20260805220000
      const weekStart = filters.week_start_date;
      const weekScores = await db('culture_scores')
        .where('week_start_date', weekStart)
        .where('semester_id', semesterId)
        .whereIn('student_id', studentIds)
        .whereNot('lifecycle_status', 'soft_deleted');

      const scoreMap: Record<string, any> = {};
      for (const s of weekScores) {
        scoreMap[s.student_id] = s;
      }

      for (const student of students) {
        const s = scoreMap[student.id];
        list.push({
          student_id: student.id,
          full_name: student.full_name,
          nisn: student.nisn,
          // Weekly: expose raw SAHABAT scores directly
          sss_score: s ? Number(s.sss_score) : null,
          am_score: s ? Number(s.am_score) : null,
          hb_score: s ? Number(s.hb_score) : null,
          asm_score: s ? Number(s.asm_score) : null,
          br_score: s ? Number(s.br_score) : null,
          ak_score: s ? Number(s.ak_score) : null,
          tm_score: s ? Number(s.tm_score) : null,
          observation_note: s?.observation_note ?? null,
          week_start_date: s?.week_start_date ?? weekStart,
          coverage: s ? 1 : 0,
        });
      }
    } else if (filters.month && filters.year) {
      // ── Monthly mode: character_monthly_summaries was dropped ───────────
      // No monthly aggregation table in new schema. Return empty/placeholder.
      for (const student of students) {
        list.push({
          student_id: student.id,
          full_name: student.full_name,
          nisn: student.nisn,
          u: null, t: null, s: null, m: null, a: null, n: null,
          coverage: 0,
          _note: 'Monthly aggregation tidak tersedia pada schema baru',
        });
      }
    } else {
      // ── Semester mode: query character_utsman_semester_summary ──────────
      // character_semester_summaries was dropped in migration 20260805220000
      const summaries = await db('character_utsman_semester_summary')
        .where({ semester_id: semesterId })
        .whereIn('student_id', studentIds);

      const summaryMap: Record<string, any> = {};
      for (const s of summaries) {
        summaryMap[s.student_id] = s;
      }

      // Count weeks with culture_scores for coverage
      // PERFORMANCE FIX (Sprint 7): Use a single batch GROUP BY query instead of
      // one countDistinct query per student (was O(N) — now O(1)).
      const semester = await db('semesters').where('id', semesterId).first();
      const coverageStartDate = semester?.start_date;
      const coverageEndDate = semester?.end_date;

      // Batch-fetch coverage counts for all students in one query
      const coverageMap: Record<string, number> = {};
      if (coverageStartDate && coverageEndDate && studentIds.length > 0) {
        const coverageRows = await db('culture_scores')
          .whereIn('student_id', studentIds)
          .where('semester_id', semesterId)
          .where('week_start_date', '>=', coverageStartDate)
          .where('week_start_date', '<=', coverageEndDate)
          .whereNot('lifecycle_status', 'soft_deleted')
          .groupBy('student_id')
          .select(
            'student_id',
            db.raw('COUNT(DISTINCT week_start_date) as coverage')
          );
        for (const row of coverageRows) {
          coverageMap[row.student_id] = Number(row.coverage);
        }
      }

      for (const student of students) {
        const summary = summaryMap[student.id];
        const coverage = coverageMap[student.id] ?? 0;

        list.push({
          student_id: student.id,
          full_name: student.full_name,
          nisn: student.nisn,
          u: summary && summary.u_score !== null ? Number(summary.u_score) : null,
          t: summary && summary.t_score !== null ? Number(summary.t_score) : null,
          s: summary && summary.s_score !== null ? Number(summary.s_score) : null,
          m: summary && summary.m_score !== null ? Number(summary.m_score) : null,
          a: summary && summary.a_score !== null ? Number(summary.a_score) : null,
          n: summary && summary.n_score !== null ? Number(summary.n_score) : null,
          calculation_version: summary?.calculation_version ?? null,
          coverage,
        });
      }
    }

    return list;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving class character summaries',
      'ERR_DATABASE',
      500
    );
  }
}


/**
 * Returns the character radar chart data for a semester using UTSMAN schema.
 * Maps UTSMAN dimensions (U,T,S,M,A,N) → legacy FITRAH labels to preserve
 * existing dashboard format without UI changes.
 *
 * @deprecated Function name kept for backwards compatibility. Now reads from
 * character_utsman_semester_summary instead of character_semester_summaries.
 *
 * @param semesterId - active semester ID
 */
export async function getFitrahRadarDataForSemester(
  semesterId: string
): Promise<Array<{ subject: string; A: number; fullMark: number }>> {
  const DEFAULT: Array<{ subject: string; A: number; fullMark: number }> = [
    { subject: 'Unggul (U)', A: 0, fullMark: 4 },
    { subject: 'Terampil (T)', A: 0, fullMark: 4 },
    { subject: 'Santun (S)', A: 0, fullMark: 4 },
    { subject: 'Mandiri (M)', A: 0, fullMark: 4 },
    { subject: 'Amanah (A)', A: 0, fullMark: 4 },
    { subject: 'Nasionalis (N)', A: 0, fullMark: 4 }
  ];

  if (!semesterId) return DEFAULT;

  try {
    const averages = await db('character_utsman_semester_summary')
      .where({ semester_id: semesterId })
      .select(
        db.raw('AVG(u_score) as u'),
        db.raw('AVG(t_score) as t'),
        db.raw('AVG(s_score) as s'),
        db.raw('AVG(m_score) as m'),
        db.raw('AVG(a_score) as a'),
        db.raw('AVG(n_score) as n')
      )
      .first();

    if (!averages || averages.u === null) return DEFAULT;

    return [
      { subject: 'Unggul (U)', A: parseFloat(Number(averages.u || 0).toFixed(2)), fullMark: 4 },
      { subject: 'Terampil (T)', A: parseFloat(Number(averages.t || 0).toFixed(2)), fullMark: 4 },
      { subject: 'Santun (S)', A: parseFloat(Number(averages.s || 0).toFixed(2)), fullMark: 4 },
      { subject: 'Mandiri (M)', A: parseFloat(Number(averages.m || 0).toFixed(2)), fullMark: 4 },
      { subject: 'Amanah (A)', A: parseFloat(Number(averages.a || 0).toFixed(2)), fullMark: 4 },
      { subject: 'Nasionalis (N)', A: parseFloat(Number(averages.n || 0).toFixed(2)), fullMark: 4 }
    ];
  } catch {
    return DEFAULT;
  }
}

/**
 * Returns the class with the highest average UTSMAN character score for a semester.
 * Queries character_utsman_semester_summary (replaces dropped character_semester_summaries).
 *
 * @deprecated Name kept for backwards compat. Now reads from character_utsman_semester_summary.
 *
 * @param semesterId - active semester ID
 * @param classes    - array of { id, name } for active classes
 */
export async function getBestCultureClassAverage(
  semesterId: string,
  classes: Array<{ id: string; name: string }>
): Promise<{ name: string; avg: number } | null> {
  if (!semesterId || !classes || classes.length === 0) return null;

  try {
    const classIds = classes.map(c => c.id);

    const rows = await db('character_utsman_semester_summary')
      .join(
        'student_enrollments',
        function (this: any) {
          this.on('character_utsman_semester_summary.student_id', '=', 'student_enrollments.student_id')
            .andOn('character_utsman_semester_summary.semester_id', '=', 'student_enrollments.semester_id');
        }
      )
      .where('student_enrollments.semester_id', semesterId)
      .where('student_enrollments.status', 'active')
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .whereIn('student_enrollments.class_id', classIds)
      .groupBy('student_enrollments.class_id')
      .select(
        'student_enrollments.class_id',
        db.raw('AVG((character_utsman_semester_summary.u_score + character_utsman_semester_summary.t_score + character_utsman_semester_summary.s_score + character_utsman_semester_summary.m_score + character_utsman_semester_summary.a_score + character_utsman_semester_summary.n_score) / 6.0) as culture_avg')
      )
      .orderBy('culture_avg', 'desc')
      .limit(1);

    if (!rows || rows.length === 0) return null;

    const top = rows[0] as { class_id: string; culture_avg: string | number };
    const avg = parseFloat(Number(top.culture_avg || 0).toFixed(2));
    if (avg === 0) return null;

    const cls = classes.find(c => c.id === top.class_id);
    return { name: cls?.name ?? 'N/A', avg };
  } catch {
    return null;
  }
}


