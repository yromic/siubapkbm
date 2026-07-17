const knex = require('knex');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: '.env' });

const config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'siuba_dev',
  },
  migrations: {
    directory: path.join(__dirname, '../database/migrations'),
    extension: 'ts',
  }
};

const db = knex(config);

async function run() {
  console.log('Running database migrations...');
  try {
    const [batchNo, log] = await db.migrate.latest();
    if (log.length === 0) {
      console.log('Already up to date.');
    } else {
      console.log(`Batch ${batchNo} run:`);
      log.forEach(file => console.log(`  - ${file}`));
    }
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

run();
