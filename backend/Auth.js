/**
 * Auth.gs
 * Core authentication and authorization logic, including password hashing,
 * failed login counter, and temporary lockout implementation.
 */

/**
 * authenticates a staff user.
 * @param {string} identifier - Username or Email.
 * @param {string} password - Raw password.
 * @param {Object} requestMeta - Metadata like { ip_address, user_agent }.
 * @returns {Object} Sanitized user object plus raw session token.
 */
function loginStaff(identifier, password, requestMeta) {
  var user = getUserByIdentifier(identifier);
  
  if (!user) {
    safeAudit(function() {
      logLoginFailed(identifier, requestMeta);
    });
    throw new Error("Invalid username, email, or password.");
  }
  
  // Check user status
  if (user.status !== STATUS.ACTIVE) {
    throw new Error("User account is inactive. Please contact the administrator.");
  }
  
  // Check user lockout status
  checkUserLockout(user);
  
  // Verify password
  var isPasswordValid = verifyPassword(password, user.password_hash);
  
  if (!isPasswordValid) {
    var lockResult = incrementFailedLogin(user, requestMeta);
    safeAudit(function() {
      logLoginFailed(identifier, requestMeta);
    });
    if (lockResult.isLocked) {
      safeAudit(function() {
        logLoginLockout(user, requestMeta);
      });
      throw new Error("Account locked due to too many failed attempts. Try again in " + LOCKOUT.DURATION_MINUTES + " minutes.");
    }
    throw new Error("Invalid username, email, or password.");
  }
  
  // Success flow
  resetFailedLogin(user);
  
  // Update last login timestamp
  var systemActor = { id: 'system', name: 'System Auth', role: 'system' };
  user = updateRecord(SHEETS.USERS, user.id, {
    last_login_at: nowIso()
  }, systemActor);
  
  safeAudit(function() {
    logLoginSuccess(user, requestMeta);
  });
  
  var session = createStaffSession(user, requestMeta);
  safeAudit(function() {
    logStaffSessionCreated(user, session, requestMeta);
  });
  
  return {
    user: sanitizeUserForClient(user),
    token: session.token,
    expires_at: session.expires_at
  };
}

/**
 * Hashes a password using SHA-256 with a configured salt prefix.
 * @param {string} password
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function hashPassword(password) {
  var salt = HASH_SALT_PREFIX || "PKBM_SALT_";
  var signature = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password,
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
 * Verifies a raw password against its stored hash.
 * @param {string} password
 * @param {string} passwordHash
 * @returns {boolean}
 */
function verifyPassword(password, passwordHash) {
  return hashPassword(password) === passwordHash;
}

/**
 * Finds a user by their username or email.
 * @param {string} identifier
 * @returns {Object|null}
 */
function getUserByIdentifier(identifier) {
  if (!identifier) return null;
  var identifierLower = identifier.toLowerCase().trim();
  
  var foundUsers = listRecords(SHEETS.USERS, function(user) {
    var usernameMatch = user.username && user.username.toLowerCase() === identifierLower;
    var emailMatch = user.email && user.email.toLowerCase() === identifierLower;
    return usernameMatch || emailMatch;
  });
  
  return foundUsers.length > 0 ? foundUsers[0] : null;
}

/**
 * Increments failed login attempts and locks the user out if threshold is reached.
 * @param {Object} user
 * @param {Object} requestMeta
 * @returns {Object} { attempts: number, isLocked: boolean }
 */
function incrementFailedLogin(user, requestMeta) {
  var attempts = (parseInt(user.failed_login_attempts) || 0) + 1;
  var patch = { failed_login_attempts: attempts };
  var isLocked = false;
  
  if (attempts >= LOCKOUT.MAX_ATTEMPTS) {
    var lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT.DURATION_MINUTES);
    patch.locked_until = lockUntil.toISOString();
    isLocked = true;
  }
  
  var systemActor = { id: 'system', name: 'System Auth', role: 'system' };
  updateRecord(SHEETS.USERS, user.id, patch, systemActor);
  
  return { attempts: attempts, isLocked: isLocked };
}

/**
 * Resets failed login counters on successful login.
 * @param {Object} user
 */
function resetFailedLogin(user) {
  if ((user.failed_login_attempts && user.failed_login_attempts > 0) || user.locked_until) {
    var systemActor = { id: 'system', name: 'System Auth', role: 'system' };
    updateRecord(SHEETS.USERS, user.id, {
      failed_login_attempts: 0,
      locked_until: ''
    }, systemActor);
  }
}

/**
 * Validates if the user is currently locked out. Throws error if locked out.
 * @param {Object} user
 */
function checkUserLockout(user) {
  if (user.locked_until) {
    var lockedUntilDate = new Date(user.locked_until);
    var now = new Date();
    if (now < lockedUntilDate) {
      var remainingMs = lockedUntilDate.getTime() - now.getTime();
      var remainingMins = Math.ceil(remainingMs / 60000);
      throw new Error("Account is temporarily locked. Try again in " + remainingMins + " minutes.");
    }
  }
}

/**
 * Sanitizes user record by removing sensitive fields like password_hash.
 * @param {Object} user
 * @returns {Object}
 */
