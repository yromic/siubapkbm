import { db } from "@/lib/db";
import { getOrCreateKKTPAssessment, configureAssessmentTPs, saveKKTPMatrixScores } from "./kktpAssessmentService";
import { getActiveAcademicYear } from "./academicYearService";
import { getActiveSemester } from "./semesterService";

export interface MigrationGroupReport {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  document_count: number;
  student_count: number;
  duplicate_documents: Array<{ student_id: string; student_name: string; doc_ids: string[] }>;
  tp_variants_count: number;
  tp_variants: Array<{ hash: string; tps: string[]; student_names: string[] }>;
  semester_resolution: {
    inferred_semester_id: string | null;
    inferred_semester_name: string | null;
    source: "DOCUMENT_COLUMN" | "ACTIVE_PERIOD_FALLBACK" | "UNRESOLVED";
  };
  status: "AUTO_MIGRATABLE" | "REQUIRES_REVIEW" | "ALREADY_MIGRATED";
  reason: string;
}

export interface KKTPMigrationResult {
  success?: boolean;
  total_documents_analyzed: number;
  totalLegacyDocuments: number;
  groups_analyzed: number;
  auto_migratable_groups: number;
  requires_review_groups: number;
  already_migrated_groups: number;
  reports: MigrationGroupReport[];
  groups: MigrationGroupReport[];
  execution_summary?: {
    migrated_assessments: number;
    migrated_tps: number;
    migrated_scores: number;
  };
}

/**
 * Normalizes TP text for fuzzy equivalence comparison (lowercased, trimmed, punctuation stripped).
 */
function normalizeTpText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes a deterministic hash/signature for a list of TP texts.
 */
function computeTpSetSignature(tps: string[]): string {
  const normalized = tps.map(normalizeTpText).filter(Boolean).sort();
  return normalized.join(" || ");
}

/**
 * Analyzes all legacy documents with type = 'KKTP' and produces a forensic migration report.
 * Does NOT mutate database state.
 */
