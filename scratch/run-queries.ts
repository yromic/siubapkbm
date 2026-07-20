import knex from 'knex';
import config from '../knexfile';

const db = knex(config.development);

async function main() {
  const queries = [
    "SELECT status, COUNT(*) as count FROM students GROUP BY status;",
    "SELECT lifecycle_status, COUNT(*) as count FROM students GROUP BY lifecycle_status;",
    "SELECT status, lifecycle_status, COUNT(*) as count FROM students GROUP BY status, lifecycle_status;",
    "SELECT COUNT(*) as count FROM students WHERE status IN ('active','Aktif') AND lifecycle_status <> 'soft_deleted';",
    "SELECT COUNT(*) as count FROM students WHERE status <> 'soft_deleted';",
    "SELECT * FROM students WHERE status IN ('active','Aktif') LIMIT 20;"
  ];

  try {
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      console.log(`--- Query ${i + 1}: ${q} ---`);
      const result = await db.raw(q);
      // For mysql2, the result is an array where the first element is the rows
      console.log(JSON.stringify(result[0], null, 2));
      console.log("\n");
    }
  } catch (error) {
    console.error("Error executing queries:", error);
  } finally {
    await db.destroy();
  }
}

main();
