/**
 * UserService.gs
 * Core service layer for User Management operations.
 * Implements business logic, security guards, and synchronization with teacher profiles.
 */

/**
 * Asserts that the actor holds the Administrator role.
 * @param {Object} actor
 */
function assertAdministratorRole(actor) {
  if (!actor || actor.role !== ROLES.ADMINISTRATOR) {
    throw {
      code: 'ERR_FORBIDDEN',
      message: 'Forbidden: This action requires the Administrator role.'
    };
  }
}

/**
 * Sanitizes a user object to prevent leaking sensitive fields to the client.
 * @param {Object} user
 * @returns {Object} Sanitized copy of the user.
 */
function sanitizeUserResponse(user) {
  if (!user) return null;
  var copy = JSON.parse(JSON.stringify(user));
  delete copy.password_hash;
  delete copy.failed_login_attempts;
  delete copy.locked_until;
  delete copy.token;
  delete copy.token_hash;
  return copy;
}

/**
 * Counts the total number of active administrator accounts in the system.
 * @returns {number}
 */
function countActiveAdministrators() {
  var admins = listRecords(SHEETS.USERS, function(u) {
    return u.role === ROLES.ADMINISTRATOR && u.status === STATUS.ACTIVE;
  });
  return admins.length;
}

/**
 * Retrieves a list of users, matching optional filters.
 * Embeds the teacher profile if the user's role is 'teacher'.
 * 
 * @param {Object} actor - The authenticated actor.
 * @param {Object} [filters] - Optional filter options.
 * @returns {Object[]} Sanitized list of users.
 */
function listUsers(actor, filters) {
  assertAdministratorRole(actor);
  filters = filters || {};
  
  var users = listRecords(SHEETS.USERS);
  var filtered = filterLifecycle(users, filters);
  
  if (filters.role) {
    filtered = filtered.filter(function(u) { return u.role === filters.role; });
  }
  
  return filtered.map(function(user) {
    var sanitized = sanitizeUserResponse(user);
    if (user.role === ROLES.TEACHER) {
      var profiles = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
        return p.user_id === user.id;
      });
      sanitized.teacher_profile = profiles.length > 0 ? profiles[0] : null;
    }
    return sanitized;
  });
}

/**
 * Creates a new staff user. Automatically creates a teacher profile if role is 'teacher'.
 * 
 * @param {Object} actor
 * @param {Object} payload
 * @returns {Object} Sanitized created user.
 */
function createUser(actor, payload) {
  assertAdministratorRole(actor);
  validateUserCreate(payload);
  
  var newUser = {
    name: String(payload.name).trim(),
    email: String(payload.email).trim().toLowerCase(),
    username: String(payload.username).trim().toLowerCase(),
    password_hash: hashPassword(payload.password),
    role: String(payload.role).trim().toLowerCase(),
    phone: payload.phone ? String(payload.phone).trim() : '',
    status: String(payload.status).trim().toLowerCase(),
    failed_login_attempts: 0,
    locked_until: '',
    last_login_at: ''
  };
  
  var userRecord = createRecord(SHEETS.USERS, newUser, actor);
  var sanitized = sanitizeUserResponse(userRecord);
  
  // Specialized audit log for creation
  safeAudit(function() {
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'create_user',
      entity_type: SHEETS.USERS,
      entity_id: userRecord.id,
      old_value: '',
      new_value: JSON.stringify(sanitized),
      description: "Created user: " + userRecord.username + " with role: " + userRecord.role
    });
  });
  
  // If role is teacher, automatically instantiate teacher profile
  if (userRecord.role === ROLES.TEACHER) {
    var profileData = {
      user_id: userRecord.id,
      full_name: userRecord.name,
      gender: payload.gender ? String(payload.gender).trim() : '',
      phone: userRecord.phone || '',
      address: payload.address ? String(payload.address).trim() : '',
      nip: payload.nip ? String(payload.nip).trim() : '',
      nuptk: payload.nuptk ? String(payload.nuptk).trim() : '',
      position: payload.position ? String(payload.position).trim() : 'Guru',
      status: STATUS.ACTIVE
    };
    
    var profileRecord = createRecord(SHEETS.TEACHER_PROFILES, profileData, actor);
    sanitized.teacher_profile = profileRecord;
  }
  
  return sanitized;
}

