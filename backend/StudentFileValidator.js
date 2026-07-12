/**
 * StudentFileValidator.gs
 * Validates payloads, file size, file types, and MIME types for student documents.
 */

var VALID_FILE_TYPES = ['foto', 'pas_foto', 'kk', 'akta', 'dokumen_lain'];
var VALID_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
var MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Validates the file upload or replace payload.
 * @param {Object} payload
 */
function validateStudentFilePayload(payload) {
  // Validate required fields
  validateRequiredFields(payload, ['actor_user_id', 'student_id', 'file_type', 'file_name', 'mime_type', 'base64_content']);
  
  // Validate student exists
  var student = getRecordById(SHEETS.STUDENTS, payload.student_id);
  if (!student) {
    throw {
      code: 'ERR_NOT_FOUND',
      message: 'Student not found.'
    };
  }
  
  // Validate file type
  if (VALID_FILE_TYPES.indexOf(payload.file_type) === -1) {
    throw {
      code: 'ERR_INVALID_FILE_TYPE',
      message: 'Invalid file type. Allowed: ' + VALID_FILE_TYPES.join(', ')
    };
  }
  
  // Validate MIME type
  if (VALID_MIME_TYPES.indexOf(payload.mime_type) === -1) {
    throw {
      code: 'ERR_INVALID_MIME_TYPE',
      message: 'Invalid MIME type. Allowed: ' + VALID_MIME_TYPES.join(', ')
    };
  }
  
  // Calculate size from base64 content
  var sizeInBytes = getBase64SizeInBytes(payload.base64_content);
  if (sizeInBytes > MAX_FILE_SIZE) {
    throw {
      code: 'ERR_FILE_TOO_LARGE',
      message: 'Maximum file size is 2 MB.'
    };
  }
}

/**
 * Calculates actual byte size of base64 content without decoding the entire string.
 * @param {string} base64String
 * @returns {number} Size in bytes.
 */
function getBase64SizeInBytes(base64String) {
  if (!base64String) return 0;
  // Strip any metadata prefix (e.g. data:image/png;base64,) if present
  var base64Data = base64String;
  var commaIndex = base64String.indexOf(',');
  if (commaIndex !== -1) {
    base64Data = base64String.substring(commaIndex + 1);
  }
  
  // Calculate size: base64 len * 3 / 4, subtract padding chars
  var length = base64Data.length;
  var padding = 0;
  if (base64Data.charAt(length - 1) === '=') padding++;
  if (base64Data.charAt(length - 2) === '=') padding++;
  
  return (length * 3 / 4) - padding;
}
