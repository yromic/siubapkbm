const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/NEXT_PUBLIC_GAS_API_URL=(.+)/);
if (!match) {
  console.error("NEXT_PUBLIC_GAS_API_URL not found in .env.local");
  process.exit(1);
}
const gasUrl = match[1].trim();
console.log("Testing GAS URL:", gasUrl);

async function test() {
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "health_check", payload: {} })
    });
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("Response Body (first 1000 chars):");
    console.log(text.slice(0, 1000));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
