import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';

const TEMPLATES: Record<string, { required_columns: string[]; optional_columns: string[]; sample_rows: any[] }> = {
  students: {
    required_columns: ['nisn', 'full_name', 'birth_date', 'gender'],
    optional_columns: [
      'nik', 'birth_place', 'religion', 'phone', 'affirmation',
      'special_needs', 'family_card_number', 'family_card_date', 'mother_name',
      'mother_nik', 'father_name', 'father_nik', 'guardian_name', 'guardian_nik',
      'address_street', 'rt', 'rw', 'hamlet', 'village', 'district', 'city', 'province',
      'status', 'parent_pin'
    ],
    sample_rows: [
      {
        nisn: '1234567890',
        full_name: 'Budi Santoso',
        birth_date: '2010-05-15',
        gender: 'L',
        status: 'Aktif',
        parent_pin: '1234'
      }
    ]
  },
  teachers: {
    required_columns: ['full_name', 'email'],
    optional_columns: ['username', 'password', 'phone', 'status', 'gender', 'address', 'nip', 'nuptk', 'position'],
    sample_rows: [
      {
        full_name: 'Siti Rahma',
        email: 'siti.rahma@pkbm.sch.id',
        username: 'sitirahma',
        password: 'Password123!',
        status: 'Aktif'
      }
    ]
  },
  classes: {
    required_columns: ['code', 'name', 'level'],
    optional_columns: ['status'],
    sample_rows: [
      {
        code: 'X-A',
        name: 'Kelas 10 A',
        level: '10',
        status: 'Aktif'
      }
    ]
  },
  subjects: {
    required_columns: ['code', 'name'],
    optional_columns: ['description', 'status'],
    sample_rows: [
      {
        code: 'MAT-10',
        name: 'Matematika Kelas 10',
        description: 'Mata pelajaran Matematika wajib Kelas 10',
        status: 'Aktif'
      }
    ]
  },
  class_subjects: {
    required_columns: ['class_code', 'subject_code', 'academic_year', 'semester'],
    optional_columns: ['status'],
    sample_rows: [
      {
        class_code: 'X-A',
        subject_code: 'MAT-10',
        academic_year: '2025/2026',
        semester: 'Ganjil',
        status: 'Aktif'
      }
    ]
  },
  academic_scores: {
    required_columns: ['assessment_id', 'nisn', 'score'],
    optional_columns: ['note'],
    sample_rows: [
      {
        assessment_id: 'ASM_171887361_1234',
        nisn: '1234567890',
        score: '85',
        note: 'Tugas diselesaikan dengan baik'
      }
    ]
  },
  culture_scores: {
    required_columns: ['nisn', 'score_date', 'sss_score', 'am_score', 'hb_score', 'asm_score', 'br_score', 'ak_score', 'tm_score'],
    optional_columns: [],
    sample_rows: [
      {
        nisn: '1234567890',
        score_date: '2026-06-20',
        sss_score: '4',
        am_score: '3',
        hb_score: '4',
        asm_score: '4',
        br_score: '3',
        ak_score: '4',
        tm_score: '4'
      }
    ]
  }
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin', 'teacher'], req, async () => {
      try {
        const { type } = await params;
        
        // Normalize pluralization/singular
        let normalizedType = type.toLowerCase();
        if (normalizedType === 'student') normalizedType = 'students';
        if (normalizedType === 'teacher') normalizedType = 'teachers';
        if (normalizedType === 'class') normalizedType = 'classes';
        if (normalizedType === 'subject') normalizedType = 'subjects';
        if (normalizedType === 'class_subject') normalizedType = 'class_subjects';
        if (normalizedType === 'academic_score') normalizedType = 'academic_scores';
        if (normalizedType === 'culture_score') normalizedType = 'culture_scores';

        const template = TEMPLATES[normalizedType];

        if (!template) {
          throw new AppError(`Template for type "${type}" is not available yet.`, 'ERR_VALIDATION', 404);
        }

        return successResponse(template, `Template for ${normalizedType} retrieved successfully.`);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Database error downloading template.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}
