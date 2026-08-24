import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { listBankTPs, autoSaveTPsToBank, createManualBankTP, deleteBankTP } from "@/lib/services/tpBankService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const cp_id = searchParams.get("cp_id") || undefined;
        const mata_pelajaran_id = searchParams.get("mata_pelajaran_id") || undefined;
        const mata_pelajaran_name = searchParams.get("mata_pelajaran_name") || undefined;
        const fase = searchParams.get("fase") || undefined;
        const class_level = searchParams.get("class_level") || undefined;
        const sumber = searchParams.get("sumber") || undefined;
        const search = searchParams.get("search") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "50", 10);

        const result = await listBankTPs(
          { cp_id, mata_pelajaran_id, mata_pelajaran_name, fase, class_level, sumber, search },
          page,
          limit
        );

        return successResponse(result, "Daftar Bank TP berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat Bank TP.",
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

        // Mode 1: Single manual TP creation with explicit CP linking
        if (body.teks && !Array.isArray(body.tps)) {
          const newTP = await createManualBankTP({
            teks: body.teks,
            cp_id: body.cp_id || null,
            mata_pelajaran_id: body.mata_pelajaran_id || null,
            mata_pelajaran_name: body.mata_pelajaran_name || null,
            fase: body.fase || undefined,
            class_level: body.class_level || undefined,
            userId,
          });
          return successResponse(newTP, "Tujuan Pembelajaran (TP) berhasil ditambahkan ke bank.", 201);
        }

        // Mode 2: Batch auto-save
        const tps = Array.isArray(body.tps) ? body.tps : [];
        if (tps.length === 0) {
          return errorResponse("Data TP tidak valid atau kosong.", "ERR_VALIDATION", 400);
        }

        const result = await autoSaveTPsToBank({
          tps,
          mata_pelajaran_id: body.mata_pelajaran_id || null,
          mata_pelajaran_name: body.mata_pelajaran_name || null,
          fase: body.fase || "Fase C",
          cp_id: body.cp_id || null,
          userId,
        });

        return successResponse(
          result,
          `${result.savedCount} TP baru berhasil disimpan ke bank (${result.existingCount} sudah ada).`,
          201
        );
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menyimpan TP ke bank.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
          return errorResponse("Parameter ID TP wajib diisi.", "ERR_VALIDATION", 400);
        }

        await deleteBankTP(id, authenticatedReq.user);
        return successResponse(null, "Tujuan Pembelajaran berhasil dihapus dari bank.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menghapus TP dari bank.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
