"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { DatePicker } from "@/components/ui/date-picker";
import { ScoreSelector } from "@/components/ui/score-selector";
import { Card, CardHeader } from "@/components/ui/card";
import { ColumnLabel, CardTitle, NumericDisplay, Label } from "@/components/ui/typography";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import { StudentSummary, listStudentsByClass } from "@/lib/api/students";
import {
  listCultureScoresByDate,
  saveCultureScores,
  getSemesterFinalizationStatus,
  CultureScoreRecord,
  SaveCultureScoreItem,
} from "@/lib/api/culture";
import { dbScoreToUi, uiScoreToDb } from "@/lib/utils/scoreMapper";
import { UX_COPY } from "@/lib/ux-copy";

type IndicatorKey = "sss" | "am" | "hb" | "asm" | "br" | "ak" | "tm";

interface IndicatorConfig {
  key: IndicatorKey;
  code: string;
  name: string;
  description: string;
}

const INDICATORS: IndicatorConfig[] = [
  { key: "sss", code: "SSS", name: "Senyum, Sapa, Salam", description: "Membudayakan 3S di lingkungan sekolah." },
  { key: "am", code: "AM", name: "Asyik Mengaji", description: "Kegiatan mengaji harian dengan senang." },
  { key: "hb", code: "HB", name: "Hormat & Berbakti", description: "Menghormati guru, orang tua, dan sesama." },
  { key: "asm", code: "ASM", name: "Aku Suka Membaca", description: "Kegiatan membaca buku secara rutin." },
  { key: "br", code: "BR", name: "Bersih & Rapi", description: "Menjaga kebersihan diri dan kerapian lingkungan." },
  { key: "ak", code: "AK", name: "Aktif Berkarya", description: "Semangat berkarya dan menghasilkan sesuatu." },
  { key: "tm", code: "TM", name: "Tolong Menolong", description: "Membantu teman dan orang lain yang membutuhkan." },
];

