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

      // Check active enrollment or historical participation in same semester
      const enrollment = await db('student_enrollments')
        .where({
          student_id: item.student_id,
          semester_id: assessment.semester_id
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .andWhere(db.raw('DATE(enrolled_at)'), '<=', assessment.assessment_date)
        .andWhere(function(qb: any) {
          qb.whereNull('withdrawn_at')
            .orWhere(db.raw('DATE(withdrawn_at)'), '>=', assessment.assessment_date);
        })
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
      user_id: actorId || undefined,
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

export async function getClassAcademicSummary(classId: string, academicYearId: string, semesterId: string) {
  if (!classId || !academicYearId || !semesterId) {
    throw new AppError('Class ID, Academic Year ID, and Semester ID are required.', 'ERR_VALIDATION', 400);
  }

  try {
    // 1. Get assessments for class
    const assessments = await db('academic_assessments')
      .where({
        class_id: classId,
        academic_year_id: academicYearId,
        semester_id: semesterId
      })
      .whereNot('lifecycle_status', 'soft_deleted');

    const assessmentIds = assessments.map(a => a.id);

    // 2. Get all scores for these assessments
    const scores = assessmentIds.length > 0
      ? await db('academic_scores')
          .whereIn('assessment_id', assessmentIds)
          .whereNot('lifecycle_status', 'soft_deleted')
      : [];

    // Group scores by assessment and student
    const scoresByAssessment: Record<string, Record<string, number>> = {};
    for (const score of scores) {
      if (score.score !== null && score.score !== undefined) {
        if (!scoresByAssessment[score.assessment_id]) {
          scoresByAssessment[score.assessment_id] = {};
        }
        scoresByAssessment[score.assessment_id][score.student_id] = Number(score.score);
      }
    }

    // 3. For each assessment, compute its own temporal roster to calculate statistics.
    // Also compile the union of all students who have ever been in any of these rosters.
    const allStudentsMap: Record<string, { student_id: string; full_name: string; nisn: string; scores: number[] }> = {};

    const assessment_summaries = [];
    for (const assessment of assessments) {
      const assessmentDate: Date = assessment.assessment_date;

      // Query the roster for this assessment on its specific date
      const roster = await db('student_enrollments')
        .join('students', 'student_enrollments.student_id', 'students.id')
        .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
        .where('student_enrollments.class_id', classId)
        .where('student_enrollments.semester_id', semesterId)
        .where('student_enrollments.academic_year_id', academicYearId)
        .where(db.raw('DATE(student_enrollments.enrolled_at)'), '<=', assessmentDate)
        .andWhere(function (qb: any) {
          qb.whereNull('student_enrollments.withdrawn_at')
            .orWhere(db.raw('DATE(student_enrollments.withdrawn_at)'), '>=', assessmentDate);
        })
        .select('students.id as student_id', 'students.full_name', 'students.nisn');

      const rosterStudentIds = new Set(roster.map(r => r.student_id));
      const assessmentScores = scoresByAssessment[assessment.id] || {};

      // Filter graded counts to only include students currently in the roster for this assessment
      let gradedCount = 0;
      for (const studentId of Object.keys(assessmentScores)) {
        if (rosterStudentIds.has(studentId)) {
          gradedCount++;
        }
      }

      const totalStudents = roster.length;
      const ungraded_students = totalStudents - gradedCount;
      const completeness_percentage = totalStudents > 0
        ? parseFloat(((gradedCount / totalStudents) * 100).toFixed(2))
        : 100;

      assessment_summaries.push({
        assessment_id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        ungraded_students,
        completeness_percentage
      });

      // Populate student list for overall student summaries
      for (const student of roster) {
        if (!allStudentsMap[student.student_id]) {
          allStudentsMap[student.student_id] = {
            student_id: student.student_id,
            full_name: student.full_name,
            nisn: student.nisn,
            scores: []
          };
        }
        const scoreVal = assessmentScores[student.student_id];
        if (scoreVal !== undefined) {
          allStudentsMap[student.student_id].scores.push(scoreVal);
        }
      }
    }

    // Map student summaries using the gathered student score averages
    const student_summaries = Object.values(allStudentsMap).map(student => {
      const average_score = student.scores.length > 0
        ? parseFloat((student.scores.reduce((sum, val) => sum + val, 0) / student.scores.length).toFixed(2))
        : null;

      return {
        student_id: student.student_id,
        full_name: student.full_name,
        nisn: student.nisn,
        average_score
      };
    });

    return {
      class_id: classId,
      academic_year_id: academicYearId,
      semester_id: semesterId,
      student_summaries,
      assessment_summaries
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting class academic summary',
      'ERR_DATABASE',
      500
    );
  }
}

/**
 * Returns the academic average score per class for a given semester.
 * Uses the canonical enrollment_id join (not the looser student_id cross-join).
 * This prevents double-counting scores for students who transferred between classes.
 *
 * @param semesterId - active semester ID
 * @param classes    - array of { id, name } objects for active classes
 */
export async function getClassAcademicAverages(
  semesterId: string,
  classes: Array<{ id: string; name: string }>
): Promise<Array<{ name: string; RataRata: number }>> {
  if (!semesterId || !classes || classes.length === 0) return [];

  const results: Array<{ name: string; RataRata: number }> = [];

  for (const cls of classes) {
    const avg = await db('academic_scores')
      // Canonical join: enrollment_id → student_enrollments.id (not student_id cross-join)
      .join('student_enrollments', 'academic_scores.student_enrollment_id', 'student_enrollments.id')
      .join('academic_assessments', 'academic_scores.assessment_id', 'academic_assessments.id')
      .where('student_enrollments.class_id', cls.id)
      .where('student_enrollments.status', 'active')
      .where('student_enrollments.semester_id', semesterId)
      .where('academic_assessments.semester_id', semesterId)
      .whereNot('academic_scores.lifecycle_status', 'soft_deleted')
      .whereNot('academic_assessments.lifecycle_status', 'soft_deleted')
      .avg('academic_scores.score as avgScore')
      .first();

    results.push({
      name: cls.name,
      RataRata: parseFloat(Number(avg?.avgScore || 0).toFixed(2))
    });
  }

  return results;
}

/**
 * Returns students with active enrollment in the given semester who have no academic scores
 * recorded for any assessment in that same semester.
 *
 * Temporal scoping: the LEFT JOIN is constrained to academic_assessments.semester_id
 * so that historical scores from past semesters do NOT mask a student's absence this semester.
 *
 * @param semesterId - active semester ID
 * @param limit      - max rows to return (default 50)
 */
export async function getStudentsWithoutScores(
  semesterId: string,
  limit = 50
): Promise<Array<{ id: string; full_name: string; nisn: string; reason: string }>> {
  if (!semesterId) return [];

  const rows = await db('student_enrollments')
    .join('students', 'student_enrollments.student_id', 'students.id')
    .leftJoin(
      db('academic_scores')
        .join('academic_assessments', 'academic_scores.assessment_id', 'academic_assessments.id')
        .where('academic_assessments.semester_id', semesterId)
        .whereNot('academic_scores.lifecycle_status', 'soft_deleted')
        .whereNot('academic_assessments.lifecycle_status', 'soft_deleted')
        .select('academic_scores.student_enrollment_id')
        .as('scored_enrollments'),
      'student_enrollments.id',
      'scored_enrollments.student_enrollment_id'
    )
    .where('student_enrollments.semester_id', semesterId)
    .where('student_enrollments.status', 'active')
    .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
    .whereNull('scored_enrollments.student_enrollment_id')
    .select(
      'students.id',
      'students.full_name',
      'students.nisn',
      db.raw("'no_academic_scores' as reason")
    )
    .groupBy('students.id', 'students.full_name', 'students.nisn')
    .limit(limit);

  return rows as Array<{ id: string; full_name: string; nisn: string; reason: string }>;
}

