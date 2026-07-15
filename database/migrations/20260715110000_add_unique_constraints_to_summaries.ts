import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  try {
    await knex.schema.alterTable("character_weekly_summaries", (table) => {
      table.unique(["student_id", "week_start_date"], { indexName: "uq_student_week" });
    });
  } catch (e: any) {
    if (!e.message.includes("Duplicate key")) throw e;
  }

  try {
    await knex.schema.alterTable("character_monthly_summaries", (table) => {
      table.unique(["student_id", "summary_year", "summary_month"], { indexName: "uq_student_month" });
    });
  } catch (e: any) {
    if (!e.message.includes("Duplicate key")) throw e;
  }

  try {
    await knex.schema.alterTable("character_semester_summaries", (table) => {
      table.unique(["student_id", "semester_id"], { indexName: "uq_student_semester" });
    });
  } catch (e: any) {
    if (!e.message.includes("Duplicate key")) throw e;
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    await knex.schema.alterTable("character_weekly_summaries", (table) => {
      table.dropUnique(["student_id", "week_start_date"], "uq_student_week");
    });
  } catch (e) {}

  try {
    await knex.schema.alterTable("character_monthly_summaries", (table) => {
      table.dropUnique(["student_id", "summary_year", "summary_month"], "uq_student_month");
    });
  } catch (e) {}

  try {
    await knex.schema.alterTable("character_semester_summaries", (table) => {
      table.dropUnique(["student_id", "semester_id"], "uq_student_semester");
    });
  } catch (e) {}
}
