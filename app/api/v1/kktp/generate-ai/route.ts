import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { generateKKTPAssesmentWithAI } from "@/lib/services/kktpAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();

        if (!body.catatanPengamatan?.trim()) {
          return errorResponse(
            "Catatan pengamatan murid wajib diisi sebelum melakukan analisis penilaian AI.",
            "ERR_VALIDATION",
            400
          );
        }

        if (!Array.isArray(body.tpItems) || body.tpItems.length === 0) {
          return errorResponse(
            "Pilih minimal 1 Tujuan Pembelajaran sebelum melakukan analisis penilaian AI.",
            "ERR_VALIDATION",
            400
          );
        }

        const result = await generateKKTPAssesmentWithAI({
          catatanPengamatan: body.catatanPengamatan,
          tpItems: body.tpItems,
          mataPelajaran: body.mataPelajaran || "Umum",
          kelasRombel: body.kelasRombel || "",
          namaMurid: body.namaMurid || undefined,
          userId: (req as any).user?.id,
        });

        return successResponse(result, "Asesmen KKTP berhasil dianalisis.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memproses analisis penilaian AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
