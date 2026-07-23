import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import { validateNisn } from '@/lib/validation/student';
import { validateUserIdentifiers } from './userService';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { addJob } from './jobQueueService';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { assertNotLocked } from './assessmentService';

const UPLOADS_DIR = path.join(process.cwd(), 'storage', 'uploads');
const TEMPLATES_DIR = path.join(process.cwd(), 'storage', 'templates');

function ensureDirectories() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// ─── Date normalisation ───────────────────────────────────────────────────────
function normaliseDate(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().split('T')[0];
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// ─── Status / gender normalisation ───────────────────────────────────────────
function normaliseStatus(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'aktif' || s === 'active' || s === '1') return 'active';
  if (s === 'tidak aktif' || s === 'nonaktif' || s === 'inactive' || s === '0') return 'inactive';
  return s || 'active';
}

function normaliseGender(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'L' || s === 'P') return s;
  if (s === 'MALE' || s === 'LAKI-LAKI' || s === 'LAKI') return 'L';
  if (s === 'FEMALE' || s === 'PEREMPUAN') return 'P';
  return s;
}

// ─── CSV auto-detect delimiter ────────────────────────────────────────────────
function parseCsvWithAutoDelimiter(content: string): { fields: string[]; data: any[] } {
  const comma = Papa.parse(content, { header: true, skipEmptyLines: true, delimiter: ',' });
  if ((comma.meta.fields ?? []).length > 1) {
    return { fields: comma.meta.fields ?? [], data: comma.data as any[] };
  }
  const tab = Papa.parse(content, { header: true, skipEmptyLines: true, delimiter: '\t' });
  if ((tab.meta.fields ?? []).length > 1) {
    return { fields: tab.meta.fields ?? [], data: tab.data as any[] };
  }
  const semi = Papa.parse(content, { header: true, skipEmptyLines: true, delimiter: ';' });
  return { fields: semi.meta.fields ?? [], data: semi.data as any[] };
}

// ─── Type normalisation ──────────────────────────────────────────────────────
const IMPORT_TYPE_MAP: Record<string, string> = {
  students: 'student', student: 'student',
  teachers: 'teacher', teacher: 'teacher',
  classes: 'class', class: 'class',
  subjects: 'subject', subject: 'subject',
  class_subjects: 'class_subject', class_subject: 'class_subject',
  academic_scores: 'academic_score', academic_score: 'academic_score',
  culture_scores: 'culture_score', culture_score: 'culture_score',
  enrollments: 'enrollment', enrollment: 'enrollment',
};

function normaliseImportType(raw: string): string {
  const lower = raw.toLowerCase();
  return IMPORT_TYPE_MAP[lower] ?? lower;
}

// ─── Helper for active periods ────────────────────────────────────────────────
async function getActiveAcademicYearId(): Promise<string | null> {
  const year = await db('academic_years').where('is_active', 1).whereNot('lifecycle_status', 'soft_deleted').first();
  return year ? year.id : null;
}

async function getActiveSemesterId(): Promise<string | null> {
  const sem = await db('semesters').where('is_active', 1).whereNot('lifecycle_status', 'soft_deleted').first();
  return sem ? sem.id : null;
}

// ─── Core session creation (upload + parse + preview inline) ──────────────────
export interface ImportSessionResult {
  import_log_id: string;
  import_type: string;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  create_count: number;
  update_count: number;
  skip_count: number;
  error_count: number;
  warning_count: number;
  status: 'previewed' | 'failed';
  preview_rows: any[];
  errors: any[];
  error_report_file_id?: string;
}

export async function createImportSession(
  importType: string,
  fileName: string,
  base64Content: string,
  actorId: string
): Promise<ImportSessionResult> {
  if (!importType || !fileName || !base64Content) {
    throw new AppError('import_type, file_name, and file_content_base64 are required.', 'ERR_VALIDATION', 400);
  }

  ensureDirectories();

  const fileId = uuidv4();
  const uniqueFileName = `${fileId}-${fileName}`;
  const filePath = path.join(UPLOADS_DIR, uniqueFileName);
  const buffer = Buffer.from(base64Content, 'base64');
  fs.writeFileSync(filePath, buffer);

  const importLogId = uuidv4();
  await db('import_logs').insert({
    id: importLogId,
    import_type: importType,
    file_name: fileName,
    file_path: filePath,
    uploaded_by: actorId,
    total_rows: 0,
    success_rows: 0,
    error_rows: 0,
    status: 'previewed',
    lifecycle_status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  });

  const result = await parseAndValidate(importLogId, importType, filePath);

  await db('import_logs').where('id', importLogId).update({
    total_rows: result.total_rows,
    error_rows: result.error_count,
    status: result.error_count === result.total_rows && result.total_rows > 0 ? 'failed' : 'previewed',
    updated_at: new Date(),
  });

  return result;
}

