import fs from 'fs';
import path from 'path';

const standaloneDir = path.join(process.cwd(), '.next', 'standalone');

console.log('=== Deep Post-Build Artifact Audit ===');

// 1. Files & Structure
const checks = [
  'server.js',
  'knexfile.ts',
  'siuba_db_schema.sql',
  path.join('.next', 'static'),
  path.join('.next', 'server'),
  'public',
  path.join('database', 'migrations'),
];

console.log('\n1. Verifying Required Files & Directories:');
for (const rel of checks) {
  const p = path.join(standaloneDir, rel);
  const exists = fs.existsSync(p);
  console.log(`   [${exists ? 'PASS' : 'FAIL'}] ${rel}`);
}

// 2. Scan for forbidden native binaries (Sharp / Windows native)
console.log('\n2. Checking for Windows-specific native binaries:');
let hasWinNative = false;
function checkBinaries(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (item === '@img' || item.includes('win32') || item.includes('sharp-win32')) {
        console.log(`   [FAIL] Found Windows native package: ${full}`);
        hasWinNative = true;
      }
      checkBinaries(full);
    }
  }
}
checkBinaries(standaloneDir);
if (!hasWinNative) {
  console.log('   [PASS] Zero Windows native binaries found in standalone.');
}

// 3. Scan for forbidden environment files (.env*)
console.log('\n3. Checking for .env files:');
let hasEnv = false;
function scanEnv(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      scanEnv(full);
    } else if (item.startsWith('.env') && item !== '.env.example') {
      console.log(`   [FAIL] Found forbidden file: ${full}`);
      hasEnv = true;
    }
  }
}
scanEnv(standaloneDir);
if (!hasEnv) {
  console.log('   [PASS] Zero .env files found in standalone artifact.');
}

// 4. Scan for local storage uploads in standalone
console.log('\n4. Checking for leaked local storage in standalone:');
const standaloneStorage = path.join(standaloneDir, 'storage');
if (fs.existsSync(standaloneStorage)) {
  console.log(`   [FAIL] Local storage directory leaked into standalone!`);
} else {
  console.log('   [PASS] Zero local storage folders in standalone.');
}

console.log('\nAudit complete.');
