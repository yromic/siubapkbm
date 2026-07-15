import { StaffUser, apiRequest } from "./client";

export interface TeacherProfile {
  id: string;
  user_id: string;
  full_name: string;
  gender?: string;
  phone?: string;
  address?: string;
  nip?: string;
  nuptk?: string;
  position?: string;
  status: "active" | "inactive";
  created_at?: string;
  updated_at?: string;
}

export interface UserWithProfile extends StaffUser {
  teacher_profile?: TeacherProfile | null;
  lifecycle_status?: string;
}

/**
 * Retrieves the list of users from the backend.
 * @param token - Authentication token.
 * @param filters - Optional filters by role and status.
 */
export async function listUsersApi(
  token: string,
  filters?: {
    role?: string;
    status?: string;
    includeInactive?: boolean;
    includeArchived?: boolean;
    onlyArchived?: boolean;
    onlyDeleted?: boolean;
    limit?: number;
  }
): Promise<UserWithProfile[]> {
  return apiRequest<UserWithProfile[]>("list_users", filters || {}, token);
}

/**
 * Creates a new staff user.
 * @param token - Authentication token.
 * @param payload - Payload containing user and optional profile details.
 */
export async function createUserApi(
  token: string,
  payload: Record<string, any>
): Promise<UserWithProfile> {
  return apiRequest<UserWithProfile>("create_user", payload, token);
}

/**
 * Updates an existing user's details.
 * @param token - Authentication token.
 * @param userId - ID of the user to update.
 * @param payload - Updated user and profile fields.
 */
export async function updateUserApi(
  token: string,
  userId: string,
  payload: Record<string, any>
): Promise<UserWithProfile> {
  return apiRequest<UserWithProfile>("update_user", { id: userId, ...payload }, token);
}

/**
 * Resets another user's password.
 * @param token - Authentication token.
 * @param userId - User ID.
 * @param newPassword - The new password.
 */
export async function resetUserPasswordApi(
  token: string,
  userId: string,
  newPassword: string
): Promise<UserWithProfile> {
  return apiRequest<UserWithProfile>("reset_user_password", { id: userId, new_password: newPassword }, token);
}

/**
 * Updates a user's status.
 * @param token - Authentication token.
 * @param userId - User ID.
 * @param status - The target status ('active' or 'inactive').
 */
export async function setUserStatusApi(
  token: string,
  userId: string,
  status: "active" | "inactive"
): Promise<UserWithProfile> {
  return apiRequest<UserWithProfile>("set_user_status", { id: userId, status }, token);
}

/**
 * Changes the current authenticated user's password.
 * @param token - Authentication token.
 * @param oldPassword - Current password.
 * @param newPassword - New password.
 */
export async function changeOwnPasswordApi(
  token: string,
  oldPassword: string,
  newPassword: string
): Promise<StaffUser> {
  return apiRequest<StaffUser>(
    "change_own_password",
    { old_password: oldPassword, new_password: newPassword },
    token
  );
}

