import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  canViewDocument,
  canEditDocument,
  canReviewDocument,
  canApproveDocument,
  canCloneDocument,
  canDeleteDocument,
  canShareToBLC,
} from "@/lib/permissions/documents";
import { AppError } from "@/lib/errors";
import { VALID_KURNAS } from "@/lib/services/rpmAiService";
import { autoSaveTPsToBank } from "@/lib/services/tpBankService";
import { resolvePhaseByClassLevel, resolvePhaseByClassName } from "@/lib/utils/academicUtils";

/**
 * Resolves authoritative phase for a document.
 * Authority precedence:
 * 1. db("classes").where("id", classId) -> resolvePhaseByClassLevel(classes.level)
 * 2. resolvePhaseByClassName(className)
 * 3. clientFase if valid
 * 4. Fallback "Fase C"
 */
async function resolveCanonicalPhaseForDocument(
  classId?: string | null,
  className?: string | null,
  clientFase?: string | null
): Promise<string> {
  if (classId) {
    const classRecord = await db("classes").where("id", classId).first();
    if (classRecord) {
      return resolvePhaseByClassLevel(classRecord.level ?? classRecord.name);
    }
  }
  if (className) {
    return resolvePhaseByClassName(className);
  }
  if (clientFase && clientFase.startsWith("Fase")) {
    return clientFase;
  }
  return "Fase C";
}

/**
 * Validasi server: dplKurnas hanya boleh berisi 8 nilai baku Profil Lulusan Kurikulum Nasional.
 * Melempar AppError 400 jika ada nilai di luar daftar.
 */
function validateDplKurnas(content: Record<string, any>): void {
  const dplKurnas = content?.identitas?.dplKurnas;
  if (!Array.isArray(dplKurnas) || dplKurnas.length === 0) return; // opsional, skip
  const invalid = dplKurnas.filter((v: string) => !(VALID_KURNAS as readonly string[]).includes(v));
  if (invalid.length > 0) {
    throw new AppError(
      `Nilai dplKurnas tidak valid: ${invalid.join(", ")}. Gunakan hanya dari 8 Profil Lulusan Kurikulum Nasional yang baku.`,
      "ERR_INVALID_DPL_KURNAS",
      400
    );
  }
}

export interface KKTPContent {
  sumberCPTP: {
    sourceType: 'LINKED_RPM' | 'INDEPENDENT_MANUAL';
    sourceRefId?: string | null;
    cpText: string;
    tpText: string;
  };
  metodologi: 'DESKRIPSI_KRITERIA' | 'RUBRIK' | 'INTERVAL_NILAI';
  kriteria: {
    // Interval Nilai structure
    intervalRanges?: Array<{
      minScore: number;
      maxScore: number;
      label: string; // e.g. "Remedial", "Tuntas", "Tuntas + Pengayaan"
      action: 'REMEDIAL' | 'TUNTAS' | 'PENGAYAAN';
    }>;
    // Rubrik structure
    rubrikLevels?: Array<{
      level: number; // 1..4
      label: string; // "Awal Berkembang", "Layak", "Cakap", "Mahir"
      description: string;
    }>;
    // Deskripsi Kriteria structure
    kriteriaList?: Array<{
      id: string;
      deskripsi: string;
    }>;
  };
  thresholdConfig: {
    minPersenTuntas: number; // default 75
    minimumPassingLevel: number; // default 3 for Rubrik
  };
}

/**
 * Standardized Rapor Mapper: Converts any of the 3 KKTP methodologies into a single standardized Rapor result
 */