/**
 * Updates user account data. Syncs details to the teacher profile if applicable.
 * 
 * @param {Object} actor
 * @param {string} userId
 * @param {Object} payload
 * @returns {Object} Sanitized updated user.
 */
function updateUser(actor, userId, payload) {
  assertAdministratorRole(actor);
  validateUserUpdate(userId, payload);
  
  var existingUser = assertRecordExists(SHEETS.USERS, userId);
  
  // Self-Modification Protection: user cannot change their own role or status
  if (userId === actor.id) {
    if (payload.status && payload.status !== existingUser.status) {
      throw new Error("Self-deactivation is not allowed. Please use the status endpoint.");
    }
  }

  // Last Active Administrator Protection
  if (existingUser.role === ROLES.ADMINISTRATOR && existingUser.status === STATUS.ACTIVE) {
    if (payload.status === STATUS.INACTIVE && countActiveAdministrators() <= 1) {
      throw new Error("Cannot deactivate the last active Administrator account.");
    }
  }
  
  var patch = {};
  if (payload.name !== undefined) patch.name = String(payload.name).trim();
  if (payload.email !== undefined) patch.email = String(payload.email).trim().toLowerCase();
  if (payload.username !== undefined) patch.username = String(payload.username).trim().toLowerCase();
  if (payload.phone !== undefined) patch.phone = payload.phone ? String(payload.phone).trim() : '';
  if (payload.status !== undefined) patch.status = String(payload.status).trim().toLowerCase();
  
  var oldSanitized = sanitizeUserResponse(existingUser);
  var updatedUser = updateRecord(SHEETS.USERS, userId, patch, actor);
  var sanitized = sanitizeUserResponse(updatedUser);
  
  // Specialized audit log for update
  safeAudit(function() {
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'update_user',
      entity_type: SHEETS.USERS,
      entity_id: userId,
      old_value: JSON.stringify(oldSanitized),
      new_value: JSON.stringify(sanitized),
      description: "Updated user details for: " + updatedUser.username
    });
  });
  
  // Sync to teacher profile if role is teacher
  if (updatedUser.role === ROLES.TEACHER) {
    var profiles = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
      return p.user_id === userId;
    });
    
    if (profiles.length > 0) {
      var profile = profiles[0];
      var profilePatch = {};
      
      // Auto sync values from user
      if (payload.name !== undefined) profilePatch.full_name = String(payload.name).trim();
      if (payload.phone !== undefined) profilePatch.phone = payload.phone ? String(payload.phone).trim() : '';
      if (payload.status !== undefined) profilePatch.status = String(payload.status).trim().toLowerCase();
      
      // Update explicit profile fields if provided in payload
      if (payload.gender !== undefined) profilePatch.gender = String(payload.gender).trim();
      if (payload.address !== undefined) profilePatch.address = String(payload.address).trim();
      if (payload.nip !== undefined) profilePatch.nip = String(payload.nip).trim();
      if (payload.nuptk !== undefined) profilePatch.nuptk = String(payload.nuptk).trim();
      if (payload.position !== undefined) profilePatch.position = String(payload.position).trim();
      
      var updatedProfile = updateRecord(SHEETS.TEACHER_PROFILES, profile.id, profilePatch, actor);
      sanitized.teacher_profile = updatedProfile;
    }
  }
  
  return sanitized;
}

/**
 * Resets another user's password. Unlocks the user and clears login failures.
 * 
 * @param {Object} actor
 * @param {string} userId
 * @param {string} newPassword
 * @returns {Object} Sanitized user record.
 */
