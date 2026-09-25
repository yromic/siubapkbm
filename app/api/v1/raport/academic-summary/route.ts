import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getRaportTerpaduAcademicSummary } from "@/lib/services/raportTerpaduService";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/raport/academic-summary
 * Query Params:
 * - student_id (required)
 * - academic_year_id (optional, defaults to active)
 * - semester_id (optional, defaults to active)
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(
      ["administrator", "admin", "teacher", "guru"],
      req,
      async () => {
        try {
          const { searchParams } = new URL(req.url);
          const studentId = searchParams.get("student_id");
          const academicYearId = searchParams.get("academic_year_id") || undefined;
          const semesterId = searchParams.get("semester_id") || undefined;

          if (!studentId) {
            return errorResponse(
              "Parameter student_id wajib disertakan.",
              "ERR_VALIDATION",
              400
            );
          }

          const report = await getRaportTerpaduAcademicSummary({
            studentId,
            academicYearId,
            semesterId,
          });

          return successResponse(
            report,
            "Ringkasan Akademik Raport Terpadu (Lembar 1) berhasil dimuat."
          );
        } catch (error: any) {
          if (error instanceof AppError) {
            return errorResponse(error.message, error.code, error.statusCode);
          }
          return errorResponse(
            error instanceof Error
              ? error.message
              : "Gagal memuat ringkasan akademik raport.",
            "ERR_INTERNAL_SERVER",
            500
          );
        }
      }
    );
  });
}
