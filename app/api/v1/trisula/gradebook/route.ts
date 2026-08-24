import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import {
  saveClassGradebookScores,
  getAssessmentDetail,
} from "@/lib/services/trisulaAssessmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const assessment_id = searchParams.get("assessment_id");

        if (!assessment_id) {
          return errorResponse("Parameter assessment_id wajib diisi.", "ERR_VALIDATION", 400);
        }

        const detail = await getAssessmentDetail(assessment_id);
        return successResponse(detail, "Data gradebook kelas berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat gradebook kelas.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();
        const { assessment_id, studentScores } = body;

        if (!assessment_id || !Array.isArray(studentScores)) {
          return errorResponse("Payload nilai gradebook tidak valid.", "ERR_VALIDATION", 400);
        }

        const result = await saveClassGradebookScores(
          assessment_id,
          studentScores,
          authenticatedReq.user?.id
        );

        const updatedDetail = await getAssessmentDetail(assessment_id);

        return successResponse(
          updatedDetail,
          `Nilai asesmen untuk ${result.savedCount} santri berhasil disimpan.`
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menyimpan nilai gradebook.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
