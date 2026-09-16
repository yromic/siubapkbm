import { AppError } from '@/lib/errors';
import {
  STUDENT_ATTENDANCE_STATUSES,
  StudentAttendanceStatus,
  SaveStudentAttendancePayload,
} from '@/types/studentAttendance';
import { isValidDateFormat, isFutureDate } from '@/lib/utils/schoolDate';

/**
 * Validates the student attendance submission payload structure and constraints.
 */
export function validateSaveAttendancePayload(data: any): SaveStudentAttendancePayload {
  if (!data || typeof data !== 'object') {
    throw new AppError('Payload tidak valid.', 'ERR_INVALID_PAYLOAD', 400);
  }

  const { attendance_date, records } = data;

  if (!attendance_date || typeof attendance_date !== 'string') {
    throw new AppError('Tanggal presensi wajib diisi.', 'ERR_MISSING_ATTENDANCE_DATE', 400);
  }

  if (!isValidDateFormat(attendance_date)) {
    throw new AppError(
      'Format tanggal presensi tidak valid (harus YYYY-MM-DD).',
      'ERR_INVALID_DATE_FORMAT',
      400
    );
  }

  if (isFutureDate(attendance_date)) {
    throw new AppError(
      'Tanggal presensi tidak boleh di masa mendatang.',
      'ERR_FUTURE_ATTENDANCE_DATE',
      400
    );
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new AppError(
      'Daftar presensi murid wajib diisi.',
      'ERR_EMPTY_ATTENDANCE_RECORDS',
      400
    );
  }

  const seenStudentIds = new Set<string>();
  const validatedRecords = records.map((rec: any, index: number) => {
    if (!rec || typeof rec !== 'object') {
      throw new AppError(
        `Data presensi pada baris ${index + 1} tidak valid.`,
        'ERR_INVALID_RECORD_ITEM',
        400
      );
    }

    const { student_id, status, note } = rec;

    if (!student_id || typeof student_id !== 'string') {
      throw new AppError(
        `ID murid wajib diisi pada baris ${index + 1}.`,
        'ERR_MISSING_STUDENT_ID',
        400
      );
    }

    if (seenStudentIds.has(student_id)) {
      throw new AppError(
        `Murid dengan ID ${student_id} muncul lebih dari satu kali dalam payload.`,
        'ERR_DUPLICATE_STUDENT_IN_PAYLOAD',
        400
      );
    }
    seenStudentIds.add(student_id);

    if (!status || !STUDENT_ATTENDANCE_STATUSES.includes(status as StudentAttendanceStatus)) {
      throw new AppError(
        `Status presensi tidak valid (${status}) pada baris ${index + 1}.`,
        'ERR_INVALID_ATTENDANCE_STATUS',
        400
      );
    }

    let cleanNote: string | null = null;
    if (note !== undefined && note !== null) {
      if (typeof note !== 'string') {
        throw new AppError(
          `Catatan harus berupa teks pada baris ${index + 1}.`,
          'ERR_INVALID_NOTE',
          400
        );
      }
      cleanNote = note.trim();
      if (cleanNote.length > 255) {
        throw new AppError(
          `Catatan melebihi batas maksimum 255 karakter pada baris ${index + 1}.`,
          'ERR_NOTE_TOO_LONG',
          400
        );
      }
      if (cleanNote === '') {
        cleanNote = null;
      }
    }

    return {
      student_id,
      status: status as StudentAttendanceStatus,
      note: cleanNote,
    };
  });

  return {
    attendance_date,
    records: validatedRecords,
  };
}

/**
 * Validates submitted student set against authoritative roster.
 * Ensures:
 * 1. Every submitted student belongs to authoritative roster (no foreign students)
 * 2. Every authoritative roster student is present in payload (no partial class attendance)
 */
export function validateRosterCompleteness(
  submittedStudentIds: string[],
  authoritativeRoster: Array<{ student_id: string; full_name?: string }>
) {
  const authoritativeMap = new Map(authoritativeRoster.map(s => [s.student_id, s]));
  const submittedSet = new Set(submittedStudentIds);

  // Check foreign students
  for (const studentId of submittedStudentIds) {
    if (!authoritativeMap.has(studentId)) {
      throw new AppError(
        `Murid dengan ID ${studentId} tidak terdaftar aktif dalam kelas untuk tanggal ini.`,
        'ERR_UNENROLLED_STUDENT_SUBMITTED',
        400
      );
    }
  }

  // Check missing authoritative students
  const missingStudents: string[] = [];
  for (const [studentId, student] of authoritativeMap) {
    if (!submittedSet.has(studentId)) {
      missingStudents.push(student.full_name || studentId);
    }
  }

  if (missingStudents.length > 0) {
    throw new AppError(
      `Presensi belum lengkap. Masih ada ${missingStudents.length} murid yang belum diisi presensinya (${missingStudents.slice(0, 3).join(', ')}${missingStudents.length > 3 ? '...' : ''}).`,
      'ERR_INCOMPLETE_ROSTER_SUBMITTED',
      400
    );
  }
}
