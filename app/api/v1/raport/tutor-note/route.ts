import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { saveSemesterTutorNote } from "@/lib/services/raportTerpaduService";

export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/raport/tutor-note
 * Request Body:
 * {
 *   student_id: string;
 *   academic_year_id: string;
 *   semester_id: string;
 *   content: string;
 * }
 */
export async function PUT(req: NextRequest) {
  return withAuth(req, async () => {
    return withRole(
      ["administrator", "admin", "teacher", "guru"],
      req,
      async () => {
        try {
          const user = (req as any).user;
          const body = await req.json();
          const { student_id, academic_year_id, semester_id, content } = body;

          if (!student_id || !academicYearIdParam(academic_year_id) || !semester_id) {
            return errorResponse(
              "student_id, academic_year_id, dan semester_id wajib disertakan.",
              "ERR_VALIDATION",
              400
            );
          }

          if (typeof content !== "string") {
            return errorResponse(
              "content harus berupa string.",
              "ERR_VALIDATION",
              400
            );
          }

          const result = await saveSemesterTutorNote({
            studentId: student_id,
            academicYearId: academic_year_id,
            semesterId: semester_id,
            content,
            teacherUserId: user?.id,
          });

          return successResponse(
            result,
            "Catatan tutor pendamping semester berhasil disimpan."
          );
        } catch (error: any) {
          if (error instanceof AppError) {
            return errorResponse(error.message, error.code, error.statusCode);
          }
          return errorResponse(
            error instanceof Error
              ? error.message
              : "Gagal menyimpan catatan tutor pendamping.",
            "ERR_INTERNAL_SERVER",
            500
          );
        }
      }
    );
  });
}

function academicYearIdParam(val: any): boolean {
  return typeof val === "string" && val.trim().length > 0;
}
