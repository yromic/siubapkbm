import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { resolvePhaseByClassLevel, resolvePhaseByClassName } from "@/lib/utils/academicUtils";

export interface BankTPItem {
  id: string;
  cp_id?: string | null;
  cp_kode?: string | null;
  cp_teks?: string | null;
  cp_domain_trisula?: string | null;
  teks: string;
  mata_pelajaran_id: string | null;
  mata_pelajaran_name: string | null;
  fase: string;
  sumber: "dari_rpm" | "manual" | "ai_generated";
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export interface BankTPFilters {
  cp_id?: string;
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  fase?: string;
  class_level?: number | string;
  sumber?: string;
  search?: string;
}

export async function ensureTpBankTableExists(): Promise<void> {
  const exists = await db.schema.hasTable("tp_bank");
  if (!exists) {
    await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
    await db.raw(`
      CREATE TABLE IF NOT EXISTS \`tp_bank\` (
        \`id\` CHAR(36) NOT NULL,
        \`cp_id\` CHAR(36) NULL,
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
      await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
      await db.raw(`
        ALTER TABLE \`tp_bank\`
        ADD COLUMN \`cp_id\` CHAR(36) NULL AFTER \`teks\`,
        ADD INDEX \`idx_tp_bank_cp_id\` (\`cp_id\`);
      `);
      await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
    }
  }
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
        .whereILike("tp_bank.teks", term)
        .orWhereILike("tp_bank.mata_pelajaran_name", term)
        .orWhereILike("tp_bank.fase", term)
        .orWhereILike("cp_bank.teks", term);
    });
  }

  const countQuery = query.clone();
  const countRes = await countQuery.count("tp_bank.id as total").first();
  const total = Number(countRes?.total || 0);

  const offset = (page - 1) * limit;
  const items = await query
    .orderBy("tp_bank.created_at", "desc")
    .limit(limit)
    .offset(offset);

  return {
    data: items,
    pagination: { page, limit, total },
  };
}

/**
 * Automatically saves a batch of TPs to the Bank in the background.
 * Checks for exact duplicates (same text, subject, and fase) and prevents duplicate creation.
 * Optionally links to a parent CP if cp_id is specified.
 */