// ─── Parse + validate (shared by preview and confirm) ────────────────────────
export async function parseAndValidate(
  importLogId: string,
  importType: string,
  filePath: string
): Promise<ImportSessionResult> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).replace(/^[^-]+-/, '');

  let rows: any[] = [];
  let columns: string[] = [];

  if (ext === '.csv') {
    const fileContent = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const { fields, data } = parseCsvWithAutoDelimiter(fileContent);
    columns = fields;
    rows = data;
  } else if (ext === '.xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => { columns.push(String(cell.text ?? '').trim()); });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: any = {};
      columns.forEach((col, index) => { rowData[col] = row.getCell(index + 1).value; });
      rows.push(rowData);
    });
  } else {
    throw new AppError('Unsupported file format. Only CSV and XLSX are supported.', 'ERR_VALIDATION', 400);
  }

  const normType = normaliseImportType(importType);

  switch (normType) {
    case 'student':
      return validateStudentRows(importLogId, fileName, rows, columns);
    case 'teacher':
      return validateTeacherRows(importLogId, fileName, rows, columns);
    case 'class':
      return validateClassRows(importLogId, fileName, rows, columns);
    case 'subject':
      return validateSubjectRows(importLogId, fileName, rows, columns);
    case 'class_subject':
      return validateClassSubjectRows(importLogId, fileName, rows, columns);
    case 'academic_score':
      return validateAcademicScoreRows(importLogId, fileName, rows, columns);
    case 'culture_score':
      return validateCultureScoreRows(importLogId, fileName, rows, columns);
    case 'enrollment':
      return validateEnrollmentRows(importLogId, fileName, rows, columns);
    default:
      throw new AppError(`Unsupported import type: ${importType}`, 'ERR_VALIDATION', 400);
  }
}

// ─── Helpers to build result rows ────────────────────────────────────────────

interface RowValidationContext {
  rowErrors: any[];
  rowWarnings: any[];
}

function makeRowPayload(
  rowNum: number,
  operation: 'create' | 'update' | 'error',
  identifier: string,
  displayName: string,
  ctx: RowValidationContext
) {
  return {
    row_number: rowNum,
    operation,
    status: ctx.rowErrors.length > 0 ? 'invalid' : ctx.rowWarnings.length > 0 ? 'warning' : 'valid' as const,
    identifier: identifier || `row-${rowNum}`,
    display_name: displayName || `Baris ${rowNum}`,
    changes: [],
    warnings: ctx.rowWarnings,
    errors: ctx.rowErrors,
  };
}

