import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { generateRPMContentWithAI } from "@/lib/services/rpmAiService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {

      try {
        const body = await req.json();

        if (!body.mataPelajaran || !body.modulTopik) {
          return errorResponse(
            "Mata pelajaran dan topik/modul wajib diisi.",
            "ERR_VALIDATION",
            400
          );
        }

        const alokasiWaktu = Number(body.alokasiWaktu) || 70;

        const result = await generateRPMContentWithAI({
          target: body.target || "ALL",
          mataPelajaran: body.mataPelajaran,
          kelasRombel: body.kelasRombel || "Kelas 5",
          tingkatFase: body.tingkatFase || "Fase C",
          alokasiWaktu,
          modulTopik: body.modulTopik,
          userId: (req as any).user?.id,
          semester: body.semester,
          academicYear: body.academicYear,
          capaianPembelajaran: body.capaianPembelajaran,
          tujuanPembelajaran: Array.isArray(body.tujuanPembelajaran) ? body.tujuanPembelajaran : undefined,
          karakterFitrah: Array.isArray(body.karakterFitrah) ? body.karakterFitrah : undefined,
        });

        return successResponse(result, "Rancangan RPM berhasil diproses.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memproses permintaan AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
