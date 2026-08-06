import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Disable foreign key checks for clean drop and create
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  // 1. Drop old summary tables & old culture_scores table
  await knex.raw("DROP TABLE IF EXISTS `character_utsman_semester_summary`;");
  await knex.raw("DROP TABLE IF EXISTS `character_semester_summaries`;");
  await knex.raw("DROP TABLE IF EXISTS `character_monthly_summaries`;");
  await knex.raw("DROP TABLE IF EXISTS `character_weekly_summaries`;");
  await knex.raw("DROP TABLE IF EXISTS `culture_scores`;");

  // 2. Create new culture_scores table (Weekly SAHABAT Assessment)
  await knex.raw(`
    CREATE TABLE \`culture_scores\` (
      \`id\` CHAR(36) NOT NULL,
      \`student_id\` CHAR(36) NOT NULL,
      \`student_enrollment_id\` CHAR(36) NULL,
      \`class_id\` CHAR(36) NULL,
      \`teacher_user_id\` CHAR(36) NULL,
      \`academic_year_id\` CHAR(36) NULL,
      \`semester_id\` CHAR(36) NOT NULL,
      \`week_start_date\` DATE NOT NULL,
      \`week_end_date\` DATE NOT NULL,
      \`sss_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`am_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`hb_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`asm_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`br_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`ak_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`tm_score\` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      \`observation_note\` TEXT NULL,
      \`status\` VARCHAR(50) NOT NULL DEFAULT 'active',
      \`lifecycle_status\` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_student_week_semester\` (\`student_id\`, \`week_start_date\`, \`semester_id\`),
      INDEX \`idx_culture_class_week\` (\`class_id\`, \`week_start_date\`, \`status\`),
      INDEX \`idx_culture_student_semester\` (\`student_id\`, \`semester_id\`, \`week_start_date\`),
      CONSTRAINT \`fk_cult_score_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_cult_score_enrollment\` FOREIGN KEY (\`student_enrollment_id\`) REFERENCES \`student_enrollments\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_cult_score_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`classes\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_cult_score_teacher\` FOREIGN KEY (\`teacher_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_cult_score_year\` FOREIGN KEY (\`academic_year_id\`) REFERENCES \`academic_years\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_cult_score_semester\` FOREIGN KEY (\`semester_id\`) REFERENCES \`semesters\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`chk_sss_score\` CHECK (\`sss_score\` BETWEEN 0 AND 4),
      CONSTRAINT \`chk_am_score\` CHECK (\`am_score\` BETWEEN 0 AND 4),
      CONSTRAINT \`chk_hb_score\` CHECK (\`hb_score\` BETWEEN 0 AND 4),
      CONSTRAINT \`chk_asm_score\` CHECK (\`asm_score\` BETWEEN 0 AND 4),
      CONSTRAINT \`chk_br_score\` CHECK (\`br_score\` BETWEEN 0 AND 4),
      CONSTRAINT \`chk_ak_score\` CHECK (\`ak_score\` BETWEEN 0 AND 4),
      CONSTRAINT \`chk_tm_score\` CHECK (\`tm_score\` BETWEEN 0 AND 4)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Create new character_utsman_semester_summary table (UTSMAN Semester Summary)
  await knex.raw(`
    CREATE TABLE \`character_utsman_semester_summary\` (
      \`id\` CHAR(36) NOT NULL,
      \`student_id\` CHAR(36) NOT NULL,
      \`academic_year_id\` CHAR(36) NULL,
      \`semester_id\` CHAR(36) NOT NULL,
      \`u_score\` DECIMAL(4,2) NULL,
      \`t_score\` DECIMAL(4,2) NULL,
      \`s_score\` DECIMAL(4,2) NULL,
      \`m_score\` DECIMAL(4,2) NULL,
      \`a_score\` DECIMAL(4,2) NULL,
      \`n_score\` DECIMAL(4,2) NULL,
      \`calculation_version\` VARCHAR(20) NOT NULL DEFAULT 'v1.0',
      \`locked_at\` DATETIME NULL,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_student_utsman_semester\` (\`student_id\`, \`semester_id\`),
      INDEX \`idx_utsman_semester_lookup\` (\`semester_id\`, \`student_id\`),
      CONSTRAINT \`fk_utsman_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_utsman_year\` FOREIGN KEY (\`academic_year_id\`) REFERENCES \`academic_years\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_utsman_semester\` FOREIGN KEY (\`semester_id\`) REFERENCES \`semesters\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Enable foreign key checks
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.raw("DROP TABLE IF EXISTS `character_utsman_semester_summary`;");
  await knex.raw("DROP TABLE IF EXISTS `culture_scores`;");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
