import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { createAuditLog } from '@/lib/services/auditService';
import { getActiveAcademicYear } from '@/lib/services/academicYearService';
import { getActiveSemester } from '@/lib/services/semesterService';
import {
  StudentAttendanceStatus,
  SaveStudentAttendancePayload,
  StudentAttendanceDetail,
  StudentAttendanceItem,
  StudentAttendanceClassItem,
  StudentAttendanceDashboardOverview,
  AttendanceCounts,
} from '@/types/studentAttendance';
import {
  validateSaveAttendancePayload,
  validateRosterCompleteness,
} from '@/lib/validation/studentAttendanceValidation';
import { isValidDateFormat, isFutureDate } from '@/lib/utils/schoolDate';

/**
 * Period-aware teacher authorization guard.
 * Admin and administrator roles bypass assignment checks.
 * Teachers must have an active assignment for the specific class AND semester.
 */
export async function verifyTeacherClassPeriodAccess(
  userId: string,
  role: string,
  classId: string,
  semesterId: string
): Promise<boolean> {
  const isAdmin = role === 'administrator' || role === 'admin';
  if (isAdmin) {
    return true;
  }

  const assignment = await db('class_teacher_assignments')
    .where('teacher_user_id', userId)
    .where('class_id', classId)
    .where('semester_id', semesterId)
    .where('status', 'active')
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!assignment) {
    throw new AppError(
      'Anda tidak memiliki akses sebagai wali kelas untuk kelas ini pada semester terkait.',
      'ERR_UNAUTHORIZED_CLASS_ACCESS',
      403
    );
  }

  return true;
}

/**
 * Resolves the active academic year and active semester.
 */
export async function getActiveAcademicPeriod() {
  const activeYear = await getActiveAcademicYear();
  if (!activeYear) {
    throw new AppError(
      'Tidak ada tahun ajaran aktif yang terdaftar.',
      'ERR_NO_ACTIVE_ACADEMIC_YEAR',
      400
    );
  }

  const activeSemester = await getActiveSemester(activeYear.id);
  if (!activeSemester) {
    throw new AppError(
      'Tidak ada semester aktif yang terdaftar.',
      'ERR_NO_ACTIVE_SEMESTER',
      400
    );
  }

  return { activeYear, activeSemester };
}

/**
 * Checks whether the actor has permission to mutate attendance for a given semester.
 * Teachers are only permitted when semester is active (is_active = 1, lifecycle_status = 'active').
 * Admins/administrators are allowed to make retroactive corrections.
 */
export function checkSemesterMutationPermission(semester: any, role: string) {
  const isAdmin = role === 'administrator' || role === 'admin';
  if (isAdmin) {
    return true;
  }

  const isSemesterActive =
    semester &&
    Number(semester.is_active) === 1 &&
    semester.lifecycle_status === 'active';

  if (!isSemesterActive) {
    throw new AppError(
      'Semester tidak aktif atau terkunci. Pengubahan presensi oleh guru tidak diizinkan.',
      'ERR_SEMESTER_LOCKED',
      403
    );
  }

  return true;
}

/**
 * Resolves the authoritative temporal roster for a class and semester on a specific attendance date.
 * Enforces the enrollment interval and withdrawal-day semantics:
 * - enrolled_at <= attendanceDate
 * - withdrawn_at IS NULL OR withdrawn_at >= attendanceDate
 * - student active and not soft deleted
 */
export async function getAuthoritativeTemporalRoster(
  classId: string,
  semesterId: string,
  attendanceDate: string,
  trx?: any
) {
  const query = (trx || db)('student_enrollments as se')
    .join('students as s', 's.id', 'se.student_id')
    .where('se.class_id', classId)
    .andWhere('se.semester_id', semesterId)
    .andWhereNot('se.lifecycle_status', 'soft_deleted')
    .andWhere((builder: any) => {
      builder.where('se.status', 'active').orWhereNotNull('se.withdrawn_at');
    })
    .whereNotIn('s.status', ['soft_deleted', 'archived'])
    .whereNull('s.deleted_at')
    .andWhere(db.raw('DATE(se.enrolled_at) <= ?', [attendanceDate]))
    .andWhere((builder: any) => {
      builder.whereNull('se.withdrawn_at').orWhere(
        db.raw('DATE(se.withdrawn_at) >= ?', [attendanceDate])
      );
    })
    .select(
      'se.id as student_enrollment_id',
      's.id as student_id',
      's.full_name',
      's.nisn'
    )
    .orderBy('s.full_name', 'asc');

  return await query;
}

