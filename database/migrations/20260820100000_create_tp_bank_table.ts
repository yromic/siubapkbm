import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS \`tp_bank\` (
      \`id\` CHAR(36) NOT NULL,
      \`teks\` TEXT NOT NULL,
      \`mata_pelajaran_id\` CHAR(36) NULL,
      \`mata_pelajaran_name\` VARCHAR(255) NULL,
      \`fase\` VARCHAR(50) NOT NULL DEFAULT 'Fase C',
      \`sumber\` ENUM('dari_rpm', 'manual') NOT NULL DEFAULT 'manual',
      \`created_by\` CHAR(36) NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_tp_bank_mapel_fase\` (\`mata_pelajaran_id\`, \`fase\`),
      INDEX \`idx_tp_bank_created_by\` (\`created_by\`),
      INDEX \`idx_tp_bank_fase\` (\`fase\`),
      CONSTRAINT \`fk_tp_bank_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_tp_bank_subject\` FOREIGN KEY (\`mata_pelajaran_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.raw("DROP TABLE IF EXISTS `tp_bank`;");
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
