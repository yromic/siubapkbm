import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { getTrisulaMatrixData } from "@/lib/services/trisulaAssessmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get("class_id");
        const academic_year_id = searchParams.get("academic_year_id") || undefined;
        const semester_id = searchParams.get("semester_id") || undefined;
        const assessment_id = searchParams.get("assessment_id") || undefined;

        if (!class_id && !assessment_id) {
          return errorResponse("Parameter class_id atau assessment_id wajib diisi.", "ERR_VALIDATION", 400);
        }

        const data = await getTrisulaMatrixData({
          class_id: class_id || "",
          academic_year_id,
          semester_id,
          assessment_id,
        });

        return successResponse(data, "Data Matriks Evaluasi Trisula berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat matriks Trisula.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
