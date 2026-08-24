import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import {
  getStudentTrisulaReport,
  updateStudentTrisulaReport,
} from "@/lib/services/trisulaAssessmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const assessment_id = searchParams.get("assessment_id");
        const student_id = searchParams.get("student_id");

        if (!assessment_id || !student_id) {
          return errorResponse(
            "Parameter assessment_id dan student_id wajib diisi.",
            "ERR_VALIDATION",
            400
          );
        }

        const report = await getStudentTrisulaReport(assessment_id, student_id);
        return successResponse(report, "Data Raport Trisula santri berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat raport Trisula.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();
        const { assessment_id, student_id, ...narratives } = body;

        if (!assessment_id || !student_id) {
          return errorResponse(
            "Parameter assessment_id dan student_id wajib diisi.",
            "ERR_VALIDATION",
            400
          );
        }

        const updated = await updateStudentTrisulaReport(assessment_id, student_id, narratives);
        return successResponse(updated, "Narasi Raport Trisula berhasil diperbarui.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memperbarui narasi raport.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
