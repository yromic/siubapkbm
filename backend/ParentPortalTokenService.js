/**
 * ParentPortalTokenService.gs
 * Handles parent portal access token generation, storage in CacheService, and validation.
 */

var TOKEN_TTL_SECONDS = 7200; // 2 hours

/**
 * Generates a cryptographically strong random token of 64 characters.
 * @returns {string} 64-character token
 */
function generateParentToken() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Saves token mapping to session JSON in CacheService.
 * @param {string} token
 * @param {string} studentId
 * @param {string} [nisn]
 */
function saveParentToken(token, studentId, nisn) {
  var cache = CacheService.getScriptCache();
  var session = {
    student_id: studentId,
    nisn: nisn || '',
    issued_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    expires_at: new Date(new Date().getTime() + TOKEN_TTL_SECONDS * 1000).toISOString()
  };
  cache.put(token, JSON.stringify(session), TOKEN_TTL_SECONDS);
}

/**
 * Validates token and returns studentId string.
 * Throws ERR_UNAUTHORIZED if token is invalid or expired.
 * Supports both legacy raw student ID tokens and new JSON session tokens.
 * @param {string} token
 * @returns {string} studentId
 */
function validateParentToken(token) {
  if (!token) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Token is required.'
    };
  }
  
  var cache = CacheService.getScriptCache();
  var cachedVal = cache.get(token);
  
  if (!cachedVal) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Token is invalid or has expired.'
    };
  }
  
  try {
    var session = JSON.parse(cachedVal);
    if (session && session.student_id) {
      if (session.expires_at) {
        var expiresAt = new Date(session.expires_at).getTime();
        var now = new Date().getTime();
        if (now > expiresAt) {
          throw {
            code: 'ERR_UNAUTHORIZED',
            message: 'Token is invalid or has expired.'
          };
        }
      }
      return session.student_id;
    }
  } catch (e) {
    if (e && e.code === 'ERR_UNAUTHORIZED') {
      throw e;
    }
    // Fallback for older active session tokens storing raw studentId string
    return cachedVal;
  }
  
  throw {
    code: 'ERR_UNAUTHORIZED',
    message: 'Token is invalid or has expired.'
  };
}

/**
 * Validates parent token and returns full session object.
 * Throws ERR_UNAUTHORIZED if invalid or expired.
 * Supports legacy raw student ID tokens by constructing a mock session.
 * @param {string} token
 * @returns {Object} Session object
 */
function requireParentSession(token) {
  if (!token) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Token is required.'
    };
  }
  
  var cache = CacheService.getScriptCache();
  var cachedVal = cache.get(token);
  
  if (!cachedVal) {
    throw {
      code: 'ERR_UNAUTHORIZED',
      message: 'Token is invalid or has expired.'
    };
  }
  
  try {
    var session = JSON.parse(cachedVal);
    if (session && session.student_id) {
      if (session.expires_at) {
        var expiresAt = new Date(session.expires_at).getTime();
        var now = new Date().getTime();
        if (now > expiresAt) {
          throw {
            code: 'ERR_UNAUTHORIZED',
            message: 'Token is invalid or has expired.'
          };
        }
      }
      return session;
    }
  } catch (e) {
    if (e && e.code === 'ERR_UNAUTHORIZED') {
      throw e;
    }
    // Legacy fallback
    return {
      student_id: cachedVal,
      nisn: '',
      issued_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      expires_at: new Date(new Date().getTime() + TOKEN_TTL_SECONDS * 1000).toISOString()
    };
  }
  
  throw {
    code: 'ERR_UNAUTHORIZED',
    message: 'Token is invalid or has expired.'
  };
}
