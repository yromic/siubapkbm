import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { db } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

/**
 * POST /api/v1/character/semester-lock
 *
 * Locks or unlocks the character_utsman_semester_summary for a given semester,
 * preventing further recalculation and culture_score edits.
 *
 * Payload: { semesterId: string, action: "lock" | "unlock" }
 *
 * Permission: admin or administrator only.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const user = (req as any).user;
      const normRole = (user?.role || "").toLowerCase().trim();

      if (normRole !== "admin" && normRole !== "administrator") {
        return errorResponse(
          "Only admin or administrator can lock/unlock character semester summary.",
          "ERR_FORBIDDEN",
          403
        );
      }

      const body = await req.json();
      const { semesterId, action } = body || {};

      if (!semesterId || !action) {
        return errorResponse(
          "semesterId and action ('lock' | 'unlock') are required.",
          "ERR_VALIDATION",
          400
        );
      }

      if (action !== "lock" && action !== "unlock") {
        return errorResponse(
          "action must be 'lock' or 'unlock'.",
          "ERR_VALIDATION",
          400
        );
      }

      // Verify semester exists
      const semester = await db("semesters")
        .where("id", semesterId)
        .whereNot("lifecycle_status", "soft_deleted")
        .first();

      if (!semester) {
        return errorResponse(
          `Semester with ID ${semesterId} not found.`,
          "ERR_NOT_FOUND",
          404
        );
      }

      if (action === "lock") {
        // Lock all UTSMAN summaries for this semester that are not yet locked
        const now = new Date();
        const updated = await db("character_utsman_semester_summary")
          .where("semester_id", semesterId)
          .whereNull("locked_at")
          .update({
            locked_at: now,
            updated_at: now,
          });

        return successResponse(
          {
            semester_id: semesterId,
            semester_name: semester.name,
            action: "lock",
            records_locked: updated,
            locked_at: now.toISOString(),
          },
          `Character semester locked. ${updated} ringkasan siswa berhasil dikunci.`
        );
      } else {
        // Unlock: clear locked_at for all summaries for this semester
        const now = new Date();
        const updated = await db("character_utsman_semester_summary")
          .where("semester_id", semesterId)
          .whereNotNull("locked_at")
          .update({
            locked_at: null,
            updated_at: now,
          });

        return successResponse(
          {
            semester_id: semesterId,
            semester_name: semester.name,
            action: "unlock",
            records_unlocked: updated,
            unlocked_at: now.toISOString(),
          },
          `Character semester unlocked. ${updated} ringkasan siswa berhasil dibuka kembali.`
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Error processing semester lock.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
  });
}

/**
 * GET /api/v1/character/semester-lock?semesterId=...
 *
 * Returns lock status for a semester: how many students are locked, unlocked.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");

      if (!semesterId) {
        return errorResponse("semesterId query parameter is required.", "ERR_VALIDATION", 400);
      }

      const semester = await db("semesters")
        .where("id", semesterId)
        .whereNot("lifecycle_status", "soft_deleted")
        .first();

      if (!semester) {
        return errorResponse(`Semester with ID ${semesterId} not found.`, "ERR_NOT_FOUND", 404);
      }

      const totalRes = await db("character_utsman_semester_summary")
        .where("semester_id", semesterId)
        .count("id as count")
        .first();

      const lockedRes = await db("character_utsman_semester_summary")
        .where("semester_id", semesterId)
        .whereNotNull("locked_at")
        .count("id as count")
        .first();

      const total = Number(totalRes?.count || 0);
      const locked = Number(lockedRes?.count || 0);

      return successResponse(
        {
          semester_id: semesterId,
          semester_name: semester.name,
          total_summaries: total,
          locked_summaries: locked,
          unlocked_summaries: total - locked,
          is_fully_locked: total > 0 && locked === total,
        },
        "Semester lock status retrieved."
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Error retrieving semester lock status.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
  });
}
