import type { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const devConfig: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'siuba_dev',
  },
  migrations: {
    directory: './database/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './database/seeds',
    extension: 'ts',
  },
  pool: { min: 2, max: 10 },
};

const config: { [key: string]: Knex.Config } = {
  development: devConfig,
  production: devConfig,
};

export default config;
