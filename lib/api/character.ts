import { apiRequest } from "./client";

export interface StudentCharacterSummary {
  student_id: string;
  full_name: string;
  nisn: string;
  u?: number | null;
  t?: number | null;
  s?: number | null;
  m?: number | null;
  a?: number | null;
  n?: number | null;
  f?: number | null;
  i?: number | null;
  r?: number | null;
  h?: number | null;
  coverage?: number;
  days_counted?: number;
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

// ==========================================
// Sprint 4A Character Analytics API Types & Calls
// ==========================================

export interface UtsmanSummaryRecord {
  student_id: string;
  semester_id: string;
  u_score: number;
  t_score: number;
  s_score: number;
  m_score: number;
  a_score: number;
  n_score: number;
  calculation_version: string;
}

export interface FitrahSummaryRecord {
  fathonah: number;
  istiqamah: number;
  tanggungJawab: number;
  rahmah: number;
  amanah: number;
  harmonis: number;
}

export interface SahabatBreakdownItem {
  code: string;
  average: number;
}

export interface SahabatBreakdownRecord {
  profile: string;
  indicators: SahabatBreakdownItem[];
}

export interface WeeklyCompletenessRecord {
  total_weeks: number;
  completed_weeks: number;
  percentage: number;
}

export async function getUTSMANSummaryApi(
  token: string,
  payload: { studentId: string; semesterId: string }
): Promise<UtsmanSummaryRecord> {
  return apiRequest<UtsmanSummaryRecord>("get_utsman_summary", payload, token);
}

export async function getFitrahSummaryApi(
  token: string,
  payload: { studentId: string; semesterId: string }
): Promise<FitrahSummaryRecord> {
  return apiRequest<FitrahSummaryRecord>("get_fitrah_summary", payload, token);
}

export async function getSahabatBreakdownApi(
  token: string,
  payload: { studentId: string; semesterId: string; profile: string }
): Promise<SahabatBreakdownRecord> {
  return apiRequest<SahabatBreakdownRecord>("get_sahabat_breakdown", payload, token);
}

export async function getCharacterCompletenessApi(
  token: string,
  payload: { studentId: string; semesterId: string }
): Promise<WeeklyCompletenessRecord> {
  return apiRequest<WeeklyCompletenessRecord>("get_character_completeness", payload, token);
}
