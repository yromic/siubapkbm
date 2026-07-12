/**
 * UserValidator.gs
 * Validation logic for user accounts (creation, updates, roles, status, password).
 */

/**
 * Validates payload for user creation.
 * @param {Object} payload
 */
function validateUserCreate(payload) {
  payload = payload || {};
  
  // Required fields
  var required = ['name', 'username', 'email', 'password', 'role', 'status'];
  required.forEach(function(field) {
    var val = payload[field];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      throw new Error("Field '" + field + "' is required.");
    }
  });

  // Clean inputs
  var username = String(payload.username).trim();
  var email = String(payload.email).trim().toLowerCase();
  var password = String(payload.password);
  var role = String(payload.role).trim().toLowerCase();
  var status = String(payload.status).trim().toLowerCase();

  // Validate Username: no spaces, reasonable min length (e.g. 3 chars)
  if (username.indexOf(' ') !== -1) {
    throw new Error("Username must not contain spaces.");
  }
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  // Validate Email format
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format.");
  }

  // Validate Password length
  validatePassword(password);

  // Validate Role
  var allowedRoles = [ROLES.ADMINISTRATOR, ROLES.ADMIN, ROLES.TEACHER];
  if (allowedRoles.indexOf(role) === -1) {
    throw new Error("Invalid role. Allowed roles: " + allowedRoles.join(', '));
  }

  // Validate Status
  var allowedStatuses = [STATUS.ACTIVE, STATUS.INACTIVE];
  if (allowedStatuses.indexOf(status) === -1) {
    throw new Error("Invalid status. Allowed statuses: " + allowedStatuses.join(', '));
  }

  // Check Uniqueness: Username and Email
  var existingUser = getUserByIdentifier(username);
  if (existingUser) {
    throw new Error("Username '" + username + "' is already registered.");
  }
  
  var existingEmail = getUserByIdentifier(email);
  if (existingEmail) {
    throw new Error("Email '" + email + "' is already registered.");
  }
}

/**
 * Validates payload for user updates.
 * @param {string} userId
 * @param {Object} payload
 */
function validateUserUpdate(userId, payload) {
  payload = payload || {};
  
  var existingUser = getRecordById(SHEETS.USERS, userId);
  if (!existingUser) {
    throw new Error("User not found with ID: " + userId);
  }

  // Clarification 1: update_user must NOT allow role changes in UM-2.
  if (payload.role && payload.role !== existingUser.role) {
    throw new Error("Role modifications are not allowed after user creation.");
  }

  // Validate Username if provided
  if (payload.username !== undefined && payload.username !== null) {
    var username = String(payload.username).trim();
    if (username === '') {
      throw new Error("Username cannot be empty.");
    }
    if (username.indexOf(' ') !== -1) {
      throw new Error("Username must not contain spaces.");
    }
    if (username.length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }
    
    // Check uniqueness excluding current user
    var dupUser = getUserByIdentifier(username);
    if (dupUser && dupUser.id !== userId) {
      throw new Error("Username '" + username + "' is already registered by another user.");
    }
  }

  // Validate Email if provided
  if (payload.email !== undefined && payload.email !== null) {
    var email = String(payload.email).trim().toLowerCase();
    if (email === '') {
      throw new Error("Email cannot be empty.");
    }
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format.");
    }
    
    // Check uniqueness excluding current user
    var dupEmail = getUserByIdentifier(email);
    if (dupEmail && dupEmail.id !== userId) {
      throw new Error("Email '" + email + "' is already registered by another user.");
    }
  }

  // Validate Status if provided
  if (payload.status !== undefined && payload.status !== null) {
    var status = String(payload.status).trim().toLowerCase();
    var allowedStatuses = [STATUS.ACTIVE, STATUS.INACTIVE];
    if (allowedStatuses.indexOf(status) === -1) {
      throw new Error("Invalid status. Allowed statuses: " + allowedStatuses.join(', '));
    }
  }
}

/**
 * Enforces minimum password requirements.
 * @param {string} password
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}
