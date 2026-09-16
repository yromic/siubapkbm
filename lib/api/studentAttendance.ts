import {
  StudentAttendanceClassItem,
  StudentAttendanceDetail,
  StudentAttendanceDashboardOverview,
  SaveStudentAttendancePayload,
} from '@/types/studentAttendance';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: {
    code: string;
    details?: any;
  };
}

/**
 * Fetch classes for student attendance landing (teacher assigned classes or admin all classes).
 */
export async function fetchAttendanceClasses(
  date?: string
): Promise<{ classes: StudentAttendanceClassItem[]; total: number; date: string }> {
  const url = new URL('/api/v1/student-attendance/classes', window.location.origin);
  if (date) {
    url.searchParams.set('date', date);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  const json: ApiResponse<{ classes: StudentAttendanceClassItem[]; total: number; date: string }> =
    await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal memuat daftar kelas presensi.');
  }

  return json.data;
}

/**
 * Fetch attendance detail for a specific class and date.
 */
export async function fetchClassAttendanceDetail(
  classId: string,
  date?: string
): Promise<StudentAttendanceDetail> {
  const url = new URL(
    `/api/v1/student-attendance/classes/${classId}`,
    window.location.origin
  );
  if (date) {
    url.searchParams.set('date', date);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  const json: ApiResponse<StudentAttendanceDetail> = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal memuat data presensi kelas.');
  }

  return json.data;
}

/**
 * Atomically save student attendance for a class.
 */
export async function saveClassAttendanceApi(
  classId: string,
  payload: SaveStudentAttendancePayload
): Promise<StudentAttendanceDetail> {
  const res = await fetch(`/api/v1/student-attendance/classes/${classId}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<StudentAttendanceDetail> = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal menyimpan presensi kelas.');
  }

  return json.data;
}

/**
 * Fetch school-wide admin daily attendance dashboard.
 */
export async function fetchAttendanceDashboard(
  date?: string
): Promise<StudentAttendanceDashboardOverview> {
  const url = new URL('/api/v1/student-attendance/dashboard', window.location.origin);
  if (date) {
    url.searchParams.set('date', date);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  const json: ApiResponse<StudentAttendanceDashboardOverview> = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal memuat ringkasan dashboard presensi.');
  }

  return json.data;
}
