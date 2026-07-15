import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Alter class_promotion_rules: change uq_promotion_flow to uq_promotion_source
  await knex.schema.alterTable("class_promotion_rules", (table) => {
    table.dropUnique(["source_class_id", "target_class_id"], "uq_promotion_flow");
    table.unique(["source_class_id"], { indexName: "uq_promotion_source" });
  });

  // 2. Alter student_enrollments: add a virtual column and a unique index to enforce a single active enrollment per student per semester
  await knex.schema.alterTable("student_enrollments", (table) => {
    table.specificType("active_enrollment_check", "VARCHAR(150) GENERATED ALWAYS AS (IF(status = 'active', CONCAT(student_id, \'_\', academic_year_id, \'_\', semester_id), NULL)) VIRTUAL");
    table.unique(["active_enrollment_check"], { indexName: "uq_active_enrollment" });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("student_enrollments", (table) => {
    table.dropUnique(["active_enrollment_check"], "uq_active_enrollment");
    table.dropColumn("active_enrollment_check");
  });

  await knex.schema.alterTable("class_promotion_rules", (table) => {
    table.dropUnique(["source_class_id"], "uq_promotion_source");
    table.unique(["source_class_id", "target_class_id"], { indexName: "uq_promotion_flow" });
  });
}
