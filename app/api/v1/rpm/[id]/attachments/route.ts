import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import {
  listRpmAttachments,
  uploadRpmAttachment,
} from "@/lib/services/rpmAttachmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { RPMAttachmentType } from "@/types/rpmAttachment";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    try {
      const { id } = await params;
      const user = (req as any).user;
      const attachments = await listRpmAttachments(id, user);
      return successResponse(attachments, "Daftar lampiran RPM berhasil dimuat.");
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse("Gagal memuat daftar lampiran.", "ERR_INTERNAL_SERVER", 500);
    }
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    try {
      const { id } = await params;
      const user = (req as any).user;
      const formData = await req.formData();
      const file = formData.get("file") as (File | Blob | null);
      const attachmentType = (formData.get("attachment_type") || formData.get("type") || "LKPD") as RPMAttachmentType;
      const title = (formData.get("title") as string | null) || undefined;
      const description = (formData.get("description") as string | null) || undefined;

      if (!file) {
        return errorResponse("Berkas file lampiran wajib dipilih.", "ERR_VALIDATION", 400);
      }

      const result = await uploadRpmAttachment(
        id,
        file,
        { attachmentType, title, description },
        user
      );

      return successResponse(result, "Lampiran berhasil diunggah.", 201);
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Gagal mengunggah lampiran.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
  });
}
