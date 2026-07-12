
async function run() {
  const proxyUrl = 'http://localhost:3000/api/gas';
  
  // 1. Login
  const loginRes = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      payload: {
        username: 'admin',
        password: 'Admin123!'
      }
    })
  });
  
  const loginData = await loginRes.json();
  if (loginData.status === 'error') {
    console.error('Login failed:', loginData);
    return;
  }
  
  const token = loginData.data.token;
  console.log('Login successful. Token acquired.');

  // 2. Fetch stats
  const statsRes = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get_executive_dashboard_stats',
      payload: {},
      token: token
    })
  });
  
  const statsData = await statsRes.json();
  console.log('Stats Response sppChartData:');
  console.log(JSON.stringify(statsData.data?.sppChartData, null, 2));
}

run().catch(console.error);
