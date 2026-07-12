/**
 * ParentPortalSecurity.gs
 * Implements verification, failed attempts increments, lockouts, and response filtering.
 */

var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if a student access is currently locked out.
 * @param {Object} student
 * @returns {boolean}
 */
function isParentAccessLocked(student) {
  if (student.parent_access_pin_locked_until) {
    var lockedUntil = new Date(student.parent_access_pin_locked_until).getTime();
    var now = new Date().getTime();
    if (lockedUntil > now) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitizes the student profile for parent responses.
 * Removes NIK, KK, PIN hashes, and internal locking properties.
 * @param {Object} student
 * @returns {Object}
 */
// Rename to avoid collision with standard student sanitizers
function sanitizeStudentForParent(student) {
  if (!student) return null;
  var copy = JSON.parse(JSON.stringify(student));
  
  var sensitiveFields = [
    'nik', 'family_card_number', 'family_card_date', 
    'mother_nik', 'father_nik', 'guardian_nik',
    'parent_access_pin_hash', 'parent_access_pin_failed_attempts', 'parent_access_pin_locked_until'
  ];
  
  sensitiveFields.forEach(function(field) {
    delete copy[field];
  });
  
  return copy;
}
