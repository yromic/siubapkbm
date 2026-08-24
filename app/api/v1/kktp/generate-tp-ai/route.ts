import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { generateTPSuggestionsWithAI } from "@/lib/services/kktpAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();

        if (!body.topikMateri || !body.topikMateri.trim()) {
          return errorResponse(
            "Topik atau materi pembelajaran wajib diisi.",
            "ERR_VALIDATION",
            400
          );
        }

        const result = await generateTPSuggestionsWithAI({
          topikMateri: body.topikMateri,
          mataPelajaran: body.mataPelajaran || "Mata Pelajaran Umum",
          tingkatFase: body.tingkatFase || "Fase C",
          cpTeks: body.cpTeks || body.cpText || undefined,
          cpId: body.cpId || body.cp_id || undefined,
          userId: (req as any).user?.id,
        });

        return successResponse(result, "Saran Tujuan Pembelajaran berhasil diproses.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memproses saran TP dari AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
