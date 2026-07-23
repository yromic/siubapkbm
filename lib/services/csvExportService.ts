/**
 * csvExportService.ts
 *
 * Generates CSV exports for students, academic scores, and character summaries.
 * Saves the CSV file to storage/exports, records to report_exports table,
 * and returns ExportGenerateResponse shape.
 */

import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';

const EXPORTS_DIR = path.join(process.cwd(), 'storage', 'exports');

function ensureExportsDirectory() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

/** Escape a CSV cell value */
function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build CSV string from headers + rows */
function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** Persist the CSV file and record to report_exports, return ExportGenerateResponse */
async function saveExport(params: {
  csvContent: string;
  fileName: string;
  reportType: string;
  actorId: string;
  classId?: string;
  academicYearId?: string;
  semesterId?: string;
  totalRows: number;
}) {
  ensureExportsDirectory();

  const exportId = uuidv4();
  const uniqueFileName = `${exportId}-${params.fileName}`;
  const filePath = path.join(EXPORTS_DIR, uniqueFileName);

  fs.writeFileSync(filePath, params.csvContent, 'utf-8');
  const stats = fs.statSync(filePath);

  await db('report_exports').insert({
    id: exportId,
    report_type: params.reportType,
    class_id: params.classId || null,
    academic_year_id: params.academicYearId || null,
    semester_id: params.semesterId || null,
    generated_by: params.actorId,
    generated_at: new Date(),
    status: 'completed',
    file_path: filePath,
    file_name: params.fileName,
    mime_type: 'text/csv',
    file_size: stats.size,
    source_type: 'csv',
    total_rows: params.totalRows,
    lifecycle_status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  });

  return {
    export_id: exportId,
    file_id: exportId,
    file_name: params.fileName,
    mime_type: 'text/csv',
    created_at: new Date().toISOString(),
    export_type: params.reportType,
    total_rows: params.totalRows,
    download_available: true,
  };
}

// ─── Students CSV ─────────────────────────────────────────────────────────────

