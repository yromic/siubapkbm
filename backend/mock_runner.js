const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. Parse db.txt
const dbPath = path.join(__dirname, '..', 'db.txt');
const dbContent = fs.readFileSync(dbPath, 'utf8');

const sheets = {};
const headers = {};

let currentSheet = null;
const lines = dbContent.split(/\r?\n/);
for (let line of lines) {
  line = line.trim();
  if (!line) continue;
  if (line.startsWith('#')) {
    currentSheet = line.substring(1).trim();
    sheets[currentSheet] = [];
    headers[currentSheet] = null;
    continue;
  }
  if (currentSheet) {
    const row = line.split(',').map(cell => {
      if (cell.startsWith('"') && cell.endsWith('"')) {
        return cell.substring(1, cell.length - 1);
      }
      return cell;
    });
    if (!headers[currentSheet]) {
      headers[currentSheet] = row;
    } else {
      sheets[currentSheet].push(row);
    }
  }
}

// 2. Mock GAS classes
class RangeMock {
  constructor(sheetName, row, col, numRows, numCols, ssId) {
    this.sheetName = sheetName;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
    this.ssId = ssId || 'active';
    this.dbKey = this.ssId === 'active' ? sheetName : this.ssId + '_' + sheetName;
  }
  getValues() {
    const sheetData = sheets[this.dbKey] || [];
    const sheetHeaders = headers[this.dbKey] || [];
    const allRows = [sheetHeaders, ...sheetData];
    
    const res = [];
    const startRowIdx = this.row - 1;
    const startColIdx = this.col - 1;
    
    for (let r = 0; r < this.numRows; r++) {
      const rowIdx = startRowIdx + r;
      const rowData = allRows[rowIdx] || [];
      const rowRes = [];
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = startColIdx + c;
        const val = rowData[colIdx];
        rowRes.push(val === undefined || val === null ? '' : val);
      }
      res.push(rowRes);
    }
    return res;
  }
  setValues(values) {
    const sheetData = sheets[this.dbKey] || [];
    const sheetHeaders = headers[this.dbKey] || [];
    const startRowIdx = this.row - 1;
    const startColIdx = this.col - 1;
    
    for (let r = 0; r < values.length; r++) {
      const rowIdx = startRowIdx + r;
      if (rowIdx === 0) {
        if (!headers[this.dbKey]) {
          headers[this.dbKey] = [];
        }
        for (let c = 0; c < values[r].length; c++) {
          headers[this.dbKey][startColIdx + c] = String(values[r][c]);
        }
        continue;
      }
      const dataRowIdx = rowIdx - 1;
      while (sheetData.length <= dataRowIdx) {
        sheetData.push(new Array(sheetHeaders.length).fill(''));
      }
      const rowData = sheetData[dataRowIdx];
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = startColIdx + c;
        rowData[colIdx] = String(values[r][c]);
      }
    }
    return this;
  }
  clearContent() {
    const sheetData = sheets[this.dbKey] || [];
    const startRowIdx = this.row - 1;
    const startColIdx = this.col - 1;
    
    if (startRowIdx + this.numRows >= sheetData.length + 1) {
      if (startRowIdx === 0) {
        if (headers[this.dbKey]) {
          headers[this.dbKey] = new Array(headers[this.dbKey].length).fill('');
        }
        sheetData.length = 0;
      } else {
        sheetData.length = Math.max(0, startRowIdx - 1);
      }
    } else {
      for (let r = 0; r < this.numRows; r++) {
        const rowIdx = startRowIdx + r;
        if (rowIdx === 0) {
          if (headers[this.dbKey]) {
            headers[this.dbKey] = new Array(headers[this.dbKey].length).fill('');
          }
          continue;
        }
        const dataRowIdx = rowIdx - 1;
        if (sheetData[dataRowIdx]) {
          for (let c = 0; c < this.numCols; c++) {
            const colIdx = startColIdx + c;
            sheetData[dataRowIdx][colIdx] = '';
          }
        }
      }
    }
    return this;
  }
  setValue(value) {
    return this.setValues([[value]]);
  }
  setFontWeight() {
    return this;
  }
}

class SheetMock {
  constructor(name, ssId) {
    this.name = name;
    this.ssId = ssId || 'active';
    this.dbKey = this.ssId === 'active' ? name : this.ssId + '_' + name;
  }
  getLastRow() {
    const sheetData = sheets[this.dbKey] || [];
    const sheetHeaders = headers[this.dbKey];
    if (!sheetHeaders) return 0;
    return sheetData.length + 1;
  }
  getLastColumn() {
    const sheetHeaders = headers[this.dbKey] || [];
    return sheetHeaders.length;
  }
  getRange(row, col, numRows, numCols) {
    if (numRows === undefined) numRows = 1;
    if (numCols === undefined) numCols = 1;
    return new RangeMock(this.name, row, col, numRows, numCols, this.ssId);
  }
  appendRow(rowValue) {
    if (!sheets[this.dbKey]) {
      sheets[this.dbKey] = [];
    }
    sheets[this.dbKey].push(rowValue.map(val => val === null || val === undefined ? '' : String(val)));
  }
}

