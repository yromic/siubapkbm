import { apiRequest } from "./client";

export type AssessmentStatus = "draft" | "published" | "locked";

export interface AcademicAssessment {
  id: string;
  teacher_user_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
  title: string;
  description?: string;
  assessment_date: string;
  score_min: number | string;
  score_max: number | string;
  status: AssessmentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAcademicAssessmentPayload {
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
  title: string;
  description?: string;
  assessment_date: string;
  score_min: number;
  score_max: number;
}

export type UpdateAcademicAssessmentPayload = Partial<
  Pick<
    CreateAcademicAssessmentPayload,
    "title" | "description" | "assessment_date" | "score_min" | "score_max"
  >
>;

export interface ListAcademicAssessmentsPayload {
  class_id?: string;
  subject_id?: string;
  academic_year_id?: string;
  semester_id?: string;
  limit?: number;
}

export interface MyClassSubject {
  class_subject_id: string;
  class_id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  academic_year_id: string;
  semester_id: string;
  status: "active" | string;
}

export interface AssessmentSummary {
  assessment_id: string;
  title: string;
  status: AssessmentStatus | string;
  ungraded_students: number;
  completeness_percentage: number;
}

export interface ClassAcademicSummary {
  class_id: string;
  academic_year_id: string;
  semester_id: string;
  student_summaries: Array<{
    student_id: string;
    full_name: string;
    nisn: string;
    average_score: number | null;
  }>;
  assessment_summaries: AssessmentSummary[];
}

export interface AcademicCompleteness {
  completed_students: number;
  pending_students: number;
  completion_rate: number;
}

export interface AcademicScore {
  id: string;
  assessment_id: string;
  student_id: string;
  student_enrollment_id: string;
  score: number | string | null;
  note?: string;
  status: "active" | "revised" | string;
  created_at?: string;
  updated_at?: string;
}

export interface SaveAcademicScoreItem {
  student_id: string;
  student_enrollment_id: string;
  score: number | "" | null;
  note: string;
}

export interface SaveAcademicScoresPayload {
  assessment_id: string;
  scores: SaveAcademicScoreItem[];
}

export async function listAcademicAssessments(
  token: string,
  payload: ListAcademicAssessmentsPayload = {}
): Promise<AcademicAssessment[]> {
  return apiRequest<AcademicAssessment[]>("list_academic_assessments", payload, token);
}

export async function getAcademicAssessmentDetail(
  id: string,
  token: string
): Promise<AcademicAssessment> {
  return apiRequest<AcademicAssessment>("get_academic_assessment_detail", { id }, token);
}

export async function createAcademicAssessment(
  payload: CreateAcademicAssessmentPayload,
  token: string
): Promise<AcademicAssessment> {
  return apiRequest<AcademicAssessment>("create_academic_assessment", payload, token);
}

export async function updateAcademicAssessment(
  id: string,
  payload: UpdateAcademicAssessmentPayload,
  token: string
): Promise<AcademicAssessment> {
  return apiRequest<AcademicAssessment>("update_academic_assessment", { id, ...payload }, token);
}

export async function publishAcademicAssessment(
  id: string,
  token: string
): Promise<AcademicAssessment> {
  return apiRequest<AcademicAssessment>("publish_academic_assessment", { id }, token);
}

export async function listMyClassSubjects(
  token: string,
  payload: {
    class_id: string;
    academic_year_id: string;
    semester_id: string;
  }
): Promise<MyClassSubject[]> {
  return apiRequest<MyClassSubject[]>("list_my_class_subjects", payload, token);
}

export async function getClassAcademicSummary(
  token: string,
  payload: {
    class_id: string;
    academic_year_id: string;
    semester_id: string;
  }
): Promise<ClassAcademicSummary> {
  return apiRequest<ClassAcademicSummary>("get_class_academic_summary", payload, token);
}

export async function calculateAcademicCompleteness(
  token: string,
  payload: {
    class_id: string;
    academic_year_id: string;
    semester_id: string;
  }
): Promise<AcademicCompleteness> {
  return apiRequest<AcademicCompleteness>("calculate_academic_completeness", payload, token);
}

export async function listAcademicScoresByAssessment(
  assessment_id: string,
  token: string
): Promise<AcademicScore[]> {
  return apiRequest<AcademicScore[]>(
    "list_academic_scores_by_assessment",
    { assessment_id },
    token
  );
}

export async function saveAcademicScores(
  payload: SaveAcademicScoresPayload,
  token: string
): Promise<AcademicScore[]> {
  return apiRequest<AcademicScore[]>("save_academic_scores", payload, token);
}
