import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { updateBankTP, deleteBankTP } from "@/lib/services/tpBankService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const body = await req.json();
        const user = authenticatedReq.user;

        const updated = await updateBankTP(
          id,
          {
            teks: body.teks,
            cp_id: body.cp_id,
            mata_pelajaran_id: body.mata_pelajaran_id,
            mata_pelajaran_name: body.mata_pelajaran_name,
            fase: body.fase,
          },
          user
        );

        return successResponse(updated, "Tujuan Pembelajaran berhasil diperbarui.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memperbarui Tujuan Pembelajaran.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const user = authenticatedReq.user;

        await deleteBankTP(id, { id: user.id, role: user.role });

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
