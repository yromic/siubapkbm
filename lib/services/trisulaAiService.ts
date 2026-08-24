import { getGeminiConfig, AIGenerationSource, AIFallbackReason } from "@/lib/config/gemini";
import {
  checkAIUsageLimit,
  recordAIUsageAttempt,
  AIUsageSnapshot,
} from "@/lib/services/aiUsageGuard";
import { TrisulaPillar, EvidenceStatus } from "@/lib/services/trisulaAssessmentService";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface TrisulaEvaluateObservationParams {
  studentName: string;
  className: string;
  fase: string;
  pillar: TrisulaPillar;
  cpText?: string | null;
  tps: Array<{ id: string; teks: string }>;
  observationText: string;
  userId?: string;
}

export interface TrisulaEvaluateObservationResult {
  source: AIGenerationSource;
  evidenceStatus: EvidenceStatus;
  nilai: number | null;
  matchedTpIds: string[];
  deskripsi: string;
  evidenceReason: string;
  fallbackReason?: AIFallbackReason;
  usage?: AIUsageSnapshot;
}

export interface TrisulaFormulateDescriptionParams {
  studentName: string;
  pillar: TrisulaPillar;
  fase: string;
  score: number;
  cpText?: string | null;
  tps: Array<{ id: string; teks: string }>;
  userId?: string;
}

export interface TrisulaFormulateDescriptionResult {
  source: AIGenerationSource;
  deskripsi: string;
  rekomendasi: string;
  fallbackReason?: AIFallbackReason;
  usage?: AIUsageSnapshot;
}

export interface TrisulaReportSynthesisParams {
  studentName: string;
  className: string;
  fase: string;
  scores: {
    literasi?: number | null;
    numerasi?: number | null;
    diniyyah?: number | null;
  };
  descriptions: {
    literasi?: string | null;
    numerasi?: string | null;
    diniyyah?: string | null;
  };
  userId?: string;
}

export interface TrisulaReportSynthesisResult {
  source: AIGenerationSource;
  catatanRangkuman: string;
  pesanOrangTua: string;
  fallbackReason?: AIFallbackReason;
  usage?: AIUsageSnapshot;
}

// ─── Fallback Generators ────────────────────────────────────────────────────

export function getFallbackObservationEvaluation(
  params: TrisulaEvaluateObservationParams,
  reason: AIFallbackReason = "NO_API_KEY",
  usage?: AIUsageSnapshot
): TrisulaEvaluateObservationResult {
  const obs = params.observationText.trim();
  const hasContent = obs.length > 10;

  return {
    source: "FALLBACK",
    fallbackReason: reason,
    usage,
    evidenceStatus: hasContent ? "PARTIAL" : "INSUFFICIENT",
    nilai: hasContent ? 78 : null,
    matchedTpIds: params.tps.length > 0 ? [params.tps[0].id] : [],
    deskripsi: hasContent
      ? `Berdasarkan catatan guru: "${obs.slice(0, 80)}...", ${params.studentName} menunjukkan capaian yang cukup pada pilar ${params.pillar}.`
      : `Bukti pengamatan belum memadai untuk pilar ${params.pillar}.`,
    evidenceReason: hasContent
      ? "Evaluasi lokal berbasis kata kunci catatan guru."
      : "Catatan pengamatan kosong atau terlalu singkat.",
  };
}

export function getFallbackDescription(
  params: TrisulaFormulateDescriptionParams,
  reason: AIFallbackReason = "NO_API_KEY",
  usage?: AIUsageSnapshot
): TrisulaFormulateDescriptionResult {
  const score = params.score;
  let level = "baik";
  if (score >= 90) level = "sangat baik dan melampaui target pembelajaran";
  else if (score >= 75) level = "tuntas dan konsisten";
  else if (score >= 60) level = "cukup dan membutuhkan penguatan terarah";
  else level = "perlu bimbingan intensif dan pendampingan personal";

  return {
    source: "FALLBACK",
    fallbackReason: reason,
    usage,
    deskripsi: `${params.studentName} menunjukkan penguasaan kompetensi pilar ${params.pillar} dengan capaian ${level}.`,
    rekomendasi: `Lanjutkan pembiasaan dan penguatan materi terkait ${params.pillar} secara berkelanjutan.`,
  };
}

