/**
 * AcademicService.gs
 * Business logic and database operations for Sprint 4.
 */

// Helper to check general access permission for assessments/scores
function assertAssessmentWritePermission(actor, classId, yearId, semesterId) {
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return;
  }
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned as the class teacher for this class.'
      };
    }
    return;
  }
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: You do not have permission to modify assessments.'
  };
}

function assertAssessmentReadPermission(actor, classId, yearId, semesterId) {
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return;
  }
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You do not have permission to view assessments for this class.'
      };
    }
    return;
  }
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: Unauthorized access.'
  };
}

// Custom Audit Logging helper
function logAcademicAction(actor, action, entityType, entityId, oldValue, newValue, description) {
  writeAuditLog({
    user_id: actor ? actor.id : 'system',
    user_name: actor ? actor.name : 'System',
    user_role: actor ? actor.role : 'system',
    action: action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: auditJson(oldValue),
    new_value: auditJson(newValue),
    description: description
  });
}

// --- ASSESSMENT OPERATIONS ---

function createAcademicAssessment(payload, actor) {
  validateAcademicAssessment(payload, false, null, actor);
  assertSemesterNotFinalized(payload.academic_year_id, payload.semester_id);
  
  var record = {
    teacher_user_id: actor.id,
    class_id: payload.class_id,
    subject_id: payload.subject_id,
    academic_year_id: payload.academic_year_id,
    semester_id: payload.semester_id,
    title: String(payload.title).trim(),
    description: payload.description || '',
    assessment_date: payload.assessment_date,
    score_min: Number(payload.score_min),
    score_max: Number(payload.score_max),
    status: STATUS.DRAFT
  };
  
  var created = createRecord(SHEETS.ACADEMIC_ASSESSMENTS, record, actor);
  
  // Custom audit log
  logAcademicAction(actor, 'create_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, created.id, null, created, 'Created academic assessment');
  
  return created;
}

function updateAcademicAssessment(id, payload, actor) {
  var existing = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, id);
  assertAssessmentWritePermission(actor, existing.class_id, existing.academic_year_id, existing.semester_id);
  if (existing.status === STATUS.LOCKED) {
    throw {
      code: 'ERR_ASSESSMENT_LOCKED',
      message: 'Academic assessment is locked and can no longer be updated.'
    };
  }
  assertSemesterNotFinalized(existing.academic_year_id, existing.semester_id);
  
  var patch = {};
  var allowedFields = ['title', 'description', 'assessment_date', 'score_min', 'score_max'];
  allowedFields.forEach(function(f) {
    if (payload[f] !== undefined) {
      if (f === 'score_min' || f === 'score_max') {
        patch[f] = Number(payload[f]);
      } else {
        patch[f] = payload[f];
      }
    }
  });

  validateAcademicAssessment(patch, true, id, actor);
  
  var updated = updateRecord(SHEETS.ACADEMIC_ASSESSMENTS, id, patch, actor);
  
  logAcademicAction(actor, 'update_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, id, existing, updated, 'Updated academic assessment');
  
  return updated;
}

function listAcademicAssessments(payload, actor) {
  var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS);
  
  // Apply filtering
  if (actor.role === ROLES.TEACHER) {
    var assignedClassIds = getTeacherActiveClasses(actor.id);
    assessments = assessments.filter(function(a) {
      return assignedClassIds.indexOf(a.class_id) !== -1;
    });
  }
  
  if (payload.class_id) {
    assessments = assessments.filter(function(a) { return a.class_id === payload.class_id; });
  }
  if (payload.subject_id) {
    assessments = assessments.filter(function(a) { return a.subject_id === payload.subject_id; });
  }
  if (payload.academic_year_id) {
    assessments = assessments.filter(function(a) { return a.academic_year_id === payload.academic_year_id; });
  }
  if (payload.semester_id) {
    assessments = assessments.filter(function(a) { return a.semester_id === payload.semester_id; });
  }
  
  return assessments;
}

function getAcademicAssessmentDetail(id, actor) {
  var assessment = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, id);
  assertAssessmentReadPermission(actor, assessment.class_id, assessment.academic_year_id, assessment.semester_id);
  return assessment;
}

