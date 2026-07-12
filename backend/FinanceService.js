/**
 * FinanceService.js
 * Business logic and service implementations for student SPP payments.
 */

/**
 * Asserts that the actor has Admin or Operator role.
 * @param {Object} actor - The user object containing id, name, and role.
 */
function assertAdminOrOperatorRole(actor) {
  if (!actor) {
    throw { code: 'ERR_UNAUTHORIZED', message: 'Unauthorized.' };
  }
  if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.ADMINISTRATOR) {
    throw { code: 'ERR_FORBIDDEN', message: 'Forbidden. Access restricted to Admin or Administrator only.' };
  }
}

/**
 * Lazy creation or retrieval of SPP bill for a student on current calendar month/year.
 * Under script lock.
 * @param {string} studentId
 * @param {Object} [actor]
 * @returns {Object} The payment bill record.
 */
function getOrCreateCurrentSppBill(studentId, actor) {
  var activeYear;
  try {
    activeYear = getActiveAcademicYear();
  } catch (err) {
    throw { code: 'ERR_ACTIVE_YEAR_NOT_SET', message: 'Tahun ajaran aktif belum dikonfigurasi.' };
  }

  // Get current calendar month and year based on Asia/Jakarta server time
  var timezone = "Asia/Jakarta";
  var today = new Date();
  var currentMonth = parseInt(Utilities.formatDate(today, timezone, "M"), 10);
  var currentYear = parseInt(Utilities.formatDate(today, timezone, "yyyy"), 10);

  // Check if student exists
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  if (!student) {
    throw { code: 'ERR_NOT_FOUND', message: 'Siswa tidak ditemukan.' };
  }

  // Look for existing bill
  var existingBills = listRecords(SHEETS.SPP_PAYMENTS, function(bill) {
    return bill.student_id === studentId &&
           parseInt(bill.month, 10) === currentMonth &&
           parseInt(bill.year, 10) === currentYear;
  });

  if (existingBills.length > 0) {
    return existingBills[0];
  }

  // Default SPP amount: 500,000 (can be configured in app_settings under default_spp_amount)
  var defaultAmount = 500000;
  var settings = getAppSettings();
  if (settings.default_spp_amount) {
    var val = parseInt(settings.default_spp_amount, 10);
    if (!isNaN(val)) {
      defaultAmount = val;
    }
  }

  // Use student-specific SPP amount if registered, otherwise fallback to default settings
  var finalAmountDue = defaultAmount;
  if (student && student.spp_amount !== undefined && student.spp_amount !== null && student.spp_amount !== '') {
    var sppVal = parseFloat(student.spp_amount);
    if (!isNaN(sppVal) && sppVal >= 0) {
      finalAmountDue = sppVal;
    }
  }

  // Lazy creation
  var billRecord = {
    id: "SPP_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000),
    student_id: studentId,
    academic_year_id: activeYear.id,
    month: currentMonth,
    year: currentYear,
    amount_due: finalAmountDue,
    amount_paid: 0,
    payment_status: 'unpaid',
    paid_at: '',
    payment_method: '',
    verified_by: '',
    notes: ''
  };

  return createRecord(SHEETS.SPP_PAYMENTS, billRecord, actor);
}

/**
 * Lists SPP bills matching student ID and aggregates them (including arrears).
 */
