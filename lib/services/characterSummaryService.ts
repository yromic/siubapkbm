import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { Decimal } from 'decimal.js';

export async function calculateAndGetSemesterSummary(
  studentId: string,
  academicYearId: string,
  semesterId: string,
  refresh = false
) {
  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError('Student ID, Academic Year ID, and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // 1. If not refresh, check if summary already exists in character_semester_summaries
    if (!refresh) {
      const existingSummary = await db('character_semester_summaries')
        .where({
          student_id: studentId,
          academic_year_id: academicYearId,
          semester_id: semesterId
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (existingSummary) {
        return existingSummary;
      }
    }

    // 2. Get active student enrollment
    const enrollment = await db('student_enrollments')
      .where({
        student_id: studentId,
        semester_id: semesterId,
        status: 'active'
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!enrollment) {
      throw new AppError('Student has no active enrollment in this semester.', 'ERR_NO_ACTIVE_ENROLLMENT', 400);
    }

    // 3. Fetch all culture scores for student in this semester
    const scores = await db('culture_scores')
      .where({
        student_id: studentId,
        semester_id: semesterId
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('score_date', 'asc');

    // 4. Calculate Semester Summary
    const semesterStats = calculateSummaryFromScores(scores);

    await db.transaction(async (trx) => {
      // Upsert Semester Summary
      await trx('character_semester_summaries')
        .insert({
          id: uuidv4(),
          student_id: studentId,
          student_enrollment_id: enrollment.id,
          academic_year_id: academicYearId,
          semester_id: semesterId,
          ...semesterStats,
          lifecycle_status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict(['student_id', 'semester_id'])
        .merge({
          student_enrollment_id: enrollment.id,
          academic_year_id: academicYearId,
          ...semesterStats,
          lifecycle_status: 'active',
          updated_at: new Date()
        });

      // 5. Calculate & Upsert Weekly summaries
      const weeklyGroups = groupScoresByWeek(scores);
      for (const group of weeklyGroups) {
        const weeklyStats = calculateSummaryFromScores(group.scores);
        await trx('character_weekly_summaries')
          .insert({
            id: uuidv4(),
            student_id: studentId,
            student_enrollment_id: enrollment.id,
            academic_year_id: academicYearId,
            semester_id: semesterId,
            week_start_date: group.week_start_date,
            week_end_date: group.week_end_date,
            ...weeklyStats,
            lifecycle_status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          })
          .onConflict(['student_id', 'week_start_date'])
          .merge({
            student_enrollment_id: enrollment.id,
            academic_year_id: academicYearId,
            semester_id: semesterId,
            week_end_date: group.week_end_date,
            ...weeklyStats,
            lifecycle_status: 'active',
            updated_at: new Date()
          });
      }

      // 6. Calculate & Upsert Monthly summaries
      const monthlyGroups = groupScoresByMonth(scores);
      for (const group of monthlyGroups) {
        const monthlyStats = calculateSummaryFromScores(group.scores);
        await trx('character_monthly_summaries')
          .insert({
            id: uuidv4(),
            student_id: studentId,
            student_enrollment_id: enrollment.id,
            academic_year_id: academicYearId,
            semester_id: semesterId,
            summary_month: group.summary_month,
            summary_year: group.summary_year,
            ...monthlyStats,
            lifecycle_status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          })
          .onConflict(['student_id', 'summary_year', 'summary_month'])
          .merge({
            student_enrollment_id: enrollment.id,
            academic_year_id: academicYearId,
            semester_id: semesterId,
            ...monthlyStats,
            lifecycle_status: 'active',
            updated_at: new Date()
          });
      }
    });

    // Return the updated summary
    const finalSummary = await db('character_semester_summaries')
      .where({
        student_id: studentId,
        academic_year_id: academicYearId,
        semester_id: semesterId
      })
      .first();

    return finalSummary;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error calculating summaries',
      'ERR_DATABASE',
      500
    );
  }
}

export function calculateSummaryFromScores(scores: any[]) {
  let sss_sum = new Decimal(0);
  let sss_count = 0;
  let am_sum = new Decimal(0);
  let am_count = 0;
  let hb_sum = new Decimal(0);
  let hb_count = 0;
  let asm_sum = new Decimal(0);
  let asm_count = 0;
  let br_sum = new Decimal(0);
  let br_count = 0;
  let ak_sum = new Decimal(0);
  let ak_count = 0;
  let tm_sum = new Decimal(0);
  let tm_count = 0;

  const uniqueDates = new Set<string>();

  for (const s of scores) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(s.score_date);
    uniqueDates.add(dateStr);

    if (s.sss_score !== null && s.sss_score !== undefined) {
      const val = Number(s.sss_score);
      if (val > 0) {
        sss_sum = sss_sum.plus(new Decimal(val));
        sss_count++;
      }
    }
    if (s.am_score !== null && s.am_score !== undefined) {
      const val = Number(s.am_score);
      if (val > 0) {
        am_sum = am_sum.plus(new Decimal(val));
        am_count++;
      }
    }
    if (s.hb_score !== null && s.hb_score !== undefined) {
      const val = Number(s.hb_score);
      if (val > 0) {
        hb_sum = hb_sum.plus(new Decimal(val));
        hb_count++;
      }
    }
    if (s.asm_score !== null && s.asm_score !== undefined) {
      const val = Number(s.asm_score);
      if (val > 0) {
        asm_sum = asm_sum.plus(new Decimal(val));
        asm_count++;
      }
    }
    if (s.br_score !== null && s.br_score !== undefined) {
      const val = Number(s.br_score);
      if (val > 0) {
        br_sum = br_sum.plus(new Decimal(val));
        br_count++;
      }
    }
    if (s.ak_score !== null && s.ak_score !== undefined) {
      const val = Number(s.ak_score);
      if (val > 0) {
        ak_sum = ak_sum.plus(new Decimal(val));
        ak_count++;
      }
    }
    if (s.tm_score !== null && s.tm_score !== undefined) {
      const val = Number(s.tm_score);
      if (val > 0) {
        tm_sum = tm_sum.plus(new Decimal(val));
        tm_count++;
      }
    }
  }

  const days_counted = uniqueDates.size;

  const f_score = asm_count > 0 ? asm_sum.dividedBy(asm_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;
  const i_score = am_count > 0 ? am_sum.dividedBy(am_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;
  const t_score = br_count > 0 ? br_sum.dividedBy(br_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;

  const avg_sss = sss_count > 0 ? sss_sum.dividedBy(sss_count) : null;
  const avg_hb = hb_count > 0 ? hb_sum.dividedBy(hb_count) : null;

  let r_score = 0;
  if (avg_sss !== null && avg_hb !== null) {
    r_score = avg_sss.plus(avg_hb).dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } else if (avg_sss !== null) {
    r_score = avg_sss.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } else if (avg_hb !== null) {
    r_score = avg_hb.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  const a_score = ak_count > 0 ? ak_sum.dividedBy(ak_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;
  const h_score = tm_count > 0 ? tm_sum.dividedBy(tm_count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : 0;

  return {
    f_score,
    i_score,
    t_score,
    r_score,
    a_score,
    h_score,
    sss_sum: sss_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    sss_count,
    am_sum: am_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    am_count,
    hb_sum: hb_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    hb_count,
    asm_sum: asm_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    asm_count,
    br_sum: br_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    br_count,
    ak_sum: ak_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    ak_count,
    tm_sum: tm_sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    tm_count,
    days_counted
  };
}

export function groupScoresByWeek(scores: any[]) {
  const groups: Record<string, { week_start_date: Date; week_end_date: Date; scores: any[] }> = {};

  for (const s of scores) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(s.score_date);

    const [y, m, d] = dateStr.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    
    // Get Monday of that week
    const monday = new Date(localDate);
    monday.setDate(localDate.getDate() - (localDate.getDay() === 0 ? 6 : localDate.getDay() - 1));
    monday.setHours(0, 0, 0, 0);

    // Get Sunday of that week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const key = monday.toISOString().split('T')[0];
    if (!groups[key]) {
      groups[key] = {
        week_start_date: monday,
        week_end_date: sunday,
        scores: []
      };
    }
    groups[key].scores.push(s);
  }

  return Object.values(groups);
}

export function groupScoresByMonth(scores: any[]) {
  const groups: Record<string, { summary_month: number; summary_year: number; scores: any[] }> = {};

  for (const s of scores) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(s.score_date);

    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(5, 7), 10);
    const key = `${year}-${month}`;

    if (!groups[key]) {
      groups[key] = {
        summary_month: month,
        summary_year: year,
        scores: []
      };
    }
    groups[key].scores.push(s);
  }

  return Object.values(groups);
}

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

    const studentIds = enrollments.map((e) => e.student_id);
    if (studentIds.length === 0) {
      return [];
    }

    // 2. Fetch the student details
    const students = await db('students')
      .whereIn('id', studentIds)
      .whereNot('status', 'soft_deleted')
      .orderBy('full_name', 'asc');

    // 3. Fetch semester details for coverage calculations
    const semester = await db('semesters')
      .where('id', semesterId)
      .first();

    if (!semester) {
      throw new AppError('Semester not found.', 'ERR_VALIDATION', 404);
    }

    let coverageStartDate = semester.start_date;
    let coverageEndDate = semester.end_date;

    // 4. Fetch the summaries based on selected period mode (Weekly, Monthly, or Semester)
    let summaries: any[] = [];
    if (filters.week_start_date) {
      summaries = await db('character_weekly_summaries')
        .where('week_start_date', filters.week_start_date)
        .whereIn('student_id', studentIds)
        .whereNot('lifecycle_status', 'soft_deleted');

      const weekStart = new Date(filters.week_start_date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      coverageStartDate = weekStart;
      coverageEndDate = weekEnd;
    } else if (filters.month && filters.year) {
      summaries = await db('character_monthly_summaries')
        .where({
          summary_month: filters.month,
          summary_year: filters.year
        })
        .whereIn('student_id', studentIds)
        .whereNot('lifecycle_status', 'soft_deleted');

      coverageStartDate = new Date(filters.year, filters.month - 1, 1);
      coverageEndDate = new Date(filters.year, filters.month, 0);
    } else {
      summaries = await db('character_semester_summaries')
        .where({
          academic_year_id: academicYearId,
          semester_id: semesterId
        })
        .whereIn('student_id', studentIds)
        .whereNot('lifecycle_status', 'soft_deleted');
    }

    const summaryMap: Record<string, any> = {};
    for (const s of summaries) {
      summaryMap[s.student_id] = s;
    }

    const list = [];
    for (const student of students) {
      const summary = summaryMap[student.id];

      // Fetch count of unique dates with scores for this student in the date range
      const scoreDatesResult = await db('culture_scores')
        .where('student_id', student.id)
        .where('semester_id', semesterId)
        .where('score_date', '>=', coverageStartDate)
        .where('score_date', '<=', coverageEndDate)
        .whereNot('lifecycle_status', 'soft_deleted')
        .countDistinct('score_date as count')
        .first();

      const days_with_scores = Number(scoreDatesResult?.count || 0);

      list.push({
        student_id: student.id,
        full_name: student.full_name,
        nisn: student.nisn,
        f: summary && summary.f_score !== null ? Number(summary.f_score) : null,
        i: summary && summary.i_score !== null ? Number(summary.i_score) : null,
        t: summary && summary.t_score !== null ? Number(summary.t_score) : null,
        r: summary && summary.r_score !== null ? Number(summary.r_score) : null,
        a: summary && summary.a_score !== null ? Number(summary.a_score) : null,
        h: summary && summary.h_score !== null ? Number(summary.h_score) : null,
        days_counted: summary ? Number(summary.days_counted) || 0 : 0,
        coverage: days_with_scores
      });
    }

    return list;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving class character summaries',
      'ERR_DATABASE',
      500
    );
  }
}
