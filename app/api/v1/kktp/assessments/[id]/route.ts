import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getKKTPAssessmentDetail } from "@/lib/services/kktpAssessmentService";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kktp/assessments/[id]
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { id } = await context.params;
        const detail = await getKKTPAssessmentDetail(id);
        return successResponse(detail, "Detail asesmen KKTP berhasil dimuat.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal memuat detail asesmen KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}

/**
 * PUT /api/v1/kktp/assessments/[id]
 * Updates metadata (title, status, letterhead_version_id).
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { id } = await context.params;
        const body = await req.json();

        const patch: Record<string, any> = { updated_at: new Date() };
        if (body.title !== undefined) patch.title = body.title;
        if (body.status !== undefined) patch.status = body.status;
        if (body.letterhead_version_id !== undefined) patch.letterhead_version_id = body.letterhead_version_id;

        await db("kktp_assessments").where("id", id).update(patch);
        const updated = await getKKTPAssessmentDetail(id);
        return successResponse(updated, "Asesmen KKTP berhasil diperbarui.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal memperbarui asesmen KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
