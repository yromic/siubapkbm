
async function run() {
  const proxyUrl = 'http://localhost:3000/api/gas';
  
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'debug_backend_version',
      payload: {}
    })
  });
  
  const data = await res.json();
  console.log('DEBUG BACKEND DATA:');
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
