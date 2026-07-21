import { db } from "@/lib/db";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { logAuthenticationEvent } from "@/lib/services/auditService";

export interface UserListFilter {
  role?: "administrator" | "admin" | "teacher";
  status?: "active" | "inactive";
  search?: string;
}

export interface UserInput {
  name: string;
  email: string;
  username: string;
  password?: string;
  role: "administrator" | "admin" | "teacher";
  phone?: string;
}

export function generateSoftDeletedIdentifier(original: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `deleted_${timestamp}_${randomSuffix}_${original}`;
}

export function extractOriginalIdentifier(deletedValue: string): string {
  if (!deletedValue || !deletedValue.startsWith("deleted_")) {
    return deletedValue;
  }
  const parts = deletedValue.split("_");
  if (parts.length >= 5) {
    return parts.slice(4).join("_");
  }
  return deletedValue;
}

export async function validateUserIdentifiers(
  email?: string,
  username?: string,
  excludeUserId?: string,
  trx?: any,
) {
  const conn = trx || db;

  if (email) {
    const trimmedEmail = email.trim().toLowerCase();
    const query = conn("users")
      .where("email", trimmedEmail)
      .whereNot("lifecycle_status", "soft_deleted");

    if (excludeUserId) {
      query.whereNot("id", excludeUserId);
    }

    const existing = await query.first();
    if (existing) {
      throw new AppError("Email sudah terdaftar", "ERR_VALIDATION", 400);
    }
  }

  if (username) {
    const trimmedUsername = username.trim();
    const query = conn("users")
      .where("username", trimmedUsername)
      .whereNot("lifecycle_status", "soft_deleted");

    if (excludeUserId) {
      query.whereNot("id", excludeUserId);
    }

    const existing = await query.first();
    if (existing) {
      throw new AppError(
        "Username is already registered.",
        "ERR_VALIDATION",
        400,
      );
    }
  }
}

export async function listUsers(
  filters: UserListFilter = {},
  page = 1,
  limit = 20,
) {
  try {
    const query = db("users").whereNot("lifecycle_status", "soft_deleted");

    if (filters.role) {
      query.where("role", filters.role);
    }

    if (filters.status) {
      query.where("status", filters.status);
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query.where(function (this: any) {
        this.where("name", "like", searchPattern)
          .orWhere("email", "like", searchPattern)
          .orWhere("username", "like", searchPattern);
      });
    }

    // Clone query for count
    const totalQuery = query.clone();
    const countResult = await totalQuery.count("id as total").first();
    const total = Number(countResult?.total || 0);

    const offset = (page - 1) * limit;
    const users = await query
      .select(
        "id",
        "name",
        "email",
        "username",
        "role",
        "phone",
        "status",
        "lifecycle_status",
        "created_at",
        "updated_at",
      )
      .limit(limit)
      .offset(offset)
      .orderBy("created_at", "desc");

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error listing users",
      "ERR_DATABASE",
      500,
    );
  }
}

/**
 * Returns the canonical count of non-deleted teacher users.
 * Dashboard and other consumers should use this instead of duplicating the role/status filter.
 */
