import { apiRequest } from "@/lib/api/client";

export type PromotionAction = "promoted" | "repeated" | "graduated" | "transferred" | "inactive" | "left";

export interface PromotionOverride {
  student_id: string;
  action: PromotionAction;
  target_class_id?: string;
}

export interface PromotionPayload {
  source_academic_year_id: string;
  source_semester_id: string;
  target_academic_year_id: string;
  target_semester_id: string;
  overrides: PromotionOverride[];
}

export interface PromotionCounts {
  total?: number;
  processed?: number;
  completed?: number;
  skipped?: number;
  failed?: number;
  promoted: number;
  repeated: number;
  graduated: number;
  transferred: number;
  inactive: number;
  left: number;
  unresolved?: number;
}

export interface PromotionStudent {
  student_id: string;
  student_name: string;
  nisn: string;
  source_class_id: string;
  source_class_name: string;
  recommended_action: string;
  resolved_action: string;
  resolved_target_class_id: string;
  resolved_target_class_name: string;
  blockers: string[];
}

export interface PromotionPreview {
  can_execute: boolean;
  students: PromotionStudent[];
  global_blockers: Array<{ type: string; message: string }>;
  counts: PromotionCounts;
}

export interface PromotionExecutionResult extends PromotionCounts {
  processed: number;
  completed: number;
  skipped: number;
  failed: number;
}

export function previewStudentPromotion(token: string, payload: PromotionPayload) {
  return apiRequest<PromotionPreview>("preview_student_promotion", payload, token);
}

export function executeStudentPromotion(token: string, payload: PromotionPayload) {
  return apiRequest<PromotionExecutionResult>("execute_student_promotion", payload, token);
}
