import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Idempotently create job_queue table
  const hasJobQueue = await knex.schema.hasTable("job_queue");
  if (!hasJobQueue) {
    await knex.schema.createTable("job_queue", (table) => {
      table.uuid("id").primary();
      table.string("job_type", 100).notNullable();
      table.text("payload").notNullable();
      table.string("status", 50).notNullable().defaultTo("pending");
      table.text("error_message").nullable();
      table.timestamps(true, true);
    });
  }

  // 2. Idempotently create rate_limit_attempts table
  const hasRateLimitAttempts = await knex.schema.hasTable("rate_limit_attempts");
  if (!hasRateLimitAttempts) {
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
}

export async function down(knex: Knex): Promise<void> {
  // Empty down method to preserve tables on rollbacks of this repair script
}
