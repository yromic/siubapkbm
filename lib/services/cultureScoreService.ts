import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { calculateAndSaveUTSMAN } from "./utsmanCalculationService";

export interface CultureScoreItem {
  student_id: string;
  week_start_date?: string | Date;
  week_end_date?: string | Date;
  sss_score?: number;
  am_score?: number;
  hb_score?: number;
  asm_score?: number;
  br_score?: number;
  ak_score?: number;
  tm_score?: number;
  observation_note?: string;
}

export interface SaveCultureScoresInput {
  class_id: string;
  academic_year_id?: string;
  semester_id: string;
  week_start_date: string;
  week_end_date: string;
  scores: CultureScoreItem[];
}

/**
 * Normalizes or validates that a date string/object falls on a Monday.
 * Returns the YYYY-MM-DD date string of the Monday.
 */
export function normalizeWeekStartDate(dateInput: string | Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new AppError("Invalid date format for week_start_date.", "ERR_VALIDATION", 400);
  }

  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = date.getDay();
  if (day !== 1) {
    throw new AppError(
      `week_start_date must be a Monday. Received date falling on day of week ${day}.`,
      "ERR_VALIDATION",
      400
    );
  }

  return date.toISOString().split("T")[0];
}

export async function saveCultureScores(input: SaveCultureScoresInput, actorId: string) {
  if (!input.class_id || !input.semester_id || !input.week_start_date || !input.week_end_date || !input.scores || !Array.isArray(input.scores)) {
    throw new AppError("Missing required fields (class_id, semester_id, week_start_date, week_end_date, scores).", "ERR_VALIDATION", 400);
  }

  // Validate week_start_date is a Monday
  const validWeekStart = normalizeWeekStartDate(input.week_start_date);
  const weekEndDateObj = new Date(input.week_end_date);
  if (isNaN(weekEndDateObj.getTime())) {
    throw new AppError("Invalid week_end_date format.", "ERR_VALIDATION", 400);
  }

  try {
    // 1. Ownership & Role check
    const actor = await db("users").where("id", actorId).first();
    if (!actor) {
      throw new AppError("Actor user not found.", "ERR_UNAUTHORIZED", 401);
    }

    const normRole = String(actor.role).toLowerCase().trim();

    if (normRole !== "administrator") {
      const assignmentQuery = db("class_teacher_assignments")
        .where({
          teacher_user_id: actorId,
          class_id: input.class_id,
          semester_id: input.semester_id,
          status: "active",
        })
        .whereNot("lifecycle_status", "soft_deleted");

      if (input.academic_year_id) {
        assignmentQuery.where("academic_year_id", input.academic_year_id);
      }

      const assignment = await assignmentQuery.first();

      if (!assignment) {
        throw new AppError(
          "Teacher is not assigned to this class for the specified period.",
          "ERR_TEACHER_NOT_ASSIGNED_TO_CLASS",
          403
        );
      }
    }

    // 2. Semester-level lock check (locked_at in character_utsman_semester_summary)
    // If the semester is locked by admin, culture score edits are blocked for everyone except administrator.
    if (normRole !== "administrator") {
      const semesterLocked = await db("character_utsman_semester_summary")
        .where("semester_id", input.semester_id)
        .whereNotNull("locked_at")
        .first();

      if (semesterLocked) {
        throw new AppError(
          "Semester karakter sudah dikunci oleh admin. Input nilai tidak diizinkan.",
          "ERR_SEMESTER_LOCKED",
          423 // HTTP 423 Locked
        );
      }
    }

    // 3. Lock period check based on week_end_date
    const now = new Date();
    const lockCheckEndDate = new Date(weekEndDateObj);
    lockCheckEndDate.setHours(23, 59, 59, 999);

    if (normRole !== "administrator") {
      const diffTime = now.getTime() - lockCheckEndDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (normRole === "teacher" || normRole === "guru") {
        if (diffDays > 7) {
          throw new AppError(
            "Periode pengisian nilai budaya untuk minggu ini sudah ditutup. Batas pengisian adalah 7 hari setelah akhir minggu. Hubungi administrator jika diperlukan.",
            "ERR_PERIOD_LOCKED",
            400
          );
        }
      } else if (normRole === "admin") {
        if (diffDays > 30) {
          throw new AppError(
            "Periode pengisian nilai budaya untuk minggu ini sudah ditutup. Batas pengisian untuk admin adalah 30 hari setelah akhir minggu.",
            "ERR_PERIOD_LOCKED",
            400
          );
        }
      } else {
        throw new AppError(
          "Periode pengisian tidak tersedia atau peran pengguna tidak dikenali. Hubungi administrator.",
          "ERR_PERIOD_LOCKED",
          400
        );
      }
    }


    const processedScores: any[] = [];

    // 3. Process score validation
    for (const item of input.scores) {
      if (!item.student_id) {
        throw new AppError("student_id is required for each score item.", "ERR_VALIDATION", 400);
      }

      // Explicit mapping and validation (integers 0-4)
      const scoreKeys = [
        { key: "sss", dbKey: "sss_score" },
        { key: "am", dbKey: "am_score" },
        { key: "hb", dbKey: "hb_score" },
        { key: "asm", dbKey: "asm_score" },
        { key: "br", dbKey: "br_score" },
        { key: "ak", dbKey: "ak_score" },
        { key: "tm", dbKey: "tm_score" },
      ];
      const scoreValues: Record<string, number> = {};

      for (const mapping of scoreKeys) {
        const val = (item as any)[mapping.key] !== undefined ? (item as any)[mapping.key] : (item as any)[mapping.dbKey];
        if (val !== undefined && val !== null && val !== "") {
          const num = Number(val);
          if (isNaN(num) || num < 0 || num > 4 || Math.floor(num) !== num) {
            throw new AppError(`Indicator score "${mapping.key}" must be an integer between 0 and 4. Received: ${val}`, "ERR_VALIDATION", 400);
          }
          scoreValues[mapping.dbKey] = num;
        } else {
          scoreValues[mapping.dbKey] = 0;
        }
      }

      // Verify active enrollment
      const enrollment = await db("student_enrollments")
        .where({
          student_id: item.student_id,
          class_id: input.class_id,
          semester_id: input.semester_id,
          status: "active",
        })
        .whereNot("lifecycle_status", "soft_deleted")
        .first();

      if (!enrollment) {
        throw new AppError(
          `Student with ID ${item.student_id} is not actively enrolled in this class and semester.`,
          "ERR_VALIDATION",
          400
        );
      }

      processedScores.push({
        student_id: item.student_id,
        enrollment_id: enrollment.id,
        observation_note: item.observation_note || null,
        ...scoreValues,
      });
    }

    // 4. Perform database transaction
    const results: any[] = [];
    await db.transaction(async (trx: any) => {
      for (const item of processedScores) {
        const existing = await trx("culture_scores")
          .where({
            student_id: item.student_id,
            week_start_date: validWeekStart,
            semester_id: input.semester_id,
          })
          .whereNot("lifecycle_status", "soft_deleted")
          .first();

        const dataToSave = {
          sss_score: item.sss_score,
          am_score: item.am_score,
          hb_score: item.hb_score,
          asm_score: item.asm_score,
          br_score: item.br_score,
          ak_score: item.ak_score,
          tm_score: item.tm_score,
          observation_note: item.observation_note,
          updated_at: new Date(),
        };

        if (existing) {
          await trx("culture_scores")
            .where("id", existing.id)
            .update(dataToSave);
          results.push({ ...existing, ...dataToSave });
        } else {
          const id = uuidv4();
          const newScore = {
            id,
            student_id: item.student_id,
            student_enrollment_id: item.enrollment_id,
            class_id: input.class_id,
            teacher_user_id: actorId,
            academic_year_id: input.academic_year_id || null,
            semester_id: input.semester_id,
            week_start_date: validWeekStart,
            week_end_date: input.week_end_date,
            ...dataToSave,
            status: "active",
            lifecycle_status: "active",
            created_at: new Date(),
          };
          await trx("culture_scores").insert(newScore);
          results.push(newScore);
        }
      }
    });

    // 5. Trigger calculateAndSaveUTSMAN for each student updated
    const studentIds = Array.from(new Set(processedScores.map((item) => item.student_id)));
    for (const studentId of studentIds) {
      try {
        await calculateAndSaveUTSMAN(studentId, input.semester_id);
      } catch (error) {
        console.error(`Failed to calculate UTSMAN summary for student ${studentId}:`, error);
      }
    }

    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error saving culture scores",
      "ERR_DATABASE",
      500
    );
  }
}

