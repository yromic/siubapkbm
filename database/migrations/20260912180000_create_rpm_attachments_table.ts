import type { Knex } from "knex";

/**
 * Migration: Create rpm_attachments table
 *
 * Dedicated table for supporting RPM academic attachments (LKPD, Rubrik, Bahan Ajar, etc.)
 * Binary files are saved to private storage (storage/uploads/rpm_attachments/),
 * while metadata and parent link (documents.id) reside in this table.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`rpm_attachments\` (
      \`id\` CHAR(36) NOT NULL,
      \`document_id\` CHAR(36) NOT NULL,
      \`attachment_type\` ENUM(
        'LKPD',
        'BAHAN_AJAR',
        'RUBRIK',
        'INSTRUMEN_ASESMEN',
        'MEDIA_PENDUKUNG',
        'DOKUMEN_PENDUKUNG',
        'LAINNYA'
      ) NOT NULL DEFAULT 'LKPD',
      \`title\` VARCHAR(255) NOT NULL,
      \`description\` TEXT NULL,
      \`file_path\` VARCHAR(500) NOT NULL,
      \`original_filename\` VARCHAR(255) NOT NULL,
      \`mime_type\` VARCHAR(127) NOT NULL,
      \`file_size\` INT UNSIGNED NOT NULL,
      \`sort_order\` INT NOT NULL DEFAULT 0,
      \`created_by\` CHAR(36) NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_rpm_attachments_doc_order\` (\`document_id\`, \`sort_order\`),
      INDEX \`idx_rpm_attachments_creator\` (\`created_by\`),
      CONSTRAINT \`fk_rpm_attachments_document\` FOREIGN KEY (\`document_id\`) REFERENCES \`documents\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_rpm_attachments_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.raw("DROP TABLE IF EXISTS `rpm_attachments`;");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
