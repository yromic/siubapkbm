import { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // Check if admin user already exists
  const adminExists = await knex('users').where('username', 'admin').first();

  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const adminId = uuidv4();

    await knex('users').insert({
      id: adminId,
      name: 'Administrator',
      email: 'admin@siuba.sch.id',
      username: 'admin',
      password_hash: passwordHash,
      role: 'administrator',
      status: 'active',
      lifecycle_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log('Seed: admin user created successfully.');
  } else {
    console.log('Seed: admin user already exists, skipping creation.');
  }
}
