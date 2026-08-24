import { AppError } from "@/lib/errors";
import { getGeminiConfig, AIGenerationSource, AIFallbackReason } from "@/lib/config/gemini";
import { checkAIUsageLimit, recordAIUsageAttempt, classifyProvider429, AIUsageSnapshot } from "@/lib/services/aiUsageGuard";
import {
  RPMActivityItem,
  RPMActivityInput,
  VALID_TRISULA,
  VALID_FITRAH,
  VALID_SAHABAT,
  VALID_UTSMAN,
  VALID_KURNAS,
  DplKurnasValue,
  normalizeActivityItem,
  formatActivityItemWithTags,
} from "@/lib/utils/rpmUtils";

export type { RPMActivityItem, RPMActivityInput, DplKurnasValue };
export { normalizeActivityItem, formatActivityItemWithTags, VALID_KURNAS, VALID_TRISULA, VALID_FITRAH, VALID_SAHABAT, VALID_UTSMAN };

export interface RPMGenerateParams {
  mataPelajaran: string;
  kelasRombel: string;
  tingkatFase: string;
  alokasiWaktu: number; // in minutes
  modulTopik: string;
  userId?: string;
}

export interface RPMContent {
  identitas: {
    mataPelajaran: string;
    kelasRombel: string;
    tingkatFase: string;
    semesterTahun: string;
    alokasiWaktu: number;
    modulTopik: string;
    trisulaKompetensi: string[];
    deskripsiTrisula: { literasi: string; numerasi: string; diniyyah: string };
    karakterFitrah: string[];
    budayaSahabat: string[];
    dplUtsman: string[];
    dplKurnas: string[];
  };
  desainPembelajaran: {
    capaianPembelajaran: string;
    pemahamanBermakna: string;
    tujuanPembelajaran: string[];
    kegiatanPembelajaran: {
      awal: RPMActivityInput[];
      inti: RPMActivityInput[];
      akhir: RPMActivityInput[];
    };
    asesmen: { awal: string; formatif: string; sumatif: string; pesanEdukasiOrangTua: string };
  };
}

export interface RPMGenerationResult {
  source: AIGenerationSource;
  content: RPMContent;
  fallbackReason?: AIFallbackReason;
  usage?: AIUsageSnapshot;
}


export function getFallbackLocalRPMTemplate(
  params: RPMGenerateParams,
  reason: AIFallbackReason = 'NO_API_KEY',
  usage?: AIUsageSnapshot
): RPMGenerationResult {
  const intiTime = Math.max(params.alokasiWaktu - 20, 20);
  return {
    source: 'FALLBACK',
    fallbackReason: reason,
    usage,
    content: {
      identitas: {
        mataPelajaran: params.mataPelajaran,
        kelasRombel: params.kelasRombel,
        tingkatFase: params.tingkatFase,
        semesterTahun: "Semester Ganjil",
        alokasiWaktu: params.alokasiWaktu,
        modulTopik: params.modulTopik,
        trisulaKompetensi: ["Literasi", "Numerasi", "Diniyyah"],
        deskripsiTrisula: {
          literasi: `Melalui topik ${params.modulTopik}, santri diajak membaca, menganalisis, dan memetakan informasi kontekstual dari teks referensi untuk memperluas cakrawala pemahaman materi secara kritis dan komunikatif.`,
          numerasi: `Kegiatan pemelajaran ${params.modulTopik} mengintegrasikan penalaran logis, penghitungan kuantitatif, serta logika pemecahan masalah angka untuk memperkuat keterampilan matematis praktis santri.`,
          diniyyah: `Setiap tahapan pemelajaran ${params.modulTopik} dihubungkan dengan dalil Al-Qur'an/Hadits, penanaman adab menuntut ilmu, serta pembentukan akhlak karimah dalam pengaplikasian ilmu sehari-hari.`,
        },
        karakterFitrah: ["Keimanan", "Kemandirian", "Adab & Akhlak", "Kreativitas"],
        budayaSahabat: ["Disiplin", "Jujur", "Empati", "Tanggung Jawab"],
        dplUtsman: ["Keberanian", "Kedermawanan", "Kejujuran"],
        dplKurnas: ["Penalaran Kritis", "Kemandirian", "Kreativitas", "Kolaborasi"],
      },
      desainPembelajaran: {
        capaianPembelajaran: `Santri memahami dan menguasai konsep dasar ${params.modulTopik} secara mendalam serta mampu menerapkannya dalam memecahkan masalah kontekstual.`,
        pemahamanBermakna: `Santri menyadari pentingnya ${params.modulTopik} dalam kehidupan sehari-hari sebagai sarana meningkatkan kebermanfaatan diri dan ketaatan kepada Allah SWT.`,
        tujuanPembelajaran: [
          `Mengidentifikasi dan menjelaskan konsep dasar ${params.modulTopik} dengan tepat.`,
          `Melakukan latihan terbimbing dan pemecahan masalah mengenai ${params.modulTopik}.`,
          `Merefleksikan hikmah pembelajaran dan menerapkan adab Islami dalam setiap proses belajar.`,
        ],
        kegiatanPembelajaran: {
          awal: [
            {
              teks: `Pembukaan, pembacaan doa belajar, dan apersepsi kontekstual mengenai materi ${params.modulTopik} (10 Menit)`,
              tagBudaya: ["Disiplin"],
              tagKarakter: ["Adab & Akhlak", "Keimanan"],
            },
          ],
          inti: [
            {
              teks: `Eksplorasi materi dasar ${params.modulTopik}, diskusi kelompok, dan pembacaan teks modul terbimbing (${Math.round(intiTime / 2)} Menit)`,
              tagBudaya: ["Empati", "Jujur"],
              tagKarakter: ["Kemandirian", "Penalaran Kritis"],
            },
            {
              teks: `Praktik latihan soal/pemecahan masalah ${params.modulTopik} dan presentasi hasil kerja kelompok (${Math.floor(intiTime / 2)} Menit)`,
              tagBudaya: ["Tanggung Jawab"],
              tagKarakter: ["Keberanian", "Kreativitas"],
            },
          ],
          akhir: [
            {
              teks: `Refleksi bersama mengenai materi ${params.modulTopik}, penyimpulan hikmah pembelajaran, dan doa penutup (10 Menit)`,
              tagBudaya: ["Jujur"],
              tagKarakter: ["Adab & Akhlak", "Keimanan"],
            },
          ],
        },
        asesmen: {
          awal: `Tanya jawab lisan diagnostik untuk mengukur pemahaman awal santri terkait ${params.modulTopik}.`,
          formatif: `Observasi sikap, kemandirian, dan ketelitian santri selama pengerjaan tugas & diskusi kelompok materi ${params.modulTopik}.`,
          sumatif: `Evaluasi tertulis & unjuk kerja penyelesaian masalah kontekstual ${params.modulTopik} di akhir topik.`,
          pesanEdukasiOrangTua: `Mohon orang tua mendampingi ananda di rumah dalam mengulas kembali materi ${params.modulTopik} serta membiasakan sikap disiplin dan adab positif.`,
        },
      },
    },
  };
}

