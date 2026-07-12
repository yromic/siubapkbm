/**
 * scratch/test-import.mjs
 * Run with: node --experimental-vm-modules scratch/test-import.mjs
 * Or just: node scratch/test-import.mjs  (Node 18+)
 *
 * Simulates what the POST /api/v1/imports handler does,
 * prints the full error if anything throws.
 */

// We can't easily import TS here, so we'll poke the DB directly
// and test what actually breaks.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(exec);

// Try to get the last 20 lines from the running next dev stdout via
// checking if there's any accessible log file.
async function main() {
  try {
    // Check for any recently modified files in .next that indicate a compile error
    const { stdout } = await run(
      'Get-ChildItem .next -Recurse -File -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { Write-Host $_.FullName }',
      { shell: 'powershell.exe', cwd: 'f:/Project/siuba' }
    );
    console.log('Recent .next files:', stdout);
  } catch (e) {
    console.error('Could not list .next files:', e.message);
  }
}

main();
