import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { getOrCreateKKTPAssessment } from "@/lib/services/kktpAssessmentService";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kktp/assessments
 * Lists assessments filtered by class_id, subject_id, semester_id.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const class_id = searchParams.get("class_id");
        const subject_id = searchParams.get("subject_id");
        const semester_id = searchParams.get("semester_id");

        const query = db("kktp_assessments")
          .join("classes", "kktp_assessments.class_id", "classes.id")
          .join("subjects", "kktp_assessments.subject_id", "subjects.id")
          .join("academic_years", "kktp_assessments.academic_year_id", "academic_years.id")
          .join("semesters", "kktp_assessments.semester_id", "semesters.id")
          .select(
            "kktp_assessments.*",
            "classes.name as class_name",
            "subjects.name as subject_name",
            "academic_years.name as academic_year_name",
            "semesters.name as semester_name"
          );

        if (class_id) query.where("kktp_assessments.class_id", class_id);
        if (subject_id) query.where("kktp_assessments.subject_id", subject_id);
        if (semester_id) query.where("kktp_assessments.semester_id", semester_id);

        const items = await query.orderBy("kktp_assessments.updated_at", "desc");
        return successResponse({ items, total: items.length }, "Daftar asesmen KKTP berhasil dimuat.");
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal memuat asesmen KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}

/**
 * POST /api/v1/kktp/assessments
 * Gets or creates a canonical KKTP assessment session for a Class × Subject × Period.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(["administrator", "admin", "teacher", "guru"], req, async () => {
      try {
        const user = (req as any).user as { id: string; role: string };
        const body = await req.json();

        const assessment = await getOrCreateKKTPAssessment({
          class_id: body.class_id,
          subject_id: body.subject_id,
          academic_year_id: body.academic_year_id,
          semester_id: body.semester_id,
          title: body.title,
          userId: user.id,
        });

        return successResponse(assessment, "Sesi asesmen KKTP berhasil dibuka/dibuat.", 201);
      } catch (error: any) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(error?.message || "Gagal membuka sesi asesmen KKTP.", "ERR_INTERNAL_SERVER", 500);
      }
    });
  });
}
