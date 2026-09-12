import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { archiveLetterhead } from "@/lib/services/appSettingsService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/letterheads/[id]/archive
 * Archive a specific letterhead version (soft-retire).
 *
 * - Cannot archive the currently ACTIVE version.
 * - Admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (req) => {
    return withRole(
      ["administrator", "admin"],
      req,
      async () => {
        try {
          const user = (req as any).user as { id: string; role: string };
          const { id } = await params;

          if (!id) {
            return errorResponse(
              "ID versi kop surat wajib diisi.",
              "ERR_VALIDATION",
              400
            );
          }

          const archived = await archiveLetterhead(id, user.id);

          return successResponse(
            archived,
            `Kop surat "${archived.name}" berhasil diarsipkan.`
          );
        } catch (error) {
          if (error instanceof AppError) {
            return errorResponse(error.message, error.code, error.statusCode);
          }
          return errorResponse(
            "Gagal mengarsipkan kop surat.",
            "ERR_INTERNAL_SERVER",
            500
          );
        }
      }
    );
  });
}