function publishAcademicAssessment(id, actor) {
  var assessment = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, id);
  assertAssessmentWritePermission(actor, assessment.class_id, assessment.academic_year_id, assessment.semester_id);
  assertSemesterNotFinalized(assessment.academic_year_id, assessment.semester_id);

  if (assessment.status === STATUS.LOCKED) {
    throw {
      code: 'ERR_ASSESSMENT_LOCKED',
      message: 'Academic assessment is locked and cannot be published.'
    };
  }

  if (assessment.status !== STATUS.DRAFT) {
    throw {
      code: 'ERR_INVALID_ASSESSMENT_STATUS',
      message: 'Only draft academic assessments can be published.'
    };
  }
  
  var updated = updateRecord(SHEETS.ACADEMIC_ASSESSMENTS, id, { status: STATUS.PUBLISHED }, actor);
  
  logAcademicAction(actor, 'publish_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, id, assessment, updated, 'Published academic assessment');
  
  return updated;
}

function lockAcademicAssessment(id, actor) {
  var assessment = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, id);
  assertAssessmentWritePermission(actor, assessment.class_id, assessment.academic_year_id, assessment.semester_id);
  
  var updated = updateRecord(SHEETS.ACADEMIC_ASSESSMENTS, id, { status: STATUS.LOCKED }, actor);
  
  logAcademicAction(actor, 'lock_academic_assessment', SHEETS.ACADEMIC_ASSESSMENTS, id, assessment, updated, 'Locked academic assessment');
  
  return updated;
}

// Helper to list teacher active class IDs
function getTeacherActiveClasses(teacherUserId) {
  var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
    return a.teacher_user_id === teacherUserId && a.status === STATUS.ACTIVE;
  });
  return assignments.map(function(a) { return a.class_id; });
}

// --- SCORES OPERATIONS ---

function saveAcademicScores(payload, actor) {
  validateRequiredFields(payload, ['assessment_id', 'scores']);
  
  var assessment = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, payload.assessment_id);
  
  Logger.log("[FINALIZATION CHECK][saveAcademicScores] assessment_id " + assessment.id);
  Logger.log("[FINALIZATION CHECK][saveAcademicScores] academic_year_id " + assessment.academic_year_id);
  Logger.log("[FINALIZATION CHECK][saveAcademicScores] semester_id " + assessment.semester_id);
  Logger.log("[FINALIZATION CHECK][saveAcademicScores] finalized " + isSemesterFinalized(assessment.academic_year_id, assessment.semester_id));
  
  // Consolidates lock period, finalized semester, and locked assessment checks
  assertAcademicEditAllowed(actor, assessment);
  
  // 2. assessment status harus published.
  // 3. Jika assessment draft, tolak.
  if (assessment.status === STATUS.DRAFT) {
    throw new Error("Cannot save scores for a draft assessment.");
  }
  
  // 10. Guru hanya boleh input siswa dari kelasnya.
  assertAssessmentWritePermission(actor, assessment.class_id, assessment.academic_year_id, assessment.semester_id);
  
  var results = [];
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    payload.scores.forEach(function(scoreItem) {
      validateAcademicScore(scoreItem, assessment, actor);
      
      // Look for existing active score for this assessment + student
      var existingScores = findRows(SHEETS.ACADEMIC_SCORES, function(s) {
        return s.assessment_id === assessment.id &&
               s.student_id === scoreItem.student_id &&
               s.status === STATUS.ACTIVE;
      });
      
      var scoreVal = (scoreItem.score === undefined || scoreItem.score === null || scoreItem.score === '') ? null : Number(scoreItem.score);
      var noteVal = scoreItem.note || '';
      
      if (existingScores.length > 0) {
        var existing = existingScores[0];
        // Only update if changes occur
        var oldScore = existing.score === null ? null : Number(existing.score);
        var newScore = scoreVal;
        
        if (oldScore !== newScore || existing.note !== noteVal) {
          var patch = {
            score: scoreVal,
            note: noteVal
          };
          var updated = updateRowById(SHEETS.ACADEMIC_SCORES, existing.id, patch);
          
          logAcademicAction(
            actor,
            'update_academic_score',
            SHEETS.ACADEMIC_SCORES,
            existing.id,
            existing,
            updated,
            'Updated academic score'
          );
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        // Create new active score record
        var newRecord = {
          assessment_id: assessment.id,
          student_id: scoreItem.student_id,
          student_enrollment_id: scoreItem.student_enrollment_id,
          score: scoreVal,
          note: noteVal,
          status: STATUS.ACTIVE
        };
        var created = appendRow(SHEETS.ACADEMIC_SCORES, newRecord);
        
        logAcademicAction(
          actor,
          'input_academic_score',
          SHEETS.ACADEMIC_SCORES,
          created.id,
          null,
          created,
          'Inputted academic score'
        );
        results.push(created);
      }
    });
  } finally {
    lock.releaseLock();
  }
  
  return results;
}

