/**
 * MasterDataService.gs
 * Core business logic and service implementations for Master Data entities.
 */

// --- ACADEMIC YEARS ---

function createAcademicYear(payload, actor) {
  validateRequiredFields(payload, ['name', 'start_date', 'end_date']);
  var userFacingName = String(payload.name || '').trim();
  if (!userFacingName) {
    throw { code: 'ERR_INVALID_PARAMETER', message: 'Nama tahun ajaran wajib diisi.' };
  }
  validateDateOrder(payload.start_date, payload.end_date);
  assertNoDuplicate(SHEETS.ACADEMIC_YEARS, 'name', userFacingName);
  
  var record = {
    name: userFacingName,
    start_date: payload.start_date,
    end_date: payload.end_date,
    is_active: false
  };
  
  return createRecord(SHEETS.ACADEMIC_YEARS, record, actor);
}

function updateAcademicYear(id, payload, actor) {
  assertRecordExists(SHEETS.ACADEMIC_YEARS, id);
  if (payload.name) {
    assertNoDuplicate(SHEETS.ACADEMIC_YEARS, 'name', payload.name, id);
  }
  if (payload.start_date || payload.end_date) {
    var existing = getRecordById(SHEETS.ACADEMIC_YEARS, id);
    var start = payload.start_date || existing.start_date;
    var end = payload.end_date || existing.end_date;
    validateDateOrder(start, end);
  }
  
  var patch = {};
  if (payload.name) patch.name = payload.name;
  if (payload.start_date) patch.start_date = payload.start_date;
  if (payload.end_date) patch.end_date = payload.end_date;
  
  return updateRecord(SHEETS.ACADEMIC_YEARS, id, patch, actor);
}

function listAcademicYears() {
  return listRecords(SHEETS.ACADEMIC_YEARS).map(function(year) {
    return {
      id: year.id,
      name: String(year.name || ''),
      start_date: year.start_date,
      end_date: year.end_date,
      is_active: year.is_active
    };
  });
}

function setActiveAcademicYear(id, actor) {
  assertRecordExists(SHEETS.ACADEMIC_YEARS, id);
  
  // Find semesters for this academic year
  var semesters = listRecords(SHEETS.SEMESTERS, function(s) {
    return s.academic_year_id === id;
  });
  
  if (semesters.length === 0) {
    throw {
      code: 'ERR_ACTIVE_SEMESTER_NOT_SET',
      message: 'No semesters found for this academic year. Please create a semester first.'
    };
  }
  
  // Choose target semester deterministically:
  // 1. Semester that has is_active = true
  // 2. Otherwise 'Ganjil' (case-insensitive)
  // 3. Otherwise first semester in alphabetical order of name
  var targetSemester = null;
  var activeSems = semesters.filter(function(s) {
    return s.is_active === true || String(s.is_active).toLowerCase() === 'true';
  });
  
  if (activeSems.length > 0) {
    targetSemester = activeSems[0];
  } else {
    var ganjilSems = semesters.filter(function(s) {
      return String(s.name).toLowerCase() === 'ganjil';
    });
    if (ganjilSems.length > 0) {
      targetSemester = ganjilSems[0];
    } else {
      semesters.sort(function(a, b) {
        return String(a.name).localeCompare(String(b.name));
      });
      targetSemester = semesters[0];
    }
  }
  
  if (!targetSemester) {
    throw {
      code: 'ERR_ACTIVE_SEMESTER_NOT_SET',
      message: 'No valid semester found for this academic year.'
    };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    var years = listRecords(SHEETS.ACADEMIC_YEARS);
    years.forEach(function(year) {
      var targetActive = (year.id === id);
      if (year.is_active !== targetActive) {
        updateRecord(SHEETS.ACADEMIC_YEARS, year.id, { is_active: targetActive }, actor);
      }
    });
    
    // Update setting
    updateSingleSetting('active_academic_year_id', id, actor);
  } finally {
    lock.releaseLock();
  }
  
  // Set chosen semester active
  setActiveSemester(targetSemester.id, actor);
  
  return { active_id: id, active_semester_id: targetSemester.id };
}

// --- SEMESTERS ---

