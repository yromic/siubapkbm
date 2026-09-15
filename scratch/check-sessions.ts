import knex from 'knex';
import config from '../knexfile';

const db = knex(config.development);

async function main() {
  try {
    const hasSessions = await db.schema.hasTable('sessions');
    console.log('hasSessions:', hasSessions);
    if (hasSessions) {
      const sessions = await db('sessions').orderBy('created_at', 'desc').limit(5);
      console.log('Recent sessions:', JSON.stringify(sessions, null, 2));
    }
    const staffSessions = await db.schema.hasTable('staff_sessions');
    console.log('has staff_sessions:', staffSessions);
    if (staffSessions) {
      const sessions = await db('staff_sessions').orderBy('created_at', 'desc').limit(5);
      console.log('Recent staff sessions:', JSON.stringify(sessions, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.destroy();
  }
}

main();
