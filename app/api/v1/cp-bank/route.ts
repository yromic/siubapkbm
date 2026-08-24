import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { listBankCPs, createBankCP, seedInitialTrisulaCurriculum } from "@/lib/services/cpBankService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const mata_pelajaran_id = searchParams.get("mata_pelajaran_id") || undefined;
        const mata_pelajaran_name = searchParams.get("mata_pelajaran_name") || undefined;
        const fase = searchParams.get("fase") || undefined;
        const class_level = searchParams.get("class_level") || undefined;
        const domain_trisula = searchParams.get("domain_trisula") || undefined;
        const sumber = searchParams.get("sumber") || undefined;
        const search = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "50", 10);

        const result = await listBankCPs(
          {
            mata_pelajaran_id,
            mata_pelajaran_name,
            fase,
            class_level,
            domain_trisula,
            sumber,
            status,
            search,
          },
          page,
          limit
        );

        return successResponse(result, "Daftar Bank CP berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat Bank CP.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();
        const userId = authenticatedReq.user.id;

        // Special action: seed Trisula default curriculum
        if (body.action === "seed_trisula") {
          const seedResult = await seedInitialTrisulaCurriculum();
          return successResponse(seedResult, "Kurikulum Trisula BLC berhasil diselaraskan ke Bank CP & TP.");
        }

        if (!body.teks || body.teks.trim().length < 5) {
          return errorResponse("Teks Capaian Pembelajaran (CP) minimal 5 karakter.", "ERR_VALIDATION", 400);
        }

        const newCP = await createBankCP(
          {
            teks: body.teks,
            kode: body.kode,
            fase: body.fase,
            class_level: body.class_level,
            mata_pelajaran_id: body.mata_pelajaran_id,
            mata_pelajaran_name: body.mata_pelajaran_name,
            domain_trisula: body.domain_trisula,
            sumber: body.sumber || "MANUAL",
          },
          userId
        );

        return successResponse(newCP, "Capaian Pembelajaran (CP) berhasil ditambahkan ke bank.", 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menyimpan CP ke bank.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
