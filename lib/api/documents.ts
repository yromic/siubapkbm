import { apiRequest } from "./client";

export type StudentFileType = "foto" | "pas_foto" | "kk" | "akta" | "dokumen_lain";
export type StudentFileStatus = "active" | "archived" | "replaced";

export const STUDENT_FILE_TYPES: StudentFileType[] = [
  "foto",
  "pas_foto",
  "kk",
  "akta",
  "dokumen_lain",
];

export interface StudentFileRecord {
  id: string;
  student_id: string;
  file_type: StudentFileType;
  drive_file_id?: string;
  original_filename: string;
  mime_type: string;
  file_size: number | string;
  version: number | string;
  status: StudentFileStatus;
  uploaded_by?: string;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UploadStudentFilePayload {
  student_id: string;
  file_type: StudentFileType;
  file_content_base64: string;
  original_filename: string;
}

export interface ReplaceStudentFilePayload {
  id: string;
  student_id: string;
  file_type: StudentFileType;
  file_content_base64: string;
  original_filename: string;
}

export interface FileAccessResponse {
  file_id: string;
  file_name: string;
  mime_type: string;
  base64_content: string;
}

export async function listStudentFiles(
  studentId: string,
  token: string
): Promise<StudentFileRecord[]> {
  return apiRequest<StudentFileRecord[]>(
    "list_student_files",
    { student_id: studentId },
    token
  );
}

export async function uploadStudentFile(
  payload: UploadStudentFilePayload,
  token: string
): Promise<StudentFileRecord> {
  return apiRequest<StudentFileRecord>("upload_student_file", payload, token);
}

export async function replaceStudentFile(
  payload: ReplaceStudentFilePayload,
  token: string
): Promise<StudentFileRecord> {
  return apiRequest<StudentFileRecord>("replace_student_file", payload, token);
}

export async function getStudentFileAccess(
  fileId: string,
  token: string
): Promise<FileAccessResponse> {
  return apiRequest<FileAccessResponse>(
    "get_student_file_access",
    { file_id: fileId },
    token
  );
}

export async function archiveStudentFile(
  fileId: string,
  token: string
): Promise<StudentFileRecord> {
  return apiRequest<StudentFileRecord>(
    "archive_student_file",
    { file_id: fileId },
    token
  );
}