function createSemester(payload, actor) {
  validateRequiredFields(payload, ['academic_year_id', 'name', 'start_date', 'end_date']);
  assertRecordExists(SHEETS.ACADEMIC_YEARS, payload.academic_year_id);
  validateDateOrder(payload.start_date, payload.end_date);
  validateSemesterNameAndUniqueness(payload.academic_year_id, payload.name);
  
  var record = {
    academic_year_id: payload.academic_year_id,
    name: payload.name,
    start_date: payload.start_date,
    end_date: payload.end_date,
    is_active: false
  };
  
  return createRecord(SHEETS.SEMESTERS, record, actor);
}

function updateSemester(id, payload, actor) {
  var existing = assertRecordExists(SHEETS.SEMESTERS, id);
  var academicYearId = payload.academic_year_id || existing.academic_year_id;
  
  if (payload.name || payload.academic_year_id) {
    var name = payload.name || existing.name;
    validateSemesterNameAndUniqueness(academicYearId, name, id);
  }
  
  if (payload.start_date || payload.end_date) {
    var start = payload.start_date || existing.start_date;
    var end = payload.end_date || existing.end_date;
    validateDateOrder(start, end);
  }
  
  var patch = {};
  if (payload.academic_year_id) patch.academic_year_id = payload.academic_year_id;
  if (payload.name) patch.name = payload.name;
  if (payload.start_date) patch.start_date = payload.start_date;
  if (payload.end_date) patch.end_date = payload.end_date;
  
  return updateRecord(SHEETS.SEMESTERS, id, patch, actor);
}

function listSemesters() {
  return listRecords(SHEETS.SEMESTERS);
}

function setActiveSemester(id, actor) {
  var targetSemester = assertRecordExists(SHEETS.SEMESTERS, id);
  var targetYearId = targetSemester.academic_year_id;
  
  // Enforce selected semester belongs to active academic year
  var activeYear = getActiveAcademicYear();
  if (targetYearId !== activeYear.id) {
    throw {
      code: 'ERR_ACTIVE_PERIOD_MISMATCH',
      message: 'Semester does not belong to the active academic year.'
    };
  }
  
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    var semesters = listRecords(SHEETS.SEMESTERS);
    semesters.forEach(function(sem) {
      if (sem.academic_year_id === targetYearId) {
        var targetActive = (sem.id === id);
        if (sem.is_active !== targetActive) {
          updateRecord(SHEETS.SEMESTERS, sem.id, { is_active: targetActive }, actor);
        }
      }
    });
    
    // Update setting
    updateSingleSetting('active_semester_id', id, actor);
    
    return { active_id: id };
  } finally {
    lock.releaseLock();
  }
}

// --- CLASSES ---

function createClass(payload, actor) {
  validateRequiredFields(payload, ['code', 'name', 'level']);
  assertNoDuplicate(SHEETS.CLASSES, 'code', payload.code);
  
  var record = {
    code: payload.code,
    name: payload.name,
    level: payload.level,
    status: STATUS.ACTIVE
  };
  
  return createRecord(SHEETS.CLASSES, record, actor);
}

function updateClass(id, payload, actor) {
  assertRecordExists(SHEETS.CLASSES, id);
  if (payload.code) {
    assertNoDuplicate(SHEETS.CLASSES, 'code', payload.code, id);
  }
  
  var patch = {};
  if (payload.code) patch.code = payload.code;
  if (payload.name) patch.name = payload.name;
  if (payload.level) patch.level = payload.level;
  if (payload.status) patch.status = payload.status;
  
  return updateRecord(SHEETS.CLASSES, id, patch, actor);
}

function listClasses(filters) {
  var records = listRecords(SHEETS.CLASSES);
  return filterLifecycle(records, filters);
}

function deactivateClass(id, actor) {
  assertRecordExists(SHEETS.CLASSES, id);
  return updateRecord(SHEETS.CLASSES, id, { status: STATUS.INACTIVE }, actor);
}

// --- SUBJECTS ---

function createSubject(payload, actor) {
  validateRequiredFields(payload, ['code', 'name']);
  assertNoDuplicate(SHEETS.SUBJECTS, 'code', payload.code);
  
  var record = {
    code: payload.code,
    name: payload.name,
    description: payload.description || '',
    status: STATUS.ACTIVE
  };
  
  return createRecord(SHEETS.SUBJECTS, record, actor);
}

