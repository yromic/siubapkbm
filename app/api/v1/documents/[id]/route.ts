import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { getDocumentById, updateDocument, updateDocumentStatus, deleteDocument } from "@/lib/services/documentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {
      try {
        const { id } = await params;
        const user = (req as any).user;
        const result = await getDocumentById(id, user);
        return successResponse(result, "Detail dokumen berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse("Gagal mengambil detail dokumen.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {

      try {
        const { id } = await params;
        const user = (req as any).user;
        const body = await req.json();

        if (body.action) {
          // Status change action (termasuk SIGN, SHARE_TO_BLC, UNSHARE_FROM_BLC untuk RPM)
          const result = await updateDocumentStatus(id, body.action, user);
          return successResponse(result, "Status dokumen berhasil diperbarui.");
        }

        const result = await updateDocument(id, body, user);
        // Sertakan signatureResetWarning ke response agar frontend bisa tampilkan toast
        const message = (result as any).signatureResetWarning
          ? "Dokumen berhasil diperbarui. Tanda tangan resmi telah direset karena ada perubahan konten."
          : "Dokumen berhasil diperbarui.";
        return successResponse(result, message);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse("Gagal memperbarui dokumen.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {
      try {
        const { id } = await params;
        const user = (req as any).user;
        const result = await deleteDocument(id, user);
        return successResponse(result, "Dokumen berhasil dihapus.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse("Gagal menghapus dokumen.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
