const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("====================================================");
console.log("RUNNING USER UTILITY SEEDER LOCALLY");
console.log("====================================================");

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

// 2. Mock GAS classes (same as mock_runner.js)
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
        headers[this.dbKey] = values[r];
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
    return [new SheetMock('users', this.id)];
  }
  getSheetByName(name) {
    const dbKey = this.id === 'active' ? name : this.id + '_' + name;
    if (!headers[dbKey]) {
      if (this.id !== 'active') return null;
      if (!headers[name]) return null;
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

const CacheMock = {
  put: () => {},
  get: () => null
};

const CacheService = {
  getScriptCache: () => CacheMock
};

const DriveApp = {
  getFileById: (id) => ({
    getBlob: () => ({
      getDataAsString: () => ''
    })
  })
};

const ScriptApp = {
  getProjectTriggers: () => [],
  newTrigger: () => ({
    timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }) })
  })
};

const consoleMock = {
  log: (...args) => console.log('[GAS LOG]', ...args),
  warn: (...args) => console.warn('[GAS WARN]', ...args),
  error: (...args) => console.error('[GAS ERROR]', ...args)
};

// 3. Load all .gs files
const backendDir = __dirname;
const files = fs.readdirSync(backendDir).filter(f => f.endsWith('.gs'));
let concatenatedCode = '';

// Load Config.gs first
const configIdx = files.indexOf('Config.gs');
if (configIdx !== -1) {
  files.splice(configIdx, 1);
  files.unshift('Config.gs');
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
  console: consoleMock,
  Logger: consoleMock,
};

vm.createContext(sandbox);
vm.runInContext(concatenatedCode, sandbox);

// 4. Run the user utility batch creation
try {
  sandbox.runBatchCreateAccounts();
  console.log("\nBatch creation execution inside sandbox succeeded.");
} catch (e) {
  console.error("Batch creation failed to execute:", e);
  process.exit(1);
}

// 5. Serialize sheets state back to db.txt
try {
  let output = '';
  for (const sheetName of Object.keys(sheets)) {
    output += `#${sheetName}\n`;
    if (headers[sheetName]) {
      output += headers[sheetName].join(',') + '\n';
    }
    const dataRows = sheets[sheetName] || [];
    for (const row of dataRows) {
      const escapedRow = row.map(cell => {
        const str = String(cell || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      output += escapedRow.join(',') + '\n';
    }
    output += '\n';
  }
  fs.writeFileSync(dbPath, output, 'utf8');
  console.log("Successfully wrote updated tables back to db.txt!");
} catch (e) {
  console.error("Failed to write sheets back to db.txt:", e);
  process.exit(1);
}
