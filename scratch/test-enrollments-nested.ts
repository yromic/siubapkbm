async function main() {
  const BASE_URL = 'http://localhost:3000';
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
  });

  const cookie = loginRes.headers.get('set-cookie');
  const headers = { Cookie: cookie || '', 'Content-Type': 'application/json' };

  const res1 = await fetch(`${BASE_URL}/api/v1/enrollments/test-id`, { method: 'GET', headers });
  console.log('enrollments/[id] status:', res1.status);

  const res2 = await fetch(`${BASE_URL}/api/v1/enrollments/test-id/status`, { method: 'GET', headers });
  console.log('enrollments/[id]/status status:', res2.status);
}

main().catch(console.error);