function getStudentSppHistory(studentId, actor) {
  // Ensure current month bill is created (lazy creation)
  getOrCreateCurrentSppBill(studentId, actor);

  // Return all records for this student
  var history = listRecords(SHEETS.SPP_PAYMENTS, function(bill) {
    return bill.student_id === studentId;
  });

  // Sort chronologically (newest first)
  history.sort(function(a, b) {
    var yearA = parseInt(a.year, 10);
    var yearB = parseInt(b.year, 10);
    if (yearA !== yearB) return yearB - yearA;
    return parseInt(b.month, 10) - parseInt(a.month, 10);
  });

  var timezone = "Asia/Jakarta";
  var today = new Date();
  var currentMonth = parseInt(Utilities.formatDate(today, timezone, "M"), 10);
  var currentYear = parseInt(Utilities.formatDate(today, timezone, "yyyy"), 10);

  var currentBill = null;
  var arrears = [];
  var totalArrearsAmount = 0;

  history.forEach(function(bill) {
    var bMonth = parseInt(bill.month, 10);
    var bYear = parseInt(bill.year, 10);

    if (bMonth === currentMonth && bYear === currentYear) {
      currentBill = bill;
    }
    
    var isPast = (bYear < currentYear) || (bYear === currentYear && bMonth < currentMonth);
    if (isPast && bill.payment_status !== 'paid') {
      arrears.push(bill);
      totalArrearsAmount += (parseFloat(bill.amount_due || 0) - parseFloat(bill.amount_paid || 0));
    }
  });

  return {
    current_bill: currentBill,
    total_arrears_amount: totalArrearsAmount,
    arrears: arrears,
    history: history
  };
}

/**
 * Lists all SPP bills for admin dashboard with filtering by class, month, and year.
 * Lazily creates bills for active students in the selected class if not exists.
 * @param {Object} payload - contains class_id, month, year
 * @param {Object} actor
 */
function listSppPaymentsForAdmin(payload, actor) {
  assertAdminOrOperatorRole(actor);

  var classId = payload.class_id;
  var targetMonth = parseInt(payload.month, 10);
  var targetYear = parseInt(payload.year, 10);

  if (!classId || isNaN(targetMonth) || isNaN(targetYear)) {
    throw { code: 'ERR_INVALID_PARAMETER', message: 'class_id, month, and year are required.' };
  }

  var activeYear = getActiveAcademicYear();
  var activeSem = getActiveSemester(activeYear.id);

  // Get active student enrollments for this class & period
  var enrollments = listRecords(SHEETS.STUDENT_ENROLLMENTS, function(e) {
    return e.class_id === classId &&
           e.academic_year_id === activeYear.id &&
           e.semester_id === activeSem.id &&
           e.status === 'active';
  });

  var studentIds = enrollments.map(function(e) { return e.student_id; });

  // Get all active students for these enrollments to get full name & nisn
  var studentsMap = {};
  listRecords(SHEETS.STUDENTS, function(s) {
    if (studentIds.indexOf(s.id) !== -1) {
      studentsMap[s.id] = s;
      return true;
    }
    return false;
  });

  // Lazy creation check for each enrolled student for current month/year if matching targetMonth/targetYear
  var timezone = "Asia/Jakarta";
  var today = new Date();
  var currentMonth = parseInt(Utilities.formatDate(today, timezone, "M"), 10);
  var currentYear = parseInt(Utilities.formatDate(today, timezone, "yyyy"), 10);

  if (targetMonth === currentMonth && targetYear === currentYear) {
    studentIds.forEach(function(studentId) {
      try {
        getOrCreateCurrentSppBill(studentId, actor);
      } catch (err) {
        console.error("Failed to lazy create SPP bill for student: " + studentId, err);
      }
    });
  }

  // Load all bills for these students for target month & year
  var bills = listRecords(SHEETS.SPP_PAYMENTS, function(bill) {
    return studentIds.indexOf(bill.student_id) !== -1 &&
           parseInt(bill.month, 10) === targetMonth &&
           parseInt(bill.year, 10) === targetYear;
  });

  // Map bills with student info
  return bills.map(function(bill) {
    var student = studentsMap[bill.student_id] || {};
    return {
      id: bill.id,
      student_id: bill.student_id,
      student_name: student.full_name || 'N/A',
      student_nisn: student.nisn || 'N/A',
      academic_year_id: bill.academic_year_id,
      month: parseInt(bill.month, 10),
      year: parseInt(bill.year, 10),
      amount_due: parseFloat(bill.amount_due || 0),
      amount_paid: parseFloat(bill.amount_paid || 0),
      payment_status: bill.payment_status,
      paid_at: bill.paid_at,
      payment_method: bill.payment_method,
      verified_by: bill.verified_by,
      notes: bill.notes,
      created_at: bill.created_at,
      updated_at: bill.updated_at
    };
  });
}