// ============================================================================
//  STUDENT ROWS
// ============================================================================
async function validateStudentRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['nisn', 'full_name', 'birth_date', 'gender'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0, updateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const nisn = String(r.nisn ?? '').trim();
    const nisnError = validateNisn(nisn);
    if (nisnError) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: `${nisnError} (diterima: "${nisn}")`, severity: 'error' });
    }

    const fullName = String(r.full_name ?? '').trim();
    if (!fullName) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'full_name', message: 'Nama lengkap wajib diisi', severity: 'error' });
    }

    const normDate = normaliseDate(r.birth_date);
    if (!normDate) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'birth_date', message: `Format tanggal tidak valid (${r.birth_date})`, severity: 'error' });
    } else {
      r.birth_date = normDate;
    }

    const gender = normaliseGender(r.gender);
    if (!['L', 'P'].includes(gender)) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'gender', message: `Jenis kelamin tidak valid (diterima: "${r.gender}")`, severity: 'error' });
    } else {
      r.gender = gender;
    }

    r.status = r.status ? normaliseStatus(r.status) : 'active';

    let operation: 'create' | 'update' | 'error' = 'create';
    if (nisn && nisn.length === 10 && !isNaN(Number(nisn))) {
      const existing = await db('students').where('nisn', nisn).first();
      if (existing) {
        operation = 'update';
        ctx.rowWarnings.push({
          row_number: rowNum, field: 'nisn',
          message: `Siswa NISN ${nisn} sudah ada — akan diperbarui`, severity: 'warning',
        });
      }
    }

    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      if (operation === 'create') createCount++;
      else updateCount++;
    }

    previewRows.push(makeRowPayload(rowNum, operation, nisn, fullName, ctx));
  }

  return {
    import_log_id: importLogId, import_type: 'students', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: updateCount, skip_count: 0,
    error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  ENROLLMENT ROWS
// ============================================================================
async function validateEnrollmentRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['nisn', 'class_code'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const activeYearId = await getActiveAcademicYearId();
  const activeSemId = await getActiveSemesterId();
  if (!activeYearId || !activeSemId) {
    throw new AppError('Tahun ajaran atau semester aktif tidak ditemukan.', 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const nisn = String(r.nisn ?? '').trim();
    const classCode = String(r.class_code ?? '').trim();

    if (!nisn) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: 'NISN wajib diisi', severity: 'error' });
    }
    if (!classCode) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'class_code', message: 'Kode kelas wajib diisi', severity: 'error' });
    }

    let studentId = '';
    let studentName = '';
    let classId = '';
    let className = '';

    if (nisn) {
      const student = await db('students').where('nisn', nisn).whereNot('status', 'soft_deleted').first();
      if (!student) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: `Siswa dengan NISN "${nisn}" tidak ditemukan`, severity: 'error' });
      } else {
        studentId = student.id;
        studentName = student.full_name;
      }
    }

    if (classCode) {
      const classItem = await db('classes').where('code', classCode).whereNot('lifecycle_status', 'soft_deleted').first();
      if (!classItem) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'class_code', message: `Kelas dengan kode "${classCode}" tidak ditemukan`, severity: 'error' });
      } else {
        classId = classItem.id;
        className = classItem.name;
      }
    }

    if (studentId && classId) {
      const existingActive = await db('student_enrollments')
        .where({
          student_id: studentId,
          semester_id: activeSemId,
          status: 'active'
        })
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();

      if (existingActive) {
        ctx.rowWarnings.push({
          row_number: rowNum,
          field: 'nisn',
          message: `Siswa sudah terdaftar aktif di semester ini (Kelas ID: ${existingActive.class_id})`,
          severity: 'warning'
        });
      }
    }

    let operation: 'create' | 'update' | 'error' = 'create';
    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      createCount++;
    }

    r.student_id = studentId;
    r.class_id = classId;
    r.academic_year_id = activeYearId;
    r.semester_id = activeSemId;

    previewRows.push(makeRowPayload(
      rowNum,
      operation,
      nisn,
      studentName ? `${studentName} -> ${className || classCode}` : `Baris ${rowNum}`,
      ctx
    ));
  }

  return {
    import_log_id: importLogId, import_type: 'enrollment', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: 0, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  TEACHER ROWS
// ============================================================================
async function validateTeacherRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['full_name', 'email'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const fullName = String(r.full_name ?? '').trim();
    if (!fullName) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'full_name', message: 'Nama lengkap wajib diisi', severity: 'error' });
    }

    const email = String(r.email ?? '').trim().toLowerCase();
    if (!email) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'email', message: 'Email wajib diisi', severity: 'error' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'email', message: `Format email tidak valid`, severity: 'error' });
    } else {
      try {
        await validateUserIdentifiers(email);
      } catch (err) {
        if (err instanceof AppError) {
          ctx.rowErrors.push({ row_number: rowNum, field: 'email', message: err.message, severity: 'error' });
        } else {
          ctx.rowErrors.push({ row_number: rowNum, field: 'email', message: 'Gagal memvalidasi email', severity: 'error' });
        }
      }
    }

    if (r.gender) {
      const gender = normaliseGender(r.gender);
      if (!['L', 'P'].includes(gender)) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'gender', message: `Jenis kelamin tidak valid`, severity: 'error' });
      } else {
        r.gender = gender;
      }
    } else {
      r.gender = null;
    }

    r.status = r.status ? normaliseStatus(r.status) : 'active';
    r.phone = String(r.phone ?? '').trim() || null;

    if (ctx.rowErrors.length > 0) {
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      createCount++;
    }

    const tempPassword = crypto.createHash('sha256').update(`${importLogId}-${rowNum}`).digest('base64').replace(/[+/=]/g, '').slice(0, 8);
    const rowPayload = makeRowPayload(rowNum, ctx.rowErrors.length > 0 ? 'error' : 'create', email, fullName, ctx);
    if (ctx.rowErrors.length === 0) {
      (rowPayload as any).temp_password = tempPassword;
    }
    previewRows.push(rowPayload);
  }

  return {
    import_log_id: importLogId, import_type: 'teachers', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: 0, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  CLASS ROWS
// ============================================================================
async function validateClassRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['code', 'name', 'level'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0, updateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const code = String(r.code ?? '').trim();
    if (!code) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'code', message: 'Kode kelas wajib diisi', severity: 'error' });
    }

    const name = String(r.name ?? '').trim();
    if (!name) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'name', message: 'Nama kelas wajib diisi', severity: 'error' });
    }

    const level = parseInt(String(r.level ?? '').trim(), 10);
    if (isNaN(level) || level < 1) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'level', message: `Level harus angka positif`, severity: 'error' });
    }

    r.status = r.status ? normaliseStatus(r.status) : 'active';

    let operation: 'create' | 'update' | 'error' = 'create';
    if (code) {
      const existing = await db('classes').where('code', code).first();
      if (existing) {
        operation = 'update';
        ctx.rowWarnings.push({ row_number: rowNum, field: 'code', message: `Kelas ${code} sudah ada — akan diperbarui`, severity: 'warning' });
      }
    }

    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      if (operation === 'create') createCount++;
      else updateCount++;
    }

    previewRows.push(makeRowPayload(rowNum, operation, code, name, ctx));
  }

  return {
    import_log_id: importLogId, import_type: 'classes', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: updateCount, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  SUBJECT ROWS
// ============================================================================
async function validateSubjectRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['code', 'name'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0, updateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const code = String(r.code ?? '').trim();
    if (!code) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'code', message: 'Kode mata pelajaran wajib diisi', severity: 'error' });
    }

    const name = String(r.name ?? '').trim();
    if (!name) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'name', message: 'Nama mata pelajaran wajib diisi', severity: 'error' });
    }

    const description = String(r.description ?? '').trim() || null;
    r.status = r.status ? normaliseStatus(r.status) : 'active';

    let operation: 'create' | 'update' | 'error' = 'create';
    if (code) {
      const existing = await db('subjects').where('code', code).first();
      if (existing) {
        operation = 'update';
        ctx.rowWarnings.push({ row_number: rowNum, field: 'code', message: `Mata pelajaran ${code} sudah ada — akan diperbarui`, severity: 'warning' });
      }
    }

    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      if (operation === 'create') createCount++;
      else updateCount++;
    }

    previewRows.push(makeRowPayload(rowNum, operation, code, name, ctx));
  }

  return {
    import_log_id: importLogId, import_type: 'subjects', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: updateCount, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  CLASS SUBJECT ROWS
// ============================================================================
async function validateClassSubjectRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['class_code', 'subject_code', 'academic_year', 'semester'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0, updateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const classCode = String(r.class_code ?? '').trim();
    let classId: string | null = null;
    if (!classCode) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'class_code', message: 'Kode kelas wajib diisi', severity: 'error' });
    } else {
      const classRow = await db('classes').where('code', classCode).first();
      if (!classRow) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'class_code', message: `Kelas "${classCode}" tidak ditemukan`, severity: 'error' });
      } else {
        classId = classRow.id;
      }
    }

    const subjectCode = String(r.subject_code ?? '').trim();
    let subjectId: string | null = null;
    if (!subjectCode) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'subject_code', message: 'Kode mata pelajaran wajib diisi', severity: 'error' });
    } else {
      const subjectRow = await db('subjects').where('code', subjectCode).first();
      if (!subjectRow) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'subject_code', message: `Mata pelajaran "${subjectCode}" tidak ditemukan`, severity: 'error' });
      } else {
        subjectId = subjectRow.id;
      }
    }

    const academicYearName = String(r.academic_year ?? '').trim();
    let academicYearId: string | null = null;
    if (!academicYearName) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'academic_year', message: 'Tahun ajaran wajib diisi', severity: 'error' });
    } else {
      const yearRow = await db('academic_years').where('name', academicYearName).first();
      if (!yearRow) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'academic_year', message: `Tahun ajaran "${academicYearName}" tidak ditemukan`, severity: 'error' });
      } else {
        academicYearId = yearRow.id;
      }
    }

    const semesterName = String(r.semester ?? '').trim();
    let semesterId: string | null = null;
    if (!semesterName) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'semester', message: 'Semester wajib diisi', severity: 'error' });
    } else {
      const semRow = await db('semesters').where('name', semesterName).first();
      if (!semRow) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'semester', message: `Semester "${semesterName}" tidak ditemukan`, severity: 'error' });
      } else {
        semesterId = semRow.id;
      }
    }

    r.status = r.status ? normaliseStatus(r.status) : 'active';

    let operation: 'create' | 'update' | 'error' = 'create';
    if (classId && subjectId && academicYearId && semesterId) {
      const existing = await db('class_subjects')
        .where('class_id', classId)
        .where('subject_id', subjectId)
        .where('academic_year_id', academicYearId)
        .where('semester_id', semesterId)
        .first();
      if (existing) {
        operation = 'update';
        ctx.rowWarnings.push({
          row_number: rowNum, field: 'class_code',
          message: `Mapping sudah ada — akan diperbarui`, severity: 'warning',
        });
      }
    }

    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      if (operation === 'create') createCount++;
      else updateCount++;
    }

    const displayName = `${classCode} - ${subjectCode}`;
    previewRows.push(makeRowPayload(rowNum, operation, `${classCode}|${subjectCode}`, displayName, ctx));
  }

  return {
    import_log_id: importLogId, import_type: 'class_subjects', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: updateCount, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  ACADEMIC SCORE ROWS
// ============================================================================
async function validateAcademicScoreRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['assessment_id', 'nisn', 'score'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0, updateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const assessmentId = String(r.assessment_id ?? '').trim();
    let assessment: any = null;
    if (!assessmentId) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'assessment_id', message: 'ID asesmen wajib diisi', severity: 'error' });
    } else {
      assessment = await db('academic_assessments')
        .where('id', assessmentId)
        .whereNot('lifecycle_status', 'soft_deleted')
        .first();
      if (!assessment) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'assessment_id', message: `Asesmen "${assessmentId}" tidak ditemukan`, severity: 'error' });
      } else {
        try {
          await assertNotLocked(assessmentId);
        } catch (lockErr) {
          ctx.rowErrors.push({
            row_number: rowNum, field: 'assessment_id',
            message: lockErr instanceof Error ? lockErr.message : `Asesmen terkunci`,
            severity: 'error',
          });
        }
      }
    }

    const nisn = String(r.nisn ?? '').trim();
    let studentId: string | null = null;
    let studentName: string | null = null;
    if (!nisn) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: 'NISN wajib diisi', severity: 'error' });
    } else {
      const student = await db('students').where('nisn', nisn).whereNot('status', 'soft_deleted').first();
      if (!student) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: `Siswa NISN "${nisn}" tidak ditemukan`, severity: 'error' });
      } else {
        studentId = student.id;
        studentName = student.full_name;
      }
    }

    const scoreRaw = String(r.score ?? '').trim();
    const score = parseFloat(scoreRaw);
    if (!scoreRaw || isNaN(score)) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'score', message: `Nilai harus angka`, severity: 'error' });
    } else {
      if (assessment && (score < Number(assessment.score_min) || score > Number(assessment.score_max))) {
        ctx.rowErrors.push({
          row_number: rowNum, field: 'score',
          message: `Nilai di luar rentang ${assessment.score_min}-${assessment.score_max}`,
          severity: 'error',
        });
      }
      r.score = score;
    }

    let operation: 'create' | 'update' | 'error' = 'create';
    if (assessmentId && studentId) {
      const existing = await db('academic_scores')
        .where('assessment_id', assessmentId)
        .where('student_id', studentId)
        .first();
      if (existing) {
        operation = 'update';
        ctx.rowWarnings.push({
          row_number: rowNum, field: 'nisn',
          message: `Nilai sudah ada — akan diperbarui`, severity: 'warning',
        });
      }
    }

    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      if (operation === 'create') createCount++;
      else updateCount++;
    }

    previewRows.push(makeRowPayload(rowNum, operation, `${nisn}@${assessmentId}`, studentName || nisn, ctx));
  }

  return {
    import_log_id: importLogId, import_type: 'academic_scores', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: updateCount, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

// ============================================================================
//  CULTURE SCORE ROWS
// ============================================================================
async function validateCultureScoreRows(
  importLogId: string, fileName: string, rows: any[], columns: string[]
): Promise<ImportSessionResult> {
  const REQUIRED = ['nisn', 'score_date', 'sss_score', 'am_score', 'hb_score', 'asm_score', 'br_score', 'ak_score', 'tm_score'];
  const missing = REQUIRED.filter(col => !columns.includes(col));
  if (missing.length > 0) {
    throw new AppError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'ERR_VALIDATION', 400);
  }

  const activeYearId = await getActiveAcademicYearId();
  const activeSemesterId = await getActiveSemesterId();

  const previewRows: any[] = [];
  const topLevelErrors: any[] = [];
  let validCount = 0, errorCount = 0, createCount = 0, updateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const r = rows[i];
    const ctx: RowValidationContext = { rowErrors: [], rowWarnings: [] };

    const nisn = String(r.nisn ?? '').trim();
    let studentId: string | null = null;
    let studentName: string | null = null;
    if (!nisn) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: 'NISN wajib diisi', severity: 'error' });
    } else {
      const student = await db('students').where('nisn', nisn).first();
      if (!student) {
        ctx.rowErrors.push({ row_number: rowNum, field: 'nisn', message: `Siswa "${nisn}" tidak ditemukan`, severity: 'error' });
      } else {
        studentId = student.id;
        studentName = student.full_name;
      }
    }

    const normDate = normaliseDate(r.score_date);
    if (!normDate) {
      ctx.rowErrors.push({ row_number: rowNum, field: 'score_date', message: `Format tanggal tidak valid`, severity: 'error' });
    } else {
      r.score_date = normDate;
    }

    const scoreFields = ['sss_score', 'am_score', 'hb_score', 'asm_score', 'br_score', 'ak_score', 'tm_score'];
    for (const sf of scoreFields) {
      const rawVal = String(r[sf] ?? '').trim();
      const numVal = parseFloat(rawVal);
      if (!rawVal || isNaN(numVal) || numVal < 0 || numVal > 100) {
        ctx.rowErrors.push({
          row_number: rowNum, field: sf,
          message: `Nilai harus 0-100`, severity: 'error',
        });
      } else {
        r[sf] = numVal;
      }
    }

    let operation: 'create' | 'update' | 'error' = 'create';
    if (studentId && normDate) {
      const existing = await db('culture_scores')
        .where('student_id', studentId)
        .where('score_date', normDate)
        .first();
      if (existing) {
        operation = 'update';
        ctx.rowWarnings.push({
          row_number: rowNum, field: 'nisn',
          message: `Skor budaya sudah ada — akan diperbarui`, severity: 'warning',
        });
      }
    }

    if (ctx.rowErrors.length > 0) {
      operation = 'error';
      errorCount++;
      topLevelErrors.push(...ctx.rowErrors);
    } else {
      validCount++;
      if (operation === 'create') createCount++;
      else updateCount++;
    }

    previewRows.push(makeRowPayload(rowNum, operation, `${nisn}@${normDate}`, studentName || nisn, ctx));
  }

  return {
    import_log_id: importLogId, import_type: 'culture_scores', file_name: fileName,
    total_rows: rows.length, valid_rows: validCount, invalid_rows: errorCount,
    create_count: createCount, update_count: updateCount, skip_count: 0, error_count: errorCount,
    warning_count: previewRows.filter(r => r.status === 'warning').length,
    status: rows.length > 0 && validCount === 0 ? 'failed' : 'previewed',
    preview_rows: previewRows, errors: topLevelErrors,
  };
}

