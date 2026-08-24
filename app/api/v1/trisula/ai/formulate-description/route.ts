import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { formulateTrisulaDescriptionWithAI } from "@/lib/services/trisulaAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();

        if (typeof body.score !== "number" || isNaN(body.score)) {
          return errorResponse("Nilai numerik wajib diisi.", "ERR_VALIDATION", 400);
        }

        if (!body.studentName || !body.pillar) {
          return errorResponse("Nama santri dan pilar Trisula wajib diisi.", "ERR_VALIDATION", 400);
        }

        const result = await formulateTrisulaDescriptionWithAI({
          studentName: body.studentName,
          pillar: body.pillar,
          fase: body.fase || "Fase C",
          score: body.score,
          cpText: body.cpText || null,
          tps: Array.isArray(body.tps) ? body.tps : [],
          userId: authenticatedReq.user?.id,
        });

        return successResponse(result, "Deskripsi capaian berhasil dirumuskan.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal merumuskan deskripsi AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
