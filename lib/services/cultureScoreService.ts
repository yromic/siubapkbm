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

    // 2. Validate input boundaries and student enrollments before transaction
    for (const item of input.scores) {
      if (!item.student_id || !item.score_date) {
        throw new AppError('student_id and score_date are required for each score item.', 'ERR_VALIDATION', 400);
      }

      const scoreDate = new Date(item.score_date);
      if (isNaN(scoreDate.getTime())) {
        throw new AppError('Invalid date format.', 'ERR_VALIDATION', 400);
      }

      // Check fields range 0-4
      const scoreKeys = ['sss_score', 'am_score', 'hb_score', 'asm_score', 'br_score', 'ak_score', 'tm_score'];
      const scoreValues: Record<string, number> = {};

      for (const k of scoreKeys) {
        const val = (item as any)[k];
        if (val !== undefined) {
          const num = Number(val);
          if (isNaN(num) || num < 0 || num > 4) {
            throw new AppError(`Indicator score "${k}" must be a number between 0 and 4. Received: ${val}`, 'ERR_VALIDATION', 400);
          }
          scoreValues[k] = num;
        } else {
          scoreValues[k] = 0; // Default to 0 if not provided
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
    await db.transaction(async (trx) => {
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
