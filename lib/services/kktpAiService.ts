// kktpAiService.ts — AI-powered KKTP assessment and TP generation service
import { getGeminiConfig, AIGenerationSource, AIFallbackReason } from "@/lib/config/gemini";
import { checkAIUsageLimit, recordAIUsageAttempt, classifyProvider429, AIUsageSnapshot } from "@/lib/services/aiUsageGuard";

export type KKTPEvidenceStatus = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';

export interface KKTPAssesmentTPInput {
  id: string;
  teks: string;
  sourceType: 'LINKED_RPM' | 'INDEPENDENT_MANUAL' | 'AI_GENERATED';
}

export interface KKTPAssesmentGenerateParams {
  catatanPengamatan: string;   // observasi singkat guru
  tpItems: KKTPAssesmentTPInput[];
  mataPelajaran: string;
  kelasRombel: string;
  namaMurid?: string;
  userId?: string;
}

export interface KKTPAssesmentTPResult {
  tpIndex: number;
  tpId: string;
  nilai: number | null;        // 0-100 jika SUFFICIENT, null jika PARTIAL/INSUFFICIENT
  deskripsi: string;          // deskripsi ketercapaian berbasis bukti
  evidenceStatus: KKTPEvidenceStatus;
  evidenceReason?: string;
}

export interface KKTPAssesmentResult {
  source: AIGenerationSource;
  tpResults: KKTPAssesmentTPResult[];
  catatanUmumAI?: string;     // ringkasan analisis bukti
  fallbackReason?: AIFallbackReason;
  usage?: AIUsageSnapshot;
}

/**
 * Fallback lokal jika Gemini tidak tersedia.
 * TIDAK menghasilkan nilai dan deskripsi palsu tanpa dasar (Prinsip P1 & P2).
 */
export function getFallbackKKTPAssesment(
  params: KKTPAssesmentGenerateParams,
  reason: AIFallbackReason = 'NO_API_KEY',
  usage?: AIUsageSnapshot
): KKTPAssesmentResult {
  return {
    source: 'FALLBACK',
    fallbackReason: reason,
    usage,
    tpResults: params.tpItems.map((tp, idx) => ({
      tpIndex: idx,
      tpId: tp.id,
      nilai: null,
      deskripsi: '',
      evidenceStatus: 'INSUFFICIENT' as KKTPEvidenceStatus,
      evidenceReason: 'Layanan AI tidak tersedia sehingga sistem tidak membuat penilaian otomatis.',
    })),
    catatanUmumAI: 'Layanan AI sedang tidak tersedia. Nilai dan deskripsi tidak diisi otomatis agar sistem tidak membuat asesmen tanpa dasar. Silakan isi manual atau coba kembali.',
  };
}

/**
 * generateKKTPAssesmentWithAI
 *
 * Menganalisis catatan pengamatan guru terhadap daftar TP dengan Gemini AI.
 * - Memeriksa kuota & rate limit lokal (RPM / RPD) sebelum memanggil Google API.
 * - Menentukan evidenceStatus ('SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT') per TP.
 * - Hanya memberikan skor numerik 0-100 jika evidenceStatus === 'SUFFICIENT'.
 * - Jika PARTIAL atau INSUFFICIENT, nilai WAJIB null.
 * - Fallback ke getFallbackKKTPAssesment() jika Gemini gagal/timeout/quota limit.
 */