export async function exportStudentsCsvService(params: {
  classId?: string;
  academicYearId?: string;
  semesterId?: string;
  actorId: string;
}) {
  try {
    let query = db('students')
      .select(
        'students.id',
        'students.nisn',
        'students.full_name',
        'students.birth_place',
        'students.birth_date',
        'students.gender',
        'students.religion',
        'students.status'
      )
      .where('students.status', '!=', 'deleted')
      .orderBy('students.full_name', 'asc');

    // If filters are given, join through enrollments
    if (params.classId || params.academicYearId || params.semesterId) {
      query = db('students')
        .join('student_enrollments', 'students.id', 'student_enrollments.student_id')
        .select(
          'students.id',
          'students.nisn',
          'students.full_name',
          'students.birth_place',
          'students.birth_date',
          'students.gender',
          'students.religion',
          'students.status',
          'student_enrollments.class_id',
          'student_enrollments.academic_year_id',
          'student_enrollments.semester_id'
        )
        .where('students.status', '!=', 'deleted')
        .where('student_enrollments.status', 'active')
        .orderBy('students.full_name', 'asc');

      if (params.classId) query.where('student_enrollments.class_id', params.classId);
      if (params.academicYearId) query.where('student_enrollments.academic_year_id', params.academicYearId);
      if (params.semesterId) query.where('student_enrollments.semester_id', params.semesterId);
    }

    let resolvedAcademicYearId = params.academicYearId;
    let resolvedSemesterId = params.semesterId;

    if (!resolvedAcademicYearId || !resolvedSemesterId) {
      const activeYear = await db('academic_years').where('is_active', 1).first();
      const activeSem = await db('semesters').where('is_active', 1).first();
      if (!resolvedAcademicYearId && activeYear) resolvedAcademicYearId = activeYear.id;
      if (!resolvedSemesterId && activeSem) resolvedSemesterId = activeSem.id;
    }

    const students = await query;

    const headers = ['ID', 'NISN', 'Nama Lengkap', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin', 'Agama', 'Status'];
    const rows = students.map((s: any) => [
      s.id,
      s.nisn ?? '',
      s.full_name ?? '',
      s.birth_place ?? '',
      s.birth_date ? String(s.birth_date).split('T')[0] : '',
      s.gender ?? '',
      s.religion ?? '',
      s.status ?? '',
    ]);

    const csvContent = buildCsv(headers, rows);
    const fileName = `students_export_${new Date().toISOString().split('T')[0]}.csv`;

    return await saveExport({
      csvContent,
      fileName,
      reportType: 'students',
      actorId: params.actorId,
      classId: params.classId,
      academicYearId: resolvedAcademicYearId,
      semesterId: resolvedSemesterId,
      totalRows: students.length,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('[csvExportService] exportStudentsCsvService error:', error);
    throw new AppError(
      error instanceof Error ? error.message : 'Error generating students CSV.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}

// ─── Academic Scores CSV ──────────────────────────────────────────────────────

export async function exportAcademicScoresCsvService(params: {
  classId: string;
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  actorId: string;
}) {
  try {
    const scores = await db('academic_scores')
      .join('academic_assessments', 'academic_scores.assessment_id', 'academic_assessments.id')
      .join('students', 'academic_scores.student_id', 'students.id')
      .join('subjects', 'academic_assessments.subject_id', 'subjects.id')
      .select(
        'students.nisn',
        'students.full_name',
        'subjects.name as subject_name',
        'academic_assessments.title as assessment_title',
        'academic_assessments.assessment_date',
        'academic_scores.score',
        'academic_scores.note'
      )
      .where('academic_assessments.class_id', params.classId)
      .where('academic_assessments.academic_year_id', params.academicYearId)
      .where('academic_assessments.semester_id', params.semesterId)
      .where('academic_assessments.subject_id', params.subjectId)
      .where('academic_scores.status', '!=', 'deleted')
      .orderBy(['students.full_name', 'academic_assessments.assessment_date']);

    const headers = ['NISN', 'Nama Siswa', 'Mata Pelajaran', 'Judul Penilaian', 'Tanggal Penilaian', 'Nilai', 'Catatan'];
    const rows = scores.map((s: any) => [
      s.nisn ?? '',
      s.full_name ?? '',
      s.subject_name ?? '',
      s.assessment_title ?? '',
      s.assessment_date ? String(s.assessment_date).split('T')[0] : '',
      s.score != null ? String(s.score) : '',
      s.note ?? '',
    ]);

    const csvContent = buildCsv(headers, rows);
    const fileName = `academic_scores_export_${new Date().toISOString().split('T')[0]}.csv`;

    return await saveExport({
      csvContent,
      fileName,
      reportType: 'academic',
      actorId: params.actorId,
      classId: params.classId,
      academicYearId: params.academicYearId,
      semesterId: params.semesterId,
      totalRows: scores.length,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('[csvExportService] exportAcademicScoresCsvService error:', error);
    throw new AppError(
      error instanceof Error ? error.message : 'Error generating academic scores CSV.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}

// ─── Character Summary CSV ────────────────────────────────────────────────────

export async function exportCharacterSummaryCsvService(params: {
  classId: string;
  academicYearId: string;
  semesterId: string;
  actorId: string;
}) {
  try {
    const summaries = await db('character_semester_summaries')
      .join('students', 'character_semester_summaries.student_id', 'students.id')
      .select(
        'students.nisn',
        'students.full_name',
        'character_semester_summaries.f_score',
        'character_semester_summaries.i_score',
        'character_semester_summaries.t_score',
        'character_semester_summaries.r_score',
        'character_semester_summaries.a_score',
        'character_semester_summaries.h_score',
        'character_semester_summaries.days_counted'
      )
      .join('student_enrollments', (j: any) => {
        j.on('character_semester_summaries.student_id', '=', 'student_enrollments.student_id')
          .andOn('character_semester_summaries.academic_year_id', '=', 'student_enrollments.academic_year_id')
          .andOn('character_semester_summaries.semester_id', '=', 'student_enrollments.semester_id');
      })
      .where('student_enrollments.class_id', params.classId)
      .where('character_semester_summaries.academic_year_id', params.academicYearId)
      .where('character_semester_summaries.semester_id', params.semesterId)
      .where('student_enrollments.status', 'active')
      .orderBy('students.full_name', 'asc');

    const headers = [
      'NISN', 'Nama Siswa',
      'F (Fathonah)', 'I (Istiqamah)', 'T (Tanggung Jawab)',
      'R (Ramah)', 'A (Amanah)', 'H (Harmonis)',
      'Hari Dicatat',
    ];
    const rows = summaries.map((s: any) => [
      s.nisn ?? '',
      s.full_name ?? '',
      s.f_score != null ? String(s.f_score) : '0',
      s.i_score != null ? String(s.i_score) : '0',
      s.t_score != null ? String(s.t_score) : '0',
      s.r_score != null ? String(s.r_score) : '0',
      s.a_score != null ? String(s.a_score) : '0',
      s.h_score != null ? String(s.h_score) : '0',
      s.days_counted != null ? String(s.days_counted) : '0',
    ]);

    const csvContent = buildCsv(headers, rows);
    const fileName = `character_summary_export_${new Date().toISOString().split('T')[0]}.csv`;

    return await saveExport({
      csvContent,
      fileName,
      reportType: 'character',
      actorId: params.actorId,
      classId: params.classId,
      academicYearId: params.academicYearId,
      semesterId: params.semesterId,
      totalRows: summaries.length,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('[csvExportService] exportCharacterSummaryCsvService error:', error);
    throw new AppError(
      error instanceof Error ? error.message : 'Error generating character summary CSV.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
