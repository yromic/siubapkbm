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
  console.log('Sample matcher:', JSON.stringify(matchers[0], null, 2));

  for (const m of matchers) {
    const identity = (m as any).identity || (m as any).pathname || (m as any).page || '';
    if (identity.includes('rpm') || identity.includes('attachment')) {
      console.log('RPM matcher:', identity, 'keys:', Object.keys(m));
    }
  }
}

main().catch(console.error);