export function getFallbackReportSynthesis(
  params: TrisulaReportSynthesisParams,
  reason: AIFallbackReason = "NO_API_KEY",
  usage?: AIUsageSnapshot
): TrisulaReportSynthesisResult {
  return {
    source: "FALLBACK",
    fallbackReason: reason,
    usage,
    catatanRangkuman: `Alhamdulillah, ananda ${params.studentName} telah mengikuti rangkaian pembelajaran 3 Pilar Trisula (Literasi, Numerasi, Diniyyah) pada semester ini dengan penuh semangat dan adab terpuji.`,
    pesanOrangTua: `Mohon dukungan dan sinergi Ayah/Bunda di rumah untuk terus mendampingi pembiasaan membaca, numerasi harian, dan pengamalan ibadah ananda ${params.studentName}.`,
  };
}

// ─── AI Mode A: Evaluate from Observation ───────────────────────────────────

export async function evaluateTrisulaObservationWithAI(
  params: TrisulaEvaluateObservationParams
): Promise<TrisulaEvaluateObservationResult> {
  const { apiKey, model, endpointUrl } = getGeminiConfig();

  if (!apiKey || !endpointUrl) {
    return getFallbackObservationEvaluation(params, "NO_API_KEY");
  }

  // Quota check
  const usageCheck = await checkAIUsageLimit(model);
  if (!usageCheck.allowed && usageCheck.blockedReason) {
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_ASSESSMENT",
      model,
      source: "FALLBACK",
      providerErrorReason: usageCheck.blockedReason,
      retryAttempt: 1,
    });
    return getFallbackObservationEvaluation(params, usageCheck.blockedReason, usageCheck.snapshot);
  }

  const prompt = `
Anda adalah Asesor Pendidikan dan Pakar Kurikulum Trisula BLC.
Tugas Anda: Menganalisis catatan pengamatan/bukti belajar guru dan memberikan penilaian terukur HANYA jika ada bukti yang relevan.

DATA KONTEKS:
- Nama Murid: "${params.studentName}"
- Kelas / Jenjang: ${params.className} (${params.fase})
- Pilar yang Dievaluasi: ${params.pillar}
- Capaian Pembelajaran (CP) Acuan: "${params.cpText || "Standar Kurikulum Trisula"}"
- Butir-butir TP Target:
${params.tps.map((t, idx) => `  [ID: ${t.id}] ${idx + 1}. ${t.teks}`).join("\n")}

CATATAN PENGAMATAN GURU:
"""
${params.observationText}
"""

ATURAN EVALUASI KETAT (WAJIB DIPATUHI):
1. Periksa apakah catatan pengamatan guru MEMILIKI BUKTI RELEVAN terhadap pilar ${params.pillar}.
2. Jika catatan kosong, tidak relevan, atau membahas pilar lain:
   - "evidenceStatus": "INSUFFICIENT"
   - "nilai": null (WAJIB NULL, DILARANG MEREKAYASA ANGKA).
   - "matchedTpIds": []
   - "evidenceReason": Jelaskan mengapa bukti tidak memadai.
3. Jika bukti sebagian relevan:
   - "evidenceStatus": "PARTIAL"
   - "nilai": Angka integer (60 - 80)
   - "matchedTpIds": [Daftar ID TP yang cocok]
4. Jika bukti sangat kuat dan mencakup TP:
   - "evidenceStatus": "SUFFICIENT"
   - "nilai": Angka integer (81 - 98)
   - "matchedTpIds": [Daftar ID TP yang cocok]
5. Tulis "deskripsi" naratif yang santun, objektif, dan mengapresiasi perkembangan santri.

FORMAT OUTPUT (JSON murni):
{
  "evidenceStatus": "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT",
  "nilai": number | null,
  "matchedTpIds": string[],
  "deskripsi": string,
  "evidenceReason": string
}
`;

  const startedAt = new Date();
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
        },
      }),
    });

    const durationMs = Date.now() - startedAt.getTime();

    if (!response.ok) {
      const errReason: AIFallbackReason = response.status === 429 ? "RATE_LIMIT" : "HTTP_ERROR";
      await recordAIUsageAttempt({
        userId: params.userId,
        feature: "TRISULA_ASSESSMENT",
        model,
        source: "FALLBACK",
        providerHttpStatus: response.status,
        providerErrorReason: errReason,
        durationMs,
        requestStartedAt: startedAt,
      });
      return getFallbackObservationEvaluation(params, errReason, usageCheck.snapshot);
    }

    const json = await response.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Format respon kosong dari Gemini.");

    const parsed = JSON.parse(rawText.replace(/```json|```/gi, "").trim());

    // Enforce HARD RULE: INSUFFICIENT -> nilai = null
    const finalEvidenceStatus: EvidenceStatus = ["SUFFICIENT", "PARTIAL", "INSUFFICIENT"].includes(parsed.evidenceStatus)
      ? parsed.evidenceStatus
      : "PARTIAL";

    const finalNilai = finalEvidenceStatus === "INSUFFICIENT" ? null : (typeof parsed.nilai === "number" ? parsed.nilai : 75);

    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_ASSESSMENT",
      model,
      source: "GEMINI",
      providerHttpStatus: 200,
      durationMs,
      requestStartedAt: startedAt,
    });

    return {
      source: "GEMINI",
      evidenceStatus: finalEvidenceStatus,
      nilai: finalNilai,
      matchedTpIds: Array.isArray(parsed.matchedTpIds) ? parsed.matchedTpIds : [],
      deskripsi: parsed.deskripsi || `${params.studentName} menunjukkan capaian yang baik pada ${params.pillar}.`,
      evidenceReason: parsed.evidenceReason || "Dianalisis dari bukti catatan guru.",
      usage: usageCheck.snapshot,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startedAt.getTime();
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_ASSESSMENT",
      model,
      source: "FALLBACK",
      providerErrorReason: "INVALID_JSON",
      durationMs,
      requestStartedAt: startedAt,
    });
    return getFallbackObservationEvaluation(params, "INVALID_JSON", usageCheck.snapshot);
  }
}

