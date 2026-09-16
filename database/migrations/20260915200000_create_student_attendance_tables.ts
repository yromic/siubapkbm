import type { Knex } from "knex";

/**
 * Migration: Create student_attendance_sessions and student_attendance_records tables
 *
 * Implements the authoritative Student Attendance schema:
 * - student_attendance_sessions: daily attendance session per class and semester
 * - student_attendance_records: individual student daily attendance statuses and notes
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  // 1. student_attendance_sessions
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`student_attendance_sessions\` (
      \`id\` CHAR(36) NOT NULL,
      \`class_id\` CHAR(36) NOT NULL,
      \`attendance_date\` DATE NOT NULL,
      \`academic_year_id\` CHAR(36) NOT NULL,
      \`semester_id\` CHAR(36) NOT NULL,
      \`recorded_by\` CHAR(36) NOT NULL,
      \`updated_by\` CHAR(36) NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_student_att_session\` (\`class_id\`, \`attendance_date\`, \`semester_id\`),
      INDEX \`idx_att_session_date\` (\`attendance_date\`),
      INDEX \`idx_att_session_semester\` (\`semester_id\`),
      CONSTRAINT \`fk_att_sess_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`classes\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_att_sess_year\` FOREIGN KEY (\`academic_year_id\`) REFERENCES \`academic_years\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_att_sess_sem\` FOREIGN KEY (\`semester_id\`) REFERENCES \`semesters\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_att_sess_creator\` FOREIGN KEY (\`recorded_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_att_sess_updater\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. student_attendance_records
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`student_attendance_records\` (
      \`id\` CHAR(36) NOT NULL,
      \`session_id\` CHAR(36) NOT NULL,
      \`student_id\` CHAR(36) NOT NULL,
      \`student_enrollment_id\` CHAR(36) NOT NULL,
      \`status\` ENUM('hadir', 'sakit', 'izin', 'alpa', 'terlambat') NOT NULL DEFAULT 'hadir',
      \`note\` VARCHAR(255) NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_att_record_student\` (\`session_id\`, \`student_id\`),
      INDEX \`idx_att_record_student_lookup\` (\`student_id\`),
      INDEX \`idx_att_record_enrollment\` (\`student_enrollment_id\`),
      CONSTRAINT \`fk_att_rec_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`student_attendance_sessions\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_att_rec_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_att_rec_enrollment\` FOREIGN KEY (\`student_enrollment_id\`) REFERENCES \`student_enrollments\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.raw("DROP TABLE IF EXISTS `student_attendance_records`;");
  await knex.raw("DROP TABLE IF EXISTS `student_attendance_sessions`;");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
