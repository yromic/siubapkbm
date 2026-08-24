import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { listDocuments, createDocument } from "@/lib/services/documentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const user = (req as any).user;
        const type = searchParams.get("type") || undefined;
        const status = searchParams.get("status") || undefined;
        const author_id = searchParams.get("author_id") || undefined;
        const class_id = searchParams.get("class_id") || undefined;
        const subject_id = searchParams.get("subject_id") || undefined;
        const semester_id = searchParams.get("semester_id") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);

        // RPM-BLC: Filter berbasis blc_shared_at (bukan status)
        const blc_shared = searchParams.get("blc_shared") === "true" ? true : undefined;
        // RPM-ADMIN: Filter RPM belum ditandatangani
        const unsigned = searchParams.get("unsigned") === "true" ? true : undefined;

        const result = await listDocuments(
          { type, status, author_id, class_id, subject_id, semester_id, blc_shared, unsigned },
          user,
          page,
          limit
        );
        return successResponse(result, "Daftar dokumen berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat daftar dokumen.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "operator", "teacher"], req, async () => {
      try {
        const user = (req as any).user;
        const body = await req.json();

        if (!body.title || !body.type) {
          return errorResponse("Judul dan tipe dokumen wajib diisi.", "ERR_VALIDATION", 400);
        }

        const result = await createDocument(body, user.id);
        return successResponse(result, "Dokumen berhasil dibuat.", 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal membuat dokumen.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
