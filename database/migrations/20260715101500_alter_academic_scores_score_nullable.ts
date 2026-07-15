import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("academic_scores", (table) => {
    table.decimal("score", 5, 2).nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("academic_scores", (table) => {
    table.decimal("score", 5, 2).notNullable().alter();
  });
}