/**
 * Retrieves attendance detail for a specific class and date.
 * Reconciles authoritative temporal roster with saved records:
 * - When no session exists: returns complete roster with default 'hadir' in memory (no DB write).
 * - When session exists: preserves saved statuses and flags any newly enrolled students.
 */
export async function getClassAttendance(
  classId: string,
  attendanceDate: string,
  actor: { id: string; role: string }
): Promise<StudentAttendanceDetail> {
  if (!isValidDateFormat(attendanceDate)) {
    throw new AppError(
      'Format tanggal presensi tidak valid (harus YYYY-MM-DD).',
      'ERR_INVALID_DATE_FORMAT',
      400
    );
  }

  if (isFutureDate(attendanceDate)) {
    throw new AppError(
      'Tanggal presensi tidak boleh di masa mendatang.',
      'ERR_FUTURE_ATTENDANCE_DATE',
      400
    );
  }

  // Check if class exists
  const targetClass = await db('classes')
    .where('id', classId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!targetClass) {
    throw new AppError('Kelas tidak ditemukan.', 'ERR_CLASS_NOT_FOUND', 404);
  }

  // Look for existing session for this class and date
  const existingSession = await db('student_attendance_sessions')
    .where({ class_id: classId, attendance_date: attendanceDate })
    .first();

  let semesterId: string;
  let academicYearId: string;
  let semester: any;
  let academicYear: any;

  if (existingSession) {
    semesterId = existingSession.semester_id;
    academicYearId = existingSession.academic_year_id;
    semester = await db('semesters').where('id', semesterId).first();
    academicYear = await db('academic_years').where('id', academicYearId).first();
  } else {
    const period = await getActiveAcademicPeriod();
    semesterId = period.activeSemester.id;
    academicYearId = period.activeYear.id;
    semester = period.activeSemester;
    academicYear = period.activeYear;
  }

  // Authorize period-aware access
  await verifyTeacherClassPeriodAccess(actor.id, actor.role, classId, semesterId);

  const isSemesterActive =
    semester &&
    Number(semester.is_active) === 1 &&
    semester.lifecycle_status === 'active';

  const isAdmin = actor.role === 'administrator' || actor.role === 'admin';
  const canEdit = isSemesterActive || isAdmin;

  // Resolve authoritative temporal roster
  const authoritativeRoster = await getAuthoritativeTemporalRoster(
    classId,
    semesterId,
    attendanceDate
  );

  let recorderUser: any = null;
  let updaterUser: any = null;
  let records: StudentAttendanceItem[] = [];

  if (existingSession) {
    if (existingSession.recorded_by) {
      recorderUser = await db('users').where('id', existingSession.recorded_by).first();
    }
    if (existingSession.updated_by) {
      updaterUser = await db('users').where('id', existingSession.updated_by).first();
    }

    const savedRecords = await db('student_attendance_records')
      .where('session_id', existingSession.id);

    const savedMap = new Map<string, any>(
      savedRecords.map((r: any) => [r.student_id, r])
    );

    // Reconcile roster with saved records
    records = authoritativeRoster.map((rosterStudent: any) => {
      const saved = savedMap.get(rosterStudent.student_id);
      if (saved) {
        return {
          student_id: rosterStudent.student_id,
          student_enrollment_id: rosterStudent.student_enrollment_id,
          full_name: rosterStudent.full_name,
          nisn: rosterStudent.nisn,
          status: saved.status as StudentAttendanceStatus,
          note: saved.note || null,
          is_new_roster_addition: false,
        };
      } else {
        // Newly valid student for that historical date
        return {
          student_id: rosterStudent.student_id,
          student_enrollment_id: rosterStudent.student_enrollment_id,
          full_name: rosterStudent.full_name,
          nisn: rosterStudent.nisn,
          status: 'hadir' as StudentAttendanceStatus,
          note: null,
          is_new_roster_addition: true,
        };
      }
    });
  } else {
    // No session exists: default all students to Hadir in memory only
    records = authoritativeRoster.map((rosterStudent: any) => ({
      student_id: rosterStudent.student_id,
      student_enrollment_id: rosterStudent.student_enrollment_id,
      full_name: rosterStudent.full_name,
      nisn: rosterStudent.nisn,
      status: 'hadir' as StudentAttendanceStatus,
      note: null,
      is_new_roster_addition: false,
    }));
  }

  // Calculate summary counts
  const counts: AttendanceCounts = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpa: 0,
    terlambat: 0,
  };

  for (const r of records) {
    if (r.status in counts) {
      counts[r.status]++;
    }
  }

  const total = records.length;
  const attendance_rate =
    total > 0
      ? Number((((counts.hadir + counts.terlambat) / total) * 100).toFixed(1))
      : 0;

  return {
    session_id: existingSession ? existingSession.id : null,
    class_id: targetClass.id,
    class_name: targetClass.name,
    attendance_date: attendanceDate,
    academic_year_id: academicYearId,
    academic_year_name: academicYear ? academicYear.name : '',
    semester_id: semesterId,
    semester_name: semester ? semester.name : '',
    is_semester_active: Boolean(isSemesterActive),
    can_edit: canEdit,
    has_submitted: Boolean(existingSession),
    recorded_by: existingSession ? existingSession.recorded_by : null,
    recorded_by_name: recorderUser ? recorderUser.name : null,
    updated_by: existingSession ? existingSession.updated_by : null,
    updated_by_name: updaterUser ? updaterUser.name : null,
    created_at: existingSession ? existingSession.created_at : null,
    updated_at: existingSession ? existingSession.updated_at : null,
    records,
    summary: {
      ...counts,
      total,
      attendance_rate,
    },
  };
}