export function mapKKTPToRaporResult(
  metodologi: 'DESKRIPSI_KRITERIA' | 'RUBRIK' | 'INTERVAL_NILAI',
  inputScoreOrLevelOrCriteriaCount: number,
  content: KKTPContent
) {
  if (metodologi === 'INTERVAL_NILAI') {
    const score = inputScoreOrLevelOrCriteriaCount;
    const ranges = content.kriteria.intervalRanges || [];
    const matched = ranges.find((r) => score >= r.minScore && score <= r.maxScore);
    const isTuntas = matched ? matched.action !== 'REMEDIAL' : score >= (content.thresholdConfig.minPersenTuntas || 75);
    return {
      isTuntas,
      predikat: matched ? matched.label : isTuntas ? "Tuntas" : "Remedial",
      actionNeeded: matched ? matched.action : isTuntas ? 'TUNTAS' : 'REMEDIAL',
      ringkasanDeskripsi: `Skor ${score} - ${matched ? matched.label : (isTuntas ? 'Tuntas Minimal' : 'Memerlukan Remedial')}`,
    };
  }

  if (metodologi === 'RUBRIK') {
    const level = Math.min(Math.max(inputScoreOrLevelOrCriteriaCount, 1), 4);
    const mpl = content.thresholdConfig.minimumPassingLevel || 3;
    const isTuntas = level >= mpl;
    const matchedLevel = (content.kriteria.rubrikLevels || []).find((l) => l.level === level);
    return {
      isTuntas,
      predikat: matchedLevel ? matchedLevel.label : `Level ${level}`,
      actionNeeded: level === 4 ? 'PENGAYAAN' : isTuntas ? 'TUNTAS' : 'REMEDIAL',
      ringkasanDeskripsi: `Mencapai Level ${level} (${matchedLevel?.label || ''}). ${isTuntas ? 'Tuntas Minimal/Mahir' : 'Memerlukan Bimbingan Remedial'}`,
    };
  }

  // DESKRIPSI_KRITERIA
  const totalKriteria = content.kriteria.kriteriaList?.length || 1;
  const achievedKriteria = inputScoreOrLevelOrCriteriaCount;
  const percentage = Math.round((achievedKriteria / totalKriteria) * 100);
  const minPercent = content.thresholdConfig.minPersenTuntas || 75;
  const isTuntas = percentage >= minPercent;

  return {
    isTuntas,
    predikat: isTuntas ? "Tuntas Kriteria" : "Belum Tuntas",
    actionNeeded: isTuntas ? 'TUNTAS' : 'REMEDIAL',
    ringkasanDeskripsi: `Tercapai ${achievedKriteria} dari ${totalKriteria} kriteria (${percentage}% / Min ${minPercent}%). ${isTuntas ? 'Tuntas Kriteria' : 'Remedial pada kriteria yang belum tercapai'}`,
  };
}

export interface CreateDocumentDTO {
  type: 'RPM' | 'KKTP' | 'TRISULA' | 'BLC_PACKAGE' | 'TABAYYUN';
  title: string;
  class_id?: string | null;
  subject_id?: string | null;
  semester_id?: string | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'APPROVED' | 'ARCHIVED';
  content: Record<string, any>;
}

/**
 * Auto-migration helper: Ensures documents table exists dynamically
 */
