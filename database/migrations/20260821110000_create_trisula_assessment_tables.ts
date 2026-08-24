import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1. trisula_assessments
  const hasAssessments = await knex.schema.hasTable("trisula_assessments");
  if (!hasAssessments) {
    await knex.schema.createTable("trisula_assessments", (table) => {
      table.string("id", 36).primary();
      table.string("title", 255).notNullable();
      table.string("class_id", 36).notNullable();
      table.string("academic_year_id", 36).notNullable();
      table.string("semester_id", 36).notNullable();
      table.string("fase", 50).notNullable();
      table.enum("status", ["DRAFT", "IN_PROGRESS", "FINALIZED"]).notNullable().defaultTo("DRAFT");
      table.string("created_by", 36).nullable();
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.index(["class_id", "academic_year_id", "semester_id"], "idx_trisula_assessment_context");
      table.foreign("class_id", "fk_trisula_ass_class").references("id").inTable("classes").onDelete("CASCADE");
      table.foreign("academic_year_id", "fk_trisula_ass_year").references("id").inTable("academic_years").onDelete("CASCADE");
      table.foreign("semester_id", "fk_trisula_ass_sem").references("id").inTable("semesters").onDelete("CASCADE");
      table.foreign("created_by", "fk_trisula_ass_creator").references("id").inTable("users").onDelete("SET NULL");
    });
  }

  // 2. trisula_assessment_curriculum
  const hasCurriculum = await knex.schema.hasTable("trisula_assessment_curriculum");
  if (!hasCurriculum) {
    await knex.schema.createTable("trisula_assessment_curriculum", (table) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.enum("pillar", ["LITERASI", "NUMERASI", "DINIYYAH"]).notNullable();
      table.string("cp_id", 36).nullable();
      table.string("tp_id", 36).notNullable();
      table.text("cp_text_snapshot").nullable();
      table.text("tp_text_snapshot").notNullable();
      table.dateTime("created_at").defaultTo(knex.fn.now());

      table.index(["assessment_id", "pillar"], "idx_trisula_curr_ass_pillar");
      table.foreign("assessment_id", "fk_trisula_curr_ass").references("id").inTable("trisula_assessments").onDelete("CASCADE");
      table.foreign("cp_id", "fk_trisula_curr_cp").references("id").inTable("cp_bank").onDelete("SET NULL");
      table.foreign("tp_id", "fk_trisula_curr_tp").references("id").inTable("tp_bank").onDelete("CASCADE");
    });
  }

  // 3. trisula_student_scores
  const hasScores = await knex.schema.hasTable("trisula_student_scores");
  if (!hasScores) {
    await knex.schema.createTable("trisula_student_scores", (table) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("student_id", 36).notNullable();
      table.string("student_enrollment_id", 36).notNullable();
      table.enum("pillar", ["LITERASI", "NUMERASI", "DINIYYAH"]).notNullable();
      table.string("tp_id", 36).nullable();
      table.decimal("score", 5, 2).nullable();
      table.enum("evidence_status", ["SUFFICIENT", "PARTIAL", "INSUFFICIENT"]).nullable();
      table.text("observation_text").nullable();
      table.text("achievement_description").nullable();
      table.text("recommendation").nullable();
      table.enum("source", ["MANUAL", "AI_ASSISTED"]).notNullable().defaultTo("MANUAL");
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.unique(["assessment_id", "student_id", "pillar", "tp_id"], { indexName: "uq_trisula_student_score" });
      table.foreign("assessment_id", "fk_trisula_score_ass").references("id").inTable("trisula_assessments").onDelete("CASCADE");
      table.foreign("student_id", "fk_trisula_score_student").references("id").inTable("students").onDelete("CASCADE");
      table.foreign("student_enrollment_id", "fk_trisula_score_enr").references("id").inTable("student_enrollments").onDelete("CASCADE");
    });
  }

  // 4. trisula_student_summaries
  const hasSummaries = await knex.schema.hasTable("trisula_student_summaries");
  if (!hasSummaries) {
    await knex.schema.createTable("trisula_student_summaries", (table) => {
      table.string("id", 36).primary();
      table.string("assessment_id", 36).notNullable();
      table.string("student_id", 36).notNullable();
      table.decimal("literasi_score", 5, 2).nullable();
      table.decimal("numerasi_score", 5, 2).nullable();
      table.decimal("diniyyah_score", 5, 2).nullable();
      table.decimal("overall_score", 5, 2).nullable();
      table.text("literasi_description").nullable();
      table.text("numerasi_description").nullable();
      table.text("diniyyah_description").nullable();
      table.text("catatan_rangkuman").nullable();
      table.text("pesan_orang_tua").nullable();
      table.enum("status", ["DRAFT", "COMPLETED"]).notNullable().defaultTo("DRAFT");
      table.dateTime("created_at").defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());

      table.unique(["assessment_id", "student_id"], { indexName: "uq_trisula_student_summary" });
      table.foreign("assessment_id", "fk_trisula_sum_ass").references("id").inTable("trisula_assessments").onDelete("CASCADE");
      table.foreign("student_id", "fk_trisula_sum_student").references("id").inTable("students").onDelete("CASCADE");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("trisula_student_summaries");
  await knex.schema.dropTableIfExists("trisula_student_scores");
  await knex.schema.dropTableIfExists("trisula_assessment_curriculum");
  await knex.schema.dropTableIfExists("trisula_assessments");
}
