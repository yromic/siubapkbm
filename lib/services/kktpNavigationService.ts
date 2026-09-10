import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { deriveKKTPStatusFromDoc, getKKTPStatusBadge, KKTPDocStatus } from '@/lib/utils/kktpStatusUtils';

export interface KKTPClassSubjectSummary {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  created_count: number;
  student_count: number;
}

export interface KKTPClassCardItem {
  class_id: string;
  class_name: string;
  class_code: string;
  class_level: number;
  student_count: number;
  subjects: KKTPClassSubjectSummary[];
  total_kktp_count: number;
}

export interface KKTPStudentItem {
  student_id: string;
  student_name: string;
  nisn: string | null;
  status: KKTPDocStatus;
  status_label: string;
  status_color: string;
  kktp_doc_id: string | null;
  kktp_doc_title: string | null;
  kktp_updated_at: string | null;
}

/**
 * Verifies if user is authorized to access a given class.
 * - Admin/Administrator: always authorized
 * - Teacher: must have an active assignment in class_teacher_assignments
 */
export async function verifyTeacherClassAccess(
  userId: string,
  role: string,
  classId: string
): Promise<boolean> {
  const isAdmin = role === 'administrator' || role === 'admin';
  if (isAdmin) return true;

  const assignment = await db('class_teacher_assignments')
    .where('teacher_user_id', userId)
    .where('class_id', classId)
    .where('status', 'active')
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  return Boolean(assignment);
}

/**
 * Returns role-scoped classes.
 */
