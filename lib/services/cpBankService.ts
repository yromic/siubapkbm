import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { resolvePhaseByClassLevel, KurikulumFase } from "@/lib/utils/academicUtils";
import { ensureTpBankTableExists } from "@/lib/services/tpBankService";

export interface BankCPItem {
  id: string;
  kode?: string | null;
  teks: string;
  fase: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  domain_trisula?: string | null;
  sumber: "OFFICIAL" | "INTERNAL_BLC" | "MANUAL" | "AI_ASSISTED";
  status: "active" | "inactive";
  tp_count?: number;
  created_by?: string | null;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankCPFilters {
  fase?: string;
  class_level?: number | string;
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  domain_trisula?: string;
  sumber?: string;
  status?: string;
  search?: string;
}

export interface CreateCPInput {
  kode?: string;
  teks: string;
  fase?: KurikulumFase | string;
  class_level?: number | string;
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  domain_trisula?: string;
  sumber?: "OFFICIAL" | "INTERNAL_BLC" | "MANUAL" | "AI_ASSISTED";
}

export interface UpdateCPInput {
  kode?: string;
  teks?: string;
  fase?: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  domain_trisula?: string | null;
  status?: "active" | "inactive";
}

let ensuringCpTablePromise: Promise<void> | null = null;

/**
 * Ensures cp_bank and updated tp_bank columns exist in MySQL.
 */
export async function ensureCpBankTableExists(): Promise<void> {
  if (ensuringCpTablePromise) {
    return ensuringCpTablePromise;
  }

  ensuringCpTablePromise = (async () => {
    try {
      await ensureTpBankTableExists();
      const exists = await db.schema.hasTable("cp_bank");
      if (!exists) {
        await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
        await db.raw(`
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
            INDEX \`idx_cp_bank_kode\` (\`kode\`),
            CONSTRAINT \`fk_cp_bank_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
            CONSTRAINT \`fk_cp_bank_subject\` FOREIGN KEY (\`mata_pelajaran_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
      } else {
        const hasKode = await db.schema.hasColumn("cp_bank", "kode");
        if (!hasKode) {
          try {
            await db.raw("SET FOREIGN_KEY_CHECKS = 0;");
            await db.raw(`
              ALTER TABLE \`cp_bank\`
              ADD COLUMN \`kode\` VARCHAR(100) NULL AFTER \`id\`,
              ADD INDEX \`idx_cp_bank_kode\` (\`kode\`);
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
      ensuringCpTablePromise = null;
      throw err;
    }
  })();

  return ensuringCpTablePromise;
}

/**
 * List all CPs from Bank CP with smart filtering and child TP counts.
 */
export async function listBankCPs(
  filters: BankCPFilters = {},
  page = 1,
  limit = 50
): Promise<{ data: BankCPItem[]; pagination: { page: number; limit: number; total: number } }> {
  await ensureCpBankTableExists();

  // Resolve fase from class if provided
  let effectiveFase = filters.fase;
  if (!effectiveFase && filters.class_level !== undefined) {
    effectiveFase = resolvePhaseByClassLevel(filters.class_level);
  }

  const query = db("cp_bank")
    .leftJoin("users", "cp_bank.created_by", "users.id")
    .select(
      "cp_bank.*",
      "users.name as creator_name"
    );

  if (effectiveFase) {
    query.where("cp_bank.fase", effectiveFase);
  }

  if (filters.mata_pelajaran_id) {
    query.where("cp_bank.mata_pelajaran_id", filters.mata_pelajaran_id);
  } else if (filters.mata_pelajaran_name) {
    query.where("cp_bank.mata_pelajaran_name", filters.mata_pelajaran_name);
  }

  if (filters.domain_trisula) {
    query.where("cp_bank.domain_trisula", filters.domain_trisula);
  }

  if (filters.sumber) {
    query.where("cp_bank.sumber", filters.sumber);
  }

  if (filters.status) {
    query.where("cp_bank.status", filters.status);
  } else {
    query.where("cp_bank.status", "active");
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    query.where((builder: any) => {
      builder
        .where("cp_bank.teks", "like", term)
        .orWhere("cp_bank.kode", "like", term)
        .orWhere("cp_bank.mata_pelajaran_name", "like", term);
    });
  }

  // Count matching items
  const countResult = await query.clone().clearSelect().count("cp_bank.id as total").first();
  const total = Number(countResult?.total || 0);

  // Pagination
  const offset = (page - 1) * limit;
  const items = await query
    .orderBy("cp_bank.created_at", "desc")
    .limit(limit)
    .offset(offset);

  // Enrich with child TP counts
  const cpIds = items.map((c: any) => c.id);
  let tpCountMap: Record<string, number> = {};
  if (cpIds.length > 0) {
    const tpCounts = await db("tp_bank")
      .whereIn("cp_id", cpIds)
      .groupBy("cp_id")
      .select("cp_id", db.raw("COUNT(id) as count"));
    
    tpCounts.forEach((r: any) => {
      tpCountMap[r.cp_id] = Number(r.count || 0);
    });
  }

  const enrichedItems: BankCPItem[] = items.map((item: any) => ({
    ...item,
    tp_count: tpCountMap[item.id] || 0,
  }));

  return {
    data: enrichedItems,
    pagination: {
      page,
      limit,
      total,
    },
  };
}

/**
 * Retrieve a single CP with its associated TPs.
 */
export async function getCPById(id: string): Promise<(BankCPItem & { tps: any[] }) | null> {
  await ensureCpBankTableExists();

  const cp = await db("cp_bank")
    .leftJoin("users", "cp_bank.created_by", "users.id")
    .select("cp_bank.*", "users.name as creator_name")
    .where("cp_bank.id", id)
    .first();

  if (!cp) return null;

  const tps = await db("tp_bank")
    .leftJoin("users", "tp_bank.created_by", "users.id")
    .select("tp_bank.*", "users.name as creator_name")
    .where("tp_bank.cp_id", id)
    .orderBy("tp_bank.created_at", "asc");

  return {
    ...cp,
    tp_count: tps.length,
    tps,
  };
}

/**
 * Create a new Capaian Pembelajaran in Bank CP.
 */
export async function createBankCP(input: CreateCPInput, userId: string): Promise<BankCPItem> {
  await ensureCpBankTableExists();

  if (!input.teks || input.teks.trim().length < 5) {
    throw new AppError("Teks Capaian Pembelajaran minimal 5 karakter.", "ERR_VALIDATION", 400);
  }

  const id = uuidv4();
  const now = new Date();

  let fase = input.fase;
  if (!fase && input.class_level !== undefined) {
    fase = resolvePhaseByClassLevel(input.class_level);
  }
  fase = fase || "Fase C";

  await db("cp_bank").insert({
    id,
    kode: input.kode?.trim() || null,
    teks: input.teks.trim(),
    fase,
    mata_pelajaran_id: input.mata_pelajaran_id || null,
    mata_pelajaran_name: input.mata_pelajaran_name?.trim() || null,
    domain_trisula: input.domain_trisula || null,
    sumber: input.sumber || "MANUAL",
    status: "active",
    created_by: userId,
    created_at: now,
    updated_at: now,
  });

  const created = await db("cp_bank").where("id", id).first();
  return { ...created, tp_count: 0 };
}

/**
 * Update an existing CP in Bank CP.
 * Administrators can edit all CPs including BLC master CPs.
 * Regular teachers can only edit custom CPs they created.
 */
export async function updateBankCP(
  id: string,
  input: UpdateCPInput,
  user: { id: string; role: string }
): Promise<BankCPItem> {
  await ensureCpBankTableExists();

  const existing = await db("cp_bank").where("id", id).first();
  if (!existing) {
    throw new AppError("Capaian Pembelajaran (CP) tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const isAdmin = ["administrator", "admin"].includes(user.role);
  if (existing.sumber === "INTERNAL_BLC" && !isAdmin) {
    throw new AppError("Hanya administrator yang dapat mengubah Capaian Pembelajaran standar BLC.", "ERR_FORBIDDEN", 403);
  }

  const isOwner = existing.created_by === user.id;
  if (!isAdmin && !isOwner) {
    throw new AppError("Anda hanya dapat mengedit CP yang Anda buat sendiri.", "ERR_FORBIDDEN", 403);
  }

  const patch: any = { updated_at: new Date() };

  if (input.teks !== undefined) {
    if (!input.teks.trim()) throw new AppError("Teks CP tidak boleh kosong.", "ERR_VALIDATION", 400);
    patch.teks = input.teks.trim();
  }
  if (input.fase !== undefined) patch.fase = input.fase;
  if (input.kode !== undefined) patch.kode = input.kode?.trim() || null;
  if (input.mata_pelajaran_id !== undefined) patch.mata_pelajaran_id = input.mata_pelajaran_id;
  if (input.mata_pelajaran_name !== undefined) patch.mata_pelajaran_name = input.mata_pelajaran_name;
  if (input.domain_trisula !== undefined) patch.domain_trisula = input.domain_trisula;
  if (input.status !== undefined) patch.status = input.status;

  await db("cp_bank").where("id", id).update(patch);

  const updated = await db("cp_bank").where("id", id).first();
  return updated;
}

/**
 * Delete or safely deactivate CP from Bank CP.
 * If CP has linked TPs, blocks destructive delete and provides teacher-friendly error.
 */
export async function deleteBankCP(
  id: string,
  user: { id: string; role: string }
): Promise<{ deleted: boolean; message: string }> {
  await ensureCpBankTableExists();

  const existing = await db("cp_bank").where("id", id).first();
  if (!existing) {
    throw new AppError("Capaian Pembelajaran (CP) tidak ditemukan.", "ERR_NOT_FOUND", 404);
  }

  const isAdmin = ["administrator", "admin"].includes(user.role);
  if (existing.sumber === "INTERNAL_BLC" && !isAdmin) {
    throw new AppError("Hanya administrator yang dapat menghapus Capaian Pembelajaran standar BLC.", "ERR_FORBIDDEN", 403);
  }

  const isOwner = existing.created_by === user.id;
  if (!isAdmin && !isOwner) {
    throw new AppError("Anda hanya dapat menghapus CP yang Anda buat sendiri.", "ERR_FORBIDDEN", 403);
  }

  // Check if CP is used by TPs
  const linkedTPCount = await db("tp_bank")
    .where("cp_id", id)
    .count("id as count")
    .first();
  const count = Number(linkedTPCount?.count || 0);

  if (count > 0) {
    // Soft disable instead of breaking child records
    await db("cp_bank").where("id", id).update({
      status: "inactive",
      updated_at: new Date(),
    });
    return {
      deleted: false,
      message: `CP dinonaktifkan karena masih digunakan oleh ${count} Tujuan Pembelajaran (TP).`,
    };
  }

  await db("cp_bank").where("id", id).delete();
  return {
    deleted: true,
    message: "Capaian Pembelajaran (CP) berhasil dihapus.",
  };
}

/**
 * Canonical Trisula initial curriculum definition for BLC PKBM.
 * Deterministically and idempotently seeds CP & TP using stable identifiers.
 * Preserves administrator edits without creating duplicate records.
 */
export async function seedInitialTrisulaCurriculum(): Promise<{ cpCount: number; tpCount: number }> {
  await ensureCpBankTableExists();

  const trisulaCurriculumData = [
    // --- FASE A (Kelas 1 - 2) ---
    {
      fase: "Fase A",
      domain: "Literasi",
      kode: "CP-LIT-FA",
      cpTeks: "Peserta didik mampu bersikap menjadi pembaca dan pemirsa yang menunjukkan minat terhadap teks yang dibaca atau dipirsa, mampu memahami informasi dari bacaan sederhana dan mengekspresikan gagasan secara lisan.",
      tps: [
        {
          kode: "TP-LIT-FA-01",
          teks: "Mengenal dan melafalkan bunyi huruf serta suku kata dalam kata-kata sederhana dengan fasih.",
        },
        {
          kode: "TP-LIT-FA-02",
          teks: "Membaca dan memahami isi cerita bergambar serta teks informasi pendek dengan intonasi yang wajar.",
        },
        {
          kode: "TP-LIT-FA-03",
          teks: "Menceritakan kembali pesan utama dari teks fiksi atau informasi sederhana dengan bahasa sendiri.",
        },
      ],
    },
    {
      fase: "Fase A",
      domain: "Numerasi",
      kode: "CP-NUM-FA",
      cpTeks: "Peserta didik mampu memahami bilangan cacah sampai dengan 100, melakukan operasi penjumlahan dan pengurangan sederhana, serta mengenal pola bangun datar sederhana di lingkungan sekitar.",
      tps: [
        {
          kode: "TP-NUM-FA-01",
          teks: "Membilang, menuliskan, dan membandingkan lambang bilangan cacah sampai dengan 100.",
        },
        {
          kode: "TP-NUM-FA-02",
          teks: "Melakukan operasi penjumlahan dan pengurangan bilangan cacah sampai dengan 20 dalam kehidupan sehari-hari.",
        },
        {
          kode: "TP-NUM-FA-03",
          teks: "Mengenal dan mengelompokkan bentuk bangun datar (segitiga, segiempat, lingkaran) dalam konteks nyata.",
        },
      ],
    },
    {
      fase: "Fase A",
      domain: "Diniyyah",
      kode: "CP-DIN-FA",
      cpTeks: "Peserta didik membiasakan adab-adab harian Islamiah, mengenal rukun iman dan Islam, membaca huruf hijaiyyah, serta menghafal doa harian dan surat-surat pendek pilihan.",
      tps: [
        {
          kode: "TP-DIN-FA-01",
          teks: "Mengenal huruf hijaiyyah berharakat dan melafalkan doa-doa harian (sebelum makan, tidur, belajar).",
        },
        {
          kode: "TP-DIN-FA-02",
          teks: "Mempraktikkan tata cara wudhu dan gerakan shalat fardhu secara tertib.",
        },
        {
          kode: "TP-DIN-FA-03",
          teks: "Meneladani akhlak mulia dan kasih sayang kepada orang tua, guru, dan teman sebaya.",
        },
      ],
    },

    // --- FASE B (Kelas 3 - 4) ---
    {
      fase: "Fase B",
      domain: "Literasi",
      kode: "CP-LIT-FB",
      cpTeks: "Peserta didik mampu memahami pesan dan informasi tentang topik kontekstual dari teks narasi dan eksposisi, mampu mengidentifikasi ide pokok serta menulis paragraf gagasan dengan kaidah ejaan yang tepat.",
      tps: [
        {
          kode: "TP-LIT-FB-01",
          teks: "Menemukan ide pokok dan informasi tersurat maupun tersirat dalam teks bacaan 2-3 paragraf.",
        },
        {
          kode: "TP-LIT-FB-02",
          teks: "Menyusun kalimat efektif dan paragraf deskriptif/naratif runtut menggunakan kosakata baru.",
        },
        {
          kode: "TP-LIT-FB-03",
          teks: "Menyampaikan pendapat secara santun dalam diskusi kelompok tentang topik sehari-hari.",
        },
      ],
    },
    {
      fase: "Fase B",
      domain: "Numerasi",
      kode: "CP-NUM-FB",
      cpTeks: "Peserta didik mampu memahami operasi perkalian, pembagian, konsep pecahan senilai dasar, pengukuran panjang dan berat, serta penyajian data sederhana dalam bentuk tabel dan diagram batang.",
      tps: [
        {
          kode: "TP-NUM-FB-01",
          teks: "Menyelesaikan operasi hitung perkalian dan pembagian bilangan cacah sampai 1.000 dengan metode bersusun.",
        },
        {
          kode: "TP-NUM-FB-02",
          teks: "Memahami konsep pecahan senilai dan melakukan operasi pecahan sederhana berpenyebut sama.",
        },
        {
          kode: "TP-NUM-FB-03",
          teks: "Membaca dan menyajikan data kuantitatif sederhana menggunakan tabel frekuensi dan diagram batang.",
        },
      ],
    },
    {
      fase: "Fase B",
      domain: "Diniyyah",
      kode: "CP-DIN-FB",
      cpTeks: "Peserta didik memahami rukun shalat dan syarat sahnya, membaca Al-Qur'an sesuai kaidah tajwid dasar, menghafal juz 'Amma pilihan, serta meneladani kisah keteladanan Nabi dan Sahabat (UTSMAN).",
      tps: [
        {
          kode: "TP-DIN-FB-01",
          teks: "Membaca ayat Al-Qur'an dengan menerapkan hukum tajwid dasar (Nun Sukun, Tanwin, Mad Thabi'i).",
        },
        {
          kode: "TP-DIN-FB-02",
          teks: "Menghafal dan memahami arti surat-surat pendek dalam Juz 'Amma (An-Nas sampai Ad-Dhuha).",
        },
        {
          kode: "TP-DIN-FB-03",
          teks: "Menerapkan karakter Sahabat UTSMAN (Ulet, Ta'at, Santun, Mandiri, Amanah, Nalar) dalam interaksi sosial di sekolah.",
        },
      ],
    },

    // --- FASE C (Kelas 5 - 6) ---
    {
      fase: "Fase C",
      domain: "Literasi",
      kode: "CP-LIT-FC",
      cpTeks: "Peserta didik mampu menganalisis informasi, mengevaluasi akurasi fakta dari beragam tipe teks multimodal, menulis laporan investigatif sederhana, dan berargumentasi kritis secara komunikatif.",
      tps: [
        {
          kode: "TP-LIT-FC-01",
          teks: "Menganalisis dan membedakan fakta dan opini dari artikel berita atau teks eksplanasi ilmiah.",
        },
        {
          kode: "TP-LIT-FC-02",
          teks: "Menulis teks laporan pengamatan/projek yang terstruktur dengan referensi yang relevan.",
        },
        {
          kode: "TP-LIT-FC-03",
          teks: "Mempresentasikan hasil analisis gagasan secara sistematis, persuasif, dan percaya diri.",
        },
      ],
    },
    {
      fase: "Fase C",
      domain: "Numerasi",
      kode: "CP-NUM-FC",
      cpTeks: "Peserta didik mampu menyelesaikan masalah aritmatika sosial, pecahan desimal dan persen, rasio dan perbandingan, geometri ruang (volume dan luas permukaan), serta analisis data kontekstual.",
      tps: [
        {
          kode: "TP-NUM-FC-01",
          teks: "Menyelesaikan masalah penalaran yang melibatkan operasi pecahan, desimal, dan persentase.",
        },
        {
          kode: "TP-NUM-FC-02",
          teks: "Menghitung perbandingan rasio, skala denah/peta, dan estimasi biaya sederhana.",
        },
        {
          kode: "TP-NUM-FC-03",
          teks: "Menghitung volume dan luas permukaan bangun ruang (kubus, balok, prisma) dalam pemecahan masalah nyata.",
        },
      ],
    },
    {
      fase: "Fase C",
      domain: "Diniyyah",
      kode: "CP-DIN-FC",
      cpTeks: "Peserta didik mendalami hukum syariat thaharah dan puasa, memahami sirah nabawiyyah peradaban Islam, membaca Al-Qur'an tartil bertajwid, serta menunjukkan komitmen ibadah mandiri dan kepemimpinan berakhlak.",
      tps: [
        {
          kode: "TP-DIN-FC-01",
          teks: "Menerapkan hukum tajwid lanjutan (Ghunnah, Qalqalah, Idgham, Ikhfa) saat tilawah Al-Qur'an secara mandiri.",
        },
        {
          kode: "TP-DIN-FC-02",
          teks: "Menjelaskan hikmah dan tata cara ibadah puasa, zakat, serta adab pergaulan islami di era digital.",
        },
        {
          kode: "TP-DIN-FC-03",
          teks: "Menunjukkan inisiatif kepemimpinan, kejujuran (Amanah), dan keteguhan iman dalam projek sosial kemasyarakatan.",
        },
      ],
    },
  ];

  const defaultUser = await db("users").whereIn("role", ["administrator", "admin"]).first() || (await db("users").first());
  const creatorUserId = defaultUser?.id || null;

  let cpCount = 0;
  let tpCount = 0;
  const now = new Date();

  for (const item of trisulaCurriculumData) {
    // 1. Check or insert CP by stable kode
    let cp = await db("cp_bank")
      .where("kode", item.kode)
      .first();

    if (!cp) {
      const cpId = uuidv4();
      await db("cp_bank").insert({
        id: cpId,
        kode: item.kode,
        teks: item.cpTeks,
        fase: item.fase,
        mata_pelajaran_name: item.domain,
        domain_trisula: item.domain,
        sumber: "INTERNAL_BLC",
        status: "active",
        created_by: creatorUserId,
        created_at: now,
        updated_at: now,
      });
      cp = { id: cpId, kode: item.kode };
      cpCount++;
    }

    // 2. Deterministically seed / link child TPs using stable identifier
    for (const tpDef of item.tps) {
      // Find by stable kode first
      let existingTP = await db("tp_bank")
        .where("kode", tpDef.kode)
        .first();

      if (!existingTP) {
        // Safe legacy fallback: match unmapped existing row by exact initial text + fase
        existingTP = await db("tp_bank")
          .whereRaw("LOWER(TRIM(teks)) = ?", [tpDef.teks.toLowerCase()])
          .andWhere("fase", item.fase)
          .first();

        if (existingTP) {
          // Deterministic backfill of stable kode onto existing TP record
          await db("tp_bank")
            .where("id", existingTP.id)
            .update({
              kode: tpDef.kode,
              cp_id: cp.id,
              updated_at: now,
            });
        }
      }

      if (!existingTP) {
        // Genuinely missing TP master -> insert it
        if (!creatorUserId) continue;
        await db("tp_bank").insert({
          id: uuidv4(),
          cp_id: cp.id,
          kode: tpDef.kode,
          teks: tpDef.teks,
          mata_pelajaran_name: item.domain,
          fase: item.fase,
          sumber: "manual",
          created_by: creatorUserId,
          created_at: now,
          updated_at: now,
        });
        tpCount++;
      } else {
        // Record exists. Ensure cp_id and kode are set without overwriting any edited text
        const updates: any = {};
        if (!existingTP.cp_id && cp.id) updates.cp_id = cp.id;
        if (!existingTP.kode) updates.kode = tpDef.kode;
        if (Object.keys(updates).length > 0) {
          updates.updated_at = now;
          await db("tp_bank").where("id", existingTP.id).update(updates);
        }
      }
    }
  }

  return { cpCount, tpCount };
}