class SpreadsheetMock {
  constructor(id) {
    this.id = id || 'active';
  }
  getId() {
    return this.id;
  }
  getName() {
    return 'mock-spreadsheet-' + this.id;
  }
  getSheets() {
    // Return mock sheets
    return [new SheetMock('users', this.id)];
  }
  getSheetByName(name) {
    const dbKey = this.id === 'active' ? name : this.id + '_' + name;
    if (!headers[dbKey]) {
      if (this.id !== 'active') {
        return null;
      }
      if (!headers[name]) {
        return null;
      }
    }
    return new SheetMock(name, this.id);
  }
  insertSheet(name) {
    const dbKey = this.id === 'active' ? name : this.id + '_' + name;
    if (!sheets[dbKey]) {
      sheets[dbKey] = [];
      headers[dbKey] = (typeof sandbox !== 'undefined' && sandbox.SHEET_HEADERS ? sandbox.SHEET_HEADERS[name] : null) || [];
    }
    return new SheetMock(name, this.id);
  }
}

const SpreadsheetApp = {
  getActiveSpreadsheet: () => new SpreadsheetMock('active'),
  openById: (id) => new SpreadsheetMock(id)
};

const LockMock = {
  waitLock: () => {},
  releaseLock: () => {}
};

const LockService = {
  getScriptLock: () => LockMock
};

const ContentService = {
  MimeType: { JSON: 'JSON' },
  createTextOutput: (text) => {
    const obj = {
      setMimeType: (mime) => obj,
      getContent: () => text
    };
    return obj;
  }
};

const Utilities = {
  formatDate: (date, timeZone, format) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  computeDigest: (algorithm, value, charset) => {
    const crypto = require('crypto');
    const buffer = crypto.createHash('sha256').update(value).digest();
    return Array.from(buffer).map(b => b > 127 ? b - 256 : b);
  },
  DigestAlgorithm: { SHA_256: 'SHA256' },
  Charset: { UTF_8: 'UTF8' },
  base64Encode: (str) => Buffer.from(str).toString('base64'),
  base64Decode: (base64) => Array.from(Buffer.from(base64, 'base64')),
  newBlob: (data, mimeType, name) => {
    const contentString = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    return {
      getBytes: () => typeof data === 'string' ? Array.from(Buffer.from(data)) : data,
      getContentType: () => mimeType,
      getName: () => name,
      getDataAsString: () => contentString
    };
  },
  getUuid: () => {
    const crypto = require('crypto');
    return crypto.randomUUID();
  },
  parseCsv: (csvContent) => {
    return csvContent.split('\n').filter(line => line.trim() !== '').map(line => {
      return line.split(',').map(cell => {
        if (cell.startsWith('"') && cell.endsWith('"')) {
          return cell.substring(1, cell.length - 1);
        }
        return cell;
      });
    });
  }
};

const Session = {
  getScriptTimeZone: () => 'Asia/Jakarta'
};

const cacheStore = {};
const CacheMock = {
  put: (key, value) => { cacheStore[key] = String(value); },
  get: (key) => cacheStore[key] || null,
  remove: (key) => { delete cacheStore[key]; }
};

const CacheService = {
  getScriptCache: () => CacheMock
};

const filesDb = {};

const createMockFile = (id, name, blob) => {
  let trashed = false;
  let access = 'none';
  let permission = 'none';
  return {
    getId: () => id,
    getName: () => name,
    getSize: () => {
      const fileBlob = blob || { getBytes: () => [] };
      return fileBlob.getBytes ? fileBlob.getBytes().length : 0;
    },
    getSharingAccess: () => access,
    getSharingPermission: () => permission,
    setSharing: (acc, perm) => {
      access = acc;
      permission = perm;
    },
    getDownloadUrl: () => 'https://drive.google.com/uc?id=' + id + '&export=download',
    getBlob: () => blob || {
      getDataAsString: () => '{"sheets":{}}'
    },
    setTrashed: (val) => {
      trashed = val;
    },
    isTrashed: () => trashed,
    makeCopy: (copyName, folder) => {
      const copyId = 'mock-file-copy-' + Math.random().toString(36).substring(7);
      const copy = createMockFile(copyId, copyName, blob);
      filesDb[copyId] = copy;
      return copy;
    }
  };
};

const createMockFolder = (name) => ({
  getId: () => 'mock-folder-id',
  getName: () => name,
  getFoldersByName: (subName) => ({
    hasNext: () => true,
    next: () => createMockFolder(subName)
  }),
  createFolder: (subName) => createMockFolder(subName),
  createFile: (blob) => {
    const fileId = 'mock-file-' + Math.random().toString(36).substring(7);
    const mockFile = createMockFile(fileId, blob.getName(), blob);
    filesDb[fileId] = mockFile;
    return mockFile;
  }
});