export async function uploadImportFile(importType: string, fileName: string, base64Content: string, actorId: string) {
  return createImportSession(importType, fileName, base64Content, actorId);
}

// ============================================================================
//  CONFIRM (EXECUTE) IMPORT
// ============================================================================
export async function confirmImportSession(
  importLogId: string,
  actorId?: string
): Promise<{
  import_log_id: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  imported_rows: number;
  imported_ids: string[];
  processed_rows: Array<{ row_number: number; entity_id: string; action: string }>;
  errors: any[];
  status: 'success' | 'partial_success' | 'failed';
}> {
  const log = await db('import_logs').where('id', importLogId).first();
  if (!log) throw new AppError('Import log not found.', 'ERR_VALIDATION', 404);

  const filePath = log.file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new AppError('Import file not found on disk.', 'ERR_VALIDATION', 404);
  }

  const validated = await parseAndValidate(importLogId, log.import_type, filePath);
  const normType = normaliseImportType(log.import_type);

  const importedIds: string[] = [];
  const processedRows: Array<{ row_number: number; entity_id: string; action: string }> = [];
  const confirmErrors: any[] = [];
  let successCount = 0;
  let errorCount = 0;

  const rows = await getRawRows(filePath, log.import_type);

  if (normType === 'student') {
    const result = await confirmStudentRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'teacher') {
    const result = await confirmTeacherRows(importLogId, rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'class') {
    const result = await confirmClassRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'subject') {
    const result = await confirmSubjectRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'class_subject') {
    const result = await confirmClassSubjectRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'academic_score') {
    const result = await confirmAcademicScoreRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'culture_score') {
    const result = await confirmCultureScoreRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows, actorId);
    successCount = result.successCount;
    errorCount = result.errorCount;
  } else if (normType === 'enrollment') {
    const result = await confirmEnrollmentRows(rows, validated.preview_rows, confirmErrors, successCount, errorCount, importedIds, processedRows);
    successCount = result.successCount;
    errorCount = result.errorCount;
  }

  const finalStatus: 'success' | 'partial_success' | 'failed' =
    successCount === 0 ? 'failed' : errorCount > 0 ? 'partial_success' : 'success';

  await db('import_logs').where('id', importLogId).update({
    total_rows: validated.total_rows,
    success_rows: successCount,
    error_rows: errorCount,
    status: finalStatus === 'success' ? 'success' : finalStatus === 'partial_success' ? 'partial_success' : 'failed',
    updated_at: new Date(),
  });

  return {
    import_log_id: importLogId,
    total_rows: validated.total_rows,
    success_rows: successCount,
    error_rows: errorCount,
    imported_rows: successCount,
    imported_ids: importedIds,
    processed_rows: processedRows,
    errors: confirmErrors,
    status: finalStatus,
  };
}

