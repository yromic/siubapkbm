import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';

const STUDENT_FILES_DIR = path.join(process.cwd(), 'storage', 'uploads', 'student_files');

export function setupStudentFilesDirectory() {
  if (!fs.existsSync(STUDENT_FILES_DIR)) {
    fs.mkdirSync(STUDENT_FILES_DIR, { recursive: true });
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function uploadStudentFile(
  studentId: string,
  fileType: string,
  base64Content: string,
  originalFilename: string,
  uploadedBy: string
) {
  if (!studentId || !fileType || !base64Content || !originalFilename) {
    throw new AppError('student_id, file_type, file_content_base64, and original_filename are required.', 'ERR_VALIDATION', 400);
  }

  const VALID_FILE_TYPES = ['foto', 'pas_foto', 'kk', 'akta', 'dokumen_lain'];
  if (!VALID_FILE_TYPES.includes(fileType)) {
    throw new AppError('Invalid file type.', 'ERR_VALIDATION', 400);
  }

  const student = await db('students').where('id', studentId).whereNot('status', 'soft_deleted').first();
  if (!student) {
    throw new AppError('Student not found.', 'ERR_VALIDATION', 404);
  }

  setupStudentFilesDirectory();

  try {
    // Get current latest version for this student+fileType
    const existingLatest = await db('student_files')
      .where({ student_id: studentId, file_type: fileType })
      .whereNot('lifecycle_status', 'soft_deleted')
      .orderBy('version', 'desc')
      .first();

    const newVersion = existingLatest ? existingLatest.version + 1 : 1;

    const fileId = uuidv4();
    const ext = path.extname(originalFilename);
    const savedFilename = `${studentId}_${fileType}_v${newVersion}_${fileId}${ext}`;
    const filePath = path.join(STUDENT_FILES_DIR, savedFilename);

    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);

    const mimeType = getMimeType(originalFilename);
    const fileSize = buffer.length;

    const record = {
      id: fileId,
      student_id: studentId,
      file_type: fileType,
      file_path: filePath,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size: fileSize,
      version: newVersion,
      status: 'active',
      uploaded_by: uploadedBy,
      uploaded_at: new Date(),
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('student_files').insert(record);

    return record;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Error uploading student file',
      'ERR_DATABASE',
      500
    );
  }
}

export async function replaceStudentFile(
  fileId: string,
  base64Content: string,
  originalFilename: string,
  uploadedBy: string
) {
  const existing = await db('student_files')
    .where('id', fileId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!existing) {
    throw new AppError('File record not found.', 'ERR_VALIDATION', 404);
  }

  return uploadStudentFile(
    existing.student_id,
    existing.file_type,
    base64Content,
    originalFilename,
    uploadedBy
  );
}

export async function listStudentFiles(studentId: string) {
  if (!studentId) {
    throw new AppError('Student ID is required.', 'ERR_VALIDATION', 400);
  }

  return await db('student_files')
    .where('student_id', studentId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .orderBy('file_type', 'asc')
    .orderBy('version', 'desc');
}

export async function archiveStudentFile(fileId: string, actorId: string) {
  const existing = await db('student_files')
    .where('id', fileId)
    .first();

  if (!existing) {
    throw new AppError('File record not found.', 'ERR_VALIDATION', 404);
  }

  await db('student_files').where('id', fileId).update({
    lifecycle_status: 'archived',
    status: 'archived',
    deleted_at: new Date(),
    deleted_by: actorId,
    updated_at: new Date()
  });

  return { message: 'File archived successfully.', id: fileId };
}

export async function getStudentFileById(fileId: string) {
  const file = await db('student_files')
    .where('id', fileId)
    .whereNot('lifecycle_status', 'soft_deleted')
    .first();

  if (!file) {
    throw new AppError('File not found.', 'ERR_VALIDATION', 404);
  }

  if (!fs.existsSync(file.file_path)) {
    throw new AppError('File not found on disk.', 'ERR_NOT_FOUND', 404);
  }

  return file;
}

export async function setupStorageFolders() {
  const dirs = [
    path.join(process.cwd(), 'storage', 'uploads'),
    path.join(process.cwd(), 'storage', 'uploads', 'student_files'),
    path.join(process.cwd(), 'storage', 'templates'),
    path.join(process.cwd(), 'storage', 'reports'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return {
    message: 'Storage directories ensured.',
    directories: dirs
  };
}

/**
 * Mandatory document types that a student must have to be considered "complete".
 * Ownership: this array is the single source of truth.
 * Dashboard must never hardcode document type names.
 */
const MANDATORY_DOC_TYPES = ['kk', 'akta'] as const;

/**
 * Returns document completion statistics for all active students.
 * "Complete" = the student has at least one non-deleted file for each mandatory doc type.
 * Active student = status IN ('active', 'Aktif') AND lifecycle_status != 'soft_deleted'.
 * All counting is done in SQL — no JS-level row iteration.
 */
export async function getDocumentCompletionStats(): Promise<{
  total_active: number;
  with_mandatory_docs: number;
  completion_rate: number;
  pie_data: Array<{ name: string; value: number }>;
}> {
  try {
    // Count all active students
    const totalRes = await db('students')
      .whereIn('status', ['active', 'Aktif'])
      .whereNull('deleted_at')
      .count('id as count')
      .first();
    const totalActive = Number(totalRes?.count || 0);

    // Count students who have at least one non-deleted file for EACH mandatory type.
    // Strategy: subquery counts distinct mandatory file types per student,
    // then we filter for those who have all MANDATORY_DOC_TYPES.length types covered.
    const mandatoryCount = MANDATORY_DOC_TYPES.length;

    const withDocsRes = await db('students')
      .whereIn('status', ['active', 'Aktif'])
      .whereNull('students.deleted_at')
      .whereExists(function (this: any) {
        this.from('student_files')
          .whereRaw('student_files.student_id = students.id')
          .whereIn('student_files.file_type', MANDATORY_DOC_TYPES as unknown as string[])
          .whereNot('student_files.lifecycle_status', 'soft_deleted')
          .groupBy('student_files.student_id')
          .havingRaw('COUNT(DISTINCT student_files.file_type) >= ?', [mandatoryCount]);
      })
      .count('students.id as count')
      .first();
    const withDocs = Number(withDocsRes?.count || 0);

    const completionRate = totalActive > 0 ? Math.round((withDocs / totalActive) * 100) : 0;

    return {
      total_active: totalActive,
      with_mandatory_docs: withDocs,
      completion_rate: completionRate,
      pie_data: [
        { name: 'Lengkap', value: withDocs },
        { name: 'Belum Lengkap', value: totalActive - withDocs }
      ]
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error calculating document completion stats',
      'ERR_DATABASE',
      500
    );
  }
}
