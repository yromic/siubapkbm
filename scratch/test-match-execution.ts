import { DevAppRouteRouteMatcherProvider } from 'next/dist/server/route-matcher-providers/dev/dev-app-route-route-matcher-provider.js';
import { DefaultFileReader } from 'next/dist/server/route-matcher-providers/dev/helpers/file-reader/default-file-reader.js';
import path from 'path';

async function main() {
  const appDir = path.join(process.cwd(), 'app');
  const reader = new DefaultFileReader({});
  const provider = new DevAppRouteRouteMatcherProvider(
    appDir,
    ['tsx', 'ts', 'jsx', 'js'],
    reader,
    true
  );

  const matchers = await provider.matchers();

  const testPathname = '/api/v1/rpm/5a3dd1df-f860-4d50-892a-19dc1009f3d6/attachments/397f245b-f51e-48ac-b16a-975c483984b5/download';

  console.log(`Testing match for: ${testPathname}`);
  for (const m of matchers) {
    if (m.match(testPathname)) {
      console.log('MATCHED MATCHER:', m.definition.pathname, 'page:', m.definition.page);
      console.log('Match result params:', m.match(testPathname));
    }
  }
}

main().catch(console.error);
