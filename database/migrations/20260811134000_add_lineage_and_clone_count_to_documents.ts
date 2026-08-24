import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  const hasRootDocId = await knex.schema.hasColumn("documents", "root_document_id");
  if (!hasRootDocId) {
    await knex.schema.alterTable("documents", (table) => {
      table.string("root_document_id", 36).nullable().index();
      table.integer("clone_count").notNullable().defaultTo(0);
    });
  }

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.schema.alterTable("documents", (table) => {
    table.dropColumn("root_document_id");
    table.dropColumn("clone_count");
  });
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
