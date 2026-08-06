import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { db } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
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

      // 1. Calculate total distinct week_start_date completed for this student & semester
      const countRes = await db("culture_scores")
        .where({ student_id: studentId, semester_id: semesterId })
        .whereNot("lifecycle_status", "soft_deleted")
        .countDistinct("week_start_date as count")
        .first();

      const completedWeeks = Number(countRes?.count || 0);

      // 2. Fetch semester dates to calculate total effective weeks in semester
      const semester = await db("semesters")
        .where("id", semesterId)
        .whereNot("lifecycle_status", "soft_deleted")
        .first();

      let totalWeeks = 18; // Default standard semester weeks

      if (semester && semester.start_date && semester.end_date) {
        const start = new Date(semester.start_date).getTime();
        const end = new Date(semester.end_date).getTime();
        if (end > start) {
          const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          const calculatedWeeks = Math.ceil(diffDays / 7);
          if (calculatedWeeks > 0) {
            totalWeeks = calculatedWeeks;
          }
        }
      }

      const percentage = totalWeeks > 0
        ? Math.round(((completedWeeks / totalWeeks) * 100 + Number.EPSILON) * 100) / 100
        : 0;

      return successResponse(
        {
          total_weeks: totalWeeks,
          completed_weeks: completedWeeks,
          percentage,
        },
        "Character weekly completeness calculated successfully."
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Error calculating weekly completeness.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
  });
}
