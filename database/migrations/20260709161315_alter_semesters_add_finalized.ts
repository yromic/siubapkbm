import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE semesters 
    MODIFY COLUMN lifecycle_status ENUM('draft', 'active', 'locked', 'archived', 'soft_deleted', 'finalized') 
    NOT NULL DEFAULT 'draft'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE semesters 
    MODIFY COLUMN lifecycle_status ENUM('draft', 'active', 'locked', 'archived', 'soft_deleted') 
    NOT NULL DEFAULT 'draft'
  `);
}
