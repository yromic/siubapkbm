import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { synthesizeTrisulaReportWithAI } from "@/lib/services/trisulaAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();

        if (!body.studentName) {
          return errorResponse("Nama santri wajib diisi.", "ERR_VALIDATION", 400);
        }

        const result = await synthesizeTrisulaReportWithAI({
          studentName: body.studentName,
          className: body.className || "Kelas",
          fase: body.fase || "Fase C",
          scores: body.scores || {},
          descriptions: body.descriptions || {},
          target: body.target || "ALL",
          userId: authenticatedReq.user?.id,
        });

        return successResponse(result, "Narasi perkembangan berhasil dirumuskan.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menyusun narasi raport AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
