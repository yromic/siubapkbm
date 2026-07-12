/**
 * ImportParser.gs
 * Handles CSV parsing using Google Apps Script's built-in Utilities.parseCsv.
 */

/**
 * Parses a raw CSV content string into a list of row objects.
 * Normalized headers to lowercase snake_case keys.
 * @param {string} csvContent
 * @returns {Object[]}
 */
function parseCsvToObject(csvContent) {
  if (!csvContent) return [];
  
  var lines;
  try {
    lines = Utilities.parseCsv(String(csvContent).trim());
  } catch (err) {
    throw new Error("Failed to parse CSV: Invalid CSV format.");
  }
  
  if (lines.length <= 1) return [];
  
  // Normalize headers (BOM-safe, lowercase, trimmed, snake_case)
  var headers = lines[0].map(function(h, idx) {
    return normalizeImportHeader(h, idx);
  });
  
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i];
    
    // Check if row is empty
    var isEmpty = line.every(function(cell) {
      return String(cell).trim() === '';
    });
    if (isEmpty) continue;
    
    var rowObj = {};
    headers.forEach(function(header, idx) {
      rowObj[header] = line[idx] !== undefined ? String(line[idx]).trim() : '';
    });
    
    // Keep 1-based line number for error reporting
    rowObj._rowNumber = i + 1;
    rows.push(rowObj);
  }
  
  return rows;
}

function normalizeImportHeader(header, index) {
  var normalized = String(header || '');
  if (index === 0) {
    normalized = normalized.replace(/^\uFEFF/, '');
  }
  
  return normalized
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
