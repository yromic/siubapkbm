import { apiRequest } from "./client";

// ─── Enrollment Types ─────────────────────────────────────────────────────────

export type EnrollmentStatus =
  | "active"
  | "promoted"
  | "repeated"
  | "graduated"
  | "transferred"
  | "inactive";

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  "active",
  "promoted",
  "repeated",
  "graduated",
  "transferred",
  "inactive",
];

export interface EnrollmentRecord {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  semester_id: string;
  class_name?: string;
  class_code?: string;
  academic_year_name?: string;
  semester_name?: string;
  status: EnrollmentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEnrollmentPayload {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  semester_id: string;
  status: EnrollmentStatus;
}

// ─── Enrollment API Functions ─────────────────────────────────────────────────

export async function listStudentEnrollments(
  token: string
): Promise<EnrollmentRecord[]> {
  return apiRequest<EnrollmentRecord[]>("list_student_enrollments", {}, token);
}

/** Returns enrollments for a specific student (client-side filtered) */
export async function getEnrollmentsForStudent(
  studentId: string,
  token: string
): Promise<EnrollmentRecord[]> {
  const all = await listStudentEnrollments(token);
  return all.filter((e) => e.student_id === studentId);
}

export async function getStudentActiveEnrollment(
  student_id: string,
  token: string
): Promise<EnrollmentRecord | null> {
  return apiRequest<EnrollmentRecord | null>(
    "get_student_active_enrollment",
    { student_id },
    token
  );
}

export async function createStudentEnrollment(
  payload: CreateEnrollmentPayload,
  token: string
): Promise<EnrollmentRecord> {
  return apiRequest<EnrollmentRecord>(
    "create_student_enrollment",
    payload,
    token
  );
}

export async function updateStudentEnrollment(
  id: string,
  payload: Partial<Omit<CreateEnrollmentPayload, "student_id">>,
  token: string
): Promise<EnrollmentRecord> {
  return apiRequest<EnrollmentRecord>(
    "update_student_enrollment",
    { id, ...payload },
    token
  );
}

export async function changeStudentEnrollmentStatus(
  id: string,
  status: EnrollmentStatus,
  token: string
): Promise<EnrollmentRecord> {
  return apiRequest<EnrollmentRecord>(
    "change_student_enrollment_status",
    { id, status },
    token
  );
}
