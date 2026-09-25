import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { saveKKTPMatrixScores } from "@/lib/services/kktpAssessmentService";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/kktp/assessments/[id]/scores
 * Transactionally saves/upserts student scores for the assessment matrix.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const { id } = await context.params;
        const body = await req.json();

        const studentScores = Array.isArray(body) ? body : body.studentScores;
        if (!Array.isArray(studentScores)) {
          return errorResponse("Payload harus berisi array studentScores.", "ERR_VALIDATION", 400);
        }

        const result = await saveKKTPMatrixScores(id, studentScores, user);
        return successResponse(result, "Nilai matriks KKTP berhasil disimpan.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal menyimpan nilai KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
