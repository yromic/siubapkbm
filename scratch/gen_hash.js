const bcrypt = require('bcryptjs');

async function main() {
  const hash1 = await bcrypt.hash('admin123', 10);
  console.log('admin123 hash:', hash1);

  const hash2 = await bcrypt.hash('Admin123!', 10);
  console.log('Admin123! hash:', hash2);

  const check1 = await bcrypt.compare('admin123', hash1);
  console.log('Check admin123:', check1);
}

main().catch(console.error);
