import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getStudentKKTPReport } from "@/lib/services/kktpAssessmentService";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kktp/assessments/[id]/students/[studentId]
 * Returns single student KKTP assessment projection for review and print.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; studentId: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru", "parent"], req, async () => {
      try {
        const { id, studentId } = await context.params;
        const report = await getStudentKKTPReport(id, studentId);
        return successResponse(report, "Laporan KKTP murid berhasil dimuat.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal memuat laporan KKTP murid.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
