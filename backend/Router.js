/**
 * Router.gs
 * Dispatches action API calls to their respective handlers.
 * Implements authorization checks for protected master data, student, and enrollment actions.
 */

/**
 * Routes the API request to the appropriate action.
 * @param {Object} request - Parsed JSON request containing { action, payload, token }.
 * @param {Object} e - Original Apps Script event object.
 * @returns {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function route(request, e) {
  var action = request.action;
  var payload = request.payload || {};
  
  if (!action) {
    return errorResponse('INVALID_ACTION', 'Action is required.');
  }
  
  // Extract request metadata if provided by client or environments
  var requestMeta = {
    ip_address: payload.ip_address || (e && e.parameter && e.parameter.ip) || 'unknown',
    user_agent: payload.user_agent || (e && e.parameter && e.parameter.user_agent) || 'unknown'
  };
  
  try {
    // List of actions that do not require login/actor verification
    var publicActions = [
      'health_check', 'login', 'debug_backend_version',
      'parent_verify_access', 'parent_get_dashboard', 'parent_get_academic_summary', 'parent_get_character_summary', 'parent_get_character_detail',
      'parent_login', 'parent_logout', 'parent_me', 'parent_get_academic_detail', 'parent_get_available_periods',
      'parent_get_spp_status'
    ];
    
    var actor = null;
    var authToken = request.token || payload.token || '';
    if (publicActions.indexOf(action) === -1) {
      // Resolve actor for all protected actions from a server-side staff session.
      actor = resolveActorFromToken(authToken, requestMeta);
      enforceActorPayloadConsistency(payload, actor);
    }
    
    switch (action) {
      // --- PUBLIC / BOOTSTRAP ACTIONS ---
      case 'health_check':
        return handleHealthCheck();
      case 'debug_backend_version':
        var tempActor = null;
        if (authToken) {
          try {
            tempActor = resolveActorFromToken(authToken, requestMeta);
          } catch(e) {}
        }
        var details = handleDebugBackendVersion(payload, tempActor);
        return successResponse(details, "Debug backend version successfully.");
      case 'setup_database':
        return handleSetupDatabase(actor, requestMeta);
      case 'seed_initial_data':
        return handleSeedInitialData(actor, requestMeta);
      case 'login':
        return handleLogin(payload, requestMeta);
      case 'get_current_user':
        return handleGetCurrentUser(actor, payload);
      case 'get_master_data_basic':
        return handleGetMasterDataBasic();
      case 'logout':
        return handleLogout(authToken, actor, requestMeta);
        
      // --- ACADEMIC YEARS ---
      case 'create_academic_year':
        assertAdminRole(actor);
        var year = createAcademicYear(payload, actor);
        return successResponse(year, "Academic year created successfully.");
      case 'update_academic_year':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedYear = updateAcademicYear(payload.id, payload, actor);
        return successResponse(updatedYear, "Academic year updated successfully.");
      case 'list_academic_years':
        assertStaffRole(actor);
        var years = listAcademicYears();
        return successResponse(years, "Academic years retrieved successfully.");
      case 'set_active_academic_year':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var resYear = setActiveAcademicYear(payload.id, actor);
        return successResponse(resYear, "Active academic year set successfully.");
        
      // --- SEMESTERS ---
      case 'create_semester':
        assertAdminRole(actor);
        var sem = createSemester(payload, actor);
        return successResponse(sem, "Semester created successfully.");
      case 'update_semester':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedSem = updateSemester(payload.id, payload, actor);
        return successResponse(updatedSem, "Semester updated successfully.");
      case 'list_semesters':
        assertStaffRole(actor);
        var sems = listSemesters();
        return successResponse(sems, "Semesters retrieved successfully.");
      case 'set_active_semester':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var resSem = setActiveSemester(payload.id, actor);
        return successResponse(resSem, "Active semester set successfully.");
        
      // --- CLASSES ---
      case 'create_class':
        assertAdminRole(actor);
        var cls = createClass(payload, actor);
        return successResponse(cls, "Class created successfully.");
      case 'update_class':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedCls = updateClass(payload.id, payload, actor);
        return successResponse(updatedCls, "Class updated successfully.");
      case 'list_classes':
        assertAdminRole(actor);
        var classes = listClasses(payload);
        return successResponse(classes, "Classes retrieved successfully.");
      case 'deactivate_class':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var deactivatedCls = deactivateClass(payload.id, actor);
        return successResponse(deactivatedCls, "Class deactivated successfully.");
        
      // --- SUBJECTS ---
      case 'create_subject':
        assertAdminRole(actor);
        var subj = createSubject(payload, actor);
        return successResponse(subj, "Subject created successfully.");
      case 'update_subject':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedSubj = updateSubject(payload.id, payload, actor);
        return successResponse(updatedSubj, "Subject updated successfully.");
      case 'list_subjects':
        assertAdminRole(actor);
        var subjs = listSubjects(payload);
        return successResponse(subjs, "Subjects retrieved successfully.");
      case 'deactivate_subject':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var deactivatedSubj = deactivateSubject(payload.id, actor);
        return successResponse(deactivatedSubj, "Subject deactivated successfully.");
        
      // --- CLASS SUBJECTS ---
      case 'assign_subject_to_class':
        assertAdminRole(actor);
        var mapping = assignSubjectToClass(payload, actor);
        return successResponse(mapping, "Subject assigned to class successfully.");
      case 'unassign_subject_from_class':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var unassignedMapping = unassignSubjectFromClass(payload.id, actor);
        return successResponse(unassignedMapping, "Subject unassigned from class successfully.");
      case 'list_class_subjects':
        assertAdminRole(actor);
        var mappings = listClassSubjects();
        return successResponse(mappings, "Class subjects retrieved successfully.");
      case 'list_my_class_subjects':
        var myClassSubjects = listMyClassSubjects(payload, actor);
        return successResponse(myClassSubjects, "Teacher class subjects retrieved successfully.");
        
      // --- TEACHER PROFILES ---
      case 'create_teacher_profile':
        assertAdminRole(actor);
        var prof = createTeacherProfile(payload, actor);
        return successResponse(prof, "Teacher profile created successfully.");
      case 'update_teacher_profile':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedProf = updateTeacherProfile(payload.id, payload, actor);
        return successResponse(updatedProf, "Teacher profile updated successfully.");
      case 'list_teacher_profiles':
        assertAdminRole(actor);
        var profs = listTeacherProfiles(payload);
        return successResponse(profs, "Teacher profiles retrieved successfully.");
      case 'deactivate_teacher_profile':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var deactivatedProf = deactivateTeacherProfile(payload.id, actor);
        return successResponse(deactivatedProf, "Teacher profile deactivated successfully.");
        
      // --- CLASS TEACHER ASSIGNMENTS ---
      case 'assign_class_teacher':
        assertAdminRole(actor);
        var assignment = assignClassTeacher(payload, actor);
        return successResponse(assignment, "Class teacher assigned successfully.");
      case 'end_class_teacher_assignment':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var endedAssignment = endClassTeacherAssignment(payload.id, actor);
        return successResponse(endedAssignment, "Class teacher assignment ended successfully.");
      case 'list_class_teacher_assignments':
        assertAdminRole(actor);
        var assignments = listClassTeacherAssignments(payload);
        return successResponse(assignments, "Class teacher assignments retrieved successfully.");
      case 'get_my_classes':
        var myClasses = getMyClasses(payload, actor);
        return successResponse(myClasses, "Teacher classes retrieved successfully.");
        
      // --- APP SETTINGS ---
      case 'get_app_settings':
        assertStaffRole(actor);
        var settings = getAppSettings();
        return successResponse(settings, "App settings retrieved successfully.");
      case 'get_executive_dashboard_stats':
        assertAdminRole(actor);
        var execStats = getExecutiveDashboardStats(payload, actor);
        return successResponse(execStats, "Executive dashboard stats retrieved successfully.");
      case 'update_app_settings':
        assertAdminRole(actor);
        var updatedSettings = updateAppSettings(payload, actor);
        return successResponse(updatedSettings, "App settings updated successfully.");
      case 'get_period_setup_readiness':
        assertAdminRole(actor);
        var readiness = getPeriodSetupReadiness(payload, actor);
        return successResponse(readiness, "Period setup readiness retrieved successfully.");
      case 'repair_active_period_settings':
        assertAdminRole(actor);
        var repairedPeriod = repairActivePeriodSettings(payload, actor);
        return successResponse(repairedPeriod, "Active period settings repaired successfully.");
      case 'preview_assignment_rollover':
        assertAdminRole(actor);
        var preview = previewAssignmentRollover(payload);
        return successResponse(preview, "Assignment rollover preview retrieved successfully.");
      case 'execute_assignment_rollover':
        assertAdminRole(actor);
        var execRes = executeAssignmentRollover(payload, actor);
        return successResponse(execRes, "Assignment rollover executed successfully.");
      case 'preview_subject_rollover':
        assertAdminRole(actor);
        var subPreview = previewSubjectRollover(payload);
        return successResponse(subPreview, "Subject rollover preview retrieved successfully.");
      case 'execute_subject_rollover':
        assertAdminRole(actor);
        var subExecRes = executeSubjectRollover(payload, actor);
        return successResponse(subExecRes, "Subject rollover executed successfully.");
        
      // --- CLASS PROMOTION & STUDENT PROMOTION ---
      case 'list_class_promotion_rules':
        assertAdminRole(actor);
        var rules = listClassPromotionRules();
        return successResponse(rules, "Class promotion rules retrieved successfully.");
      case 'create_class_promotion_rule':
        assertAdminRole(actor);
        var rule = createClassPromotionRule(payload, actor);
        return successResponse(rule, "Class promotion rule created successfully.");
      case 'update_class_promotion_rule':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedRule = updateClassPromotionRule(payload.id, payload, actor);
        return successResponse(updatedRule, "Class promotion rule updated successfully.");
      case 'deactivate_class_promotion_rule':
        assertAdminRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var deactivatedRule = deactivateClassPromotionRule(payload.id, actor);
        return successResponse(deactivatedRule, "Class promotion rule deactivated successfully.");
      case 'preview_student_promotion':
        assertAdminRole(actor);
        var previewPromotion = previewStudentPromotion(payload);
        return successResponse(previewPromotion, "Student promotion preview retrieved successfully.");
      case 'execute_student_promotion':
        assertAdminRole(actor);
        var executionPromotion = executeStudentPromotion(payload, actor);
        return successResponse(executionPromotion, "Student promotion executed successfully.");
        
      // --- USER MANAGEMENT (SPRINT UM-2) ---
      case 'list_users':
        assertAdministratorRole(actor);
        var filters = { status: payload.status, role: payload.role };
        var users = listUsers(actor, filters);
        return successResponse(users, "Users retrieved successfully.");
      case 'create_user':
        assertAdministratorRole(actor);
        var user = createUser(actor, payload);
        return successResponse(user, "User created successfully.");
      case 'update_user':
        assertAdministratorRole(actor);
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updated = updateUser(actor, payload.id, payload);
        return successResponse(updated, "User updated successfully.");
      case 'reset_user_password':
        assertAdministratorRole(actor);
        if (!payload.id || !payload.new_password) {
          return errorResponse('MISSING_PARAMETER', 'id and new_password are required.');
        }
        var resUser = resetUserPassword(actor, payload.id, payload.new_password);
        return successResponse(resUser, "User password reset successfully.");
      case 'set_user_status':
        assertAdministratorRole(actor);
        if (!payload.id || !payload.status) {
          return errorResponse('MISSING_PARAMETER', 'id and status are required.');
        }
        var statusUser = setUserStatus(actor, payload.id, payload.status);
        return successResponse(statusUser, "User status updated successfully.");
      case 'change_own_password':
        if (!payload.old_password || !payload.new_password) {
          return errorResponse('MISSING_PARAMETER', 'old_password and new_password are required.');
        }
        var selfUser = changeOwnPassword(actor, payload.old_password, payload.new_password);
        return successResponse(selfUser, "Password changed successfully.");

      // --- SPRINT 3: STUDENTS ---
      case 'create_student':
        var student = createStudent(payload, actor);
        return successResponse(student, "Student created successfully.");
      case 'update_student':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedStudent = updateStudent(payload.id, payload, actor);
        return successResponse(updatedStudent, "Student updated successfully.");
      case 'list_students':
        var students = listStudents(actor, payload);
        return successResponse(students, "Students retrieved successfully.");
      case 'get_student_detail':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var detail = getStudentDetail(payload.id, actor);
        return successResponse(detail, "Student details retrieved successfully.");
      case 'change_student_status':
        if (!payload.id || !payload.status) return errorResponse('MISSING_PARAMETER', 'id and status are required.');
        var statusRes = changeStudentStatus(payload.id, payload.status, actor);
        return successResponse(statusRes, "Student status updated successfully.");
      case 'reset_student_parent_pin':
        if (!payload.id || !payload.parent_access_pin) return errorResponse('MISSING_PARAMETER', 'id and parent_access_pin are required.');
        var pinRes = resetStudentParentPin(payload.id, payload.parent_access_pin, actor);
        return successResponse(pinRes, "Student parent access PIN reset successfully.");

      // --- SPRINT 3: STUDENT ENROLLMENTS ---
      case 'create_student_enrollment':
        var enrollment = createStudentEnrollment(payload, actor);
        return successResponse(enrollment, "Student enrolled successfully.");
      case 'update_student_enrollment':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedEnrollment = updateStudentEnrollment(payload.id, payload, actor);
        return successResponse(updatedEnrollment, "Student enrollment updated successfully.");
      case 'list_student_enrollments':
        var enrollments = listStudentEnrollments(actor);
        return successResponse(enrollments, "Student enrollments retrieved successfully.");
      case 'get_student_active_enrollment':
        if (!payload.student_id) return errorResponse('MISSING_PARAMETER', 'student_id is required.');
        var activeEnroll = getStudentActiveEnrollment(payload.student_id);
        return successResponse(activeEnroll, "Active enrollment retrieved successfully.");
      case 'change_student_enrollment_status':
        if (!payload.id || !payload.status) return errorResponse('MISSING_PARAMETER', 'id and status are required.');
        var enrollStatusRes = changeStudentEnrollmentStatus(payload.id, payload.status, actor);
        return successResponse(enrollStatusRes, "Student enrollment status updated successfully.");
      case 'list_students_by_class':
        var roster = listStudentsByClass(payload, actor);
        return successResponse(roster, "Students roster retrieved successfully. v1.0.1 (with student_enrollment_id)");
        
      // --- SPRINT 4: ACADEMIC ASSESSMENTS ---
      case 'create_academic_assessment':
        var assessment = createAcademicAssessment(payload, actor);
        return successResponse(assessment, "Academic assessment created successfully.");
      case 'update_academic_assessment':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedAssessment = updateAcademicAssessment(payload.id, payload, actor);
        return successResponse(updatedAssessment, "Academic assessment updated successfully.");
      case 'list_academic_assessments':
        var assessments = listAcademicAssessments(payload, actor);
        return successResponse(assessments, "Academic assessments retrieved successfully.");
      case 'get_academic_assessment_detail':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var assessmentDetail = getAcademicAssessmentDetail(payload.id, actor);
        return successResponse(assessmentDetail, "Academic assessment details retrieved successfully.");
      case 'publish_academic_assessment':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var publishedAssessment = publishAcademicAssessment(payload.id, actor);
        return successResponse(publishedAssessment, "Academic assessment published successfully.");
      case 'lock_academic_assessment':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var lockedAssessment = lockAcademicAssessment(payload.id, actor);
        return successResponse(lockedAssessment, "Academic assessment locked successfully.");

      // --- SPRINT 4: ACADEMIC SCORES ---
      case 'save_academic_scores':
        var scoresRes = saveAcademicScores(payload, actor);
        return successResponse(scoresRes, "Academic scores saved successfully.");
      case 'update_academic_score':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updatedScore = updateAcademicScore(payload.id, payload, actor);
        return successResponse(updatedScore, "Academic score updated successfully.");
      case 'list_academic_scores_by_assessment':
        if (!payload.assessment_id) return errorResponse('MISSING_PARAMETER', 'assessment_id is required.');
        var scoresList = listAcademicScoresByAssessment(payload.assessment_id, actor);
        return successResponse(scoresList, "Academic scores retrieved successfully.");
      case 'get_student_academic_summary':
        var studentSummary = getStudentAcademicSummary(payload, actor);
        return successResponse(studentSummary, "Student academic summary retrieved successfully.");
      case 'get_class_academic_summary':
        var classSummary = getClassAcademicSummary(payload, actor);
        return successResponse(classSummary, "Class academic summary retrieved successfully.");
        
      // --- SPRINT 5: CULTURE SCORES ---
      case 'save_culture_scores':
        var saveRes = saveCultureScores(payload, actor);
        return successResponse(saveRes, "Culture scores saved successfully.");
      case 'update_culture_score':
        if (!payload.id) return errorResponse('MISSING_PARAMETER', 'id is required.');
        var updateRes = updateCultureScore(payload.id, payload, actor);
        return successResponse(updateRes, "Culture score updated successfully.");
      case 'list_culture_scores_by_date':
        var listDateRes = listCultureScoresByDate(payload, actor);
        return successResponse(listDateRes, "Culture scores retrieved successfully.");
      case 'get_student_culture_scores':
        var getStudentRes = getStudentCultureScores(payload, actor);
        return successResponse(getStudentRes, "Student culture scores retrieved successfully.");
        
      // --- SPRINT 5: CHARACTER SUMMARY ---
      case 'get_student_character_summary':
        var getStudentSummaryRes = getStudentCharacterSummary(payload, actor);
        return successResponse(getStudentSummaryRes, "Student character summary retrieved successfully.");
      case 'get_class_character_summary':
        var getClassSummaryRes = getClassCharacterSummary(payload, actor);
        return successResponse(getClassSummaryRes, "Class character summary retrieved successfully.");
        
      // --- SPRINT 6: REPORTING & MONITORING ---
      case 'get_student_progress_dashboard':
        var studDash = get_student_progress_dashboard(payload, actor);
        return successResponse(studDash, "Student progress dashboard retrieved successfully.");
      case 'get_class_monitoring_dashboard':
        var classDash = get_class_monitoring_dashboard(payload, actor);
        return successResponse(classDash, "Class monitoring dashboard retrieved successfully.");
      case 'get_teacher_monitoring_dashboard':
        var teachDash = get_teacher_monitoring_dashboard(payload, actor);
        return successResponse(teachDash, "Teacher monitoring dashboard retrieved successfully.");
      case 'get_school_dashboard':
        var schoolDash = get_school_dashboard(payload, actor);
        return successResponse(schoolDash, "School dashboard retrieved successfully.");
      case 'get_student_watchlist':
        var watchlistRes = get_student_watchlist(payload, actor);
        return successResponse(watchlistRes, "Student watchlist retrieved successfully.");
      case 'calculate_academic_completeness':
        assertCompletenessAccess(actor, payload.class_id, payload.academic_year_id, payload.semester_id);
        var acadComp = calculate_academic_completeness(payload.class_id, payload.academic_year_id, payload.semester_id);
        return successResponse(acadComp, "Academic completeness calculated successfully.");
      case 'calculate_culture_completeness':
        assertCompletenessAccess(actor, payload.class_id, payload.academic_year_id, payload.semester_id);
        var cultComp = calculate_culture_completeness(payload.class_id, payload.academic_year_id, payload.semester_id);
        return successResponse(cultComp, "Culture completeness calculated successfully.");
      case 'get_teacher_culture_completeness':
        var teacherCultureCompleteness = getTeacherCultureCompleteness(payload, actor);
        return successResponse(teacherCultureCompleteness, "Teacher culture completeness retrieved successfully.");
      
      // --- SPRINT 7: DOCUMENT MANAGEMENT & SECURE FILES ---
      case 'upload_student_file':
        var fileUpload = uploadStudentFile(payload, actor);
        return successResponse(fileUpload, "Student file uploaded successfully.");
      case 'replace_student_file':
        var fileReplace = replaceStudentFile(payload, actor);
        return successResponse(fileReplace, "Student file replaced successfully.");
      case 'list_student_files':
        var fileList = listStudentFiles(payload, actor);
        return successResponse(fileList, "Student files retrieved successfully.");
      case 'get_student_file_access':
        var fileAccess = getStudentFileAccess(payload, actor);
        return successResponse(fileAccess, "Student file access retrieved successfully.");
      case 'archive_student_file':
        var fileArchive = archiveStudentFile(payload, actor);
        return successResponse(fileArchive, "Student file archived successfully.");
      case 'setup_storage_folders':
        var storageSetup = setupStorageFolders(payload, actor);
        return successResponse(storageSetup, "Storage folders set up successfully.");
      
      // --- SPRINT 8: PARENT PORTAL ---
      case 'parent_verify_access':
        var verifyRes = parentVerifyAccess(payload, requestMeta);
        return successResponse(verifyRes, "Access verified successfully.");
      case 'parent_login':
        var loginRes = parentLogin(payload, requestMeta);
        return successResponse(loginRes, "Access verified successfully.");
      case 'parent_logout':
        var logoutRes = parentLogout(payload, requestMeta);
        return successResponse(logoutRes, "Logout successful.");
      case 'parent_me':
        var meRes = parentMe(payload);
        return successResponse(meRes, "Parent profile retrieved successfully.");
      case 'parent_get_dashboard':
        var dashRes = parentGetDashboard(payload);
        return successResponse(dashRes, "Parent dashboard retrieved successfully.");
      case 'parent_get_academic_summary':
        var acadSummaryRes = parentGetAcademicSummary(payload);
        return successResponse(acadSummaryRes, "Parent academic summary retrieved successfully.");
      case 'parent_get_character_summary':
        var charSummaryRes = parentGetCharacterSummary(payload);
        return successResponse(charSummaryRes, "Parent character summary retrieved successfully.");
      case 'parent_get_character_detail':
        var charDetailRes = parentGetCharacterDetail(payload);
        return successResponse(charDetailRes, "Parent character detail retrieved successfully.");
      case 'parent_get_academic_detail':
        var acadDetailRes = parentGetAcademicDetail(payload);
        return successResponse(acadDetailRes, "Parent academic detail retrieved successfully.");
      case 'parent_get_available_periods':
        var availablePeriodsRes = parentGetAvailablePeriods(payload);
        return successResponse(availablePeriodsRes, "Parent available periods retrieved successfully.");
      
      // --- SPRINT 9: IMPORT FOUNDATION ---
      case 'create_import_session':
        var session = createImportSession(payload, actor);
        return successResponse(session, "Import session created successfully.");
      case 'preview_import_data':
        var preview = previewImportData(payload, actor);
        return successResponse(preview, "Import data preview retrieved successfully.");
      case 'confirm_import_data':
        var confirmation = confirmImportData(payload, actor);
        return successResponse(confirmation, "Import data confirmed successfully.");
      case 'get_import_log':
        var importLog = getImportLog(payload, actor);
        return successResponse(importLog, "Import log retrieved successfully.");
      case 'download_import_error_report':
        var errReport = downloadImportErrorReport(payload, actor);
        return successResponse(errReport, "Download URL retrieved successfully.");
      case 'list_import_logs':
        var logsList = listImportLogs(payload, actor);
        return successResponse(logsList, "Import logs retrieved successfully.");
      case 'get_import_template':
        var template = getImportTemplate(payload, actor);
        return successResponse(template, "Import template retrieved successfully.");
        
      // --- SPRINT 10: REPORTS, SNAPSHOTS, & FINALIZATION ---
      case 'export_student_academic_report':
        var studAcadRep = exportStudentAcademicReport(payload, actor);
        return successResponse(studAcadRep, "Student academic report exported successfully.");
      case 'export_student_character_report':
        var studCharRep = exportStudentCharacterReport(payload, actor);
        return successResponse(studCharRep, "Student character report exported successfully.");
      case 'export_student_full_report':
        var studFullRep = exportStudentFullReport(payload, actor);
        return successResponse(studFullRep, "Student full report exported successfully.");
      case 'export_class_academic_report':
        var classAcadRep = exportClassAcademicReport(payload, actor);
        return successResponse(classAcadRep, "Class academic report exported successfully.");
      case 'export_class_character_report':
        var classCharRep = exportClassCharacterReport(payload, actor);
        return successResponse(classCharRep, "Class character report exported successfully.");
      case 'export_class_full_report':
        var classFullRep = exportClassFullReport(payload, actor);
        return successResponse(classFullRep, "Class full report exported successfully.");
      case 'export_school_summary_report':
        var schoolSummaryRep = exportSchoolSummaryReport(payload, actor);
        return successResponse(schoolSummaryRep, "School summary report exported successfully.");
      case 'create_student_report_snapshot':
        var studSnapshot = createStudentReportSnapshot(payload, actor);
        return successResponse(studSnapshot, "Student report snapshot created successfully.");
      case 'create_class_report_snapshot':
        var classSnapshot = createClassReportSnapshot(payload, actor);
        return successResponse(classSnapshot, "Class report snapshot created successfully.");
      case 'get_report_snapshot':
        var getSnapshot = getReportSnapshot(payload, actor);
        return successResponse(getSnapshot, "Report snapshot retrieved successfully.");
      case 'list_report_exports':
        var listExports = listReportExports(payload, actor);
        return successResponse(listExports, "Report exports list retrieved successfully.");
      case 'finalize_semester_reports':
        var finalizeRes = finalizeSemesterReports(payload, actor);
        return successResponse(finalizeRes, "Semester reports finalized successfully.");
      case 'get_semester_finalization_status':
        var finalStatus = getSemesterFinalizationStatus(payload, actor);
        return successResponse(finalStatus, "Semester finalization status retrieved successfully.");

      // --- SPRINT 11.6C: EXPORT CSV COMPLIANCE ---
      case 'export_students_csv':
        var expStudents = exportStudentsCsv(payload, actor);
        return successResponse(expStudents, "Students CSV exported successfully.");
      case 'export_academic_scores_csv':
        var expAcad = exportAcademicScoresCsv(payload, actor);
        return successResponse(expAcad, "Academic scores CSV exported successfully.");
      case 'export_character_summary_csv':
        var expChar = exportCharacterSummaryCsv(payload, actor);
        return successResponse(expChar, "Character summary CSV exported successfully.");
      case 'list_export_history':
        var exportHistory = listExportHistory(payload, actor);
        return successResponse(exportHistory, "Export history retrieved successfully.");
      case 'download_report_export':
        var exportDownload = downloadReportExport(payload, actor);
        return successResponse(exportDownload, "Export download authorized successfully.");

      // --- SPRINT 11: PRODUCTION HARDENING ---
      case 'extended_health_check':
        var extendedHealth = extendedHealthCheck(payload, actor);
        return successResponse(extendedHealth, "Extended health check completed successfully.");
      case 'get_system_diagnostics_report':
        var diagnostics = getSystemDiagnosticsReport(payload, actor);
        return successResponse(diagnostics, "System diagnostics report retrieved successfully.");
      case 'run_data_integrity_check':
        var dataIntegrity = runDataIntegrityCheck(payload, actor);
        return successResponse(dataIntegrity, "Data integrity check completed successfully.");
      case 'run_storage_integrity_check':
        var storageIntegrity = runStorageIntegrityCheck(payload, actor);
        return successResponse(storageIntegrity, "Storage integrity check completed successfully.");
      case 'search_audit_logs':
        var auditLogs = searchAuditLogs(payload, actor);
        return successResponse(auditLogs, "Audit logs retrieved successfully.");
      case 'create_manual_backup_snapshot':
        var backupSnapshot = createManualBackupSnapshot(payload, actor);
        return successResponse(backupSnapshot, "Manual backup snapshot created successfully.");
      case 'list_backup_snapshots':
        var backupSnapshots = listBackupSnapshots(payload, actor);
        return successResponse(backupSnapshots, "Backup snapshots retrieved successfully.");
      case 'preview_restore_backup':
        var restorePreview = previewRestoreBackup(payload, actor);
        return successResponse(restorePreview, "Restore preview generated successfully.");
        
      // --- MODUL KEUANGAN (SPP MANUAL) ---
      case 'list_spp_payments':
        assertAdminOrOperatorRole(actor);
        var payments = listSppPaymentsForAdmin(payload, actor);
        return successResponse(payments, "SPP payments list retrieved successfully.");
      case 'verify_spp_payment':
        assertAdminOrOperatorRole(actor);
        var verified = verifyPaymentBulk(actor, payload.student_id, payload.amount_paid, payload.payment_method, payload.notes, payload.advance_months);
        return successResponse(verified, "SPP payment verified successfully.");
      case 'verify_bulk_spp_payments':
        assertAdminOrOperatorRole(actor);
        if (!payload.student_ids || !Array.isArray(payload.student_ids)) {
          return errorResponse('MISSING_PARAMETER', 'student_ids array is required.');
        }
        var verifiedBulk = verifyBulkPayments(actor, payload.student_ids, payload.amount_paid, payload.payment_method, payload.notes, payload.advance_months);
        return successResponse(verifiedBulk, "Bulk SPP payments verified successfully.");
      case 'spp_revert_payment':
        assertAdminOrOperatorRole(actor);
        if (!payload.payment_id) {
          return errorResponse('MISSING_PARAMETER', 'payment_id is required.');
        }
        var reverted = revertSppPayment(actor, payload.payment_id);
        return successResponse(reverted, "SPP payment reverted successfully.");
      case 'parent_get_spp_status':
        var parentSession = requireParentSession(payload.parent_access_token || request.token || '');
        var parentStudentId = parentSession.student_id;
        var sppHistory = getStudentSppHistory(parentStudentId, { id: 'parent_' + parentStudentId, name: 'Parent of ' + parentStudentId, role: 'parent' });
        return successResponse(sppHistory, "Parent SPP history retrieved successfully.");

      // --- ATTENDANCE GEOLOCATION ---
      case 'record_attendance':
        if (typeof payload.lat === 'undefined' || typeof payload.lng === 'undefined') {
          return errorResponse('MISSING_PARAMETER', 'lat and lng parameters are required.');
        }
        var attendanceRecord = recordAttendance(actor, payload.lat, payload.lng);
        return successResponse(attendanceRecord, "Presensi berhasil dicatat.");

      case 'get_attendance_history':
        var history = get_attendance_history(actor, payload.month, payload.year);
        if (history && history.error) {
          return errorResponse('ATTENDANCE_ERROR', history.message, history);
        }
        return successResponse(history, "Riwayat presensi berhasil diambil.");

      case 'record_manual_attendance':
        var manualRecord = record_manual_attendance(actor, payload.target_teacher_id, payload.date, payload.status);
        if (manualRecord && manualRecord.error) {
          return errorResponse('ATTENDANCE_ERROR', manualRecord.message, manualRecord);
        }
        return successResponse(manualRecord, "Presensi manual berhasil dicatat.");

      case 'get_daily_attendance_roster':
        if (!payload.date) {
          return errorResponse('MISSING_PARAMETER', 'date is required.');
        }
        var roster = get_daily_attendance_roster(actor, payload.date);
        if (roster && roster.error) {
          return errorResponse('ATTENDANCE_ERROR', roster.message, roster);
        }
        return successResponse(roster, "Roster presensi harian berhasil diambil.");

      case 'mutate_lifecycle_status':
        if (!payload.sheetName || !payload.id || !payload.status) {
          return errorResponse('MISSING_PARAMETER', 'sheetName, id, and status parameters are required.');
        }
        var mutateRes = handleMutateLifecycleStatus(payload, actor);
        return successResponse(mutateRes, "Lifecycle status mutated successfully.");

      default:
        return errorResponse('UNKNOWN_ACTION', "Action '" + action + "' is not supported.");
    }
  } catch (err) {
    return handleError(err);
  }
}

function isStudentReportAction(action) {
  return [
    'export_student_academic_report',
    'export_student_character_report',
    'export_student_full_report'
  ].indexOf(action) !== -1;
}

/**
 * Resolves the actor's user from a server-side staff session token.
 * Throws ERR_UNAUTHORIZED if missing, invalid, expired, revoked, or inactive.
 * @param {string} token
 * @param {Object} requestMeta
 * @returns {Object} User record.
 */
