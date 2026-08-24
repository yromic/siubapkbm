import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { deleteBankTP } from "@/lib/services/tpBankService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (authenticatedReq: any) => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { id } = await params;
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
