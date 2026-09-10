import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { resolvePhaseByClassLevel, resolvePhaseByClassName } from "@/lib/utils/academicUtils";

export interface BankTPItem {
  id: string;
  kode?: string | null;
  cp_id?: string | null;
  cp_kode?: string | null;
  cp_teks?: string | null;
  cp_domain_trisula?: string | null;
  teks: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase: string;
  sumber?: "dari_rpm" | "manual" | "ai_generated";
  created_by?: string;
  creator_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BankTPFilters {
  cp_id?: string;
  kode?: string;
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  fase?: string;
  class_level?: number | string;
  sumber?: string;
  search?: string;
}

export interface UpdateTPInput {
  teks?: string;
  cp_id?: string | null;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase?: string;
}

let ensuringTpTablePromise: Promise<void> | null = null;

export async function ensureTpBankTableExists(): Promise<void> {
  if (ensuringTpTablePromise) {
    return ensuringTpTablePromise;
  }

  ensuringTpTablePromise = (async () => {
    try {
      const exists = await db.schema.hasTable("tp_bank");
      if (!exists) {
        await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
        await db.raw(`
          CREATE TABLE IF NOT EXISTS \`tp_bank\` (
            \`id\` CHAR(36) NOT NULL,
            \`cp_id\` CHAR(36) NULL,
            \`kode\` VARCHAR(100) NULL,
            \`teks\` TEXT NOT NULL,
            \`mata_pelajaran_id\` CHAR(36) NULL,
            \`mata_pelajaran_name\` VARCHAR(255) NULL,
            \`fase\` VARCHAR(50) NOT NULL DEFAULT 'Fase C',
            \`sumber\` ENUM('dari_rpm', 'manual', 'ai_generated') NOT NULL DEFAULT 'manual',
            \`created_by\` CHAR(36) NOT NULL,
            \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            INDEX \`idx_tp_bank_mapel_fase\` (\`mata_pelajaran_id\`, \`fase\`),
            INDEX \`idx_tp_bank_cp_id\` (\`cp_id\`),
            INDEX \`idx_tp_bank_kode\` (\`kode\`),
            INDEX \`idx_tp_bank_created_by\` (\`created_by\`),
            INDEX \`idx_tp_bank_fase\` (\`fase\`),
            CONSTRAINT \`fk_tp_bank_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
            CONSTRAINT \`fk_tp_bank_subject\` FOREIGN KEY (\`mata_pelajaran_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
      } else {
        const hasCpId = await db.schema.hasColumn("tp_bank", "cp_id");
        if (!hasCpId) {
          try {
            await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
            await db.raw(`
              ALTER TABLE \`tp_bank\`
              ADD COLUMN \`cp_id\` CHAR(36) NULL AFTER \`teks\`,
              ADD INDEX \`idx_tp_bank_cp_id\` (\`cp_id\`);
            `);
            await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
          } catch (e: any) {
            if (!e?.message?.includes("Duplicate column") && !e?.message?.includes("ER_DUP_FIELDNAME")) {
              throw e;
            }
          }
        }

        const hasKode = await db.schema.hasColumn("tp_bank", "kode");
        if (!hasKode) {
          try {
            await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
            await db.raw(`
              ALTER TABLE \`tp_bank\`
              ADD COLUMN \`kode\` VARCHAR(100) NULL AFTER \`cp_id\`,
              ADD INDEX \`idx_tp_bank_kode\` (\`kode\`);
            `);
            await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
          } catch (e: any) {
            if (!e?.message?.includes("Duplicate column") && !e?.message?.includes("ER_DUP_FIELDNAME")) {
              throw e;
            }
          }
        }
      }
    } catch (err) {
      ensuringTpTablePromise = null;
      throw err;
    }
  })();

  return ensuringTpTablePromise;
}

/**
 * List all TPs in the Bank with optional filtering by CP, subject, fase, class level, and search text.
 * All teachers and admins can view and search all bank entries.
 */