function resolveActorFromToken(token, requestMeta) {
  var resolved = resolveStaffSessionToken(token, requestMeta);
  return resolved.actor;
}

function enforceActorPayloadConsistency(payload, actor) {
  if (payload && payload.actor_user_id && actor && payload.actor_user_id !== actor.id) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: actor_user_id does not match the authenticated session.'
    };
  }
}

/**
 * Asserts the actor is an admin or administrator.
 * Throws ERR_FORBIDDEN if they do not match.
 * @param {Object} actor
 */
function assertAdminRole(actor) {
  if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to perform this master data action.'
    };
  }
}

function assertStaffRole(actor) {
  if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN && actor.role !== ROLES.TEACHER) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to perform this action.'
    };
  }
}

function assertBootstrapAllowed(actor, action, requestMeta) {
  if (!actor || actor.role !== ROLES.ADMINISTRATOR) {
    safeAudit(function() {
      logBootstrapDenied(actor, action, 'administrator_required', requestMeta);
    });
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: bootstrap action requires administrator role.'
    };
  }
  if (typeof ALLOW_BOOTSTRAP_ACTIONS === 'undefined' || ALLOW_BOOTSTRAP_ACTIONS !== true) {
    safeAudit(function() {
      logBootstrapDenied(actor, action, 'bootstrap_disabled', requestMeta);
    });
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: bootstrap actions are disabled.'
    };
  }
}

