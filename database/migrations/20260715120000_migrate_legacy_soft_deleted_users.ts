import type { Knex } from "knex";

function generateSoftDeletedIdentifier(original: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `deleted_${timestamp}_${randomSuffix}_${original}`;
}

export async function up(knex: Knex): Promise<void> {
  // Find users that are soft deleted
  const softDeletedUsers = await knex("users")
    .where("lifecycle_status", "soft_deleted")
    .select("id", "email", "username");

  let total = softDeletedUsers.length;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`[MIGRATION] Found ${total} soft-deleted users in database.`);

  for (const user of softDeletedUsers) {
    const isEmailMigrated = user.email.startsWith("deleted_");
    const isUsernameMigrated = user.username.startsWith("deleted_");

    if (isEmailMigrated && isUsernameMigrated) {
      skipped++;
      continue;
    }

    try {
      await knex.transaction(async (trx) => {
        const newEmail = isEmailMigrated ? user.email : generateSoftDeletedIdentifier(user.email);
        const newUsername = isUsernameMigrated ? user.username : generateSoftDeletedIdentifier(user.username);

        await trx("users")
          .where("id", user.id)
          .update({
            email: newEmail,
            username: newUsername,
            updated_at: new Date()
          });
      });
      migrated++;
    } catch (error) {
      failed++;
      console.error(`[MIGRATION ERROR] Failed to backfill user ID ${user.id}:`, error);
    }
  }

  const report = `
[MIGRATION REPORT - LEGACY SOFT DELETED USERS BACKFILL]
- Total soft-deleted users checked: ${total}
- Migrated (Renamed): ${migrated}
- Skipped (Already Renamed): ${skipped}
- Failed migrations: ${failed}
`;
  console.log(report);
}

export async function down(knex: Knex): Promise<void> {
  // Backfill migrations do not need revert actions because it's data normalization.
}
