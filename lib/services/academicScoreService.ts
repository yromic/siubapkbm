import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { getAssessmentById, assertNotLocked } from './assessmentService';
import { Decimal } from 'decimal.js';
import { createAuditLog } from './auditService';

export interface ScoreInput {
  student_id: string;
  score: number | null | "" | undefined;
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
      if (!item.student_id) {
        throw new AppError('Missing student_id in input array.', 'ERR_VALIDATION', 400);
      }

      const isEmpty = item.score === undefined || item.score === null || item.score === '';
      let scoreVal: number | null = null;

      if (!isEmpty) {
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
        scoreVal = scoreNum;
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
        score: scoreVal,
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

    // 4. Audit Log
    const actor = actorId ? await db('users').where('id', actorId).first() : null;
    for (const item of processedScores) {
      await createAuditLog({
        user_id: actorId,
        user_name: actor ? actor.name : null,
        user_role: actor ? actor.role : null,
        action: 'score_saved',
        entity_type: 'academic_score',
        new_value: {
          assessment_id: assessmentId,
          student_id: item.student_id,
          score: item.score
        },
        description: `Saved academic score for student ${item.student_id} in assessment ${assessmentId}`
      });
    }

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

export async function updateScore(id: string, score: number | null | "" | undefined, note?: string, actorId?: string) {
  if (!id) {
    throw new AppError('Score ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('academic_scores')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!existing) {
      throw new AppError(`Academic Score with ID ${id} not found.`, 'ERR_VALIDATION', 404);
    }

    // Reuse assertNotLocked instead of manual lock check
    await assertNotLocked(existing.assessment_id);
    const assessment = await getAssessmentById(existing.assessment_id);

    const isEmpty = score === undefined || score === null || score === '';
    let scoreVal: number | null = null;

    if (!isEmpty) {
      const scoreNum = Number(score);
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
      scoreVal = scoreNum;
    }

    const patch: any = { score: scoreVal, updated_at: new Date() };
    if (note !== undefined) patch.note = note || null;

    await db('academic_scores').where('id', id).update(patch);

    // Audit Log
    const actor = actorId ? await db('users').where('id', actorId).first() : null;
    await createAuditLog({
      user_id: actorId || null,
      user_name: actor ? actor.name : null,
      user_role: actor ? actor.role : null,
      action: 'score_updated',
      entity_type: 'academic_score',
      entity_id: id,
      old_value: { score: existing.score, note: existing.note },
      new_value: { score: scoreVal, note: note !== undefined ? note : existing.note },
      description: `Updated academic score ID ${id}`
    });
    
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

export async function getStudentAcademicSummary(studentId: string, academicYearId: string, semesterId: string, onlyPublishedAndLocked = false) {
  if (!studentId || !academicYearId || !semesterId) {
    throw new AppError('Student ID, Academic Year ID, and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // Check if student exists
    const student = await db('students').where('id', studentId).whereNot('status', 'soft_deleted').first();
    if (!student) throw new AppError('Student not found.', 'ERR_VALIDATION', 404);

    const query = db('academic_scores')
      .join('academic_assessments', 'academic_scores.assessment_id', 'academic_assessments.id')
      .join('subjects', 'academic_assessments.subject_id', 'subjects.id')
      .where('academic_scores.student_id', studentId)
      .where('academic_assessments.academic_year_id', academicYearId)
      .where('academic_assessments.semester_id', semesterId)
      .whereNot('academic_scores.lifecycle_status', 'soft_deleted')
      .whereNot('academic_assessments.lifecycle_status', 'soft_deleted');

    if (onlyPublishedAndLocked) {
      query.whereIn('academic_assessments.status', ['published', 'locked']);
    }

    const scores = await query.select(
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
        score: s.score !== null ? Number(s.score) : null,
        note: s.note
      });
      if (s.score !== null) {
        subjectMap[s.subject_id].total_score = subjectMap[s.subject_id].total_score.plus(new Decimal(s.score));
        subjectMap[s.subject_id].count++;
      }
    }

    const summary = Object.values(subjectMap).map((subj: any) => {
      const avg = subj.count > 0 ? subj.total_score.dividedBy(subj.count) : null;
      const roundedAvg = avg ? avg.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : null;

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

