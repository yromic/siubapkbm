import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { db } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

const PROFILE_INDICATORS_MAP: Record<string, string[]> = {
  U: ["am_score", "ak_score"],
  T: ["ak_score"],
  S: ["sss_score", "hb_score"],
  M: ["br_score"],
  A: ["am_score", "asm_score"],
  N: ["hb_score", "tm_score"],
};

import { withRole } from "@/lib/middleware/withRole";
import type { Knex } from "knex";

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get("studentId") || searchParams.get("student_id");
        const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");
        const profile = (searchParams.get("profile") || "").toUpperCase().trim();

        if (!studentId || !semesterId || !profile) {
          return errorResponse(
            "studentId, semesterId, and profile query parameters are required.",
            "ERR_VALIDATION",
            400
          );
        }

        const actor = (req as unknown as { user?: { id: string; role: string } }).user;
        const actorId = actor?.id;
        const actorRole = actor?.role;
        if (actorRole === "teacher" || actorRole === "guru") {
          const isAuthorized = await db("student_enrollments")
            .join("class_teacher_assignments", (builder: Knex.JoinClause) => {
              builder.on("student_enrollments.class_id", "=", "class_teacher_assignments.class_id")
                .andOn("student_enrollments.semester_id", "=", "class_teacher_assignments.semester_id");
            })
            .where("student_enrollments.student_id", studentId)
            .where("student_enrollments.semester_id", semesterId)
            .whereNot("student_enrollments.lifecycle_status", "soft_deleted")
            .where("class_teacher_assignments.teacher_user_id", actorId)
            .where("class_teacher_assignments.status", "active")
            .whereNot("class_teacher_assignments.lifecycle_status", "soft_deleted")
            .first();

          if (!isAuthorized) {
            return errorResponse(
              "You do not have permission to view the character summary for this student.",
              "ERR_FORBIDDEN",
              403
            );
          }
        }

        const indicatorCols = PROFILE_INDICATORS_MAP[profile];
        if (!indicatorCols) {
          return errorResponse(
            `Invalid profile '${profile}'. Valid choices are: U, T, S, M, A, N.`,
            "ERR_VALIDATION",
            400
          );
        }


      // Build select query for indicator averages where score > 0
      const selectExprs = indicatorCols.map(
        (col) => `AVG(CASE WHEN ${col} > 0 THEN ${col} END) as avg_${col}`
      );

      const avgResult = await db("culture_scores")
        .where({ student_id: studentId, semester_id: semesterId })
        .whereNot("lifecycle_status", "soft_deleted")
        .select(selectExprs.map((expr) => db.raw(expr)))
        .first();

      const indicators = indicatorCols.map((col) => {
        const rawAvg = avgResult?.[`avg_${col}`];
        const val = rawAvg !== null && rawAvg !== undefined ? Number(rawAvg) : 0;
        const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
        return {
          code: col,
          average: rounded,
        };
      });

      return successResponse(
        {
          profile,
          indicators,
        },
        "SAHABAT breakdown retrieved successfully."
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Error retrieving SAHABAT breakdown.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
    });
  });
}

