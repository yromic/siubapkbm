import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { calculateAndGetSemesterSummary } from './characterSummaryService';

export interface CultureScoreItem {
  student_id: string;
  score_date: string | Date;
  sss_score?: number;
  am_score?: number;
  hb_score?: number;
  asm_score?: number;
  br_score?: number;
  ak_score?: number;
  tm_score?: number;
}

export interface SaveCultureScoresInput {
  class_id: string;
  academic_year_id: string;
  semester_id: string;
  scores: CultureScoreItem[];
}

export async function saveCultureScores(input: SaveCultureScoresInput, actorId: string) {
  if (!input.class_id || !input.academic_year_id || !input.semester_id || !input.scores || !Array.isArray(input.scores)) {
    throw new AppError('Missing required fields.', 'ERR_VALIDATION', 400);
  }

  try {
    // 1. Ownership check: Allow administrators to bypass, check assignment for teachers
    const actor = await db('users').where('id', actorId).first();
    if (!actor) {
      throw new AppError('Actor user not found.', 'ERR_UNAUTHORIZED', 401);
    }

    const normRole = String(actor.role).toLowerCase().trim();

    if (actor.role !== 'administrator') {
      const assignment = await db('class_teacher_assignments')
        .where({
          teacher_user_id: actorId,
          class_id: input.class_id,
          academic_year_id: input.academic_year_id,
          semester_id: input.semester_id,
          status: 'active'
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (!assignment) {
        throw new AppError(
          'Teacher is not assigned to this class for the specified period.',
          'ERR_TEACHER_NOT_ASSIGNED_TO_CLASS',
          403
        );
      }
    }

    const processedScores: any[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 2. Validate input boundaries and student enrollments before transaction
    for (const item of input.scores) {
      const dateVal = item.score_date || (input as any).score_date;
      if (!item.student_id || !dateVal) {
        throw new AppError('student_id and score_date are required.', 'ERR_VALIDATION', 400);
      }

      const scoreDate = new Date(dateVal);
      if (isNaN(scoreDate.getTime())) {
        throw new AppError('Invalid date format.', 'ERR_VALIDATION', 400);
      }

      // Lock period verification
      if (normRole !== 'administrator') {
        const diffTime = now.getTime() - scoreDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (normRole === 'teacher' || normRole === 'guru') {
          if (diffDays > 7) {
            throw new AppError('Error: The period for editing culture scores on this date is locked.', 'ERR_PERIOD_LOCKED', 400);
          }
        } else if (normRole === 'admin') {
          if (diffDays > 30) {
            throw new AppError('Error: The period for editing culture scores on this date is locked.', 'ERR_PERIOD_LOCKED', 400);
          }
        } else {
          throw new AppError('Error: Unknown role or locked period.', 'ERR_PERIOD_LOCKED', 400);
        }
      }

      // Explicit mapping and validation (integers 1-4, empty/null to 0)
      const scoreKeys = [
        { key: 'sss', dbKey: 'sss_score' },
        { key: 'am', dbKey: 'am_score' },
        { key: 'hb', dbKey: 'hb_score' },
        { key: 'asm', dbKey: 'asm_score' },
        { key: 'br', dbKey: 'br_score' },
        { key: 'ak', dbKey: 'ak_score' },
        { key: 'tm', dbKey: 'tm_score' }
      ];
      const scoreValues: Record<string, number> = {};

      for (const mapping of scoreKeys) {
        const val = (item as any)[mapping.key] !== undefined ? (item as any)[mapping.key] : (item as any)[mapping.dbKey];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (isNaN(num) || num < 1 || num > 4 || Math.floor(num) !== num) {
            throw new AppError(`Indicator score "${mapping.key}" must be an integer between 1 and 4. Received: ${val}`, 'ERR_VALIDATION', 400);
          }
          scoreValues[mapping.dbKey] = num;
        } else {
          scoreValues[mapping.dbKey] = 0; // Default to 0 for database
        }
      }

      // Verify active enrollment in this class and semester
      const enrollment = await db('student_enrollments')
        .where({
          student_id: item.student_id,
          class_id: input.class_id,
          semester_id: input.semester_id,
          status: 'active'
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (!enrollment) {
        throw new AppError(
          `Student with ID ${item.student_id} is not actively enrolled in this class and semester.`,
          'ERR_VALIDATION',
          400
        );
      }

      processedScores.push({
        student_id: item.student_id,
        enrollment_id: enrollment.id,
        score_date: scoreDate,
        ...scoreValues
      });
    }

    // 3. Perform insert/update within database transaction
    const results: any[] = [];
    await db.transaction(async (trx: any) => {
      for (const item of processedScores) {
        // Unique combination check (student_id, score_date, semester_id)
        const dateString = item.score_date.toISOString().split('T')[0];
        const existing = await trx('culture_scores')
          .where({
            student_id: item.student_id,
            semester_id: input.semester_id
          })
          .whereRaw('DATE(score_date) = ?', [dateString])
          .whereNot('lifecycle_status', 'soft_deleted')
          .first();

        const dataToSave = {
          sss_score: item.sss_score,
          am_score: item.am_score,
          hb_score: item.hb_score,
          asm_score: item.asm_score,
          br_score: item.br_score,
          ak_score: item.ak_score,
          tm_score: item.tm_score,
          updated_at: new Date()
        };

        if (existing) {
          await trx('culture_scores')
            .where('id', existing.id)
            .update(dataToSave);
          results.push({ ...existing, ...dataToSave });
        } else {
          const id = uuidv4();
          const newScore = {
            id,
            student_id: item.student_id,
            student_enrollment_id: item.enrollment_id,
            class_id: input.class_id,
            teacher_user_id: actorId,
            academic_year_id: input.academic_year_id,
            semester_id: input.semester_id,
            score_date: item.score_date,
            ...dataToSave,
            status: 'active',
            lifecycle_status: 'active',
            created_at: new Date()
          };
          await trx('culture_scores').insert(newScore);
          results.push(newScore);
        }
      }
    });

    const studentIds = Array.from(new Set(processedScores.map((item) => item.student_id)));
    for (const studentId of studentIds) {
      try {
        await calculateAndGetSemesterSummary(studentId, input.academic_year_id, input.semester_id, true);
      } catch (error) {
        console.error(`Failed to calculate summaries for student ${studentId}:`, error);
      }
    }

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error saving culture scores',
      'ERR_DATABASE',
      500
    );
  }
}

export async function listCultureScoresByDate(date: string, classId: string) {
  if (!date || !classId) {
    throw new AppError('Date (YYYY-MM-DD) and Class ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const items = await db('culture_scores')
      .join('students', 'culture_scores.student_id', 'students.id')
      .where('culture_scores.class_id', classId)
      .whereRaw('DATE(culture_scores.score_date) = ?', [date])
      .whereNot('culture_scores.lifecycle_status', 'soft_deleted')
      .select(
        'culture_scores.*',
        'students.full_name as student_name',
        'students.nisn as student_nisn'
      )
      .orderBy('students.full_name', 'asc');

    return items;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing culture scores by date',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getStudentCultureScores(studentId: string, academicYearId: string, semesterId: string) {
  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError('Student ID, Academic Year ID, and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const items = await db('culture_scores')
      .where({
        student_id: studentId,
        academic_year_id: academicYearId,
        semester_id: semesterId
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('score_date', 'asc');

    return items;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting student culture scores',
      'ERR_DATABASE',
      500
    );
  }
}

/**
 * Returns students with active enrollment in the given semester who have no culture scores
 * recorded for that semester.
 *
 * Temporal scoping: the LEFT JOIN is constrained to culture_scores.semester_id,
 * eliminating the cross-semester leakage where a student with past-semester scores
 * would not appear in this semester's watchlist.
 *
 * @param semesterId - active semester ID
 * @param limit      - max rows to return (default 50)
 */
export async function getStudentsWithoutCultureScores(
  semesterId: string,
  limit = 50
): Promise<Array<{ id: string; full_name: string; nisn: string; reason: string }>> {
  if (!semesterId) return [];

  const rows = await db('student_enrollments')
    .join('students', 'student_enrollments.student_id', 'students.id')
    .leftJoin(
      db('culture_scores')
        .where('semester_id', semesterId)
        .whereNot('lifecycle_status', 'soft_deleted')
        .select('student_id')
        .as('scored_students'),
      'students.id',
      'scored_students.student_id'
    )
    .where('student_enrollments.semester_id', semesterId)
    .where('student_enrollments.status', 'active')
    .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
    .whereNull('scored_students.student_id')
    .select(
      'students.id',
      'students.full_name',
      'students.nisn',
      db.raw("'no_culture_scores' as reason")
    )
    .groupBy('students.id', 'students.full_name', 'students.nisn')
    .limit(limit);

  return rows as Array<{ id: string; full_name: string; nisn: string; reason: string }>;
}
