import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { generateTrisulaParagraphsWithAI } from "@/lib/services/rpmAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();

        if (!body.mataPelajaran || !body.modulTopik) {
          return errorResponse(
            "Mata pelajaran dan topik/modul pembelajaran wajib diisi.",
            "ERR_VALIDATION",
            400
          );
        }

        const result = await generateTrisulaParagraphsWithAI({
          mataPelajaran: body.mataPelajaran,
          tingkatFase: body.tingkatFase || "Fase C",
          kelasRombel: body.kelasRombel || "Kelas 5",
          modulTopik: body.modulTopik,
          tujuanPembelajaran: Array.isArray(body.tujuanPembelajaran) ? body.tujuanPembelajaran : undefined,
          kegiatanPembelajaran: body.kegiatanPembelajaran,
          alokasiWaktu: body.alokasiWaktu ? Number(body.alokasiWaktu) : undefined,
          userId: (req as any).user?.id,
        });

        return successResponse(result, "Rincian paragraf Trisula berhasil diproses.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memproses rincian Trisula dari AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
