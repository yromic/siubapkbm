/**
 * QA_Attendance.js
 * Automated QA test suite for Attendance Geolocation & Manual Override Service.
 */

function runAllAttendanceTests() {
  console.log("=== STARTING ATTENDANCE BACKEND QA AUTOMATION ===");
  
  // 1. Define Mock Actors
  var superAdminActor = { role: 'super_admin', id: 'SA-01', name: 'Super Admin Mock' };
  var adminActor = { role: 'admin', id: 'ADM-01', name: 'Admin Mock' };
  var teacherActor = { role: 'teacher', id: 'TCH-01', name: 'Teacher Mock' };
  var parentActor = { role: 'parent', id: 'PRN-01', name: 'Parent Mock', nisn: '1234567890' };
  
  var todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

  // TEST CASE 1: RBAC PELANGGARAN (PARENT)
  console.log("\n[TEST CASE 1] Parent & Student RBAC Restrictions");
  try {
    recordAttendance(parentActor, -7.137833361601518, 110.40724215148737);
    console.log("[TEST 1.1] Parent Absen - EXPECTED: FAIL - RESULT: PASSED (Unexpectedly allowed)");
  } catch (e) {
    console.log("[TEST 1.1] Parent Absen - EXPECTED: FAIL - RESULT: FAILED (Correctly rejected: " + (e.message || e) + ")");
  }

  try {
    record_manual_attendance(parentActor, 'TCH-02', todayStr, 'Sakit');
    console.log("[TEST 1.2] Parent Manual Input - EXPECTED: FAIL - RESULT: PASSED (Unexpectedly allowed)");
  } catch (e) {
    console.log("[TEST 1.2] Parent Manual Input - EXPECTED: FAIL - RESULT: FAILED (Correctly rejected: " + (e.message || e) + ")");
  }

  // TEST CASE 2: GEOLOCATION SPOOFING (TEACHER)
  console.log("\n[TEST CASE 2] Geolocation Spoofing (Teacher)");
  try {
    // Valid coordinates inside allowed 150m radius
    var resValid = recordAttendance(teacherActor, -7.137833361601518, 110.40724215148737);
    console.log("[TEST 2.1] Teacher Valid Geolocation - EXPECTED: SUCCESS - RESULT: SUCCESS (Saved record ID: " + resValid.id + ")");
  } catch (e) {
    console.log("[TEST 2.1] Teacher Valid Geolocation - EXPECTED: SUCCESS - RESULT: FAIL (Unexpected error: " + (e.message || e) + ")");
  }

  try {
    // Jakarta coordinates (out of area)
    recordAttendance(teacherActor, -6.200000, 106.816666);
    console.log("[TEST 2.2] Teacher Out-of-Radius Geolocation - EXPECTED: FAIL - RESULT: SUCCESS (Unexpectedly allowed)");
  } catch (e) {
    console.log("[TEST 2.2] Teacher Out-of-Radius Geolocation - EXPECTED: FAIL - RESULT: FAIL (Correctly rejected: " + (e.message || e) + ")");
  }

  // TEST CASE 3: ADMIN MANUAL OVERRIDE
  console.log("\n[TEST CASE 3] Admin Manual Override");
  try {
    // Clean existing test record to make the test repeatable
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('teacher_attendance');
      if (sheet) {
        var rows = readRows('teacher_attendance');
        for (var i = rows.length - 1; i >= 0; i--) {
          var r = rows[i];
          if (r.teacher_id === 'TCH-02' && r.date === todayStr) {
            sheet.deleteRow(i + 2); // 1-indexed header offset
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Test cleanup notice: " + cleanErr.message);
    }
    
    var resManual = record_manual_attendance(adminActor, 'TCH-02', todayStr, 'Sakit');
    if (resManual && resManual.error) {
      throw new Error(resManual.message);
    }
    console.log("[TEST 3.1] Admin Manual Input for TCH-02 - EXPECTED: SUCCESS - RESULT: SUCCESS (Saved record ID: " + resManual.id + ")");
  } catch (e) {
    console.log("[TEST 3.1] Admin Manual Input for TCH-02 - EXPECTED: SUCCESS - RESULT: FAIL (Unexpected error: " + (e.message || e) + ")");
  }

  try {
    var resSelf = record_manual_attendance(teacherActor, 'TCH-01', todayStr, 'Sakit');
    if (resSelf && resSelf.error) {
      throw new Error(resSelf.message);
    }
    console.log("[TEST 3.2] Teacher Manual Input Self - EXPECTED: FAIL - RESULT: SUCCESS (Unexpectedly allowed)");
  } catch (e) {
    console.log("[TEST 3.2] Teacher Manual Input Self - EXPECTED: FAIL - RESULT: FAIL (Correctly rejected: " + (e.message || e) + ")");
  }

  // TEST CASE 4: VISIBILITAS DATA (GET HISTORY)
  console.log("\n[TEST CASE 4] Data Visibility & History Access");
  try {
    var history = get_attendance_history(teacherActor);
    if (history && history.error) {
      throw new Error(history.message);
    }
    var hasOtherTeacherData = history.some(function(item) {
      return item.teacher_id !== 'TCH-01';
    });
    if (hasOtherTeacherData) {
      console.log("[TEST 4.1] Teacher Get History - EXPECTED: ONLY OWN DATA - RESULT: FAIL (Contains other teachers' data)");
    } else {
      console.log("[TEST 4.1] Teacher Get History - EXPECTED: ONLY OWN DATA - RESULT: SUCCESS (Successfully restricted to own data, total records: " + history.length + ")");
    }
  } catch (e) {
    console.log("[TEST 4.1] Teacher Get History - EXPECTED: ONLY OWN DATA - RESULT: FAIL (Unexpected error: " + (e.message || e) + ")");
  }

  try {
    var parentHistory = get_attendance_history(parentActor);
    if (parentHistory && parentHistory.error) {
      throw new Error(parentHistory.message);
    }
    console.log("[TEST 4.2] Parent Get History - EXPECTED: FAIL - RESULT: SUCCESS (Unexpectedly allowed)");
  } catch (e) {
    console.log("[TEST 4.2] Parent Get History - EXPECTED: FAIL - RESULT: FAIL (Correctly rejected: " + (e.message || e) + ")");
  }

  console.log("\n=== ATTENDANCE BACKEND QA AUTOMATION COMPLETED ===");
}