// ─── Confirm helpers ────────────────────────────────────────────────────────

interface ConfirmResult {
  successCount: number;
  errorCount: number;
}

async function confirmStudentRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const nisn = String(rawRow.nisn ?? '').trim();
        const fullName = String(rawRow.full_name ?? '').trim();
        const birthDate = normaliseDate(rawRow.birth_date) ?? '';
        const gender = normaliseGender(rawRow.gender);
        const status = normaliseStatus(rawRow.status);
        const pin = nisn.slice(-6) || '123456';
        const pinHash = await bcrypt.hash(pin, 10);

        if (previewRow.operation === 'update') {
          const existing = await trx('students').where('nisn', nisn).first();
          if (existing) {
            await trx('students').where('id', existing.id).update({
              full_name: fullName, birth_date: birthDate, gender, status,
              updated_at: new Date(),
            });
            importedIds.push(existing.id);
            processedRows.push({ row_number: previewRow.row_number, entity_id: existing.id, action: 'update' });
            successCount++;
          }
        } else {
          const studentId = uuidv4();
          await trx('students').insert({
            id: studentId, nisn, full_name: fullName, birth_date: birthDate, gender, status,
            parent_access_pin_hash: pinHash, parent_access_pin_failed_attempts: 0,
            created_at: new Date(), updated_at: new Date(),
          });
          importedIds.push(studentId);
          processedRows.push({ row_number: previewRow.row_number, entity_id: studentId, action: 'create' });
          successCount++;
        }
      } catch (err) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

