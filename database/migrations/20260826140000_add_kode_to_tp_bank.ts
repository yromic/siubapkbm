import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTpBank = await knex.schema.hasTable("tp_bank");
  if (hasTpBank) {
    const hasKode = await knex.schema.hasColumn("tp_bank", "kode");
    if (!hasKode) {
      await knex.raw(`
        ALTER TABLE \`tp_bank\`
        ADD COLUMN \`kode\` VARCHAR(100) NULL AFTER \`cp_id\`,
        ADD INDEX \`idx_tp_bank_kode\` (\`kode\`);
      `);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTpBank = await knex.schema.hasTable("tp_bank");
  if (hasTpBank) {
    const hasKode = await knex.schema.hasColumn("tp_bank", "kode");
    if (hasKode) {
      await knex.raw(`
        ALTER TABLE \`tp_bank\`
        DROP INDEX \`idx_tp_bank_kode\`,
        DROP COLUMN \`kode\`;
      `);
    }
  }
}
