import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("job_queue", (table) => {
    table.uuid("id").primary();
    table.string("job_type", 100).notNullable();
    table.text("payload").notNullable();
    table.string("status", 50).notNullable().defaultTo("pending");
    table.text("error_message").nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("job_queue");
}