/**
 * Saves student attendance atomically within a transaction with row locking.
 * Idempotent: saving the exact same data produces no changes and no duplicate audit log.
 */
export async function saveClassAttendance(
  classId: string,
  rawPayload: any,
  actor: {
    id: string;
    role: string;
    name?: string;
    ip?: string;
    userAgent?: string;
  }
): Promise<StudentAttendanceDetail> {
  const payload = validateSaveAttendancePayload(rawPayload);

  // Check class existence
  const targetClass = await db('classes')
    .where('id', classId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!targetClass) {
    throw new AppError('Kelas tidak ditemukan.', 'ERR_CLASS_NOT_FOUND', 404);
  }

  // Determine target semester
  const preCheckSession = await db('student_attendance_sessions')
    .where({ class_id: classId, attendance_date: payload.attendance_date })
    .first();

  let semesterId: string;
  let academicYearId: string;
  let semester: any;

  if (preCheckSession) {
    semesterId = preCheckSession.semester_id;
    academicYearId = preCheckSession.academic_year_id;
    semester = await db('semesters').where('id', semesterId).first();
  } else {
    const period = await getActiveAcademicPeriod();
    semesterId = period.activeSemester.id;
    academicYearId = period.activeYear.id;
    semester = period.activeSemester;
  }

  // Period-aware authorization check
  await verifyTeacherClassPeriodAccess(actor.id, actor.role, classId, semesterId);

  // Semester mutation permission check
  checkSemesterMutationPermission(semester, actor.role);

  let auditAction: string | null = null;
  let auditOldValue: any = null;
  let auditNewValue: any = null;
  let targetSessionId = '';

  await db.transaction(async (trx: any) => {
    // 1. Resolve authoritative temporal roster within transaction
    const authoritativeRoster = await getAuthoritativeTemporalRoster(
      classId,
      semesterId,
      payload.attendance_date,
      trx
    );

    // 2. Validate roster completeness against authoritative roster
    const submittedStudentIds = payload.records.map((r) => r.student_id);
    validateRosterCompleteness(submittedStudentIds, authoritativeRoster);

    const rosterMap = new Map<string, any>(
      authoritativeRoster.map((r: any) => [r.student_id, r])
    );

    // 3. Acquire row lock on existing session if it exists
    const existingSession = await trx('student_attendance_sessions')
      .where({
        class_id: classId,
        attendance_date: payload.attendance_date,
        semester_id: semesterId,
      })
      .forUpdate()
      .first();

    const now = new Date();

    if (existingSession) {
      targetSessionId = existingSession.id;

      // Fetch existing records
      const existingRecords = await trx('student_attendance_records')
        .where('session_id', existingSession.id);

      const existingMap = new Map<string, any>(
        existingRecords.map((r: any) => [r.student_id, r])
      );

      // Detect meaningful differences
      const diffs: Array<{
        student_id: string;
        old_status: string;
        new_status: string;
        old_note: string | null;
        new_note: string | null;
      }> = [];

      let hasChanges = false;

      for (const rec of payload.records) {
        const existing = existingMap.get(rec.student_id);
        const enrollment = rosterMap.get(rec.student_id);

        if (!existing) {
          hasChanges = true;
          diffs.push({
            student_id: rec.student_id,
            old_status: 'none',
            new_status: rec.status,
            old_note: null,
            new_note: rec.note || null,
          });

          // Insert newly valid student record
          await trx('student_attendance_records').insert({
            id: uuidv4(),
            session_id: existingSession.id,
            student_id: rec.student_id,
            student_enrollment_id: enrollment?.student_enrollment_id,
            status: rec.status,
            note: rec.note || null,
            created_at: now,
            updated_at: now,
          });
        } else {
          const statusChanged = existing.status !== rec.status;
          const noteChanged = (existing.note || null) !== (rec.note || null);

          if (statusChanged || noteChanged) {
            hasChanges = true;
            diffs.push({
              student_id: rec.student_id,
              old_status: existing.status,
              new_status: rec.status,
              old_note: existing.note || null,
              new_note: rec.note || null,
            });

            await trx('student_attendance_records')
              .where('id', existing.id)
              .update({
                status: rec.status,
                note: rec.note || null,
                student_enrollment_id: enrollment?.student_enrollment_id,
                updated_at: now,
              });
          }
        }
      }

      if (hasChanges) {
        // Update session timestamp & updater (preserving original recorded_by!)
        await trx('student_attendance_sessions')
          .where('id', existingSession.id)
          .update({
            updated_by: actor.id,
            updated_at: now,
          });

        auditAction = 'student_attendance_updated';
        auditOldValue = {
          session_id: existingSession.id,
          recorded_by: existingSession.recorded_by,
          diff_count: diffs.length,
          diffs: diffs.slice(0, 20),
        };
        auditNewValue = {
          session_id: existingSession.id,
          updated_by: actor.id,
          attendance_date: payload.attendance_date,
          total_records: payload.records.length,
        };
      }
      // If no changes, do nothing (idempotent no-op, no audit noise)
    } else {
      // Create brand new session
      targetSessionId = uuidv4();

      await trx('student_attendance_sessions').insert({
        id: targetSessionId,
        class_id: classId,
        attendance_date: payload.attendance_date,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        recorded_by: actor.id,
        updated_by: null,
        created_at: now,
        updated_at: now,
      });

      const recordsToInsert = payload.records.map((rec) => {
        const enrollment = rosterMap.get(rec.student_id);
        return {
          id: uuidv4(),
          session_id: targetSessionId,
          student_id: rec.student_id,
          student_enrollment_id: enrollment?.student_enrollment_id,
          status: rec.status,
          note: rec.note || null,
          created_at: now,
          updated_at: now,
        };
      });

      await trx('student_attendance_records').insert(recordsToInsert);

      auditAction = 'student_attendance_created';
      auditOldValue = null;
      auditNewValue = {
        session_id: targetSessionId,
        class_id: classId,
        attendance_date: payload.attendance_date,
        recorded_by: actor.id,
        total_students: recordsToInsert.length,
      };
    }
  });

  // Write audit log outside transaction if meaningful mutation took place
  if (auditAction && targetSessionId) {
    await createAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: auditAction,
      entity_type: 'student_attendance_session',
      entity_id: targetSessionId,
      old_value: auditOldValue,
      new_value: auditNewValue,
      description:
        auditAction === 'student_attendance_created'
          ? `Presensi kelas ${targetClass.name} tanggal ${payload.attendance_date} dibuat.`
          : `Presensi kelas ${targetClass.name} tanggal ${payload.attendance_date} diperbarui.`,
      ip_address: actor.ip,
      user_agent: actor.userAgent,
    });
  }

  // Return fresh state
  return await getClassAttendance(classId, payload.attendance_date, actor);
}