export async function ensureDocumentsTableExists() {
  const hasTable = await db.schema.hasTable("documents");
  if (!hasTable) {
    await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
    await db.raw(`
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
        \`root_document_id\` CHAR(36) NULL,
        \`clone_count\` INT NOT NULL DEFAULT 0,
        \`reviewed_by\` CHAR(36) NULL,
        \`reviewed_at\` DATETIME NULL,
        \`approved_by\` CHAR(36) NULL,
        \`approved_at\` DATETIME NULL,
        \`blc_shared_at\` DATETIME NULL,
        \`signed_by\` CHAR(36) NULL,
        \`signed_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_documents_type_status\` (\`type\`, \`status\`),
        INDEX \`idx_documents_author\` (\`author_id\`),
        INDEX \`idx_documents_class_subject_semester\` (\`class_id\`, \`subject_id\`, \`semester_id\`),
        INDEX \`idx_documents_root\` (\`root_document_id\`),
        INDEX \`idx_documents_blc_shared\` (\`blc_shared_at\`),
        CONSTRAINT \`fk_documents_author\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_documents_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`classes\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_documents_subject\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_documents_semester\` FOREIGN KEY (\`semester_id\`) REFERENCES \`semesters\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_documents_forked_from\` FOREIGN KEY (\`forked_from_id\`) REFERENCES \`documents\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_documents_reviewed_by\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_documents_approved_by\` FOREIGN KEY (\`approved_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_documents_signed_by\` FOREIGN KEY (\`signed_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
  } else {
    // Pastikan kolom-kolom baru ada pada tabel yang sudah eksis (graceful upgrade)
    const [hasBlcSharedAt, hasSignedBy, hasSignedAt] = await Promise.all([
      db.schema.hasColumn("documents", "blc_shared_at"),
      db.schema.hasColumn("documents", "signed_by"),
      db.schema.hasColumn("documents", "signed_at"),
    ]);
    if (!hasBlcSharedAt || !hasSignedBy || !hasSignedAt) {
      await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
      await db.schema.alterTable("documents", (table: import('knex').Knex.AlterTableBuilder) => {
        if (!hasBlcSharedAt) table.dateTime("blc_shared_at").nullable().defaultTo(null);
        if (!hasSignedBy) table.string("signed_by", 36).nullable().defaultTo(null);
        if (!hasSignedAt) table.dateTime("signed_at").nullable().defaultTo(null);
      });
      await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
    }
  }
}

export async function listDocuments(
  filters: {
    type?: string;
    status?: string;
    author_id?: string;
    class_id?: string;
    subject_id?: string;
    semester_id?: string;
    blc_shared?: boolean;   // RPM: filter berdasarkan blc_shared_at IS NOT NULL
    unsigned?: boolean;     // RPM: filter berdasarkan signed_at IS NULL (untuk admin)
  },
  user: { id: string; role: string },
  page = 1,
  limit = 20
) {
  await ensureDocumentsTableExists();

  const query = db("documents")
    .leftJoin("users as author", "documents.author_id", "author.id")
    .leftJoin("teacher_profiles as author_profile", "author.id", "author_profile.user_id")
    .leftJoin("users as signer", "documents.signed_by", "signer.id")
    .leftJoin("teacher_profiles as signer_profile", "signer.id", "signer_profile.user_id")
    .leftJoin("classes", "documents.class_id", "classes.id")
    .leftJoin("subjects", "documents.subject_id", "subjects.id")
    .leftJoin("semesters", "documents.semester_id", "semesters.id")
    .select(
      "documents.*",
      "author.name as author_name",
      "author_profile.nip as author_nip",
      "author_profile.nuptk as author_nuptk",
      "signer.name as signer_name",
      "signer_profile.nip as signer_nip",
      "signer_profile.nuptk as signer_nuptk",
      "classes.name as class_name",
      "subjects.name as subject_name",
      "semesters.name as semester_name"
    );

  if (filters.type) query.where("documents.type", filters.type);

  // BR-BLC-RPM: Filter BLC untuk RPM berbasis blc_shared_at, bukan status
  if (filters.blc_shared === true) {
    query.whereNotNull("documents.blc_shared_at");
  } else if (filters.status) {
    // Filter status hanya berlaku untuk tipe non-RPM, atau jika tidak ada blc_shared filter
    query.where("documents.status", filters.status);
  }

  // Filter RPM belum ditandatangani (untuk panel admin)
  if (filters.unsigned === true && filters.type === 'RPM') {
    query.whereNull("documents.signed_at");
  }

  if (filters.class_id) query.where("documents.class_id", filters.class_id);
  if (filters.subject_id) query.where("documents.subject_id", filters.subject_id);
  if (filters.semester_id) query.where("documents.semester_id", filters.semester_id);
  if (filters.author_id) query.where("documents.author_id", filters.author_id);

  // Role visibility restriction
  if (user.role !== "administrator" && user.role !== "admin" && user.role !== "operator") {
    query.where((builder: any) => {
      // RPM, KKTP, TRISULA selalu visible (tidak di-gate oleh status DRAFT)
      builder
        .whereIn("documents.type", ["RPM", "KKTP", "TRISULA"])
        .orWhere("documents.status", "!=", "DRAFT")
        .orWhere("documents.author_id", user.id);
    });
  }

  const countResult = await query.clone().clearSelect().count({ count: "documents.id" });
  const total = Number(countResult[0]?.count || 0);

  const offset = (page - 1) * limit;
  const items = await query.orderBy("documents.updated_at", "desc").offset(offset).limit(limit);

  // Parse JSON content if returned as string
  const parsedItems = items.map((doc: any) => ({
    ...doc,
    content: typeof doc.content === "string" ? JSON.parse(doc.content) : doc.content,
  }));

  return { items: parsedItems, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDocumentById(id: string, user: { id: string; role: string }) {
  await ensureDocumentsTableExists();

  const doc = await db("documents")
    .leftJoin("users as author", "documents.author_id", "author.id")
    .leftJoin("teacher_profiles as author_profile", "author.id", "author_profile.user_id")
    .leftJoin("users as signer", "documents.signed_by", "signer.id")
    .leftJoin("teacher_profiles as signer_profile", "signer.id", "signer_profile.user_id")
    .leftJoin("classes", "documents.class_id", "classes.id")
    .leftJoin("subjects", "documents.subject_id", "subjects.id")
    .leftJoin("semesters", "documents.semester_id", "semesters.id")
    .select(
      "documents.*",
      "author.name as author_name",
      "author_profile.nip as author_nip",
      "author_profile.nuptk as author_nuptk",
      "signer.name as signer_name",
      "signer_profile.nip as signer_nip",
      "signer_profile.nuptk as signer_nuptk",
      "classes.name as class_name",
      "subjects.name as subject_name",
      "semesters.name as semester_name"
    )
    .where("documents.id", id)
    .first();

  if (!doc) throw new AppError("Dokumen tidak ditemukan.", "ERR_NOT_FOUND", 404);

  const parsedDoc = {
    ...doc,
    content: typeof doc.content === "string" ? JSON.parse(doc.content) : doc.content,
  };

  if (!canViewDocument(user, parsedDoc)) {
    throw new AppError("Anda tidak memiliki akses untuk melihat dokumen ini.", "ERR_FORBIDDEN", 403);
  }

  return parsedDoc;
}

/**
 * BR-RPM-03: Validasi total durasi kegiatan pembelajaran harus sama dengan alokasiWaktu.
 * Format durasi diambil dari pola teks "(N Menit)" atau "(N menit)" di akhir string kegiatan.
 * Kalau format teks tidak ditemukan, maka durasi per-kegiatan dianggap 0 (tidak divalidasi menit).
 */
function extractMinutesFromActivity(text: string): number {
  const match = text.match(/(\d+)\s*[Mm]enit/i);
  return match ? parseInt(match[1], 10) : 0;
}

function validateRPMDuration(content: Record<string, any>): void {
  const identitas = content?.identitas;
  const desain = content?.desainPembelajaran;
  if (!identitas || !desain) return;

  const alokasiWaktu = Number(identitas.alokasiWaktu);
  if (!alokasiWaktu || alokasiWaktu <= 0) return; // skip kalau alokasi tidak valid

  const kp = desain.kegiatanPembelajaran;
  if (!kp) return;

  const allActivities = [
    ...(Array.isArray(kp.awal) ? kp.awal : []),
    ...(Array.isArray(kp.inti) ? kp.inti : []),
    ...(Array.isArray(kp.akhir) ? kp.akhir : []),
  ];

  // Hanya validasi kalau SEMUA kegiatan punya pola menit (format "(N Menit)")
  const hasAllDurations = allActivities.length > 0 && allActivities.every(a => /(\d+)\s*[Mm]enit/i.test(a));
  if (!hasAllDurations) return; // format tidak standard, lewati validasi menit

  const totalMenit = allActivities.reduce((sum, a) => sum + extractMinutesFromActivity(a), 0);

  if (totalMenit !== alokasiWaktu) {
    const selisih = totalMenit - alokasiWaktu;
    const keterangan = selisih > 0
      ? `lebih ${selisih} menit dari target`
      : `kurang ${Math.abs(selisih)} menit dari target`;
    throw new AppError(
      `Total durasi kegiatan (${totalMenit} menit) tidak sesuai alokasi waktu (${alokasiWaktu} menit) — ${keterangan}. Sesuaikan durasi tiap kegiatan terlebih dahulu.`,
      "ERR_RPM_DURATION_MISMATCH",
      400
    );
  }
}

export async function createDocument(data: CreateDocumentDTO, author_id: string) {
  await ensureDocumentsTableExists();

  const id = uuidv4();
  const now = new Date();

  // BR-RPM-03: Validasi durasi khusus tipe RPM
  if (data.type === "RPM") {
    validateRPMDuration(data.content || {});
    validateDplKurnas(data.content || {});
  }

  // Validation for KKTP
  if (data.type === "KKTP") {
    const kktp = data.content as any;
    if (Array.isArray(kktp?.tpItems)) {
      if (kktp.tpItems.length === 0) {
        throw new AppError("Minimal 1 Tujuan Pembelajaran (TP) wajib disertakan.", "ERR_VALIDATION", 400);
      }
    } else {
      // Legacy Phase 1b validation
      if (!kktp.metodologi) {
        throw new AppError("Metodologi kriteria KKTP wajib dipilih.", "ERR_VALIDATION", 400);
      }

      // BR-KKTP-02: LINKED_RPM handling — snapshot CP & TP, set isModifiedFromSource=false
      if (kktp.sumberCPTP?.sourceType === "LINKED_RPM" && kktp.sumberCPTP?.sourceRefId) {
        const rpmDoc = await db("documents").where({ id: kktp.sumberCPTP.sourceRefId, type: "RPM" }).first();
        if (!rpmDoc) {
          throw new AppError("Dokumen RPM referensi tidak ditemukan.", "ERR_NOT_FOUND", 444);
        }
        const rpmContent = typeof rpmDoc.content === "string" ? JSON.parse(rpmDoc.content) : rpmDoc.content;
        // Snapshot CP & TP from RPM (tidak live-sync)
        kktp.sumberCPTP.cpText = rpmContent?.desainPembelajaran?.capaianPembelajaran || "";
        kktp.sumberCPTP.tpText = Array.isArray(rpmContent?.desainPembelajaran?.tujuanPembelajaran)
          ? rpmContent.desainPembelajaran.tujuanPembelajaran.join("; ")
          : "";
        // BR-KKTP-04: Provenance — belum dimodifikasi dari sumber saat baru ditarik
        (kktp.sumberCPTP as any).isModifiedFromSource = false;
      }

      if (!kktp.sumberCPTP?.cpText || !kktp.sumberCPTP?.tpText) {
        throw new AppError("Teks CP dan TP wajib terisi.", "ERR_VALIDATION", 400);
      }
    }
  }

  const payload = {
    id,
    type: data.type,
    title: data.title,
    author_id,
    class_id: data.class_id || null,
    subject_id: data.subject_id || null,
    semester_id: data.semester_id || null,
    status: "DRAFT",
    version: 1,
    content: JSON.stringify(data.content || {}),
    created_at: now,
    updated_at: now,
  };

  await db("documents").insert(payload);

  // Auto-save TP to tp_bank in the background
  try {
    const content = data.content as any;
    const effectiveClassId = data.class_id || content?.identitas?.classId || null;
    const effectiveClassName = content?.identitas?.kelasRombel || null;
    const canonicalFase = await resolveCanonicalPhaseForDocument(
      effectiveClassId,
      effectiveClassName,
      content?.identitas?.tingkatFase
    );

    if (data.type === "KKTP" && Array.isArray(content?.tpItems)) {
      await autoSaveTPsToBank({
        // P1-D: canonical contract — tujuanPembelajaran: string[] (not tps: object[])
        tujuanPembelajaran: content.tpItems
          .map((t: any) => (typeof t === 'string' ? t : t?.teks))
          .filter((s: any) => typeof s === 'string' && s.trim().length > 0),
        mata_pelajaran_id: data.subject_id || content.identitas?.subjectId || null,
        mata_pelajaran_name: content.identitas?.mataPelajaran || null,
        fase: canonicalFase,
        userId: author_id,
        sumber: 'manual',
      });
    } else if (data.type === "RPM" && Array.isArray(content?.desainPembelajaran?.tujuanPembelajaran)) {
      await autoSaveTPsToBank({
        // P1-D: plain string array — TP text only, no sourceType wrapper
        tujuanPembelajaran: content.desainPembelajaran.tujuanPembelajaran
          .filter((t: any) => typeof t === 'string' && t.trim().length > 0),
        mata_pelajaran_id: data.subject_id || null,
        mata_pelajaran_name: content.identitas?.mataPelajaran || null,
        fase: canonicalFase,
        userId: author_id,
        sumber: 'dari_rpm',
      });
    }
  } catch (err) {
    // Non-blocking: background sync error shouldn't fail document creation
    console.error("AutoSaveTPsToBank error during createDocument:", err);
  }

  return getDocumentById(id, { id: author_id, role: "teacher" });
}

export async function updateDocument(
  id: string,
  data: Partial<CreateDocumentDTO>,
  user: { id: string; role: string }
) {
  const doc = await getDocumentById(id, user);

  if (!canEditDocument(user, doc)) {
    throw new AppError("Dokumen yang sudah disahkan atau milik orang lain tidak dapat diubah.", "ERR_FORBIDDEN", 403);
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date(),
  };

  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.class_id !== undefined) updatePayload.class_id = data.class_id;
  if (data.subject_id !== undefined) updatePayload.subject_id = data.subject_id;
  if (data.semester_id !== undefined) updatePayload.semester_id = data.semester_id;
  if (data.status !== undefined) updatePayload.status = data.status;

  // Jika dokumen diubah setelah ditandatangani, reset tanda tangan ke DRAFT
  let signatureResetWarning = false;
  if (doc.signed_at) {
    updatePayload.signed_at = null;
    updatePayload.status = "DRAFT";
    signatureResetWarning = true;
  }

  if (data.content !== undefined) {
    // BR-RPM-03: Validasi durasi saat update konten RPM
    if (doc.type === "RPM") {
      validateRPMDuration(data.content || {});
      validateDplKurnas(data.content || {});
    }
    // BR-KKTP-04: Tandai isModifiedFromSource=true jika teks CP/TP sudah diubah dari snapshot LINKED_RPM
    if (doc.type === "KKTP") {
      const existingContent = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
      const newContent = data.content as any;
      if (
        newContent?.sumberCPTP?.sourceType === 'LINKED_RPM' &&
        existingContent?.sumberCPTP?.sourceType === 'LINKED_RPM' &&
        existingContent?.sumberCPTP?.isModifiedFromSource === false &&
        (
          newContent.sumberCPTP.cpText !== existingContent.sumberCPTP.cpText ||
          newContent.sumberCPTP.tpText !== existingContent.sumberCPTP.tpText
        )
      ) {
        newContent.sumberCPTP.isModifiedFromSource = true;
      }
    }
    updatePayload.content = JSON.stringify(data.content);
  }

  await db("documents").where("id", id).update(updatePayload);

  // Auto-save TP to tp_bank in the background upon update
  try {
    const content = (data.content !== undefined ? data.content : typeof doc.content === "string" ? JSON.parse(doc.content) : doc.content) as any;
    const effectiveClassId = data.class_id || doc.class_id || content?.identitas?.classId || null;
    const effectiveClassName = content?.identitas?.kelasRombel || null;
    const canonicalFase = await resolveCanonicalPhaseForDocument(
      effectiveClassId,
      effectiveClassName,
      content?.identitas?.tingkatFase
    );

    if (doc.type === "KKTP" && Array.isArray(content?.tpItems)) {
      await autoSaveTPsToBank({
        // P1-D: canonical contract — tujuanPembelajaran: string[]
        tujuanPembelajaran: content.tpItems
          .map((t: any) => (typeof t === 'string' ? t : t?.teks))
          .filter((s: any) => typeof s === 'string' && s.trim().length > 0),
        mata_pelajaran_id: data.subject_id || doc.subject_id || content.identitas?.subjectId || null,
        mata_pelajaran_name: content.identitas?.mataPelajaran || null,
        fase: canonicalFase,
        userId: user.id,
        sumber: 'manual',
      });
    } else if (doc.type === "RPM" && Array.isArray(content?.desainPembelajaran?.tujuanPembelajaran)) {
      await autoSaveTPsToBank({
        // P1-D: plain string array
        tujuanPembelajaran: content.desainPembelajaran.tujuanPembelajaran
          .filter((t: any) => typeof t === 'string' && t.trim().length > 0),
        mata_pelajaran_id: data.subject_id || doc.subject_id || null,
        mata_pelajaran_name: content.identitas?.mataPelajaran || null,
        fase: canonicalFase,
        userId: user.id,
        sumber: 'dari_rpm',
      });
    }
  } catch (err) {
    console.error("AutoSaveTPsToBank error during updateDocument:", err);
  }

  const updated = await getDocumentById(id, user);
  return { ...updated, signatureResetWarning };
}

export async function updateDocumentStatus(
  id: string,
  action: 'SUBMIT_FOR_REVIEW' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'SIGN' | 'SHARE_TO_BLC' | 'UNSHARE_FROM_BLC',
  user: { id: string; role: string }
) {
  const doc = await getDocumentById(id, user);
  const now = new Date();
  const updatePayload: Record<string, any> = { updated_at: now };

  const isZeroApprovalDoc = ['RPM', 'KKTP', 'TRISULA'].includes(doc.type);

  // ── RPM, KKTP, TRISULA ZERO-APPROVAL WORKFLOW ──────────────────────────────
  if (isZeroApprovalDoc) {
    if (action === 'SHARE_TO_BLC') {
      if (!canShareToBLC(user, doc)) {
        throw new AppError("Hanya penyusun yang dapat membagikan dokumen ke Bank Modul BLC.", "ERR_FORBIDDEN", 403);
      }
      updatePayload.blc_shared_at = now;
    } else if (action === 'UNSHARE_FROM_BLC') {
      if (!canShareToBLC(user, doc)) {
        throw new AppError("Hanya penyusun yang dapat mengubah status berbagi dokumen.", "ERR_FORBIDDEN", 403);
      }
      updatePayload.blc_shared_at = null;
    } else {
      // Action approval/sign tidak digunakan di modul RPM, KKTP, dan Trisula
      throw new AppError(
        `${doc.type} langsung siap dipakai tanpa alur persetujuan atau tanda tangan digital.`,
        "ERR_NO_APPROVAL_GATE",
        400
      );
    }
  } else {
    // ── TIPE DOKUMEN LAIN (Non-perencanaan / UTSMAN dsb jika ada) ────────────
    if (action === "SUBMIT_FOR_REVIEW") {
      if (doc.author_id !== user.id) {
        throw new AppError("Hanya penyusun yang dapat mengajukan dokumen.", "ERR_FORBIDDEN", 403);
      }
      if (doc.status !== "DRAFT") {
        throw new AppError("Hanya dokumen berstatus Belum Selesai yang dapat dikirim.", "ERR_VALIDATION", 400);
      }
      updatePayload.status = "PUBLISHED";
    } else if (action === "REVIEW") {
      if (!canReviewDocument(user, doc)) {
        throw new AppError("Hanya tim kurikulum atau kepala sekolah yang dapat meninjau dokumen.", "ERR_FORBIDDEN", 403);
      }
      if (doc.status !== "PUBLISHED") {
        throw new AppError("Hanya dokumen yang sudah dikirim yang dapat ditinjau.", "ERR_VALIDATION", 400);
      }
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = now;
    } else if (action === "APPROVE") {
      if (!canApproveDocument(user, doc)) {
        throw new AppError("Hanya kepala sekolah yang dapat mengesahkan dokumen.", "ERR_FORBIDDEN", 403);
      }
      if (doc.status !== "PUBLISHED") {
        throw new AppError("Hanya dokumen yang sudah dikirim yang dapat disahkan.", "ERR_VALIDATION", 400);
      }
      updatePayload.status = "APPROVED";
      updatePayload.approved_by = user.id;
      updatePayload.approved_at = now;
    } else if (action === "REJECT") {
      if (!canReviewDocument(user, doc) && !canApproveDocument(user, doc)) {
        throw new AppError("Anda tidak memiliki hak akses untuk mengembalikan dokumen.", "ERR_FORBIDDEN", 403);
      }
      if (doc.status !== "PUBLISHED") {
        throw new AppError("Hanya dokumen yang sedang Menunggu Persetujuan yang dapat dikembalikan ke Draf.", "ERR_VALIDATION", 400);
      }
      updatePayload.status = "DRAFT";
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = now;
    }
  }

  await db("documents").where("id", id).update(updatePayload);
  return getDocumentById(id, user);
}

/**
 * deleteDocument — Hapus dokumen permanen.
 * RPM, KKTP, TRISULA: author bisa hapus miliknya sendiri kapan saja, administrator bisa hapus semua.
 * Tipe lain: hanya administrator.
 */
export async function deleteDocument(id: string, user: { id: string; role: string }) {
  const doc = await getDocumentById(id, user);

  if (!canDeleteDocument(user, doc)) {
    throw new AppError(
      "Anda tidak memiliki izin untuk menghapus dokumen ini.",
      "ERR_FORBIDDEN",
      403
    );
  }

  await db("documents").where("id", id).delete();
  return { success: true, deleted_id: id };
}

export async function cloneDocument(id: string, user: { id: string; role: string }) {
  const sourceDoc = await getDocumentById(id, user);

  if (!canCloneDocument(user, sourceDoc)) {
    throw new AppError(
      "Dokumen ini belum dapat digunakan atau disalin.",
      "ERR_FORBIDDEN",
      403
    );
  }

  const newId = uuidv4();
  const now = new Date();

  // Bersihkan identitas penyusun agar salinan dimiliki oleh user yang melakukan clone
  const rawContent = typeof sourceDoc.content === "string" ? JSON.parse(sourceDoc.content) : sourceDoc.content;
  const clonedContent = {
    ...rawContent,
    identitas: {
      ...(rawContent?.identitas || {}),
      namaTutorPengampu: user.role === 'teacher' ? undefined : rawContent?.identitas?.namaTutorPengampu,
    },
  };

  const payload: Record<string, any> = {
    id: newId,
    type: sourceDoc.type,
    title: `Salinan - ${sourceDoc.title}`,
    author_id: user.id,
    class_id: sourceDoc.class_id,
    subject_id: sourceDoc.subject_id,
    semester_id: sourceDoc.semester_id,
    content: JSON.stringify(clonedContent),
    status: "DRAFT",
    version: 1,
    forked_from_id: sourceDoc.id,
    blc_shared_at: null,
    signed_at: null,
    signed_by: null,
    created_at: now,
    updated_at: now,
  };

  await db("documents").insert(payload);
  return getDocumentById(newId, user);
}

export async function bundleSemesterPackage(
  filters: { subject_id?: string; class_id?: string; semester_id?: string; page?: number; limit?: number },
  user: { id: string; role: string }
) {
  if (!filters.subject_id || !filters.class_id || !filters.semester_id) {
    throw new AppError("Mata pelajaran, kelas, dan semester wajib dipilih untuk membuat paket semester.", "ERR_VALIDATION", 400);
  }

  // BR-BUNDLE-LIMITATION: Safety limit to max 20 documents per batch
  const limit = Math.min(filters.limit || 20, 20);
  const page = filters.page || 1;
  const offset = (page - 1) * limit;

  // Fetch all documents for this exact combination
  const query = db("documents")
    .leftJoin("users as author", "documents.author_id", "author.id")
    .select("documents.*", "author.name as author_name")
    .where({
      "documents.subject_id": filters.subject_id,
      "documents.class_id": filters.class_id,
      "documents.semester_id": filters.semester_id,
    })
    .whereIn("documents.type", ["RPM", "KKTP", "TRISULA"]);

  const totalRes = await query.clone().clearSelect().count({ count: "documents.id" });
  const total = Number(totalRes[0]?.count || 0);

  const docs = await query.orderBy("documents.created_at", "asc").offset(offset).limit(limit);

  if (docs.length === 0) {
    throw new AppError("Tidak ada dokumen yang ditemukan untuk kombinasi kelas/mapel ini.", "ERR_NOT_FOUND", 404);
  }

  // RPM, KKTP, TRISULA langsung siap pakai dan dapat dibundle tanpa gating status/tanda tangan
  const parsedDocs = docs.map((d: any) => ({
    ...d,
    content: typeof d.content === "string" ? JSON.parse(d.content) : d.content,
  }));

  return {
    packageTitle: `Paket Modul Semester - ${parsedDocs[0]?.subject_id || "Mata Pelajaran"}`,
    totalDocuments: total,
    batchPage: page,
    batchLimit: limit,
    totalPages: Math.ceil(total / limit),
    documents: parsedDocs,
  };
}
