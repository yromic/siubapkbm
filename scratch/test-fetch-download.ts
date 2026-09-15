async function main() {
  const BASE_URL = 'http://localhost:3000';
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
  });

  const cookie = loginRes.headers.get('set-cookie');
  const headers = { Cookie: cookie || '' };

  const testUrls = [
    `${BASE_URL}/api/v1/rpm/5a3dd1df-f860-4d50-892a-19dc1009f3d6/attachments`,
    `${BASE_URL}/api/v1/rpm/5a3dd1df-f860-4d50-892a-19dc1009f3d6/attachments/397f245b-f51e-48ac-b16a-975c483984b5`,
    `${BASE_URL}/api/v1/rpm/5a3dd1df-f860-4d50-892a-19dc1009f3d6/attachments/397f245b-f51e-48ac-b16a-975c483984b5/download`,
    `${BASE_URL}/api/v1/rpm/5a3dd1df-f860-4d50-892a-19dc1009f3d6/attachments/397f245b-f51e-48ac-b16a-975c483984b5/download?preview=1`,
  ];

  for (const url of testUrls) {
    const res = await fetch(url, { headers });
    console.log(`URL: ${url}`);
    console.log(`Status: ${res.status}, Content-Type: ${res.headers.get('content-type')}`);
    const text = await res.text();
    console.log(`Body (first 100 chars): ${text.slice(0, 100)}...\n`);
  }
}

main().catch(console.error);
