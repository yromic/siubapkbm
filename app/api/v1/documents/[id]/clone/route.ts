import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { cloneDocument } from "@/lib/services/documentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {
      try {
        const { id } = await params;
        const user = (req as any).user;

        const clonedDoc = await cloneDocument(id, user);
        return successResponse(clonedDoc, "Modul berhasil diduplikasi ke draf Anda.", 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse("Gagal menduplikasi modul.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
