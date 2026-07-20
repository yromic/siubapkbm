const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'siuba_dev',
  });

  const queries = [
    `SELECT status, COUNT(*) FROM students GROUP BY status;`,
    `SELECT lifecycle_status, COUNT(*) FROM students GROUP BY lifecycle_status;`,
    `SELECT status, lifecycle_status, COUNT(*)\nFROM students\nGROUP BY status, lifecycle_status;`,
    `SELECT COUNT(*)\nFROM students\nWHERE status IN ('active','Aktif')\n  AND lifecycle_status <> 'soft_deleted';`,
    `SELECT COUNT(*)\nFROM students\nWHERE status <> 'soft_deleted';`,
    `SELECT *\nFROM students\nWHERE status IN ('active','Aktif')\nLIMIT 20;`
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n--- QUERY ${i + 1} ---`);
    console.log(q);
    console.log('--- RESULT ---');
    try {
      const [rows] = await connection.query(q);
      console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
      console.log('QUERY_ERROR');
      console.log(err && err.stack ? err.stack : String(err));
    }
  }

  await connection.end();
}

run().catch((err) => {
  console.error('FATAL_ERROR');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
