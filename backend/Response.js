/**
 * Response.gs
 * Standardized API response format helpers for the web app client.
 */

/**
 * Returns a standard success response.
 * @param {Object} data - Payload data.
 * @param {string} [message] - Success message.
 * @returns {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function successResponse(data, message) {
  var responsePayload = {
    status: 'success',
    message: message || 'Operation completed successfully.',
    data: data || {}
  };
  
  return ContentService.createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns a standard error response.
 * @param {string} code - Machine-readable error code.
 * @param {string} message - User-friendly error message.
 * @param {Object} [details] - Detailed error context.
 * @returns {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function errorResponse(code, message, details) {
  var responsePayload = {
    status: 'error',
    code: code || 'INTERNAL_ERROR',
    message: message || 'An unexpected error occurred.',
    details: details || {}
  };
  
  return ContentService.createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Global error handler to catch exceptions, log them internally, and return sanitized errors.
 * @param {Error|Object|string} error
 * @returns {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function handleError(error) {
  var errorCode = 'BAD_REQUEST';
  var errorMessage = error;
  var errorDetails = {};
  
  if (error && typeof error === 'object' && error.code) {
    errorCode = error.code;
    errorMessage = error.message;
    if (error.details) {
      errorDetails = error.details;
    } else if (error.locked_until) {
      errorDetails = { locked_until: error.locked_until };
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    console.error("API Error: " + error.message + "\nStack: " + error.stack);
  } else {
    console.error("API Error: " + error);
  }
  
  return errorResponse(errorCode, errorMessage, errorDetails);
}
