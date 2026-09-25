import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getClassRaportReadiness } from "@/lib/services/raportTerpaduService";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/raport/class-readiness
 * Query Params:
 * - class_id (required)
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
          const classId = searchParams.get("class_id");
          const academicYearId = searchParams.get("academic_year_id") || undefined;
          const semesterId = searchParams.get("semester_id") || undefined;

          if (!classId) {
            return errorResponse(
              "Parameter class_id wajib disertakan.",
              "ERR_VALIDATION",
              400
            );
          }

          const readiness = await getClassRaportReadiness({
            classId,
            academicYearId,
            semesterId,
          });

          return successResponse(
            readiness,
            "Status kesiapan raport kelas berhasil dimuat."
          );
        } catch (error: any) {
          if (error instanceof AppError) {
            return errorResponse(error.message, error.code, error.statusCode);
          }
          return errorResponse(
            error instanceof Error
              ? error.message
              : "Gagal memuat status kesiapan raport kelas.",
            "ERR_INTERNAL_SERVER",
            500
          );
        }
      }
    );
  });
}
