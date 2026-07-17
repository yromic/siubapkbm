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
  try {
    console.log('1. Checking table structure...');
    const hasTable = await db.schema.hasTable('student_enrollments');
    if (!hasTable) {
      throw new Error('student_enrollments table not found.');
    }

    const hasEnrolledAt = await db.schema.hasColumn('student_enrollments', 'enrolled_at');
    if (!hasEnrolledAt) {
      console.log('2. Adding columns to student_enrollments...');
      await db.schema.alterTable('student_enrollments', (table) => {
        table.datetime('enrolled_at').nullable();
        table.datetime('withdrawn_at').nullable();
      });

      console.log('3. Copying created_at to enrolled_at...');
      await db.raw('UPDATE student_enrollments SET enrolled_at = created_at');

      console.log('4. Altering enrolled_at to NOT NULL...');
      await db.schema.alterTable('student_enrollments', (table) => {
        table.datetime('enrolled_at').notNullable().alter();
      });
      console.log('Database columns successfully created and populated.');
    } else {
      console.log('Columns already exist.');
    }

    console.log('5. Inserting migration record...');
    const hasMigrationTable = await db.schema.hasTable('knex_migrations');
    if (hasMigrationTable) {
      const existing = await db('knex_migrations')
        .where('name', '20260716220000_add_temporal_timestamps_to_enrollments.ts')
        .first();
      
      if (!existing) {
        const lastBatchResult = await db('knex_migrations').max('batch as max_batch').first();
        const nextBatch = (lastBatchResult?.max_batch || 0) + 1;
        
        await db('knex_migrations').insert({
          name: '20260716220000_add_temporal_timestamps_to_enrollments.ts',
          batch: nextBatch,
          migration_time: new Date()
        });
        console.log(`Migration registered in batch ${nextBatch}.`);
      } else {
        console.log('Migration already registered.');
      }
    }

    console.log('All migration tasks successfully completed.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

run();
