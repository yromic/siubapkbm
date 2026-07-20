import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { Decimal } from 'decimal.js';

export async function getAcademicCompleteness(classId: string, academicYearId: string, semesterId: string): Promise<number> {
  try {
    const activeStudents = await db('student_enrollments')
      .where({ class_id: classId, academic_year_id: academicYearId, semester_id: semesterId, status: 'active' })
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('student_id');

    const studentIds = activeStudents.map(s => s.student_id);
    if (studentIds.length === 0) return 100;

    const assessments = await db('academic_assessments')
      .where({ class_id: classId, academic_year_id: academicYearId, semester_id: semesterId })
      .whereIn('status', ['published', 'locked'])
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('id');

    const assessmentIds = assessments.map(a => a.id);
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

    const studentIds = activeStudents.map(s => s.student_id);
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

export async function getTeacherCompleteness(academicYearId: string, semesterId: string) {
  if (!academicYearId || !semesterId) {
    throw new AppError('academic_year_id and semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const items = await db('users')
      .leftJoin('culture_scores', function() {
        this.on('users.id', '=', 'culture_scores.teacher_user_id')
          .andOn('culture_scores.academic_year_id', '=', db.raw('?', [academicYearId]))
          .andOn('culture_scores.semester_id', '=', db.raw('?', [semesterId]));
      })
      .where('users.role', 'teacher')
      .whereNot('users.lifecycle_status', 'soft_deleted')
      .select('users.id as teacher_id', 'users.name as teacher_name')
      .count('culture_scores.id as total_inputs')
      .groupBy('users.id', 'users.name')
      .orderBy('total_inputs', 'desc');

    return items;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting teacher completeness stats',
      'ERR_DATABASE',
      500
    );
  }
}