export async function listBankTPs(
  filters: BankTPFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: BankTPItem[]; pagination: { page: number; limit: number; total: number } }> {
  await ensureTpBankTableExists();

  let effectiveFase = filters.fase;
  if (!effectiveFase && filters.class_level !== undefined) {
    effectiveFase = resolvePhaseByClassLevel(filters.class_level);
  }

  const query = db("tp_bank")
    .leftJoin("users", "tp_bank.created_by", "users.id")
    .leftJoin("cp_bank", "tp_bank.cp_id", "cp_bank.id")
    .select(
      "tp_bank.*",
      "users.name as creator_name",
      "cp_bank.kode as cp_kode",
      "cp_bank.teks as cp_teks",
      "cp_bank.domain_trisula as cp_domain_trisula"
    );

  if (filters.cp_id) {
    query.where("tp_bank.cp_id", filters.cp_id);
  }

  if (filters.kode) {
    query.where("tp_bank.kode", filters.kode);
  }

  if (filters.mata_pelajaran_id) {
    query.where("tp_bank.mata_pelajaran_id", filters.mata_pelajaran_id);
  } else if (filters.mata_pelajaran_name) {
    query.where("tp_bank.mata_pelajaran_name", filters.mata_pelajaran_name);
  }

  if (effectiveFase) {
    query.where("tp_bank.fase", effectiveFase);
  }

  if (filters.sumber) {
    query.where("tp_bank.sumber", filters.sumber);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    query.where((builder: any) => {
      builder
        .where("tp_bank.teks", "like", term)
        .orWhere("tp_bank.kode", "like", term)
        .orWhere("tp_bank.mata_pelajaran_name", "like", term)
        .orWhere("cp_bank.teks", "like", term)
        .orWhere("cp_bank.kode", "like", term);
    });
  }

  // Count total matching items
  const countResult = await query.clone().clearSelect().count("tp_bank.id as total").first();
  const total = Number(countResult?.total || 0);

  // Apply sorting and pagination
  const offset = (page - 1) * limit;
  const items = await query
    .orderBy("tp_bank.created_at", "desc")
    .limit(limit)
    .offset(offset);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
    },
  };
}

/**
 * Auto-save unique TP entries from a created/updated document (RPM or KKTP) into Bank TP.
 */
export async function autoSaveTPsToBank(params: {
  tujuanPembelajaran: string[];
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase?: string | null;
  class_level?: number | string;
  class_name?: string | null;
  userId: string;
  sumber?: "dari_rpm" | "manual" | "ai_generated";
}): Promise<{ savedCount: number; existingCount: number }> {
  await ensureTpBankTableExists();

  if (!params.tujuanPembelajaran || params.tujuanPembelajaran.length === 0) {
    return { savedCount: 0, existingCount: 0 };
  }

  // Derive phase authoritatively: direct phase string > class_level > class_name > fallback
  let fase = params.fase;
  if (!fase || !fase.startsWith("Fase")) {
    if (params.class_level !== undefined && params.class_level !== null) {
      fase = resolvePhaseByClassLevel(params.class_level);
    } else if (params.class_name) {
      fase = resolvePhaseByClassName(params.class_name);
    } else {
      fase = "Fase C";
    }
  }

  const sumber = params.sumber || "dari_rpm";
  let savedCount = 0;
  let existingCount = 0;

  for (const rawTeks of params.tujuanPembelajaran) {
    const teks = rawTeks?.trim();
    if (!teks || teks.length < 3) continue;

    // Check if TP already exists in this phase (case-insensitive)
    const existing = await db("tp_bank")
      .whereRaw("LOWER(TRIM(teks)) = ?", [teks.toLowerCase()])
      .andWhere("fase", fase)
      .first();

    if (existing) {
      existingCount++;
      // Backfill missing mata_pelajaran_id or name if previously null
      const updates: any = {};
      if (!existing.mata_pelajaran_id && params.mata_pelajaran_id) {
        updates.mata_pelajaran_id = params.mata_pelajaran_id;
      }
      if (!existing.mata_pelajaran_name && params.mata_pelajaran_name) {
        updates.mata_pelajaran_name = params.mata_pelajaran_name.trim();
      }
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date();
        await db("tp_bank").where("id", existing.id).update(updates);
      }
      continue;
    }

    // Insert new TP into Bank
    const id = uuidv4();
    const now = new Date();

    await db("tp_bank").insert({
      id,
      teks,
      mata_pelajaran_id: params.mata_pelajaran_id || null,
      mata_pelajaran_name: params.mata_pelajaran_name?.trim() || null,
      fase,
      sumber,
      created_by: params.userId,
      created_at: now,
      updated_at: now,
    });

    savedCount++;
  }

  return { savedCount, existingCount };
}

/**
 * Create a single manual TP in Bank TP linked to CP (optional).
 */
