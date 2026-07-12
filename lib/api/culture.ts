import { apiRequest } from "./client";

export interface CultureScoreRecord {
  id: string;
  student_id: string;
  student_enrollment_id: string;
  class_id: string;
  teacher_user_id: string;
  academic_year_id: string;
  semester_id: string;
  score_date: string; // YYYY-MM-DD
  sss_score: number | null;
  am_score: number | null;
  hb_score: number | null;
  asm_score: number | null;
  br_score: number | null;
  ak_score: number | null;
  tm_score: number | null;
  status: "active" | string;
}

export interface SaveCultureScoreItem {
  student_id: string;
  score_date: string;
  sss_score: number | null;
  am_score: number | null;
  hb_score: number | null;
  asm_score: number | null;
  br_score: number | null;
  ak_score: number | null;
  tm_score: number | null;
}

export interface SaveCultureScoresPayload {
  class_id: string;
  academic_year_id: string;
  semester_id: string;
  score_date: string; // YYYY-MM-DD
  scores: SaveCultureScoreItem[];
}

export interface ListCultureScoresPayload {
  class_id: string;
  score_date: string; // YYYY-MM-DD
  academic_year_id: string;
  semester_id: string;
}

export interface SemesterFinalizationPayload {
  academic_year_id: string;
  semester_id: string;
}

export interface SemesterFinalizationResponse {
  academic_year_id: string;
  semester_id: string;
  finalized: boolean;
}

export async function listCultureScoresByDate(
  token: string,
  payload: ListCultureScoresPayload
): Promise<CultureScoreRecord[]> {
  return apiRequest<CultureScoreRecord[]>("list_culture_scores_by_date", payload, token);
}

export async function saveCultureScores(
  token: string,
  payload: SaveCultureScoresPayload
): Promise<CultureScoreRecord[]> {
  return apiRequest<CultureScoreRecord[]>("save_culture_scores", payload, token);
}

export async function getSemesterFinalizationStatus(
  token: string,
  payload: SemesterFinalizationPayload
): Promise<SemesterFinalizationResponse> {
  return apiRequest<SemesterFinalizationResponse>("get_semester_finalization_status", payload, token);
}
export interface CultureCompleteness {
  completed_students: number;
  pending_students: number;
  completion_rate: number;
}

export async function calculateCultureCompleteness(
  token: string,
  payload: {
    class_id: string;
    academic_year_id: string;
    semester_id: string;
  }
): Promise<CultureCompleteness> {
  return apiRequest<CultureCompleteness>("calculate_culture_completeness", payload, token);
}

export type CultureCompletenessStatus = "complete" | "partial" | "low" | "empty";
export type CultureCompletenessPeriodMode = "week" | "month" | "semester";

export interface TeacherCultureCompletenessResponse {
  period: {
    mode: CultureCompletenessPeriodMode;
    start_date: string;
    end_date: string;
  };
  expected_days: number;
  class_summary: {
    total_students: number;
    complete_students: number;
    partial_students: number;
    low_students: number;
    empty_students: number;
    average_coverage_percent: number;
  };
  missing_dates: Array<{
    date: string;
    expected_students: number;
    completed_students: number;
    missing_students: number;
    completion_percent: number;
  }>;
  students: Array<{
    student_id: string;
    student_name: string;
    days_counted: number;
    expected_days: number;
    missing_days: number;
    coverage_percent: number;
    completeness_status: CultureCompletenessStatus;
    missing_dates?: Array<{ date: string; reason: string }>;
  }>;
}

export async function getTeacherCultureCompleteness(
  token: string,
  payload: { period_mode: CultureCompletenessPeriodMode; class_id?: string }
): Promise<TeacherCultureCompletenessResponse> {
  return apiRequest<TeacherCultureCompletenessResponse>("get_teacher_culture_completeness", payload, token);
}
