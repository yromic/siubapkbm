import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { db } from "@/lib/db";
import {
  getOrCreateAssessmentSession,
  saveAssessmentCurriculum,
  getAssessmentDetail,
} from "@/lib/services/trisulaAssessmentService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * SERVER-SIDE AUTHORIZATION HELPER
 * Verifies that a teacher is assigned to the given class.
 * Admin/Administrator bypass this check.
 */
async function verifyTeacherClassAccess(
  userId: string,
  role: string,
  classId: string
): Promise<boolean> {
  const isAdmin = role === "administrator" || role === "admin";
  if (isAdmin) return true;

  const assignment = await db("class_teacher_assignments")
    .where("teacher_user_id", userId)
    .where("class_id", classId)
    .where("status", "active")
    .whereNot("lifecycle_status", "soft_deleted")
    .first();

  return !!assignment;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get("class_id");
        const academic_year_id = searchParams.get("academic_year_id") || undefined;
        const semester_id = searchParams.get("semester_id") || undefined;
        const assessment_id = searchParams.get("assessment_id");

        if (assessment_id) {
          const detail = await getAssessmentDetail(assessment_id);
          return successResponse(detail, "Detail asesmen Trisula berhasil dimuat.");
        }

        if (!class_id) {
          return errorResponse("Parameter class_id wajib diisi.", "ERR_VALIDATION", 400);
        }

        // ── SERVER-SIDE AUTHORIZATION ────────────────────────────────────
        const hasAccess = await verifyTeacherClassAccess(user.id, user.role, class_id);
        if (!hasAccess) {
          return errorResponse(
            "Anda tidak memiliki akses ke kelas ini.",
            "ERR_FORBIDDEN",
            403
          );
        }

        const session = await getOrCreateAssessmentSession({
          class_id,
          academic_year_id,
          semester_id,
          userId: user.id,
        });

        const detail = await getAssessmentDetail(session.id);
        return successResponse(detail, "Sesi asesmen Trisula berhasil dimuat.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal memuat sesi asesmen Trisula.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher"], req, async () => {
      try {
        const body = await req.json();
        const { assessment_id, curriculum } = body;

        if (!assessment_id || !Array.isArray(curriculum)) {
          return errorResponse("Payload kurikulum tidak valid.", "ERR_VALIDATION", 400);
        }

        await saveAssessmentCurriculum(assessment_id, curriculum);
        const detail = await getAssessmentDetail(assessment_id);

        return successResponse(detail, "Kurikulum acuan asesmen Trisula berhasil disimpan.");
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : "Gagal menyimpan kurikulum asesmen.",
          "ERR_INTERNAL_SERVER",
          500
        );
      }
    });
  });
}