/**
 * Verifies and allocates payment for a student, supporting multiple months / advance payment and arrears (FIFO).
 * Under script lock via Repository functions.
 * @param {Object} actor
 * @param {string} studentId
 * @param {number} totalAmountPaid
 * @param {string} method
 * @param {string} notes
 */
function verifyPaymentBulk(actor, studentId, totalAmountPaid, method, notes, advanceMonths) {
  assertAdminOrOperatorRole(actor);

  if (!studentId || isNaN(totalAmountPaid) || totalAmountPaid <= 0) {
    throw { code: 'ERR_INVALID_PARAMETER', message: 'studentId is required, and totalAmountPaid must be a positive number.' };
  }

  var activeYear;
  try {
    activeYear = getActiveAcademicYear();
  } catch (err) {
    throw { code: 'ERR_ACTIVE_YEAR_NOT_SET', message: 'Tahun ajaran aktif belum dikonfigurasi.' };
  }

  // Pre-generate bills if advanceMonths > 1
  var limitMonths = parseInt(advanceMonths, 10);
  if (!isNaN(limitMonths) && limitMonths > 1) {
    var timezone = "Asia/Jakarta";
    var today = new Date();
    var startMonth = parseInt(Utilities.formatDate(today, timezone, "M"), 10);
    var startYear = parseInt(Utilities.formatDate(today, timezone, "yyyy"), 10);

    var defaultAmount = 500000;
    var settings = getAppSettings();
    if (settings.default_spp_amount) {
      var val = parseInt(settings.default_spp_amount, 10);
      if (!isNaN(val)) {
        defaultAmount = val;
      }
    }

    var student = getRecordById(SHEETS.STUDENTS, studentId);
    var studentSppAmount = defaultAmount;
    if (student && student.spp_amount !== undefined && student.spp_amount !== null && student.spp_amount !== '') {
      var sppVal = parseFloat(student.spp_amount);
      if (!isNaN(sppVal) && sppVal >= 0) {
        studentSppAmount = sppVal;
      }
    }

    var currentMonthTracker = startMonth;
    var currentYearTracker = startYear;

    for (var k = 0; k < limitMonths; k++) {
      var searchMonth = currentMonthTracker;
      var searchYear = currentYearTracker;
      
      var existing = listRecords(SHEETS.SPP_PAYMENTS, function(b) {
        return b.student_id === studentId &&
               parseInt(b.month, 10) === searchMonth &&
               parseInt(b.year, 10) === searchYear;
      });

      if (existing.length === 0) {
        var newBill = {
          id: "SPP_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000) + "_" + k,
          student_id: studentId,
          academic_year_id: activeYear.id,
          month: searchMonth,
          year: searchYear,
          amount_due: studentSppAmount,
          amount_paid: 0,
          payment_status: 'unpaid',
          paid_at: '',
          payment_method: '',
          verified_by: '',
          notes: ''
        };
        createRecord(SHEETS.SPP_PAYMENTS, newBill, actor);
      }

      currentMonthTracker++;
      if (currentMonthTracker > 12) {
        currentMonthTracker = 1;
        currentYearTracker++;
      }
    }
  }

  // Ensure current month bill exists (lazy creation)
  getOrCreateCurrentSppBill(studentId, actor);

  // Get all bills for this student
  var bills = listRecords(SHEETS.SPP_PAYMENTS, function(bill) {
    return bill.student_id === studentId;
  });

  // Sort chronologically (oldest first)
  bills.sort(function(a, b) {
    var yearA = parseInt(a.year, 10);
    var yearB = parseInt(b.year, 10);
    if (yearA !== yearB) return yearA - yearB;
    return parseInt(a.month, 10) - parseInt(b.month, 10);
  });

  var remainingFunds = totalAmountPaid;
  var updatedBills = [];
  var timezone = "Asia/Jakarta";
  var paidAt = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  // 1. Allocate to existing unpaid or partial bills first
  for (var i = 0; i < bills.length; i++) {
    var bill = bills[i];
    var due = parseFloat(bill.amount_due || 0);
    var paid = parseFloat(bill.amount_paid || 0);
    var balance = due - paid;

    if (balance > 0 && remainingFunds > 0) {
      var allocation = Math.min(balance, remainingFunds);
      var newPaid = paid + allocation;
      remainingFunds -= allocation;

      var status = newPaid >= due ? 'paid' : 'partial';
      var patch = {
        amount_paid: newPaid,
        payment_status: status,
        paid_at: paidAt,
        payment_method: method || 'cash',
        verified_by: actor.id,
        notes: notes || bill.notes || ''
      };
      
      var updated = updateRecord(SHEETS.SPP_PAYMENTS, bill.id, patch, actor);
      updatedBills.push(updated);
    }
  }

  // 2. If there are still remaining funds, generate future bills and pay them
  var lastBill = bills[bills.length - 1];
  var lastMonth = parseInt(lastBill.month, 10);
  var lastYear = parseInt(lastBill.year, 10);

  var activeYear = getActiveAcademicYear();
  var defaultAmount = 500000;
  var settings = getAppSettings();
  if (settings.default_spp_amount) {
    var val = parseInt(settings.default_spp_amount, 10);
    if (!isNaN(val)) {
      defaultAmount = val;
    }
  }

  // Load student profile to get specific spp_amount
  var student = getRecordById(SHEETS.STUDENTS, studentId);
  var studentSppAmount = defaultAmount;
  if (student && student.spp_amount !== undefined && student.spp_amount !== null && student.spp_amount !== '') {
    var sppVal = parseFloat(student.spp_amount);
    if (!isNaN(sppVal) && sppVal >= 0) {
      studentSppAmount = sppVal;
    }
  }

  while (remainingFunds > 0) {
    // Advance month
    lastMonth++;
    if (lastMonth > 12) {
      lastMonth = 1;
      lastYear++;
    }

    var allocation = Math.min(studentSppAmount, remainingFunds);
    remainingFunds -= allocation;
    var status = allocation >= studentSppAmount ? 'paid' : 'partial';

    var futureBill = {
      id: "SPP_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000),
      student_id: studentId,
      academic_year_id: activeYear.id,
      month: lastMonth,
      year: lastYear,
      amount_due: studentSppAmount,
      amount_paid: allocation,
      payment_status: status,
      paid_at: paidAt,
      payment_method: method || 'cash',
      verified_by: actor.id,
      notes: notes || 'Advance payment'
    };

    var created = createRecord(SHEETS.SPP_PAYMENTS, futureBill, actor);
    updatedBills.push(created);
  }

  return updatedBills;
}

