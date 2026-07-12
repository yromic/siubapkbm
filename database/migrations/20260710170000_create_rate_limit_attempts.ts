import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("rate_limit_attempts", (table) => {
    table.uuid("id").primary();
    table.string("identifier", 255).notNullable();
    table.string("endpoint", 255).notNullable();
    table.integer("attempts").notNullable().defaultTo(0);
    table.dateTime("window_start").notNullable();
    table.dateTime("locked_until").nullable();
    table.timestamps(true, true);
    
    table.index(["identifier", "endpoint"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("rate_limit_attempts");
}