/**
 * Returns class list overview for a given date.
 * - Teacher: returns only classes assigned to them as wali kelas in the active semester.
 * - Admin/Administrator: returns all active classes.
 * High performance single-query aggregation without N+1.
 */
export async function getClassesAttendanceOverview(
  actor: { id: string; role: string },
  attendanceDate: string
): Promise<StudentAttendanceClassItem[]> {
  if (!isValidDateFormat(attendanceDate)) {
    throw new AppError(
      'Format tanggal presensi tidak valid (harus YYYY-MM-DD).',
      'ERR_INVALID_DATE_FORMAT',
      400
    );
  }

  const { activeSemester } = await getActiveAcademicPeriod();
  const isAdmin = actor.role === 'administrator' || actor.role === 'admin';

  const query = db('classes')
    .leftJoin('class_teacher_assignments as cta', (builder: any) => {
      builder.on('cta.class_id', '=', 'classes.id')
        .andOn('cta.semester_id', '=', db.raw('?', [activeSemester.id]))
        .andOn('cta.status', '=', db.raw('?', ['active']))
        .andOn('cta.lifecycle_status', '!=', db.raw('?', ['soft_deleted']));
    })
    .leftJoin('users as teacher', 'teacher.id', 'cta.teacher_user_id')
    .leftJoin('student_attendance_sessions as sas', (builder: any) => {
      builder.on('sas.class_id', '=', 'classes.id')
        .andOn('sas.semester_id', '=', db.raw('?', [activeSemester.id]))
        .andOn('sas.attendance_date', '=', db.raw('?', [attendanceDate]));
    })
    .leftJoin('student_attendance_records as sar', 'sar.session_id', 'sas.id')
    .leftJoin('student_enrollments as se', (builder: any) => {
      builder.on('se.class_id', '=', 'classes.id')
        .andOn('se.semester_id', '=', db.raw('?', [activeSemester.id]))
        .andOn('se.lifecycle_status', '!=', db.raw('?', ['soft_deleted']))
        .andOn((subBuilder: any) => {
          subBuilder.on('se.status', '=', db.raw('?', ['active'])).orOnNotNull(
            'se.withdrawn_at'
          );
        })
        .andOn(db.raw('DATE(se.enrolled_at) <= ?', [attendanceDate]))
        .andOn((subBuilder: any) => {
          subBuilder.onNull('se.withdrawn_at').orOn(
            db.raw('DATE(se.withdrawn_at) >= ?', [attendanceDate])
          );
        });
    })
    .leftJoin('students as s', (builder: any) => {
      builder.on('s.id', '=', 'se.student_id')
        .andOnNotIn('s.status', ['soft_deleted', 'archived'])
        .andOnNull('s.deleted_at');
    })
    .where('classes.status', 'active')
    .andWhere('classes.lifecycle_status', '!=', 'soft_deleted');

  if (!isAdmin) {
    // Teachers only see their assigned classes
    query.where('cta.teacher_user_id', actor.id);
  }

  query
    .select(
      'classes.id as class_id',
      'classes.name as class_name',
      'classes.level',
      'teacher.id as wali_kelas_id',
      'teacher.name as wali_kelas_name',
      'sas.id as session_id',
      'sas.recorded_by',
      db.raw('COUNT(DISTINCT s.id) as roster_count'),
      db.raw('COUNT(DISTINCT sar.id) as recorded_count'),
      db.raw("SUM(CASE WHEN sar.status = 'hadir' THEN 1 ELSE 0 END) as count_hadir"),
      db.raw("SUM(CASE WHEN sar.status = 'sakit' THEN 1 ELSE 0 END) as count_sakit"),
      db.raw("SUM(CASE WHEN sar.status = 'izin' THEN 1 ELSE 0 END) as count_izin"),
      db.raw("SUM(CASE WHEN sar.status = 'alpa' THEN 1 ELSE 0 END) as count_alpa"),
      db.raw(
        "SUM(CASE WHEN sar.status = 'terlambat' THEN 1 ELSE 0 END) as count_terlambat"
      )
    )
    .groupBy(
      'classes.id',
      'classes.name',
      'classes.level',
      'teacher.id',
      'teacher.name',
      'sas.id',
      'sas.recorded_by'
    )
    .orderBy('classes.level', 'asc')
    .orderBy('classes.name', 'asc');

  const rows = await query;

  return rows.map((row: any) => {
    const hasSubmitted = Boolean(row.session_id);
    const studentCount = hasSubmitted
      ? Number(row.recorded_count || 0)
      : Number(row.roster_count || 0);

    return {
      class_id: row.class_id,
      class_name: row.class_name,
      level: row.level != null ? String(row.level) : null,
      wali_kelas_id: row.wali_kelas_id || null,
      wali_kelas_name: row.wali_kelas_name || null,
      student_count: studentCount,
      session_id: row.session_id || null,
      has_submitted: hasSubmitted,
      recorded_by: row.recorded_by || null,
      counts: {
        hadir: Number(row.count_hadir || 0),
        sakit: Number(row.count_sakit || 0),
        izin: Number(row.count_izin || 0),
        alpa: Number(row.count_alpa || 0),
        terlambat: Number(row.count_terlambat || 0),
      },
    };
  });
}