function resetUserPassword(actor, userId, newPassword) {
  assertAdministratorRole(actor);
  assertRecordExists(SHEETS.USERS, userId);
  validatePassword(newPassword);
  
  // Self-Modification Protection: User cannot reset their own password via reset_user_password
  if (userId === actor.id) {
    throw new Error("You cannot reset your own password via this action. Please use change_own_password.");
  }
  
  var patch = {
    password_hash: hashPassword(newPassword),
    failed_login_attempts: 0,
    locked_until: ''
  };
  
  var updatedUser = updateRecord(SHEETS.USERS, userId, patch, actor);
  var sanitized = sanitizeUserResponse(updatedUser);
  
  // Specialized audit log (ensure no password or hash is logged)
  safeAudit(function() {
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'reset_password',
      entity_type: SHEETS.USERS,
      entity_id: userId,
      old_value: '',
      new_value: '',
      description: "Reset password for user: " + updatedUser.username
    });
  });
  
  return sanitized;
}

/**
 * Activates or deactivates a user. Syncs status to the teacher profile if teacher.
 * 
 * @param {Object} actor
 * @param {string} userId
 * @param {string} status - 'active' or 'inactive'
 * @returns {Object} Sanitized user record.
 */
function setUserStatus(actor, userId, status) {
  assertAdministratorRole(actor);
  status = String(status).trim().toLowerCase();
  
  if (status !== STATUS.ACTIVE && status !== STATUS.INACTIVE) {
    throw new Error("Invalid status. Allowed statuses: active, inactive");
  }
  
  var existingUser = assertRecordExists(SHEETS.USERS, userId);
  
  // Self-Deactivation Protection: user cannot deactivate themselves
  if (userId === actor.id && status === STATUS.INACTIVE) {
    throw new Error("Self-deactivation is not allowed.");
  }
  
  // Last Active Administrator Protection
  if (existingUser.role === ROLES.ADMINISTRATOR && existingUser.status === STATUS.ACTIVE) {
    if (status === STATUS.INACTIVE && countActiveAdministrators() <= 1) {
      throw new Error("Cannot deactivate the last active Administrator account.");
    }
  }
  
  var oldSanitized = sanitizeUserResponse(existingUser);
  var updatedUser = updateRecord(SHEETS.USERS, userId, { status: status }, actor);
  var sanitized = sanitizeUserResponse(updatedUser);
  
  // Specialized audit log
  safeAudit(function() {
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'change_user_status',
      entity_type: SHEETS.USERS,
      entity_id: userId,
      old_value: JSON.stringify(oldSanitized),
      new_value: JSON.stringify(sanitized),
      description: "Changed status of user: " + updatedUser.username + " to: " + status
    });
  });
  
  // If role is teacher, automatically sync status to teacher profile
  if (updatedUser.role === ROLES.TEACHER) {
    var profiles = listRecords(SHEETS.TEACHER_PROFILES, function(p) {
      return p.user_id === userId;
    });
    
    if (profiles.length > 0) {
      var profile = profiles[0];
      var updatedProfile = updateRecord(SHEETS.TEACHER_PROFILES, profile.id, { status: status }, actor);
      sanitized.teacher_profile = updatedProfile;
    }
  }
  
  return sanitized;
}

/**
 * Changes own password. Requires verifying old password.
 * 
 * @param {Object} actor - Authenticated staff actor.
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Object} Sanitized user record.
 */
function changeOwnPassword(actor, oldPassword, newPassword) {
  if (!actor) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Authentication required.'
    };
  }
  
  // Verify old password
  var isOldValid = verifyPassword(oldPassword, actor.password_hash);
  if (!isOldValid) {
    throw new Error("Incorrect current password.");
  }
  
  validatePassword(newPassword);
  
  var patch = {
    password_hash: hashPassword(newPassword),
    failed_login_attempts: 0,
    locked_until: ''
  };
  
  var updatedUser = updateRecord(SHEETS.USERS, actor.id, patch, actor);
  var sanitized = sanitizeUserResponse(updatedUser);
  
  // Specialized audit log
  safeAudit(function() {
    writeAuditLog({
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      action: 'change_own_password',
      entity_type: SHEETS.USERS,
      entity_id: actor.id,
      old_value: '',
      new_value: '',
      description: "User " + actor.username + " changed their own password successfully"
    });
  });
  
  return sanitized;
}