export async function generateKKTPAssesmentWithAI(
  params: KKTPAssesmentGenerateParams
): Promise<KKTPAssesmentResult> {
  const { apiKey, model, endpointUrl } = getGeminiConfig();

  if (!apiKey || !endpointUrl) {
    return getFallbackKKTPAssesment(params, 'NO_API_KEY');
  }

  // 1. Guard check local RPM & RPD limits
  const usageCheck = await checkAIUsageLimit(model);
  if (!usageCheck.allowed && usageCheck.blockedReason) {
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: 'KKTP_ASSESSMENT',
      model,
      source: 'FALLBACK',
      providerErrorReason: usageCheck.blockedReason,
      retryAttempt: 1,
    });
    return getFallbackKKTPAssesment(params, usageCheck.blockedReason, usageCheck.snapshot);
  }

  const tpListText = params.tpItems
    .map((tp, idx) => `TP ${idx + 1}: "${tp.teks}"`)
    .join('\n');

  const prompt = `
Anda adalah asisten penilaian pendidikan yang membantu tutor PKBM mengevaluasi bukti ketercapaian Tujuan Pembelajaran (KKTP) berdasarkan catatan observasi guru secara objektif dan berbasis bukti.

KONTEKS ASESMEN:
- Mata Pelajaran: ${params.mataPelajaran}
- Kelas: ${params.kelasRombel}
${params.namaMurid ? `- Nama Murid: ${params.namaMurid}` : ''}

CATATAN PENGAMATAN GURU:
"""
${params.catatanPengamatan}
"""

DAFTAR TUJUAN PEMBELAJARAN YANG DINILAI:
${tpListText}

PRINSIP UTAMA (WAJIB DIPATUHI SANGAT KETAT):
1. JANGAN MEMBUAT FAKTA, perilaku, kemampuan, kelemahan, atau pencapaian yang TIDAK disebutkan atau TIDAK DAPAT diturunkan secara langsung dari catatan pengamatan guru.
2. Evaluasi SETIAP Tujuan Pembelajaran secara INDEPENDEN dan HANYA berdasarkan bukti relevan pada catatan pengamatan.
3. Untuk setiap TP, tentukan "evidenceStatus" dari salah satu opsi berikut:
   - "SUFFICIENT": Catatan guru memiliki bukti yang jelas, spesifik, dan relevan terhadap sebagian besar aspek TP ini.
   - "PARTIAL": Catatan guru relevan terhadap TP ini tetapi masih ambigu, kontradiktif, belum lengkap, atau hanya menjelaskan sebagian kecil kemampuan.
   - "INSUFFICIENT": Catatan guru TIDAK memberikan bukti yang cukup atau sama sekali tidak membahas materi/keterampilan terkait TP ini.

ATURAN PENETAPAN NILAI DAN DESKRIPSI:
1. Jika evidenceStatus = "SUFFICIENT":
   - "nilai" HARUS berupa angka integer antara 0-100 (0 = tidak ada pencapaian, 76 = tuntas minimal, 90+ = sangat baik).
   - "deskripsi" HARUS spesifik menguraikan capaian konkret berdasarkan catatan guru.
2. Jika evidenceStatus = "PARTIAL":
   - "nilai" HARUS bernilai null. JANGAN memberikan nilai numerik untuk bukti yang ambigu atau tidak lengkap.
   - "deskripsi" HARUS menjelaskan aspek apa yang sudah terlihat dan aspek apa yang masih belum jelas/perlu dikonfirmasi guru.
3. Jika evidenceStatus = "INSUFFICIENT":
   - "nilai" HARUS bernilai null.
   - "deskripsi" HARUS menjelaskan bahwa catatan pengamatan belum memuat bukti yang cukup untuk menilai TP ini.
4. Array output HARUS berisi TEPAT ${params.tpItems.length} item, urutan sesuai urutan TP di atas.

FORMAT OUTPUT (JSON murni, TANPA markdown wrapper):
{
  "tpResults": [
    {
      "tpIndex": 0,
      "evidenceStatus": "SUFFICIENT",
      "nilai": 85,
      "deskripsi": "Deskripsi ketercapaian konkret berdasarkan bukti yang ada di catatan..."
    },
    {
      "tpIndex": 1,
      "evidenceStatus": "PARTIAL",
      "nilai": null,
      "deskripsi": "Catatan menunjukkan siswa mulai memahami konsep tetapi masih belum konsisten pada penerapannya..."
    },
    {
      "tpIndex": 2,
      "evidenceStatus": "INSUFFICIENT",
      "nilai": null,
      "deskripsi": "Catatan pengamatan belum memuat bukti terkait keterampilan ini."
    }
  ],
  "catatanUmumAI": "Ringkasan analisis bukti observasi..."
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          feature: 'KKTP_ASSESSMENT',
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
          return getFallbackKKTPAssesment(params, 'DAILY_QUOTA', usageCheck.snapshot);
        }

        // Jika Transient Rate Limit, tunggu backoff singkat
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return getFallbackKKTPAssesment(params, 'RATE_LIMIT', usageCheck.snapshot);
      }

      if (response.status >= 500) {
        lastFallbackReason = 'HTTP_ERROR';
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'KKTP_ASSESSMENT',
          model,
          source: 'FALLBACK',
          providerHttpStatus: response.status,
          providerErrorReason: 'HTTP_ERROR',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        return getFallbackKKTPAssesment(params, 'HTTP_ERROR', usageCheck.snapshot);
      }

      if (!response.ok) {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'KKTP_ASSESSMENT',
          model,
          source: 'FALLBACK',
          providerHttpStatus: response.status,
          providerErrorReason: 'HTTP_ERROR',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackKKTPAssesment(params, 'HTTP_ERROR', usageCheck.snapshot);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed: { tpResults: any[]; catatanUmumAI?: string };

      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'KKTP_ASSESSMENT',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 200,
          providerErrorReason: 'INVALID_JSON',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackKKTPAssesment(params, 'INVALID_JSON', usageCheck.snapshot);
      }

      if (!Array.isArray(parsed.tpResults)) {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'KKTP_ASSESSMENT',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 200,
          providerErrorReason: 'INVALID_SCHEMA',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackKKTPAssesment(params, 'INVALID_SCHEMA', usageCheck.snapshot);
      }

      // Validasi & sanitize parsed.tpResults
      const validEvidenceStatuses: KKTPEvidenceStatus[] = ['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT'];

      const validated: KKTPAssesmentTPResult[] = parsed.tpResults.map((r: any, idx: number) => {
        const rawStatus = String(r.evidenceStatus || '').toUpperCase();
        let evidenceStatus: KKTPEvidenceStatus = validEvidenceStatuses.includes(rawStatus as KKTPEvidenceStatus)
          ? (rawStatus as KKTPEvidenceStatus)
          : 'INSUFFICIENT';

        let nilai: number | null = null;
        if (evidenceStatus === 'SUFFICIENT') {
          const rawNilai = Number(r.nilai);
          if (!isNaN(rawNilai) && r.nilai !== null && r.nilai !== undefined && r.nilai !== '') {
            nilai = Math.min(100, Math.max(0, Math.round(rawNilai)));
          } else {
            // Jika AI menandai SUFFICIENT tetapi nilai invalid, ubah menjadi PARTIAL tanpa skor numerik
            evidenceStatus = 'PARTIAL';
            nilai = null;
          }
        } else {
          // PARTIAL atau INSUFFICIENT WAJIB null
          nilai = null;
        }

        const defaultDeskripsi = evidenceStatus === 'INSUFFICIENT'
          ? `Catatan pengamatan belum memuat bukti yang cukup untuk menilai TP ${idx + 1}.`
          : evidenceStatus === 'PARTIAL'
          ? `Bukti observasi untuk TP ${idx + 1} masih parsial atau belum konsisten.`
          : `Ketercapaian pada "${(params.tpItems[idx]?.teks || '').slice(0, 60)}" sesuai catatan pengamatan.`;

        const deskripsi = typeof r.deskripsi === 'string' && r.deskripsi.trim()
          ? r.deskripsi.trim()
          : defaultDeskripsi;

        return {
          tpIndex: idx,
          tpId: params.tpItems[idx]?.id || String(idx),
          nilai,
          deskripsi,
          evidenceStatus,
          evidenceReason: typeof r.evidenceReason === 'string' ? r.evidenceReason : undefined,
        };
      });

      // Pastikan jumlah result sesuai jumlah TP (jika AI mengembalikan kurang)
      while (validated.length < params.tpItems.length) {
        const idx = validated.length;
        validated.push({
          tpIndex: idx,
          tpId: params.tpItems[idx]?.id || String(idx),
          nilai: null,
          deskripsi: `AI tidak mengembalikan analisis yang cukup untuk TP ${idx + 1}.`,
          evidenceStatus: 'INSUFFICIENT' as KKTPEvidenceStatus,
          evidenceReason: 'Missing from AI output array',
        });
      }

      // Record successful GEMINI attempt
      await recordAIUsageAttempt({
        userId: params.userId,
        feature: 'KKTP_ASSESSMENT',
        model,
        source: 'GEMINI',
        providerHttpStatus: 200,
        durationMs,
        retryAttempt: attempt,
        requestStartedAt: reqStartedAt,
      });

      return {
        source: 'GEMINI',
        tpResults: validated.slice(0, params.tpItems.length),
        catatanUmumAI: parsed.catatanUmumAI || undefined,
        usage: usageCheck.snapshot,
      };
    } catch {
      clearTimeout(timeoutId);
      lastFallbackReason = controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR';
      const durationMs = Date.now() - reqStartedAt.getTime();

      await recordAIUsageAttempt({
        userId: params.userId,
        feature: 'KKTP_ASSESSMENT',
        model,
        source: 'FALLBACK',
        providerErrorReason: lastFallbackReason,
        durationMs,
        retryAttempt: attempt,
        requestStartedAt: reqStartedAt,
      });

      if (attempt >= maxRetries) {
        return getFallbackKKTPAssesment(params, lastFallbackReason, usageCheck.snapshot);
      }
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return getFallbackKKTPAssesment(params, lastFallbackReason, usageCheck.snapshot);
}

// ─── Generate TP Suggestions with AI ────────────────────────────────────────

export interface TPSuggestionGenerateParams {
  topikMateri: string;
  mataPelajaran: string;
  tingkatFase: string;
  cpTeks?: string;
  cpId?: string;
  userId?: string;
}

export interface TPSuggestionResult {
  source: AIGenerationSource;
  saranTP: string[];
  fallbackReason?: AIFallbackReason;
  usage?: AIUsageSnapshot;
}

export function getFallbackTPSuggestions(
  params: TPSuggestionGenerateParams,
  reason: AIFallbackReason = 'NO_API_KEY',
  usage?: AIUsageSnapshot
): TPSuggestionResult {
  const topik = params.topikMateri.trim() || "Materi Pembelajaran";
  const mapel = params.mataPelajaran || "Mata Pelajaran";
  const fase = params.tingkatFase || "Fase C";

  return {
    source: 'FALLBACK',
    fallbackReason: reason,
    usage,
    saranTP: [
      `Peserta didik mampu mengidentifikasi dan menjelaskan konsep dasar ${topik} pada ${mapel} (${fase}) dengan benar.`,
      `Peserta didik mampu mempraktikkan serta menyelesaikan latihan soal/pemecahan masalah terkait ${topik} secara mandiri.`,
      `Peserta didik mampu merefleksikan hikmah dan menerapkan pemahaman ${topik} dalam konteks kehidupan sehari-hari dengan beradab.`,
    ],
  };
}

/**
 * generateTPSuggestionsWithAI
 *
 * Menghasilkan 3-5 saran Tujuan Pembelajaran (TP) terstruktur berbasis Kurikulum Merdeka
 * berdasarkan topik/materi, mata pelajaran, fase, dan opsional Capaian Pembelajaran (CP) acuan.
 */
export async function generateTPSuggestionsWithAI(
  params: TPSuggestionGenerateParams
): Promise<TPSuggestionResult> {
  const { apiKey, model, endpointUrl } = getGeminiConfig();

  if (!apiKey || !endpointUrl) {
    return getFallbackTPSuggestions(params, 'NO_API_KEY');
  }

  // 1. Guard check local RPM & RPD limits
  const usageCheck = await checkAIUsageLimit(model);
  if (!usageCheck.allowed && usageCheck.blockedReason) {
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: 'TP_GENERATOR',
      model,
      source: 'FALLBACK',
      providerErrorReason: usageCheck.blockedReason,
      retryAttempt: 1,
    });
    return getFallbackTPSuggestions(params, usageCheck.blockedReason, usageCheck.snapshot);
  }

  const cpInstruction = params.cpTeks && params.cpTeks.trim().length > 0
    ? `- Capaian Pembelajaran (CP) Acuan: "${params.cpTeks.trim()}"\n\nATURAN KHUSUS CP:\n- Turunkan butir-butir Tujuan Pembelajaran (TP) secara langsung dan selaras dengan Capaian Pembelajaran (CP) di atas.`
    : '';

  const prompt = `
