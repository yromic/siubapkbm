import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. Alter class_promotion_rules: change uq_promotion_flow to uq_promotion_source
  // We must add uq_promotion_source FIRST so source_class_id retains an index for fk_promo_rule_source
  const [existingSourceIdx]: any = await knex.raw("SHOW INDEX FROM `class_promotion_rules` WHERE Key_name = 'uq_promotion_source'");
  if (existingSourceIdx.length === 0) {
    await knex.schema.alterTable("class_promotion_rules", (table) => {
      table.unique(["source_class_id"], { indexName: "uq_promotion_source" });
    });
  }

  const [existingFlowIdx]: any = await knex.raw("SHOW INDEX FROM `class_promotion_rules` WHERE Key_name = 'uq_promotion_flow'");
  if (existingFlowIdx.length > 0) {
    await knex.schema.alterTable("class_promotion_rules", (table) => {
      table.dropUnique(["source_class_id", "target_class_id"], "uq_promotion_flow");
    });
  }

  // 2. Alter student_enrollments: add a virtual column and a unique index to enforce a single active enrollment per student per semester
  const hasActiveEnrollmentCheck = await knex.schema.hasColumn("student_enrollments", "active_enrollment_check");
  if (!hasActiveEnrollmentCheck) {
    await knex.schema.alterTable("student_enrollments", (table) => {
      table.specificType("active_enrollment_check", "VARCHAR(150) GENERATED ALWAYS AS (IF(status = 'active', CONCAT(student_id, \'_\', academic_year_id, \'_\', semester_id), NULL)) VIRTUAL");
      table.unique(["active_enrollment_check"], { indexName: "uq_active_enrollment" });
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasActiveEnrollmentCheck = await knex.schema.hasColumn("student_enrollments", "active_enrollment_check");
  if (hasActiveEnrollmentCheck) {
    await knex.schema.alterTable("student_enrollments", (table) => {
      table.dropUnique(["active_enrollment_check"], "uq_active_enrollment");
      table.dropColumn("active_enrollment_check");
    });
  }

  const [existingFlowIdx]: any = await knex.raw("SHOW INDEX FROM `class_promotion_rules` WHERE Key_name = 'uq_promotion_flow'");
  if (existingFlowIdx.length === 0) {
    await knex.schema.alterTable("class_promotion_rules", (table) => {
      table.unique(["source_class_id", "target_class_id"], { indexName: "uq_promotion_flow" });
    });
  }

  const [existingSourceIdx]: any = await knex.raw("SHOW INDEX FROM `class_promotion_rules` WHERE Key_name = 'uq_promotion_source'");
  if (existingSourceIdx.length > 0) {
    await knex.schema.alterTable("class_promotion_rules", (table) => {
      table.dropUnique(["source_class_id"], "uq_promotion_source");
    });
  }
}

