/**
 * ExecutiveDashboardService.js
 * Server-side business logic and data aggregation for Administrator and Operator executive dashboard.
 */

/**
 * Retrieves dynamic executive metrics and analytics for admin/operator dashboards.
 * @param {Object} payload
 * @param {Object} actor - Authenticated admin/operator user.
 * @returns {Object} Dashboard metrics.
 */
function getExecutiveDashboardStats(payload, actor) {
  if (!actor || (actor.role !== ROLES.ADMIN && actor.role !== ROLES.ADMINISTRATOR)) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: Hanya administrator dan admin yang dapat mengakses metrik eksekutif.'
    };
  }

  var timezone = "Asia/Jakarta";
  var today = new Date();
  var currentMonth = parseInt(Utilities.formatDate(today, timezone, "M"), 10);
  var currentYear = parseInt(Utilities.formatDate(today, timezone, "yyyy"), 10);

  // 1. Get active period
  var activeYear = getActiveAcademicYear();
  var activeSem = getActiveSemester(activeYear.id);

  // Helper map for class names and teacher names
  var classes = listRecords(SHEETS.CLASSES) || [];
  var activeClasses = classes.filter(function (c) { return c.status === "active"; });
  var classMap = {};
  activeClasses.forEach(function (c) { classMap[c.id] = c.name; });

  var teachers = listRecords(SHEETS.USERS, function (u) {
    return u.role === ROLES.TEACHER && u.status === STATUS.ACTIVE;
  }) || [];
  var teacherMap = {};
  teachers.forEach(function (t) { teacherMap[t.id] = t.name || t.username; });

  // ==========================================
  // METRIC A: TEACHER ATTENDANCE RATE
  // ==========================================
  var attendanceRecords = listRecords(SHEETS.TEACHER_ATTENDANCE, function (row) {
    if (!row.date) return false;
    var d = new Date(row.date);
    if (isNaN(d.getTime())) return false;
    var m = parseInt(Utilities.formatDate(d, timezone, "M"), 10);
    var y = parseInt(Utilities.formatDate(d, timezone, "yyyy"), 10);
    return m === currentMonth && y === currentYear;
  }) || [];

  var totalAttendanceCount = attendanceRecords.length;
  var presentCount = attendanceRecords.filter(function (r) { return r.status === "Hadir"; }).length;
  var teacherAttendanceRate = totalAttendanceCount > 0 ? Math.round((presentCount / totalAttendanceCount) * 100) : 100;

  // ==========================================
  // METRIC B: SPP COMPLEX COMPLETION
  // ==========================================
  var sppPayments = listRecords(SHEETS.SPP_PAYMENTS, function (bill) {
    return bill.academic_year_id === activeYear.id && bill.lifecycle_status !== 'deleted';
  }) || [];

  var currentMonthBills = sppPayments.filter(function (bill) {
    return parseInt(bill.month, 10) === currentMonth && parseInt(bill.year, 10) === currentYear;
  });
  var totalBills = currentMonthBills.length;
  var paidBills = currentMonthBills.filter(function (bill) { return bill.payment_status === "paid"; }).length;
  var sppCompletionRate = totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 0;
  var unpaidSppPercent = totalBills > 0 ? Math.round(((totalBills - paidBills) / totalBills) * 100) : 0;

  // Construct spp monthly chart data (Semester-based months)
  var monthNames = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var monthlyStatsMap = {};
  sppPayments.forEach(function (bill) {
    var m = parseInt(bill.month, 10);
    if (isNaN(m) || m < 1 || m > 12) return;
    if (!monthlyStatsMap[m]) {
      monthlyStatsMap[m] = { lunasCount: 0, totalCount: 0 };
    }
    monthlyStatsMap[m].totalCount++;
    if (bill.payment_status === "paid") {
      monthlyStatsMap[m].lunasCount++;
    }
  });

  var monthsToQuery = (activeSem && activeSem.name && activeSem.name.toLowerCase().indexOf("genap") !== -1)
    ? [1, 2, 3, 4, 5, 6]
    : [7, 8, 9, 10, 11, 12];

  var sppChartData = [];
  monthsToQuery.forEach(function (m) {
    var stats = monthlyStatsMap[m] || { lunasCount: 0, totalCount: 0 };
    var lunasPercent = stats.totalCount > 0 ? Math.round((stats.lunasCount / stats.totalCount) * 100) : 0;
    var belumPercent = stats.totalCount > 0 ? (100 - lunasPercent) : 0;

    sppChartData.push({
      name: monthNames[m],
      Lunas: lunasPercent,
      Belum: belumPercent
    });
  });

  // ==========================================
  // METRIC C: STUDENT FILES COMPLETENESS
  // ==========================================
  var activeStudents = listRecords(SHEETS.STUDENTS, function (s) {
    return s.status === STATUS.ACTIVE;
  }) || [];
  var studentFiles = listRecords(SHEETS.STUDENT_FILES, function (f) {
    return f.status === "active";
  }) || [];

  var kkCount = studentFiles.filter(function (f) { return f.file_type === "KK"; }).length;
  var aktaCount = studentFiles.filter(function (f) { return f.file_type === "AKTA"; }).length;
  var ijazahCount = studentFiles.filter(function (f) { return f.file_type === "IJAZAH"; }).length;

  var totalActiveStudents = activeStudents.length;
  var totalExpectedDocs = totalActiveStudents * 3;
  var totalUploadedDocs = studentFiles.length;
  var docCompletionRate = totalExpectedDocs > 0 ? Math.round((totalUploadedDocs / totalExpectedDocs) * 100) : 0;

  var docPieChartData = [
    { name: "Kartu Keluarga Lengkap", value: kkCount },
    { name: "Akta Kelahiran Lengkap", value: aktaCount },
    { name: "Ijazah Sebelumnya", value: ijazahCount },
    { name: "Belum Lengkap", value: Math.max(0, totalExpectedDocs - totalUploadedDocs) }
  ];

  // ==========================================
  // METRIC D: FITRAH Dimensi Radar Chart & Aggregations
  // ==========================================
  var activeCultureScores = listRecords(SHEETS.CULTURE_SCORES, function (cs) {
    return cs.academic_year_id === activeYear.id && cs.status === "active";
  }) || [];

  var totalF = 0, countF = 0;
  var totalI = 0, countI = 0;
  var totalT = 0, countT = 0;
  var totalR = 0, countR = 0;
  var totalA = 0, countA = 0;
  var totalH = 0, countH = 0;

  activeCultureScores.forEach(function (cs) {
    if (cs.asm_score !== null && cs.asm_score !== undefined && cs.asm_score !== "") {
      totalF += Number(cs.asm_score);
      countF++;
    }
    if (cs.am_score !== null && cs.am_score !== undefined && cs.am_score !== "") {
      totalI += Number(cs.am_score);
      countI++;
    }
    if (cs.br_score !== null && cs.br_score !== undefined && cs.br_score !== "") {
      totalT += Number(cs.br_score);
      countT++;
    }
    var ramahSum = 0, ramahCount = 0;
    if (cs.sss_score !== null && cs.sss_score !== undefined && cs.sss_score !== "") {
      ramahSum += Number(cs.sss_score);
      ramahCount++;
    }
    if (cs.hb_score !== null && cs.hb_score !== undefined && cs.hb_score !== "") {
      ramahSum += Number(cs.hb_score);
      ramahCount++;
    }
    if (ramahCount > 0) {
      totalR += (ramahSum / ramahCount);
      countR++;
    }
    if (cs.ak_score !== null && cs.ak_score !== undefined && cs.ak_score !== "") {
      totalA += Number(cs.ak_score);
      countA++;
    }
    if (cs.tm_score !== null && cs.tm_score !== undefined && cs.tm_score !== "") {
      totalH += Number(cs.tm_score);
      countH++;
    }
  });

  var avgF = countF > 0 ? parseFloat((totalF / countF).toFixed(1)) : 0;
  var avgI = countI > 0 ? parseFloat((totalI / countI).toFixed(1)) : 0;
  var avgT = countT > 0 ? parseFloat((totalT / countT).toFixed(1)) : 0;
  var avgR = countR > 0 ? parseFloat((totalR / countR).toFixed(1)) : 0;
  var avgA = countA > 0 ? parseFloat((totalA / countA).toFixed(1)) : 0;
  var avgH = countH > 0 ? parseFloat((totalH / countH).toFixed(1)) : 0;

  var fitrahRadarData = [];
  var totalCultureCount = countF + countI + countT + countR + countA + countH;
  if (totalCultureCount > 0) {
    fitrahRadarData = [
      { subject: "Fathonah", A: avgF, fullMark: 4.0 },
      { subject: "Istiqamah", A: avgI, fullMark: 4.0 },
      { subject: "Tanggung Jawab", A: avgT, fullMark: 4.0 },
      { subject: "Ramah", A: avgR, fullMark: 4.0 },
      { subject: "Amanah", A: avgA, fullMark: 4.0 },
      { subject: "Harmonis", A: avgH, fullMark: 4.0 }
    ];
  }

  // ==========================================
  // METRIC E: SYSTEM BACKUP & INTEGRITY TIMESTAMPS
  // ==========================================
  var settings = getAppSettings();
  var lastBackupTime = settings.last_backup_time || "Belum ada backup";
  var lastBackupStatus = settings.last_backup_status || "Pending";
  var lastIntegrityCheckTime = settings.last_integrity_check_time || "Belum ada pengecekan";
  var lastIntegrityCheckStatus = settings.last_integrity_check_status || "Pending";

  // ==========================================
  // METRIC F: DYNAMIC SCHOOL INSIGHTS (HUMAN-CENTERED)
  // ==========================================
  // Insight 1: Best Academic Class Average
  var assessments = listRecords(SHEETS.ACADEMIC_ASSESSMENTS, function (a) {
    return a.academic_year_id === activeYear.id && a.lifecycle_status !== 'deleted';
  }) || [];
  var assessmentIds = assessments.map(function (a) { return a.id; });
  var assessmentClassMap = {};
  assessments.forEach(function (a) { assessmentClassMap[a.id] = a.class_id; });

  var scores = listRecords(SHEETS.ACADEMIC_SCORES, function (s) {
    return assessmentIds.indexOf(s.assessment_id) !== -1 && s.lifecycle_status !== 'deleted';
  }) || [];

  var classScoresSum = {};
  var classScoresCount = {};
  scores.forEach(function (s) {
    var classId = assessmentClassMap[s.assessment_id];
    if (!classId || !classMap[classId]) return;
    if (s.score === null || s.score === undefined || s.score === "") return;
    var scoreVal = Number(s.score);
    if (isNaN(scoreVal)) return;
    if (!classScoresSum[classId]) {
      classScoresSum[classId] = 0;
      classScoresCount[classId] = 0;
    }
    classScoresSum[classId] += scoreVal;
    classScoresCount[classId]++;
  });

  var bestClassId = null;
  var bestClassAvg = 0;
  Object.keys(classScoresSum).forEach(function (classId) {
    var count = classScoresCount[classId];
    if (count === 0) return;
    var avg = classScoresSum[classId] / count;
    if (avg > bestClassAvg) {
      bestClassAvg = avg;
      bestClassId = classId;
    }
  });
  var bestClassAcademicName = bestClassId ? classMap[bestClassId] : "Belum ada data";
  var bestClassAcademicAvg = bestClassAvg > 0 ? "Rata-rata akademik tertinggi (" + bestClassAvg.toFixed(1) + ")" : "Menunggu input nilai pertama";

  // Insight 2: Most Active Teacher (Evaluations Created)
  var teacherAssessmentsCount = {};
  assessments.forEach(function (a) {
    var tId = a.teacher_user_id;
    if (!tId || !teacherMap[tId]) return;
    if (!teacherAssessmentsCount[tId]) {
      teacherAssessmentsCount[tId] = 0;
    }
    teacherAssessmentsCount[tId]++;
  });
  var activeTeacherId = null;
  var activeTeacherCount = 0;
  Object.keys(teacherAssessmentsCount).forEach(function (tId) {
    var count = teacherAssessmentsCount[tId];
    if (count > activeTeacherCount) {
      activeTeacherCount = count;
      activeTeacherId = tId;
    }
  });
  var mostActiveTeacherName = activeTeacherId ? teacherMap[activeTeacherId] : "Belum ada aktivitas";
  var mostActiveTeacherDesc = activeTeacherCount > 0 ? "Paling giat membuat " + activeTeacherCount + " evaluasi belajar" : "Menunggu pembuatan asesmen";

  // Insight 3: Best Class in Culture (SAHABAT) Completeness
  var classCultureSum = {};
  var classCultureCount = {};
  activeCultureScores.forEach(function (cs) {
    var classId = cs.class_id;
    if (!classId || !classMap[classId]) return;
    var scoreSum = 0;
    var countVal = 0;
    var fields = ['sss_score', 'am_score', 'hb_score', 'asm_score', 'br_score', 'ak_score', 'tm_score'];
    fields.forEach(function (f) {
      if (cs[f] !== null && cs[f] !== undefined && cs[f] !== "") {
        scoreSum += Number(cs[f]);
        countVal++;
      }
    });
    if (countVal === 0) return;
    var csAvg = scoreSum / countVal;
    if (!classCultureSum[classId]) {
      classCultureSum[classId] = 0;
      classCultureCount[classId] = 0;
    }
    classCultureSum[classId] += csAvg;
    classCultureCount[classId]++;
  });
  var bestCultureClassId = null;
  var bestCultureClassAvg = 0;
  Object.keys(classCultureSum).forEach(function (classId) {
    var count = classCultureCount[classId];
    if (count === 0) return;
    var avg = classCultureSum[classId] / count;
    if (avg > bestCultureClassAvg) {
      bestCultureClassAvg = avg;
      bestCultureClassId = classId;
    }
  });
  var bestCultureClassName = bestCultureClassId ? classMap[bestCultureClassId] : "Belum ada data";
  var bestCultureClassAvgStr = bestCultureClassAvg > 0 ? "Rasio kelayakan pembiasaan " + Math.round((bestCultureClassAvg / 4) * 100) + "%" : "Menunggu entri budaya harian";

  // ==========================================
  // METRIC G: CRITICAL EXECUTIVE ALERTS (DYNAMIC)
  // ==========================================
  // A. Classes without Wali Kelas
  var classTeacherAssignments = listRecords(SHEETS.CLASS_TEACHER_ASSIGNMENTS, function (a) {
    return a.academic_year_id === activeYear.id && a.semester_id === activeSem.id && a.status === "active";
  }) || [];
  var assignedClassIds = classTeacherAssignments.map(function (a) { return a.class_id; });
  var classesWithoutWali = [];
  activeClasses.forEach(function (c) {
    if (assignedClassIds.indexOf(c.id) === -1) {
      classesWithoutWali.push(c.name);
    }
  });

  // B. Enrolled status check (students without active enrollment class this semester)
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function (e) {
    return e.academic_year_id === activeYear.id && e.semester_id === activeSem.id && e.status === "active";
  }) || [];
  var enrolledStudentIds = enrollments.map(function (e) { return e.student_id; });
  var orphanStudentsCount = 0;
  activeStudents.forEach(function (s) {
    if (enrolledStudentIds.indexOf(s.id) === -1) {
      orphanStudentsCount++;
    }
  });

  // C. Security Audit Warnings (Last 24 hours)
  var oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  var failedLoginsCount = 0;
  var recentLogs = listRecords(SHEETS.AUDIT_LOGS, function (log) {
    if (!log.created_at) return false;
    var logDate = new Date(log.created_at);
    if (isNaN(logDate.getTime())) return false;
    return logDate >= oneDayAgo;
  }) || [];
  recentLogs.forEach(function (log) {
    var isWarning = log.severity === "critical" || log.severity === "warning";
    var isFail = log.action && log.action.toLowerCase().indexOf("fail") !== -1;
    if (isWarning || isFail) {
      failedLoginsCount++;
    }
  });

  // ==========================================
  // METRIC H: CLASS ACADEMIC AVERAGES (FOR CHART)
  // ==========================================
  var classAcademicAverages = [];
  activeClasses.forEach(function (c) {
    var sum = classScoresSum[c.id] || 0;
    var count = classScoresCount[c.id] || 0;
    var avg = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;
    classAcademicAverages.push({
      name: c.name,
      RataRata: avg
    });
  });

  return {
    teacherAttendanceRate: teacherAttendanceRate,
    sppCompletionRate: sppCompletionRate,
    sppChartData: sppChartData,
    docCompletionRate: docCompletionRate,
    docPieChartData: docPieChartData,
    fitrahRadarData: fitrahRadarData,
    lastBackupTime: lastBackupTime,
    lastBackupStatus: lastBackupStatus,
    lastIntegrityCheckTime: lastIntegrityCheckTime,
    lastIntegrityCheckStatus: lastIntegrityCheckStatus,
    // Dynamic School Insights
    bestClassAcademicName: bestClassAcademicName,
    bestClassAcademicAvg: bestClassAcademicAvg,
    mostActiveTeacherName: mostActiveTeacherName,
    mostActiveTeacherDesc: mostActiveTeacherDesc,
    bestCultureClassName: bestCultureClassName,
    bestCultureClassAvg: bestCultureClassAvgStr,
    // Critical Alert Metrics
    classesWithoutWali: classesWithoutWali,
    orphanStudentsCount: orphanStudentsCount,
    unpaidSppPercent: unpaidSppPercent,
    failedLoginsCount: failedLoginsCount,
    // Academic Chart Data
    classAcademicAverages: classAcademicAverages
  };
}