export async function createManualBankTP(params: {
  teks: string;
  kode?: string | null;
  cp_id?: string | null;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase?: string | null;
  class_level?: number | string;
  userId: string;
}): Promise<BankTPItem> {
  await ensureTpBankTableExists();

  const rawTeks = params.teks?.trim();
  if (!rawTeks || rawTeks.length < 3) {
    throw new AppError("Teks Tujuan Pembelajaran (TP) minimal 3 karakter.", "ERR_VALIDATION", 400);
  }

  let fase = params.fase;
  if (!fase && params.class_level !== undefined) {
    fase = resolvePhaseByClassLevel(params.class_level);
  }
  fase = fase || "Fase C";

  let cpId = params.cp_id || null;
  let cpKode: string | null = null;
  let cpTeks: string | null = null;

  if (cpId) {
    const hasCpTable = await db.schema.hasTable("cp_bank");
    if (hasCpTable) {
      const cp = await db("cp_bank").where("id", cpId).first();
      if (cp) {
        if (cp.fase && cp.fase !== fase) {
          throw new AppError(
            `Fase TP (${fase}) tidak cocok dengan Fase CP (${cp.fase}).`,
            "ERR_PHASE_MISMATCH",
            400
          );
        }
        cpKode = cp.kode;
        cpTeks = cp.teks;
      }
    }
  }

  const id = uuidv4();
  const now = new Date();

  await db("tp_bank").insert({
    id,
    cp_id: cpId,
    kode: params.kode?.trim() || null,
    teks: rawTeks,
    mata_pelajaran_id: params.mata_pelajaran_id || null,
    mata_pelajaran_name: params.mata_pelajaran_name?.trim() || null,
    fase,
    sumber: "manual",
    created_by: params.userId,
    created_at: now,
    updated_at: now,
  });

  return {
    id,
    cp_id: cpId,
    cp_kode: cpKode,
    cp_teks: cpTeks,
    kode: params.kode?.trim() || null,
    teks: rawTeks,
    mata_pelajaran_id: params.mata_pelajaran_id || null,
    mata_pelajaran_name: params.mata_pelajaran_name?.trim() || null,
    fase,
    sumber: "manual",
    created_by: params.userId,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Update an existing TP in Bank TP.
 * Administrators can edit all TPs including BLC master TPs.
 * Regular teachers can only edit their own custom/manual TPs.
 */
export async function updateBankTP(
  id: string,
  input: UpdateTPInput,
  user: { id: string; role: string }
): Promise<BankTPItem> {
  await ensureTpBankTableExists();

  const existing = await db("tp_bank")
    .leftJoin("cp_bank", "tp_bank.cp_id", "cp_bank.id")
    .select("tp_bank.*", "cp_bank.domain_trisula as cp_domain_trisula", "cp_bank.sumber as cp_sumber")
    .where("tp_bank.id", id)
    .first();

  if (!existing) {
    throw new AppError("Tujuan Pembelajaran di bank tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const isAdmin = ["administrator", "admin"].includes(user.role);
  const isMasterBLC = Boolean(
    (existing.kode && existing.kode.startsWith("TP-")) ||
    existing.cp_domain_trisula ||
    existing.cp_sumber === "INTERNAL_BLC"
  );

  if (isMasterBLC && !isAdmin) {
    throw new AppError("Hanya administrator yang dapat mengubah Tujuan Pembelajaran standar BLC.", "ERR_FORBIDDEN", 403);
  }

  const isOwner = existing.created_by === user.id;
  if (!isAdmin && !isOwner) {
    throw new AppError("Anda hanya dapat mengubah Tujuan Pembelajaran yang Anda buat sendiri.", "ERR_FORBIDDEN", 403);
  }

  const patch: any = { updated_at: new Date() };

  if (input.teks !== undefined) {
    const trimmed = input.teks.trim();
    if (!trimmed || trimmed.length < 3) {
      throw new AppError("Teks Tujuan Pembelajaran minimal 3 karakter.", "ERR_VALIDATION", 400);
    }
    patch.teks = trimmed;
  }

  if (input.cp_id !== undefined) {
    patch.cp_id = input.cp_id || null;
  }

  if (input.mata_pelajaran_id !== undefined) {
    patch.mata_pelajaran_id = input.mata_pelajaran_id || null;
  }

  if (input.mata_pelajaran_name !== undefined) {
    patch.mata_pelajaran_name = input.mata_pelajaran_name?.trim() || null;
  }

  if (input.fase !== undefined) {
    patch.fase = input.fase;
  }

  await db("tp_bank").where("id", id).update(patch);

  const updated = await db("tp_bank")
    .leftJoin("users", "tp_bank.created_by", "users.id")
    .leftJoin("cp_bank", "tp_bank.cp_id", "cp_bank.id")
    .select(
      "tp_bank.*",
      "users.name as creator_name",
      "cp_bank.kode as cp_kode",
      "cp_bank.teks as cp_teks",
      "cp_bank.domain_trisula as cp_domain_trisula"
    )
    .where("tp_bank.id", id)
    .first();

  return updated;
}

/**
 * Delete a TP from the Bank.
 * Administrators can delete any TP.
 * Teachers can only delete their own non-master TP.
 */
export async function deleteBankTP(
  id: string,
  user: { id: string; role: string }
): Promise<void> {
  await ensureTpBankTableExists();

  const existing = await db("tp_bank")
    .leftJoin("cp_bank", "tp_bank.cp_id", "cp_bank.id")
    .select("tp_bank.*", "cp_bank.domain_trisula as cp_domain_trisula", "cp_bank.sumber as cp_sumber")
    .where("tp_bank.id", id)
    .first();

  if (!existing) {
    throw new AppError("Tujuan Pembelajaran di bank tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const isAdmin = ["administrator", "admin"].includes(user.role);
  const isMasterBLC = Boolean(
    (existing.kode && existing.kode.startsWith("TP-")) ||
    existing.cp_domain_trisula ||
    existing.cp_sumber === "INTERNAL_BLC"
  );

  if (isMasterBLC && !isAdmin) {
    throw new AppError("Hanya administrator yang dapat menghapus Tujuan Pembelajaran standar BLC.", "ERR_FORBIDDEN", 403);
  }

  const isOwner = existing.created_by === user.id;
  if (!isAdmin && !isOwner) {
    throw new AppError(
      "Anda hanya dapat menghapus Tujuan Pembelajaran yang Anda buat sendiri.",
      "ERR_FORBIDDEN",
      403
    );
  }

  await db("tp_bank").where("id", id).delete();
}

export interface LegacyRepairReport {
  scanned: number;
  proven_correct: number;
  repaired: number;
  unchanged: number;
  unresolved: number;
}

/**
 * Safely and idempotently repairs legacy TP rows where fase was corrupted as 'Fase C'.
 * Traces provenance back to originating documents and their authoritative class level.
 */
export async function repairLegacyCorruptedPhases(): Promise<LegacyRepairReport> {
  await ensureTpBankTableExists();

  const report: LegacyRepairReport = {
    scanned: 0,
    proven_correct: 0,
    repaired: 0,
    unchanged: 0,
    unresolved: 0,
  };

  const corruptCandidates = await db("tp_bank")
    .where("fase", "Fase C")
    .select("id", "teks", "mata_pelajaran_id", "mata_pelajaran_name", "created_by");

  report.scanned = corruptCandidates.length;

  for (const tp of corruptCandidates) {
    const matchingDoc = await db("documents")
      .leftJoin("classes", "documents.class_id", "classes.id")
      .whereRaw("JSON_SEARCH(documents.content, 'one', ?) IS NOT NULL", [tp.teks])
      .select(
        "documents.id as doc_id",
        "documents.type as doc_type",
        "documents.class_id",
        "classes.name as class_name",
        "classes.level as class_level"
      )
      .first();

    if (!matchingDoc) {
      report.unresolved++;
      continue;
    }

    let authoritativeFase: string | null = null;

    if (matchingDoc.class_level !== null && matchingDoc.class_level !== undefined) {
      authoritativeFase = resolvePhaseByClassLevel(matchingDoc.class_level);
    } else if (matchingDoc.class_name) {
      authoritativeFase = resolvePhaseByClassName(matchingDoc.class_name);
    }

    if (!authoritativeFase) {
      report.unresolved++;
      continue;
    }

    if (authoritativeFase === "Fase C") {
      report.proven_correct++;
      report.unchanged++;
      continue;
    }

    await db("tp_bank")
      .where("id", tp.id)
      .update({
        fase: authoritativeFase,
        updated_at: new Date(),
      });

    report.repaired++;
  }

  return report;
}