function updateSubject(id, payload, actor) {
  assertRecordExists(SHEETS.SUBJECTS, id);
  if (payload.code) {
    assertNoDuplicate(SHEETS.SUBJECTS, 'code', payload.code, id);
  }
  
  var patch = {};
  if (payload.code) patch.code = payload.code;
  if (payload.name) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.status) patch.status = payload.status;
  
  return updateRecord(SHEETS.SUBJECTS, id, patch, actor);
}

function listSubjects(filters) {
  var records = listRecords(SHEETS.SUBJECTS);
  return filterLifecycle(records, filters);
}

function deactivateSubject(id, actor) {
  assertRecordExists(SHEETS.SUBJECTS, id);
  return updateRecord(SHEETS.SUBJECTS, id, { status: STATUS.INACTIVE }, actor);
}

// --- CLASS SUBJECTS ---

function assignSubjectToClass(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'subject_id', 'academic_year_id', 'semester_id']);
  assertRecordExists(SHEETS.CLASSES, payload.class_id);
  assertRecordExists(SHEETS.SUBJECTS, payload.subject_id);
  assertRecordExists(SHEETS.ACADEMIC_YEARS, payload.academic_year_id);
  assertRecordExists(SHEETS.SEMESTERS, payload.semester_id);
  
  assertNoDuplicateClassSubject(
    payload.class_id,
    payload.subject_id,
    payload.academic_year_id,
    payload.semester_id
  );
  
  var record = {
    class_id: payload.class_id,
    subject_id: payload.subject_id,
    academic_year_id: payload.academic_year_id,
    semester_id: payload.semester_id,
    status: STATUS.ACTIVE
  };
  
  return createRecord(SHEETS.CLASS_SUBJECTS, record, actor);
}

function unassignSubjectFromClass(id, actor) {
  assertRecordExists(SHEETS.CLASS_SUBJECTS, id);
  return updateRecord(SHEETS.CLASS_SUBJECTS, id, { status: STATUS.INACTIVE }, actor);
}

function listClassSubjects() {
  return listRecords(SHEETS.CLASS_SUBJECTS);
}

function listMyClassSubjects(payload, actor) {
  if (!actor || actor.role !== ROLES.TEACHER) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Only teachers can access their assigned class subjects.'
    };
  }

  validateRequiredFields(payload, ['class_id', 'academic_year_id', 'semester_id']);

  if (!isTeacherAssignedToClass(actor.id, payload.class_id, payload.academic_year_id, payload.semester_id)) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You are not assigned to this class for the specified period.'
    };
  }

  var activeClassSubjects = listRecords(SHEETS.CLASS_SUBJECTS, function(item) {
    return item.class_id === payload.class_id &&
           item.academic_year_id === payload.academic_year_id &&
           item.semester_id === payload.semester_id &&
           item.status === STATUS.ACTIVE;
  });

  return activeClassSubjects.map(function(item) {
    var subject = getRecordById(SHEETS.SUBJECTS, item.subject_id);
    if (!subject || subject.status !== STATUS.ACTIVE) {
      return null;
    }

    return {
      class_subject_id: item.id,
      class_id: item.class_id,
      subject_id: item.subject_id,
      subject_code: subject.code || '',
      subject_name: subject.name || '',
      academic_year_id: item.academic_year_id,
      semester_id: item.semester_id,
      status: item.status
    };
  }).filter(function(item) {
    return item !== null;
  });
}

// --- TEACHER PROFILES ---

function createTeacherProfile(payload, actor) {
  validateRequiredFields(payload, ['user_id', 'full_name']);
  assertUserRole(payload.user_id, ROLES.TEACHER);
  assertNoDuplicateTeacherProfile(payload.user_id);
  
  var record = {
    user_id: payload.user_id,
    full_name: payload.full_name,
    gender: payload.gender || '',
    phone: payload.phone || '',
    address: payload.address || '',
    nip: payload.nip || '',
    nuptk: payload.nuptk || '',
    position: payload.position || '',
    status: STATUS.ACTIVE
  };
  
  return createRecord(SHEETS.TEACHER_PROFILES, record, actor);
}