function sanitizeUserForClient(user) {
  if (!user) return null;
  var copy = JSON.parse(JSON.stringify(user));
  delete copy.password_hash;
  return copy;
}

function generateStaffSessionToken() {
  var parts = [];
  for (var i = 0; i < 4; i++) {
    parts.push(Utilities.getUuid());
  }
  parts.push(String(new Date().getTime()));
  return parts.join('.');
}

function hashStaffSessionToken(token) {
  var signature = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    'PKBM_SESSION_' + HASH_SALT_PREFIX + String(token || ''),
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

function createStaffSession(user, requestMeta) {
  requestMeta = requestMeta || {};
  ensureSheetHeaders(SHEETS.STAFF_SESSIONS, SHEET_HEADERS[SHEETS.STAFF_SESSIONS]);
  
  var rawToken = generateStaffSessionToken();
  var issuedAt = nowIso();
  var expiresAtDate = new Date();
  expiresAtDate.setHours(expiresAtDate.getHours() + STAFF_SESSION_TTL_HOURS);
  var expiresAt = expiresAtDate.toISOString();
  
  var sessionRecord = appendRow(SHEETS.STAFF_SESSIONS, {
    user_id: user.id,
    token_hash: hashStaffSessionToken(rawToken),
    issued_at: issuedAt,
    expires_at: expiresAt,
    revoked_at: '',
    last_seen_at: issuedAt,
    ip_address: requestMeta.ip_address || '',
    user_agent: requestMeta.user_agent || ''
  });
  
  return {
    id: sessionRecord.id,
    token: rawToken,
    expires_at: expiresAt
  };
}

function resolveStaffSessionToken(rawToken, requestMeta) {
  requestMeta = requestMeta || {};
  if (!rawToken) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Authentication failed: session token is required.'
    };
  }
  
  var tokenHash = hashStaffSessionToken(rawToken);
  var sessions = listRecords(SHEETS.STAFF_SESSIONS, function(session) {
    return session.token_hash === tokenHash;
  });
  
  if (sessions.length === 0) {
    safeAudit(function() {
      logStaffSessionRejected('invalid_token', requestMeta);
    });
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Authentication failed: invalid or expired session token.'
    };
  }
  
  var session = sessions[0];
  if (session.revoked_at) {
    safeAudit(function() {
      logStaffSessionRejected('revoked_token', requestMeta);
    });
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Authentication failed: invalid or expired session token.'
    };
  }
  
  if (!session.expires_at || new Date(session.expires_at).getTime() <= new Date().getTime()) {
    safeAudit(function() {
      logStaffSessionRejected('expired_token', requestMeta);
    });
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Authentication failed: invalid or expired session token.'
    };
  }
  
  var actor = getRecordById(SHEETS.USERS, session.user_id);
  if (!actor || actor.status !== STATUS.ACTIVE) {
    safeAudit(function() {
      logStaffSessionRejected('inactive_user', requestMeta);
    });
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Authentication failed: user account is inactive or missing.'
    };
  }
  
  updateRowById(SHEETS.STAFF_SESSIONS, session.id, { last_seen_at: nowIso() });
  return {
    actor: actor,
    session: session
  };
}

function revokeStaffSessionToken(rawToken, actor, requestMeta) {
  requestMeta = requestMeta || {};
  var resolved = resolveStaffSessionToken(rawToken, requestMeta);
  var session = resolved.session;
  updateRowById(SHEETS.STAFF_SESSIONS, session.id, { revoked_at: nowIso() });
  safeAudit(function() {
    writeAuditLog({
      user_id: actor ? actor.id : resolved.actor.id,
      user_name: actor ? actor.name : resolved.actor.name,
      user_role: actor ? actor.role : resolved.actor.role,
      action: 'logout',
      entity_type: SHEETS.STAFF_SESSIONS,
      entity_id: session.id,
      old_value: '',
      new_value: '',
      description: 'Staff session revoked.',
      ip_address: requestMeta.ip_address || '',
      user_agent: requestMeta.user_agent || ''
    });
  });
  return { revoked: true };
}

function logStaffSessionCreated(user, session, meta) {
  meta = meta || {};
  writeAuditLog({
    user_id: user.id || '',
    user_name: user.name || '',
    user_role: user.role || '',
    action: 'staff_session_created',
    entity_type: SHEETS.STAFF_SESSIONS,
    entity_id: session.id || '',
    old_value: '',
    new_value: JSON.stringify({ expires_at: session.expires_at }),
    description: 'Staff session token issued.',
    ip_address: meta.ip_address || '',
    user_agent: meta.user_agent || ''
  });
}

function logStaffSessionRejected(reason, meta) {
  meta = meta || {};
  writeAuditLog({
    user_id: '',
    user_name: '',
    user_role: '',
    action: 'staff_session_rejected',
    entity_type: SHEETS.STAFF_SESSIONS,
    entity_id: '',
    old_value: '',
    new_value: JSON.stringify({ reason: reason }),
    description: 'Staff session token rejected: ' + reason,
    ip_address: meta.ip_address || '',
    user_agent: meta.user_agent || ''
  });
}
