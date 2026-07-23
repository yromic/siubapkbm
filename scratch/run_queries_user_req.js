const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'siuba_dev'
  });

  console.log("=== ACADEMIC YEARS ===");
  const [years] = await connection.query("SELECT id, name, is_active, status, lifecycle_status FROM academic_years;");
  console.log(JSON.stringify(years, null, 2));

  console.log("\n=== SEMESTERS ===");
  const [semesters] = await connection.query("SELECT id, academic_year_id, name, is_active, status, lifecycle_status FROM semesters;");
  console.log(JSON.stringify(semesters, null, 2));

  await connection.end();
}

run().catch(console.error);
