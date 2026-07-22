import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { Decimal } from 'decimal.js';

export async function getAcademicCompleteness(classId: string, academicYearId: string, semesterId: string): Promise<number> {
  try {
    const activeStudents = await db('student_enrollments')
      .where({ class_id: classId, academic_year_id: academicYearId, semester_id: semesterId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('student_id');

    const studentIds = activeStudents.map((s: any) => s.student_id);
    if (studentIds.length === 0) return 100;

    const assessments = await db('academic_assessments')
      .where({ class_id: classId, academic_year_id: academicYearId, semester_id: semesterId })
      .whereIn('status', ['published', 'locked'])
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('id');

    const assessmentIds = assessments.map((a: any) => a.id);
    if (assessmentIds.length === 0) return 100;

    const expectedCount = studentIds.length * assessmentIds.length;

    const actualCountRes = await db('academic_scores')
      .whereIn('assessment_id', assessmentIds)
      .whereIn('student_id', studentIds)
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const actualCount = Number(actualCountRes?.count || 0);

    const percentage = new Decimal(actualCount).dividedBy(expectedCount).times(100);
    return percentage.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } catch (error) {
    return 0;
  }
}

export async function getCultureCompleteness(classId: string, academicYearId: string, semesterId: string): Promise<number> {
  try {
    const activeStudents = await db('student_enrollments')
      .where({ class_id: classId, academic_year_id: academicYearId, semester_id: semesterId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('student_id');

    const studentIds = activeStudents.map((s: any) => s.student_id);
    if (studentIds.length === 0) return 100;

    // Get unique dates for this class-semester in culture_scores
    const datesRes = await db('culture_scores')
      .where({ class_id: classId, semester_id: semesterId })
      .whereNot('lifecycle_status', 'soft_deleted')
      .distinct('score_date');

    const totalDays = datesRes.length;
    if (totalDays === 0) return 0;

    const expectedCount = studentIds.length * totalDays;

    const actualCountRes = await db('culture_scores')
      .where({ class_id: classId, semester_id: semesterId })
      .whereIn('student_id', studentIds)
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const actualCount = Number(actualCountRes?.count || 0);

    const percentage = new Decimal(actualCount).dividedBy(expectedCount).times(100);
    return percentage.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  } catch (error) {
    return 0;
  }
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 0, 0, 0, 0);
  }
  const str = String(dateStr).split('T')[0];
  const parts = str.split('-');
  if (parts.length !== 3) return new Date();
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
}

function resolveCulturePeriod(
  periodMode: string,
  semester: { start_date: string | Date; end_date: string | Date } | null,
  todayOverride?: string
) {
  const now = todayOverride ? parseLocalDate(todayOverride) : new Date();
  now.setHours(0, 0, 0, 0);

  const mode = ['week', 'month', 'semester'].includes(periodMode) ? periodMode : 'semester';

  let start: Date;
  let end: Date = new Date(now.getTime());

  if (mode === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start = new Date(now);
    start.setDate(now.getDate() + diff);
  } else if (mode === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = semester?.start_date ? parseLocalDate(semester.start_date) : new Date(now.getFullYear(), 0, 1);
    end = semester?.end_date ? parseLocalDate(semester.end_date) : new Date(now.getFullYear(), 11, 31);
  }

  if (semester?.start_date) {
    const semStart = parseLocalDate(semester.start_date);
    if (start < semStart) start = semStart;
  }
  if (semester?.end_date) {
    const semEnd = parseLocalDate(semester.end_date);
    if (end > semEnd) end = semEnd;
  }

  if (end > now) end = now;

  return {
    mode: mode as 'week' | 'month' | 'semester',
    start_date: formatDateString(start),
    end_date: formatDateString(end)
  };
}

function getExpectedCultureDates(start_date: string, end_date: string, todayOverride?: string) {
  const start = parseLocalDate(start_date);
  let end = parseLocalDate(end_date);
  const now = todayOverride ? parseLocalDate(todayOverride) : new Date();
  now.setHours(0, 0, 0, 0);

  if (end > now) end = now;
  if (end < start) return { expected_dates: [], expected_days: 0 };

  const schoolDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const dates: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const dayName = dayNames[cursor.getDay()];
    if (schoolDays.includes(dayName)) {
      dates.push(formatDateString(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    expected_dates: dates,
    expected_days: dates.length
  };
}

export async function getTeacherCompleteness(
  academicYearId: string,
  semesterId: string,
  classId?: string,
  periodMode: 'week' | 'month' | 'semester' = 'semester'
) {
  if (!academicYearId || !semesterId) {
    throw new AppError('academic_year_id and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const semester = await db('semesters')
      .where('id', semesterId)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    const period = resolveCulturePeriod(periodMode, semester);
    const expected = getExpectedCultureDates(period.start_date, period.end_date);

    let enrollmentsQuery = db('student_enrollments')
      .join('students', 'students.id', 'student_enrollments.student_id')
      .where({
        'student_enrollments.academic_year_id': academicYearId,
        'student_enrollments.semester_id': semesterId,
        'student_enrollments.status': 'active'
      })
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .whereNot('students.status', 'soft_deleted');

    if (classId) {
      enrollmentsQuery = enrollmentsQuery.where('student_enrollments.class_id', classId);
    }

    const enrollments = await enrollmentsQuery.select(
      'students.id as student_id',
      'students.full_name'
    );

    if (!enrollments || enrollments.length === 0) {
      return {
        period,
        expected_days: expected.expected_days,
        class_summary: {
          total_students: 0,
          complete_students: 0,
          partial_students: 0,
          low_students: 0,
          empty_students: 0,
          average_coverage_percent: 0
        },
        missing_dates: [],
        students: []
      };
    }

    const studentIds = enrollments.map((e: any) => e.student_id);

    let scoresQuery = db('culture_scores')
      .where({
        academic_year_id: academicYearId,
        semester_id: semesterId
      })
      .whereIn('student_id', studentIds)
      .whereNot('lifecycle_status', 'soft_deleted');

    if (classId) {
      scoresQuery = scoresQuery.where('class_id', classId);
    }

    const cultureScores = await scoresQuery.select('student_id', 'score_date');

    const expectedDatesMap = new Set(expected.expected_dates);
    const studentCompletedDatesMap: Record<string, Set<string>> = {};

    for (const score of cultureScores) {
      const sId = score.student_id;
      const dateStr = formatDateString(parseLocalDate(score.score_date));
      if (expectedDatesMap.has(dateStr)) {
        if (!studentCompletedDatesMap[sId]) {
          studentCompletedDatesMap[sId] = new Set();
        }
        studentCompletedDatesMap[sId].add(dateStr);
      }
    }

    const minimumCoveragePercent = 80;
    const warningCoveragePercent = 60;

    const studentResults = enrollments.map((e: any) => {
      const studentName = e.full_name || 'Siswa';
      const completedSet = studentCompletedDatesMap[e.student_id] || new Set<string>();
      const daysCounted = completedSet.size;
      const expectedDays = expected.expected_days;
      const missingDays = Math.max(0, expectedDays - daysCounted);
      const coveragePercent = expectedDays > 0 ? Number(((daysCounted / expectedDays) * 100).toFixed(2)) : 0;

      let completenessStatus: 'complete' | 'partial' | 'low' | 'empty' = 'empty';
      if (daysCounted > 0 && coveragePercent >= minimumCoveragePercent) {
        completenessStatus = 'complete';
      } else if (daysCounted > 0 && coveragePercent >= warningCoveragePercent) {
        completenessStatus = 'partial';
      } else if (daysCounted > 0) {
        completenessStatus = 'low';
      }

      const missingDates = expected.expected_dates
        .filter(d => !completedSet.has(d))
        .map(d => ({ date: d, reason: 'no_culture_score' }));

      return {
        student_id: e.student_id,
        student_name: studentName,
        days_counted: daysCounted,
        expected_days: expectedDays,
        missing_days: missingDays,
        coverage_percent: coveragePercent,
        completeness_status: completenessStatus,
        missing_dates: missingDates
      };
    });

    const counts: Record<'complete' | 'partial' | 'low' | 'empty', number> = { complete: 0, partial: 0, low: 0, empty: 0 };
    let coverageSum = 0;

    for (const s of studentResults) {
      const statusKey = s.completeness_status as 'complete' | 'partial' | 'low' | 'empty';
      counts[statusKey]++;
      coverageSum += s.coverage_percent;
    }

    const totalStudents = studentResults.length;
    const averageCoveragePercent = totalStudents > 0 ? Number((coverageSum / totalStudents).toFixed(2)) : 0;

    const missingDatesAggregate = expected.expected_dates
      .map(date => {
        const completedStudents = studentResults.filter((s: any) => !s.missing_dates.some((m: any) => m.date === date)).length;
        const missingStudents = totalStudents - completedStudents;
        const completionPercent = totalStudents > 0 ? Number(((completedStudents / totalStudents) * 100).toFixed(2)) : 0;

        return {
          date,
          expected_students: totalStudents,
          completed_students: completedStudents,
          missing_students: missingStudents,
          completion_percent: completionPercent
        };
      })
      .filter(d => d.missing_students > 0);

    return {
      period,
      expected_days: expected.expected_days,
      class_summary: {
        total_students: totalStudents,
        complete_students: counts.complete,
        partial_students: counts.partial,
        low_students: counts.low,
        empty_students: counts.empty,
        average_coverage_percent: averageCoveragePercent
      },
      missing_dates: missingDatesAggregate,
      students: studentResults
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting teacher completeness stats',
      'ERR_DATABASE',
      500
    );
  }
}

