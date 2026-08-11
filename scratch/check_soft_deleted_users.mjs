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
    const unmigrated = await db('users')
      .where('lifecycle_status', 'soft_deleted')
      .whereNot('email', 'like', 'deleted_%')
      .whereNot('username', 'like', 'deleted_%')
      .select('id', 'email', 'username', 'lifecycle_status', 'deleted_at');
    
    const totalSoftDeleted = await db('users')
      .where('lifecycle_status', 'soft_deleted')
      .count('id as count')
      .first();

    console.log("TOTAL_SOFT_DELETED:", totalSoftDeleted?.count);
    console.log("UNMIGRATED_COUNT:", unmigrated.length);
    console.log("UNMIGRATED_RECORDS:", JSON.stringify(unmigrated, null, 2));
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await db.destroy();
  }
}

run();
