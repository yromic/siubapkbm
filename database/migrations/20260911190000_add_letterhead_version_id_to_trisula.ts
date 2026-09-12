import type { Knex } from "knex";

/**
 * Migration: Add letterhead_version_id to trisula_assessments
 *
 * This column records which institutional letterhead was active
 * when the Trisula assessment period was established.
 *
 * - Nullable: existing rows are unaffected (they fall back to active_letterhead_url).
 * - No FK: letterhead versions are stored in app_settings JSON, not a SQL table.
 * - Immutable once set (application-level guard in service layer).
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(
    "trisula_assessments",
    "letterhead_version_id"
  );
  if (!hasColumn) {
    await knex.schema.alterTable("trisula_assessments", (table) => {
      table
        .string("letterhead_version_id", 64)
        .nullable()
        .after("created_by")
        .comment(
          "UUID of the institutional letterhead version active when this assessment was created. References app_settings letterhead_versions JSON."
        );
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(
    "trisula_assessments",
    "letterhead_version_id"
  );
  if (hasColumn) {
    await knex.schema.alterTable("trisula_assessments", (table) => {
      table.dropColumn("letterhead_version_id");
    });
  }
}
