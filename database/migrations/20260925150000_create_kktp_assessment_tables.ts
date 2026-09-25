import type { Knex } from "knex";

/**
 * Migration: Create normalized KKTP assessment tables.
 *
 * Implements canonical Kurikulum Merdeka KKTP domain architecture:
 * 1. kktp_assessments: Class × Subject × Academic Year × Semester assessment session.
 * 2. kktp_assessment_tps: Shared TP configuration for the assessment with text snapshots.
 * 3. kktp_student_scores: Individual student scores per assessment TP.
 * 4. kktp_student_summaries: Materialized subject-level average score, predicate, and notes per student.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  // 1. kktp_assessments
  const hasAssessments = await knex.schema.hasTable("kktp_assessments");
  if (!hasAssessments) {
    await knex.schema.createTable("kktp_assessments", (table) => {
      table.string("id", 36).primary();
      table.string("title", 255).notNullable();
      table.string("class_id", 36).notNullable();
      table.string("subject_id", 36).notNullable();
      table.string("academic_year_id", 36).notNullable();
      table.string("semester_id", 36).notNullable();
      table.string("fase", 50).notNullable().defaultTo("Fase C");
      table.enum("status", ["DRAFT", "IN_PROGRESS", "COMPLETED", "LOCKED"]).notNullable().defaultTo("DRAFT");
      table.string("created_by", 36).nullable();
      table.string("letterhead_version_id", 64).nullable();
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.unique(["class_id", "subject_id", "academic_year_id", "semester_id"], {
        indexName: "uq_kktp_assessment_scope",
      });
      table.index(["academic_year_id", "semester_id"], "idx_kktp_period");
      table.foreign("class_id", "fk_kktp_ass_class").references("id").inTable("classes").onDelete("CASCADE");
      table.foreign("subject_id", "fk_kktp_ass_subj").references("id").inTable("subjects").onDelete("CASCADE");
      table.foreign("academic_year_id", "fk_kktp_ass_year").references("id").inTable("academic_years").onDelete("CASCADE");
      table.foreign("semester_id", "fk_kktp_ass_sem").references("id").inTable("semesters").onDelete("CASCADE");
      table.foreign("created_by", "fk_kktp_ass_creator").references("id").inTable("users").onDelete("SET NULL");
    });
  }

  // 2. kktp_assessment_tps
  const hasTps = await knex.schema.hasTable("kktp_assessment_tps");
  if (!hasTps) {
    await knex.schema.createTable("kktp_assessment_tps", (table) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("tp_id", 36).nullable();
      table.string("tp_code", 50).nullable();
      table.text("tp_text_snapshot").notNullable();
      table.enum("source_type", ["TP_BANK", "MANUAL", "AI_GENERATED", "LINKED_RPM"]).notNullable().defaultTo("MANUAL");
      table.integer("order_index").notNullable().defaultTo(1);
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.index(["assessment_id", "order_index"], "idx_kktp_ass_tp_order");
      table.foreign("assessment_id", "fk_kktp_tp_ass").references("id").inTable("kktp_assessments").onDelete("CASCADE");
      table.foreign("tp_id", "fk_kktp_tp_bank").references("id").inTable("tp_bank").onDelete("SET NULL");
    });
  }

  // 3. kktp_student_scores
  const hasScores = await knex.schema.hasTable("kktp_student_scores");
  if (!hasScores) {
    await knex.schema.createTable("kktp_student_scores", (table) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("assessment_tp_id", 36).notNullable();
      table.string("student_id", 36).notNullable();
      table.string("student_enrollment_id", 36).nullable();
      table.decimal("score", 5, 2).nullable();
      table.enum("evidence_status", ["SUFFICIENT", "PARTIAL", "INSUFFICIENT"]).nullable();
      table.text("reflection").nullable();
      table.string("status", 50).notNullable().defaultTo("active");
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.unique(["assessment_id", "student_id", "assessment_tp_id"], {
        indexName: "uq_kktp_student_tp_score",
      });
      table.index(["student_id", "assessment_id"], "idx_kktp_score_student_ass");
      table.foreign("assessment_id", "fk_kktp_score_ass").references("id").inTable("kktp_assessments").onDelete("CASCADE");
      table.foreign("assessment_tp_id", "fk_kktp_score_atp").references("id").inTable("kktp_assessment_tps").onDelete("CASCADE");
      table.foreign("student_id", "fk_kktp_score_student").references("id").inTable("students").onDelete("CASCADE");
      table.foreign("student_enrollment_id", "fk_kktp_score_enr").references("id").inTable("student_enrollments").onDelete("SET NULL");
    });
  }

  // 4. kktp_student_summaries
  const hasSummaries = await knex.schema.hasTable("kktp_student_summaries");
  if (!hasSummaries) {
    await knex.schema.createTable("kktp_student_summaries", (table) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("student_id", 36).notNullable();
      table.decimal("average_score", 5, 2).nullable();
      table.string("predicate", 50).nullable();
      table.text("competency_description").nullable();
      table.text("catatan_tutor").nullable();
      table.enum("status", ["DRAFT", "COMPLETED"]).notNullable().defaultTo("DRAFT");
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.unique(["assessment_id", "student_id"], {
        indexName: "uq_kktp_student_summary",
      });
      table.foreign("assessment_id", "fk_kktp_sum_ass").references("id").inTable("kktp_assessments").onDelete("CASCADE");
      table.foreign("student_id", "fk_kktp_sum_student").references("id").inTable("students").onDelete("CASCADE");
    });
  }

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.schema.dropTableIfExists("kktp_student_summaries");
  await knex.schema.dropTableIfExists("kktp_student_scores");
  await knex.schema.dropTableIfExists("kktp_assessment_tps");
  await knex.schema.dropTableIfExists("kktp_assessments");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
