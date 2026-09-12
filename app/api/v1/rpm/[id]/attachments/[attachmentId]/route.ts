import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import {
  updateRpmAttachmentMetadata,
  deleteRpmAttachment,
} from "@/lib/services/rpmAttachmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  return withAuth(req, async () => {
    try {
      const { id, attachmentId } = await params;
      const user = (req as any).user;
      const body = await req.json();

      const updated = await updateRpmAttachmentMetadata(
        id,
        attachmentId,
        {
          title: body.title,
          attachmentType: body.attachmentType || body.attachment_type || body.type,
          description: body.description,
          sortOrder: body.sortOrder !== undefined ? body.sortOrder : body.sort_order,
        },
        user
      );

      return successResponse(updated, "Metadata lampiran berhasil diperbarui.");
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse("Gagal memperbarui metadata lampiran.", "ERR_INTERNAL_SERVER", 500);
    }
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  return withAuth(req, async () => {
    try {
      const { id, attachmentId } = await params;
      const user = (req as any).user;

      const result = await deleteRpmAttachment(id, attachmentId, user);
      return successResponse(result, "Lampiran berhasil dihapus.");
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse("Gagal menghapus lampiran.", "ERR_INTERNAL_SERVER", 500);
    }
  });
}