export async function generateRPMContentWithAI(params: RPMGenerateParams): Promise<RPMGenerationResult> {
  const { apiKey, model, endpointUrl } = getGeminiConfig();

  if (!apiKey || !endpointUrl) {
    return getFallbackLocalRPMTemplate(params, 'NO_API_KEY');
  }

  // 1. Guard check local RPM & RPD limits
  const usageCheck = await checkAIUsageLimit(model);
  if (!usageCheck.allowed && usageCheck.blockedReason) {
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: 'RPM_GENERATOR',
      model,
      source: 'FALLBACK',
      providerErrorReason: usageCheck.blockedReason,
      retryAttempt: 1,
    });
    return getFallbackLocalRPMTemplate(params, usageCheck.blockedReason, usageCheck.snapshot);
  }

  const prompt = `
Anda adalah pakar penyusun Rencana Pemelajaran (RPM) Kurikulum SIUBA / Kurikulum Merdeka Terpadu.
Buatkan rancangan RPM terstruktur dalam format JSON murni tanpa markdown wrapper untuk data berikut:
- Mata Pelajaran: ${params.mataPelajaran}
- Kelas / Rombel: ${params.kelasRombel}
- Tingkat / Fase: ${params.tingkatFase}
- Alokasi Waktu: ${params.alokasiWaktu} Menit
- Topik / Modul: ${params.modulTopik}

ATURAN PENTING & DETAILED REQUIREMENTS (WAJIB DIPATUHI SANGAT KETAT):
1. trisulaKompetensi: SELALU sertakan ketiga pilar baku: ${JSON.stringify(VALID_TRISULA)}
2. deskripsiTrisula: Tulis penjelasan lengkap 1 PARAGRAF UTUH untuk masing-masing pilar ("literasi", "numerasi", "diniyyah"). Penjelasan harus mengintegrasikan topik "${params.modulTopik}" secara mendalam, ilmiah, dan bernilai Diniyyah/Islamiah (bukan cuma 1 kalimat pendek).
3. karakterFitrah: Pilih 4-5 nilai (generous) yang PALING relevan untuk topik ini dari: ${JSON.stringify(VALID_FITRAH)}
4. budayaSahabat: Pilih 4-5 nilai (generous) yang PALING relevan untuk topik ini dari: ${JSON.stringify(VALID_SAHABAT)}
5. dplUtsman: Pilih 3-5 nilai (generous) yang PALING relevan untuk topik ini dari: ${JSON.stringify(VALID_UTSMAN)}
6. dplKurnas: Pilih 4-5 nilai (generous) dari DAFTAR BAKU INI (JANGAN MENGARANG NILAI BARU): ${JSON.stringify(VALID_KURNAS)}
7. kegiatanPembelajaran: Terdiri dari objek "awal", "inti", dan "akhir". Setiap item di dalamnya HARUS BERUPA OBJECT DENGAN STRUKTUR:
   { "teks": "Deskripsi rinci langkah aktivitas (N Menit)", "tagBudaya": ["Nama Tag Budaya"], "tagKarakter": ["Nama Tag Fitrah/DPL"] }
   - "teks" harus diakhiri durasi "(N Menit)". Total durasi seluruh kegiatan (awal + inti + akhir) HARUS SAMA PERSIS dengan ${params.alokasiWaktu} menit.
   - "tagBudaya": pilih 1-2 tag Budaya SAHABAT yang relevan dengan aktivitas tersebut dari daftar budayaSahabat yang dipilih.
   - "tagKarakter": pilih 1-2 tag Karakter Fitrah / DPL yang relevan dengan aktivitas tersebut dari daftar karakterFitrah / dplUtsman / dplKurnas yang dipilih.
8. asesmen: Buat kriteria asesmen yang SPESIFIK dan KONKRET ke topik "${params.modulTopik}" (BUKAN teks generik yang bisa dipakai untuk topik manapun):
   - "awal": Pertanyaan/observasi diagnostik spesifik materi ${params.modulTopik}.
   - "formatif": Observasi kriteria rubrik sikap, kemandirian, dan keteladanan yang menyebutkan aktivitas konkret materi ${params.modulTopik}.
   - "sumatif": Penilaian unjuk kerja / tes spesifik materi ${params.modulTopik}.
   - "pesanEdukasiOrangTua": Panduan konkret bagi orang tua di rumah terkait pembiasaan & ulasan materi ${params.modulTopik}.

Kembalikan respon DALAM FORMAT JSON PRESIS DENGAN STRUKTUR BERIKUT:
{
  "identitas": {
    "mataPelajaran": "${params.mataPelajaran}",
    "kelasRombel": "${params.kelasRombel}",
    "tingkatFase": "${params.tingkatFase}",
    "semesterTahun": "Semester Ganjil",
    "alokasiWaktu": ${params.alokasiWaktu},
    "modulTopik": "${params.modulTopik}",
    "trisulaKompetensi": ["Literasi", "Numerasi", "Diniyyah"],
    "deskripsiTrisula": {
      "literasi": "Paragraf lengkap penjelasan integrasi topik ${params.modulTopik} dalam aspek literasi...",
      "numerasi": "Paragraf lengkap penjelasan integrasi topik ${params.modulTopik} dalam aspek numerasi...",
      "diniyyah": "Paragraf lengkap penjelasan integrasi topik ${params.modulTopik} dalam aspek diniyyah dan adab Islam..."
    },
    "karakterFitrah": ["Keimanan", "Kemandirian", "Adab & Akhlak", "Kreativitas"],
    "budayaSahabat": ["Disiplin", "Jujur", "Empati", "Tanggung Jawab"],
    "dplUtsman": ["Keberanian", "Kedermawanan", "Kejujuran"],
    "dplKurnas": ["Penalaran Kritis", "Kemandirian", "Kreativitas", "Kolaborasi"]
  },
  "desainPembelajaran": {
    "capaianPembelajaran": "Capaian pembelajaran lengkap untuk ${params.modulTopik}...",
    "pemahamanBermakna": "Hikmah dan manfaat praktis dari mempelajari ${params.modulTopik}...",
    "tujuanPembelajaran": [
      "Tujuan 1...",
      "Tujuan 2...",
      "Tujuan 3..."
    ],
    "kegiatanPembelajaran": {
      "awal": [
        {
          "teks": "Pembukaan, doa bersama, dan apersepsi konteks ${params.modulTopik} (10 Menit)",
          "tagBudaya": ["Disiplin"],
          "tagKarakter": ["Adab & Akhlak"]
        }
      ],
      "inti": [
        {
          "teks": "Eksplorasi konsep dasar ${params.modulTopik} dan pembacaan materi (${Math.round((params.alokasiWaktu - 20) / 2)} Menit)",
          "tagBudaya": ["Jujur"],
          "tagKarakter": ["Kemandirian", "Penalaran Kritis"]
        },
        {
          "teks": "Diskusi kelompok dan penyelesaian latihan soal ${params.modulTopik} (${Math.floor((params.alokasiWaktu - 20) / 2)} Menit)",
          "tagBudaya": ["Empati", "Tanggung Jawab"],
          "tagKarakter": ["Kolaborasi", "Kreativitas"]
        }
      ],
      "akhir": [
        {
          "teks": "Refleksi pembelajaran ${params.modulTopik}, penyimpulan hikmah, dan doa penutup (10 Menit)",
          "tagBudaya": ["Jujur"],
          "tagKarakter": ["Adab & Akhlak", "Keimanan"]
        }
      ]
    },
    "asesmen": {
      "awal": "Tanya jawab lisan diagnostik spesifik tentang ${params.modulTopik}...",
      "formatif": "Observasi rubrik karakter santri saat berdiskusi dan menyelesaikan ${params.modulTopik}...",
      "sumatif": "Kuis tertulis dan penilaian unjuk kerja ${params.modulTopik}...",
      "pesanEdukasiOrangTua": "Panduan pendampingan orang tua di rumah untuk ${params.modulTopik}..."
    }
  }
}
  `.trim();

  const maxRetries = 2;
  let attempt = 0;
  let lastFallbackReason: AIFallbackReason = 'UNKNOWN';

  while (attempt < maxRetries) {
    attempt++;
    const reqStartedAt = new Date();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - reqStartedAt.getTime();

      if (response.status === 429) {
        const rawErrText = await response.text().catch(() => '');
        const classified = classifyProvider429(response.status, rawErrText);
        lastFallbackReason = classified;

        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'RPM_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 429,
          providerErrorReason: classified,
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });

        // Jika Daily Quota habis, JANGAN RETRY
        if (classified === 'DAILY_QUOTA') {
          return getFallbackLocalRPMTemplate(params, 'DAILY_QUOTA', usageCheck.snapshot);
        }

        if (attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        return getFallbackLocalRPMTemplate(params, 'RATE_LIMIT', usageCheck.snapshot);
      }

      if (response.status >= 500) {
        lastFallbackReason = 'HTTP_ERROR';
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'RPM_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: response.status,
          providerErrorReason: 'HTTP_ERROR',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });

        if (attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }
        return getFallbackLocalRPMTemplate(params, 'HTTP_ERROR', usageCheck.snapshot);
      }

      if (!response.ok) {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'RPM_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: response.status,
          providerErrorReason: 'HTTP_ERROR',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackLocalRPMTemplate(params, 'HTTP_ERROR', usageCheck.snapshot);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleanedText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsed: RPMContent;

      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'RPM_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 200,
          providerErrorReason: 'INVALID_JSON',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackLocalRPMTemplate(params, 'INVALID_JSON', usageCheck.snapshot);
      }

      if (!parsed.identitas || !parsed.desainPembelajaran) {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'RPM_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 200,
          providerErrorReason: 'INVALID_SCHEMA',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackLocalRPMTemplate(params, 'INVALID_SCHEMA', usageCheck.snapshot);
      }

      if (Array.isArray(parsed.identitas?.dplKurnas)) {
        parsed.identitas.dplKurnas = parsed.identitas.dplKurnas.filter(
          (v: string) => (VALID_KURNAS as readonly string[]).includes(v)
        );
        if (parsed.identitas.dplKurnas.length === 0) {
          parsed.identitas.dplKurnas = ["Penalaran Kritis", "Kemandirian"];
        }
      }

      // Pastikan trisulaKompetensi berisi ketiga pilar
      if (!parsed.identitas.trisulaKompetensi || parsed.identitas.trisulaKompetensi.length === 0) {
        parsed.identitas.trisulaKompetensi = ["Literasi", "Numerasi", "Diniyyah"];
      }

      // Record successful GEMINI attempt
      await recordAIUsageAttempt({
        userId: params.userId,
        feature: 'RPM_GENERATOR',
        model,
        source: 'GEMINI',
        providerHttpStatus: 200,
        durationMs,
        retryAttempt: attempt,
        requestStartedAt: reqStartedAt,
      });

      return {
        source: 'GEMINI',
        content: parsed,
        usage: usageCheck.snapshot,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastFallbackReason = controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR';
      const durationMs = Date.now() - reqStartedAt.getTime();

      await recordAIUsageAttempt({
        userId: params.userId,
        feature: 'RPM_GENERATOR',
        model,
        source: 'FALLBACK',
        providerErrorReason: lastFallbackReason,
        durationMs,
        retryAttempt: attempt,
        requestStartedAt: reqStartedAt,
      });

      if (attempt >= maxRetries) {
        return getFallbackLocalRPMTemplate(params, lastFallbackReason, usageCheck.snapshot);
      }
      const backoffDelay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  return getFallbackLocalRPMTemplate(params, lastFallbackReason, usageCheck.snapshot);
}

