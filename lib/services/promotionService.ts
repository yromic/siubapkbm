import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export async function listPromotionRules() {
  try {
    return await db('class_promotion_rules')
      .join('classes as source', 'class_promotion_rules.source_class_id', 'source.id')
      .join('classes as target', 'class_promotion_rules.target_class_id', 'target.id')
      .whereNot('class_promotion_rules.lifecycle_status', 'soft_deleted')
      .select(
        'class_promotion_rules.id',
        'class_promotion_rules.source_class_id',
        'source.name as source_class_name',
        'class_promotion_rules.target_class_id',
        'target.name as target_class_name',
        'class_promotion_rules.status'
      );
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing promotion rules',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createPromotionRule(input: { source_class_id: string; target_class_id: string }) {
  if (!input.source_class_id || !input.target_class_id) {
    throw new AppError('source_class_id and target_class_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const existing = await db('class_promotion_rules')
      .where({
        source_class_id: input.source_class_id,
        target_class_id: input.target_class_id
      })
      .whereNot('lifecycle_status', 'soft_deleted')
      .first();

    if (existing) {
      throw new AppError('Promotion rule for this source and target class mapping already exists.', 'ERR_VALIDATION', 400);
    }

    const id = uuidv4();
    await db('class_promotion_rules').insert({
      id,
      source_class_id: input.source_class_id,
      target_class_id: input.target_class_id,
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    return { id, ...input, status: 'active' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating promotion rule',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updatePromotionRule(id: string, body: { source_class_id?: string; target_class_id?: string; status?: string }) {
  try {
    const existing = await db('class_promotion_rules').where('id', id).first();
    if (!existing) {
      throw new AppError('Promotion rule not found.', 'ERR_VALIDATION', 404);
    }

    const updateData = {
      ...body,
      updated_at: new Date()
    };

    await db('class_promotion_rules').where('id', id).update(updateData);
    return { ...existing, ...updateData };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating promotion rule',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deletePromotionRule(id: string) {
  try {
    const existing = await db('class_promotion_rules').where('id', id).first();
    if (!existing) {
      throw new AppError('Promotion rule not found.', 'ERR_VALIDATION', 404);
    }

    await db('class_promotion_rules')
      .where('id', id)
      .update({
        lifecycle_status: 'soft_deleted',
        updated_at: new Date()
      });

    return { id };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deleting promotion rule',
      'ERR_DATABASE',
      500
    );
  }
}

export interface PromotionOverride {
  student_id: string;
  action: 'promoted' | 'repeated' | 'graduated' | 'transferred' | 'inactive' | 'left';
  target_class_id?: string;
}

export async function previewPromotion(
  sourceAcademicYearId: string,
  sourceSemesterId: string,
  targetAcademicYearId: string,
  targetSemesterId: string,
  overrides: PromotionOverride[] = []
) {
  if (!sourceAcademicYearId || !sourceSemesterId || !targetAcademicYearId || !targetSemesterId) {
    throw new AppError('source_academic_year_id, source_semester_id, target_academic_year_id, and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const srcYear = await db('academic_years').where('id', sourceAcademicYearId).first();
    const srcSem = await db('semesters').where('id', sourceSemesterId).first();
    const tgtYear = await db('academic_years').where('id', targetAcademicYearId).first();
    const tgtSem = await db('semesters').where('id', targetSemesterId).first();

    if (!srcYear || !srcSem || !tgtYear || !tgtSem) {
      throw new AppError('Source or target academic year or semester not found.', 'ERR_VALIDATION', 404);
    }

    if (srcSem.academic_year_id !== sourceAcademicYearId || tgtSem.academic_year_id !== targetAcademicYearId) {
      throw new AppError('Semester does not belong to the corresponding academic year.', 'ERR_VALIDATION', 400);
    }

    const globalBlockers: Array<{ type: string; message: string }> = [];

    // 1. Same Academic Year blocker
    if (sourceAcademicYearId === targetAcademicYearId) {
      globalBlockers.push({
        type: 'PERIOD_MISMATCH',
        message: 'Tahun ajaran sumber dan target tidak boleh sama (semester rollover bukan bagian dari kenaikan kelas).'
      });
    }

    // 2. Start Date Order blocker
    const srcStartDate = srcYear.start_date ? new Date(srcYear.start_date).getTime() : 0;
    const tgtStartDate = tgtYear.start_date ? new Date(tgtYear.start_date).getTime() : 0;
    if (tgtStartDate <= srcStartDate) {
      globalBlockers.push({
        type: 'PERIOD_MISMATCH',
        message: 'Tanggal mulai tahun ajaran target harus lebih besar dari tahun ajaran sumber.'
      });
    }

    // 3. Consecutive Academic Years sequence verification
    const allYears = await db('academic_years').whereNot('lifecycle_status', 'soft_deleted');
    const intermediateYears = allYears.filter(y => {
      if (y.id === sourceAcademicYearId || y.id === targetAcademicYearId) return false;
      const yStart = y.start_date ? new Date(y.start_date).getTime() : 0;
      return yStart > srcStartDate && yStart < tgtStartDate;
    });
    if (intermediateYears.length > 0) {
      globalBlockers.push({
        type: 'PERIOD_MISMATCH',
        message: 'Tahun ajaran target harus merupakan tahun ajaran berikutnya secara berurutan.'
      });
    }

    // 4. Invalid final-to-first semester blocker
    const srcSemesters = await db('semesters')
      .where('academic_year_id', sourceAcademicYearId)
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('start_date', 'asc');
    const lastSrcSem = srcSemesters[srcSemesters.length - 1];

    const tgtSemesters = await db('semesters')
      .where('academic_year_id', targetAcademicYearId)
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('start_date', 'asc');
    const firstTgtSem = tgtSemesters[0];

    if (!lastSrcSem || !firstTgtSem || sourceSemesterId !== lastSrcSem.id || targetSemesterId !== firstTgtSem.id) {
      globalBlockers.push({
        type: 'PERIOD_MISMATCH',
        message: 'Semester sumber harus merupakan semester akhir (Genap) dan semester target harus merupakan semester awal (Ganjil).'
      });
    }

    // Build lookup maps
    const activeRules = await db('class_promotion_rules')
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted');
    const rulesMap = new Map(activeRules.map(r => [r.source_class_id, r]));

    const activeClasses = await db('classes')
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted');
    const classesMap = new Map(activeClasses.map(c => [c.id, c]));

    // Fetch active enrollments in the source period
    const sourceEnrollments = await db('student_enrollments')
      .join('students', 'student_enrollments.student_id', 'students.id')
      .where({
        'student_enrollments.academic_year_id': sourceAcademicYearId,
        'student_enrollments.semester_id': sourceSemesterId,
        'student_enrollments.status': 'active'
      })
      .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
      .select(
        'student_enrollments.id as enrollment_id',
        'student_enrollments.student_id',
        'student_enrollments.class_id',
        'students.full_name as student_name',
        'students.nisn'
      );

    const studentList: any[] = [];
    const counts = {
      total: sourceEnrollments.length,
      promoted: 0,
      repeated: 0,
      graduated: 0,
      transferred: 0,
      inactive: 0,
      left: 0,
      unresolved: 0
    };

    const overridesMap = new Map(overrides.map(ov => [ov.student_id, ov]));

    for (const e of sourceEnrollments) {
      const sourceClass = classesMap.get(e.class_id) || await db('classes').where('id', e.class_id).first();
      const sourceClassName = sourceClass ? sourceClass.name : 'Unknown Class';
      const sourceClassLevel = sourceClass ? sourceClass.level : 0;

      let recAction = 'unresolved';
      let recTargetClassId = '';
      let recTargetClassName = '';
      const studentBlockers: string[] = [];

      const rule = rulesMap.get(e.class_id);
      if (rule) {
        const tgtClass = classesMap.get(rule.target_class_id) || await db('classes').where('id', rule.target_class_id).first();
        if (tgtClass) {
          if (tgtClass.status === 'active') {
            recAction = 'promoted';
            recTargetClassId = tgtClass.id;
            recTargetClassName = tgtClass.name;
          } else {
            studentBlockers.push(`Kelas tujuan (${tgtClass.name}) berstatus tidak aktif.`);
          }
        } else {
          studentBlockers.push('Kelas tujuan untuk aturan kenaikan kelas tidak ditemukan.');
        }
      } else {
        if (sourceClassLevel === 6 || parseInt(String(sourceClassLevel), 10) === 6) {
          recAction = 'graduated';
        } else {
          studentBlockers.push(`Tidak ada aturan kenaikan kelas untuk kelas ${sourceClassName}.`);
        }
      }

      // Resolve overrides
      let resolvedAction = recAction;
      let resolvedTargetClassId = recTargetClassId;
      let resolvedTargetClassName = recTargetClassName;

      const override = overridesMap.get(e.student_id);
      if (override) {
        const ovAction = override.action;
        const ovTargetClassId = override.target_class_id;

        const validActions = ['promoted', 'repeated', 'graduated', 'transferred', 'inactive', 'left'];
        if (!validActions.includes(ovAction)) {
          studentBlockers.push(`Pilihan aksi manual '${ovAction}' tidak valid.`);
          resolvedAction = 'unresolved';
          resolvedTargetClassId = '';
          resolvedTargetClassName = '';
        } else {
          // Clear automatic rule blockers as admin took manual action
          studentBlockers.length = 0;

          if (ovAction === 'promoted') {
            if (!ovTargetClassId) {
              studentBlockers.push('Kelas tujuan wajib ditentukan untuk siswa yang naik kelas.');
              resolvedAction = 'unresolved';
              resolvedTargetClassId = '';
              resolvedTargetClassName = '';
            } else {
              const tgtClass = classesMap.get(ovTargetClassId) || await db('classes').where('id', ovTargetClassId).first();
              if (!tgtClass) {
                studentBlockers.push('Kelas tujuan yang ditentukan tidak ditemukan.');
                resolvedAction = 'unresolved';
                resolvedTargetClassId = '';
                resolvedTargetClassName = '';
              } else if (tgtClass.status !== 'active') {
                studentBlockers.push(`Kelas tujuan (${tgtClass.name}) berstatus tidak aktif.`);
                resolvedAction = 'unresolved';
                resolvedTargetClassId = '';
                resolvedTargetClassName = '';
              } else {
                resolvedAction = 'promoted';
                resolvedTargetClassId = tgtClass.id;
                resolvedTargetClassName = tgtClass.name;
              }
            }
          } else if (ovAction === 'repeated') {
            resolvedAction = 'repeated';
            resolvedTargetClassId = e.class_id;
            resolvedTargetClassName = sourceClassName;
            if (sourceClass && sourceClass.status !== 'active') {
              studentBlockers.push(`Kelas asal (${sourceClassName}) berstatus tidak aktif.`);
              resolvedAction = 'unresolved';
              resolvedTargetClassId = '';
              resolvedTargetClassName = '';
            }
          } else {
            resolvedAction = ovAction;
            resolvedTargetClassId = '';
            resolvedTargetClassName = '';
          }
        }
      }

      if (counts[resolvedAction as keyof typeof counts] !== undefined) {
        counts[resolvedAction as keyof typeof counts]++;
      } else {
        counts.unresolved++;
      }

      studentList.push({
        student_id: e.student_id,
        student_name: e.student_name,
        nisn: e.nisn || '',
        source_class_id: e.class_id,
        source_class_name: sourceClassName,
        recommended_action: recAction,
        recommended_target_class_id: recTargetClassId,
        recommended_target_class_name: recTargetClassName,
        resolved_action: resolvedAction,
        resolved_target_class_id: resolvedTargetClassId,
        resolved_target_class_name: resolvedTargetClassName,
        blockers: studentBlockers
      });
    }

    let canExecute = globalBlockers.length === 0;
    if (canExecute) {
      for (const s of studentList) {
        if (s.blockers.length > 0 || s.resolved_action === 'unresolved') {
          canExecute = false;
          break;
        }
      }
    }

    return {
      can_execute: canExecute,
      source_academic_year_id: sourceAcademicYearId,
      source_semester_id: sourceSemesterId,
      target_academic_year_id: targetAcademicYearId,
      target_semester_id: targetSemesterId,
      students: studentList,
      global_blockers: globalBlockers,
      counts
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error previewing student promotion',
      'ERR_DATABASE',
      500
    );
  }
}

export async function executePromotion(
  sourceAcademicYearId: string,
  sourceSemesterId: string,
  targetAcademicYearId: string,
  targetSemesterId: string,
  overrides: PromotionOverride[] = [],
  actor?: { id: string; name: string; role: string }
) {
  if (!sourceAcademicYearId || !sourceSemesterId || !targetAcademicYearId || !targetSemesterId) {
    throw new AppError('source_academic_year_id, source_semester_id, target_academic_year_id, and target_semester_id are required.', 'ERR_VALIDATION', 400);
  }

  const preview = await previewPromotion(sourceAcademicYearId, sourceSemesterId, targetAcademicYearId, targetSemesterId, overrides);
  if (!preview.can_execute) {
    throw new AppError(
      'Promotion execution is blocked: ' + JSON.stringify({
        global_blockers: preview.global_blockers,
        students: preview.students.filter(s => s.blockers && s.blockers.length > 0)
      }),
      'ERR_PROMOTION_BLOCKED',
      400
    );
  }

  const result = {
    processed: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    promoted: 0,
    repeated: 0,
    graduated: 0,
    transferred: 0,
    inactive: 0,
    left: 0
  };

  try {
    await db.transaction(async (trx) => {
      for (const item of preview.students) {
        result.processed++;
        try {
          const action = item.resolved_action;
          
          const sourceEnrollment = await trx('student_enrollments')
            .where({
              student_id: item.student_id,
              class_id: item.source_class_id,
              academic_year_id: sourceAcademicYearId,
              semester_id: sourceSemesterId,
              status: 'active'
            })
            .first();

          if (!sourceEnrollment) {
            result.skipped++;
            continue;
          }

          if (action === 'promoted' || action === 'repeated') {
            const duplicateTarget = await trx('student_enrollments')
              .where({
                student_id: item.student_id,
                academic_year_id: targetAcademicYearId,
                semester_id: targetSemesterId,
                status: 'active'
              })
              .whereNot('lifecycle_status', 'soft_deleted')
              .first();

            if (duplicateTarget) {
              result.skipped++;
              continue;
            }

            await trx('student_enrollments')
              .where('id', sourceEnrollment.id)
              .update({
                status: action,
                updated_at: new Date()
              });

            const newEnrollmentId = uuidv4();
            await trx('student_enrollments').insert({
              id: newEnrollmentId,
              student_id: item.student_id,
              class_id: item.resolved_target_class_id,
              academic_year_id: targetAcademicYearId,
              semester_id: targetSemesterId,
              status: 'active',
              lifecycle_status: 'active',
              created_at: new Date(),
              updated_at: new Date()
            });

            await trx('students')
              .where('id', item.student_id)
              .update({
                status: 'active',
                updated_at: new Date()
              });
          } else {
            const enrollmentStatus = action === 'left' ? 'inactive' : action;
            const studentStatusMap: Record<string, string> = {
              graduated: 'graduated',
              transferred: 'transferred',
              inactive: 'inactive',
              left: 'withdrawn'
            };

            await trx('student_enrollments')
              .where('id', sourceEnrollment.id)
              .update({
                status: enrollmentStatus,
                updated_at: new Date()
              });

            await trx('students')
              .where('id', item.student_id)
              .update({
                status: studentStatusMap[action] || 'inactive',
                updated_at: new Date()
              });
          }

          if (result[action as keyof typeof result] !== undefined) {
            result[action as keyof typeof result]++;
          }
          result.completed++;
        } catch (studentError) {
          result.failed++;
          console.error(`Promotion failed for student ${item.student_id}:`, studentError);
          throw studentError;
        }
      }
    });

    const auditId = uuidv4();
    await db('audit_logs').insert({
      id: auditId,
      user_id: actor ? actor.id : 'system',
      user_name: actor ? actor.name : 'System',
      user_role: actor ? actor.role : 'system',
      action: 'PROMOTION_EXECUTION',
      entity_type: 'student_enrollments',
      entity_id: '',
      old_value: '',
      new_value: JSON.stringify({
        source_academic_year_id: sourceAcademicYearId,
        source_semester_id: sourceSemesterId,
        target_academic_year_id: targetAcademicYearId,
        target_semester_id: targetSemesterId,
        counts: result
      }),
      description: 'Executed annual student promotion batch.',
      created_at: new Date()
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error executing student promotion',
      'ERR_DATABASE',
      500
    );
  }
}
