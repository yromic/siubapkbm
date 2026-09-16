import { apiRequest, ApiError } from "./client";

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

/**
 * Validates and normalizes raw API response into MyClassAssignment[].
 * Supports canonical array responses and known legacy envelope structures ({ items: [] } or { data: [] }).
 * Rejects corrupt or unexpected response structures with an explicit ApiError.
 */
function normalizeClassAssignments(raw: unknown): MyClassAssignment[] {
  // 1. Direct array (canonical contract)
  if (Array.isArray(raw)) {
    return raw as MyClassAssignment[];
  }

  // 2. Known legacy envelope ({ items: MyClassAssignment[] } or { data: MyClassAssignment[] })
  if (raw !== null && typeof raw === "object") {
    const envelope = raw as Record<string, unknown>;
    if (Array.isArray(envelope.items)) {
      return envelope.items as MyClassAssignment[];
    }
    if (Array.isArray(envelope.data)) {
      return envelope.data as MyClassAssignment[];
    }
  }

  // 3. Reject corrupt/unknown payloads explicitly (never silently return [])
  throw new ApiError(
    "ERR_INVALID_API_CONTRACT",
    "Format data kelas tidak valid dari server."
  );
}

export async function getMyClasses(
  token: string,
  payload: GetMyClassesPayload = {}
): Promise<MyClassAssignment[]> {
  const raw = await apiRequest<unknown>("get_my_classes", payload, token);
  return normalizeClassAssignments(raw);
}