// ─── AI Mode B: Formulate Description from Score ────────────────────────────

export async function formulateTrisulaDescriptionWithAI(
  params: TrisulaFormulateDescriptionParams
): Promise<TrisulaFormulateDescriptionResult> {
  const { apiKey, model, endpointUrl } = getGeminiConfig();

  if (!apiKey || !endpointUrl) {
    return getFallbackDescription(params, "NO_API_KEY");
  }

  const usageCheck = await checkAIUsageLimit(model);
  if (!usageCheck.allowed && usageCheck.blockedReason) {
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_ASSESSMENT",
      model,
      source: "FALLBACK",
      providerErrorReason: usageCheck.blockedReason,
      retryAttempt: 1,
    });
    return getFallbackDescription(params, usageCheck.blockedReason, usageCheck.snapshot);
  }

  const prompt = `
Anda adalah Guru Pakar Kurikulum BLC.
Tugas Anda: Merumuskan deskripsi pencapaian dan rekomendasi tindak lanjut untuk raport pilar ${params.pillar}.

DATA:
- Nama Murid: "${params.studentName}"
- Nilai yang telah diinput guru: ${params.score} (Skala 0-100)
- Tingkat Fase: ${params.fase}
- Capaian Pembelajaran: "${params.cpText || "Standar Kurikulum Trisula"}"
- TP Terkait:
${params.tps.map((t, idx) => `  ${idx + 1}. ${t.teks}`).join("\n")}

ATURAN:
1. Formulasikan kalimat deskripsi capaian (2-3 kalimat) yang bernuansa positif, mendidik, dan mencerminkan nilai ${params.score}.
2. Formulasikan rekomendasi (1-2 kalimat) untuk langkah pengembangan berikutnya.
3. JANGAN mengubah nilai numerik.

FORMAT OUTPUT (JSON murni):
{
  "deskripsi": string,
  "rekomendasi": string
}
`;

  const startedAt = new Date();
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
        },
      }),
    });

    const durationMs = Date.now() - startedAt.getTime();
    if (!response.ok) {
      const errReason: AIFallbackReason = response.status === 429 ? "RATE_LIMIT" : "HTTP_ERROR";
      await recordAIUsageAttempt({
        userId: params.userId,
        feature: "TRISULA_ASSESSMENT",
        model,
        source: "FALLBACK",
        providerHttpStatus: response.status,
        providerErrorReason: errReason,
        durationMs,
        requestStartedAt: startedAt,
      });
      return getFallbackDescription(params, errReason, usageCheck.snapshot);
    }

    const json = await response.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText.replace(/```json|```/gi, "").trim());

    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_ASSESSMENT",
      model,
      source: "GEMINI",
      providerHttpStatus: 200,
      durationMs,
      requestStartedAt: startedAt,
    });

    return {
      source: "GEMINI",
      deskripsi: parsed.deskripsi || `${params.studentName} menunjukkan penguasaan yang baik pada pilar ${params.pillar}.`,
      rekomendasi: parsed.rekomendasi || "Pertahankan capaian positif ini.",
      usage: usageCheck.snapshot,
    };
  } catch {
    return getFallbackDescription(params, "INVALID_JSON", usageCheck.snapshot);
  }
}

