import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { reorderRpmAttachments } from "@/lib/services/rpmAttachmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    try {
      const { id } = await params;
      const user = (req as any).user;
      const body = await req.json();

      const orderedIds = body.orderedIds;
      if (!Array.isArray(orderedIds)) {
        return errorResponse("Parameter orderedIds harus berupa array string.", "ERR_VALIDATION", 400);
      }

      const result = await reorderRpmAttachments(id, orderedIds, user);
      return successResponse(result, "Urutan lampiran berhasil disimpan.");
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse("Gagal mengubah urutan lampiran.", "ERR_INTERNAL_SERVER", 500);
    }
  });
}