export async function autoSaveTPsToBank(params: {
  tps: Array<{ teks: string; sourceType?: string; cp_id?: string | null }>;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase?: string | null;
  cp_id?: string | null;
  userId: string;
}): Promise<{ savedCount: number; existingCount: number }> {
  await ensureTpBankTableExists();

  if (!params.tps || params.tps.length === 0) {
    return { savedCount: 0, existingCount: 0 };
  }

  const fase = params.fase?.trim() || "Fase C";
  const mataPelajaranId = params.mata_pelajaran_id || null;
  const mataPelajaranName = params.mata_pelajaran_name?.trim() || null;
  const globalCpId = params.cp_id || null;
  const now = new Date();

  // If cp_id is provided, validate that CP exists and matches fase
  if (globalCpId) {
    const hasCpTable = await db.schema.hasTable("cp_bank");
    if (hasCpTable) {
      const parentCP = await db("cp_bank").where("id", globalCpId).first();
      if (parentCP && parentCP.fase && parentCP.fase !== fase) {
        throw new AppError(
          `Fase TP (${fase}) tidak cocok dengan Fase CP (${parentCP.fase}).`,
          "ERR_PHASE_MISMATCH",
          400
        );
      }
    }
  }

  let savedCount = 0;
  let existingCount = 0;

  for (const tp of params.tps) {
    const rawTeks = tp.teks ? String(tp.teks).trim() : "";
    if (!rawTeks || rawTeks.length < 3) continue;

    const targetCpId = tp.cp_id || globalCpId;

    // Check for exact duplicate in tp_bank
    const query = db("tp_bank").whereRaw("LOWER(TRIM(teks)) = ?", [rawTeks.toLowerCase()]);
    
    if (fase) {
      query.where("fase", fase);
    }

    if (mataPelajaranId) {
      query.andWhere((b: any) => {
        b.where("mata_pelajaran_id", mataPelajaranId)
          .orWhere("mata_pelajaran_name", mataPelajaranName || "");
      });
    } else if (mataPelajaranName) {
      query.whereRaw("LOWER(TRIM(mata_pelajaran_name)) = ?", [mataPelajaranName.toLowerCase()]);
    }

    const existing = await query.first();

    if (existing) {
      // If existing doesn't have cp_id and targetCpId is provided, link it
      if (!existing.cp_id && targetCpId) {
        await db("tp_bank").where("id", existing.id).update({
          cp_id: targetCpId,
          updated_at: now,
        });
      }
      existingCount++;
      continue;
    }

    const sumber: "dari_rpm" | "manual" | "ai_generated" =
      tp.sourceType === "LINKED_RPM"
        ? "dari_rpm"
        : tp.sourceType === "AI_GENERATED"
        ? "ai_generated"
        : "manual";

    await db("tp_bank").insert({
      id: uuidv4(),
      cp_id: targetCpId,
      teks: rawTeks,
      mata_pelajaran_id: mataPelajaranId,
      mata_pelajaran_name: mataPelajaranName,
      fase: fase,
      sumber: sumber,
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
 * Delete a TP from the Bank.
 * Only the original creator or an administrator can delete an entry.
 */
export async function deleteBankTP(
  id: string,
  user: { id: string; role: string }
): Promise<void> {
  await ensureTpBankTableExists();

  const item = await db("tp_bank").where("id", id).first();
  if (!item) {
    throw new AppError("Tujuan Pembelajaran di bank tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const isAdmin = ["administrator", "admin"].includes(user.role);
  const isOwner = item.created_by === user.id;

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
  const hasDocs = await db.schema.hasTable("documents");
  if (!hasDocs) {
    return { scanned: 0, proven_correct: 0, repaired: 0, unchanged: 0, unresolved: 0 };
  }

  const allTps: BankTPItem[] = await db("tp_bank").select("id", "teks", "fase", "cp_id");
  const documents: any[] = await db("documents")
    .leftJoin("classes", "documents.class_id", "classes.id")
    .whereIn("documents.type", ["KKTP", "RPM"])
    .select(
      "documents.id",
      "documents.type",
      "documents.content",
      "documents.class_id",
      "classes.level as class_level",
      "classes.name as class_name"
    );

  // Build TP text to originating phases mapping
  const tpToPhasesMap = new Map<string, Set<string>>();
  for (const doc of documents) {
    let derivedPhase: string | null = null;
    if (doc.class_level) {
      derivedPhase = resolvePhaseByClassLevel(doc.class_level);
    } else if (doc.class_name) {
      derivedPhase = resolvePhaseByClassName(doc.class_name);
    }
    if (!derivedPhase) continue;

    let contentObj: any = {};
    try {
      contentObj = typeof doc.content === "string" ? JSON.parse(doc.content) : (doc.content || {});
    } catch {
      continue;
    }

    const tpsInDoc: string[] = [];
    if (doc.type === "KKTP" && Array.isArray(contentObj.tpItems)) {
      for (const item of contentObj.tpItems) {
        if (item.teks) tpsInDoc.push(String(item.teks).trim().toLowerCase());
      }
    } else if (doc.type === "RPM" && Array.isArray(contentObj?.desainPembelajaran?.tujuanPembelajaran)) {
      for (const t of contentObj.desainPembelajaran.tujuanPembelajaran) {
        if (t) tpsInDoc.push(String(t).trim().toLowerCase());
      }
    }

    for (const text of tpsInDoc) {
      const set = tpToPhasesMap.get(text) || new Set<string>();
      set.add(derivedPhase);
      tpToPhasesMap.set(text, set);
    }
  }

  let scanned = 0;
  let provenCorrect = 0;
  let repaired = 0;
  let unchanged = 0;
  let unresolved = 0;

  for (const tp of allTps) {
    scanned++;
    const normText = (tp.teks || "").trim().toLowerCase();
    const originatingPhases = tpToPhasesMap.get(normText);

    if (originatingPhases && originatingPhases.size === 1) {
      const unambiguousPhase = Array.from(originatingPhases)[0];
      if (tp.fase !== unambiguousPhase) {
        await db("tp_bank").where("id", tp.id).update({
          fase: unambiguousPhase,
          updated_at: new Date(),
        });
        repaired++;
      } else {
        provenCorrect++;
      }
    } else if (originatingPhases && originatingPhases.size > 1) {
      // Ambiguous: TP text used across multiple phases
      unresolved++;
      unchanged++;
    } else {
      // No document link found; leave unchanged without guessing
      if (tp.fase === "Fase A" || tp.fase === "Fase B") {
        provenCorrect++;
      } else {
        unresolved++;
      }
      unchanged++;
    }
  }

  return {
    scanned,
    proven_correct: provenCorrect,
    repaired,
    unchanged,
    unresolved,
  };
}
