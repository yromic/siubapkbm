import { apiRequest } from "./client";

// ─── Student Types ────────────────────────────────────────────────────────────

/** Full student record — returned for admin/administrator roles */
export interface StudentRecord {
  id: string;
  nisn: string;
  nik?: string;
  full_name: string;
  birth_place?: string;
  birth_date?: string;
  gender?: "L" | "P";
  religion?: string;
  phone?: string;
  affirmation?: string;
  special_needs?: string;
  family_card_number?: string;
  family_card_date?: string;
  mother_name?: string;
  mother_nik?: string;
  father_name?: string;
  father_nik?: string;
  guardian_name?: string;
  guardian_nik?: string;
  address_street?: string;
  rt?: string;
  rw?: string;
  hamlet?: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  spp_amount?: number;
  has_parent_pin?: boolean;
  // parent_access_pin_hash is ALWAYS stripped by backend — never typed here
  status: StudentStatus;
  lifecycle_status?: string;
  created_at?: string;
  updated_at?: string;
}

/** Limited student record — returned for teacher role */
export interface StudentSummary {
  id: string;
  student_enrollment_id?: string;
  nisn: string;
  full_name: string;
  birth_place?: string;
  birth_date?: string;
  gender?: "L" | "P";
  religion?: string;
  phone?: string;
  status: StudentStatus;
  created_at?: string;
  updated_at?: string;
}

export type StudentStatus =
  | "Aktif"
  | "Lulus"
  | "Pindah"
  | "Keluar"
  | "Tidak aktif"
  | "Meninggal";

export const STUDENT_STATUSES: StudentStatus[] = [
  "Aktif",
  "Lulus",
  "Pindah",
  "Keluar",
  "Tidak aktif",
  "Meninggal",
];

export interface CreateStudentPayload {
  nisn: string;
  full_name: string;
  birth_date: string;
  gender: "L" | "P";
  status: StudentStatus;
  nik?: string;
  birth_place?: string;
  religion?: string;
  phone?: string;
  affirmation?: string;
  special_needs?: string;
  family_card_number?: string;
  family_card_date?: string;
  mother_name?: string;
  mother_nik?: string;
  father_name?: string;
  father_nik?: string;
  guardian_name?: string;
  guardian_nik?: string;
  address_street?: string;
  rt?: string;
  rw?: string;
  hamlet?: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  spp_amount?: number;
  parent_access_pin?: string;
}

export type UpdateStudentPayload = Partial<CreateStudentPayload> & {
  id: string;
};

// ─── Paginated Response ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// ─── Student API Functions ───────────────────────────────────────────────────

export async function listStudents(
  token: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }
): Promise<PaginatedResponse<StudentRecord[]>> {
  return apiRequest<PaginatedResponse<StudentRecord[]>>("list_students", params || {}, token);
}

export async function getStudentDetail(
  id: string,
  token: string
): Promise<StudentRecord | StudentSummary> {
  return apiRequest<StudentRecord>("get_student_detail", { id }, token);
}

export async function createStudent(
  payload: CreateStudentPayload,
  token: string
): Promise<StudentRecord> {
  return apiRequest<StudentRecord>("create_student", payload, token);
}

export async function updateStudent(
  id: string,
  payload: Partial<CreateStudentPayload>,
  token: string
): Promise<StudentRecord> {
  return apiRequest<StudentRecord>("update_student", { id, ...payload }, token);
}

export async function changeStudentStatus(
  id: string,
  status: StudentStatus,
  token: string
): Promise<StudentRecord> {
  return apiRequest<StudentRecord>(
    "change_student_status",
    { id, status },
    token
  );
}

export async function resetStudentParentPin(
  id: string,
  parent_access_pin: string,
  token: string
): Promise<StudentRecord> {
  return apiRequest<StudentRecord>(
    "reset_student_parent_pin",
    { id, parent_access_pin },
    token
  );
}

export async function listStudentsByClass(
  class_id: string,
  academic_year_id: string,
  semester_id: string,
  token: string,
  limit = 1000
): Promise<StudentSummary[]> {
  return apiRequest<StudentSummary[]>(
    "list_students_by_class",
    { class_id, academic_year_id, semester_id, limit },
    token
  );
}