function updateTeacherProfile(id, payload, actor) {
  var existing = assertRecordExists(SHEETS.TEACHER_PROFILES, id);
  if (payload.user_id && payload.user_id !== existing.user_id) {
    assertUserRole(payload.user_id, ROLES.TEACHER);
    assertNoDuplicateTeacherProfile(payload.user_id, id);
  }
  
  var patch = {};
  if (payload.user_id) patch.user_id = payload.user_id;
  if (payload.full_name) patch.full_name = payload.full_name;
  if (payload.gender !== undefined) patch.gender = payload.gender;
  if (payload.phone !== undefined) patch.phone = payload.phone;
  if (payload.address !== undefined) patch.address = payload.address;
  if (payload.nip !== undefined) patch.nip = payload.nip;
  if (payload.nuptk !== undefined) patch.nuptk = payload.nuptk;
  if (payload.position !== undefined) patch.position = payload.position;
  if (payload.status) patch.status = payload.status;
  
  return updateRecord(SHEETS.TEACHER_PROFILES, id, patch, actor);
}

function listTeacherProfiles(filters) {
  var records = listRecords(SHEETS.TEACHER_PROFILES);
  return filterLifecycle(records, filters);
}

function deactivateTeacherProfile(id, actor) {
  assertRecordExists(SHEETS.TEACHER_PROFILES, id);
  return updateRecord(SHEETS.TEACHER_PROFILES, id, { status: STATUS.INACTIVE }, actor);
}

// --- CLASS TEACHER ASSIGNMENTS ---

function assignClassTeacher(payload, actor) {
  validateRequiredFields(payload, ['class_id', 'teacher_user_id', 'academic_year_id', 'semester_id', 'effective_from']);
  assertRecordExists(SHEETS.CLASSES, payload.class_id);
  assertUserRole(payload.teacher_user_id, ROLES.TEACHER);
  assertRecordExists(SHEETS.ACADEMIC_YEARS, payload.academic_year_id);
  assertRecordExists(SHEETS.SEMESTERS, payload.semester_id);
  
  if (payload.effective_until) {
    validateDateOrder(payload.effective_from, payload.effective_until);
  }
  
  // Overlap validation under lock
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error("Lock timeout: database is busy.");
  }
  
  try {
    var activeAssignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(item) {
      return item.class_id === payload.class_id &&
             item.academic_year_id === payload.academic_year_id &&
             item.semester_id === payload.semester_id &&
             item.status === STATUS.ACTIVE;
    });
    
    var start1 = new Date(payload.effective_from).getTime();
    var end1 = payload.effective_until ? new Date(payload.effective_until).getTime() : Infinity;
    
    activeAssignments.forEach(function(item) {
      var start2 = new Date(item.effective_from).getTime();
      var end2 = item.effective_until ? new Date(item.effective_until).getTime() : Infinity;
      
      // If dates overlap
      if (start1 <= end2 && start2 <= end1) {
        throw new Error("Cannot assign class teacher. An active overlapping assignment already exists for this class/semester. Handover required.");
      }
    });
    
    var record = {
      class_id: payload.class_id,
      teacher_user_id: payload.teacher_user_id,
      academic_year_id: payload.academic_year_id,
      semester_id: payload.semester_id,
      effective_from: payload.effective_from,
      effective_until: payload.effective_until || '',
      status: STATUS.ACTIVE
    };
    
    return createRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, record, actor);
  } finally {
    lock.releaseLock();
  }
}

function endClassTeacherAssignment(id, actor) {
  var existing = assertRecordExists(SHEETS.CLASS_TEACHER_ASSIGNMENTS, id);
  var now = nowIso().split('T')[0];
  
  // effective_until must be >= effective_from
  var effectiveFromTime = new Date(existing.effective_from).getTime();
  var effectiveUntilTime = new Date(now).getTime();
  if (effectiveUntilTime < effectiveFromTime) {
    now = existing.effective_from; // fallback to effective_from date
  }
  
  return updateRecord(SHEETS.CLASS_TEACHER_ASSIGNMENTS, id, {
    effective_until: now,
    status: 'ended'
  }, actor);
}

function listClassTeacherAssignments(filters) {
  var records = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS);
  return filterLifecycle(records, filters);
}

