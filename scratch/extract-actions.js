const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'lib', 'api');
const files = fs.readdirSync(apiDir);

const mapping = [];

files.forEach(file => {
  if (file === 'client.ts') return;
  const filePath = path.join(apiDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Look for exported async functions
  // e.g. export async function listUsersApi(...) { ... apiRequest<...>("list_users", ... }
  // We can use a regex or a simple line-by-line parser
  const lines = content.split('\n');
  let currentFunc = null;
  
  lines.forEach(line => {
    const funcMatch = line.match(/export\s+async\s+function\s+(\w+)\s*\(/);
    if (funcMatch) {
      currentFunc = funcMatch[1];
    }
    const apiRequestMatch = line.match(/apiRequest(?:<\w+\[?\]?>)?\(\s*"([^"]+)"/);
    if (apiRequestMatch && currentFunc) {
      mapping.push({
        file: `lib/api/${file}`,
        function: currentFunc,
        action: apiRequestMatch[1]
      });
      currentFunc = null;
    }
  });
});

console.log(JSON.stringify(mapping, null, 2));
