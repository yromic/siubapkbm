/**
 * StudentSecurity.gs
 * Implements security operations, parent PIN hashing, and role-based field sanitization.
 */

/**
 * Generates a random 16-character salt.
 * @returns {string}
 */
function generateRandomSalt() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var salt = '';
  for (var i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Computes HMAC-SHA256 signature and returns hex-encoded string.
 * Falls back to random salt + SHA-256 if computeHmacSignature is unavailable.
 * @param {string} value
 * @param {string} key
 * @returns {string}
 */
function computeHmacSha256Hex(value, key) {
  try {
    var signature = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      value,
      key
    );
    var hash = "";
    for (var i = 0; i < signature.length; i++) {
      var byteVal = signature[i];
      if (byteVal < 0) byteVal += 256;
      var byteString = byteVal.toString(16);
      if (byteString.length == 1) byteString = "0" + byteString;
      hash += byteString;
    }
    return hash;
  } catch (e) {
    // Fallback to salt + value with SHA_256
    var signature = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      key + value,
      Utilities.Charset.UTF_8
    );
    var hash = "";
    for (var i = 0; i < signature.length; i++) {
      var byteVal = signature[i];
      if (byteVal < 0) byteVal += 256;
      var byteString = byteVal.toString(16);
      if (byteString.length == 1) byteString = "0" + byteString;
      hash += byteString;
    }
    return hash;
  }
}

/**
 * Hashes a parent access PIN using HMAC-SHA256 with a per-student salt.
 * @param {string} pin - Raw parent PIN.
 * @param {string} [salt] - Optional salt.
 * @returns {string} salt:hash format.
 */
function hashParentPin(pin, salt) {
  var pinStr = String(pin).trim();
  if (!/^\d{4,8}$/.test(pinStr)) {
    throw new Error("PIN must be numeric and between 4 to 8 digits.");
  }
  
  if (!salt) {
    salt = generateRandomSalt();
  }
  
  var hash = computeHmacSha256Hex(pinStr, salt);
  return salt + ":" + hash;
}

/**
 * Hashes a legacy parent access PIN using SHA-256 with static salt prefix.
 * @param {string} pin
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function hashLegacyParentPin(pin) {
  var pinStr = String(pin).trim();
  var salt = HASH_SALT_PREFIX || "PKBM_SALT_";
  var signature = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + pinStr,
    Utilities.Charset.UTF_8
  );
  var hash = "";
  for (var i = 0; i < signature.length; i++) {
    var byteVal = signature[i];
    if (byteVal < 0) byteVal += 256;
    var byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    hash += byteString;
  }
  return hash;
}

/**
 * Verifies a parent PIN against its stored hash (supporting legacy upgrade).
 * @param {string} pin
 * @param {string} storedHash
 * @param {string} [studentId] - Optional student ID for auto-upgrading legacy hashes.
 * @returns {boolean}
 */
function verifyParentPin(pin, storedHash, studentId) {
  if (!storedHash) return false;
  
  // New format check: salt:hash
  if (storedHash.indexOf(':') !== -1) {
    var parts = storedHash.split(':');
    var salt = parts[0];
    try {
      var computed = hashParentPin(pin, salt);
      return computed === storedHash;
    } catch (e) {
      return false;
    }
  }
  
  // Legacy format check: static SHA-256
  try {
    var legacyHash = hashLegacyParentPin(pin);
    if (legacyHash === storedHash) {
      // Rehash and save using new salt:hash format if studentId is provided
      if (studentId) {
        var newHash = hashParentPin(pin);
        updateRecord(SHEETS.STUDENTS, studentId, { parent_access_pin_hash: newHash }, { id: 'system_security', name: 'System Security', role: 'system' });
      }
      return true;
    }
  } catch (e) {}
  
  return false;
}

/**
 * Generates a random 6-digit numeric PIN.
 * @returns {string}
 */
function generateParentPin() {
  var pin = "";
  for (var i = 0; i < 6; i++) {
    pin += Math.floor(Math.random() * 10);
  }
  return pin;
}

/**
 * Sanitizes a student record dynamically based on the actor's role.
 * @param {Object} student - Raw student object from spreadsheet.
 * @param {string} actorRole - Role of the logged-in actor.
 * @returns {Object} Sanitized student object.
 */
function sanitizeStudentForRole(student, actorRole) {
  if (!student) return null;
  var copy = JSON.parse(JSON.stringify(student));
  
  // Fields that are ALWAYS stripped for all roles (including admin/administrator)
  copy.has_parent_pin = !!student.parent_access_pin_hash;
  delete copy.parent_access_pin_hash;
  delete copy.parent_access_pin_failed_attempts;
  delete copy.parent_access_pin_locked_until;
  
  if (actorRole === ROLES.TEACHER) {
    // Restricted field list for teachers
    var allowedFields = [
      'id', 'nisn', 'full_name', 'birth_place', 'birth_date', 
      'gender', 'religion', 'phone', 'status', 'created_at', 'updated_at',
      'student_enrollment_id', 'lifecycle_status'
    ];
    
    var keys = Object.keys(copy);
    keys.forEach(function(key) {
      if (allowedFields.indexOf(key) === -1) {
        delete copy[key];
      }
    });
  }
  
  return copy;
}

/**
 * Sanitizes a list of student records based on the actor's role.
 * @param {Object[]} students
 * @param {string} actorRole
 * @returns {Object[]}
 */
function sanitizeStudentListForRole(students, actorRole) {
  if (!students) return [];
  return students.map(function(s) {
    return sanitizeStudentForRole(s, actorRole);
  });
}
