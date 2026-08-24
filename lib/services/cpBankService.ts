import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/lib/errors";
import { ensureTpBankTableExists } from "@/lib/services/tpBankService";
import { resolvePhaseByClassLevel, resolvePhaseByClassName } from "@/lib/utils/academicUtils";

export type CPSource = "OFFICIAL" | "INTERNAL_BLC" | "MANUAL" | "AI_ASSISTED";

export interface BankCPItem {
  id: string;
  kode: string | null;
  teks: string;
  fase: string;
  mata_pelajaran_id: string | null;
  mata_pelajaran_name: string | null;
  domain_trisula: string | null;
  sumber: CPSource;
  status: "active" | "inactive";
  created_by: string | null;
  creator_name?: string;
  tp_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BankCPFilters {
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  fase?: string;
  class_id?: string;
  class_level?: number | string;
  domain_trisula?: string;
  sumber?: string;
  status?: string;
  search?: string;
}

export interface CreateCPInput {
  teks: string;
  fase?: string;
  class_level?: number | string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  domain_trisula?: string | null;
  kode?: string | null;
  sumber?: CPSource;
}

export interface UpdateCPInput {
  teks?: string;
  fase?: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  domain_trisula?: string | null;
  kode?: string | null;
  status?: "active" | "inactive";
}

/**
 * Ensures cp_bank and updated tp_bank columns exist in MySQL.
 */
export async function ensureCpBankTableExists(): Promise<void> {
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
        CONSTRAINT \`fk_cp_bank_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_cp_bank_subject\` FOREIGN KEY (\`mata_pelajaran_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await db.raw("SET FOREIGN_KEY_CHECKS = 1;");
  }

  // Ensure cp_id column in tp_bank
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

  if (filters.status) {
    query.where("cp_bank.status", filters.status);
  } else {
    query.where("cp_bank.status", "active");
  }

  if (effectiveFase) {
    query.where("cp_bank.fase", effectiveFase);
  }

  if (filters.domain_trisula) {
    query.where((b: any) => {
      b.where("cp_bank.domain_trisula", filters.domain_trisula!)
        .orWhere("cp_bank.mata_pelajaran_name", filters.domain_trisula!);
    });
  }


  if (filters.mata_pelajaran_id) {
    query.where("cp_bank.mata_pelajaran_id", filters.mata_pelajaran_id);
  } else if (filters.mata_pelajaran_name && !filters.domain_trisula) {
    query.where("cp_bank.mata_pelajaran_name", filters.mata_pelajaran_name);
  }

  if (filters.sumber) {
    query.where("cp_bank.sumber", filters.sumber);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    query.where((builder: any) => {
      builder
        .whereILike("cp_bank.teks", term)
        .orWhereILike("cp_bank.kode", term)
        .orWhereILike("cp_bank.mata_pelajaran_name", term)
        .orWhereILike("cp_bank.domain_trisula", term);
    });
  }

  const countQuery = query.clone();
  const countRes = await countQuery.count("cp_bank.id as total").first();
  const total = Number(countRes?.total || 0);

  const offset = (page - 1) * limit;
  const items = await query
    .orderBy("cp_bank.created_at", "desc")
    .limit(limit)
    .offset(offset);

  // Attach linked TP counts
  if (items.length > 0) {
    const cpIds = items.map((i: any) => i.id);
    const tpCounts = await db("tp_bank")
      .whereIn("cp_id", cpIds)
      .groupBy("cp_id")
      .select("cp_id")
      .count("id as count");

    const countMap = new Map<string, number>();
    tpCounts.forEach((r: any) => countMap.set(r.cp_id, Number(r.count || 0)));

    items.forEach((item: any) => {
      item.tp_count = countMap.get(item.id) || 0;
    });
  }

  return {
    data: items,
    pagination: { page, limit, total },
  };
}

/**
 * Get CP Detail by ID with all linked child TPs.
 */
export async function getCPById(id: string): Promise<{ cp: BankCPItem; tps: any[] } | null> {
  await ensureCpBankTableExists();

  const cp = await db("cp_bank")
    .leftJoin("users", "cp_bank.created_by", "users.id")
    .where("cp_bank.id", id)
    .select("cp_bank.*", "users.name as creator_name")
    .first();

  if (!cp) return null;

  const tps = await db("tp_bank")
    .where("cp_id", id)
    .orderBy("created_at", "asc");

  return { cp, tps };
}

/**
 * Create a new CP in Bank CP.
 */
export async function createBankCP(input: CreateCPInput, userId: string): Promise<BankCPItem> {
  await ensureCpBankTableExists();

  const rawTeks = input.teks?.trim();
  if (!rawTeks || rawTeks.length < 5) {
    throw new AppError("Teks Capaian Pembelajaran (CP) minimal 5 karakter.", "ERR_VALIDATION", 400);
  }

  const fase = input.fase || (input.class_level !== undefined ? resolvePhaseByClassLevel(input.class_level) : "Fase C");
  const now = new Date();
  const id = uuidv4();

  const newCP: BankCPItem = {
    id,
    kode: input.kode?.trim() || null,
    teks: rawTeks,
    fase,
    mata_pelajaran_id: input.mata_pelajaran_id || null,
    mata_pelajaran_name: input.mata_pelajaran_name?.trim() || null,
    domain_trisula: input.domain_trisula?.trim() || null,
    sumber: input.sumber || "INTERNAL_BLC",
    status: "active",
    created_by: userId,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  await db("cp_bank").insert({
    id: newCP.id,
    kode: newCP.kode,
    teks: newCP.teks,
    fase: newCP.fase,
    mata_pelajaran_id: newCP.mata_pelajaran_id,
    mata_pelajaran_name: newCP.mata_pelajaran_name,
    domain_trisula: newCP.domain_trisula,
    sumber: newCP.sumber,
    status: newCP.status,
    created_by: newCP.created_by,
    created_at: now,
    updated_at: now,
  });

  return newCP;
}

/**
 * Update an existing CP in Bank CP.
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
 * Idempotently seeds CP & TP for Fase A, Fase B, and Fase C (Literasi, Numerasi, Diniyyah).
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
        "Mengenal dan melafalkan bunyi huruf serta suku kata dalam kata-kata sederhana dengan fasih.",
        "Membaca dan memahami isi cerita bergambar serta teks informasi pendek dengan intonasi yang wajar.",
        "Menceritakan kembali pesan utama dari teks fiksi atau informasi sederhana dengan bahasa sendiri.",
      ],
    },
    {
      fase: "Fase A",
      domain: "Numerasi",
      kode: "CP-NUM-FA",
      cpTeks: "Peserta didik mampu memahami bilangan cacah sampai dengan 100, melakukan operasi penjumlahan dan pengurangan sederhana, serta mengenal pola bangun datar sederhana di lingkungan sekitar.",
      tps: [
        "Membilang, menuliskan, dan membandingkan lambang bilangan cacah sampai dengan 100.",
        "Melakukan operasi penjumlahan dan pengurangan bilangan cacah sampai dengan 20 dalam kehidupan sehari-hari.",
        "Mengenal dan mengelompokkan bentuk bangun datar (segitiga, segiempat, lingkaran) dalam konteks nyata.",
      ],
    },
    {
      fase: "Fase A",
      domain: "Diniyyah",
      kode: "CP-DIN-FA",
      cpTeks: "Peserta didik membiasakan adab-adab harian Islamiah, mengenal rukun iman dan Islam, membaca huruf hijaiyyah, serta menghafal doa harian dan surat-surat pendek pilihan.",
      tps: [
        "Mengenal huruf hijaiyyah berharakat dan melafalkan doa-doa harian (sebelum makan, tidur, belajar).",
        "Mempraktikkan tata cara wudhu dan gerakan shalat fardhu secara tertib.",
        "Meneladani akhlak mulia dan kasih sayang kepada orang tua, guru, dan teman sebaya.",
      ],
    },

    // --- FASE B (Kelas 3 - 4) ---
    {
      fase: "Fase B",
      domain: "Literasi",
      kode: "CP-LIT-FB",
      cpTeks: "Peserta didik mampu memahami pesan dan informasi tentang topik kontekstual dari teks narasi dan eksposisi, mampu mengidentifikasi ide pokok serta menulis paragraf gagasan dengan kaidah ejaan yang tepat.",
      tps: [
        "Menemukan ide pokok dan informasi tersurat maupun tersirat dalam teks bacaan 2-3 paragraf.",
        "Menyusun kalimat efektif dan paragraf deskriptif/naratif runtut menggunakan kosakata baru.",
        "Menyampaikan pendapat secara santun dalam diskusi kelompok tentang topik sehari-hari.",
      ],
    },
    {
      fase: "Fase B",
      domain: "Numerasi",
      kode: "CP-NUM-FB",
      cpTeks: "Peserta didik mampu memahami operasi perkalian, pembagian, konsep pecahan senilai dasar, pengukuran panjang dan berat, serta penyajian data sederhana dalam bentuk tabel dan diagram batang.",
      tps: [
        "Menyelesaikan operasi hitung perkalian dan pembagian bilangan cacah sampai 1.000 dengan metode bersusun.",
        "Memahami konsep pecahan senilai dan melakukan operasi pecahan sederhana berpenyebut sama.",
        "Membaca dan menyajikan data kuantitatif sederhana menggunakan tabel frekuensi dan diagram batang.",
      ],
    },
    {
      fase: "Fase B",
      domain: "Diniyyah",
      kode: "CP-DIN-FB",
      cpTeks: "Peserta didik memahami rukun shalat dan syarat sahnya, membaca Al-Qur'an sesuai kaidah tajwid dasar, menghafal juz 'Amma pilihan, serta meneladani kisah keteladanan Nabi dan Sahabat (UTSMAN).",
      tps: [
        "Membaca ayat Al-Qur'an dengan menerapkan hukum tajwid dasar (Nun Sukun, Tanwin, Mad Thabi'i).",
        "Menghafal dan memahami arti surat-surat pendek dalam Juz 'Amma (An-Nas sampai Ad-Dhuha).",
        "Menerapkan karakter Sahabat UTSMAN (Ulet, Ta'at, Santun, Mandiri, Amanah, Nalar) dalam interaksi sosial di sekolah.",
      ],
    },

    // --- FASE C (Kelas 5 - 6) ---
    {
      fase: "Fase C",
      domain: "Literasi",
      kode: "CP-LIT-FC",
      cpTeks: "Peserta didik mampu menganalisis informasi, mengevaluasi akurasi fakta dari beragam tipe teks multimodal, menulis laporan investigatif sederhana, dan berargumentasi kritis secara komunikatif.",
      tps: [
        "Menganalisis dan membedakan fakta dan opini dari artikel berita atau teks eksplanasi ilmiah.",
        "Menulis teks laporan pengamatan/projek yang terstruktur dengan referensi yang relevan.",
        "Mempresentasikan hasil analisis gagasan secara sistematis, persuasif, dan percaya diri.",
      ],
    },
    {
      fase: "Fase C",
      domain: "Numerasi",
      kode: "CP-NUM-FC",
      cpTeks: "Peserta didik mampu menyelesaikan masalah aritmatika sosial, pecahan desimal dan persen, rasio dan perbandingan, geometri ruang (volume dan luas permukaan), serta analisis data kontekstual.",
      tps: [
        "Menyelesaikan masalah penalaran yang melibatkan operasi pecahan, desimal, dan persentase.",
        "Menghitung perbandingan rasio, skala denah/peta, dan estimasi biaya sederhana.",
        "Menghitung volume dan luas permukaan bangun ruang (kubus, balok, prisma) dalam pemecahan masalah nyata.",
      ],
    },
    {
      fase: "Fase C",
      domain: "Diniyyah",
      kode: "CP-DIN-FC",
      cpTeks: "Peserta didik mendalami hukum syariat thaharah dan puasa, memahami sirah nabawiyyah peradaban Islam, membaca Al-Qur'an tartil bertajwid, serta menunjukkan komitmen ibadah mandiri dan kepemimpinan berakhlak.",
      tps: [
        "Menerapkan hukum tajwid lanjutan (Ghunnah, Qalqalah, Idgham, Ikhfa) saat tilawah Al-Qur'an secara mandiri.",
        "Menjelaskan hikmah dan tata cara ibadah puasa, zakat, serta adab pergaulan islami di era digital.",
        "Menunjukkan inisiatif kepemimpinan, kejujuran (Amanah), dan keteguhan iman dalam projek sosial kemasyarakatan.",
      ],
    },
  ];

  const defaultUser = await db("users").whereIn("role", ["administrator", "admin"]).first() || (await db("users").first());
  const creatorUserId = defaultUser?.id || null;

  let cpCount = 0;
  let tpCount = 0;
  const now = new Date();

  for (const item of trisulaCurriculumData) {
    // Check if CP already exists
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
      cp = { id: cpId };
      cpCount++;
    }

    // Seed child TPs
    for (const tpTeks of item.tps) {
      const existingTP = await db("tp_bank")
        .whereRaw("LOWER(TRIM(teks)) = ?", [tpTeks.toLowerCase()])
        .andWhere("fase", item.fase)
        .first();

      if (!existingTP) {
        if (!creatorUserId) continue;
        await db("tp_bank").insert({
          id: uuidv4(),
          cp_id: cp.id,
          teks: tpTeks,
          mata_pelajaran_name: item.domain,
          fase: item.fase,
          sumber: "manual",
          created_by: creatorUserId,
          created_at: now,
          updated_at: now,
        });
        tpCount++;
      } else if (!existingTP.cp_id) {
        // Link legacy TP to this CP
        await db("tp_bank")
          .where("id", existingTP.id)
          .update({ cp_id: cp.id, updated_at: now });
      }
    }
  }


  return { cpCount, tpCount };
}