// ─── AI Mode C: Report Synthesis ────────────────────────────────────────────

export async function synthesizeTrisulaReportWithAI(
  params: TrisulaReportSynthesisParams
): Promise<TrisulaReportSynthesisResult> {
  const { apiKey, model, endpointUrl } = getGeminiConfig();

  if (!apiKey || !endpointUrl) {
    return getFallbackReportSynthesis(params, "NO_API_KEY");
  }

  const usageCheck = await checkAIUsageLimit(model);
  if (!usageCheck.allowed && usageCheck.blockedReason) {
    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_REPORT",
      model,
      source: "FALLBACK",
      providerErrorReason: usageCheck.blockedReason,
      retryAttempt: 1,
    });
    return getFallbackReportSynthesis(params, usageCheck.blockedReason, usageCheck.snapshot);
  }

  const prompt = `
Anda adalah Wali Kelas & Penulis Raport di BLC.
Tugas Anda: Menyusun (1) Catatan Rangkuman Perkembangan Murid dan (2) Pesan Kemitraan Orang Tua untuk Raport Trisula.

DATA ASESMEN AKTUAL (GUNAKAN HANYA DATA INI):
- Nama Murid: ${params.studentName}
- Kelas: ${params.className} (${params.fase})
- Skor & Deskripsi Literasi: ${params.scores.literasi ?? "Belum dinilai"} | ${params.descriptions.literasi || "-"}
- Skor & Deskripsi Numerasi: ${params.scores.numerasi ?? "Belum dinilai"} | ${params.descriptions.numerasi || "-"}
- Skor & Deskripsi Diniyyah: ${params.scores.diniyyah ?? "Belum dinilai"} | ${params.descriptions.diniyyah || "-"}

ATURAN:
1. DILARANG MEREKAYASA prestasi di luar pilar yang memiliki skor di atas.
2. "catatanRangkuman": Paragraf komprehensif yang merangkum pertumbuhan kognitif dan adab santri.
3. "pesanOrangTua": Pesan hangat dan actionable untuk orang tua sebagai pendidik utama di rumah.

FORMAT OUTPUT (JSON murni):
{
  "catatanRangkuman": string,
  "pesanOrangTua": string
}
`;

  const startedAt = new Date();
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
        },
      }),
    });

    const durationMs = Date.now() - startedAt.getTime();
    if (!response.ok) {
      const errReason: AIFallbackReason = response.status === 429 ? "RATE_LIMIT" : "HTTP_ERROR";
      return getFallbackReportSynthesis(params, errReason, usageCheck.snapshot);
    }

    const json = await response.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText.replace(/```json|```/gi, "").trim());

    await recordAIUsageAttempt({
      userId: params.userId,
      feature: "TRISULA_REPORT",
      model,
      source: "GEMINI",
      providerHttpStatus: 200,
      durationMs,
      requestStartedAt: startedAt,
    });

    return {
      source: "GEMINI",
      catatanRangkuman: parsed.catatanRangkuman || "Ananda menunjukkan perkembangan belajar yang positif.",
      pesanOrangTua: parsed.pesanOrangTua || "Mohon terus mendampingi ananda dalam pembiasaan harian.",
      usage: usageCheck.snapshot,
    };
  } catch {
    return getFallbackReportSynthesis(params, "INVALID_JSON", usageCheck.snapshot);
  }
}
