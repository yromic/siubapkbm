/**
 * LifecycleEngine.gs
 * Centralized state machine engine to govern entity transitions, referential integrity, and cascading.
 */

var LIFECYCLE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  LOCKED: 'locked',
  ARCHIVED: 'archived',
  SUSPENDED: 'suspended',
  SOFT_DELETED: 'soft_deleted',
  
  // Student specific termination states
  GRADUATED: 'graduated',
  TRANSFERRED: 'transferred',
  WITHDRAWN: 'withdrawn',
  DECEASED: 'deceased'
};

var TRANSITIONS = {
  // Master data: academic years, semesters
  ACADEMIC_PERIOD: {
    'draft': ['active'],
    'active': ['locked'],
    'locked': ['active', 'archived'], // unlock (requires admin/super) or archive
    'archived': []
  },
  // Master data: classes, subjects, class subjects, promotion rules
  MASTER_DATA: {
    'active': ['inactive', 'archived', 'soft_deleted'],
    'inactive': ['active', 'archived', 'soft_deleted'],
    'archived': ['active', 'soft_deleted'],
    'soft_deleted': ['active']
  },
  // Profiles: students
  STUDENT: {
    'active': ['inactive', 'graduated', 'transferred', 'withdrawn', 'deceased', 'soft_deleted'],
    'inactive': ['active', 'archived', 'soft_deleted'],
    'graduated': ['archived', 'active', 'soft_deleted'],
    'transferred': ['archived', 'active', 'soft_deleted'],
    'withdrawn': ['archived', 'active', 'soft_deleted'],
    'deceased': ['archived', 'soft_deleted'],
    'archived': ['active', 'soft_deleted'], // Restore transition
    'soft_deleted': ['active']
  },
  // Profiles: users, teacher_profiles
  USER: {
    'active': ['inactive', 'suspended', 'soft_deleted'],
    'suspended': ['active', 'inactive', 'soft_deleted'],
    'inactive': ['active', 'archived', 'soft_deleted'],
    'archived': ['active', 'soft_deleted'],
    'soft_deleted': ['active']
  },
  // Transactions / Content: assessments, scores, spp, files
  TRANSACTION: {
    'active': ['soft_deleted'],
    'soft_deleted': ['active']
  }
};

/**
 * Gets the transition category for a sheet name.
 * @param {string} sheetName
 * @returns {string}
 */
function getTransitionCategory(sheetName) {
  if (sheetName === SHEETS.ACADEMIC_YEARS || sheetName === SHEETS.SEMESTERS) {
    return 'ACADEMIC_PERIOD';
  }
  if (sheetName === SHEETS.CLASSES || sheetName === SHEETS.SUBJECTS || sheetName === SHEETS.CLASS_SUBJECTS || sheetName === SHEETS.CLASS_PROMOTION_RULES || sheetName === SHEETS.STUDENT_ENROLLMENTS || sheetName === SHEETS.CLASS_TEACHER_ASSIGNMENTS) {
    return 'MASTER_DATA';
  }
  if (sheetName === SHEETS.STUDENTS) {
    return 'STUDENT';
  }
  if (sheetName === SHEETS.USERS || sheetName === SHEETS.TEACHER_PROFILES) {
    return 'USER';
  }
  return 'TRANSACTION';
}

/**
 * Validates whether a state transition is legal.
 * @param {string} sheetName
 * @param {string} oldStatus
 * @param {string} newStatus
 * @returns {boolean}
 */
function isValidTransition(sheetName, oldStatus, newStatus) {
  var normOld = normalizeLifecycleStatus(oldStatus);
  var normNew = normalizeLifecycleStatus(newStatus);
  if (normOld === normNew) return true;
  var category = getTransitionCategory(sheetName);
  var allowed = TRANSITIONS[category][normOld];
  if (!allowed) return false;
  return allowed.indexOf(normNew) !== -1;
}

/**
 * Normalizes status string (supports legacy Indonesian and boolean strings) to standard lowercase keys.
 * @param {string|boolean} status
 * @returns {string}
 */
function normalizeLifecycleStatus(status) {
  if (status === undefined || status === null) return 'active';
  var s = String(status).trim().toLowerCase();
  if (s === 'aktif' || s === 'active' || s === 'true' || s === '1') {
    return 'active';
  }
  if (s === 'tidak aktif' || s === 'tidak_aktif' || s === 'inactive' || s === 'false' || s === '0' || s === 'ended') {
    return 'inactive';
  }
  if (s === 'lulus' || s === 'graduated') {
    return 'graduated';
  }
  if (s === 'pindah' || s === 'transferred') {
    return 'transferred';
  }
  if (s === 'keluar' || s === 'withdrawn') {
    return 'withdrawn';
  }
  if (s === 'meninggal' || s === 'deceased') {
    return 'deceased';
  }
  return s;
}

/**
 * Mutates and prepares patch object with lifecycle metadata.
 * @param {string} sheetName
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {Object} actor
 * @returns {Object} Patch object containing updated status and timestamps
 */
