import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { getUTSMANSummary, calculateAndSaveUTSMAN } from "@/lib/services/utsmanCalculationService";
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

      // 1. Check existing record
      let summary = await getUTSMANSummary(studentId, semesterId);

      // 2. If not found, calculate and save
      if (!summary) {
        summary = await calculateAndSaveUTSMAN(studentId, semesterId);
      }

      return successResponse(
        {
          student_id: summary.student_id,
          semester_id: summary.semester_id,
          u_score: summary.u_score !== null ? Number(summary.u_score) : 0,
          t_score: summary.t_score !== null ? Number(summary.t_score) : 0,
          s_score: summary.s_score !== null ? Number(summary.s_score) : 0,
          m_score: summary.m_score !== null ? Number(summary.m_score) : 0,
          a_score: summary.a_score !== null ? Number(summary.a_score) : 0,
          n_score: summary.n_score !== null ? Number(summary.n_score) : 0,
          calculation_version: summary.calculation_version || "v1.0",
        },
        "UTSMAN summary retrieved successfully."
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Error retrieving UTSMAN summary.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
  });
}
