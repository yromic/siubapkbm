import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { getAIUsageSnapshot } from "@/lib/services/aiUsageGuard";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const snapshot = await getAIUsageSnapshot();
        return successResponse(snapshot, "Ringkasan estimasi penggunaan AI lokal berhasil diambil.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat status penggunaan AI.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