function getMyClasses(payload, actor) {
  if (!actor || actor.role !== ROLES.TEACHER) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Only teachers can access their class assignments.'
    };
  }

  payload = payload || {};
  var academicYearId = payload.academic_year_id || '';
  var semesterId = payload.semester_id || '';

  if (!academicYearId) {
    academicYearId = getActiveAcademicYear().id;
  }
  if (!semesterId) {
    semesterId = getActiveSemester(academicYearId).id;
  }

  var assignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(item) {
    return item.teacher_user_id === actor.id &&
           item.academic_year_id === academicYearId &&
           item.semester_id === semesterId &&
           item.status === STATUS.ACTIVE;
  });

  return assignments.map(function(item) {
    var classRecord = getRecordById(SHEETS.CLASSES, item.class_id) || {};
    var yearRecord = getRecordById(SHEETS.ACADEMIC_YEARS, item.academic_year_id) || {};
    var semesterRecord = getRecordById(SHEETS.SEMESTERS, item.semester_id) || {};

    return {
      assignment_id: item.id,
      class_id: item.class_id,
      class_code: classRecord.code || '',
      class_name: classRecord.name || item.class_id,
      academic_year_id: item.academic_year_id,
      academic_year_name: yearRecord.name || item.academic_year_id,
      semester_id: item.semester_id,
      semester_name: semesterRecord.name || item.semester_id,
      effective_from: item.effective_from || '',
      effective_until: item.effective_until || '',
      status: item.status
    };
  });
}

// --- APP SETTINGS ---

function getAppSettings() {
  var rows = listRecords(SHEETS.APP_SETTINGS);
  var map = {};
  rows.forEach(function(r) {
    map[r.setting_key] = r.setting_value;
  });
  // Additive runtime defaults keep existing installations coverage-aware even
  // before these optional rows are persisted in app_settings.
  if (!map.culture_school_days) map.culture_school_days = 'monday,tuesday,wednesday,thursday,friday';
  if (!map.culture_minimum_coverage_percent) map.culture_minimum_coverage_percent = '80';
  if (!map.culture_warning_coverage_percent) map.culture_warning_coverage_percent = '60';
  return map;
}

function updateAppSettings(payload, actor) {
  var settings = payload.settings || {};
  var keys = Object.keys(settings);
  
  keys.forEach(function(key) {
    var rawVal = settings[key];
    var val = normalizeAppSettingValue(key, rawVal);
    
    // Validation rules
    if (key === 'active_academic_year_id' && val) {
      assertRecordExists(SHEETS.ACADEMIC_YEARS, val);
    }
    if (key === 'active_semester_id' && val) {
      assertRecordExists(SHEETS.SEMESTERS, val);
    }
    if (key === 'parent_portal_enabled') {
      if (rawVal !== true && rawVal !== false && rawVal !== 'true' && rawVal !== 'false') {
        throw new Error("Setting 'parent_portal_enabled' must be either 'true' or 'false'.");
      }
    }
    if (key === 'culture_edit_limit_days_teacher' || key === 'culture_edit_limit_days_admin') {
      var num = Number(val);
      if (isNaN(num) || num < 0) {
        throw new Error("Setting '" + key + "' must be a positive number.");
      }
    }
    if (key === 'culture_minimum_coverage_percent' || key === 'culture_warning_coverage_percent') {
      var percent = Number(val);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        throw new Error("Setting '" + key + "' must be a number from 0 to 100.");
      }
    }
    if (key === 'culture_school_days') {
      var allowedDays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      var requestedDays = String(val).toLowerCase().split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v; });
      if (requestedDays.length === 0 || requestedDays.some(function(v) { return allowedDays.indexOf(v) === -1; })) {
        throw new Error("Setting 'culture_school_days' must contain comma-separated English weekday names.");
      }
    }
    
    updateSingleSetting(key, val, actor);
  });
  
  return getAppSettings();
}

/**
 * Updates or creates a setting row.
 */
function updateSingleSetting(key, value, actor) {
  var existing = listRecords(SHEETS.APP_SETTINGS, function(item) {
    return item.setting_key === key;
  });
  
  var patch = {
    setting_key: key,
    setting_value: String(value),
    description: key.replace(/_/g, ' '),
    updated_by: actor ? actor.name : 'system'
  };
  
  if (existing.length > 0) {
    updateRecord(SHEETS.APP_SETTINGS, existing[0].id, patch, actor);
  } else {
    createRecord(SHEETS.APP_SETTINGS, patch, actor);
  }
}

function normalizeAppSettingValue(key, value) {
  if (value === undefined || value === null) return '';
  
  if (key === 'parent_portal_enabled') {
    return String(value).toLowerCase();
  }
  
  if (key === 'culture_edit_limit_days_teacher' || key === 'culture_edit_limit_days_admin' ||
      key === 'culture_minimum_coverage_percent' || key === 'culture_warning_coverage_percent') {
    return String(Number(value));
  }
  
  return String(value);
}