async function confirmEnrollmentRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  const { bulkEnrollment } = require('./enrollmentService');

  for (const previewRow of previewRows) {
    if (previewRow.operation === 'error') {
      errorCount++;
      confirmErrors.push(...(previewRow.errors ?? []));
      continue;
    }

    const rawRow = rows[previewRow.row_number - 2];
    if (!rawRow) { errorCount++; continue; }

    try {
      const result = await bulkEnrollment({
        student_ids: [rawRow.student_id],
        class_id: rawRow.class_id,
        academic_year_id: rawRow.academic_year_id,
        semester_id: rawRow.semester_id
      });

      if (result.enrolled && result.enrolled.length > 0) {
        successCount++;
        importedIds.push(result.enrolled[0].enrollment_id);
        processedRows.push({
          row_number: previewRow.row_number,
          entity_id: result.enrolled[0].enrollment_id,
          action: 'create'
        });
      } else if (result.skipped && result.skipped.length > 0) {
        // Skipped/already active is handled as processed (no crash) but logged as skip
        successCount++;
        processedRows.push({
          row_number: previewRow.row_number,
          entity_id: 'skipped',
          action: 'skip'
        });
      } else if (result.failed && result.failed.length > 0) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: result.failed[0].reason,
          severity: 'error'
        });
      }
    } catch (err) {
      errorCount++;
      confirmErrors.push({
        row_number: previewRow.row_number,
        message: err instanceof Error ? err.message : 'Database error',
        severity: 'error',
      });
    }
  }
  return { successCount, errorCount };
}

async function confirmTeacherRows(
  importLogId: string,
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const fullName = String(rawRow.full_name ?? '').trim();
        const email = String(rawRow.email ?? '').trim().toLowerCase();
        const username = String(rawRow.username ?? '').trim() || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        const phone = String(rawRow.phone ?? '').trim() || null;
        const gender = rawRow.gender ? normaliseGender(rawRow.gender) : null;
        const status = rawRow.status ? normaliseStatus(rawRow.status) : 'active';

        const tempPassword = crypto.createHash('sha256').update(`${importLogId}-${previewRow.row_number}`).digest('base64').replace(/[+/=]/g, '').slice(0, 8);
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const userId = uuidv4();
        const profileId = uuidv4();

        await trx('users').insert({
          id: userId, name: fullName, email, username, password_hash: passwordHash,
          role: 'teacher', phone, status, failed_login_attempts: 0,
          lifecycle_status: 'active', created_at: new Date(), updated_at: new Date(),
        });

        await trx('teacher_profiles').insert({
          id: profileId, user_id: userId, full_name: fullName, gender: gender || 'L', phone, status,
          lifecycle_status: 'active', created_at: new Date(), updated_at: new Date(),
        });

        importedIds.push(userId);
        processedRows.push({ row_number: previewRow.row_number, entity_id: userId, action: 'create' });
        successCount++;
      } catch (err) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

