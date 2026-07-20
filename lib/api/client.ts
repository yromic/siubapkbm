export type UserRole = "administrator" | "admin" | "teacher";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  phone?: string;
  status: "active" | "inactive";
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  status: "success";
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: "error";
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LoginResponse {
  user: StaffUser;
  token: string;
  expires_at: string;
}

export interface CurrentUserResponse {
  user: StaffUser;
}

export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

const ACTION_MAP: Record<string, { method: string; path: string; idField?: string; rawResponse?: boolean }> = {
  // Auth
  'login':                         { method: 'POST', path: '/api/v1/auth/login' },
  'logout':                        { method: 'POST', path: '/api/v1/auth/logout' },
  'get_current_user':              { method: 'GET',  path: '/api/v1/auth/me' },
  'change_own_password':           { method: 'POST', path: '/api/v1/auth/change-password' },

  // Users
  'list_users':                    { method: 'GET',  path: '/api/v1/users' },
  'create_user':                   { method: 'POST', path: '/api/v1/users' },
  'update_user':                   { method: 'PUT',  path: '/api/v1/users/:id', idField: 'id' },
  'reset_user_password':           { method: 'POST', path: '/api/v1/users/:id/reset-password', idField: 'id' },
  'set_user_status':               { method: 'POST', path: '/api/v1/users/:id/status', idField: 'id' },

  // Students
  'list_students':                 { method: 'GET',  path: '/api/v1/students', rawResponse: true },
  'get_student_detail':            { method: 'GET',  path: '/api/v1/students/:id', idField: 'id' },
  'create_student':                { method: 'POST', path: '/api/v1/students' },
  'update_student':                { method: 'PUT',  path: '/api/v1/students/:id', idField: 'id' },
  'change_student_status':         { method: 'POST', path: '/api/v1/students/:id/status', idField: 'id' },
  'reset_student_parent_pin':      { method: 'POST', path: '/api/v1/students/:id/reset-pin', idField: 'id' },
  'list_students_by_class':        { method: 'GET',  path: '/api/v1/enrollments' },

  // Academic Assessments & Scores
  'list_academic_assessments':     { method: 'GET',  path: '/api/v1/academic-assessments' },
  'get_academic_assessment_detail':{ method: 'GET',  path: '/api/v1/academic-assessments/:id', idField: 'id' },
  'create_academic_assessment':    { method: 'POST', path: '/api/v1/academic-assessments' },
  'update_academic_assessment':    { method: 'PUT',  path: '/api/v1/academic-assessments/:id', idField: 'id' },
  'publish_academic_assessment':   { method: 'POST', path: '/api/v1/academic-assessments/:id/publish', idField: 'id' },
  'list_academic_scores_by_assessment': { method: 'GET', path: '/api/v1/academic-assessments/:id/scores', idField: 'assessment_id' },
  'save_academic_scores':          { method: 'POST', path: '/api/v1/academic-assessments/:id/scores', idField: 'assessment_id' },
  // Grading roster — assessment_date stays server-side as a Date object; never serialized to a URL param.
  'get_assessment_roster':         { method: 'GET',  path: '/api/v1/academic-assessments/:id/roster', idField: 'assessment_id' },

  'get_class_academic_summary':    { method: 'GET',  path: '/api/v1/classes/:id/academic-summary', idField: 'class_id' },
  'calculate_academic_completeness': { method: 'GET', path: '/api/v1/completeness/academic' },
  'list_my_class_subjects':        { method: 'GET',  path: '/api/v1/class-subjects/my' },

  // Culture & Character
  'list_culture_scores_by_date':   { method: 'GET',  path: '/api/v1/culture-scores' },
  'save_culture_scores':           { method: 'POST', path: '/api/v1/culture-scores' },
  'get_student_character_summary': { method: 'GET',  path: '/api/v1/students/:id/character-summary', idField: 'student_id' },
  'get_class_character_summary':   { method: 'GET',  path: '/api/v1/classes/:id/character-summary', idField: 'class_id' },
  'get_student_watchlist':         { method: 'GET',  path: '/api/v1/dashboards/watchlist' },
  'calculate_culture_completeness':{ method: 'GET',  path: '/api/v1/completeness/culture' },
  'get_teacher_culture_completeness': { method: 'GET', path: '/api/v1/completeness/teachers' },
  'get_semester_finalization_status': { method: 'GET', path: '/api/v1/semesters/:id/finalization-status', idField: 'semester_id' },

  // Student Files
  'list_student_files':            { method: 'GET',  path: '/api/v1/students/:id/files', idField: 'student_id' },
  'upload_student_file':           { method: 'POST', path: '/api/v1/students/:id/files', idField: 'student_id' },
  'replace_student_file':          { method: 'PUT',  path: '/api/v1/students/files/:id', idField: 'id' },
  'get_student_file_access':       { method: 'GET',  path: '/api/v1/students/files/:id/access', idField: 'file_id' },
  'archive_student_file':          { method: 'POST', path: '/api/v1/students/files/:id/archive', idField: 'file_id' },

  // Finance (SPP)
  'list_spp_payments':             { method: 'GET',  path: '/api/v1/finance/spp' },
  'get_class_spp_arrears':         { method: 'GET',  path: '/api/v1/finance/spp/arrears' },
  'verify_spp_payment':            { method: 'POST', path: '/api/v1/finance/spp/verify' },
  'verify_bulk_spp_payments':      { method: 'POST', path: '/api/v1/finance/spp/verify-bulk' },
  'spp_revert_payment':            { method: 'POST', path: '/api/v1/finance/spp/:id/revert', idField: 'payment_id' },
  'generate_spp_records':          { method: 'POST', path: '/api/v1/finance/spp/generate' },

  // Parent Portal
  'parent_login':                  { method: 'POST', path: '/api/v1/parent/login' },
  'parent_me':                     { method: 'GET',  path: '/api/v1/parent/me' },
  'parent_get_dashboard':          { method: 'GET',  path: '/api/v1/parent/dashboard' },
  'parent_get_character_summary':  { method: 'GET',  path: '/api/v1/parent/character-summary' },
  'parent_get_academic_summary':   { method: 'GET',  path: '/api/v1/parent/academic-summary' },
  'parent_get_academic_detail':    { method: 'GET',  path: '/api/v1/parent/academic-detail' },
  'parent_get_spp_status':         { method: 'GET',  path: '/api/v1/parent/spp-status' },

  // Imports
  'create_import_session':         { method: 'POST', path: '/api/v1/imports' },
  'preview_import_data':           { method: 'GET',  path: '/api/v1/imports/:id/preview', idField: 'id' },
  'confirm_import_data':           { method: 'POST', path: '/api/v1/imports/:id/confirm', idField: 'id' },
  'list_import_logs':              { method: 'GET',  path: '/api/v1/imports' },
  'get_import_template':           { method: 'GET',  path: '/api/v1/imports/templates/:type', idField: 'type' },

  // Exports
  'export_students_csv':           { method: 'GET',  path: '/api/v1/exports/csv/students' },
  'export_academic_scores_csv':    { method: 'GET',  path: '/api/v1/exports/csv/academic-scores' },
  'export_character_summary_csv':  { method: 'GET',  path: '/api/v1/exports/csv/character-summaries' },
  'list_export_history':           { method: 'GET',  path: '/api/v1/exports/history' },

  // Promotion
  'preview_student_promotion':     { method: 'POST', path: '/api/v1/promotions/students/preview' },
  'execute_student_promotion':     { method: 'POST', path: '/api/v1/promotions/students/execute' },

  // My Class (Teacher)
  'get_my_classes':                { method: 'GET',  path: '/api/v1/classes/my' },

  // Lifecycle
  'mutate_lifecycle_status':       { method: 'POST', path: '/api/v1/lifecycle/mutate' },

  // System
  // NOTE: 'extended_health_check' is a virtual action — response is remapped in apiRequest above.
  'get_system_diagnostics_report': { method: 'GET',  path: '/api/v1/system/diagnostics' },
  // rawResponse: true — audit-logs.ts expects { logs, total, page, page_size }, transformed in apiRequest
  'search_audit_logs':             { method: 'GET',  path: '/api/v1/audit-logs', rawResponse: true },
  // NOTE: Virtual actions (handled before ACTION_MAP lookup):
  //   'get_executive_dashboard_stats', 'get_app_settings',
  //   'extended_health_check', 'get_teacher_culture_completeness'

  // Academic Years
  'list_academic_years':            { method: 'GET',  path: '/api/v1/academic-years' },
  'create_academic_year':           { method: 'POST', path: '/api/v1/academic-years' },
  'update_academic_year':           { method: 'PUT',  path: '/api/v1/academic-years/:id', idField: 'id' },
  'set_active_academic_year':       { method: 'POST', path: '/api/v1/academic-years/:id/activate', idField: 'id' },

  // Semesters
  'list_semesters':                 { method: 'GET',  path: '/api/v1/semesters' },
  'create_semester':                { method: 'POST', path: '/api/v1/semesters' },
  'update_semester':                { method: 'PUT',  path: '/api/v1/semesters/:id', idField: 'id' },
  'set_active_semester':            { method: 'POST', path: '/api/v1/semesters/:id/activate', idField: 'id' },

  // Classes
  'list_classes':                   { method: 'GET',  path: '/api/v1/classes' },
  'get_class_detail':               { method: 'GET',  path: '/api/v1/classes/:id', idField: 'id' },
  'create_class':                   { method: 'POST', path: '/api/v1/classes' },
  'update_class':                   { method: 'PUT',  path: '/api/v1/classes/:id', idField: 'id' },
  'deactivate_class':               { method: 'POST', path: '/api/v1/classes/:id/deactivate', idField: 'id' },

  // Subjects
  'list_subjects':                  { method: 'GET',  path: '/api/v1/subjects' },
  'create_subject':                 { method: 'POST', path: '/api/v1/subjects' },
  'update_subject':                 { method: 'PUT',  path: '/api/v1/subjects/:id', idField: 'id' },
  'deactivate_subject':             { method: 'POST', path: '/api/v1/subjects/:id/deactivate', idField: 'id' },

  // Class Subjects
  'list_class_subjects':            { method: 'GET',  path: '/api/v1/class-subjects' },
  'assign_subject_to_class':        { method: 'POST', path: '/api/v1/class-subjects' },
  'unassign_subject_from_class':    { method: 'DELETE', path: '/api/v1/class-subjects/:id', idField: 'id' },

  // Bulk Enrollment
  'bulk_enrollment':                { method: 'POST', path: '/api/v1/enrollments/bulk' },

  'list_teacher_profiles':          { method: 'GET',  path: '/api/v1/teachers' },
  'create_teacher_profile':         { method: 'POST', path: '/api/v1/teachers' },
  'update_teacher_profile':         { method: 'PUT',  path: '/api/v1/teachers/:id', idField: 'id' },
  'deactivate_teacher_profile':     { method: 'POST', path: '/api/v1/teachers/:id/deactivate', idField: 'id' },
  'list_class_teacher_assignments': { method: 'GET',  path: '/api/v1/class-teachers' },
  'assign_class_teacher':           { method: 'POST', path: '/api/v1/class-teachers' },
  'end_class_teacher_assignment':   { method: 'POST', path: '/api/v1/class-teachers/:id/terminate', idField: 'id' },

  // Attendance
  'record_attendance':              { method: 'POST', path: '/api/v1/attendance' },
  'get_attendance_history':         { method: 'GET',  path: '/api/v1/attendance/my' },
  'record_manual_attendance':       { method: 'POST', path: '/api/v1/attendance/manual' },
  'get_daily_attendance_roster':    { method: 'GET',  path: '/api/v1/attendance/roster' },

  // Dashboard & Monitoring
  'get_school_dashboard':           { method: 'GET',  path: '/api/v1/dashboards/school' },
  'get_class_monitoring_dashboard': { method: 'GET',  path: '/api/v1/dashboards/classes/:id', idField: 'class_id' },
  'get_student_progress_dashboard': { method: 'GET',  path: '/api/v1/dashboards/students/:id', idField: 'student_id' },
  'get_teacher_monitoring_dashboard': { method: 'GET', path: '/api/v1/dashboards/teachers/:id', idField: 'teacher_id' },

  // Period Setup & Readiness
  'get_period_setup_readiness':     { method: 'GET',  path: '/api/v1/periods/readiness' },
  'repair_active_period_settings':  { method: 'POST', path: '/api/v1/periods/repair' },

  // Rollover
  'preview_assignment_rollover':    { method: 'POST', path: '/api/v1/rollovers/assignments/preview' },
  'execute_assignment_rollover':    { method: 'POST', path: '/api/v1/rollovers/assignments/execute' },
  'preview_subject_rollover':       { method: 'POST', path: '/api/v1/rollovers/subjects/preview' },
  'execute_subject_rollover':       { method: 'POST', path: '/api/v1/rollovers/subjects/execute' },

  // Promotion Rules
  'list_class_promotion_rules':     { method: 'GET',  path: '/api/v1/promotion-rules' },
  'create_class_promotion_rule':    { method: 'POST', path: '/api/v1/promotion-rules' },
  'update_class_promotion_rule':    { method: 'PUT',  path: '/api/v1/promotion-rules/:id', idField: 'id' },

  // Enrollments (additional)
  'list_student_enrollments':       { method: 'GET',  path: '/api/v1/enrollments' },
  'create_student_enrollment':      { method: 'POST', path: '/api/v1/enrollments' },
  'update_student_enrollment':      { method: 'PUT',  path: '/api/v1/enrollments/:id', idField: 'id' },
  'change_student_enrollment_status': { method: 'POST', path: '/api/v1/enrollments/:id/status', idField: 'id' },
  'get_student_active_enrollment':  { method: 'GET',  path: '/api/v1/students/:id/enrollment/active', idField: 'student_id' },

  // System (additional)
  'get_master_data_basic':          { method: 'GET',  path: '/api/v1/culture/master-data' },
  'get_app_settings':               { method: 'GET',  path: '/api/v1/app-settings' },
  'update_app_settings':            { method: 'PUT',  path: '/api/v1/app-settings' },
  'run_data_integrity_check':       { method: 'POST', path: '/api/v1/hardening/integrity/database' },
  'run_storage_integrity_check':    { method: 'POST', path: '/api/v1/hardening/integrity/storage' },
  'create_manual_backup_snapshot':  { method: 'POST', path: '/api/v1/backups' },
  'list_backup_snapshots':          { method: 'GET',  path: '/api/v1/backups' },
  'preview_restore_backup':         { method: 'GET',  path: '/api/v1/backups/:id/preview', idField: 'id' },

  // Finalization & Snapshots
  'finalize_semester_reports':      { method: 'POST', path: '/api/v1/semesters/:id/finalize', idField: 'semester_id' },
  'create_student_report_snapshot': { method: 'POST', path: '/api/v1/snapshots/students/:id', idField: 'student_id' },
  'create_class_report_snapshot':   { method: 'POST', path: '/api/v1/snapshots/classes/:id', idField: 'class_id' },
  'get_report_snapshot':            { method: 'GET',  path: '/api/v1/snapshots' },
  'list_report_exports':            { method: 'GET',  path: '/api/v1/exports' },
  'download_report_export':         { method: 'GET',  path: '/api/v1/exports/:id/download', idField: 'export_id' },

  // Parent additional
  'parent_verify_access':           { method: 'POST', path: '/api/v1/parent/verify' },
  'parent_logout':                  { method: 'POST', path: '/api/v1/parent/logout' },
  'parent_get_character_detail':    { method: 'GET',  path: '/api/v1/parent/character-detail' },
  'parent_get_available_periods':   { method: 'GET',  path: '/api/v1/parent/periods' },

  // Setup & Storage
  'setup_storage_folders':          { method: 'POST', path: '/api/v1/system/setup-storage' },
  'setup_database':                 { method: 'POST', path: '/api/v1/system/setup-database' },
  'seed_initial_data':              { method: 'POST', path: '/api/v1/system/seed' },
};