/**
 * Returns school-wide daily dashboard for admin/administrator.
 */
export async function getAdminDashboardOverview(
  attendanceDate: string
): Promise<StudentAttendanceDashboardOverview> {
  if (!isValidDateFormat(attendanceDate)) {
    throw new AppError(
      'Format tanggal presensi tidak valid (harus YYYY-MM-DD).',
      'ERR_INVALID_DATE_FORMAT',
      400
    );
  }

  const { activeYear, activeSemester } = await getActiveAcademicPeriod();

  // Fetch all classes overview using admin supervisory role
  const classes = await getClassesAttendanceOverview(
    { id: 'admin', role: 'administrator' },
    attendanceDate
  );

  let submittedClasses = 0;
  let unsubmittedClasses = 0;
  let totalStudentsRecorded = 0;

  const totals: AttendanceCounts = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpa: 0,
    terlambat: 0,
  };

  for (const c of classes) {
    if (c.has_submitted) {
      submittedClasses++;
      totals.hadir += c.counts.hadir;
      totals.sakit += c.counts.sakit;
      totals.izin += c.counts.izin;
      totals.alpa += c.counts.alpa;
      totals.terlambat += c.counts.terlambat;
      totalStudentsRecorded +=
        c.counts.hadir +
        c.counts.sakit +
        c.counts.izin +
        c.counts.alpa +
        c.counts.terlambat;
    } else {
      unsubmittedClasses++;
    }
  }

  // Attendance rate denominator is ONLY recorded opportunities (submitted classes)
  const attendanceRate =
    totalStudentsRecorded > 0
      ? Number(
          (
            ((totals.hadir + totals.terlambat) / totalStudentsRecorded) *
            100
          ).toFixed(1)
        )
      : 0;

  return {
    date: attendanceDate,
    academic_year: {
      id: activeYear.id,
      name: activeYear.name,
    },
    semester: {
      id: activeSemester.id,
      name: activeSemester.name,
      is_active: Boolean(activeSemester.is_active),
    },
    overview: {
      total_classes: classes.length,
      submitted_classes: submittedClasses,
      unsubmitted_classes: unsubmittedClasses,
      total_students_recorded: totalStudentsRecorded,
      counts: totals,
      attendance_rate: attendanceRate,
    },
    classes,
  };
}