function buildLifecyclePatch(sheetName, oldStatus, newStatus, actor) {
  var now = new Date().toISOString();
  var actorId = actor ? actor.id : 'system';
  var patch = { lifecycle_status: newStatus };
  
  if (newStatus === LIFECYCLE_STATUS.ARCHIVED) {
    patch.archived_at = now;
    patch.archived_by = actorId;
  } else if (newStatus === LIFECYCLE_STATUS.SOFT_DELETED) {
    patch.deleted_at = now;
    patch.deleted_by = actorId;
  } else if (newStatus === LIFECYCLE_STATUS.LOCKED) {
    patch.locked_at = now;
    patch.locked_by = actorId;
  } else if (newStatus === LIFECYCLE_STATUS.SUSPENDED) {
    patch.suspended_at = now;
    patch.suspended_by = actorId;
  } else if (oldStatus === LIFECYCLE_STATUS.ARCHIVED || oldStatus === LIFECYCLE_STATUS.SOFT_DELETED) {
    patch.restored_at = now;
    patch.restored_by = actorId;
  }
  
  return patch;
}

/**
 * Step 7: Referential Integrity Guard.
 * Validates dependencies before allowing status transitions.
 * @param {string} sheetName
 * @param {string} id
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {Object} actor
 */
function validateRelationGuard(sheetName, id, oldStatus, newStatus, actor) {
  var destructive = [LIFECYCLE_STATUS.INACTIVE, LIFECYCLE_STATUS.ARCHIVED, LIFECYCLE_STATUS.SOFT_DELETED, LIFECYCLE_STATUS.SUSPENDED];
  if (destructive.indexOf(newStatus) === -1) {
    // If restoring, validate restore rules instead
    if (oldStatus === LIFECYCLE_STATUS.ARCHIVED || oldStatus === LIFECYCLE_STATUS.SOFT_DELETED) {
      validateRestoreRules(sheetName, id, oldStatus, newStatus, actor);
    }
    return;
  }

  // 1. SUBJECT GUARD
  if (sheetName === SHEETS.SUBJECTS) {
    var activeAssessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(r) {
      return r.subject_id === id && (r.lifecycle_status || r.status) !== LIFECYCLE_STATUS.SOFT_DELETED;
    });
    if (activeAssessments.length > 0) {
      throw new Error("Cannot deactivate/delete Subject: it is still referenced by " + activeAssessments.length + " active assessments.");
    }
  }

  // 2. CLASS GUARD
  if (sheetName === SHEETS.CLASSES) {
    var activeEnrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(r) {
      return r.class_id === id && (r.lifecycle_status || r.status) === LIFECYCLE_STATUS.ACTIVE;
    });
    if (activeEnrollments.length > 0) {
      throw new Error("Cannot deactivate/delete Class: there are still " + activeEnrollments.length + " active student enrollments.");
    }
  }

  // 3. USER (TEACHER) GUARD
  if (sheetName === SHEETS.USERS) {
    var activeAssignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(r) {
      return r.teacher_user_id === id && (r.lifecycle_status || r.status) === LIFECYCLE_STATUS.ACTIVE;
    });
    if (activeAssignments.length > 0) {
      throw new Error("Cannot deactivate/suspend User: teacher is still assigned to " + activeAssignments.length + " active classes.");
    }
  }
}

/**
 * Step 8: Lifecycle Cascading logic.
 * Automatically updates dependent entities.
 * @param {string} sheetName
 * @param {string} id
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {Object} actor
 */
