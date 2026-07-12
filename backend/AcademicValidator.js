/**
 * AcademicValidator.gs
 * Validation logic for academic assessments and academic scores.
 */

/**
 * Checks if a teacher is currently assigned as the class teacher.
 * @param {string} teacherUserId
 * @param {string} classId
 * @param {string} academicYearId
 * @param {string} semesterId
 * @returns {boolean}
 */
function isTeacherAssignedToClass(teacherUserId, classId, academicYearId, semesterId) {
  var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
    return a.class_id === classId &&
           a.teacher_user_id === teacherUserId &&
           a.academic_year_id === academicYearId &&
           a.semester_id === semesterId &&
           a.status === STATUS.ACTIVE;
  });
  return assignments.length > 0;
}

/**
 * Validates academic assessment payload.
 * @param {Object} data - Assessment payload.
 * @param {boolean} isUpdate - True if updating existing record.
 * @param {string} [excludeId] - Existing assessment ID.
 * @param {Object} actor - The user performing the action.
 */
function validateAcademicAssessment(data, isUpdate, excludeId, actor) {
  if (!isUpdate) {
    validateRequiredFields(data, [
      'class_id', 'subject_id', 'academic_year_id', 'semester_id',
      'title', 'assessment_date', 'score_min', 'score_max'
    ]);
  }

  var classId = data.class_id;
  var subjectId = data.subject_id;
  var yearId = data.academic_year_id;
  var semesterId = data.semester_id;
  var title = data.title;
  var dateVal = data.assessment_date;
  var scoreMin = data.score_min;
  var scoreMax = data.score_max;

  if (isUpdate) {
    var existing = assertRecordExists(SHEETS.ACADEMIC_ASSESSMENTS, excludeId);
    classId = classId !== undefined ? classId : existing.class_id;
    subjectId = subjectId !== undefined ? subjectId : existing.subject_id;
    yearId = yearId !== undefined ? yearId : existing.academic_year_id;
    semesterId = semesterId !== undefined ? semesterId : existing.semester_id;
    title = title !== undefined ? title : existing.title;
    dateVal = dateVal !== undefined ? dateVal : existing.assessment_date;
    scoreMin = scoreMin !== undefined ? scoreMin : existing.score_min;
    scoreMax = scoreMax !== undefined ? scoreMax : existing.score_max;
  }

  // 1. class_id harus exist.
  assertRecordExists(SHEETS.CLASSES, classId);

  // 2. subject_id harus exist.
  assertRecordExists(SHEETS.SUBJECTS, subjectId);

  // 3. academic_year_id harus exist.
  assertRecordExists(SHEETS.ACADEMIC_YEARS, yearId);

  // 4. semester_id harus exist.
  var sem = assertRecordExists(SHEETS.SEMESTERS, semesterId);

  // 5. semester_id harus milik academic_year_id.
  if (sem.academic_year_id !== yearId) {
    throw new Error("Semester does not belong to the specified academic year.");
  }

  // 6. subject_id harus terdaftar active pada `class_subjects` untuk class_id + academic_year_id + semester_id.
  var activeSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
    return cs.class_id === classId &&
           cs.subject_id === subjectId &&
           cs.academic_year_id === yearId &&
           cs.semester_id === semesterId &&
           cs.status === STATUS.ACTIVE;
  });
  if (activeSubjects.length === 0) {
    throw new Error("Subject is not actively assigned to this class for the specified period.");
  }

  // 7. Guru hanya boleh create/update untuk kelas yang dia ampu.
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, classId, yearId, semesterId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: "Forbidden: You are not assigned to manage class " + classId
      };
    }
  }

  // 8. score_min dan score_max numerik.
  if (isNaN(Number(scoreMin)) || isNaN(Number(scoreMax))) {
    throw new Error("score_min and score_max must be numeric values.");
  }

  // 9. score_min tidak boleh lebih besar dari score_max.
  if (Number(scoreMin) > Number(scoreMax)) {
    throw new Error("score_min cannot be greater than score_max.");
  }

  // 10. title tidak boleh kosong.
  if (title !== undefined && (!title || String(title).trim() === '')) {
    throw new Error("Title is required and cannot be empty.");
  }

  // 11. assessment_date harus tanggal valid.
  if (dateVal && isNaN(Date.parse(dateVal))) {
    throw new Error("assessment_date must be a valid date.");
  }
}

