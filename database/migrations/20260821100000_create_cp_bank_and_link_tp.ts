import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create cp_bank table
  const hasCpBank = await knex.schema.hasTable('cp_bank');
  if (!hasCpBank) {
    await knex.raw(`
      CREATE TABLE IF NOT EXISTS \`cp_bank\` (
        \`id\` CHAR(36) NOT NULL,
        \`kode\` VARCHAR(100) NULL,
        \`teks\` TEXT NOT NULL,
        \`fase\` VARCHAR(50) NOT NULL DEFAULT 'Fase C',
        \`mata_pelajaran_id\` CHAR(36) NULL,
        \`mata_pelajaran_name\` VARCHAR(255) NULL,
        \`domain_trisula\` VARCHAR(50) NULL,
        \`sumber\` ENUM('OFFICIAL', 'INTERNAL_BLC', 'MANUAL', 'AI_ASSISTED') NOT NULL DEFAULT 'INTERNAL_BLC',
        \`status\` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        \`created_by\` CHAR(36) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_cp_bank_mapel_fase\` (\`mata_pelajaran_id\`, \`fase\`),
        INDEX \`idx_cp_bank_fase\` (\`fase\`),
        INDEX \`idx_cp_bank_sumber\` (\`sumber\`),
        INDEX \`idx_cp_bank_domain_trisula\` (\`domain_trisula\`),
        CONSTRAINT \`fk_cp_bank_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_cp_bank_subject\` FOREIGN KEY (\`mata_pelajaran_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  // 2. Add cp_id column to tp_bank if not exists
  const hasTpBank = await knex.schema.hasTable('tp_bank');
  if (hasTpBank) {
    const hasCpId = await knex.schema.hasColumn('tp_bank', 'cp_id');
    if (!hasCpId) {
      await knex.raw(`
        ALTER TABLE \`tp_bank\`
        ADD COLUMN \`cp_id\` CHAR(36) NULL AFTER \`teks\`,
        ADD INDEX \`idx_tp_bank_cp_id\` (\`cp_id\`),
        ADD CONSTRAINT \`fk_tp_bank_cp\` FOREIGN KEY (\`cp_id\`) REFERENCES \`cp_bank\` (\`id\`) ON DELETE SET NULL;
      `);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTpBank = await knex.schema.hasTable('tp_bank');
  if (hasTpBank) {
    const hasCpId = await knex.schema.hasColumn('tp_bank', 'cp_id');
    if (hasCpId) {
      await knex.raw(`
        ALTER TABLE \`tp_bank\`
        DROP FOREIGN KEY \`fk_tp_bank_cp\`,
        DROP COLUMN \`cp_id\`;
      `);
    }
  }

  const hasCpBank = await knex.schema.hasTable('cp_bank');
  if (hasCpBank) {
    await knex.schema.dropTableIfExists('cp_bank');
  }
}
