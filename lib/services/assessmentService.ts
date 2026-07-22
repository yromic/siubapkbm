import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export interface AssessmentFilters {
  class_id?: string;
  subject_id?: string;
  academic_year_id?: string;
  semester_id?: string;
  status?: 'draft' | 'published' | 'locked';
  teacher_user_id?: string;
}

export interface AssessmentInput {
  teacher_user_id?: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
  title: string;
  description?: string;
  assessment_date: string | Date;
  score_min: number;
  score_max: number;
}

export async function listAssessments(filters: AssessmentFilters = {}, page = 1, limit = 20) {
  try {
    const query = db('academic_assessments')
      .join('classes', 'academic_assessments.class_id', 'classes.id')
      .join('subjects', 'academic_assessments.subject_id', 'subjects.id')
      .join('users', 'academic_assessments.teacher_user_id', 'users.id')
      .whereNot('academic_assessments.lifecycle_status', 'soft_deleted');

    if (filters.class_id) {
      query.where('academic_assessments.class_id', filters.class_id);
    }
    if (filters.subject_id) {
      query.where('academic_assessments.subject_id', filters.subject_id);
    }
    if (filters.academic_year_id) {
      query.where('academic_assessments.academic_year_id', filters.academic_year_id);
    }
    if (filters.semester_id) {
      query.where('academic_assessments.semester_id', filters.semester_id);
    }
    if (filters.status) {
      query.where('academic_assessments.status', filters.status);
    }
    if (filters.teacher_user_id) {
      query.where('academic_assessments.teacher_user_id', filters.teacher_user_id);
    }

    const totalQuery = query.clone();
    const countResult = await totalQuery.count('academic_assessments.id as total').first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const items = await query
      .select(
        'academic_assessments.*',
        'classes.name as class_name',
        'subjects.name as subject_name',
        'users.name as teacher_name'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('academic_assessments.assessment_date', 'desc');

    return {
      data: items,
      pagination: { page, limit, total }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing academic assessments',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getAssessmentById(id: string) {
  if (!id) {
    throw new AppError('Assessment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_assessments')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Assessment with ID ${id} not found.`, 'ERR_ASSESSMENT_NOT_FOUND', 404);
    }

    return item;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createAssessment(input: AssessmentInput, actorId: string) {
  const teacherId = input.teacher_user_id || actorId;

  if (!input.class_id || !input.subject_id || !input.academic_year_id || !input.semester_id || !input.title || !input.assessment_date || input.score_min === undefined || input.score_max === undefined) {
    throw new AppError('Missing required fields.', 'ERR_VALIDATION', 400);
  }

  const scoreMin = Number(input.score_min);
  const scoreMax = Number(input.score_max);

  if (isNaN(scoreMin) || isNaN(scoreMax)) {
    throw new AppError('Min and max scores must be numbers.', 'ERR_VALIDATION', 400);
  }

  if (scoreMin >= scoreMax) {
    throw new AppError('Min score must be less than max score.', 'ERR_VALIDATION', 400);
  }

  try {
    // Validate teacher user exists and is a teacher
    const teacher = await db('users').where('id', teacherId).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!teacher) {
      throw new AppError('Teacher user not found.', 'ERR_VALIDATION', 400);
    }
    if (teacher.role !== 'teacher') {
      throw new AppError('Assigned user must be a teacher.', 'ERR_VALIDATION', 400);
    }

    // Validate class, subject, period
    const classExists = await db('classes').where('id', input.class_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!classExists) throw new AppError('Class not found.', 'ERR_VALIDATION', 400);

    const subjectExists = await db('subjects').where('id', input.subject_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!subjectExists) throw new AppError('Subject not found.', 'ERR_VALIDATION', 400);

    const yearExists = await db('academic_years').where('id', input.academic_year_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!yearExists) throw new AppError('Academic Year not found.', 'ERR_VALIDATION', 400);

    const semesterExists = await db('semesters').where('id', input.semester_id).whereNot('lifecycle_status', 'soft_deleted').first();
    if (!semesterExists) throw new AppError('Semester not found.', 'ERR_VALIDATION', 400);

    const id = uuidv4();
    const newItem = {
      id,
      teacher_user_id: teacherId,
      class_id: input.class_id,
      subject_id: input.subject_id,
      academic_year_id: input.academic_year_id,
      semester_id: input.semester_id,
      title: input.title,
      description: input.description || null,
      assessment_date: new Date(input.assessment_date),
      score_min: scoreMin,
      score_max: scoreMax,
      status: 'draft',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('academic_assessments').insert(newItem);
    return newItem;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateAssessment(id: string, input: Partial<Omit<AssessmentInput, 'class_id' | 'subject_id' | 'academic_year_id' | 'semester_id' | 'teacher_user_id'>>) {
  if (!id) {
    throw new AppError('Assessment ID is required.', 'ERR_VALIDATION', 400);
  }

  try {
    const item = await db('academic_assessments')
      .where('id', id)
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (!item) {
      throw new AppError(`Academic Assessment with ID ${id} not found.`, 'ERR_ASSESSMENT_NOT_FOUND', 404);
    }

    await assertNotLocked(id);

    if (item.status !== 'draft') {
      throw new AppError('Only academic assessments in draft status can be updated.', 'ERR_VALIDATION', 400);
    }

    const patch: any = { updated_at: new Date() };

    if (input.title !== undefined) {
      if (!input.title.trim()) throw new AppError('Title cannot be empty.', 'ERR_VALIDATION', 400);
      patch.title = input.title;
    }

    if (input.description !== undefined) {
      patch.description = input.description || null;
    }

    if (input.assessment_date !== undefined) {
      patch.assessment_date = new Date(input.assessment_date);
    }

    const scoreMin = input.score_min !== undefined ? Number(input.score_min) : item.score_min;
    const scoreMax = input.score_max !== undefined ? Number(input.score_max) : item.score_max;

    if (input.score_min !== undefined || input.score_max !== undefined) {
      if (isNaN(scoreMin) || isNaN(scoreMax)) {
        throw new AppError('Min and max scores must be numbers.', 'ERR_VALIDATION', 400);
      }
      if (scoreMin >= scoreMax) {
        throw new AppError('Min score must be less than max score.', 'ERR_VALIDATION', 400);
      }
      if (input.score_min !== undefined) patch.score_min = scoreMin;
      if (input.score_max !== undefined) patch.score_max = scoreMax;
    }

    if (Object.keys(patch).length > 1) {
      await db('academic_assessments').where('id', id).update(patch);
    }

    return await getAssessmentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function publishAssessment(id: string) {
  try {
    const item = await getAssessmentById(id);
    if (item.status !== 'draft') {
      throw new AppError('Only draft assessments can be published.', 'ERR_VALIDATION', 400);
    }

    await db('academic_assessments').where('id', id).update({
      status: 'published',
      updated_at: new Date()
    });

    return await getAssessmentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error publishing academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function lockAssessment(id: string, actorId: string) {
  try {
    const item = await getAssessmentById(id);
    if (item.status !== 'published') {
      throw new AppError('Only published assessments can be locked.', 'ERR_VALIDATION', 400);
    }

    // Validate score completeness for active enrolled students
    const activeStudents = await db('student_enrollments')
      .where({
        class_id: item.class_id,
        academic_year_id: item.academic_year_id,
        semester_id: item.semester_id,
        status: 'active'
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .select('student_id');

    const studentIds = activeStudents.map((s: any) => s.student_id);
    if (studentIds.length === 0) {
      throw new AppError('Cannot lock assessment for a class with no active enrolled students.', 'ERR_VALIDATION', 400);
    }

    const scoreCountRes = await db('academic_scores')
      .where('assessment_id', id)
      .whereIn('student_id', studentIds)
      .whereNotNull('score')
      .whereNot('score', '')
      .whereNot('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    const scoredCount = Number(scoreCountRes?.count || 0);
    if (scoredCount < studentIds.length) {
      throw new AppError(
        `Cannot lock assessment. Score entry is incomplete (${scoredCount} of ${studentIds.length} students scored).`,
        'ERR_SCORES_INCOMPLETE',
        400
      );
    }

    await db('academic_assessments').where('id', id).update({
      status: 'locked',
      locked_at: new Date(),
      locked_by: actorId,
      updated_at: new Date()
    });

    return await getAssessmentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error locking academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function unlockAssessment(id: string, actorId: string) {
  try {
    const item = await getAssessmentById(id);
    if (item.status !== 'locked') {
      throw new AppError('Only locked assessments can be unlocked.', 'ERR_VALIDATION', 400);
    }

    // Protect against unlocking assessments in finalized/locked semesters
    const semester = await db('semesters').where('id', item.semester_id).first();
    if (semester && (semester.lifecycle_status === 'finalized' || semester.lifecycle_status === 'locked')) {
      throw new AppError(
        'Cannot unlock assessment. The associated semester has already been finalized or locked.',
        'ERR_SEMESTER_FINALIZED',
        400
      );
    }

    await db('academic_assessments').where('id', id).update({
      status: 'published',
      locked_at: null,
      locked_by: null,
      updated_at: new Date()
    });

    return await getAssessmentById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error unlocking academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deleteAssessment(id: string, actorId: string) {
  try {
    await getAssessmentById(id);
    
    await db('academic_assessments').where('id', id).update({
      lifecycle_status: 'soft_deleted',
      deleted_at: new Date(),
      deleted_by: actorId,
      updated_at: new Date()
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deleting academic assessment',
      'ERR_DATABASE',
      500
    );
  }
}

export async function assertNotLocked(assessmentId: string): Promise<void> {
  const assessment = await db('academic_assessments')
    .where('id', assessmentId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();
    
  if (!assessment) {
    throw new AppError('Academic Assessment not found.', 'ERR_ASSESSMENT_NOT_FOUND', 404);
  }
  
  if (assessment.status === 'locked') {
    throw new AppError('Cannot modify scores. The assessment is locked.', 'ERR_ASSESSMENT_LOCKED', 400);
  }
}
