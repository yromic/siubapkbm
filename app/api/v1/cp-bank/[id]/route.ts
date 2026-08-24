import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { getCPById, updateBankCP, deleteBankCP } from "@/lib/services/cpBankService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const id = params.id;
        const result = await getCPById(id);
        if (!result) {
          return errorResponse("Capaian Pembelajaran (CP) tidak ditemukan.", "ERR_NOT_FOUND", 404);
        }
        return successResponse(result, "Detail CP berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat detail CP.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const id = params.id;
        const body = await req.json();
        const user = authenticatedReq.user;

        const updated = await updateBankCP(
          id,
          {
            teks: body.teks,
            kode: body.kode,
            fase: body.fase,
            mata_pelajaran_id: body.mata_pelajaran_id,
            mata_pelajaran_name: body.mata_pelajaran_name,
            domain_trisula: body.domain_trisula,
            status: body.status,
          },
          user
        );

        return successResponse(updated, "Capaian Pembelajaran (CP) berhasil diperbarui.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memperbarui CP.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const id = params.id;
        const user = authenticatedReq.user;

        const result = await deleteBankCP(id, user);
        return successResponse(result, result.message);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menghapus CP.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
