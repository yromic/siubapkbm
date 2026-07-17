const knex = require('knex');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'siuba_dev',
  }
};

const db = knex(config);

async function run() {
  const tables = ['class_subjects', 'subjects'];
  for (const table of tables) {
    console.log(`--- Columns for ${table} ---`);
    try {
      const columns = await db.raw(`SHOW COLUMNS FROM \`${table}\``);
      console.log(columns[0].map(col => `${col.Field} (${col.Type})` + (col.Null === 'YES' ? ' NULL' : ' NOT NULL')));
    } catch (err) {
      console.error(`Error showing columns for ${table}:`, err.message);
    }
  }
  try {
    const rows = await db('class_subjects').select('*').limit(5);
    console.log('--- class_subjects rows ---');
    console.log(rows);
  } catch (err) {
    console.error('Error fetching class_subjects rows:', err.message);
  }
  process.exit(0);
}

run();
