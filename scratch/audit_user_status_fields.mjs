import knex from 'knex';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'siuba_db',
  },
});

async function run() {
  try {
    const summary = await db('users')
      .groupBy('status', 'lifecycle_status')
      .select('status', 'lifecycle_status')
      .count('id as count');
    
    console.log("STATUS_LIFECYCLE_COMBINATIONS:", JSON.stringify(summary, null, 2));

    const mismatched = await db('users')
      .where('status', 'inactive')
      .where('lifecycle_status', 'active')
      .orWhere(function() {
        this.where('status', 'active').where('lifecycle_status', 'inactive');
      })
      .select('id', 'name', 'username', 'email', 'status', 'lifecycle_status');

    console.log("MISMATCHED_RECORDS:", JSON.stringify(mismatched, null, 2));
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await db.destroy();
  }
}

run();