// --- ACTIVE PERIOD HELPERS ---

/**
 * Retrieves the currently active academic year.
 * @returns {Object} Complete academic year record.
 */
function getActiveAcademicYear() {
  var year = null;
  var settings = getAppSettings();
  var yearId = settings.active_academic_year_id;
  if (yearId) {
    year = getRecordById(SHEETS.ACADEMIC_YEARS, yearId);
  }
  
  if (!year) {
    var years = listRecords(SHEETS.ACADEMIC_YEARS);
    var activeYears = years.filter(function(y) {
      return y.is_active !== undefined && y.is_active !== null && String(y.is_active).toLowerCase() === 'true';
    });
    if (activeYears.length > 0) {
      year = activeYears[0];
    }
  }
  
  if (!year) {
    throw {
      code: 'ERR_ACTIVE_YEAR_NOT_SET',
      message: 'Active academic year is not set.'
    };
  }
  
  return year;
}

function getActiveSemester(academicYearId) {
  var activeYear = null;
  if (academicYearId) {
    activeYear = getRecordById(SHEETS.ACADEMIC_YEARS, academicYearId);
    if (!activeYear) {
      throw {
        code: 'ERR_ACTIVE_YEAR_NOT_SET',
        message: 'Academic year not found.'
      };
    }
  } else {
    activeYear = getActiveAcademicYear();
  }
  
  var sem = null;
  var settings = getAppSettings();
  var semId = settings.active_semester_id;
  if (semId) {
    var tempSem = getRecordById(SHEETS.SEMESTERS, semId);
    if (tempSem) {
      if (tempSem.academic_year_id !== activeYear.id) {
        throw {
          code: 'ERR_ACTIVE_PERIOD_MISMATCH',
          message: 'Active semester belongs to a different academic year.'
        };
      }
      sem = tempSem;
    }
  }
  
  if (!sem) {
    var semesters = listRecords(SHEETS.SEMESTERS, function(s) {
      return s.academic_year_id === activeYear.id &&
             s.is_active !== undefined && s.is_active !== null && String(s.is_active).toLowerCase() === 'true';
    });
    if (semesters.length > 0) {
      sem = semesters[0];
    }
  }
  
  if (!sem) {
    throw {
      code: 'ERR_ACTIVE_SEMESTER_NOT_SET',
      message: 'Active semester is not set.'
    };
  }
  
  if (sem.academic_year_id !== activeYear.id) {
    throw {
      code: 'ERR_ACTIVE_PERIOD_MISMATCH',
      message: 'Active semester and active academic year are not in sync.'
    };
  }
  
  return sem;
}

/**
 * Repairs stale active-period setting references using existing period rows only.
 * It never creates or deletes academic periods.
 */
