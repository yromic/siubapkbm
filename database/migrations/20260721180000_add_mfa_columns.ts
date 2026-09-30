import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasMfaSecret = await knex.schema.hasColumn("users", "mfa_secret");
  if (!hasMfaSecret) {
    await knex.schema.alterTable("users", (table) => {
      table.string("mfa_secret", 255).nullable();
      table.boolean("mfa_enabled").notNullable().defaultTo(false);
      table.text("mfa_backup_codes").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasMfaSecret = await knex.schema.hasColumn("users", "mfa_secret");
  if (hasMfaSecret) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("mfa_secret");
      table.dropColumn("mfa_enabled");
      table.dropColumn("mfa_backup_codes");
    });
  }
}
