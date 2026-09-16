/**
 * Student Attendance (Presensi Siswa) Domain Types & Contracts.
 */

export const STUDENT_ATTENDANCE_STATUSES = [
  'hadir',
  'sakit',
  'izin',
  'alpa',
  'terlambat',
] as const;

export type StudentAttendanceStatus = (typeof STUDENT_ATTENDANCE_STATUSES)[number];

export const STATUS_LABELS: Record<StudentAttendanceStatus, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpa: 'Alpa',
  terlambat: 'Terlambat',
};

export const STATUS_SHORT_LABELS: Record<StudentAttendanceStatus, string> = {
  hadir: 'H',
  sakit: 'S',
  izin: 'I',
  alpa: 'A',
  terlambat: 'T',
};

export interface StudentAttendanceRecordInput {
  student_id: string;
  status: StudentAttendanceStatus;
  note?: string | null;
}

export interface SaveStudentAttendancePayload {
  attendance_date: string;
  records: StudentAttendanceRecordInput[];
}

export interface StudentAttendanceItem {
  student_id: string;
  student_enrollment_id: string;
  full_name: string;
  nisn: string | null;
  status: StudentAttendanceStatus;
  note: string | null;
  is_new_roster_addition?: boolean;
}

export interface AttendanceCounts {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  terlambat: number;
}

export interface AttendanceSummary extends AttendanceCounts {
  total: number;
  attendance_rate: number;
}

export interface StudentAttendanceDetail {
  session_id: string | null;
  class_id: string;
  class_name: string;
  attendance_date: string;
  academic_year_id: string;
  academic_year_name: string;
  semester_id: string;
  semester_name: string;
  is_semester_active: boolean;
  can_edit: boolean;
  has_submitted: boolean;
  recorded_by: string | null;
  recorded_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  records: StudentAttendanceItem[];
  summary: AttendanceSummary;
}

export interface StudentAttendanceClassItem {
  class_id: string;
  class_name: string;
  level?: string | null;
  wali_kelas_id?: string | null;
  wali_kelas_name?: string | null;
  student_count: number;
  session_id: string | null;
  has_submitted: boolean;
  recorded_by?: string | null;
  counts: AttendanceCounts;
}

export interface StudentAttendanceDashboardOverview {
  date: string;
  academic_year: {
    id: string;
    name: string;
  };
  semester: {
    id: string;
    name: string;
    is_active: boolean;
  };
  overview: {
    total_classes: number;
    submitted_classes: number;
    unsubmitted_classes: number;
    total_students_recorded: number;
    counts: AttendanceCounts;
    attendance_rate: number;
  };
  classes: StudentAttendanceClassItem[];
}