Anda adalah pakar kurikulum dan penyusun modul ajar Kurikulum Merdeka Terpadu / SIUBA.
Tugas Anda adalah merumuskan 3-5 butir Tujuan Pembelajaran (TP) yang operasional, terukur, dan bermakna.

KONTEKS PEMBELAJARAN:
- Mata Pelajaran: ${params.mataPelajaran}
- Tingkat / Fase: ${params.tingkatFase}
- Topik / Materi: "${params.topikMateri}"
${cpInstruction}

ATURAN PERUMUSAN TP (WAJIB DIPATUHI):
1. Setiap kalimat TP HARUS dimulai dengan frasa "Peserta didik mampu..." atau "Murid mampu...".
2. Rumuskan 3 hingga 5 butir TP yang mencakup hierarki kognitif (pemahaman konsep, aplikasi/keterampilan praktik, serta penalaran/refleksi adab).
3. Bahasa lugas, operasional (kata kerja terukur seperti mengidentifikasi, menganalisis, mempraktikkan, menyelesaikan masalah), dan spesifik ke topik "${params.topikMateri}".
4. JANGAN gunakan pengantar atau penutup. Kembalikan JSON murni.

FORMAT OUTPUT (JSON murni, TANPA markdown wrapper):
{
  "saranTP": [
    "Peserta didik mampu mengidentifikasi...",
    "Peserta didik mampu mempraktikkan...",
    "Peserta didik mampu menerapkan..."
  ]
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
          feature: 'TP_GENERATOR',
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
          return getFallbackTPSuggestions(params, 'DAILY_QUOTA', usageCheck.snapshot);
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return getFallbackTPSuggestions(params, 'RATE_LIMIT', usageCheck.snapshot);
      }

      if (response.status >= 500) {
        lastFallbackReason = 'HTTP_ERROR';
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'TP_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: response.status,
          providerErrorReason: 'HTTP_ERROR',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        return getFallbackTPSuggestions(params, 'HTTP_ERROR', usageCheck.snapshot);
      }

      if (!response.ok) {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'TP_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: response.status,
          providerErrorReason: 'HTTP_ERROR',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackTPSuggestions(params, 'HTTP_ERROR', usageCheck.snapshot);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleanedText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsed: { saranTP: string[] };

      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'TP_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 200,
          providerErrorReason: 'INVALID_JSON',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackTPSuggestions(params, 'INVALID_JSON', usageCheck.snapshot);
      }

      if (!Array.isArray(parsed.saranTP) || parsed.saranTP.length === 0) {
        await recordAIUsageAttempt({
          userId: params.userId,
          feature: 'TP_GENERATOR',
          model,
          source: 'FALLBACK',
          providerHttpStatus: 200,
          providerErrorReason: 'INVALID_SCHEMA',
          durationMs,
          retryAttempt: attempt,
          requestStartedAt: reqStartedAt,
        });
        return getFallbackTPSuggestions(params, 'INVALID_SCHEMA', usageCheck.snapshot);
      }

      const cleanList = parsed.saranTP
        .map((s) => String(s || "").trim())
        .filter((s) => s.length > 5);

      // Record successful GEMINI attempt
      await recordAIUsageAttempt({
        userId: params.userId,
        feature: 'TP_GENERATOR',
        model,
        source: 'GEMINI',
        providerHttpStatus: 200,
        durationMs,
        retryAttempt: attempt,
        requestStartedAt: reqStartedAt,
      });

      return {
        source: 'GEMINI',
        saranTP: cleanList.length > 0 ? cleanList : getFallbackTPSuggestions(params).saranTP,
        usage: usageCheck.snapshot,
      };
    } catch {
      clearTimeout(timeoutId);
      lastFallbackReason = controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR';
      const durationMs = Date.now() - reqStartedAt.getTime();

      await recordAIUsageAttempt({
        userId: params.userId,
        feature: 'TP_GENERATOR',
        model,
        source: 'FALLBACK',
        providerErrorReason: lastFallbackReason,
        durationMs,
        retryAttempt: attempt,
        requestStartedAt: reqStartedAt,
      });

      if (attempt >= maxRetries) {
        return getFallbackTPSuggestions(params, lastFallbackReason, usageCheck.snapshot);
      }
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return getFallbackTPSuggestions(params, lastFallbackReason, usageCheck.snapshot);
}
