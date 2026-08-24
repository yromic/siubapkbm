import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { bundleSemesterPackage } from "@/lib/services/documentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const user = (req as any).user;
        const subject_id = searchParams.get("subject_id") || undefined;
        const class_id = searchParams.get("class_id") || undefined;
        const semester_id = searchParams.get("semester_id") || undefined;

        const result = await bundleSemesterPackage({ subject_id, class_id, semester_id }, user);
        return successResponse(result, "Paket semester berhasil digabungkan.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse("Gagal membuat paket semester.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
