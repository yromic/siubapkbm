import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { evaluateTrisulaObservationWithAI } from "@/lib/services/trisulaAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();

        if (!body.observationText || !body.observationText.trim()) {
          return errorResponse("Catatan pengamatan guru wajib diisi.", "ERR_VALIDATION", 400);
        }

        if (!body.studentName || !body.pillar) {
          return errorResponse("Nama santri dan pilar Trisula wajib diisi.", "ERR_VALIDATION", 400);
        }

        const result = await evaluateTrisulaObservationWithAI({
          studentName: body.studentName,
          className: body.className || "Kelas",
          fase: body.fase || "Fase C",
          pillar: body.pillar,
          cpText: body.cpText || null,
          tps: Array.isArray(body.tps) ? body.tps : [],
          observationText: body.observationText.trim(),
          userId: authenticatedReq.user?.id,
        });

        return successResponse(result, "Evaluasi pengamatan guru berhasil diproses.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memproses evaluasi AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
