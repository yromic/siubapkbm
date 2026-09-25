import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { configureAssessmentTPs } from "@/lib/services/kktpAssessmentService";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kktp/assessments/[id]/tps
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { id } = await context.params;
        const tps = await db("kktp_assessment_tps")
          .where("assessment_id", id)
          .orderBy("order_index", "asc");

        return successResponse({ items: tps, total: tps.length }, "Daftar TP asesmen berhasil dimuat.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal memuat TP asesmen.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}

/**
 * POST /api/v1/kktp/assessments/[id]/tps
 * Replaces/configures the shared TP set for the assessment session.
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

        const tps = Array.isArray(body) ? body : body.tps;
        if (!Array.isArray(tps)) {
          return errorResponse("Payload harus berisi array tps.", "ERR_VALIDATION", 400);
        }

        const result = await configureAssessmentTPs(id, tps, user.id);
        return successResponse(result, "Konfigurasi TP asesmen berhasil disimpan.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal mengonfigurasi TP asesmen.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
