/**
 * Direct test: tries to run createImportSession with a minimal 1-row CSV
 * and prints the full error stack if it throws.
 *
 * Run: npx ts-node --project tsconfig.json -e "require('./scratch/test-import-direct')"
 * Or:  npx tsx scratch/test-import-direct.ts
 */

// Minimal CSV matching the students template
const CSV_CONTENT = [
  'nisn,full_name,birth_date,gender,status',
  '1234567890,Budi Santoso,1/12/2019,L,Aktif',
].join('\n');

const base64 = Buffer.from(CSV_CONTENT, 'utf-8').toString('base64');

async function main() {
  try {
    // Dynamically import so we get TS resolution
    const { createImportSession } = await import('../lib/services/importService');
    console.log('=== Calling createImportSession ===');
    const result = await createImportSession('students', 'test.csv', base64, 'test-actor-id');
    console.log('=== SUCCESS ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('=== ERROR ===');
    console.error('Message:', err?.message);
    console.error('Code   :', err?.code);
    console.error('Stack  :\n', err?.stack);
  }
}

main();