export async function apiRequest<T>(
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any> = {},
  token?: string
): Promise<T> {
  // ── Virtual actions (synthesized from multiple real endpoints) ────────────

  if (action === "get_app_settings") {
    // Synthesize active year/semester IDs from list endpoints' is_active flag
    const [years, sems] = await Promise.all([
      fetchRaw<{ data: any[]; pagination: any }>("/api/v1/academic-years", "GET", {}, token),
      fetchRaw<{ data: any[]; pagination: any }>("/api/v1/semesters", "GET", {}, token),
    ]);
    const activeYear = years.data?.find((y: any) => y.is_active == 1 || y.is_active === true);
    const activeSem  = sems.data?.find((s: any) => s.is_active == 1 || s.is_active === true);
    return {
      active_academic_year_id: activeYear?.id || null,
      active_semester_id: activeSem?.id || null,
    } as unknown as T;
  }

  if (action === "get_executive_dashboard_stats") {
    // Fetch aggregated data from school dashboard endpoint directly.
    const [schoolRaw, backupsRaw] = await Promise.allSettled([
      fetchRaw<any>("/api/v1/dashboards/school", "GET", {}, token),
      fetchRaw<{ data: any[] }>("/api/v1/backups", "GET", {}, token),
    ]);

    const school = schoolRaw.status === "fulfilled" ? schoolRaw.value : null;
    const backups = backupsRaw.status === "fulfilled" ? (backupsRaw.value?.data ?? []) : [];
    const lastBackup = backups[0];

    return {
      total_students:              school?.total_students ?? 0,
      total_teachers:              school?.total_teachers ?? 0,
      total_classes:               school?.total_classes ?? 0,
      teacherAttendanceRate:       school?.teacherAttendanceRate !== undefined ? school.teacherAttendanceRate : null,
      sppCompletionRate:           school?.sppCompletionRate ?? 0,
      sppChartData:                school?.sppChartData ?? [{ name: "—", Lunas: 0, Belum: 0 }],
      docCompletionRate:           school?.docCompletionRate ?? 0,
      docPieChartData:             school?.docPieChartData ?? [{ name: "Lengkap", value: 0 }, { name: "Belum", value: 100 }],
      fitrahRadarData:             school?.fitrahRadarData ?? [],
      lastBackupTime:              lastBackup?.created_at ?? "Belum ada",
      lastBackupStatus:            lastBackup?.status ?? "unknown",
      lastIntegrityCheckTime:      school?.lastIntegrityCheckTime ?? "N/A",
      lastIntegrityCheckStatus:    school?.lastIntegrityCheckStatus ?? "unknown",
      bestClassAcademicName:       school?.bestClassAcademicName ?? "N/A",
      bestClassAcademicAvg:        school?.bestClassAcademicAvg ?? "0.0",
      mostActiveTeacherName:       school?.mostActiveTeacherName ?? "N/A",
      mostActiveTeacherDesc:       school?.mostActiveTeacherDesc ?? "Data tidak tersedia",
      bestCultureClassName:        school?.bestCultureClassName ?? "N/A",
      bestCultureClassAvg:         school?.bestCultureClassAvg ?? "0.0",
      classesWithoutWali:          school?.classesWithoutWali ?? [],
      orphanStudentsCount:         school?.orphanStudentsCount ?? 0,
      unpaidSppPercent:            school?.unpaidSppPercent ?? 0,
      failedLoginsCount:           school?.failedLoginsCount ?? 0,
      classAcademicAverages:       school?.classAcademicAverages ?? [],
      academicCompletion:          school?.academicCompletion !== undefined ? school.academicCompletion : null,
      characterCompletion:         school?.characterCompletion ?? 0,
      overallHealthScore:          school?.overallHealthScore ?? 0,
      healthCategory:              school?.healthCategory ?? "Baik",
      qualityStats:                school?.qualityStats ?? {
        studentsWithoutPinCount: 0,
        duplicateNIKCount: 0,
        duplicateNISNCount: 0,
        orphanStudentCount: 0,
        missingBirthdateCount: 0
      },
      academicStatusStats:         school?.academicStatusStats ?? { final: 0, belumFinal: 0, belumIsi: 0 },
      cultureStatusStats:          school?.cultureStatusStats ?? { lengkap: 0, sebagian: 0, kosong: 0 },
      _school:                     school,
    } as unknown as T;
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (action === "get_teacher_culture_completeness") {
    // The backend endpoint requires academic_year_id & semester_id.
    // The hook only sends period_mode + class_id. Resolve active IDs automatically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let yearId = payload.academic_year_id as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let semId  = payload.semester_id as string | undefined;

    if (!yearId || !semId) {
      // Fetch active IDs from the list endpoints (same logic as get_app_settings)
      const [years, sems] = await Promise.allSettled([
        fetchRaw<{ data: any[] }>("/api/v1/academic-years", "GET", {}, token),
        fetchRaw<{ data: any[] }>("/api/v1/semesters", "GET", {}, token),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yData = years.status  === "fulfilled" ? (years.value?.data  ?? []) : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sData = sems.status   === "fulfilled" ? (sems.value?.data   ?? []) : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeYear = yData.find((y: any) => y.is_active == 1 || y.is_active === true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeSem  = sData.find((s: any) => s.is_active == 1 || s.is_active === true);
      yearId = yearId || activeYear?.id;
      semId  = semId  || activeSem?.id;
    }

    if (!yearId || !semId) {
      // No active period configured — return empty-safe structure
      return {
        period: { mode: payload.period_mode, start_date: "", end_date: "" },
        expected_days: 0,
        class_summary: {
          total_students: 0, complete_students: 0, partial_students: 0,
          low_students: 0, empty_students: 0, average_coverage_percent: 0,
        },
        missing_dates: [],
        students: [],
      } as unknown as T;
    }

    // Now call the real completeness endpoint with all required params
    const params = new URLSearchParams();
    params.set("academic_year_id", yearId);
    params.set("semester_id", semId);
    if (payload.class_id)    params.set("class_id", payload.class_id);
    if (payload.period_mode) params.set("period_mode", payload.period_mode);

    const url = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/completeness/teachers?${params.toString()}`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new ApiError(
        errJson?.error?.code ?? "ERR_INTERNAL_SERVER",
        errJson?.message ?? `Completeness request failed: ${res.status}`
      );
    }
    const json = await res.json();
    return json.data as T;
  }

  if (action === "extended_health_check") {
    const raw = await fetchRaw<any>("/api/v1/system/health/extended", "GET", {}, token);

    const dbOk      = raw?.checks?.database?.status === "ok";
    const storageOk = raw?.checks?.storage?.status  === "ok";
    const dbIssues  = dbOk ? [] : [{ severity: "critical", code: "DB_ERROR",      message: "Database tidak dapat dijangkau." }];
    const stIssues  = storageOk ? [] : [{ severity: "warning", code: "STORAGE_MISSING", message: "Direktori penyimpanan tidak ditemukan." }];

    const healthy = (issues: unknown[]) => ({ status: issues.length === 0 ? "healthy" : "warning", issues });

    return {
      status: dbOk && storageOk ? "healthy" : dbOk ? "warning" : "critical",
      summary: {
        checked_at: raw?.server_time ?? new Date().toISOString(),
        warnings:   storageOk ? 0 : 1,
        criticals:  dbOk     ? 0 : 1,
      },
      spreadsheet: healthy([]),
      sheets:      healthy([]),
      settings:    healthy([]),
      drive:       { status: storageOk ? "healthy" : "warning", path: raw?.checks?.storage?.path, issues: stIssues },
      audit:       healthy([]),
      cache:       healthy([]),
      backup:      healthy([]),
      triggers:    healthy([]),
      integrity: {
        status:    "healthy",
        issues:    [],
        last_run:  null,
        database:  { status: dbOk ? "healthy" : "critical", latency_ms: raw?.checks?.database?.latency_ms },
        table_counts: raw?.table_counts,
        uptime_seconds: raw?.uptime_seconds,
      },
      database: {
        status: dbOk ? "healthy" : "critical",
        latency_ms: raw?.checks?.database?.latency_ms,
        issues: dbIssues,
      },
    } as unknown as T;
  }

  // ─────────────────────────────────────────────────────────────────────────

  const config = ACTION_MAP[action];
  if (!config) {
    throw new ApiError("UNSUPPORTED_ACTION", `Action "${action}" is not supported by the REST API.`);
  }

  let path = config.path;
  let queryPayload = { ...payload };

  if (config.idField) {
    let idVal = payload[config.idField];
    if (idVal === undefined || idVal === null) {
      if (config.idField === "type" && payload.import_type !== undefined) {
        idVal = payload.import_type;
        delete queryPayload.import_type;
      } else if (config.idField === "import_type" && payload.type !== undefined) {
        idVal = payload.type;
        delete queryPayload.type;
      }
    }
    if (idVal !== undefined && idVal !== null) {
      path = path.replace(/:[a-zA-Z_]+/g, String(idVal));
      if (action !== 'upload_student_file') {
        delete queryPayload[config.idField];
      }
    }
  }

  let url = `${process.env.NEXT_PUBLIC_API_URL || ""}${path}`;
  const options: RequestInit = {
    method: config.method,
    headers: {} as Record<string, string>,
    credentials: 'same-origin'
  };

  if (config.method === "GET") {
    const queryParams = new URLSearchParams();
    for (const [key, val] of Object.entries(queryPayload)) {
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          val.forEach(v => queryParams.append(key, String(v)));
        } else {
          queryParams.append(key, String(val));
        }
      }
    }
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  } else {
    (options.headers as Record<string, string>)["Content-Type"] = "application/json";
    options.body = JSON.stringify(queryPayload);
  }

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new ApiError(
      "NETWORK_ERROR",
      error instanceof Error ? error.message : "Unable to reach the API server."
    );
  }

  const text = await response.text();

  if (!response.ok) {
    let errorCode = "ERR_INTERNAL_SERVER";
    let errorMessage = `Network request failed: ${response.status} ${response.statusText}`;
    let errorDetails = undefined;

    try {
      const errJson = JSON.parse(text);
      if (errJson.error) {
        errorCode = errJson.error.code || errorCode;
        errorMessage = errJson.message || errorMessage;
        errorDetails = errJson.error.details;
      }
    } catch {
      // Ignore
    }

    if (response.status === 401 && errorCode === "ERR_HTTP_ERROR") {
      errorCode = "ERR_UNAUTHORIZED";
    }

    throw new ApiError(errorCode, errorMessage, errorDetails);
  }

  let json: ApiResponse<T> | ApiErrorResponse;
  try {
    const parsed = JSON.parse(text);
    if (parsed.success === false || parsed.error) {
      json = {
        status: "error",
        code: parsed.error?.code || "ERR_INTERNAL_SERVER",
        message: parsed.message || "An error occurred.",
        details: parsed.error?.details
      };
    } else {
      let finalData = parsed.data;
      if (config.rawResponse) {
        // Return the full paginated envelope without unwrapping.
        // For search_audit_logs: backend returns { data: items[], pagination: {...} }
        // but audit-logs.ts expects { logs, total, page, page_size }.
        // We convert here so no other file needs changing.
        if (action === "search_audit_logs" && finalData && "data" in finalData && "pagination" in finalData) {
          finalData = {
            logs: (finalData as any).data,
            total: (finalData as any).pagination?.total ?? 0,
            page: (finalData as any).pagination?.page ?? 1,
            page_size: (finalData as any).pagination?.limit ?? 50,
          };
        }
      } else if (finalData && typeof finalData === "object" && "data" in finalData && "pagination" in finalData && Array.isArray((finalData as any).data)) {
        // Auto-unwrap paginated responses to plain arrays for list endpoints
        finalData = (finalData as any).data;
      }
      json = {
        status: "success",
        message: parsed.message || "Success",
        data: finalData
      };
    }
  } catch {
    throw new ApiError("MALFORMED_RESPONSE", "Server returned an invalid JSON response.");
  }

  if (json.status === "error") {
    throw new ApiError(json.code, json.message, json.details);
  }

  return json.data;
}

// ── Internal helper used by virtual actions ─────────────────────────────────
async function fetchRaw<T>(
  path: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryPayload: Record<string, any> = {},
  token?: string
): Promise<T> {
  let url = `${process.env.NEXT_PUBLIC_API_URL || ""}${path}`;
  const headers: Record<string, string> = {};

  if (method === "GET" && Object.keys(queryPayload).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(queryPayload)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, { method, headers, credentials: 'same-origin' });
  const json = await res.json();
  return json.data as T;
}

export async function mutateLifecycleStatus(
  sheetName: string,
  id: string,
  targetStatus: string,
  token: string
): Promise<any> {
  const mapping: Record<string, string> = {
    "users": "user",
    "teacher_profiles": "teacher_profile",
    "subjects": "subject",
    "students": "student",
    "classes": "class",
    "class_teacher_assignments": "class_teacher_assignment",
    "academic_years": "academic_year",
    "semesters": "semester",
    "user": "user",
    "teacher_profile": "teacher_profile",
    "subject": "subject",
    "student": "student",
    "class": "class",
    "class_teacher_assignment": "class_teacher_assignment",
    "academic_year": "academic_year",
    "semester": "semester"
  };

  const entity_type = mapping[sheetName] || sheetName;

  return apiRequest<any>(
    "mutate_lifecycle_status",
    { entity_type, id, status: targetStatus.toLowerCase() },
    token
  );
}
