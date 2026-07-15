import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasDeletedAt = await knex.schema.hasColumn("class_subjects", "deleted_at");
  if (!hasDeletedAt) {
    await knex.schema.alterTable("class_subjects", (table) => {
      table.dateTime("deleted_at").nullable();
      table.string("deleted_by", 36).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("class_subjects", (table) => {
    table.dropColumn("deleted_at");
    table.dropColumn("deleted_by");
  });
}