function repairActivePeriodSettings(payload, actor) {
  var years = listRecords(SHEETS.ACADEMIC_YEARS);
  if (years.length === 0) {
    throw { code: 'ERR_ACTIVE_YEAR_NOT_SET', message: 'Tidak ada tahun ajaran yang dapat digunakan untuk memperbaiki periode aktif.' };
  }

  var settings = getAppSettings();
  var configuredYear = settings.active_academic_year_id ? getRecordById(SHEETS.ACADEMIC_YEARS, settings.active_academic_year_id) : null;
  var activeYears = years.filter(function(year) {
    return String(year.is_active).toLowerCase() === 'true';
  });
  var selectedYear = configuredYear || activeYears[0] || null;

  if (!selectedYear) {
    years.sort(function(a, b) {
      return new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime();
    });
    selectedYear = years[0];
  }

  var semesters = listRecords(SHEETS.SEMESTERS, function(semester) {
    return semester.academic_year_id === selectedYear.id;
  });
  var configuredSemester = settings.active_semester_id ? getRecordById(SHEETS.SEMESTERS, settings.active_semester_id) : null;
  if (configuredSemester && configuredSemester.academic_year_id !== selectedYear.id) configuredSemester = null;
  var activeSemesters = semesters.filter(function(semester) {
    return String(semester.is_active).toLowerCase() === 'true';
  });
  var selectedSemester = configuredSemester || activeSemesters[0] || null;

  if (!selectedSemester) {
    throw {
      code: 'ERR_ACTIVE_SEMESTER_NOT_SET',
      message: 'Tidak ada semester aktif yang valid untuk tahun ajaran ' + String(selectedYear.name || selectedYear.id) + '. Atur semester aktif terlebih dahulu.'
    };
  }

  var oldValues = {
    active_academic_year_id: settings.active_academic_year_id || '',
    active_semester_id: settings.active_semester_id || ''
  };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (lockError) {
    throw { code: 'ERR_RESOURCE_BUSY', message: 'Active period settings are busy. Please try again.' };
  }

  try {
    years.forEach(function(year) {
      var shouldBeActive = year.id === selectedYear.id;
      if (String(year.is_active).toLowerCase() !== String(shouldBeActive)) {
        updateRowById(SHEETS.ACADEMIC_YEARS, year.id, { is_active: shouldBeActive });
      }
    });
    semesters.forEach(function(semester) {
      var shouldBeActive = semester.id === selectedSemester.id;
      if (String(semester.is_active).toLowerCase() !== String(shouldBeActive)) {
        updateRowById(SHEETS.SEMESTERS, semester.id, { is_active: shouldBeActive });
      }
    });
    upsertSettingWithoutAudit_('active_academic_year_id', selectedYear.id, actor);
    upsertSettingWithoutAudit_('active_semester_id', selectedSemester.id, actor);
  } finally {
    lock.releaseLock();
  }

  var repaired = {
    active_academic_year_id: selectedYear.id,
    active_semester_id: selectedSemester.id
  };
  writeAuditLog({
    user_id: actor ? actor.id : 'system',
    user_name: actor ? actor.name : 'System',
    user_role: actor ? actor.role : 'system',
    action: 'REPAIR_ACTIVE_PERIOD_SETTINGS',
    entity_type: SHEETS.APP_SETTINGS,
    entity_id: '',
    old_value: JSON.stringify(oldValues),
    new_value: JSON.stringify(repaired),
    description: 'Repaired active academic year and semester setting references.'
  });
  return repaired;
}

function upsertSettingWithoutAudit_(key, value, actor) {
  var existing = listRecords(SHEETS.APP_SETTINGS, function(item) {
    return item.setting_key === key;
  });
  var record = {
    setting_key: key,
    setting_value: String(value),
    description: key.replace(/_/g, ' '),
    updated_by: actor ? actor.name : 'system'
  };
  if (existing.length > 0) return updateRowById(SHEETS.APP_SETTINGS, existing[0].id, record);
  return appendRow(SHEETS.APP_SETTINGS, record);
}

/**
 * Endpoint: get_period_setup_readiness
 * Performs validation checks on current enrollments, assignments, classes, mapping, and database setup.
 */