async function confirmClassRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const code = String(rawRow.code ?? '').trim();
        const name = String(rawRow.name ?? '').trim();
        const level = parseInt(String(rawRow.level ?? '').trim(), 10);
        const status = rawRow.status ? normaliseStatus(rawRow.status) : 'active';

        if (previewRow.operation === 'update') {
          const existing = await trx('classes').where('code', code).first();
          if (existing) {
            await trx('classes').where('id', existing.id).update({
              name, level, status, updated_at: new Date(),
            });
            importedIds.push(existing.id);
            processedRows.push({ row_number: previewRow.row_number, entity_id: existing.id, action: 'update' });
            successCount++;
          }
        } else {
          const classId = uuidv4();
          await trx('classes').insert({
            id: classId, code, name, level, status,
            lifecycle_status: 'active', created_at: new Date(), updated_at: new Date(),
          });
          importedIds.push(classId);
          processedRows.push({ row_number: previewRow.row_number, entity_id: classId, action: 'create' });
          successCount++;
        }
      } catch (err) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

async function confirmSubjectRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const code = String(rawRow.code ?? '').trim();
        const name = String(rawRow.name ?? '').trim();
        const description = String(rawRow.description ?? '').trim() || null;
        const status = rawRow.status ? normaliseStatus(rawRow.status) : 'active';

        if (previewRow.operation === 'update') {
          const existing = await trx('subjects').where('code', code).first();
          if (existing) {
            await trx('subjects').where('id', existing.id).update({
              name, description, status, updated_at: new Date(),
            });
            importedIds.push(existing.id);
            processedRows.push({ row_number: previewRow.row_number, entity_id: existing.id, action: 'update' });
            successCount++;
          }
        } else {
          const subjectId = uuidv4();
          await trx('subjects').insert({
            id: subjectId, code, name, description, status,
            lifecycle_status: 'active', created_at: new Date(), updated_at: new Date(),
          });
          importedIds.push(subjectId);
          processedRows.push({ row_number: previewRow.row_number, entity_id: subjectId, action: 'create' });
          successCount++;
        }
      } catch (err) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

async function confirmClassSubjectRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const classCode = String(rawRow.class_code ?? '').trim();
        const classRow = await trx('classes').where('code', classCode).first();
        const classId = classRow?.id;

        const subjectCode = String(rawRow.subject_code ?? '').trim();
        const subjectRow = await trx('subjects').where('code', subjectCode).first();
        const subjectId = subjectRow?.id;

        const academicYearName = String(rawRow.academic_year ?? '').trim();
        const yearRow = await trx('academic_years').where('name', academicYearName).first();
        const academicYearId = yearRow?.id;

        const semesterName = String(rawRow.semester ?? '').trim();
        const semRow = await trx('semesters').where('name', semesterName).first();
        const semesterId = semRow?.id;

        const status = rawRow.status ? normaliseStatus(rawRow.status) : 'active';

        if (previewRow.operation === 'update' && classId && subjectId && academicYearId && semesterId) {
          const existing = await trx('class_subjects')
            .where('class_id', classId)
            .where('subject_id', subjectId)
            .where('academic_year_id', academicYearId)
            .where('semester_id', semesterId)
            .first();
          if (existing) {
            await trx('class_subjects').where('id', existing.id).update({
              status, updated_at: new Date(),
            });
            importedIds.push(existing.id);
            processedRows.push({ row_number: previewRow.row_number, entity_id: existing.id, action: 'update' });
            successCount++;
          }
        } else if (classId && subjectId && academicYearId && semesterId) {
          const classSubjectId = uuidv4();
          await trx('class_subjects').insert({
            id: classSubjectId, class_id: classId, subject_id: subjectId,
            academic_year_id: academicYearId, semester_id: semesterId, status,
            lifecycle_status: 'active', created_at: new Date(), updated_at: new Date(),
          });
          importedIds.push(classSubjectId);
          processedRows.push({ row_number: previewRow.row_number, entity_id: classSubjectId, action: 'create' });
          successCount++;
        } else {
          throw new Error('Cannot resolve IDs');
        }
      } catch (err) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

