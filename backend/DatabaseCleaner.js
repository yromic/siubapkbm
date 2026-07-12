/**
 * DatabaseCleaner.js
 * Utility to clear database sheets for production Go-Live.
 * Deletes all test/operational records while preserving sheet headers and the default administrator account.
 */

/**
 * Main function to clean database sheets for Go-Live.
 * Run this function from the Google Apps Script editor to prepare for production.
 */
function cleanDatabaseForGoLive() {
  console.log("=== STARTING GO-LIVE DATABASE CLEANUP PROCESS ===");
  
  var ss = getActiveSpreadsheet();
  
  // 1. Define tables that should be completely cleared (retaining only row 1 header)
  var sheetsToClear = [
    SHEETS.STUDENTS,
    SHEETS.STUDENT_ENROLLMENTS,
    SHEETS.STUDENT_FILES,
    SHEETS.CLASS_TEACHER_ASSIGNMENTS,
    SHEETS.CLASS_SUBJECTS,
    SHEETS.ACADEMIC_ASSESSMENTS,
    SHEETS.ACADEMIC_SCORES,
    SHEETS.CULTURE_SCORES,
    SHEETS.CHARACTER_WEEKLY_SUMMARIES,
    SHEETS.CHARACTER_MONTHLY_SUMMARIES,
    SHEETS.CHARACTER_SEMESTER_SUMMARIES,
    SHEETS.TEACHER_NOTES,
    SHEETS.TEACHER_ATTENDANCE,
    SHEETS.SPP_PAYMENTS,
    SHEETS.IMPORT_LOGS,
    SHEETS.AUDIT_LOGS,
    SHEETS.PARENT_ACCESS_LOGS,
    SHEETS.STAFF_SESSIONS,
    SHEETS.REPORT_SNAPSHOTS,
    SHEETS.REPORT_EXPORTS,
    SHEETS.BACKUP_SNAPSHOTS,
    SHEETS.CLASS_PROMOTION_RULES,
    // Optional master data sheets (uncomment to also clear classrooms and subjects):
    SHEETS.CLASSES,
    SHEETS.SUBJECTS
  ];

  sheetsToClear.forEach(function(sheetName) {
    try {
      var sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.deleteRows(2, lastRow - 1);
          console.log("[CLEARED] " + sheetName + ": Deleted " + (lastRow - 1) + " rows.");
        } else {
          console.log("[SKIPPED] " + sheetName + ": Already clean (0 data rows).");
        }
      } else {
        console.warn("[WARNING] Sheet not found: " + sheetName);
      }
    } catch (err) {
      console.error("[ERROR] Failed to clear sheet: " + sheetName + ". Error: " + err.message);
    }
  });

  // 2. Clean the 'users' and 'teacher_profiles' sheets carefully
  // We must preserve the default administrator account so that the system remains accessible.
  try {
    // Clear teacher profiles completely since they are bound to teacher users
    var profileSheet = ss.getSheetByName(SHEETS.TEACHER_PROFILES);
    if (profileSheet && profileSheet.getLastRow() > 1) {
      profileSheet.deleteRows(2, profileSheet.getLastRow() - 1);
      console.log("[CLEARED] " + SHEETS.TEACHER_PROFILES + ": Deleted all profile rows.");
    }

    // Clean users sheet except for default admin
    var userSheet = ss.getSheetByName(SHEETS.USERS);
    if (userSheet && userSheet.getLastRow() > 1) {
      var lastCol = userSheet.getLastColumn();
      var headers = userSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      var roleColIdx = headers.indexOf('role');
      var usernameColIdx = headers.indexOf('username');

      if (roleColIdx === -1 || usernameColIdx === -1) {
        throw new Error("Could not find 'role' or 'username' columns in users sheet.");
      }

      var values = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, lastCol).getValues();
      var deletedCount = 0;

      // Delete from bottom to top to preserve index order
      for (var i = values.length - 1; i >= 0; i--) {
        var rowVal = values[i];
        var username = rowVal[usernameColIdx];
        var role = rowVal[roleColIdx];

        // Retain default administrator account
        if (username === 'admin' && role === 'administrator') {
          console.log("[RETAINED] Default admin account: " + username);
          continue;
        }

        userSheet.deleteRow(i + 2); // +2 offset for 1-based index and header row
        deletedCount++;
      }
      console.log("[CLEARED] " + SHEETS.USERS + ": Deleted " + deletedCount + " user accounts.");
    }
  } catch (userErr) {
    console.error("[ERROR] Failed to clean users/profiles safely: " + userErr.message);
  }

  console.log("=== DATABASE CLEANUP PROCESS COMPLETED ===");
}
