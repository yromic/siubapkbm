import { apiRequest } from "./client";

export interface StudentCharacterSummary {
  student_id: string;
  full_name: string;
  nisn: string;
  f: number | null;
  i: number | null;
  t: number | null;
  r: number | null;
  a: number | null;
  h: number | null;
  days_counted: number;
}

export interface IndividualCharacterSummary {
  f: number | null;
  i: number | null;
  t: number | null;
  r: number | null;
  a: number | null;
  h: number | null;
  days_counted: number;
  period_information: string;
}

export interface WatchlistStudent {
  student_id: string;
  student_name: string;
  academic_average: number | null;
  fitrah_average: number | null;
  risk_status: "AT_RISK" | "NEEDS_DATA" | "NORMAL";
  risk_reasons?: string[];
}

export interface GetClassCharacterSummaryPayload {
  class_id: string;
  academic_year_id: string;
  semester_id: string;
  week_start_date?: string; // YYYY-MM-DD
  month?: number; // 1-12
  year?: number;
}

export interface GetStudentCharacterSummaryPayload {
  student_id: string;
  academic_year_id: string;
  semester_id: string;
  week_start_date?: string; // YYYY-MM-DD
  month?: number;
  year?: number;
}

export interface GetStudentWatchlistPayload {
  academic_year_id: string;
  semester_id: string;
}

export async function getClassCharacterSummary(
  token: string,
  payload: GetClassCharacterSummaryPayload
): Promise<StudentCharacterSummary[]> {
  return apiRequest<StudentCharacterSummary[]>("get_class_character_summary", payload, token);
}

export async function getStudentCharacterSummary(
  token: string,
  payload: GetStudentCharacterSummaryPayload
): Promise<IndividualCharacterSummary> {
  return apiRequest<IndividualCharacterSummary>("get_student_character_summary", payload, token);
}

export async function getStudentWatchlist(
  token: string,
  payload: GetStudentWatchlistPayload
): Promise<WatchlistStudent[]> {
  return apiRequest<WatchlistStudent[]>("get_student_watchlist", payload, token);
}