async function confirmAcademicScoreRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const assessmentId = String(rawRow.assessment_id ?? '').trim();
        const nisn = String(rawRow.nisn ?? '').trim();
        const score = parseFloat(String(rawRow.score ?? '').trim());
        const note = String(rawRow.note ?? '').trim() || null;

        const student = await trx('students').where('nisn', nisn).first();
        if (!student) throw new Error(`Siswa ${nisn} tidak ditemukan`);
        const studentId = student.id;

        const enrollment = await trx('student_enrollments').where('student_id', studentId).first();
        if (!enrollment) throw new Error(`Enrollment untuk siswa ${nisn} tidak ditemukan`);
        const enrollmentId = enrollment.id;

        if (previewRow.operation === 'update') {
          const existing = await trx('academic_scores')
            .where('assessment_id', assessmentId)
            .where('student_id', studentId)
            .first();
          if (existing) {
            await trx('academic_scores').where('id', existing.id).update({
              score, note, updated_at: new Date(),
            });
            importedIds.push(existing.id);
            processedRows.push({ row_number: previewRow.row_number, entity_id: existing.id, action: 'update' });
            successCount++;
          }
        } else {
          const scoreId = uuidv4();
          await trx('academic_scores').insert({
            id: scoreId, assessment_id: assessmentId, student_id: studentId,
            student_enrollment_id: enrollmentId, score, note, status: 'active',
            lifecycle_status: 'active', created_at: new Date(), updated_at: new Date(),
          });
          importedIds.push(scoreId);
          processedRows.push({ row_number: previewRow.row_number, entity_id: scoreId, action: 'create' });
          successCount++;
        }
      } catch (err) {
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

async function confirmCultureScoreRows(
  rows: any[],
  previewRows: any[],
  confirmErrors: any[],
  successCount: number,
  errorCount: number,
  importedIds: string[],
  processedRows: Array<{ row_number: number; entity_id: string; action: string }>,
  actorId?: string
): Promise<ConfirmResult> {
  await db.transaction(async (trx: any) => {
    for (const previewRow of previewRows) {
      if (previewRow.operation === 'error') {
        errorCount++;
        confirmErrors.push(...(previewRow.errors ?? []));
        continue;
      }

      const rawRow = rows[previewRow.row_number - 2];
      if (!rawRow) { errorCount++; continue; }

      try {
        const nisn = String(rawRow.nisn ?? '').trim();
        const scoreDate = normaliseDate(rawRow.score_date);

        const student = await trx('students').where('nisn', nisn).first();
        if (!student) throw new Error(`Siswa ${nisn} tidak ditemukan`);
        const studentId = student.id;

        const activeYear = await trx('academic_years').where('is_active', 1).first();
        const activeSem = await trx('semesters').where('is_active', 1).first();
        if (!activeYear || !activeSem) throw new Error('Tahun ajaran atau semester aktif tidak ditemukan');

        const enrollment = await trx('student_enrollments')
          .where('student_id', studentId)
          .where('academic_year_id', activeYear.id)
          .where('semester_id', activeSem.id)
          .first();
        if (!enrollment) throw new Error(`Enrollment tidak ditemukan`);

        const classId = enrollment.class_id;
        const enrollmentId = enrollment.id;

        const scoreData = {
          sss_score: parseFloat(String(rawRow.sss_score ?? 0).trim()),
          am_score: parseFloat(String(rawRow.am_score ?? 0).trim()),
          hb_score: parseFloat(String(rawRow.hb_score ?? 0).trim()),
          asm_score: parseFloat(String(rawRow.asm_score ?? 0).trim()),
          br_score: parseFloat(String(rawRow.br_score ?? 0).trim()),
          ak_score: parseFloat(String(rawRow.ak_score ?? 0).trim()),
          tm_score: parseFloat(String(rawRow.tm_score ?? 0).trim()),
        };                                                                                                                                                                                                                      

        if (previewRow.operation === 'update') {
          const existing = await trx('culture_scores')
            .where('student_id', studentId)
            .where('score_date', scoreDate)
            .first();
          if (existing) {
            await trx('culture_scores').where('id', existing.id).update({
              ...scoreData, updated_at: new Date(),
            });
            importedIds.push(existing.id);
            processedRows.push({ row_number: previewRow.row_number, entity_id: existing.id, action: 'update' });
            successCount++;
          }
        } else {
          const cultureScoreId = uuidv4();
          await trx('culture_scores').insert({
            id: cultureScoreId, student_id: studentId, student_enrollment_id: enrollmentId,
            class_id: classId, teacher_user_id: actorId || null,
            academic_year_id: activeYear.id, semester_id: activeSem.id, score_date: scoreDate,
            ...scoreData, status: 'active', lifecycle_status: 'active',
            created_at: new Date(), updated_at: new Date(),
          });
          importedIds.push(cultureScoreId);
          processedRows.push({ row_number: previewRow.row_number, entity_id: cultureScoreId, action: 'create' });
          successCount++;
        }
      } catch (err) {   
        errorCount++;
        confirmErrors.push({
          row_number: previewRow.row_number,
          message: err instanceof Error ? err.message : 'Database error',
          severity: 'error',
        });
      }
    }
  });
  return { successCount, errorCount };
}

// ─── Helper to re-read raw rows for confirm phase ─────────────────────────────
async function getRawRows(filePath: string, importType: string): Promise<any[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const fileContent = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const { data } = parseCsvWithAutoDelimiter(fileContent);
    return data;
  } else if (ext === '.xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    const columns: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => { columns.push(String(cell.text ?? '').trim()); });
    const rows: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: any = {};
      columns.forEach((col, index) => { rowData[col] = row.getCell(index + 1).value; });
      rows.push(rowData);
    });
    return rows;
  }

  throw new AppError('Unsupported file format', 'ERR_VALIDATION', 400);
}

// ─── Helper functions for GET endpoints ───────────────────────────────────────
export async function getImportDetail(importLogId: string) {
  const log = await db('import_logs').where('id', importLogId).first();
  if (!log) {
    throw new AppError('Import log not found', 'ERR_VALIDATION', 404);
  }
  return log;
}

export async function parseAndValidateFile(importLogId: string) {
  const log = await db('import_logs').where('id', importLogId).first();
  if (!log) {
    throw new AppError('Import log not found', 'ERR_VALIDATION', 404);
  }

  const filePath = log.file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new AppError('Import file not found on disk', 'ERR_VALIDATION', 404);
  }

  const validated = await parseAndValidate(importLogId, log.import_type, filePath);
  return validated;
}
