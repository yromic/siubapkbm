/**
 * SheetService.gs
 * Low-level utility functions to interact with Google Sheets.
 */

/**
 * Gets the active spreadsheet instance.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getActiveSpreadsheet() {
  if (typeof MAIN_SPREADSHEET_ID !== 'undefined' && MAIN_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    } catch (e) {
      // Fallback if ID is invalid or inaccessible
      console.warn("Failed to open MAIN_SPREADSHEET_ID, falling back to active spreadsheet: " + e.message);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Gets a sheet by name or creates it with headers if it does not exist.
 * @param {string} name - Name of the sheet.
 * @param {string[]} headers - Columns header list.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheetByNameOrCreate(name, headers) {
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  }
  return sheet;
}

/**
 * Ensures a sheet has the correct headers without destroying existing data.
 * If sheet exists but has no headers, it writes headers in line 1.
 * @param {string} sheetName
 * @param {string[]} headers
 */
function ensureSheetHeaders(sheetName, headers) {
  var sheet = getSheetByNameOrCreate(sheetName, headers);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  } else {
    // Validate if current headers match expected headers
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var missing = [];
    headers.forEach(function(h) {
      if (currentHeaders.indexOf(h) === -1) {
        missing.push(h);
      }
    });
    if (missing.length > 0) {
      // Append missing headers to the end
      var nextCol = lastCol + 1;
      var newHeadersRange = sheet.getRange(1, nextCol, 1, missing.length);
      newHeadersRange.setValues([missing]).setFontWeight('bold');
    }
  }
}

/**
 * Reads all rows from a sheet as an array of objects.
 * @param {string} sheetName
 * @returns {Object[]}
 */
function readRows(sheetName) {
  var sheet = getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return []; // Empty or only has header
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var values = dataRange.getValues();
  
  return values.map(function(row) {
    return rowToObject(headers, row);
  });
}

/**
 * Appends a new record to a sheet.
 * @param {string} sheetName
 * @param {Object} object - Data to write.
 * @returns {Object} The written object with timestamps and id if not provided.
 */
function appendRow(sheetName, object) {
  var headers = SHEET_HEADERS[sheetName];
  if (!headers) throw new Error("Header definition for sheet '" + sheetName + "' is not defined in Config.");
  
  var sheet = getSheetByNameOrCreate(sheetName, headers);
  
  var now = nowIso();
  if (!object.id) {
    object.id = generateId(sheetName.substring(0, 3).toUpperCase());
  }
  if (!object.created_at) {
    object.created_at = now;
  }
  object.updated_at = now;
  
  var rowData = objectToRow(headers, object);
  sheet.appendRow(rowData);
  
  return object;
}

/**
 * Updates an existing row by ID.
 * @param {string} sheetName
 * @param {string} id
 * @param {Object} patch
 * @returns {Object|null} The updated object or null if not found.
 */
function updateRowById(sheetName, id, patch) {
  var sheet = getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return null;
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return null;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return r[0]; });
  
  var index = ids.indexOf(id);
  if (index === -1) return null;
  
  var rowIndex = index + 2; // 1-indexed, skipping header
  var currentRowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  var currentObj = rowToObject(headers, currentRowValues);
  
  // Merge patch
  for (var key in patch) {
    if (key !== 'id' && key !== 'created_at') { // Protect read-only columns
      currentObj[key] = patch[key];
    }
  }
  currentObj.updated_at = nowIso();
  
  var updatedRowValues = objectToRow(headers, currentObj);
  sheet.getRange(rowIndex, 1, 1, lastCol).setValues([updatedRowValues]);
  
  return currentObj;
}

/**
 * Finds a row by its ID.
 * @param {string} sheetName
 * @param {string} id
 * @returns {Object|null}
 */
function findRowById(sheetName, id) {
  var sheet = getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return null;
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return null;
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return r[0]; });
  
  var index = ids.indexOf(id);
  if (index === -1) return null;
  
  var rowValue = sheet.getRange(index + 2, 1, 1, lastCol).getValues()[0];
  return rowToObject(headers, rowValue);
}

/**
 * Finds rows matching a predicate.
 * @param {string} sheetName
 * @param {Function} predicate
 * @returns {Object[]}
 */
function findRows(sheetName, predicate) {
  var rows = readRows(sheetName);
  return rows.filter(predicate);
}

/**
 * Converts headers and object to a flat row array matching headers ordering.
 * @param {string[]} headers
 * @param {Object} object
 * @returns {any[]}
 */
function objectToRow(headers, object) {
  return headers.map(function(header) {
    var val = object[header];
    if (val instanceof Date) {
      if (header.indexOf('date') !== -1 || header.indexOf('effective_') !== -1) {
        return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      return val.toISOString();
    }
    return val === undefined || val === null ? '' : val;
  });
}

/**
 * Converts a flat row array to an object using headers.
 * @param {string[]} headers
 * @param {any[]} row
 * @returns {Object}
 */
function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function(header, idx) {
    var val = row[idx];
    if (val instanceof Date) {
      if (header.indexOf('date') !== -1 || header.indexOf('effective_') !== -1) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        val = val.toISOString();
      }
    }
    obj[header] = val === '' ? null : val;
  });
  return obj;
}

/**
 * Generates ISO 8601 string of current local time.
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Generates a unique ID with a prefix and timestamp/random parts.
 * @param {string} prefix
 * @returns {string}
 */
function generateId(prefix) {
  var timestamp = new Date().getTime();
  var random = Math.floor(Math.random() * 10000);
  return (prefix ? prefix + '_' : '') + timestamp + '_' + random;
}

/**
 * Deletes a row physically from the sheet by ID.
 * @param {string} sheetName
 * @param {string} id
 * @returns {boolean}
 */
function deleteRowById(sheetName, id) {
  var sheet = getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return r[0]; });
  var index = ids.indexOf(id);
  if (index === -1) return false;
  
  sheet.deleteRow(index + 2);
  return true;
}
