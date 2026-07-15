import db from '../database/connection';

async function run() {
  const tables = ['teacher_profiles', 'users', 'classes', 'subjects', 'class_teacher_assignments'];
  for (const table of tables) {
    console.log(`--- Columns for ${table} ---`);
    try {
      const columns = await db.raw(`SHOW COLUMNS FROM \`${table}\``);
      console.log(columns[0].map((col: any) => `${col.Field} (${col.Type})` + (col.Null === 'YES' ? ' NULL' : ' NOT NULL')));
    } catch (err: any) {
      console.error(`Error showing columns for ${table}:`, err.message);
    }
  }
  process.exit(0);
}

run();
