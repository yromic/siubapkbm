async function main() {
  const BASE_URL = 'http://localhost:3000';
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
  });

  const cookie = loginRes.headers.get('set-cookie');
  const headers = { Cookie: cookie || '', 'Content-Type': 'application/json' };

  // Test reorder route
  const res = await fetch(`${BASE_URL}/api/v1/rpm/5a3dd1df-f860-4d50-892a-19dc1009f3d6/attachments/reorder`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ordered_ids: [] })
  });
  console.log(`reorder Status: ${res.status}`);
  const text = await res.text();
  console.log('reorder body:', text);
}

main().catch(console.error);
