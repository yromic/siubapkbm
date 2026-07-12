/**
 * ImportErrorReportService.gs
 * Formats row errors into an RFC 4180 compliant CSV file and uploads it to Google Drive.
 */

/**
 * Escapes values for CSV formatting.
 * @param {any} val
 * @returns {string} Escaped string
 */
function escapeCsvValue(val) {
  if (val === undefined || val === null) return '';
  var str = String(val);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Generates CSV content from a list of validation errors.
 * @param {Object[]} errors
 * @returns {string} Raw CSV string
 */
function generateErrorReportCsv(errors) {
  var headers = ['row_number', 'field', 'error_code', 'message', 'raw_data'];
  var rows = [headers.join(',')];
  
  errors.forEach(function(err) {
    var line = [
      err.row_number,
      escapeCsvValue(err.field),
      escapeCsvValue(err.error_code),
      escapeCsvValue(err.message),
      escapeCsvValue(err.raw_data)
    ];
    rows.push(line.join(','));
  });
  
  return rows.join('\r\n');
}

/**
 * Creates and stores the CSV error report in the export folder on Google Drive.
 * @param {string} originalFileName
 * @param {Object[]} errors
 * @returns {string} Drive File ID
 */
function createErrorReportFile(originalFileName, errors) {
  var csvString = generateErrorReportCsv(errors);
  var reportFileName = 'error_report_' + originalFileName.replace(/\.csv$/i, '') + '_' + new Date().getTime() + '.csv';
  
  var settings = getAppSettings();
  var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
  var rootFolder = getOrCreateFolder(null, rootName);
  var exportFolder = getOrCreateFolder(rootFolder, 'export');
  
  var blob = Utilities.newBlob(csvString, 'text/csv', reportFileName);
  var file = exportFolder.createFile(blob);
  
  return file.getId();
}