function logBootstrapDenied(actor, action, reason, meta) {
  meta = meta || {};
  writeAuditLog({
    user_id: actor ? actor.id : '',
    user_name: actor ? actor.name : '',
    user_role: actor ? actor.role : '',
    action: 'bootstrap_denied',
    entity_type: 'bootstrap',
    entity_id: action || '',
    old_value: '',
    new_value: JSON.stringify({ reason: reason }),
    description: 'Bootstrap action denied: ' + action,
    ip_address: meta.ip_address || '',
    user_agent: meta.user_agent || ''
  });
}

/**
 * Sprint 1 public/bootstrap handlers.
 * Keep these global because Router routes call them directly and regression
 * tests depend on these action contracts staying alive across later sprints.
 */
function handleHealthCheck(payload) {
  var spreadsheetId = '';
  try {
    spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  } catch (err) {
    spreadsheetId = 'unavailable';
  }
  
  return successResponse({
    status: 'active',
    timestamp: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    spreadsheet_id: spreadsheetId,
    sprint_version: '3.0.0'
  }, "System is healthy.");
}

function handleSetupDatabase(actor, requestMeta) {
  assertBootstrapAllowed(actor, 'setup_database', requestMeta);
  setupDatabase();
  return successResponse({
    sprint_version: '3.0.0'
  }, "Database setup completed successfully.");
}