interface ScoreRow {
  student: StudentSummary;
  scores: Record<IndicatorKey, number | null>;
  originalScores: Record<IndicatorKey, number | null>;
  observationNote: string;
  originalObservationNote: string;
}

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateParam(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

/**
 * Calculates Monday (week_start_date) and Sunday (week_end_date) for any selected date
 */
function getWeekRange(dateInput: string) {
  if (!dateInput || !isValidDateParam(dateInput)) return null;

  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

  const monday = new Date(year, month - 1, diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatISO = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatHuman = (d: Date) => {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  return {
    week_start_date: formatISO(monday),
    week_end_date: formatISO(sunday),
    displayRange: `${formatHuman(monday)} - ${formatHuman(sunday)}`,
    mondayDate: monday,
    sundayDate: sunday,
  };
}

function humanizeError(error: unknown) {
  if (!(error instanceof Error)) return UX_COPY.culture.saveError;
  const message = error.message;
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";

  if (code === "ERR_SEMESTER_FINALIZED" || message.toLowerCase().includes("finalized")) {
    return "Semester sudah difinalisasi. Nilai tidak dapat diubah.";
  }
  if (code === "ERR_SEMESTER_LOCKED" || message.toLowerCase().includes("dikunci oleh admin")) {
    return UX_COPY.culture.semesterLocked;
  }
  if (code === "ERR_FORBIDDEN" || message.toLowerCase().includes("forbidden") || message.toLowerCase().includes("tidak memiliki akses")) {
    return UX_COPY.culture.teacherNotAssigned;
  }
  if (code === "ERR_PERIOD_LOCKED" || message.toLowerCase().includes("period for editing") || message.toLowerCase().includes("sudah ditutup")) {
    return UX_COPY.culture.periodLocked;
  }
  return message || UX_COPY.culture.saveError;
}

function DailyCulturePageContent() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const requestedClassId = searchParams.get("class_id");

  // Selection States
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(requestedClassId || "");
  const [selectedDate, setSelectedDate] = useState(() => isValidDateParam(requestedDate) ? requestedDate : getLocalDateString());

  // Calculated Week Range
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Data States
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [isSemesterLocked, setIsSemesterLocked] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Status States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Find active assignment details for the selected class
  const selectedAssignment = useMemo(() => {
    return classes.find((item) => item.class_id === selectedClassId);
  }, [classes, selectedClassId]);

  // Client-side date lock window (7 days limit check for Teacher role based on week_end_date)
  const isLockedByDate = useMemo(() => {
    if (!weekRange) return false;
    const role = String(user?.role || "").toLowerCase();
    if (role === "administrator" || role === "admin") return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lockCheckEndDate = new Date(weekRange.sundayDate);
    lockCheckEndDate.setHours(23, 59, 59, 999);

    const diffTime = today.getTime() - lockCheckEndDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const limit = (role === "admin" || role === "administrator") ? 30 : 7;
    return diffDays > limit;
  }, [weekRange, user]);

  // Calculate week status badge (Improvement 1: Visibility of System Status)
  const weekStatus = useMemo(() => {
    if (isSemesterLocked || isLockedByDate) {
      return { code: "locked", label: "Dikunci", badge: "🔴 Dikunci", color: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800" };
    }
    if (!weekRange) return { code: "active", label: "Aktif", badge: "🟢 Aktif", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lockCheckEndDate = new Date(weekRange.sundayDate);
    lockCheckEndDate.setHours(23, 59, 59, 999);

    const diffTime = today.getTime() - lockCheckEndDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const role = String(user?.role || "").toLowerCase();
    const limit = (role === "admin" || role === "administrator") ? 30 : 7;
    const warningDays = (role === "admin" || role === "administrator") ? 25 : 5;

    if (diffDays >= warningDays && diffDays <= limit) {
      return { code: "warning", label: "Mendekati Batas Pengisian", badge: "🟡 Mendekati batas pengisian", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
    }

    return { code: "active", label: "Aktif", badge: "🟢 Aktif", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
  }, [isSemesterLocked, isLockedByDate, weekRange, user]);

  const isReadOnly = Boolean(isSemesterLocked || isLockedByDate);

  // Incomplete submit confirmation state (Improvement 3: Submit Prevention)
  const [confirmIncompleteOpen, setConfirmIncompleteOpen] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);

  // Load classes initially
  useEffect(() => {
    if (!token || !user) return;

    async function loadClasses() {
      try {
        const myClasses = await getMyClasses(token!);
        setClasses(myClasses);
        if (myClasses.length > 0) {
          const requestedClass = requestedClassId && myClasses.some((item) => item.class_id === requestedClassId)
            ? requestedClassId
            : myClasses[0].class_id;
          setSelectedClassId(requestedClass);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Gagal memuat kelas.");
        setLoading(false);
      }
    }

    setTimeout(() => loadClasses(), 0);
  }, [token, user, requestedClassId]);

  // Load roster and scores on class or week_start_date change
  const loadRosterAndScores = useCallback(async () => {
    if (!token || !selectedClassId || !weekRange || !selectedAssignment) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const { academic_year_id, semester_id } = selectedAssignment;

      // 1. Fetch data in parallel using week_start_date
      const [roster, scores, finalization] = await Promise.all([
        listStudentsByClass(selectedClassId, academic_year_id, semester_id, token!),
        listCultureScoresByDate(token!, {
          class_id: selectedClassId,
          week_start_date: weekRange.week_start_date,
          score_date: weekRange.week_start_date,
          academic_year_id,
          semester_id,
        }),
        getSemesterFinalizationStatus(token!, {
          academic_year_id,
          semester_id,
        }),
      ]);

      // 2. Set finalization status
      setIsSemesterLocked(finalization.finalized);

      // 3. Map scores index by student ID
      const scoreMap = new Map<string, CultureScoreRecord>();
      scores.forEach((record) => {
        if (record.status === "active") {
          scoreMap.set(record.student_id, record);
        }
      });

      // 4. Build local state rows
      const initialRows: ScoreRow[] = roster.map((student) => {
        const existing = scoreMap.get(student.id);
        const itemScores: Record<IndicatorKey, number | null> = {
          sss: dbScoreToUi(existing?.sss_score),
          am: dbScoreToUi(existing?.am_score),
          hb: dbScoreToUi(existing?.hb_score),
          asm: dbScoreToUi(existing?.asm_score),
          br: dbScoreToUi(existing?.br_score),
          ak: dbScoreToUi(existing?.ak_score),
          tm: dbScoreToUi(existing?.tm_score),
        };

        const note = existing?.observation_note || "";

        return {
          student,
          scores: { ...itemScores },
          originalScores: { ...itemScores },
          observationNote: note,
          originalObservationNote: note,
        };
      });

      setRows(initialRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data roster budaya mingguan.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedClassId, selectedAssignment, weekRange]);

  useEffect(() => {
    if (!selectedClassId || !weekRange) return;
    if (selectedClassId && weekRange && selectedAssignment) {
      setTimeout(() => loadRosterAndScores(), 0);
    } else {
      setLoading(false);
    }
  }, [selectedClassId, selectedAssignment, weekRange, loadRosterAndScores]);

  // Identify dirty rows
  const dirtyRows = useMemo(() => {
    return rows.filter((row) => {
      const isScoreChanged = INDICATORS.some(
        (ind) => row.scores[ind.key] !== row.originalScores[ind.key]
      );
      const isNoteChanged = row.observationNote !== row.originalObservationNote;
      return isScoreChanged || isNoteChanged;
    });
  }, [rows]);

  // Completion metrics
  const completionStats = useMemo(() => {
    const total = rows.length;
    let started = 0;
    let complete = 0;

    rows.forEach((row) => {
      const filledCount = INDICATORS.filter((ind) => row.scores[ind.key] !== null).length;
      if (filledCount > 0) started++;
      if (filledCount === 7) complete++;
    });

    const startedPercentage = total > 0 ? Number(((started / total) * 100).toFixed(1)) : 0;
    const completePercentage = total > 0 ? Number(((complete / total) * 100).toFixed(1)) : 0;

    return { total, started, complete, startedPercentage, completePercentage };
  }, [rows]);

  // Action update score indicator for student
  const updateScoreValue = (studentId: string, key: IndicatorKey, value: number | null) => {
    if (isReadOnly) return;
    setRows((current) =>
      current.map((row) =>
        row.student.id === studentId
          ? {
              ...row,
              scores: {
                ...row.scores,
                [key]: value,
              },
            }
          : row
      )
    );
  };

  // Action update observation note for student
  const updateObservationNote = (studentId: string, note: string) => {
    if (isReadOnly) return;
    setRows((current) =>
      current.map((row) =>
        row.student.id === studentId
          ? {
              ...row,
              observationNote: note,
            }
          : row
      )
    );
  };

  // Cancel confirm state
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const executeCancelReset = () => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        scores: { ...row.originalScores },
        observationNote: row.originalObservationNote,
      }))
    );
    setSaveError(null);
    notify.info(UX_COPY.culture.cancelSuccess);
  };

  const handleCancel = () => {
    if (dirtyRows.length > 0) {
      setConfirmCancelOpen(true);
    } else {
      executeCancelReset();
    }
  };

  const { open: appOpen, setOpen: setAppOpen, message: appMsg, triggerAppreciation } = useAppreciation();

  // Execution function for batch save
  const executeSave = async () => {
    if (!token || !selectedAssignment || !weekRange || isReadOnly || dirtyRows.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const { academic_year_id, semester_id } = selectedAssignment;

      const payloadScores: SaveCultureScoreItem[] = dirtyRows.map((row) => {
        return {
          student_id: row.student.id,
          sss_score: uiScoreToDb(row.scores.sss),
          am_score: uiScoreToDb(row.scores.am),
          hb_score: uiScoreToDb(row.scores.hb),
          asm_score: uiScoreToDb(row.scores.asm),
          br_score: uiScoreToDb(row.scores.br),
          ak_score: uiScoreToDb(row.scores.ak),
          tm_score: uiScoreToDb(row.scores.tm),
          observation_note: row.observationNote.trim() || null,
        };
      });

      await saveCultureScores(token!, {
        class_id: selectedClassId,
        academic_year_id,
        semester_id,
        week_start_date: weekRange.week_start_date,
        week_end_date: weekRange.week_end_date,
        scores: payloadScores,
      });

      setLastSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));

      notify.success(UX_COPY.culture.saveSuccess);

      // Evaluate 100% weekly culture completion
      const isHundredPercent = completionStats.total > 0 && completionStats.complete === completionStats.total;

      if (isHundredPercent) {
        triggerAppreciation({
          workflowId: "culture_100",
          classId: selectedClassId,
          scoreDate: weekRange.week_start_date,
          role: "teacher",
          level: 4,
        });
      }

      await loadRosterAndScores();
    } catch (err: unknown) {
      setSaveError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  // Submit handler with incomplete assessment warning (Improvement 3: Submit Prevention)
  const handleSave = async () => {
    if (!token || !selectedAssignment || !weekRange || isReadOnly || dirtyRows.length === 0) return;

    // Count dirty students that do not have all 7 indicators filled
    const incompleteDirty = dirtyRows.filter((row) => {
      const filledCount = INDICATORS.filter((ind) => row.scores[ind.key] !== null).length;
      return filledCount < 7;
    });

    if (incompleteDirty.length > 0) {
      setIncompleteCount(incompleteDirty.length);
      setConfirmIncompleteOpen(true);
    } else {
      await executeSave();
    }
  };

  // Check roles permissions
  const userRoleStr = String(user?.role || "").toLowerCase();
  if (!user || (userRoleStr !== "teacher" && userRoleStr !== "administrator" && userRoleStr !== "admin")) {
    return <ForbiddenState message="Halaman Asesmen Budaya Mingguan hanya dapat diakses oleh Guru Wali Kelas atau Admin." />;
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Asesmen Budaya Mingguan (SAHABAT)"
        description="Input dan pantau skor asesmen budaya mingguan karakter siswa."
      />

      {/* Selectors Panel */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="class-select" className="block mb-1.5">Kelas</Label>
            <select
              id="class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-surface-1 text-sm font-plus-jakarta focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2"
            >
              <option value="">Pilih kelas...</option>
              {classes.map((item) => (
                <option key={item.assignment_id} value={item.class_id}>
                  {item.class_name} {item.class_code ? `(${item.class_code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-plus-jakarta">Tanggal (Pilih Minggu)</label>
            <DatePicker
              value={selectedDate}
              onChange={(val) => setSelectedDate(val)}
              disabled={loading}
              maxDate={getLocalDateString()}
              placeholder="Pilih tanggal minggu..."
            />
          </div>

          {selectedAssignment && (
            <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-end">
              <div className="text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400 bg-surface-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
                <span className="font-semibold">Periode:</span> {selectedAssignment.academic_year_name} / Semester {selectedAssignment.semester_name}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Header Info Penilaian Minggu & Status Badge (Improvement 1) */}
      {weekRange && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100 block">Penilaian Minggu</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border backdrop-blur ${
                weekStatus.code === 'locked' ? 'bg-red-500/20 text-red-100 border-red-300/40' :
                weekStatus.code === 'warning' ? 'bg-amber-500/20 text-amber-100 border-amber-300/40' :
                'bg-emerald-500/20 text-emerald-100 border-emerald-300/40'
              }`}>
                {weekStatus.badge}
              </span>
            </div>
            <h2 className="text-lg font-bold font-plus-jakarta mt-0.5">{weekRange.displayRange}</h2>
          </div>
          <div className="text-xs bg-white/10 backdrop-blur px-3 py-1.5 rounded-lg border border-white/20 self-start sm:self-auto">
            Senin ({weekRange.week_start_date}) s/d Minggu ({weekRange.week_end_date})
          </div>
        </div>
      )}

      {isSemesterLocked && (
        <InfoBanner
          variant="error"
          title="Semester Terkunci"
          description="Laporan semester ini telah difinalisasi. Semua data budaya bersifat hanya baca (read-only) dan tidak dapat dimodifikasi."
        />
      )}

      {!isSemesterLocked && isLockedByDate && (
        <InfoBanner
          variant="warning"
          title="Batas Pengisian Terlewati"
          description="Minggu ini berada di luar batas pengisian mingguan (maksimal 7 hari setelah akhir minggu untuk guru, 30 hari untuk admin). Anda hanya dapat melihat data budaya yang sudah diisi."
        />
      )}

      {saveError && (
        <InfoBanner
          variant="error"
          title="Gagal Menyimpan"
          description={saveError}
        />
      )}

      {/* Completion Metrics Section */}
      {!loading && !error && rows.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Statistik pengisian budaya mingguan">
          <Card padding="md">
            <ColumnLabel className="block">Total Roster Siswa</ColumnLabel>
            <span className="mt-2 text-2xl font-fredoka font-bold text-zinc-950 dark:text-zinc-50 block">{completionStats.total}</span>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <ColumnLabel>Mulai Diisi (Min. 1)</ColumnLabel>
              <NumericDisplay className="font-bold text-brand-emerald-600 dark:text-brand-emerald-400">
                {completionStats.started} ({completionStats.startedPercentage}%)
              </NumericDisplay>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${completionStats.startedPercentage}%` }} />
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between">
              <ColumnLabel>Lengkap (7/7)</ColumnLabel>
              <NumericDisplay className="font-bold text-blue-600 dark:text-blue-400">
                {completionStats.complete} ({completionStats.completePercentage}%)
              </NumericDisplay>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${completionStats.completePercentage}%` }} />
            </div>
          </Card>
        </section>
      )}

      {/* Main Content Area */}
      {loading && <LoadingState message="Memuat roster & nilai budaya mingguan..." />}

      {!loading && error && <ErrorState message={error} onRetry={loadRosterAndScores} />}

      {!loading && !error && (
        <>
          {classes.length === 0 && (
            <EmptyState
              title="Belum Ada Kelas"
              description="Anda belum memiliki assignment kelas aktif untuk semester berjalan."
            />
          )}

          {(!selectedClassId || !selectedDate) && classes.length > 0 && (
            <EmptyState
              title="Rekap Nilai Budaya Mingguan"
              description="Pilih kelas dan minggu untuk melihat rekap"
            />
          )}

          {classes.length > 0 && selectedClassId && selectedDate && rows.length === 0 && (
            <EmptyState
              title="Roster Kosong"
              description="Tidak ada siswa aktif yang terdaftar di kelas ini untuk semester berjalan."
            />
          )}

          {/* SAHABAT Score Legend (Improvement 2: Recognition Not Recall & Help) */}
          {selectedClassId && selectedDate && rows.length > 0 && (
            <div className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 text-xs font-plus-jakarta text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">Skala Penilaian SAHABAT:</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span> <strong>0</strong> = Belum Dinilai</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> <strong>1</strong> = Perlu Pembinaan</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> <strong>2</strong> = Mulai Berkembang</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> <strong>3</strong> = Baik</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> <strong>4</strong> = Sangat Baik</span>
              </div>
            </div>
          )}

          {selectedClassId && selectedDate && rows.length > 0 && (
            <Card>
              {/* Header status bar */}
              <CardHeader
                title="Daftar Input Skor Mingguan"
                bordered
                subtitle="Klik atau ketuk tombol skor untuk memilih nilai (1–4). Klik kembali untuk mengosongkan (0 = tidak diamati)."
                action={
                  <span className="text-xs font-plus-jakarta font-medium text-zinc-500 dark:text-zinc-400">
                    {dirtyRows.length > 0 ? (
                      <span className="font-semibold text-brand-emerald-600 dark:text-brand-emerald-400">{dirtyRows.length} perubahan siap disimpan</span>
                    ) : lastSavedAt ? (
                      `Tersimpan ${lastSavedAt}`
                    ) : (
                      "Semua data sesuai server"
                    )}
                  </span>
                }
              />

              {/* Roster Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <th className="py-3 px-4 w-12 text-center" scope="col">No</th>
                      <th className="py-3 px-4 min-w-[180px]" scope="col">Nama Siswa</th>
                      {INDICATORS.map((ind) => (
                        <th key={ind.key} className="py-3 px-2 text-center min-w-[120px]" title={ind.description} scope="col">
                          {ind.code}
                          <span className="block text-[9px] font-normal lowercase text-zinc-400 dark:text-zinc-500 truncate max-w-[100px] mt-0.5">
                            {ind.name}
                          </span>
                        </th>
                      ))}
                      <th className="py-3 px-4 min-w-[180px]" scope="col">Catatan Pengamatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-plus-jakarta">
                    {rows.map((row, index) => {
                      return (
                        <tr key={row.student.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                          <td className="py-3.5 px-4 text-center">
                            <NumericDisplay className="font-semibold text-zinc-400 dark:text-zinc-500">{index + 1}</NumericDisplay>
                          </td>
                          <td className="py-3.5 px-4">
                            <CardTitle className="leading-tight">{row.student.full_name}</CardTitle>
                            <NumericDisplay className="text-zinc-500 dark:text-zinc-400 mt-1 block text-xs">
                              NISN: {row.student.nisn}
                            </NumericDisplay>
                          </td>
                          {INDICATORS.map((ind) => {
                            const val = row.scores[ind.key];
                            return (
                              <td key={ind.key} className="py-3.5 px-2">
                                <div className="flex items-center justify-center">
                                  <ScoreSelector
                                    value={val}
                                    disabled={isReadOnly}
                                    onChange={(newVal) => updateScoreValue(row.student.id, ind.key, newVal)}
                                  />
                                </div>
                              </td>
                            );
                          })}
                          <td className="py-3.5 px-4">
                            <input
                              type="text"
                              value={row.observationNote}
                              disabled={isReadOnly}
                              onChange={(e) => updateObservationNote(row.student.id, e.target.value)}
                              placeholder="Catatan..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-surface-1 text-xs font-plus-jakarta focus:outline-none focus:ring-1 focus:ring-brand-emerald-500 disabled:opacity-60"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Roster Mobile Card List (Accordion) */}
              <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row, index) => {
                  const isExpanded = expandedStudentId === row.student.id;
                  const filledCount = INDICATORS.filter((ind) => row.scores[ind.key] !== null).length;
                  const isRowDirty = INDICATORS.some((ind) => row.scores[ind.key] !== row.originalScores[ind.key]) || row.observationNote !== row.originalObservationNote;

                  return (
                    <div key={row.student.id}>
                      {/* Accordion trigger */}
                      <button
                        type="button"
                        onClick={() => setExpandedStudentId(isExpanded ? null : row.student.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`student-panel-${row.student.id}`}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-inset"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface-2 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate">{row.student.full_name}</CardTitle>
                            <NumericDisplay className="text-zinc-500 dark:text-zinc-400 mt-0.5 block text-xs">
                              NISN: {row.student.nisn}
                            </NumericDisplay>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-plus-jakarta tracking-wide ${
                              filledCount === 7
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                : filledCount > 0
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {filledCount}/7 diisi
                            </span>
                            {isRowDirty && (
                              <span className="text-[10px] font-plus-jakarta text-brand-emerald-600 dark:text-brand-emerald-400 font-semibold">
                                Belum disimpan
                              </span>
                            )}
                          </div>
                          <svg
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Accordion panel content */}
                      {isExpanded && (
                        <div
                          id={`student-panel-${row.student.id}`}
                          className="px-4 pb-4 pt-1 bg-surface-2 border-t border-zinc-100 dark:border-zinc-800 space-y-4"
                        >
                          {INDICATORS.map((ind) => {
                            const val = row.scores[ind.key];
                            return (
                              <div key={ind.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0 last:pb-0">
                                <div>
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold font-plus-jakarta text-zinc-700 dark:text-zinc-300 uppercase mr-2">
                                    {ind.code}
                                  </span>
                                  <span className="text-xs font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100">
                                    {ind.name}
                                  </span>
                                  <p className="text-[10px] font-plus-jakarta text-zinc-500 mt-0.5 leading-relaxed">
                                    {ind.description}
                                  </p>
                                </div>

                                <div className="w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                                  <ScoreSelector
                                    value={val}
                                    disabled={isReadOnly}
                                    isMobile={true}
                                    onChange={(newVal) => updateScoreValue(row.student.id, ind.key, newVal)}
                                  />
                                </div>
                              </div>
                            );
                          })}

                          <div className="pt-2">
                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Catatan Pengamatan Guru</label>
                            <input
                              type="text"
                              value={row.observationNote}
                              disabled={isReadOnly}
                              onChange={(e) => updateObservationNote(row.student.id, e.target.value)}
                              placeholder="Masukkan catatan pengamatan..."
                              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-surface-1 text-xs font-plus-jakarta focus:outline-none focus:ring-2 focus:ring-brand-emerald-500 disabled:opacity-60"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Sticky Bottom Save Action Bar */}
          {!isReadOnly && (
            <div className="sticky bottom-16 md:bottom-4 z-30 rounded-2xl bg-surface-1/95 backdrop-blur border border-zinc-200 dark:border-zinc-800 shadow-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" role="region" aria-label="Action Toolbar">
              <p className="text-sm font-plus-jakarta text-zinc-600 dark:text-zinc-400">
                {dirtyRows.length > 0 ? (
                  <span>Terdapat <span className="font-bold text-brand-emerald-600 dark:text-brand-emerald-400">{dirtyRows.length}</span> perubahan nilai mingguan belum disimpan.</span>
                ) : (
                  "Tidak ada perubahan nilai mingguan."
                )}
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleCancel}
                  disabled={saving || dirtyRows.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-surface-1 hover:bg-surface-2 text-zinc-700 dark:text-zinc-300 text-sm font-semibold font-plus-jakarta transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || dirtyRows.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white text-sm font-semibold font-plus-jakarta shadow-sm transition-colors disabled:opacity-50 min-w-[120px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Skor Mingguan"
                  )}
                </button>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={confirmCancelOpen}
            onOpenChange={setConfirmCancelOpen}
            title="Batalkan Perubahan Skor Budaya?"
            description={`Terdapat ${dirtyRows.length} perubahan skor budaya mingguan yang belum disimpan. Semua perubahan akan dibatalkan.`}
            confirmLabel="Ya, Batalkan"
            cancelLabel="Tidak, Lanjutkan Pengisian"
            variant="destructive"
            onConfirm={executeCancelReset}
          />

          <ConfirmDialog
            open={confirmIncompleteOpen}
            onOpenChange={setConfirmIncompleteOpen}
            title="Penilaian Siswa Belum Lengkap"
            description={`Terdapat ${incompleteCount} siswa yang belum memiliki penilaian lengkap (7/7 indikator). Apakah Anda tetap ingin menyimpan nilai minggu ini?`}
            confirmLabel="Simpan Tetap"
            cancelLabel="Periksa Kembali"
            variant="default"
            onConfirm={executeSave}
          />

          <AppreciationDialog
            open={appOpen}
            onOpenChange={setAppOpen}
            title={appMsg.title}
            description={appMsg.body}
          />
        </>
      )}
    </ResponsiveContainer>
  );
}

export default function DailyCulturePage() {
  return (
    <Suspense fallback={<LoadingState message="Memuat halaman budaya mingguan..." />}>
      <DailyCulturePageContent />
    </Suspense>
  );
}