export async function countTeachers(): Promise<number> {
  try {
    const res = await db("users")
      .where("role", "teacher")
      .whereNot("lifecycle_status", "soft_deleted")
      .count("id as count")
      .first();
    return Number(res?.count || 0);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Database error counting teachers",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function getUserById(id: string) {
  if (!id) {
    throw new AppError("User ID is required.", "ERR_VALIDATION", 400);
  }

  try {
    const user = await db("users")
      .where("id", id)
      .whereNot("lifecycle_status", "soft_deleted")
      .first();

    if (!user) {
      throw new AppError(
        `User with ID ${id} not found.`,
        "ERR_USER_NOT_FOUND",
        404,
      );
    }

    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error getting user",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function createUser(input: UserInput) {
  // 1. Manual Validation
  if (
    !input.name ||
    !input.email ||
    !input.username ||
    !input.password ||
    !input.role
  ) {
    throw new AppError(
      "Missing required fields: name, email, username, password, and role are required.",
      "ERR_VALIDATION",
      400,
    );
  }

  const allowedRoles = ["administrator", "admin", "teacher"];
  if (!allowedRoles.includes(input.role)) {
    throw new AppError(
      "Invalid role. Role must be administrator, admin, or teacher.",
      "ERR_VALIDATION",
      400,
    );
  }

  if (
    input.email.length > 191 ||
    input.username.length > 191 ||
    input.name.length > 191
  ) {
    throw new AppError(
      "Input fields too long (max 191 characters).",
      "ERR_VALIDATION",
      400,
    );
  }

  try {
    // 2. Check unique constraint
    await validateUserIdentifiers(input.email, input.username);

    // 3. Hash password
    const saltRounds = process.env.SESSION_HASH_SALT
      ? parseInt(process.env.SESSION_HASH_SALT)
      : 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);
    const userId = uuidv4();

    // 4. Insert user
    const newUser = {
      id: userId,
      name: input.name,
      email: input.email,
      username: input.username,
      password_hash: passwordHash,
      role: input.role,
      phone: input.phone || null,
      status: "active",
      lifecycle_status: "active",
    };

    await db("users").insert(newUser);

    if (input.role === "teacher") {
      const profileId = uuidv4();
      await db("teacher_profiles").insert({
        id: profileId,
        user_id: userId,
        full_name: input.name,
        gender: "L",
        phone: input.phone || null,
        address: null,
        nip: null,
        nuptk: null,
        position: "Guru",
        status: "active",
        lifecycle_status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    const { password_hash, ...sanitizedUser } = newUser;
    return sanitizedUser;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error creating user",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function updateUser(
  id: string,
  input: Partial<Omit<UserInput, "password">>,
) {
  if (!id) {
    throw new AppError("User ID is required.", "ERR_VALIDATION", 400);
  }

  try {
    // Verify user exists
    const user = await db("users").where("id", id).first();
    if (!user) {
      throw new AppError(
        `User with ID ${id} not found.`,
        "ERR_USER_NOT_FOUND",
        404,
      );
    }
    const oldRole = user.role;

    const patch: any = {};

    if (input.name !== undefined) {
      if (!input.name.trim())
        throw new AppError("Name cannot be empty.", "ERR_VALIDATION", 400);
      patch.name = input.name;
    }

    if (input.role !== undefined) {
      const allowedRoles = ["administrator", "admin", "teacher"];
      if (!allowedRoles.includes(input.role)) {
        throw new AppError(
          "Invalid role. Role must be administrator, admin, or teacher.",
          "ERR_VALIDATION",
          400,
        );
      }
      patch.role = input.role;
    }

    if (input.phone !== undefined) {
      patch.phone = input.phone || null;
    }

    if (input.email !== undefined) {
      if (!input.email.trim())
        throw new AppError("Email cannot be empty.", "ERR_VALIDATION", 400);

      // Check unique
      await validateUserIdentifiers(input.email, undefined, id);
      patch.email = input.email;
    }

    if (input.username !== undefined) {
      if (!input.username.trim())
        throw new AppError("Username cannot be empty.", "ERR_VALIDATION", 400);

      // Check unique
      await validateUserIdentifiers(undefined, input.username, id);
      patch.username = input.username;
    }

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date();
      const roleChanged = patch.role && patch.role !== oldRole;
      
      if (roleChanged) {
        await db.transaction(async (trx: any) => {
          await trx("users").where("id", id).update(patch);
          
          await trx("staff_sessions")
            .where("user_id", id)
            .where("lifecycle_status", "active")
            .update({
              lifecycle_status: "inactive",
              revoked_at: new Date(),
              updated_at: new Date()
            });
        });
        
        await logAuthenticationEvent(
          user.username,
          oldRole,
          'session_revoked_role_change',
          true,
          undefined,
          undefined,
          `Sessions revoked due to role change from ${oldRole} to ${patch.role}.`
        );
      } else {
        await db("users").where("id", id).update(patch);
      }
    }

    return await getUserById(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error updating user",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
  revocationReason: 'session_revoked_password_change' | 'session_revoked_password_reset' = 'session_revoked_password_reset',
  ip?: string,
  userAgent?: string
) {
  if (!id || !newPassword) {
    throw new AppError(
      "User ID and new password are required.",
      "ERR_VALIDATION",
      400,
    );
  }

  try {
    const user = await db("users").where("id", id).first();
    if (!user) {
      throw new AppError(
        `User with ID ${id} not found.`,
        "ERR_USER_NOT_FOUND",
        404,
      );
    }

    const saltRounds = process.env.SESSION_HASH_SALT
      ? parseInt(process.env.SESSION_HASH_SALT)
      : 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await db.transaction(async (trx: any) => {
      await trx("users").where("id", id).update({
        password_hash: passwordHash,
        updated_at: new Date(),
      });

      await trx("staff_sessions")
        .where("user_id", id)
        .where("lifecycle_status", "active")
        .update({
          lifecycle_status: "inactive",
          revoked_at: new Date(),
          updated_at: new Date()
        });
    });

    await logAuthenticationEvent(
      user.username,
      user.role,
      revocationReason,
      true,
      ip,
      userAgent,
      `Sessions revoked due to password ${revocationReason === 'session_revoked_password_change' ? 'change' : 'reset'}.`
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Database error resetting password",
      "ERR_DATABASE",
      500,
    );
  }
}

export async function setUserStatus(
  id: string,
  status: "active" | "inactive",
  actorId: string,
) {
  if (!id || !status || !actorId) {
    throw new AppError(
      "User ID, status, and actor ID are required.",
      "ERR_VALIDATION",
      400,
    );
  }

  if (status !== "active" && status !== "inactive") {
    throw new AppError(
      "Status must be active or inactive.",
      "ERR_VALIDATION",
      400,
    );
  }

  try {
    const user = await db("users").where("id", id).first();
    if (!user) {
      throw new AppError(
        `User with ID ${id} not found.`,
        "ERR_USER_NOT_FOUND",
        404,
      );
    }

    const patch: any = {
      status,
      lifecycle_status: status === "active" ? "active" : "inactive",
      updated_at: new Date(),
    };

    if (status === "inactive") {
      patch.suspended_at = new Date();
      patch.suspended_by = actorId;
    } else {
      patch.suspended_at = null;
      patch.suspended_by = null;
    }

    if (status === "inactive") {
      await db.transaction(async (trx: any) => {
        await trx("users").where("id", id).update(patch);
        
        await trx("staff_sessions")
          .where("user_id", id)
          .where("lifecycle_status", "active")
          .update({
            lifecycle_status: "inactive",
            revoked_at: new Date(),
            updated_at: new Date()
          });
      });
      
      await logAuthenticationEvent(
        user.username,
        user.role,
        'session_revoked_account_disabled',
        true,
        undefined,
        undefined,
        `Sessions revoked due to account inactivation.`
      );
    } else {
      await db("users").where("id", id).update(patch);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Database error setting user status",
      "ERR_DATABASE",
      500,
    );
  }
}
