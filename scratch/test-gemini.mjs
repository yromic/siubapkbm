import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key configured:', Boolean(apiKey));

if (!apiKey) {
  console.log('No API key found in process.env');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Hello' }] }],
    }),
  });

  console.log('HTTP Status:', res.status, res.statusText);
  const data = await res.json();
  console.log('Response body:', JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Fetch error:', err);
}
