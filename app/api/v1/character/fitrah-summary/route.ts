import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { calculateFitrah } from "@/lib/services/legacy/fitrahCalculationService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

import { withRole } from "@/lib/middleware/withRole";
import { db } from "@/lib/db";
import type { Knex } from "knex";

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get("studentId") || searchParams.get("student_id");
        const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");

        if (!studentId || !semesterId) {
          return errorResponse(
            "studentId and semesterId query parameters are required.",
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

        const fitrahData = await calculateFitrah(studentId, semesterId);

        return successResponse(
          fitrahData,
          "FITRAH summary calculated successfully."
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Error calculating FITRAH summary.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

