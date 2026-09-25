import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { analyzeLegacyKKTPData, executeAutoKKTPMigration } from "@/lib/services/kktpMigrationService";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kktp/migrate
 * Returns dry-run forensic analysis of legacy KKTP documents.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin"], req, async () => {
      try {
        const report = await analyzeLegacyKKTPData();
        return successResponse(report, "Analisis migrasi KKTP berhasil dihasilkan.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal menganalisis migrasi KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}

/**
 * POST /api/v1/kktp/migrate
 * Idempotently migrates AUTO_MIGRATABLE legacy KKTP documents into normalized tables.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin"], req, async () => {
      try {
        const result = await executeAutoKKTPMigration();
        return successResponse(result, "Migrasi KKTP berhasil dijalankan untuk grup yang memenuhi syarat.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal menjalankan migrasi KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
