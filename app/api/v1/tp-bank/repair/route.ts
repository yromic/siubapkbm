import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { repairLegacyCorruptedPhases } from "@/lib/services/tpBankService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin"], req, async () => {
      try {
        const report = await repairLegacyCorruptedPhases();
        return successResponse(report, "Remediasi data legacy Bank TP berhasil dieksekusi.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menjalankan remediasi data legacy Bank TP.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