export async function listCultureScoresByWeek(weekStartDate: string, classId: string) {
  if (!weekStartDate || !classId) {
    throw new AppError("week_start_date (YYYY-MM-DD) and class_id are required.", "ERR_VALIDATION", 400);
  }

  try {
    const items = await db("culture_scores")
      .join("students", "culture_scores.student_id", "students.id")
      .where("culture_scores.class_id", classId)
      .where("culture_scores.week_start_date", weekStartDate)
      .whereNot("culture_scores.lifecycle_status", "soft_deleted")
      .select(
        "culture_scores.*",
        "students.full_name as student_name",
        "students.nisn as student_nisn"
      )
      .orderBy("students.full_name", "asc");

    return items;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error listing culture scores by week",
      "ERR_DATABASE",
      500
    );
  }
}

// Deprecated alias for backwards compatibility
export const listCultureScoresByDate = listCultureScoresByWeek;

export async function getStudentCultureScores(studentId: string, academicYearId?: string, semesterId?: string) {
  if (!studentId) {
    throw new AppError("Student ID is required.", "ERR_VALIDATION", 400);
  }

  try {
    const query = db("culture_scores")
      .where("student_id", studentId)
      .whereNot("lifecycle_status", "soft_deleted");

    if (semesterId) {
      query.where("semester_id", semesterId);
    }
    if (academicYearId) {
      query.where("academic_year_id", academicYearId);
    }

    const items = await query.orderBy("week_start_date", "asc");
    return items;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : "Database error getting student culture scores",
      "ERR_DATABASE",
      500
    );
  }
}

export async function getStudentsWithoutCultureScores(
  semesterId: string,
  limit = 50
): Promise<Array<{ id: string; full_name: string; nisn: string; reason: string }>> {
  if (!semesterId) return [];

  const rows = await db("student_enrollments")
    .join("students", "student_enrollments.student_id", "students.id")
    .leftJoin(
      db("culture_scores")
        .where("semester_id", semesterId)
        .whereNot("lifecycle_status", "soft_deleted")
        .select("student_id")
        .as("scored_students"),
      "students.id",
      "scored_students.student_id"
    )
    .where("student_enrollments.semester_id", semesterId)
    .where("student_enrollments.status", "active")
    .whereNot("student_enrollments.lifecycle_status", "soft_deleted")
    .whereNull("scored_students.student_id")
    .select(
      "students.id",
      "students.full_name",
      "students.nisn",
      db.raw("'no_culture_scores' as reason")
    )
    .groupBy("students.id", "students.full_name", "students.nisn")
    .limit(limit);

  return rows as Array<{ id: string; full_name: string; nisn: string; reason: string }>;
}
