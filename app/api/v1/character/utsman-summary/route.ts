import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { getUTSMANSummary, calculateAndSaveUTSMAN } from "@/lib/services/utsmanCalculationService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import type { Knex } from "knex";

export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const studentId = searchParams.get("studentId") || searchParams.get("student_id");
      const semesterId = searchParams.get("semesterId") || searchParams.get("semester_id");

      if (!studentId || !semesterId) {
        return errorResponse(
          "studentId and semesterId query parameters are required.",
          "ERR_VALIDATION",
          400
        );
      }

      // Authorization check for teachers: teacher must be assigned to student's class for this semester
      const actor = (req as unknown as { user?: { id: string; role: string } }).user;
      const actorId = actor?.id;
      const actorRole = actor?.role;
      if (actorRole === 'teacher' || actorRole === 'guru') {
        const isAuthorized = await db('student_enrollments')
          .join('class_teacher_assignments', (builder: Knex.JoinClause) => {
            builder.on('student_enrollments.class_id', '=', 'class_teacher_assignments.class_id')
              .andOn('student_enrollments.semester_id', '=', 'class_teacher_assignments.semester_id');
          })
          .where('student_enrollments.student_id', studentId)
          .where('student_enrollments.semester_id', semesterId)
          .whereNot('student_enrollments.lifecycle_status', 'soft_deleted')
          .where('class_teacher_assignments.teacher_user_id', actorId)
          .where('class_teacher_assignments.status', 'active')
          .whereNot('class_teacher_assignments.lifecycle_status', 'soft_deleted')
          .first();

        if (!isAuthorized) {
          return errorResponse(
            'You do not have permission to view the UTSMAN summary for this student.',
            'ERR_FORBIDDEN',
            403
          );
        }
      }

      // 1. Check existing record
      let summary = await getUTSMANSummary(studentId, semesterId);

      // 2. If not found, calculate and save
      if (!summary) {
        summary = await calculateAndSaveUTSMAN(studentId, semesterId);
      }

      return successResponse(
        {
          student_id: summary.student_id,
          semester_id: summary.semester_id,
          u_score: summary.u_score !== null ? Number(summary.u_score) : 0,
          t_score: summary.t_score !== null ? Number(summary.t_score) : 0,
          s_score: summary.s_score !== null ? Number(summary.s_score) : 0,
          m_score: summary.m_score !== null ? Number(summary.m_score) : 0,
          a_score: summary.a_score !== null ? Number(summary.a_score) : 0,
          n_score: summary.n_score !== null ? Number(summary.n_score) : 0,
          calculation_version: summary.calculation_version || "v1.0",
        },
        "UTSMAN summary retrieved successfully."
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : "Error retrieving UTSMAN summary.",
        "ERR_INTERNAL_SERVER",
        500
      );
    }
  });
}
