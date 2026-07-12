/**
 * StudentFileDriveService.gs
 * Handles all Google Drive folder lookup, creation, and file uploads.
 */

/**
 * Gets or creates a folder inside a parent folder.
 * @param {GoogleAppsScript.Drive.Folder} [parent] - Parent folder, if null search at root
 * @param {string} name - Name of folder
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateFolder(parent, name) {
  var folderIterator = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (folderIterator.hasNext()) {
    return folderIterator.next();
  }
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

/**
 * Ensures storage root and basic folder structure exists.
 * @returns {string} Root folder ID.
 */
function getOrCreateStorageRoot() {
  var settings = getAppSettings();
  var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
  
  // Get/Create Root Folder
  var rootFolder = getOrCreateFolder(null, rootName);
  
  // Store back to settings if not exists or different
  if (!settings.PKBM_STORAGE_ROOT) {
    updateSingleSetting('PKBM_STORAGE_ROOT', rootFolder.getName());
  }
  
  return rootFolder.getId();
}

/**
 * Resolves the Google Drive folder for a specific student and file type.
 * Structure: ROOT/siswa/{student_id}/{file_type}
 * @param {string} studentId
 * @param {string} fileType
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getStudentFolder(studentId, fileType) {
  var settings = getAppSettings();
  var rootName = settings.PKBM_STORAGE_ROOT || 'PKBM_STORAGE_ROOT';
  var rootFolder = getOrCreateFolder(null, rootName);
  
  var siswaFolder = getOrCreateFolder(rootFolder, 'siswa');
  var studentFolder = getOrCreateFolder(siswaFolder, studentId);
  var typeFolder = getOrCreateFolder(studentFolder, fileType);
  
  return typeFolder;
}

/**
 * Saves a file to Google Drive under the student's designated folder.
 * Sharing is NOT changed to public (it remains private by default).
 * @param {string} studentId
 * @param {string} fileType
 * @param {string} fileName
 * @param {string} mimeType
 * @param {string} base64Content
 * @returns {string} Drive File ID.
 */
function saveFileToDrive(studentId, fileType, fileName, mimeType, base64Content) {
  var folder = getStudentFolder(studentId, fileType);
  var decodedBytes = Utilities.base64Decode(base64Content);
  var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
  var file = folder.createFile(blob);
  
  // Ensure the file is not shared publicly (anyone-with-link is disabled by default in GAS when using createFile)
  return file.getId();
}
