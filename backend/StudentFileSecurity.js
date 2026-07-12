/**
 * StudentFileSecurity.gs
 * Implements authorization checks and server-side metadata filtering for student documents.
 */

var SENSITIVE_FILE_TYPES = ['kk', 'akta', 'dokumen_lain'];

/**
 * Asserts if an actor is authorized to perform write operations (upload, replace, archive, setup).
 * Guru cannot perform write operations. Only Admin/Administrator can.
 * @param {Object} actor
 */
function assertCanWriteFile(actor) {
  if (actor.role !== ROLES.ADMINISTRATOR && actor.role !== ROLES.ADMIN) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: You do not have permissions to modify student document records.'
    };
  }
}

/**
 * Asserts if an actor is authorized to access a specific student's files.
 * @param {Object} actor
 * @param {string} studentId
 * @param {string} fileType
 */
function assertCanAccessStudentFile(actor, studentId, fileType) {
  // Admin and Administrator can access all student files.
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return;
  }
  
  // Guru check
  if (actor.role === ROLES.TEACHER) {
    // 1. Guru cannot access sensitive file types
    if (SENSITIVE_FILE_TYPES.indexOf(fileType) !== -1) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: Teachers are not authorized to access sensitive documents.'
      };
    }
    
    // 2. Guru can only access if they are assigned as wali kelas for the student in the active period
    if (!isTeacherAssignedToStudent(actor.id, studentId)) {
      throw {
        code: 'ERR_FORBIDDEN',
        message: 'Forbidden: You are not assigned to this student\'s class.'
      };
    }
    
    return;
  }
  
  // Default deny for other roles
  throw {
    code: 'ERR_FORBIDDEN',
    message: 'Forbidden: Access denied.'
  };
}

/**
 * Sanitizes and filters the student file metadata list before returning it to the user.
 * @param {Object[]} files - List of student file records
 * @param {Object} actor
 * @returns {Object[]} Sanitized list of files
 */
function filterStudentFilesForRole(files, actor) {
  if (!files || files.length === 0) return [];
  
  // Admin and Administrator receive everything
  if (actor.role === ROLES.ADMINISTRATOR || actor.role === ROLES.ADMIN) {
    return files;
  }
  
  // Guru: filtering must be strictly server-side
  if (actor.role === ROLES.TEACHER) {
    return files.filter(function(file) {
      // 1. Exclude sensitive file types entirely
      if (SENSITIVE_FILE_TYPES.indexOf(file.file_type) !== -1) {
        return false;
      }
      
      // 2. Exclude files of students the teacher is not assigned to
      if (!isTeacherAssignedToStudent(actor.id, file.student_id)) {
        return false;
      }
      
      return true;
    }).map(function(file) {
      // Return a copy without drive_file_id if necessary, wait, requirement says:
      // "Guru tidak boleh menerima drive_file_id dokumen sensitif & metadata dokumen sensitif."
      // Since sensitive documents are completely excluded above, the non-sensitive files (foto, pas_foto)
      // CAN include their drive_file_id so the teacher can render/access them,
      // but let's make sure we don't expose internal paths. Let's return copy.
      return {
        id: file.id,
        student_id: file.student_id,
        file_type: file.file_type,
        original_filename: file.original_filename,
        mime_type: file.mime_type,
        file_size: file.file_size,
        version: file.version,
        status: file.status,
        uploaded_by: file.uploaded_by,
        uploaded_at: file.uploaded_at,
        created_at: file.created_at,
        updated_at: file.updated_at
      };
    });
  }
  
  return [];
}
