import { apiRequest } from "./client";

export type ImportType =
  | "students"
  | "teachers"
  | "classes"
  | "subjects"
  | "class_subjects"
  | "academic_scores"
  | "culture_scores"
  | "enrollments";

export type ImportOperation = "create" | "update" | "skip" | "error";
export type ImportRowStatus = "valid" | "warning" | "invalid";
export type ImportLogStatus = "previewed" | "success" | "partial_success" | "failed";

export interface ImportIssue {
  row_number: number;
  field?: string;
  error_code?: string;
  message: string;
  severity?: "warning" | "error";
}

export interface ImportChange {
  field: string;
  old_value: string;
  new_value: string;
}

export interface ImportPreviewRow {
  row_number: number;
  operation: ImportOperation;
  status: ImportRowStatus;
  identifier: string;
  display_name: string;
  changes: ImportChange[];
  warnings: ImportIssue[];
  errors: ImportIssue[];
  temp_password?: string;
}

export interface ImportSummary {
  import_log_id: string;
  import_type: ImportType;
  file_name?: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  create_count: number;
  update_count: number;
  skip_count: number;
  error_count: number;
  warning_count: number;
  error_report_file_id?: string;
  status: ImportLogStatus;
  preview_rows: ImportPreviewRow[];
  errors: ImportIssue[];
}

export interface ImportTemplate {
  required_columns: string[];
  optional_columns: string[];
  sample_rows: Array<Record<string, string | number | null | undefined>>;
}

export interface ImportLog {
  id: string;
  import_type: ImportType;
  file_name: string;
  uploaded_by: string;
  uploader_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  error_report_file_id?: string;
  status: ImportLogStatus;
  error_summary?: string;
  created_at: string;
  updated_at?: string;
}

export interface ImportConfirmResponse {
  import_log_id: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  imported_rows: number;
  imported_ids: string[];
  processed_rows: Array<{ row_number: number; entity_id: string; action: string }>;
  errors: ImportIssue[];
  status: "success" | "partial_success" | "failed";
}

export interface ImportLogListResponse {
  logs: ImportLog[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface ImportLogFilters {
  page?: number;
  page_size?: number;
  import_type?: ImportType | "";
  status?: ImportLogStatus | "";
}

export function createImportSession(
  token: string,
  payload: { import_type: ImportType; file_name: string; file_content_base64: string },
) {
  return apiRequest<ImportSummary>("create_import_session", payload, token);
}

export function previewImportData(token: string, importLogId: string) {
  return apiRequest<ImportSummary>("preview_import_data", { id: importLogId }, token);
}

export function confirmImportData(token: string, importLogId: string) {
  return apiRequest<ImportConfirmResponse>("confirm_import_data", { id: importLogId }, token);
}

export function listImportLogs(token: string, filters: ImportLogFilters = {}) {
  return apiRequest<ImportLogListResponse>("list_import_logs", filters, token);
}

export function getImportTemplate(token: string, importType: ImportType) {
  return apiRequest<ImportTemplate>("get_import_template", { import_type: importType }, token);
}

export function downloadImportErrorReport(token: string, errorReportFileId: string) {
  return apiRequest<{ file_id: string; file_name: string; mime_type?: string; file_size?: number; base64_content: string }>(
    "download_import_error_report",
    { error_report_file_id: errorReportFileId },
    token,
  );
}