/**
 * Validates academic score payload.
 * @param {Object} scoreData - Individual score payload.
 * @param {Object} assessment - Assessment record.
 * @param {Object} actor - User actor.
 */
function validateAcademicScore(scoreData, assessment, actor) {
  var studentId = scoreData.student_id;
  var studentEnrollmentId = scoreData.student_enrollment_id;
  var scoreVal = scoreData.score;

  // 6. student_id harus exist.
  assertRecordExists(SHEETS.STUDENTS, studentId);

  // 7. student_enrollment_id harus exist.
  var enrollment = assertRecordExists(SHEETS.STUDENT_ENROLLMENTS, studentEnrollmentId);

  // 8. student_enrollment harus cocok dengan student_id.
  if (enrollment.student_id !== studentId) {
    throw new Error("Student enrollment record does not match student_id.");
  }

  // 9. student_enrollment harus cocok dengan class_id, academic_year_id, semester_id dari assessment.
  if (enrollment.class_id !== assessment.class_id ||
      enrollment.academic_year_id !== assessment.academic_year_id ||
      enrollment.semester_id !== assessment.semester_id) {
    throw new Error("Student enrollment class/period does not match the assessment.");
  }

  // 10. Guru hanya boleh input siswa dari kelasnya.
  if (actor.role === ROLES.TEACHER) {
    if (!isTeacherAssignedToClass(actor.id, assessment.class_id, assessment.academic_year_id, assessment.semester_id)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: "Forbidden: You are not authorized to manage scores for this class."
      };
    }
  }

  // 11. score boleh kosong/null.
  // 13. Jika score diisi, harus numerik.
  // 14. Jika score diisi, harus berada antara score_min dan score_max assessment.
  if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '') {
    if (isNaN(Number(scoreVal))) {
      throw new Error("Score must be numeric.");
    }
    var numScore = Number(scoreVal);
    if (numScore < Number(assessment.score_min) || numScore > Number(assessment.score_max)) {
      throw new Error("Score (" + numScore + ") is out of valid range [" + assessment.score_min + ", " + assessment.score_max + "].");
    }
  }
}

/**
 * Asserts if the actor is allowed to edit academic scores for a given assessment.
 * Future-proof design reading role, date, semester finalization, and status context.
 * @param {Object} actor
 * @param {Object} assessment
 */
function assertAcademicEditAllowed(actor, assessment) {
  if (!actor) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Unauthorized: Actor is missing.'
    };
  }
  if (!assessment) {
    throw {
      code: 'ERR_VALIDATION',
      message: 'Validation: Assessment record is required.'
    };
  }
  
  // 1. Semester Finalization Check
  assertSemesterNotFinalized(assessment.academic_year_id, assessment.semester_id);
  
  // 2. Assessment Status Check
  if (assessment.status === STATUS.LOCKED) {
    throw {
      code: 'ERR_ASSESSMENT_LOCKED',
      message: 'Cannot modify scores: Academic assessment is locked.'
    };
  }
  
  var role = String(actor.role).toLowerCase().trim();
  if (role === 'administrator') {
    return; // Administrator has unlimited access
  }
  
  // 3. Edit Window Lock Period Check
  var dateStr = assessment.assessment_date;
  if (!dateStr || isNaN(Date.parse(dateStr))) {
    throw {
      code: 'ERR_VALIDATION',
      message: 'Assessment has an invalid date.'
    };
  }
  
  var parts = dateStr.split('-');
  var targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var diffTime = now.getTime() - targetDate.getTime();
  var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (role === 'guru' || role === 'teacher') {
    if (diffDays > 7) {
      throw {
        code: 'ERR_PERIOD_LOCKED',
        message: 'Error: The period for editing academic scores is locked (Guru limit is 7 days).'
      };
    }
  } else if (role === 'admin') {
    if (diffDays > 30) {
      throw {
        code: 'ERR_PERIOD_LOCKED',
        message: 'Error: The period for editing academic scores is locked (Admin limit is 30 days).'
      };
    }
  } else {
    throw {
      code: 'ERR_PERIOD_LOCKED',
      message: 'Error: Unknown role or locked period.'
    };
  }
}
