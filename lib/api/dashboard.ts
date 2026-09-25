import { apiRequest } from "./client";

export interface AdminDashboardAggregate {
  context: {
    active_academic_year: { id: string; name: string } | null;
    active_semester: { id: string; name: string } | null;
  };
  school_overview: {
    total_students: number;
    total_teachers: number;
    total_classes: number;
  };
  today: {
    date: string;
    student_attendance: {
      submitted_classes: number;
      unsubmitted_classes: number;
      total_classes: number;
      attendance_rate: number | null;
      counts: {
        hadir: number;
        sakit: number;
        izin: number;
        alpa: number;
        terlambat: number;
      };
      total_students_recorded: number;
      unsubmitted_classes_list: string[];
    };
    teacher_attendance: {
      attendance_rate: number | null;
      total_teachers: number;
      present_count: number;
      late_count: number;
    };
  };
  academic_completeness: {
    academic_scores: {
      final: number;
      belumFinal: number;
      belumIsi: number;
      total_targets: number;
      completion_percent: number | null;
    };
    culture: {
      lengkap: number;
      sebagian: number;
      kosong: number;
      total_classes: number;
      completion_percent: number;
    };
    kktp: {
      students_with_kktp: number;
      total_active_students: number;
      completion_percent: number;
    };
    rpm: {
      total_documents: number;
    };
    trisula: {
      draft_count: number;
      in_progress_count: number;
      finalized_count: number;
      total_assessments: number;
    };
  };
  actionable_alerts: Array<{
    id: string;
    priority: number;
    title: string;
    description: string;
    category: string;
    action_href: string;
  }>;
}

export interface TeacherDashboardAggregate {
  context: {
    teacher_id: string;
    teacher_name: string;
    teacher_email: string;
    active_academic_year: { id: string; name: string } | null;
    active_semester: { id: string; name: string } | null;
    perwalian_class: {
      class_id: string;
      class_name: string;
      class_code: string;
      class_level: string;
      student_count: number;
    } | null;
  };
  today: {
    date: string;
    student_attendance: {
      is_wali_kelas: boolean;
      is_submitted: boolean;
      counts: {
        hadir: number;
        sakit: number;
        izin: number;
        alpa: number;
        terlambat: number;
        total: number;
      } | null;
    };
    teacher_attendance: {
      checked_in: boolean;
      status: string;
      time_in: string | null;
    };
    culture: {
      coverage_percent: number;
      weeks_recorded: number;
    } | null;
  };
  pending_work: {
    draft_assessments_count: number;
    kktp_pending_count: number;
    rpm_count: number;
    trisula_draft_count: number;
  };
  class_overview: {
    student_count: number;
    attendance_rate: number | null;
    academic_progress_percent: number;
    completed_evaluations: number;
    total_evaluations: number;
    grade_distribution: Array<{
      name: string;
      count: number;
    }>;
  } | null;
}

export async function getAdminDashboardAggregateApi(token: string): Promise<AdminDashboardAggregate> {
  return apiRequest<AdminDashboardAggregate>("get_admin_dashboard_aggregate", {}, token);
}

export async function getTeacherDashboardAggregateApi(token: string): Promise<TeacherDashboardAggregate> {
  return apiRequest<TeacherDashboardAggregate>("get_teacher_dashboard_aggregate", {}, token);
}
