import { apiRequest } from "./client";

export interface MyClassAssignment {
  assignment_id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  semester_id: string;
  semester_name: string;
  effective_from?: string;
  effective_until?: string;
  status: "active" | string;
}

export interface GetMyClassesPayload {
  academic_year_id?: string;
  semester_id?: string;
}

export async function getMyClasses(
  token: string,
  payload: GetMyClassesPayload = {}
): Promise<MyClassAssignment[]> {
  return apiRequest<MyClassAssignment[]>("get_my_classes", payload, token);
}
