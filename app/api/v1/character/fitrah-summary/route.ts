import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { calculateFitrah } from "@/lib/services/legacy/fitrahCalculationService";
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
}
