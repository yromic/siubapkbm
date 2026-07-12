/**
 * Code.gs
 * Main entry point for Google Apps Script WebApp HTTP endpoints.
 * Handles doGet and doPost and forwards payloads to Router.
 */

/**
 * Handles HTTP GET requests.
 * Useful for health check, debugging, and setups.
 * @param {Object} e - Apps Script event parameter.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health_check';
  var payloadStr = (e && e.parameter && e.parameter.payload) || '{}';
  var token = (e && e.parameter && e.parameter.token) || '';
  
  var payload = {};
  try {
    payload = JSON.parse(payloadStr);
  } catch (err) {
    return errorResponse('INVALID_JSON', 'Payload parameter must be valid JSON string.');
  }
  
  var request = {
    action: action,
    payload: payload,
    token: token
  };
  
  return route(request, e);
}

/**
 * Handles HTTP POST requests.
 * @param {Object} e - Apps Script event parameter.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    var postData = e && e.postData && e.postData.contents;
    if (!postData) {
      return errorResponse('MISSING_BODY', 'Request body is empty.');
    }
    
    var request;
    try {
      request = JSON.parse(postData);
    } catch (parseErr) {
      return errorResponse('INVALID_JSON', 'Request body must be valid JSON.');
    }
    
    return route(request, e);
  } catch (err) {
    return handleError(err);
  }
}
