import type { Knex } from "knex";

/**
 * Migration: Tambahkan kolom tanda tangan resmi dan berbagi BLC ke tabel documents.
 * Hanya digunakan oleh alur dokumen type = 'RPM'.
 * Tidak memengaruhi logika KKTP / TRISULA sama sekali.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

  const hasBlcSharedAt = await knex.schema.hasColumn("documents", "blc_shared_at");
  const hasSignedBy = await knex.schema.hasColumn("documents", "signed_by");
  const hasSignedAt = await knex.schema.hasColumn("documents", "signed_at");

  if (!hasBlcSharedAt || !hasSignedBy || !hasSignedAt) {
    await knex.schema.alterTable("documents", (table) => {
      if (!hasBlcSharedAt) {
        // Timestamp saat guru memilih berbagi RPM ke Bank Modul BLC.
        // NULL = belum dibagikan. Diisi oleh action SHARE_TO_BLC, dikosongkan oleh UNSHARE_FROM_BLC.
        table.dateTime("blc_shared_at").nullable().defaultTo(null);
        table.index("blc_shared_at", "idx_documents_blc_shared");
      }
      if (!hasSignedBy) {
        // FK ke users.id — administrator yang menandatangani secara resmi.
        // NULL = belum ditandatangani. Otomatis direset ke NULL jika konten RPM diedit setelah ditandatangani.
        table.string("signed_by", 36).nullable().defaultTo(null)
          .references("id").inTable("users").onDelete("SET NULL");
      }
      if (!hasSignedAt) {
        // Timestamp tanda tangan resmi. NULL = belum ditandatangani.
        table.dateTime("signed_at").nullable().defaultTo(null);
      }
    });
  }

  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  await knex.schema.alterTable("documents", (table) => {
    table.dropIndex("blc_shared_at", "idx_documents_blc_shared");
    table.dropColumn("blc_shared_at");
    table.dropColumn("signed_by");
    table.dropColumn("signed_at");
  });
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
