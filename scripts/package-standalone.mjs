import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, '.next', 'standalone');

console.log('=== SIUBA Standalone Packaging & Verification Script ===');

if (!fs.existsSync(standaloneDir)) {
  console.error('Error: .next/standalone does not exist. Please run "npm run build" first.');
  process.exit(1);
}

// Helper for recursive copy
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// 1. Copy .next/static to .next/standalone/.next/static
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
console.log('1. Copying static assets (.next/static)...');
if (fs.existsSync(staticSrc)) {
  copyRecursive(staticSrc, staticDest);
  console.log('   Static assets copied successfully.');
} else {
  console.warn('   Warning: .next/static not found!');
}

// 2. Copy public directory to .next/standalone/public
const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standaloneDir, 'public');
console.log('2. Copying public directory...');
if (fs.existsSync(publicSrc)) {
  copyRecursive(publicSrc, publicDest);
  console.log('   Public directory copied successfully.');
} else {
  console.warn('   Warning: public folder not found!');
}

// 3. Copy database directory and migrations
const dbSrc = path.join(projectRoot, 'database');
const dbDest = path.join(standaloneDir, 'database');
console.log('3. Copying database and migration files...');
if (fs.existsSync(dbSrc)) {
  copyRecursive(dbSrc, dbDest);
  console.log('   Database directory copied successfully.');
}

// 4. Copy knexfile.ts and schema SQL
const knexfileSrc = path.join(projectRoot, 'knexfile.ts');
const knexfileDest = path.join(standaloneDir, 'knexfile.ts');
if (fs.existsSync(knexfileSrc)) {
  fs.copyFileSync(knexfileSrc, knexfileDest);
  console.log('4. knexfile.ts copied successfully.');
}

const schemaSrc = path.join(projectRoot, 'siuba_db_schema.sql');
const schemaDest = path.join(standaloneDir, 'siuba_db_schema.sql');
if (fs.existsSync(schemaSrc)) {
  fs.copyFileSync(schemaSrc, schemaDest);
  console.log('5. siuba_db_schema.sql copied successfully.');
}

// 5. Artifact Hygiene: Ensure NO .env files exist in standalone
console.log('6. Inspecting artifact hygiene (checking for leaked .env / secrets)...');
function sanitizeDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Remove any Windows-only native sharp binary if traced
      if (item === '@img' || item.includes('sharp-win32')) {
        console.log(`   Removing Windows native package from standalone: ${item}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        continue;
      }
      if (item === 'storage') {
        console.log('   Removing local storage folder from standalone package');
        fs.rmSync(fullPath, { recursive: true, force: true });
        continue;
      }
      sanitizeDir(fullPath);
    } else {
      if (item.startsWith('.env') && item !== '.env.example') {
        console.warn(`   REMOVING forbidden env file from standalone: ${item}`);
        fs.unlinkSync(fullPath);
      }
    }
  }
}
sanitizeDir(standaloneDir);

// 6. Verification checks
console.log('\n=== Standalone Package Verification ===');
const hasServerJs = fs.existsSync(path.join(standaloneDir, 'server.js'));
const hasStatic = fs.existsSync(path.join(standaloneDir, '.next', 'static'));
const hasPublic = fs.existsSync(path.join(standaloneDir, 'public'));
const hasMigrations = fs.existsSync(path.join(standaloneDir, 'database', 'migrations'));
const hasKnexfile = fs.existsSync(path.join(standaloneDir, 'knexfile.ts'));

console.log(`- server.js present: ${hasServerJs ? 'YES' : 'NO'}`);
console.log(`- .next/static present: ${hasStatic ? 'YES' : 'NO'}`);
console.log(`- public folder present: ${hasPublic ? 'YES' : 'NO'}`);
console.log(`- database/migrations present: ${hasMigrations ? 'YES' : 'NO'}`);
console.log(`- knexfile.ts present: ${hasKnexfile ? 'YES' : 'NO'}`);

// Check for any remaining .env file in standalone
let foundEnv = false;
function checkEnv(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      checkEnv(full);
    } else if (item.startsWith('.env') && item !== '.env.example') {
      foundEnv = true;
      console.error(`- FAILED: Found .env file in artifact: ${full}`);
    }
  }
}
checkEnv(standaloneDir);
console.log(`- Zero .env files in artifact: ${!foundEnv ? 'YES (PASSED)' : 'NO (FAILED)'}`);

if (!hasServerJs || !hasStatic || !hasPublic || !hasMigrations || !hasKnexfile || foundEnv) {
  console.error('\nERROR: Standalone packaging verification failed.');
  process.exit(1);
}

console.log('\nStandalone package successfully prepared and verified at: .next/standalone');
