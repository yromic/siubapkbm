import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { getAssessmentById, assertNotLocked } from './assessmentService';
import { Decimal } from 'decimal.js';

export interface ScoreInput {
  student_id: string;
  score: number;
  note?: string;
}

export async function listScoresByAssessment(assessmentId: string) {
  if (!assessmentId) {
    throw new AppError('Assessment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const items = await db('academic_scores')
      .join('students', 'academic_scores.student_id', 'students.id')
      .where('academic_scores.assessment_id', assessmentId)
      .whereNot('academic_scores.lifecycle_status', 'soft_deleted')
      .select(
        'academic_scores.*',
        'students.full_name as student_name',
        'students.nisn as student_nisn'
      )
      .orderBy('students.full_name', 'asc');

    return items;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing scores',
      'ERR_DATABASE',
      500
    );
  }
}

export async function saveScores(assessmentId: string, scores: ScoreInput[], actorId: string) {
  if (!assessmentId || !scores || !Array.isArray(scores)) {
    throw new AppError('Assessment ID and scores array are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // 1. Check lock status
    await assertNotLocked(assessmentId);
    const assessment = await getAssessmentById(assessmentId);

    const processedScores: any[] = [];

    // 2. Validate all student enrollments and scores bounds before starting transaction
    for (const item of scores) {
      if (!item.student_id || item.score === undefined) {
        throw new AppError('Missing student_id or score in input array.', 'ERR_VALIDATION', 400);
      }

      const scoreNum = Number(item.score);
      if (isNaN(scoreNum)) {
        throw new AppError('Score must be a valid number.', 'ERR_VALIDATION', 400);
      }

      if (scoreNum < assessment.score_min || scoreNum > assessment.score_max) {
        throw new AppError(
          `Score ${scoreNum} is out of bounds for assessment limits [${assessment.score_min} - ${assessment.score_max}].`,
          'ERR_VALIDATION',
          400
        );
      }

      // Check active enrollment in same semester
      const enrollment = await db('student_enrollments')
        .where({
          student_id: item.student_id,
          semester_id: assessment.semester_id,
          status: 'active'
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (!enrollment) {
        throw new AppError(
          `Student with ID ${item.student_id} does not have an active enrollment for this semester.`,
          'ERR_NO_ACTIVE_ENROLLMENT',
          400
        );
      }

      processedScores.push({
        student_id: item.student_id,
        enrollment_id: enrollment.id,
        score: scoreNum,
        note: item.note || null
      });
    }

    // 3. Save scores using db transaction
    const results: any[] = [];
    await db.transaction(async (trx) => {
      for (const item of processedScores) {
        const existing = await trx('academic_scores')
          .where({
            assessment_id: assessmentId,
            student_id: item.student_id
          })
          .whereNot('lifecycle_status', 'soft_deleted')
          .first();

        if (existing) {
          await trx('academic_scores')
            .where('id', existing.id)
            .update({
              score: item.score,
              note: item.note,
              updated_at: new Date()
            });
          results.push({ ...existing, score: item.score, note: item.note, updated_at: new Date() });
        } else {
          const id = uuidv4();
          const newScore = {
            id,
            assessment_id: assessmentId,
            student_id: item.student_id,
            student_enrollment_id: item.enrollment_id,
            score: item.score,
            note: item.note,
            status: 'active',
            lifecycle_status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          };
          await trx('academic_scores').insert(newScore);
          results.push(newScore);
        }
      }
    });

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error saving academic scores',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateScore(id: string, score: number, note?: string) {
  if (!id || score === undefined) {
    throw new AppError('Score ID and score value are required.', 'ERR_VALIDATION', 400);
  }

  const scoreNum = Number(score);
  if (isNaN(scoreNum)) {
    throw new AppError('Score must be a valid number.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('academic_scores')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!existing) {
      throw new AppError(`Academic Score with ID ${id} not found.`, 'ERR_VALIDATION', 404);
    }

    const assessment = await getAssessmentById(existing.assessment_id);
    if (assessment.status === 'locked') {
      throw new AppError('Cannot update score. The assessment is locked.', 'ERR_VALIDATION', 400);
    }

    if (scoreNum < assessment.score_min || scoreNum > assessment.score_max) {
      throw new AppError(
        `Score ${scoreNum} is out of bounds for assessment limits [${assessment.score_min} - ${assessment.score_max}].`,
        'ERR_VALIDATION',
        400
      );
    }

    const patch: any = { score: scoreNum, updated_at: new Date() };
    if (note !== undefined) patch.note = note || null;

    await db('academic_scores').where('id', id).update(patch);
    
    return { ...existing, ...patch };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating academic score',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getStudentAcademicSummary(studentId: string, academicYearId: string, semesterId: string) {
  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError('Student ID, Academic Year ID, and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // Check if student exists
    const student = await db('students').where('id', studentId).whereNot('status', 'soft_deleted').first();
    if (!student) throw new AppError('Student not found.', 'ERR_VALIDATION', 404);

    const scores = await db('academic_scores')
      .join('academic_assessments', 'academic_scores.assessment_id', 'academic_assessments.id')
      .join('subjects', 'academic_assessments.subject_id', 'subjects.id')
      .where('academic_scores.student_id', studentId)
      .where('academic_assessments.academic_year_id', academicYearId)
      .where('academic_assessments.semester_id', semesterId)
      .whereNot('academic_scores.lifecycle_status', 'soft_deleted')
      .whereNot('academic_assessments.lifecycle_status', 'soft_deleted')
      .select(
        'academic_scores.score',
        'academic_scores.note',
        'academic_assessments.id as assessment_id',
        'academic_assessments.title as assessment_title',
        'academic_assessments.score_min',
        'academic_assessments.score_max',
        'subjects.id as subject_id',
        'subjects.name as subject_name',
        'subjects.code as subject_code'
      );

    // Group by subject
    const subjectMap: Record<string, any> = {};

    for (const s of scores) {
      if (!subjectMap[s.subject_id]) {
        subjectMap[s.subject_id] = {
          subject_id: s.subject_id,
          subject_name: s.subject_name,
          subject_code: s.subject_code,
          scores: [],
          total_score: new Decimal(0),
          count: 0
        };
      }
      subjectMap[s.subject_id].scores.push({
        assessment_id: s.assessment_id,
        assessment_title: s.assessment_title,
        score: Number(s.score),
        note: s.note
      });
      subjectMap[s.subject_id].total_score = subjectMap[s.subject_id].total_score.plus(new Decimal(s.score));
      subjectMap[s.subject_id].count++;
    }

    const summary = Object.values(subjectMap).map((subj: any) => {
      const avg = subj.total_score.dividedBy(subj.count);
      const roundedAvg = avg.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

      return {
        subject_id: subj.subject_id,
        subject_name: subj.subject_name,
        subject_code: subj.subject_code,
        average_score: roundedAvg,
        scores: subj.scores
      };
    });

    return summary;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting student academic summary',
      'ERR_DATABASE',
      500
    );
  }
}