const DriveApp = {
  Access: {
    PRIVATE: 'PRIVATE',
    ANYONE: 'ANYONE',
    ANYONE_WITH_LINK: 'ANYONE_WITH_LINK'
  },
  Permission: {
    NONE: 'NONE',
    VIEW: 'VIEW',
    EDIT: 'EDIT'
  },
  getFoldersByName: (name) => {
    return {
      hasNext: () => true,
      next: () => createMockFolder(name)
    };
  },
  createFolder: (name) => createMockFolder(name),
  getFileById: (id) => {
    if (filesDb[id]) return filesDb[id];
    const newFile = createMockFile(id, 'mock-file');
    filesDb[id] = newFile;
    return newFile;
  },
  getFolderById: (id) => createMockFolder('mock-folder')
};

const projectTriggers = [];

class TriggerMock {
  constructor(handler) {
    this.handler = handler;
  }
  getHandlerFunction() {
    return this.handler;
  }
  getEventType() {
    return 'CLOCK';
  }
  getTriggerSource() {
    return 'TIME_DRIVEN';
  }
}

class TriggerBuilderMock {
  constructor(handler) {
    this.handler = handler;
  }
  timeBased() {
    return this;
  }
  everyDays() {
    return this;
  }
  atHour() {
    return this;
  }
  create() {
    const trigger = new TriggerMock(this.handler);
    projectTriggers.push(trigger);
    return trigger;
  }
}

const ScriptApp = {
  getProjectTriggers: () => [...projectTriggers],
  newTrigger: (handler) => new TriggerBuilderMock(handler),
  deleteTrigger: (trigger) => {
    const idx = projectTriggers.indexOf(trigger);
    if (idx !== -1) {
      projectTriggers.splice(idx, 1);
    }
  }
};

const consoleMock = {
  log: (...args) => console.log('[GAS LOG]', ...args),
  warn: (...args) => console.warn('[GAS WARN]', ...args),
  error: (...args) => console.error('[GAS ERROR]', ...args)
};

const propertiesStore = { SIUBA_ALLOW_DESTRUCTIVE_TESTS: 'true' };
const PropertiesMock = {
  getProperties: () => ({ ...propertiesStore }),
  getProperty: (key) => propertiesStore[key] || null,
  setProperty: (key, val) => { propertiesStore[key] = String(val); },
  setProperties: (props) => { Object.assign(propertiesStore, props); },
  deleteProperty: (key) => { delete propertiesStore[key]; },
  deleteAllProperties: () => { for (const k in propertiesStore) delete propertiesStore[k]; }
};
const PropertiesService = {
  getScriptProperties: () => PropertiesMock,
  getUserProperties: () => PropertiesMock,
  getDocumentProperties: () => PropertiesMock
};

// 3. Load all .js files
const backendDir = __dirname;
const files = fs.readdirSync(backendDir).filter(f => f.endsWith('.js') && f !== 'mock_runner.js' && f !== 'run_user_utility.js');
let concatenatedCode = '';

// Load Config.js first
const configIdx = files.indexOf('Config.js');
if (configIdx !== -1) {
  files.splice(configIdx, 1);
  files.unshift('Config.js');
}

for (const file of files) {
  concatenatedCode += fs.readFileSync(path.join(backendDir, file), 'utf8') + '\n';
}

const sandbox = {
  SpreadsheetApp,
  LockService,
  ContentService,
  Utilities,
  Session,
  CacheService,
  DriveApp,
  ScriptApp,
  PropertiesService,
  console: consoleMock,
  Logger: consoleMock,
};

vm.createContext(sandbox);
vm.runInContext(concatenatedCode, sandbox);

try {
  sandbox.test_runCultureCompletenessHardeningQA();
  sandbox.test_runSprint115AQA();
  sandbox.test_runSprint11QA();
  sandbox.test_runSprint11HealthIntegrityQA();
  sandbox.test_runSprint11BackupQA();
  sandbox.test_runSprint11DiagnosticsSecurityQA();
  sandbox.test_runSprint115BQA();
  sandbox.test_runSprint116AQA();
  sandbox.test_runSprint116BQA();
  sandbox.test_runSprint116CQA();
  sandbox.test_runPhase4A0QA();
  if (typeof sandbox.test_runSprint8QA === 'function') {
    sandbox.test_runSprint8QA();
  }
  if (typeof sandbox.test_userManagementBackend_UM2 === 'function') {
    sandbox.test_userManagementBackend_UM2();
  }
  if (typeof sandbox.test_runSprint1PeriodSafetyQA === 'function') {
    sandbox.test_runSprint1PeriodSafetyQA();
  }
  if (typeof sandbox.test_runSprint2RolloverWizardQA === 'function') {
    sandbox.test_runSprint2RolloverWizardQA();
  }
  if (typeof sandbox.test_runSprint3PromotionQA === 'function') {
    sandbox.test_runSprint3PromotionQA();
  }
  if (typeof sandbox.test_runLifecycleTestSuite === 'function') {
    sandbox.test_runLifecycleTestSuite();
  }
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
} catch (e) {
  console.error('TEST SUITE FAILED:', e);
  process.exit(1);
}