function executeLifecycleCascade(sheetName, id, oldStatus, newStatus, actor) {
  // 1. STUDENT CASCADE (ARCHIVING / DEACTIVATION)
  if (sheetName === SHEETS.STUDENTS) {
    var inactiveStates = [LIFECYCLE_STATUS.ARCHIVED, LIFECYCLE_STATUS.INACTIVE, LIFECYCLE_STATUS.GRADUATED, LIFECYCLE_STATUS.TRANSFERRED, LIFECYCLE_STATUS.WITHDRAWN, LIFECYCLE_STATUS.DECEASED];
    if (inactiveStates.indexOf(newStatus) !== -1) {
      // Deactivate student enrollments
      var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(r) {
        return r.student_id === id && (r.lifecycle_status || r.status) === LIFECYCLE_STATUS.ACTIVE;
      });
      enrollments.forEach(function(enrollment) {
        updateRecord(SHEETS.STUDENT_ENROLLMENTS, enrollment.id, { lifecycle_status: LIFECYCLE_STATUS.INACTIVE }, actor);
      });

      // Archive student files
      var files = listRecords(SHEETS.STUDENT_FILES, function(r) {
        return r.student_id === id && (r.lifecycle_status || r.status) !== LIFECYCLE_STATUS.ARCHIVED;
      });
      files.forEach(function(file) {
        updateRecord(SHEETS.STUDENT_FILES, file.id, { lifecycle_status: LIFECYCLE_STATUS.ARCHIVED }, actor);
      });

      // Revoke parent PIN access (security lockout)
      var patch = {
        parent_access_pin_hash: '',
        parent_access_pin_failed_attempts: 5, // Lockout pin attempts
        parent_access_pin_locked_until: new Date(new Date().getTime() + 999999 * 60000).toISOString() // lock forever
      };
      updateRecord(SHEETS.STUDENTS, id, patch, actor);
    }
  }

  // 2. ACADEMIC YEAR LOCK CASCADE
  if (sheetName === SHEETS.ACADEMIC_YEARS && newStatus === LIFECYCLE_STATUS.LOCKED) {
    var semesters = listRecords(SHEETS.SEMESTERS, function(r) {
      return r.academic_year_id === id && (r.lifecycle_status || r.status) !== LIFECYCLE_STATUS.LOCKED;
    });
    semesters.forEach(function(sem) {
      updateRecord(SHEETS.SEMESTERS, sem.id, { lifecycle_status: LIFECYCLE_STATUS.LOCKED }, actor);
    });
  }

  // 3. SEMESTER LOCK CASCADE
  if (sheetName === SHEETS.SEMESTERS && newStatus === LIFECYCLE_STATUS.LOCKED) {
    var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function(r) {
      return r.semester_id === id && (r.lifecycle_status || r.status) !== LIFECYCLE_STATUS.LOCKED;
    });
    assessments.forEach(function(ass) {
      updateRecord(SHEETS.ACADEMIC_ASSESSMENTS, ass.id, { lifecycle_status: LIFECYCLE_STATUS.LOCKED }, actor);
      
      // Cascade lock to scores under this assessment
      var scores = listRecords(SHEETS.ACADEMIC_SCORES, function(r) {
        return r.assessment_id === ass.id && (r.lifecycle_status || r.status) !== LIFECYCLE_STATUS.LOCKED;
      });
      scores.forEach(function(score) {
        updateRecord(SHEETS.ACADEMIC_SCORES, score.id, { lifecycle_status: LIFECYCLE_STATUS.LOCKED }, actor);
      });
    });
  }
}

/**
 * Step 9: Restore validation rules.
 * @param {string} sheetName
 * @param {string} id
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {Object} actor
 */
function validateRestoreRules(sheetName, id, oldStatus, newStatus, actor) {
  if (sheetName === SHEETS.STUDENTS) {
    // Check their last enrollment's class
    var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(r) {
      return r.student_id === id;
    });
    if (enrollments.length > 0) {
      // Sort enrollments by created_at desc
      enrollments.sort(function(a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      var lastEnroll = enrollments[0];
      var cls = getRecordById(SHEETS.CLASSES, lastEnroll.class_id);
      if (cls && (cls.lifecycle_status || cls.status) !== LIFECYCLE_STATUS.ACTIVE) {
        throw new Error("Cannot restore student: their previous class (" + cls.name + ") is inactive. Please update their class assignment first.");
      }
    }
  }

  if (sheetName === SHEETS.SUBJECTS) {
    // If active semester is locked, prevent restore
    var activeSemesterId = getSetting('active_semester_id');
    if (activeSemesterId) {
      var semester = getRecordById(SHEETS.SEMESTERS, activeSemesterId);
      if (semester && (semester.lifecycle_status || semester.status) === LIFECYCLE_STATUS.LOCKED) {
        throw new Error("Cannot restore Subject: current active semester is Locked.");
      }
    }
  }
}

/**
 * Step 12 & 14: Filters a list of records based on query parameters.
 * @param {Object[]} records
 * @param {Object} [filters]
 * @returns {Object[]}
 */
function filterLifecycle(records, filters) {
  filters = filters || {};
  var includeArchived = filters.includeArchived === true || filters.includeArchived === 'true';
  var includeInactive = filters.includeInactive === true || filters.includeInactive === 'true';
  var onlyArchived = filters.onlyArchived === true || filters.onlyArchived === 'true';
  var onlyDeleted = filters.onlyDeleted === true || filters.onlyDeleted === 'true';
  
  return records.filter(function(r) {
    var status = r.lifecycle_status || r.status || LIFECYCLE_STATUS.ACTIVE;
    if (status === 'true' || status === true) status = LIFECYCLE_STATUS.ACTIVE;
    if (status === 'false' || status === false) status = LIFECYCLE_STATUS.INACTIVE;
    
    // Soft deleted records are filtered out unless onlyDeleted is requested
    if (status === LIFECYCLE_STATUS.SOFT_DELETED) {
      return onlyDeleted;
    }
    if (onlyDeleted) return false;
    
    if (onlyArchived) {
      return status === LIFECYCLE_STATUS.ARCHIVED;
    }
    
    if (status === LIFECYCLE_STATUS.ARCHIVED && !includeArchived) {
      return false;
    }
    
    if (status === LIFECYCLE_STATUS.INACTIVE && !includeInactive) {
      return false;
    }
    
    return true;
  });
}