export async function getAccessibleClasses(user: { id: string; role: string }): Promise<Array<{ id: string; name: string; code: string; level: number }>> {
  const isAdmin = user.role === 'administrator' || user.role === 'admin';

  if (isAdmin) {
    return await db('classes')
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('level', 'asc')
      .orderBy('code', 'asc')
      .select('id', 'code', 'name', 'level');
  }

  const assignments = await db('class_teacher_assignments')
    .join('classes', 'class_teacher_assignments.class_id', 'classes.id')
    .where('class_teacher_assignments.teacher_user_id', user.id)
    .where('class_teacher_assignments.status', 'active')
    .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
    .where('classes.status', 'active')
    .whereNot('classes.lifecycle_status', 'soft_deleted')
    .orderBy('classes.level', 'asc')
    .orderBy('classes.code', 'asc')
    .select('classes.id', 'classes.code', 'classes.name', 'classes.level');

  // Deduplicate
  const seen = new Set<string>();
  return assignments.filter((c: any) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/**
 * Returns subjects applicable to a specific class.
 * Sources:
 * 1. class_subjects table
 * 2. Active subjects table (fallback if class_subjects is empty)
 * 3. Any subjects present in existing KKTP documents for this class (ensuring legacy discoverability)
 */
export async function getSubjectsForClass(classId: string): Promise<Array<{ id: string; name: string; code: string }>> {
  // 1. Check class_subjects
  const classSubjects = await db('class_subjects')
    .join('subjects', 'class_subjects.subject_id', 'subjects.id')
    .where('class_subjects.class_id', classId)
    .whereNot('class_subjects.lifecycle_status', 'soft_deleted')
    .whereNot('subjects.lifecycle_status', 'soft_deleted')
    .select('subjects.id', 'subjects.name', 'subjects.code');

  const subjectMap = new Map<string, { id: string; name: string; code: string }>();

  for (const s of classSubjects) {
    subjectMap.set(s.id, { id: s.id, name: s.name, code: s.code || s.name });
  }

  // 2. If class_subjects is empty, load all active subjects from subjects table
  if (subjectMap.size === 0) {
    const allSubjects = await db('subjects')
      .where('status', 'active')
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('code', 'asc')
      .select('id', 'name', 'code');

    for (const s of allSubjects) {
      subjectMap.set(s.id, { id: s.id, name: s.name, code: s.code || s.name });
    }
  }

  // 3. Check existing KKTP documents for this class to catch any custom/legacy subject names
  const existingKKTPs = (await db('documents')
    .where('type', 'KKTP')
    .where('class_id', classId)
    .select('subject_id', 'content')) as any[];

  for (const doc of existingKKTPs) {
    const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
    const subjId = doc.subject_id || content?.identitas?.subjectId;
    const subjName = content?.identitas?.mataPelajaran;

    if (subjId && !subjectMap.has(subjId)) {
      subjectMap.set(subjId, { id: subjId, name: subjName || subjId, code: subjName || subjId });
    } else if (!subjId && subjName) {
      // Find by name in subjectMap
      let found = false;
      for (const s of subjectMap.values()) {
        if (s.name.toLowerCase() === subjName.toLowerCase()) {
          found = true;
          break;
        }
      }
      if (!found) {
        subjectMap.set(subjName, { id: subjName, name: subjName, code: subjName });
      }
    }
  }

  return Array.from(subjectMap.values());
}

/**
 * Level 1: Get Class Landing Summaries with subject progress.
 */
export async function getKKTPClassesSummary(user: { id: string; role: string }): Promise<KKTPClassCardItem[]> {
  const accessibleClasses = await getAccessibleClasses(user);
  if (accessibleClasses.length === 0) return [];

  const classIds = accessibleClasses.map((c) => c.id);

  // Student counts per class
  const enrollmentCounts: { class_id: string; count: string }[] = await db('student_enrollments')
    .whereIn('class_id', classIds)
    .where('status', 'active')
    .whereNot('lifecycle_status', 'soft_deleted')
    .groupBy('class_id')
    .select('class_id')
    .count('id as count') as any;

  const enrollmentMap = new Map(enrollmentCounts.map((e) => [e.class_id, Number(e.count)]));

  // Fetch all KKTP documents for these classes
  const rawDocs = await db('documents')
    .whereIn('documents.class_id', classIds)
    .where('documents.type', 'KKTP')
    .select('documents.id', 'documents.class_id', 'documents.subject_id', 'documents.content') as any[];

  // Parsed KKTPs map: classId -> list of { studentId, subjectId, subjectName }
  const kktpsByClass = new Map<string, Array<{ studentId: string; subjectId: string | null; subjectName: string | null }>>();
  for (const doc of rawDocs) {
    const classId = doc.class_id;
    if (!classId) continue;
    const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
    const studentId = content?.identitas?.studentId;
    if (!studentId) continue;

    const subjectId = doc.subject_id || content?.identitas?.subjectId || null;
    const subjectName = content?.identitas?.mataPelajaran || null;

    if (!kktpsByClass.has(classId)) kktpsByClass.set(classId, []);
    kktpsByClass.get(classId)!.push({ studentId, subjectId, subjectName });
  }

  // Build summary for each class
  const result: KKTPClassCardItem[] = [];

  for (const cls of accessibleClasses) {
    const studentCount = enrollmentMap.get(cls.id) || 0;
    const subjects = await getSubjectsForClass(cls.id);
    const classKKTPs = kktpsByClass.get(cls.id) || [];

    const subjectSummaries: KKTPClassSubjectSummary[] = subjects.map((subj) => {
      // Count unique students who have KKTP for this subject
      const matchingStudents = new Set<string>();
      for (const k of classKKTPs) {
        const matchesSubject =
          (k.subjectId && k.subjectId === subj.id) ||
          (k.subjectName && k.subjectName.toLowerCase() === subj.name.toLowerCase());

        if (matchesSubject) {
          matchingStudents.add(k.studentId);
        }
      }

      return {
        subject_id: subj.id,
        subject_name: subj.name,
        subject_code: subj.code,
        created_count: matchingStudents.size,
        student_count: studentCount,
      };
    });

    result.push({
      class_id: cls.id,
      class_name: cls.name,
      class_code: cls.code,
      class_level: cls.level,
      student_count: studentCount,
      subjects: subjectSummaries,
      total_kktp_count: classKKTPs.length,
    });
  }

  return result;
}

/**
 * Level 2: Get Subjects for a specific class with KKTP created count.
 */
export async function getKKTPClassSubjects(
  classId: string,
  user: { id: string; role: string }
): Promise<{ class: { id: string; name: string; code: string; level: number }; subjects: KKTPClassSubjectSummary[]; student_count: number }> {
  // Authorization check
  const hasAccess = await verifyTeacherClassAccess(user.id, user.role, classId);
  if (!hasAccess) {
    throw new AppError('Anda tidak memiliki akses ke kelas ini.', 'ERR_FORBIDDEN', 403);
  }

  const classRecord = await db('classes')
    .where('id', classId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!classRecord) {
    throw new AppError('Kelas tidak ditemukan.', 'ERR_NOT_FOUND', 404);
  }

  // Student count
  const enrollmentCount = await db('student_enrollments')
    .where('class_id', classId)
    .where('status', 'active')
    .whereNot('lifecycle_status', 'soft_deleted')
    .count('id as total')
    .first();
  const studentCount = Number(enrollmentCount?.total || 0);

  // Subjects for class
  const subjects = await getSubjectsForClass(classId);

  // Documents for this class
  const classDocs = (await db('documents')
    .where('type', 'KKTP')
    .where('class_id', classId)
    .select('id', 'subject_id', 'content')) as any[];

  const parsedDocs = classDocs.map((d: any) => {
    const content = typeof d.content === 'string' ? JSON.parse(d.content) : d.content;
    return {
      id: d.id,
      studentId: content?.identitas?.studentId,
      subjectId: d.subject_id || content?.identitas?.subjectId,
      subjectName: content?.identitas?.mataPelajaran,
    };
  });

  const subjectSummaries: KKTPClassSubjectSummary[] = subjects.map((subj) => {
    const matchingStudents = new Set<string>();
    for (const doc of parsedDocs) {
      if (!doc.studentId) continue;
      const matches =
        (doc.subjectId && doc.subjectId === subj.id) ||
        (doc.subjectName && doc.subjectName.toLowerCase() === subj.name.toLowerCase());
      if (matches) {
        matchingStudents.add(doc.studentId);
      }
    }

    return {
      subject_id: subj.id,
      subject_name: subj.name,
      subject_code: subj.code,
      created_count: matchingStudents.size,
      student_count: studentCount,
    };
  });

  return {
    class: {
      id: classRecord.id,
      name: classRecord.name,
      code: classRecord.code,
      level: classRecord.level,
    },
    subjects: subjectSummaries,
    student_count: studentCount,
  };
}

/**
 * Level 3: Get Students for a specific Class × Subject with KKTP status.
 */
export async function getKKTPStudentsForClassSubject(
  classId: string,
  subjectIdOrName: string,
  user: { id: string; role: string }
): Promise<{
  class: { id: string; name: string; code: string; level: number };
  subject: { id: string; name: string; code: string };
  students: KKTPStudentItem[];
  total: number;
  created_count: number;
  not_created_count: number;
}> {
  // Authorization check
  const hasAccess = await verifyTeacherClassAccess(user.id, user.role, classId);
  if (!hasAccess) {
    throw new AppError('Anda tidak memiliki akses ke kelas ini.', 'ERR_FORBIDDEN', 403);
  }

  const classRecord = await db('classes')
    .where('id', classId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!classRecord) {
    throw new AppError('Kelas tidak ditemukan.', 'ERR_NOT_FOUND', 404);
  }

  // Resolve subject
  const subjects = await getSubjectsForClass(classId);
  const foundSubject = subjects.find(
    (s) => s.id === subjectIdOrName || s.name.toLowerCase() === subjectIdOrName.toLowerCase()
  ) || { id: subjectIdOrName, name: subjectIdOrName, code: subjectIdOrName };

  // Enrolled students in class
  const enrollments = await db('student_enrollments')
    .join('students', 'student_enrollments.student_id', 'students.id')
    .where('student_enrollments.class_id', classId)
    .where('student_enrollments.status', 'active')
    .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
    .orderBy('students.full_name', 'asc')
    .select(
      'students.id as student_id',
      'students.full_name as student_name',
      'students.nisn'
    );

  // Fetch KKTP documents for this class
  const kktpDocs = await db('documents')
    .where('documents.type', 'KKTP')
    .where('documents.class_id', classId)
    .orderBy('documents.updated_at', 'desc')
    .select(
      'documents.id',
      'documents.title',
      'documents.subject_id',
      'documents.updated_at',
      'documents.content'
    ) as any[];

  // Map: studentId -> KKTP document for THIS subject (Subject Isolation!)
  const docByStudent = new Map<string, any>();

  for (const doc of kktpDocs) {
    const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
    const studentId = content?.identitas?.studentId;
    if (!studentId) continue;

    const docSubjId = doc.subject_id || content?.identitas?.subjectId;
    const docSubjName = content?.identitas?.mataPelajaran;

    // Strict subject match!
    const matchesSubject =
      (docSubjId && (docSubjId === foundSubject.id || docSubjId === foundSubject.name)) ||
      (docSubjName && docSubjName.toLowerCase() === foundSubject.name.toLowerCase());

    if (matchesSubject && !docByStudent.has(studentId)) {
      docByStudent.set(studentId, { ...doc, content });
    }
  }

  // Build student list
  const students: KKTPStudentItem[] = enrollments.map((e: any) => {
    const doc = docByStudent.get(e.student_id) || null;
    const status = deriveKKTPStatusFromDoc(doc);
    const badge = getKKTPStatusBadge(status);

    return {
      student_id: e.student_id,
      student_name: e.student_name,
      nisn: e.nisn || null,
      status,
      status_label: badge.label,
      status_color: badge.colorClass,
      kktp_doc_id: doc?.id || null,
      kktp_doc_title: doc?.title || null,
      kktp_updated_at: doc?.updated_at || null,
    };
  });

  const createdCount = students.filter((s) => s.status === 'SUDAH_DIBUAT').length;
  const notCreatedCount = students.length - createdCount;

  return {
    class: {
      id: classRecord.id,
      name: classRecord.name,
      code: classRecord.code,
      level: classRecord.level,
    },
    subject: foundSubject,
    students,
    total: students.length,
    created_count: createdCount,
    not_created_count: notCreatedCount,
  };
}
