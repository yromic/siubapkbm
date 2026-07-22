"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  ResponsiveContainer,
} from "@/components/ui-states";
import { Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppreciationDialog } from "@/components/ui/appreciation-dialog";
import { useAppreciation } from "@/hooks/useAppreciation";
import { InfoBanner } from "@/components/ui/info-banner";
import { UX_COPY } from "@/lib/ux-copy";
import { StudentSummary, getAssessmentRoster } from "@/lib/api/students";
import {
  AcademicAssessment,
  AcademicScore,
  getAcademicAssessmentDetail,
  listAcademicScoresByAssessment,
  saveAcademicScores,
} from "@/lib/api/academic";

type ScoreRow = {
  student: StudentSummary;
  score: string;
  note: string;
  originalScore: string;
  originalNote: string;
};

function normalizeScore(value: AcademicScore["score"] | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function isFilledScore(value: string) {
  return value.trim() !== "";
}

function humanizeError(error: unknown) {
  if (!(error instanceof Error)) return "Gagal menyimpan nilai.";
  const message = error.message;
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";

  if (code === "ERR_SEMESTER_FINALIZED" || message.toLowerCase().includes("finalized")) {
    return "Semester sudah difinalisasi. Nilai tidak dapat diubah.";
  }
  if (code === "ERR_FORBIDDEN" || message.toLowerCase().includes("forbidden")) {
    return "Anda tidak memiliki akses ke penilaian ini.";
  }
  if (message.toLowerCase().includes("out of valid range") || message.toLowerCase().includes("out of range")) {
    return "Nilai berada di luar rentang yang diizinkan.";
  }
  if (message.toLowerCase().includes("locked")) {
    return "Penilaian terkunci. Nilai tidak dapat diubah.";
  }
  if (message.toLowerCase().includes("draft")) {
    return "Penilaian masih berupa draf. Terbitkan penilaian terlebih dahulu sebelum mengisi nilai.";
  }
  return message || "Gagal menyimpan nilai.";
}

function completionFromRows(rows: ScoreRow[]) {
  const total = rows.length;
  const graded = rows.filter((row) => isFilledScore(row.score)).length;
  const pending = total - graded;
  const percentage = total > 0 ? Number(((graded / total) * 100).toFixed(2)) : 0;
  return { total, graded, pending, percentage };
}

export default function AcademicScoreEntryPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { token, user } = useAuth();
  const [assessment, setAssessment] = useState<AcademicAssessment | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !user || !assessmentId) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const detail = await getAcademicAssessmentDetail(assessmentId, token);
      const [roster, scores] = await Promise.all([
        // getAssessmentRoster sends only the assessment_id — the backend resolves
        // assessment_date directly from the DB and keeps it as a JS Date object
        // through to the Knex binding, preventing the ISO-string serialization bug.
        getAssessmentRoster(assessmentId, token),
        listAcademicScoresByAssessment(detail.id, token),
      ]);

      const scoreByStudentId = new Map<string, AcademicScore>();
      scores.forEach((score) => {
        scoreByStudentId.set(score.student_id, score);
      });

      const mergedRows = roster.map((student) => {
        const existing = scoreByStudentId.get(student.id);
        const scoreValue = normalizeScore(existing?.score);
        const noteValue = existing?.note || "";
        return {
          student,
          score: scoreValue,
          note: noteValue,
          originalScore: scoreValue,
          originalNote: noteValue,
        };
      });

      setAssessment(detail);
      setRows(mergedRows);
    } catch (err: unknown) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [assessmentId, token, user]);

  useEffect(() => {
    setTimeout(() => loadData(), 0);
  }, [loadData]);

  const dirtyRows = useMemo(
    () =>
      rows.filter(
        (row) => row.score !== row.originalScore || row.note !== row.originalNote
      ),
    [rows]
  );

  const completion = useMemo(() => completionFromRows(rows), [rows]);

  const isRowScoreInvalid = useCallback((row: ScoreRow) => {
    if (!assessment) return false;
    const raw = row.score.trim();
    if (!raw) return false;
    const value = Number(raw);
    const min = Number(assessment.score_min);
    const max = Number(assessment.score_max);
    return Number.isNaN(value) || value < min || value > max;
  }, [assessment]);

  const hasAnyInvalidScore = useMemo(() => {
    return rows.some(isRowScoreInvalid);
  }, [rows, isRowScoreInvalid]);

  const readOnly = assessment?.status !== "published";

  const updateRow = (studentId: string, patch: Partial<Pick<ScoreRow, "score" | "note">>) => {
    setRows((current) =>
      current.map((row) =>
        row.student.id === studentId ? { ...row, ...patch } : row
      )
    );
  };

  const validateDirtyRows = () => {
    if (!assessment) return "Penilaian tidak ditemukan.";
    const min = Number(assessment.score_min);
    const max = Number(assessment.score_max);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return "Rentang nilai penilaian tidak valid.";
    }

    for (const row of dirtyRows) {
      const raw = row.score.trim();
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isNaN(value)) {
        return `Nilai ${row.student.full_name} harus berupa angka.`;
      }
      if (value < min || value > max) {
        return `Nilai ${row.student.full_name} harus berada pada rentang ${min} - ${max}.`;
      }
      if (!row.student.student_enrollment_id) {
        return `Data siswa ${row.student.full_name} belum memiliki riwayat kelas aktif.`;
      }
    }

    return null;
  };

  const { open: appOpen, setOpen: setAppOpen, message: appMsg, triggerAppreciation } = useAppreciation();

  const handleSave = async () => {
    if (!token || !assessment || readOnly || dirtyRows.length === 0) return;

    const validationMessage = validateDirtyRows();
    if (validationMessage) {
      setSaveError(validationMessage);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await saveAcademicScores(
        {
          assessment_id: assessment.id,
          scores: dirtyRows.map((row) => ({
            student_id: row.student.id,
            student_enrollment_id: row.student.student_enrollment_id || "",
            score: row.score.trim() === "" ? "" : Number(row.score),
            note: row.note,
          })),
        },
        token
      );
      setLastSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));

      notify.success(UX_COPY.scores.saveSuccess);

      // Evaluate 100% completion for Appreciation Popup
      const nextGradedCount = rows.filter((row) => isFilledScore(row.score)).length;
      const isHundredPercent = rows.length > 0 && nextGradedCount === rows.length;

      if (isHundredPercent) {
        triggerAppreciation({
          workflowId: "academic_100",
          classId: assessment.class_id,
          assessmentId: assessment.id,
          role: "teacher",
          level: 4,
        });
      }

      await loadData();
    } catch (err: unknown) {
      setSaveError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  const executeCancelChanges = () => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        score: row.originalScore,
        note: row.originalNote,
      }))
    );
    setSaveError(null);
    notify.info(UX_COPY.scores.cancelChanges);
  };

  const handleCancel = () => {
    if (dirtyRows.length > 0) {
      setConfirmCancelOpen(true);
    } else {
      executeCancelChanges();
    }
  };

  if (!user || user.role !== "teacher") {
    return <ForbiddenState message="Halaman input nilai hanya dapat diakses oleh Guru Wali Kelas." />;
  }

  if (loading) return <LoadingState message="Memuat input nilai..." />;

  if (error) {
    return (
      <ResponsiveContainer className="space-y-6">
        <ErrorState message={error} onRetry={loadData} />
      </ResponsiveContainer>
    );
  }

  if (!assessment) {
    return (
      <ResponsiveContainer>
        <ErrorState message="Penilaian tidak ditemukan." onRetry={loadData} />
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Input Nilai"
        description={assessment.title}
        actions={
          <Link
            href={`/academic-scores/${assessment.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Detail Penilaian
          </Link>
        }
      />

      {assessment.status === "draft" && (
        <InfoBanner
          variant="warning"
          title="Penilaian Masih Draft"
          description="Terbitkan penilaian terlebih dahulu sebelum mengisi nilai."
        />
      )}

      {assessment.status === "locked" && (
        <InfoBanner
          variant="info"
          title="Penilaian Terkunci"
          description="Penilaian ini telah dikunci. Nilai hanya dapat dilihat, tidak dapat diubah."
        />
      )}

      {saveError && (
        <InfoBanner
          variant="error"
          title="Gagal Menyimpan Nilai"
          description={saveError}
        />
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Siswa</div>
          <div className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-50">{completion.total}</div>
        </div>
        <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Sudah Dinilai</div>
          <div className="mt-2 text-2xl font-black text-[#468432]">{completion.graded}</div>
        </div>
        <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Belum Dinilai</div>
          <div className="mt-2 text-2xl font-black text-amber-600">{completion.pending}</div>
        </div>
        <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <span>Completion</span>
            <span>{completion.percentage}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion.percentage}%` }} />
          </div>
        </div>
      </section>

      <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">Daftar Nilai Siswa</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Rentang nilai: {assessment.score_min} - {assessment.score_max}. Kosong berarti belum dinilai, 0 tetap dihitung sebagai nilai.
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {dirtyRows.length > 0 ? `${dirtyRows.length} perubahan belum disimpan` : lastSavedAt ? `Tersimpan ${lastSavedAt}` : "Tidak ada perubahan"}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Daftar Siswa Kosong" description="Tidak ada siswa aktif pada kelas penilaian ini." />
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row, index) => {
              const dirty = row.score !== row.originalScore || row.note !== row.originalNote;
              return (
                <div key={row.student.id} className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_140px_minmax(220px,1.2fr)] gap-3 lg:items-start">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center text-xs font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-zinc-950 dark:text-zinc-50 truncate">
                          {row.student.full_name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          NISN: {row.student.nisn} / {row.student.status}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block lg:hidden text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Nilai
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={row.score}
                      disabled={readOnly}
                      min={Number(assessment.score_min)}
                      max={Number(assessment.score_max)}
                      onChange={(event) => updateRow(row.student.id, { score: event.target.value })}
                      placeholder="Kosong"
                      className={`w-full px-3.5 py-2.5 rounded-[12px] border bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 transition ${
                        isRowScoreInvalid(row)
                          ? "border-red-500 focus:ring-red-500/30 text-red-600 dark:text-red-400"
                          : "border-zinc-200 dark:border-zinc-800 focus:ring-[#468432]/30 text-zinc-900 dark:text-zinc-100"
                      }`}
                    />
                    {isRowScoreInvalid(row) && (
                      <div className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400 leading-normal animate-fadeIn">
                        ⚠️ Harus {assessment.score_min} - {assessment.score_max}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block lg:hidden text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Catatan
                    </label>
                    <input
                      value={row.note}
                      disabled={readOnly}
                      onChange={(event) => updateRow(row.student.id, { note: event.target.value })}
                      placeholder="Catatan opsional"
                      className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 disabled:opacity-60"
                    />
                    {dirty && (
                      <div className="mt-1 text-xs font-semibold text-[#468432] dark:text-emerald-400">
                        Belum disimpan
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="sticky bottom-16 md:bottom-4 z-30 rounded-[20px] bg-white/95 dark:bg-[#171717]/95 backdrop-blur border border-zinc-200 dark:border-zinc-800 shadow-lg p-3 flex flex-col gap-3">
          {/* Peringatan nilai tidak valid di dekat tombol simpan — H5: Error Prevention */}
          {hasAnyInvalidScore && (
            <InfoBanner
              variant="warning"
              description="Ada nilai siswa yang di luar rentang valid. Periksa baris bertanda merah sebelum menyimpan."
            />
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-zinc-650 dark:text-zinc-400">
              {dirtyRows.length > 0 ? `${dirtyRows.length} perubahan siap disimpan.` : "Tidak ada perubahan nilai."}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleCancel}
                disabled={saving || dirtyRows.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] border border-zinc-250 dark:border-zinc-800 bg-white hover:bg-zinc-50 dark:bg-[#171717] dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || dirtyRows.length === 0 || hasAnyInvalidScore}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Nilai"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi pembatalan — H3: User Control & Freedom */}
      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Batalkan Perubahan?"
        description={`Ada ${dirtyRows.length} perubahan yang belum disimpan. Semua perubahan akan hilang jika Anda melanjutkan.`}
        confirmLabel="Ya, Batalkan"
        cancelLabel="Tidak, Lanjutkan Mengisi"
        variant="destructive"
        onConfirm={executeCancelChanges}
      />

      <AppreciationDialog
        open={appOpen}
        onOpenChange={setAppOpen}
        title={appMsg.title}
        description={appMsg.body}
      />
    </ResponsiveContainer>
  );
}
