"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  ResponsiveContainer,
} from "@/components/ui-states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import { humanizeError } from "@/lib/utils/ui-error";
import { UX_COPY } from "@/lib/ux-copy";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import {
  AcademicAssessment,
  AssessmentStatus,
  AssessmentSummary,
  MyClassSubject,
  getAcademicAssessmentDetail,
  getClassAcademicSummary,
  listMyClassSubjects,
  lockAcademicAssessment,
  publishAcademicAssessment,
  updateAcademicAssessment,
} from "@/lib/api/academic";

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  draft: "Draft",
  published: "Published",
  locked: "Locked",
};

function StatusBadge({ status }: { status: AssessmentStatus | string }) {
  const styles =
    status === "published"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : status === "locked"
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles}`}>
      {STATUS_LABELS[status as AssessmentStatus] ?? status}
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function DataRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value || "-"}</dd>
    </div>
  );
}

export default function AcademicAssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { token, user } = useAuth();
  const [assessment, setAssessment] = useState<AcademicAssessment | null>(null);
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [subjects, setSubjects] = useState<MyClassSubject[]>([]);
  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editScoreMin, setEditScoreMin] = useState("");
  const [editScoreMax, setEditScoreMax] = useState("");

  const hydrateEditForm = useCallback((item: AcademicAssessment) => {
    setEditTitle(item.title);
    setEditDescription(item.description || "");
    setEditDate(item.assessment_date || "");
    setEditScoreMin(String(item.score_min ?? 0));
    setEditScoreMax(String(item.score_max ?? 100));
  }, []);

  const loadData = useCallback(async () => {
    if (!token || !user || !assessmentId) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [detail, myClasses] = await Promise.all([
        getAcademicAssessmentDetail(assessmentId, token),
        getMyClasses(token),
      ]);

      setAssessment(detail);
      setClasses(myClasses);
      hydrateEditForm(detail);

      const matchingClass = myClasses.find(
        (item) =>
          item.class_id === detail.class_id &&
          item.academic_year_id === detail.academic_year_id &&
          item.semester_id === detail.semester_id
      );

      if (matchingClass) {
        const [classSubjects, classSummary] = await Promise.all([
          listMyClassSubjects(token, {
            class_id: matchingClass.class_id,
            academic_year_id: matchingClass.academic_year_id,
            semester_id: matchingClass.semester_id,
          }),
          getClassAcademicSummary(token, {
            class_id: matchingClass.class_id,
            academic_year_id: matchingClass.academic_year_id,
            semester_id: matchingClass.semester_id,
          }).catch(() => null),
        ]);
        setSubjects(classSubjects);
        setSummary(
          classSummary?.assessment_summaries.find((item) => item.assessment_id === detail.id) || null
        );
      } else {
        setSubjects([]);
        setSummary(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat detail assessment.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, hydrateEditForm, token, user]);

  useEffect(() => {
    setTimeout(() => loadData(), 0);
  }, [loadData]);

  const classLabel = useMemo(() => {
    if (!assessment) return "-";
    const item = classes.find(
      (classItem) =>
        classItem.class_id === assessment.class_id &&
        classItem.academic_year_id === assessment.academic_year_id &&
        classItem.semester_id === assessment.semester_id
    );
    if (!item) return assessment.class_id;
    return `${item.class_name}${item.class_code ? ` (${item.class_code})` : ""}`;
  }, [assessment, classes]);

  const subjectLabel = useMemo(() => {
    if (!assessment) return "-";
    const item = subjects.find((subject) => subject.subject_id === assessment.subject_id);
    if (!item) return assessment.subject_id;
    return `${item.subject_name}${item.subject_code ? ` (${item.subject_code})` : ""}`;
  }, [assessment, subjects]);

  const handlePublish = async () => {
    if (!token || !assessment) return;
    setPublishing(true);
    setActionError(null);
    try {
      const updated = await publishAcademicAssessment(assessment.id, token);
      setAssessment(updated);
      hydrateEditForm(updated);
      notify.success(UX_COPY.scores.publishSuccess);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal publish assessment.";
      setActionError(message);
      notify.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [locking, setLocking] = useState(false);

  const handleLock = async () => {
    if (!token || !assessment) return;
    setLocking(true);
    setActionError(null);
    try {
      const updated = await lockAcademicAssessment(assessment.id, token);
      setAssessment(updated);
      hydrateEditForm(updated);
      notify.success("Assessment berhasil dikunci (locked). Nilai tidak dapat diubah lagi.");
      await loadData();
    } catch (err: unknown) {
      const message = humanizeError(err);
      setActionError(message);
      notify.error(message);
    } finally {
      setLocking(false);
    }
  };

  const validateEdit = () => {
    if (!editTitle.trim()) return "Judul assessment wajib diisi.";
    if (!editDate) return "Tanggal assessment wajib diisi.";
    const min = Number(editScoreMin);
    const max = Number(editScoreMax);
    if (Number.isNaN(min) || Number.isNaN(max)) return "Rentang nilai harus berupa angka.";
    if (min > max) return "Score minimum tidak boleh lebih besar dari score maksimum.";
    return null;
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !assessment) return;

    const validationMessage = validateEdit();
    if (validationMessage) {
      setActionError(validationMessage);
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const updated = await updateAcademicAssessment(
        assessment.id,
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          assessment_date: editDate,
          score_min: Number(editScoreMin),
          score_max: Number(editScoreMax),
        },
        token
      );
      setAssessment(updated);
      hydrateEditForm(updated);
      setEditing(false);
      notify.success("Metadata penilaian berhasil diperbarui.");
      await loadData();
    } catch (err: unknown) {
      const message = humanizeError(err);
      setActionError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "teacher") {
    return <ForbiddenState message="Halaman ini hanya dapat diakses oleh Guru Wali Kelas." />;
  }

  if (loading) return <LoadingState message="Memuat detail assessment..." />;

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
        <ErrorState message="Assessment tidak ditemukan." onRetry={loadData} />
      </ResponsiveContainer>
    );
  }

  const locked = assessment.status === "locked";
  const canEdit = !locked;

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title={assessment.title}
        description="Detail assessment akademik."
        actions={
          <Link
            href="/academic-scores"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Nilai Akademik
          </Link>
        }
      />

      {actionError && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          {actionError}
        </div>
      )}

      {locked && (
        <div className="p-4 rounded-[20px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300">
          Assessment locked. Metadata dan status hanya dapat dilihat.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <section className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">Informasi Assessment</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Data kelas, mapel, tanggal, dan rentang nilai.
              </p>
            </div>
            <StatusBadge status={assessment.status} />
          </div>

          <dl className="mt-3">
            <DataRow label="Kelas" value={classLabel} />
            <DataRow label="Mata Pelajaran" value={subjectLabel} />
            <DataRow label="Tanggal" value={formatDate(assessment.assessment_date)} />
            <DataRow label="Rentang Nilai" value={`${assessment.score_min} - ${assessment.score_max}`} />
            <DataRow label="Deskripsi" value={assessment.description || "-"} />
          </dl>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            {assessment.status === "draft" && (
              <button
                onClick={() => setShowPublishConfirm(true)}
                disabled={publishing}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                {publishing ? "Publishing..." : "Publish Assessment"}
              </button>
            )}
            {assessment.status === "published" && (
              <button
                type="button"
                onClick={() => setShowLockConfirm(true)}
                disabled={locking}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                {locking ? "Locking..." : "Kunci Assessment"}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => {
                  setEditing((value) => !value);
                  setActionError(null);
                }}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {editing ? "Tutup Edit" : "Edit Metadata"}
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Completion Preview</h3>
            {summary ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Belum dinilai</div>
                  <div className="mt-1 text-2xl font-black text-zinc-950 dark:text-zinc-50">{summary.ungraded_students}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                    <span>Kelengkapan</span>
                    <span>{summary.completeness_percentage}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, Math.max(0, Number(summary.completeness_percentage) || 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Completion detail akan tersedia pada Phase 4A-2.
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Input Nilai</h3>
            {assessment.status === "draft" ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Publish assessment terlebih dahulu sebelum input nilai.
                </p>
                <button
                  type="button"
                  disabled
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm font-semibold cursor-not-allowed"
                >
                  Input Nilai
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {assessment.status === "locked"
                    ? "Assessment terkunci. Nilai hanya dapat dilihat."
                    : "Masuk ke halaman input nilai untuk roster siswa assessment ini."}
                </p>
                <Link
                  href={`/academic-scores/${assessment.id}/scores`}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  {assessment.status === "locked" ? "Lihat Nilai" : "Input Nilai"}
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      {editing && canEdit && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-5 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">Edit Metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Judul
              </label>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Deskripsi
              </label>
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 resize-none"
              />
            </div>
            <div>
              <DatePicker
                label="Tanggal"
                value={editDate}
                onChange={setEditDate}
                placeholder="Pilih tanggal..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Score Min
                </label>
                <input
                  type="number"
                  value={editScoreMin}
                  onChange={(event) => setEditScoreMin(event.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Score Max
                </label>
                <input
                  type="number"
                  value={editScoreMax}
                  onChange={(event) => setEditScoreMax(event.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
                />
              </div>
            </div>
          </div>
          <div className="p-3.5 rounded-[12px] bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            Kelas, mapel, periode, guru, dan status tidak dapat diedit dari halaman ini.
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                hydrateEditForm(assessment);
                setEditing(false);
                setActionError(null);
              }}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={showPublishConfirm}
        onOpenChange={setShowPublishConfirm}
        title="Publikasikan Hasil Penilaian?"
        description="Apakah Anda yakin ingin mempublikasikan hasil penilaian ini? Setelah dipublikasikan, guru wali kelas dapat melakukan pengisian nilai."
        confirmLabel="Ya, Publikasikan"
        variant="default"
        onConfirm={handlePublish}
      />
      <ConfirmDialog
        open={showLockConfirm}
        onOpenChange={setShowLockConfirm}
        title="Kunci Assessment Penilaian?"
        description="Apakah Anda yakin ingin mengunci (lock) penilaian ini? Setelah dikunci, nilai siswa tidak dapat diubah lagi dan status assessment akan dinyatakan selesai."
        confirmLabel="Ya, Kunci Assessment"
        variant="destructive"
        onConfirm={handleLock}
      />
    </ResponsiveContainer>
  );
}