function handleSeedInitialData(actor, requestMeta) {
  assertBootstrapAllowed(actor, 'seed_initial_data', requestMeta);
  seedInitialData();
  return successResponse({
    sprint_version: '3.0.0'
  }, "Initial data seeded successfully.");
}

function handleLogin(payload, requestMeta) {
  var loginResult = loginStaff(payload.identifier, payload.password, requestMeta);
  return successResponse(loginResult, "Login successful.");
}

function handleGetCurrentUser(actor, payload) {
  if (payload && payload.user_id) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: get_current_user does not accept user_id.'
    };
  }
  return successResponse({ user: sanitizeUserForClient(actor) }, "Current user retrieved successfully.");
}

function handleLogout(token, actor, requestMeta) {
  var result = revokeStaffSessionToken(token, actor, requestMeta);
  return successResponse(result, "Logout successful.");
}

function handleGetMasterDataBasic(payload) {
  return successResponse({
    culture_indicators: listRecords(SHEETS.CULTURE_INDICATORS),
    character_values: listRecords(SHEETS.CHARACTER_VALUES),
    culture_character_mappings: listRecords(SHEETS.CULTURE_CHARACTER_MAPPINGS),
    app_settings: getAppSettings()
  }, "Basic master data retrieved successfully.");
}

function handleDebugBackendVersion(payload, actor) {
  var hasEnrollmentIdTeacher = false;
  try {
    var mockStudent = { id: 'STU_1', nisn: '123', full_name: 'Test', student_enrollment_id: 'ENR_1' };
    var sanitizedTeacher = sanitizeStudentForRole(mockStudent, ROLES.TEACHER);
    hasEnrollmentIdTeacher = sanitizedTeacher && (typeof sanitizedTeacher.student_enrollment_id !== 'undefined');
  } catch (e) {
    hasEnrollmentIdTeacher = 'error: ' + e.message;
  }

  return {
    version: "SIUBA_BACKEND_4A2_PATCH_20260620",
    timestamp: new Date().toISOString(),
    studentSecurityHasEnrollmentId: hasEnrollmentIdTeacher,
    actor: actor ? {
      id: actor.id,
      role: actor.role,
      name: actor.name
    } : null,
    roles_teacher_val: ROLES.TEACHER,
    status_active_val: STATUS.ACTIVE
  };
}