function verifyBulkPayments(actor, studentIds, amountPaid, paymentMethod, notes, advanceMonths) {
  assertAdminOrOperatorRole(actor);

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw { code: 'ERR_INVALID_PARAMETER', message: 'student_ids array is required and must not be empty.' };
  }

  var allUpdatedBills = [];
  var targetAmount = parseFloat(amountPaid);
  if (isNaN(targetAmount) || targetAmount < 0) {
    targetAmount = 0;
  }

  studentIds.forEach(function(studentId) {
    var studentAmount = targetAmount;
    
    // Pre-generate bills if advanceMonths > 1
    var limitMonths = parseInt(advanceMonths, 10);
    if (!isNaN(limitMonths) && limitMonths > 1) {
      var timezone = "Asia/Jakarta";
      var today = new Date();
      var startMonth = parseInt(Utilities.formatDate(today, timezone, "M"), 10);
      var startYear = parseInt(Utilities.formatDate(today, timezone, "yyyy"), 10);

      var defaultAmount = 500000;
      var settings = getAppSettings();
      if (settings.default_spp_amount) {
        var val = parseInt(settings.default_spp_amount, 10);
        if (!isNaN(val)) {
          defaultAmount = val;
        }
      }

      var student = getRecordById(SHEETS.STUDENTS, studentId);
      var studentSppAmount = defaultAmount;
      if (student && student.spp_amount !== undefined && student.spp_amount !== null && student.spp_amount !== '') {
        var sppVal = parseFloat(student.spp_amount);
        if (!isNaN(sppVal) && sppVal >= 0) {
          studentSppAmount = sppVal;
        }
      }

      var currentMonthTracker = startMonth;
      var currentYearTracker = startYear;
      var activeYear = getActiveAcademicYear();

      for (var k = 0; k < limitMonths; k++) {
        var searchMonth = currentMonthTracker;
        var searchYear = currentYearTracker;
        
        var existing = listRecords(SHEETS.SPP_PAYMENTS, function(b) {
          return b.student_id === studentId &&
                 parseInt(b.month, 10) === searchMonth &&
                 parseInt(b.year, 10) === searchYear;
        });

        if (existing.length === 0) {
          var newBill = {
            id: "SPP_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000) + "_" + k,
            student_id: studentId,
            academic_year_id: activeYear.id,
            month: searchMonth,
            year: searchYear,
            amount_due: studentSppAmount,
            amount_paid: 0,
            payment_status: 'unpaid',
            paid_at: '',
            payment_method: '',
            verified_by: '',
            notes: ''
          };
          createRecord(SHEETS.SPP_PAYMENTS, newBill, actor);
        }

        currentMonthTracker++;
        if (currentMonthTracker > 12) {
          currentMonthTracker = 1;
          currentYearTracker++;
        }
      }
    }

    if (studentAmount === 0) {
      // Lazy create the current bill first to ensure it's calculated in outstanding balance
      getOrCreateCurrentSppBill(studentId, actor);
      
      // Calculate total outstanding balance (unpaid + partial)
      var sppStatus = getStudentSppHistory(studentId, actor);
      var outstanding = 0;
      sppStatus.history.forEach(function(bill) {
        if (bill.payment_status !== 'paid') {
          outstanding += (parseFloat(bill.amount_due || 0) - parseFloat(bill.amount_paid || 0));
        }
      });
      studentAmount = outstanding;
    }

    if (studentAmount > 0) {
      var updated = verifyPaymentBulk(actor, studentId, studentAmount, paymentMethod, notes, advanceMonths);
      if (updated && updated.length > 0) {
        allUpdatedBills = allUpdatedBills.concat(updated);
      }
    }
  });

  return allUpdatedBills;
}

/**
 * Reverts SPP payment status back to unpaid.
 * @param {Object} actor
 * @param {string} paymentId
 * @returns {Object} The updated record.
 */
function revertSppPayment(actor, paymentId) {
  assertAdminOrOperatorRole(actor);

  if (!paymentId) {
    throw { code: 'ERR_INVALID_PARAMETER', message: 'paymentId is required.' };
  }

  // Check if payment bill exists
  var bill = getRecordById(SHEETS.SPP_PAYMENTS, paymentId);
  if (!bill) {
    throw { code: 'ERR_NOT_FOUND', message: 'Tagihan SPP tidak ditemukan.' };
  }

  // Update SPP record: status to unpaid, reset payment values to 0 / empty
  var patch = {
    amount_paid: 0,
    payment_status: 'unpaid',
    paid_at: '',
    payment_method: '',
    verified_by: '',
    notes: ''
  };

  return updateRecord(SHEETS.SPP_PAYMENTS, paymentId, patch, actor);
}
