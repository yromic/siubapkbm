import knex from 'knex';
import config from '../knexfile';

const environment = process.env.NODE_ENV || 'development';

let db: any;

if (process.env.NODE_ENV === 'production') {
  db = knex(config[environment]);
} else {
  if (!(global as any).cachedDb) {
    (global as any).cachedDb = knex(config[environment]);
  }
  db = (global as any).cachedDb;
}

export default db;

