import { apiRequest } from "./client";

export interface ParentProfile {
  full_name: string;
  nisn: string;
  class_name?: string;
  academic_year_name?: string;
  semester_name?: string;
}

export interface ParentLoginResponse {
  parent_access_token: string;
  student: {
    full_name: string;
    nisn: string;
  };
}

export async function loginParentApi(
  nisn: string,
  birth_date: string,
  pin: string,
  altchaPayload?: string
): Promise<ParentLoginResponse> {
  return apiRequest<ParentLoginResponse>("parent_login", { nisn, birth_date, pin, altchaPayload });
}


export async function logoutParentApi(token: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("parent_logout", { parent_access_token: token });
}

export async function getParentProfileApi(token: string): Promise<ParentProfile> {
  return apiRequest<ParentProfile>("parent_me", { parent_access_token: token }, token);
}

export interface ParentDashboardData {
  student: {
    id?: string;
    full_name: string;
    nisn: string;
    gender?: string;
    class_name: string | null;
    academic_year_name: string | null;
    semester_name: string | null;
  };
  academic_summary: {
    average_score: number | null;
    completed_assessments: number;
    total_assessments: number;
    latest_assessment_date: string | null;
  };
  character_summary: {
    u: number | null;
    t: number | null;
    s: number | null;
    m: number | null;
    a: number | null;
    n: number | null;
    overall_average: number | null;
    period_label: string;
    days_counted?: number;
  } | null;
  student_attendance: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    terlambat: number;
    total_days: number;
    attendance_rate: number | null;
  };
  spp_this_month?: string | null;
}

export async function getParentDashboardApi(token: string): Promise<ParentDashboardData> {
  return apiRequest<ParentDashboardData>("parent_get_dashboard", { parent_access_token: token }, token);
}

export interface ParentCharacterDimension {
  code: string;
  key: string;
  name: string;
  score: number | null;
  description: string;
  parent_explanation: string;
}

export interface ParentCharacterData {
  student: {
    id?: string;
    full_name: string;
    nisn: string;
    class_name: string | null;
    academic_year_name: string | null;
    semester_name: string | null;
  };
  period: {
    academic_year_id?: string;
    academic_year_name: string | null;
    semester_id?: string;
    semester_name: string | null;
    label: string;
  };
  utsman: {
    u: number | null;
    t: number | null;
    s: number | null;
    m: number | null;
    a: number | null;
    n: number | null;
    overall_average: number | null;
  };
  dimensions: ParentCharacterDimension[];
  interpretation: {
    strongest_dimension: {
      code: string;
      name: string;
      score: number;
    } | null;
    strengthening_area: {
      code: string;
      name: string;
      score: number;
    } | null;
    available_count: number;
    has_data: boolean;
    completeness_notice: string | null;
  };
}

export interface GetParentCharacterPayload {
  parent_access_token: string;
  academic_year_id?: string;
  semester_id?: string;
}

export async function getParentCharacterSummaryApi(
  token: string,
  academicYearId?: string,
  semesterId?: string
): Promise<ParentCharacterData> {
  return apiRequest<ParentCharacterData>(
    "parent_get_character_summary",
    {
      parent_access_token: token,
      academic_year_id: academicYearId,
      semester_id: semesterId,
    },
    token
  );
}


export interface ParentAcademicSummary {
  student: {
    full_name: string;
    nisn: string;
  };
  period: {
    academic_year_name: string;
    semester_name: string;
  };
  overall_average: number | null;
  total_assessments: number;
  completed_assessments: number;
  subject_averages: Array<{
    subject_code: string;
    subject_name: string;
    average_score: number | null;
    assessment_count: number;
  }>;
}

export interface ParentAcademicDetail {
  subject_code: string;
  subject_name: string | null;
  assessments: Array<{
    assessment_title: string;
    assessment_date: string;
    score_min: number;
    score_max: number;
    score: number | null;
    assessment_status: "published" | "locked";
  }>;
}

export async function getParentAcademicSummaryApi(token: string): Promise<ParentAcademicSummary> {
  return apiRequest<ParentAcademicSummary>(
    "parent_get_academic_summary",
    { parent_access_token: token },
    token
  );
}

export async function getParentAcademicDetailApi(
  token: string,
  subjectCode: string
): Promise<ParentAcademicDetail> {
  return apiRequest<ParentAcademicDetail>(
    "parent_get_academic_detail",
    { parent_access_token: token, subject_code: subjectCode },
    token
  );
}