function getPeriodSetupReadiness(payload, actor) {
  assertAdminOrAdministrator(actor);
  
  var activeYear = null;
  var activeSem = null;
  var periodValid = true;
  var periodError = null;
  
  try {
    activeYear = getActiveAcademicYear();
    activeSem = getActiveSemester(activeYear.id);
  } catch (err) {
    periodValid = false;
    periodError = err.message || 'Active period is mismatch or not set.';
  }

  // Get active classes
  var activeClasses = listRecords(SHEETS.CLASSES, function(c) {
    return c.status === STATUS.ACTIVE;
  });

  var classesDetails = [];
  var readyCount = 0;
  var warningCount = 0;
  var notReadyCount = 0;

  activeClasses.forEach(function(cl) {
    var hasEnrollments = false;
    var enrollmentCount = 0;
    var hasTeacherAssignment = false;
    var hasSubjectMapping = false;
    var issues = [];

    if (periodValid && activeYear && activeSem) {
      // Check enrollments
      var enrolls = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
        return e.class_id === cl.id &&
               e.academic_year_id === activeYear.id &&
               e.semester_id === activeSem.id &&
               e.status === 'active';
      });
      hasEnrollments = enrolls.length > 0;
      enrollmentCount = enrolls.length;

      // Check assignments
      var assigns = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function(a) {
        return a.class_id === cl.id &&
               a.academic_year_id === activeYear.id &&
               a.semester_id === activeSem.id &&
               a.status === STATUS.ACTIVE;
      });
      hasTeacherAssignment = assigns.length > 0;

      // Check subjects mapping
      var subMaps = listRecords(SHEETS.CLASS_SUBJECTS, function(cs) {
        return cs.class_id === cl.id &&
               cs.academic_year_id === activeYear.id &&
               cs.semester_id === activeSem.id &&
               cs.status === STATUS.ACTIVE;
      });
      hasSubjectMapping = subMaps.length > 0;
    } else {
      issues.push("Periode aktif tidak valid atau belum diatur.");
    }

    if (periodValid) {
      if (!hasTeacherAssignment) {
        issues.push("Belum memiliki penugasan wali kelas.");
      }
      if (!hasSubjectMapping) {
        issues.push("Belum memiliki mapping mata pelajaran.");
      }
    }

    var status = 'not_ready';
    if (hasTeacherAssignment && hasSubjectMapping) {
      status = 'ready';
      readyCount++;
    } else if (!hasTeacherAssignment && !hasSubjectMapping) {
      status = 'not_ready';
      notReadyCount++;
    } else {
      status = 'warning';
      warningCount++;
    }

    classesDetails.push({
      class_id: cl.id,
      class_name: String(cl.name || ''),
      has_enrollments: hasEnrollments,
      enrollment_count: enrollmentCount,
      has_teacher_assignment: hasTeacherAssignment,
      has_subject_mapping: hasSubjectMapping,
      status: status,
      issues: issues
    });
  });

  var overallStatus = 'ready';
  if (notReadyCount > 0 || !periodValid) {
    overallStatus = 'not_ready';
  } else if (warningCount > 0) {
    overallStatus = 'warning';
  }

  // Build backward compatible checks list
  var checks = [];
  checks.push({
    key: "active_period",
    status: periodValid ? "ready" : "not_ready",
    count: periodValid ? 1 : 0,
    message: periodValid ? "Periode aktif valid dan sinkron." : periodError
  });

  var totalEnrollments = classesDetails.reduce(function(acc, c) { return acc + c.enrollment_count; }, 0);
  var totalTeacherAssignments = classesDetails.filter(function(c) { return c.has_teacher_assignment; }).length;
  var totalClassSubjects = classesDetails.filter(function(c) { return c.has_subject_mapping; }).length;

  checks.push({
    key: "enrollments",
    status: totalEnrollments > 0 ? "ready" : "warning",
    count: totalEnrollments,
    message: totalEnrollments > 0 
      ? "Terdapat " + totalEnrollments + " enrollment siswa aktif pada periode ini."
      : "Belum ada enrollment siswa pada periode aktif."
  });

  checks.push({
    key: "teacher_assignments",
    status: totalTeacherAssignments > 0 ? "ready" : "warning",
    count: totalTeacherAssignments,
    message: totalTeacherAssignments > 0
      ? "Terdapat penugasan guru wali kelas aktif."
      : "Belum ada penugasan guru wali kelas pada periode aktif."
  });

  checks.push({
    key: "class_subjects",
    status: totalClassSubjects > 0 ? "ready" : "warning",
    count: totalClassSubjects,
    message: totalClassSubjects > 0
      ? "Terdapat mapping mata pelajaran kelas aktif."
      : "Belum ada mapping mata pelajaran kelas pada periode aktif."
  });

  checks.push({
    key: "classes",
    status: activeClasses.length > 0 ? "ready" : "warning",
    count: activeClasses.length,
    message: activeClasses.length > 0
      ? "Terdapat kelas aktif dalam sistem."
      : "Belum ada kelas aktif yang terdaftar dalam sistem."
  });

  var semestersList = listRecords(SHEETS.SEMESTERS);
  checks.push({
    key: "historical_periods",
    status: semestersList.length > 0 ? "ready" : "warning",
    count: semestersList.length,
    message: semestersList.length > 0
      ? "Terdapat periode semester terdaftar di sistem."
      : "Belum ada periode semester terdaftar di sistem."
  });

  return {
    period: {
      academic_year_id: activeYear ? activeYear.id : '',
      academic_year_name: activeYear ? activeYear.name : '',
      semester_id: activeSem ? activeSem.id : '',
      semester_name: activeSem ? activeSem.name : ''
    },
    status: overallStatus,
    overall_status: overallStatus,
    summary: {
      total_classes: activeClasses.length,
      ready_classes: readyCount,
      warning_classes: warningCount,
      not_ready_classes: notReadyCount
    },
    classes: classesDetails,
    checks: checks
  };
}
