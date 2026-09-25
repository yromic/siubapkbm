import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getKKTPMatrixData } from "@/lib/services/kktpAssessmentService";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kktp/assessments/[id]/matrix
 * Returns full gradebook matrix with student rows, configured TP columns, and saved scores.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { id } = await context.params;
        const assessment = await db("kktp_assessments").where("id", id).first();
        if (!assessment) {
          throw new AppError("Asesmen KKTP tidak ditemukan.", "ERR_NOT_FOUND", 404);
        }

        const data = await getKKTPMatrixData({
          class_id: assessment.class_id,
          subject_id: assessment.subject_id,
          academic_year_id: assessment.academic_year_id,
          semester_id: assessment.semester_id,
          assessment_id: id,
        });

        return successResponse(data, "Matriks penilaian KKTP berhasil dimuat.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal memuat matriks KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
