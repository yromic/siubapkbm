async function main() {
  const BASE_URL = 'http://localhost:3000';
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
  });

  const cookie = loginRes.headers.get('set-cookie');
  const headers = { Cookie: cookie || '' };

  const res = await fetch(`${BASE_URL}/api/v1/students/some-id/academic-summary`, { headers });
  console.log(`academic-summary Status: ${res.status}`);
}

main().catch(console.error);
