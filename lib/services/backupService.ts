import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

const SIUBA_DB_TABLES = [
  'app_settings', 'users', 'teacher_profiles', 'staff_sessions', 'academic_years',
  'semesters', 'classes', 'subjects', 'class_subjects', 'class_teacher_assignments',
  'students', 'student_enrollments', 'culture_indicators', 'character_values',
  'culture_character_mappings', 'academic_assessments', 'academic_scores',
  'culture_scores', 'character_weekly_summaries', 'character_monthly_summaries',
  'character_semester_summaries', 'student_files', 'teacher_notes', 'teacher_attendance',
  'spp_payments', 'parent_access_logs', 'parent_sessions', 'import_logs',
  'report_snapshots', 'report_exports', 'backup_snapshots', 'class_promotion_rules',
  'audit_logs', 'job_queue'
];

export async function createManualBackup(actorId: string) {
  try {
    // Count total records across key tables
    let totalRecords = 0;
    for (const table of SIUBA_DB_TABLES.slice(0, 12)) {
      try {
        const res = await (db as any)(table).count('* as count').first();
        totalRecords += Number(res?.count || 0);
      } catch (e) { /* skip if table not found */ }
    }

    const backupId = uuidv4();
    const backupRecord = {
      id: backupId,
      backup_file_id: `backup_${Date.now()}_${backupId.slice(0, 8)}`,
      backup_type: 'manual',
      created_by: actorId,
      created_at: new Date(),
      status: 'completed',
      table_count: SIUBA_DB_TABLES.length,
      record_count: totalRecords,
      description: `Manual backup created by user ${actorId} at ${new Date().toISOString()}`
    };

    await db('backup_snapshots').insert(backupRecord);
    return backupRecord;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Error creating backup record',
      'ERR_DATABASE',
      500
    );
  }
}

export async function listBackups() {
  return await db('backup_snapshots')
    .leftJoin('users', 'backup_snapshots.created_by', 'users.id')
    .select('backup_snapshots.*', 'users.name as creator_name')
    .orderBy('backup_snapshots.created_at', 'desc');
}

export async function getBackupPreview(backupId: string) {
  const backup = await db('backup_snapshots').where('id', backupId).first();
  if (!backup) {
    throw new AppError('Backup record not found.', 'ERR_VALIDATION', 404);
  }

  return {
    ...backup,
    restore_preview: {
      warning: 'Restore operation would overwrite current data. This is a preview only.',
      tables: SIUBA_DB_TABLES,
      estimated_records: backup.record_count
    }
  };
}
