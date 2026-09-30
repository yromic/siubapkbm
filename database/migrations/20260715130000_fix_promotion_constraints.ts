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
  const [existingActiveIdx]: any = await knex.raw("SHOW INDEX FROM `student_enrollments` WHERE Key_name = 'uq_active_enrollment'");
  const hasActiveIndex = existingActiveIdx && existingActiveIdx.length > 0;

  if (!hasActiveIndex) {
    // If the column was partially created in a prior failed migration run, drop it first to ensure the correct deterministic expression is applied
    const hasActiveEnrollmentCheck = await knex.schema.hasColumn("student_enrollments", "active_enrollment_check");
    if (hasActiveEnrollmentCheck) {
      await knex.schema.alterTable("student_enrollments", (table) => {
        table.dropColumn("active_enrollment_check");
      });
    }

    await knex.schema.alterTable("student_enrollments", (table) => {
      table.specificType(
        "active_enrollment_check",
        "VARCHAR(150) GENERATED ALWAYS AS (IF(status = 'active', CONCAT(RTRIM(student_id), '_', RTRIM(academic_year_id), '_', RTRIM(semester_id)), NULL)) VIRTUAL"
      );
      table.unique(["active_enrollment_check"], { indexName: "uq_active_enrollment" });
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const [existingActiveIdx]: any = await knex.raw("SHOW INDEX FROM `student_enrollments` WHERE Key_name = 'uq_active_enrollment'");
  if (existingActiveIdx && existingActiveIdx.length > 0) {
    await knex.schema.alterTable("student_enrollments", (table) => {
      table.dropUnique(["active_enrollment_check"], "uq_active_enrollment");
    });
  }

  const hasActiveEnrollmentCheck = await knex.schema.hasColumn("student_enrollments", "active_enrollment_check");
  if (hasActiveEnrollmentCheck) {
    await knex.schema.alterTable("student_enrollments", (table) => {
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

