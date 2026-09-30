import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawAdminPassword = process.env.FIRST_ADMIN_PASSWORD;

  // Strict production safety guard against insecure default credentials
  if (isProduction) {
    if (!rawAdminPassword || rawAdminPassword.trim().length === 0 || rawAdminPassword === 'admin123') {
      throw new Error(
        "SECURITY BLOCKER: In production, FIRST_ADMIN_PASSWORD must be explicitly provided in the environment and cannot use the insecure default 'admin123'."
      );
    }
  }

  const adminEmail = process.env.FIRST_ADMIN_EMAIL || (isProduction ? '' : 'admin@siuba.sch.id');
  const adminUsername = process.env.FIRST_ADMIN_USERNAME || (isProduction ? '' : 'admin');
  const adminPassword = rawAdminPassword || 'admin123';
  const adminName = process.env.FIRST_ADMIN_NAME || 'Administrator';

  if (isProduction && (!adminEmail || !adminUsername)) {
    throw new Error(
      "SECURITY BLOCKER: In production, FIRST_ADMIN_EMAIL and FIRST_ADMIN_USERNAME must be explicitly configured in the environment."
    );
  }

  // Check if admin user already exists by username or email
  const adminExists = await knex('users')
    .where('username', adminUsername)
    .orWhere('email', adminEmail)
    .first();

  if (!adminExists) {
    const saltRounds = Number(process.env.SESSION_HASH_SALT) || 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
    const adminId = uuidv4();

    await knex('users').insert({
      id: adminId,
      name: adminName,
      email: adminEmail,
      username: adminUsername,
      password_hash: passwordHash,
      role: 'administrator',
      status: 'active',
      lifecycle_status: 'active',
      failed_login_attempts: 0,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`Seed: Admin user created successfully (Username: ${adminUsername}, Email: ${adminEmail}).`);
  } else {
    console.log(`Seed: Admin user (${adminUsername} / ${adminEmail}) already exists, skipping creation.`);
  }
}
