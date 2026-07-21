import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable("altcha_replays");
  if (!hasTable) {
    await knex.schema.createTable("altcha_replays", (table) => {
      table.uuid("id").primary();
      table.string("signature", 255).notNullable().unique();
      table.dateTime("expires_at").notNullable();
      table.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
      
      table.index(["expires_at"]);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("altcha_replays");
}
