import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'siuba_dev',
});

async function q(label, sql) {
  console.log('\n========================================');
  console.log('QUERY:', label);
  console.log('SQL:', sql);
  console.log('----------------------------------------');
  const [rows] = await conn.execute(sql);
  console.table(rows);
}

await q('Q1: status distribution',
  "SELECT status, COUNT(*) as `count` FROM students GROUP BY status");

await q('Q2: lifecycle_status distribution',
  "SELECT lifecycle_status, COUNT(*) as `count` FROM students GROUP BY lifecycle_status");

await q('Q3: status x lifecycle_status cross',
  "SELECT status, lifecycle_status, COUNT(*) as `count` FROM students GROUP BY status, lifecycle_status");

await q('Q4: active students NOT soft_deleted',
  "SELECT COUNT(*) as `count` FROM students WHERE status IN ('active','Aktif') AND lifecycle_status <> 'soft_deleted'");

await q('Q5: status <> soft_deleted',
  "SELECT COUNT(*) as `count` FROM students WHERE status <> 'soft_deleted'");

await q('Q6: sample active/Aktif rows (LIMIT 20)',
  "SELECT * FROM students WHERE status IN ('active','Aktif') LIMIT 20");

await conn.end();
