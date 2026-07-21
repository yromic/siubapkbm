exports.up = async function(knex) {
  const hasMfaSecret = await knex.schema.hasColumn("users", "mfa_secret");
  if (!hasMfaSecret) {
    await knex.schema.alterTable("users", (table) => {
      table.string("mfa_secret", 255).nullable();
      table.boolean("mfa_enabled").notNullable().defaultTo(false);
      table.text("mfa_backup_codes").nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("mfa_secret");
    table.dropColumn("mfa_enabled");
    table.dropColumn("mfa_backup_codes");
  });
};