/**
 * Endpoint helper to validate permission and trigger status mutation.
 * @param {Object} payload
 * @param {Object} actor
 * @returns {Object}
 */
function handleMutateLifecycleStatus(payload, actor) {
  var sheetName = payload.sheetName;
  var id = payload.id;
  var targetStatus = payload.status;
  
  if (!sheetName || !id || !targetStatus) {
    throw new Error("Missing parameters: sheetName, id, status are required.");
  }
  
  // Step 10: Enterprise Permissions check
  if (actor.role === ROLES.ADMINISTRATOR) {
    // Super Admin can do everything
  } else if (actor.role === ROLES.ADMIN) {
    // Admin cannot change user status or teacher profiles status, but can do others
    if (sheetName === SHEETS.USERS || sheetName === SHEETS.TEACHER_PROFILES) {
      throw new Error("Forbidden: Admin cannot mutate User or Teacher Profile lifecycles.");
    }
  } else if (actor.role === ROLES.TEACHER) {
    // Teacher can only change status of assessments they own
    if (sheetName === SHEETS.ACADEMIC_ASSESSMENTS) {
      var record = getRecordById(sheetName, id);
      if (!record || record.teacher_user_id !== actor.id) {
        throw new Error("Forbidden: You do not own this assessment.");
      }
    } else {
      throw new Error("Forbidden: Teachers cannot mutate status for " + sheetName);
    }
  } else {
    throw new Error("Forbidden: Unknown role.");
  }
  
  // Update record (this calls validateRelationGuard, buildLifecyclePatch, and executeLifecycleCascade in Repository.gs)
  return updateRecord(sheetName, id, { lifecycle_status: targetStatus }, actor);
}