export async function analyzeLegacyKKTPData(): Promise<KKTPMigrationResult> {
  const docs = await db("documents")
    .where("type", "KKTP")
    .select("id", "title", "class_id", "subject_id", "semester_id", "content", "created_at");

  // Fetch active period for comparison
  const activeYear = await getActiveAcademicYear().catch(() => null);
  const activeSem = activeYear ? await getActiveSemester(activeYear.id).catch(() => null) : null;

  // Group by (class_id, subject_id)
  const groupMap = new Map<string, any[]>();

  for (const doc of docs) {
    let content: any = {};
    try {
      content = typeof doc.content === "string" ? JSON.parse(doc.content) : doc.content || {};
    } catch {
      continue;
    }

    const classId = doc.class_id || content?.identitas?.classId;
    const subjectId = doc.subject_id || content?.identitas?.subjectId;

    if (!classId || !subjectId) continue;

    const groupKey = `${classId}::${subjectId}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push({ doc, content });
  }

  const reports: MigrationGroupReport[] = [];
  let autoCount = 0;
  let reviewCount = 0;
  let alreadyMigratedCount = 0;

  for (const [groupKey, groupItems] of groupMap.entries()) {
    const [classId, subjectId] = groupKey.split("::");

    const cls = await db("classes").where("id", classId).first();
    const subj = await db("subjects").where("id", subjectId).first();

    const className = cls?.name || "Kelas Tidak Dikenal";
    const subjectName = subj?.name || "Mata Pelajaran Tidak Dikenal";

    // Track students and duplicates
    const studentDocMap = new Map<string, { name: string; docIds: string[]; tps: string[] }>();
    const tpVariantMap = new Map<string, { tps: string[]; studentNames: string[] }>();

    for (const item of groupItems) {
      const studentId = item.content?.identitas?.studentId;
      const studentName = item.content?.identitas?.namaMurid || "Tanpa Nama";
      const tpItems: any[] = Array.isArray(item.content?.tpItems) ? item.content.tpItems : [];
      const tpTexts = tpItems.map((t) => (typeof t === "string" ? t : t?.teks || "")).filter(Boolean);

      if (studentId) {
        if (!studentDocMap.has(studentId)) {
          studentDocMap.set(studentId, { name: studentName, docIds: [], tps: tpTexts });
        }
        studentDocMap.get(studentId)!.docIds.push(item.doc.id);
      }

      const sig = computeTpSetSignature(tpTexts);
      if (sig) {
        if (!tpVariantMap.has(sig)) {
          tpVariantMap.set(sig, { tps: tpTexts, studentNames: [] });
        }
        tpVariantMap.get(sig)!.studentNames.push(studentName);
      }
    }

    // Detect duplicates
    const duplicateDocs = Array.from(studentDocMap.entries())
      .filter(([, data]) => data.docIds.length > 1)
      .map(([studentId, data]) => ({
        student_id: studentId,
        student_name: data.name,
        doc_ids: data.docIds,
      }));

    // Check semester resolution
    const explicitSemesterId = groupItems.find((i) => i.doc.semester_id)?.doc.semester_id || null;
    let semesterResolution: MigrationGroupReport["semester_resolution"];

    if (explicitSemesterId) {
      const semRow = await db("semesters").where("id", explicitSemesterId).first();
      semesterResolution = {
        inferred_semester_id: explicitSemesterId,
        inferred_semester_name: semRow?.name || null,
        source: "DOCUMENT_COLUMN",
      };
    } else if (activeSem) {
      semesterResolution = {
        inferred_semester_id: activeSem.id,
        inferred_semester_name: activeSem.name,
        source: "ACTIVE_PERIOD_FALLBACK",
      };
    } else {
      semesterResolution = {
        inferred_semester_id: null,
        inferred_semester_name: null,
        source: "UNRESOLVED",
      };
    }

    // Check if normalized assessment already exists
    let alreadyExists = false;
    if (semesterResolution.inferred_semester_id && activeYear) {
      const existingNormalized = await db("kktp_assessments")
        .where({
          class_id: classId,
          subject_id: subjectId,
          academic_year_id: activeYear.id,
          semester_id: semesterResolution.inferred_semester_id,
        })
        .first();
      if (existingNormalized) {
        alreadyExists = true;
      }
    }

    // Evaluate classification
    const tpVariants = Array.from(tpVariantMap.entries()).map(([hash, v]) => ({
      hash,
      tps: v.tps,
      student_names: Array.from(new Set(v.studentNames)),
    }));

    let status: MigrationGroupReport["status"];
    let reason: string;

    if (alreadyExists) {
      status = "ALREADY_MIGRATED";
      reason = "Asesmen ternormalisasi sudah ada di database untuk periode ini.";
      alreadyMigratedCount++;
    } else if (semesterResolution.source === "UNRESOLVED") {
      status = "REQUIRES_REVIEW";
      reason = "Semester tidak dapat ditentukan karena dokumen tidak memiliki semester_id dan tidak ada semester aktif.";
      reviewCount++;
    } else if (tpVariants.length > 1) {
      status = "REQUIRES_REVIEW";
      reason = `Terdapat ${tpVariants.length} variasi rumusan TP yang berbeda antar-murid dalam kelas dan mapel ini. Perlu konfirmasi guru untuk menentukan TP resmi.`;
      reviewCount++;
    } else if (duplicateDocs.length > 0) {
      status = "REQUIRES_REVIEW";
      reason = `Terdapat dokumen duplikat untuk murid yang sama (${duplicateDocs.map((d) => d.student_name).join(", ")}).`;
      reviewCount++;
    } else {
      status = "AUTO_MIGRATABLE";
      reason = "Seluruh murid memiliki rumusan TP yang identik dan dapat dimigrasikan secara otomatis.";
      autoCount++;
    }

    reports.push({
      class_id: classId,
      class_name: className,
      subject_id: subjectId,
      subject_name: subjectName,
      document_count: groupItems.length,
      student_count: studentDocMap.size,
      duplicate_documents: duplicateDocs,
      tp_variants_count: tpVariants.length,
      tp_variants: tpVariants,
      semester_resolution: semesterResolution,
      status,
      reason,
    });
  }

  return {
    total_documents_analyzed: docs.length,
    totalLegacyDocuments: docs.length,
    groups_analyzed: reports.length,
    auto_migratable_groups: autoCount,
    requires_review_groups: reviewCount,
    already_migrated_groups: alreadyMigratedCount,
    reports,
    groups: reports,
  };
}

/**
 * Idempotently executes migration for AUTO_MIGRATABLE groups.
 * Does NOT delete or alter legacy documents table rows.
 */
export async function executeAutoKKTPMigration(): Promise<KKTPMigrationResult> {
  const analysis = await analyzeLegacyKKTPData();
  const autoGroups = analysis.reports.filter((r) => r.status === "AUTO_MIGRATABLE");

  let migratedAssessments = 0;
  let migratedTps = 0;
  let migratedScores = 0;

  const activeYear = await getActiveAcademicYear();
  if (!activeYear) throw new Error("Tidak ada tahun ajaran aktif.");

  for (const group of autoGroups) {
    const semesterId = group.semester_resolution.inferred_semester_id;
    if (!semesterId) continue;

    // 1. Get or create normalized assessment
    const assessment = await getOrCreateKKTPAssessment({
      class_id: group.class_id,
      subject_id: group.subject_id,
      academic_year_id: activeYear.id,
      semester_id: semesterId,
      title: `KKTP ${group.subject_name} — ${group.class_name}`,
    });
    migratedAssessments++;

    // 2. Configure authoritative TPs
    const chosenTps = group.tp_variants[0]?.tps || [];
    if (chosenTps.length > 0) {
      const tpInputs = chosenTps.map((text, idx) => ({
        tp_text_snapshot: text,
        tp_code: `TP-${String(idx + 1).padStart(2, "0")}`,
        order_index: idx + 1,
        source_type: "MANUAL" as const,
      }));
      await configureAssessmentTPs(assessment.id, tpInputs);
      migratedTps += chosenTps.length;
    }

    // 3. Fetch configured assessment TPs
    const configuredTps = await db("kktp_assessment_tps")
      .where("assessment_id", assessment.id)
      .select("id", "tp_text_snapshot");
    const tpTextToIdMap = new Map<string, string>();
    configuredTps.forEach((t: any) => {
      tpTextToIdMap.set(normalizeTpText(t.tp_text_snapshot), t.id);
    });

    // 4. Migrate student scores from legacy docs
    const legacyDocs = await db("documents")
      .where("type", "KKTP")
      .where("class_id", group.class_id)
      .where("subject_id", group.subject_id)
      .select("content");

    const studentScoreInputs: any[] = [];

    for (const doc of legacyDocs) {
      let content: any = {};
      try {
        content = typeof doc.content === "string" ? JSON.parse(doc.content) : doc.content || {};
      } catch {
        continue;
      }

      const studentId = content?.identitas?.studentId;
      if (!studentId) continue;

      const tpItems: any[] = Array.isArray(content?.tpItems) ? content.tpItems : [];
      const scoreObj: Record<string, any> = {};

      for (const item of tpItems) {
        const itemText = normalizeTpText(item.teks || "");
        const targetAssessmentTpId = tpTextToIdMap.get(itemText);
        if (targetAssessmentTpId && item.nilai !== null && item.nilai !== undefined) {
          scoreObj[targetAssessmentTpId] = {
            score: Number(item.nilai),
            evidence_status: item.evidenceStatus || (Number(item.nilai) >= 76 ? "SUFFICIENT" : "PARTIAL"),
            reflection: item.deskripsi || null,
          };
        }
      }

      studentScoreInputs.push({
        student_id: studentId,
        scores: scoreObj,
        catatan_tutor: content.catatanTutor || null,
      });
    }

    if (studentScoreInputs.length > 0) {
      const res = await saveKKTPMatrixScores(assessment.id, studentScoreInputs);
      migratedScores += res.savedScoresCount;
    }
  }

  return {
    success: true,
    ...analysis,
    execution_summary: {
      migrated_assessments: migratedAssessments,
      migrated_tps: migratedTps,
      migrated_scores: migratedScores,
    },
  };
}
