import fs from 'fs';
import path from 'path';

function findRoutes(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findRoutes(filePath));
    } else if (file === 'route.ts' || file === 'route.js') {
      results.push(filePath);
    }
  }
  return results;
}

const allRoutes = findRoutes(path.join(process.cwd(), 'app', 'api'));
console.log('Total route files:', allRoutes.length);

// Check if any route directory is an ancestor of another route directory
for (const r1 of allRoutes) {
  const dir1 = path.dirname(r1);
  for (const r2 of allRoutes) {
    if (r1 !== r2) {
      const dir2 = path.dirname(r2);
      if (dir2.startsWith(dir1 + path.sep)) {
        console.log(`Parent: ${dir1}\n  Child: ${dir2}\n`);
      }
    }
  }
}