function updateAcademicScore(id, payload, actor) {
  var scoreRecord = assertRecordExists(SHEETS.ACADEMIC_SCORES, id);
  var assessment = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, scoreRecord.assessment_id);
  
  Logger.log("[FINALIZATION CHECK][updateAcademicScore] score_id " + scoreRecord.id);
  Logger.log("[FINALIZATION CHECK][updateAcademicScore] assessment_id " + assessment.id);
  Logger.log("[FINALIZATION CHECK][updateAcademicScore] academic_year_id " + assessment.academic_year_id);
  Logger.log("[FINALIZATION CHECK][updateAcademicScore] semester_id " + assessment.semester_id);
  Logger.log("[FINALIZATION CHECK][updateAcademicScore] finalized " + isSemesterFinalized(assessment.academic_year_id, assessment.semester_id));
  
  assertAcademicEditAllowed(actor, assessment);
  assertAssessmentWritePermission(actor, assessment.class_id, assessment.academic_year_id, assessment.semester_id);
  
  var scoreVal = (payload.score === undefined || payload.score === null || payload.score === '') ? null : Number(payload.score);
  var noteVal = payload.note !== undefined ? payload.note : scoreRecord.note;
  
  // Validate range
  var dummyScoreItem = {
    student_id: scoreRecord.student_id,
    student_enrollment_id: scoreRecord.student_enrollment_id,
    score: scoreVal
  };
  validateAcademicScore(dummyScoreItem, assessment, actor);
  
  var updated = updateRecord(SHEETS.ACADEMIC_SCORES, id, {
    score: scoreVal,
    note: noteVal
  }, actor);
  
  logAcademicAction(actor, 'update_academic_score', SHEETS.ACADEMIC_SCORES, id, scoreRecord, updated, 'Updated single academic score');
  
  return updated;
}

function listAcademicScoresByAssessment(assessmentId, actor) {
  var assessment = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, assessmentId);
  assertAssessmentReadPermission(actor, assessment.class_id, assessment.academic_year_id, assessment.semester_id);
  
  return listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.assessment_id === assessmentId && s.status === STATUS.ACTIVE;
  });
}

// --- SUMMARIES ---

function getStudentAcademicSummary(payload, actor) {
  validateRequiredFields(payload, ['student_id', 'academic_year_id', 'semester_id']);
  
  var studentId = payload.student_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // 1. Get student active enrollment for this period
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.student_id === studentId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  if (enrollments.length === 0) {
    throw new Error("No active student enrollment found for the specified period.");
  }
  
  var enrollment = enrollments[0];
  var classId = enrollment.class_id;
  
  // Authorization: Guru only sees students in their own class
  assertAssessmentReadPermission(actor, classId, yearId, semesterId);
  
  // 2. Fetch assessments for this class + period
  var classAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.class_id === classId &&
           a.academic_year_id === yearId &&
           a.semester_id === semesterId;
  });
  
  var assessmentIds = classAssessments.map(function(a) { return a.id; });
  
  // 3. Fetch scores of this student for these assessments
  var studentScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.student_id === studentId &&
           s.status === STATUS.ACTIVE &&
           assessmentIds.indexOf(s.assessment_id) !== -1;
  });
  
  var scoreMap = {};
  studentScores.forEach(function(s) {
    scoreMap[s.assessment_id] = s;
  });
  
  // 4. Group by Subject
  var subjects = listRecords(SHEETS.SUBJECTS);
  var subjectMap = {};
  subjects.forEach(function(subj) {
    subjectMap[subj.id] = subj;
  });
  
  var subjectSummaries = {};
  var totalScoreSum = 0;
  var totalScoreCount = 0;
  
  classAssessments.forEach(function(a) {
    var subjId = a.subject_id;
    var subj = subjectMap[subjId];
    var subjName = subj ? subj.name : 'Unknown Subject';
    
    if (!subjectSummaries[subjId]) {
      subjectSummaries[subjId] = {
        subject_id: subjId,
        subject_name: subjName,
        scores: [],
        sum: 0,
        count: 0,
        average: null
      };
    }
    
    var scoreRec = scoreMap[a.id];
    var scoreVal = (scoreRec && scoreRec.score !== null && scoreRec.score !== '') ? Number(scoreRec.score) : null;
    
    var detail = {
      assessment_id: a.id,
      assessment_title: a.title,
      assessment_date: a.assessment_date,
      score: scoreVal,
      note: scoreRec ? scoreRec.note : ''
    };
    
    subjectSummaries[subjId].scores.push(detail);
    
    if (scoreVal !== null) {
      subjectSummaries[subjId].sum += scoreVal;
      subjectSummaries[subjId].count += 1;
      
      totalScoreSum += scoreVal;
      totalScoreCount += 1;
    }
  });
  
  // Calculate average per subject
  var subjectList = [];
  for (var key in subjectSummaries) {
    var summ = subjectSummaries[key];
    if (summ.count > 0) {
      summ.average = Number((summ.sum / summ.count).toFixed(2));
    }
    subjectList.push(summ);
  }
  
  var totalAverage = totalScoreCount > 0 ? Number((totalScoreSum / totalScoreCount).toFixed(2)) : null;
  
  return {
    student_id: studentId,
    academic_year_id: yearId,
    semester_id: semesterId,
    class_id: classId,
    subject_summaries: subjectList,
    total_average: totalAverage
  };
}

