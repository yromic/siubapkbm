import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getDocumentById } from "@/lib/services/documentService";
import { canViewDocument, canEditDocument } from "@/lib/permissions/documents";
import {
  RPMAttachment,
  RPMAttachmentInput,
  RPMAttachmentMetadataUpdate,
  RPMAttachmentType,
} from "@/types/rpmAttachment";
import {
  validateAttachmentBuffer,
  sanitizeOriginalFilename,
  deriveDefaultTitle,
  buildStorageFilename,
  isValidAttachmentType,
} from "@/lib/utils/rpmAttachmentUtils";

const RPM_ATTACHMENTS_DIR = path.join(process.cwd(), "storage", "uploads", "rpm_attachments");

/**
 * Ensures private storage directory exists.
 */
export function ensureRpmAttachmentsDirectory(): void {
  if (!fs.existsSync(RPM_ATTACHMENTS_DIR)) {
    fs.mkdirSync(RPM_ATTACHMENTS_DIR, { recursive: true });
  }
}

/**
 * Auto-migration helper: Ensures rpm_attachments table exists dynamically in database.
 */
export async function ensureRpmAttachmentsTableExists(): Promise<void> {
  const hasTable = await db.schema.hasTable("rpm_attachments");
  if (!hasTable) {
    await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
    await db.raw(`
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
    await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
  }
  ensureRpmAttachmentsDirectory();
}

/**
 * Maps database row to client RPMAttachment object.
 */
function mapRowToAttachment(row: any): RPMAttachment {
  const isPreviewable =
    row.mime_type === "application/pdf" ||
    row.mime_type.startsWith("image/");

  return {
    id: row.id,
    documentId: row.document_id,
    attachmentType: row.attachment_type as RPMAttachmentType,
    title: row.title,
    description: row.description || null,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    sortOrder: Number(row.sort_order || 0),
    createdBy: row.created_by,
    creatorName: row.creator_name || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    downloadUrl: `/api/v1/rpm/${row.document_id}/attachments/${row.id}/download?download=1`,
    previewUrl: isPreviewable
      ? `/api/v1/rpm/${row.document_id}/attachments/${row.id}/download?preview=1`
      : null,
  };
}

/**
 * List all attachments for an RPM document.
 * Requires read permission on the parent RPM.
 */
export async function listRpmAttachments(
  documentId: string,
  user: { id: string; role: string }
): Promise<RPMAttachment[]> {
  await ensureRpmAttachmentsTableExists();

  const doc = await getDocumentById(documentId, user);
  if (!canViewDocument(user, doc)) {
    throw new AppError("Anda tidak memiliki akses ke dokumen RPM ini.", "ERR_FORBIDDEN", 403);
  }

  const rows = await db("rpm_attachments")
    .leftJoin("users", "rpm_attachments.created_by", "users.id")
    .select("rpm_attachments.*", "users.name as creator_name")
    .where("rpm_attachments.document_id", documentId)
    .orderBy("rpm_attachments.sort_order", "asc")
    .orderBy("rpm_attachments.created_at", "asc");

  return rows.map(mapRowToAttachment);
}

/**
 * Upload an attachment to an RPM document.
 * Requires edit permission on the parent RPM.
 * Atomic file-write & failure-safe DB registration.
 */
export async function uploadRpmAttachment(
  documentId: string,
  file: File | Blob,
  input: RPMAttachmentInput,
  user: { id: string; role: string }
): Promise<RPMAttachment> {
  await ensureRpmAttachmentsTableExists();

  const doc = await getDocumentById(documentId, user);
  if (!canEditDocument(user, doc)) {
    throw new AppError(
      "Anda tidak memiliki izin untuk menambahkan lampiran pada dokumen ini.",
      "ERR_FORBIDDEN",
      403
    );
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    throw new AppError("File lampiran wajib diunggah.", "ERR_VALIDATION", 400);
  }

  const originalFilename = sanitizeOriginalFilename((file as any).name || "attachment");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Magic byte inspection and format/size validation
  const validation = validateAttachmentBuffer(buffer, originalFilename);
  if (!validation.valid) {
    throw new AppError(validation.error || "Validasi file gagal.", "ERR_VALIDATION", 400);
  }

  const attachmentType = isValidAttachmentType(input.attachmentType)
    ? input.attachmentType
    : "LKPD";

  const title = input.title?.trim() || deriveDefaultTitle(originalFilename);
  const description = input.description?.trim() || null;

  ensureRpmAttachmentsDirectory();
  const attachmentId = uuidv4();
  const storageFilename = buildStorageFilename(attachmentId, validation.detectedExt!);
  const filePath = path.join(RPM_ATTACHMENTS_DIR, storageFilename);

  // 1. Write file to private disk
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    throw new AppError(
      `Gagal menyimpan file ke penyimpanan server: ${err instanceof Error ? err.message : "Disk error"}`,
      "ERR_STORAGE",
      500
    );
  }

  // 2. Determine sort order (append to end)
  const maxOrderRes = await db("rpm_attachments")
    .where("document_id", documentId)
    .max("sort_order as max_order")
    .first();
  const nextOrder = (maxOrderRes?.max_order ?? -1) + 1;

  const now = new Date();
  const row = {
    id: attachmentId,
    document_id: documentId,
    attachment_type: attachmentType,
    title,
    description,
    file_path: filePath,
    original_filename: originalFilename,
    mime_type: validation.mimeType!,
    file_size: buffer.length,
    sort_order: nextOrder,
    created_by: user.id,
    created_at: now,
    updated_at: now,
  };

  // 3. Save metadata to DB; if DB fails, rollback physical file immediately
  try {
    await db("rpm_attachments").insert(row);
  } catch (dbError) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore unlink error during rollback
      }
    }
    throw new AppError(
      `Gagal menyimpan metadata lampiran ke database: ${dbError instanceof Error ? dbError.message : "DB error"}`,
      "ERR_DATABASE",
      500
    );
  }

  return mapRowToAttachment({
    ...row,
    creator_name: user.role,
  });
}

/**
 * Update metadata (title, type, description, sort_order) without touching physical binary.
 */
export async function updateRpmAttachmentMetadata(
  documentId: string,
  attachmentId: string,
  input: RPMAttachmentMetadataUpdate,
  user: { id: string; role: string }
): Promise<RPMAttachment> {
  await ensureRpmAttachmentsTableExists();

  const doc = await getDocumentById(documentId, user);
  if (!canEditDocument(user, doc)) {
    throw new AppError("Anda tidak memiliki izin untuk mengubah lampiran ini.", "ERR_FORBIDDEN", 403);
  }

  const existing = await db("rpm_attachments")
    .where({ id: attachmentId, document_id: documentId })
    .first();

  if (!existing) {
    throw new AppError("Lampiran tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const updates: Record<string, any> = {
    updated_at: new Date(),
  };

  if (input.title !== undefined) {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new AppError("Judul lampiran tidak boleh kosong.", "ERR_VALIDATION", 400);
    }
    updates.title = trimmedTitle;
  }

  if (input.attachmentType !== undefined) {
    if (!isValidAttachmentType(input.attachmentType)) {
      throw new AppError("Jenis lampiran tidak valid.", "ERR_VALIDATION", 400);
    }
    updates.attachment_type = input.attachmentType;
  }

  if (input.description !== undefined) {
    updates.description = input.description ? input.description.trim() : null;
  }

  if (input.sortOrder !== undefined) {
    updates.sort_order = Number(input.sortOrder);
  }

  await db("rpm_attachments")
    .where({ id: attachmentId, document_id: documentId })
    .update(updates);

  const updatedRow = await db("rpm_attachments")
    .leftJoin("users", "rpm_attachments.created_by", "users.id")
    .select("rpm_attachments.*", "users.name as creator_name")
    .where("rpm_attachments.id", attachmentId)
    .first();

  return mapRowToAttachment(updatedRow);
}

/**
 * Delete attachment: removes database metadata and unlinks physical file from private disk.
 */
export async function deleteRpmAttachment(
  documentId: string,
  attachmentId: string,
  user: { id: string; role: string }
): Promise<{ success: boolean; deleted_id: string }> {
  await ensureRpmAttachmentsTableExists();

  const doc = await getDocumentById(documentId, user);
  if (!canEditDocument(user, doc)) {
    throw new AppError("Anda tidak memiliki izin untuk menghapus lampiran ini.", "ERR_FORBIDDEN", 403);
  }

  const existing = await db("rpm_attachments")
    .where({ id: attachmentId, document_id: documentId })
    .first();

  if (!existing) {
    throw new AppError("Lampiran tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  // 1. Delete DB record first
  await db("rpm_attachments").where({ id: attachmentId }).delete();

  // 2. Remove physical file from disk
  if (existing.file_path && fs.existsSync(existing.file_path)) {
    try {
      fs.unlinkSync(existing.file_path);
    } catch (err) {
      console.error(`Failed to unlink attachment file at ${existing.file_path}:`, err);
    }
  }

  return { success: true, deleted_id: attachmentId };
}

/**
 * Reorder attachments for a document.
 */
export async function reorderRpmAttachments(
  documentId: string,
  orderedIds: string[],
  user: { id: string; role: string }
): Promise<RPMAttachment[]> {
  await ensureRpmAttachmentsTableExists();

  const doc = await getDocumentById(documentId, user);
  if (!canEditDocument(user, doc)) {
    throw new AppError("Anda tidak memiliki izin untuk mengubah urutan lampiran.", "ERR_FORBIDDEN", 403);
  }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError("Daftar ID lampiran tidak valid.", "ERR_VALIDATION", 400);
  }

  await db.transaction(async (trx) => {
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index];
      await trx("rpm_attachments")
        .where({ id, document_id: documentId })
        .update({ sort_order: index, updated_at: new Date() });
    }
  });

  return listRpmAttachments(documentId, user);
}

/**
 * Retrieve attachment binary and metadata for authorized streaming.
 * Enforces permission checks against the parent document.
 */
export async function getRpmAttachmentForDownload(
  documentId: string,
  attachmentId: string,
  user: { id: string; role: string }
): Promise<{
  attachment: RPMAttachment;
  filePath: string;
  fileBuffer: Buffer;
}> {
  await ensureRpmAttachmentsTableExists();

  const doc = await getDocumentById(documentId, user);
  if (!canViewDocument(user, doc)) {
    throw new AppError("Anda tidak memiliki izin untuk mengakses berkas dokumen ini.", "ERR_FORBIDDEN", 403);
  }

  const row = await db("rpm_attachments")
    .where({ id: attachmentId, document_id: documentId })
    .first();

  if (!row) {
    throw new AppError("Lampiran tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  if (!fs.existsSync(row.file_path)) {
    throw new AppError("File lampiran tidak tersedia di server.", "ERR_NOT_FOUND", 404);
  }

  const fileBuffer = fs.readFileSync(row.file_path);
  return {
    attachment: mapRowToAttachment(row),
    filePath: row.file_path,
    fileBuffer,
  };
}

/**
 * Cleans up all attachment files on disk when a document is deleted.
 * Invoked by deleteDocument in documentService.
 */
export async function cleanupRpmAttachmentsForDocument(documentId: string): Promise<void> {
  try {
    const hasTable = await db.schema.hasTable("rpm_attachments");
    if (!hasTable) return;

    const rows = await db("rpm_attachments").where("document_id", documentId).select("file_path");
    for (const row of rows) {
      if (row.file_path && fs.existsSync(row.file_path)) {
        try {
          fs.unlinkSync(row.file_path);
        } catch (err) {
          console.error(`Error deleting attachment file ${row.file_path}:`, err);
        }
      }
    }
    // Foreign key CASCADE will delete the DB rows, but run explicit delete as safeguard
    await db("rpm_attachments").where("document_id", documentId).delete();
  } catch (err) {
    console.error(`Error in cleanupRpmAttachmentsForDocument for ${documentId}:`, err);
  }
}
