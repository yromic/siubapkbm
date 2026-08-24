import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`documents\` (
      \`id\` CHAR(36) NOT NULL,
      \`type\` ENUM('RPM', 'KKTP', 'TRISULA', 'BLC_PACKAGE', 'TABAYYUN') NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`author_id\` CHAR(36) NOT NULL,
      \`class_id\` CHAR(36) NULL,
      \`subject_id\` CHAR(36) NULL,
      \`semester_id\` CHAR(36) NULL,
      \`status\` ENUM('DRAFT', 'PUBLISHED', 'APPROVED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
      \`version\` INT NOT NULL DEFAULT 1,
      \`content\` JSON NOT NULL,
      \`forked_from_id\` CHAR(36) NULL,
      \`reviewed_by\` CHAR(36) NULL,
      \`reviewed_at\` DATETIME NULL,
      \`approved_by\` CHAR(36) NULL,
      \`approved_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_documents_type_status\` (\`type\`, \`status\`),
      INDEX \`idx_documents_author\` (\`author_id\`),
      INDEX \`idx_documents_class_subject_semester\` (\`class_id\`, \`subject_id\`, \`semester_id\`),
      CONSTRAINT \`fk_documents_author\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_documents_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`classes\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_documents_subject\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_documents_semester\` FOREIGN KEY (\`semester_id\`) REFERENCES \`semesters\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_documents_forked_from\` FOREIGN KEY (\`forked_from_id\`) REFERENCES \`documents\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_documents_reviewed_by\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_documents_approved_by\` FOREIGN KEY (\`approved_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.raw("DROP TABLE IF EXISTS `documents`;");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