function getClassAcademicSummary(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);
  
  var classId = payload.class_id;
  var yearId = payload.academic_year_id;
  var semesterId = payload.semester_id;
  
  // Authorization check
  assertAssessmentReadPermission(actor, classId, yearId, semesterId);
  
  // 1. Get all active enrollments for class
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === yearId &&
           e.semester_id === semesterId &&
           e.status === 'active';
  });
  
  var studentIds = enrollments.map(function(e) { return e.student_id; });
  var students = listRecords(SHEETS.STUDENTS, function(s) {
    return studentIds.indexOf(s.id) !== -1;
  });
  
  // 2. Fetch all assessments for this class + period
  var classAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(a) {
    return a.class_id === classId &&
           a.academic_year_id === yearId &&
           a.semester_id === semesterId;
  });
  
  var assessmentIds = classAssessments.map(function(a) { return a.id; });
  
  // 3. Fetch all active scores for these assessments
  var allScores = listRecords(SHEETS.ACADEMIC_SCORES, function(s) {
    return s.status === STATUS.ACTIVE && assessmentIds.indexOf(s.assessment_id) !== -1;
  });
  
  // Map scores by student_id -> assessment_id -> score
  var studentScoreMap = {};
  allScores.forEach(function(s) {
    if (!studentScoreMap[s.student_id]) {
      studentScoreMap[s.student_id] = {};
    }
    studentScoreMap[s.student_id][s.assessment_id] = s.score;
  });
  
  // 4. Calculate average score per student
  var studentSummaries = students.map(function(student) {
    var scoresObj = studentScoreMap[student.id] || {};
    var sum = 0;
    var count = 0;
    
    assessmentIds.forEach(function(aId) {
      var scoreVal = scoresObj[aId];
      if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
        sum += Number(scoreVal);
        count += 1;
      }
    });
    
    return {
      student_id: student.id,
      full_name: student.full_name,
      nisn: student.nisn,
      average_score: count > 0 ? Number((sum / count).toFixed(2)) : null
    };
  });
  
  // 5. Calculate assessment completeness and ungraded count
  var assessmentSummaries = classAssessments.map(function(a) {
    var ungradedCount = 0;
    
    studentIds.forEach(function(sId) {
      var scoresObj = studentScoreMap[sId] || {};
      var scoreVal = scoresObj[a.id];
      if (scoreVal === undefined || scoreVal === null || scoreVal === '') {
        ungradedCount += 1;
      }
    });
    
    var totalStudents = studentIds.length;
    var gradedCount = totalStudents - ungradedCount;
    var completenessPercent = totalStudents > 0 ? Number(((gradedCount / totalStudents) * 100).toFixed(2)) : 100.0;
    
    return {
      assessment_id: a.id,
      title: a.title,
      status: a.status,
      ungraded_students: ungradedCount,
      completeness_percentage: completenessPercent
    };
  });
  
  return {
    class_id: classId,
    academic_year_id: yearId,
    semester_id: semesterId,
    student_summaries: studentSummaries,
    assessment_summaries: assessmentSummaries
  };
}
