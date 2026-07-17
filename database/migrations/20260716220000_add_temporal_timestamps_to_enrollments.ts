import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Add enrolled_at as nullable first
  await knex.schema.alterTable("student_enrollments", (table) => {
    table.datetime("enrolled_at").nullable();
    table.datetime("withdrawn_at").nullable();
  });

  // 2. Initialize enrolled_at to created_at
  await knex("student_enrollments").update({
    enrolled_at: knex.ref("created_at")
  });

  // 3. Alter enrolled_at to be NOT NULL
  await knex.schema.alterTable("student_enrollments", (table) => {
    table.datetime("enrolled_at").notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("student_enrollments", (table) => {
    table.dropColumn("enrolled_at");
    table.dropColumn("withdrawn_at");
  });
}
