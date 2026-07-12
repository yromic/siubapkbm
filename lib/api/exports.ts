import { apiRequest } from "./client";

export type ExportType = "students_csv" | "academic_scores_csv" | "character_summary_csv";
export type ExportStatus = "completed" | "failed" | "archived" | string;

export interface ExportGenerateResponse {
  export_id: string;
  file_id?: string;
  file_name: string;
  mime_type?: string;
  created_at?: string;
  export_type?: string;
  total_rows?: number;
  download_available?: boolean;
}

export interface ExportHistoryItem {
  export_id: string;
  export_type: string;
  source_type?: string;
  source_id?: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  generated_by?: string;
  generated_by_name?: string;
  generated_at?: string;
  status?: ExportStatus;
  total_rows?: number;
  download_available?: boolean;
}

export interface ExportHistoryResponse {
  exports: ExportHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExportFilters {
  class_id?: string;
  academic_year_id?: string;
  semester_id?: string;
  subject_id?: string;
}

export function exportStudentsCsv(token: string, payload: ExportFilters) {
  return apiRequest<ExportGenerateResponse>("export_students_csv", payload, token);
}

export function exportAcademicScoresCsv(token: string, payload: Required<ExportFilters>) {
  return apiRequest<ExportGenerateResponse>("export_academic_scores_csv", payload, token);
}

export function exportCharacterSummaryCsv(
  token: string,
  payload: Required<Pick<ExportFilters, "class_id" | "academic_year_id" | "semester_id">>
) {
  return apiRequest<ExportGenerateResponse>("export_character_summary_csv", payload, token);
}

export function listExportHistory(
  token: string,
  payload: { export_type?: string; status?: string; page?: number; page_size?: number } = {}
) {
  return apiRequest<ExportHistoryResponse>("list_export_history", payload, token);
}

export function downloadReportExport(token: string, exportId: string) {
  return apiRequest<{ export_id: string; file_name: string; mime_type?: string; file_size?: number; base64_content: string }>(
    "download_report_export",
    { export_id: exportId },
    token
  );
}
