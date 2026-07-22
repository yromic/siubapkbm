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

const SCORE_OPTIONS = [
  {
    value: 1,
    emoji: "😞",
    label: "Perlu Bimbingan",
    shortLabel: "PB",
    activeClass: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-450 dark:border-rose-800 focus:ring-rose-500/30",
  },
  {
    value: 2,
    emoji: "😐",
    label: "Cukup",
    shortLabel: "C",
    activeClass: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-450 dark:border-amber-800 focus:ring-amber-500/30",
  },
  {
    value: 3,
    emoji: "🙂",
    label: "Baik",
    shortLabel: "B",
    activeClass: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-800 focus:ring-emerald-500/30",
  },
  {
    value: 4,
    emoji: "🌟",
    label: "Sangat Baik",
    shortLabel: "SB",
    activeClass: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-450 dark:border-blue-800 focus:ring-blue-500/30",
  },
];

interface ScoreSelectorProps {
  value: number | null;
  onChange: (val: number | null) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const ScoreSelector: React.FC<ScoreSelectorProps> = ({ value, onChange, disabled, isMobile = false }) => {
  return (
    <div
      role="radiogroup"
      aria-label="Skor Budaya"
      className={`inline-flex items-center gap-1 bg-zinc-100/60 dark:bg-zinc-900/60 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 ${
        isMobile ? "w-full justify-between" : ""
      }`}
    >
      {SCORE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(isActive ? null : opt.value);
            }}
            title={opt.label}
            aria-label={`${opt.label} (Skor ${opt.value})`}
            aria-checked={isActive}
            role="radio"
            className={`
              flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed
              ${isMobile ? "flex-1 py-1.5 px-1 gap-1 text-xs" : "w-7 h-7 text-sm"}
              ${
                isActive
                  ? `${opt.activeClass} shadow-sm border font-semibold scale-105`
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-transparent hover:bg-white dark:hover:bg-zinc-800 hover:shadow-xs"
              }
            `}
          >
            <span className="select-none">{opt.emoji}</span>
            {isMobile && <span className="font-bold">{opt.shortLabel}</span>}
          </button>
        );
      })}
    </div>
  );
};

interface ScoreRow {
  student: StudentSummary;
  scores: Record<IndicatorKey, number | null>;
  originalScores: Record<IndicatorKey, number | null>;
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

function humanizeError(error: unknown) {
  if (!(error instanceof Error)) return "Gagal menyimpan skor budaya.";
  const message = error.message;
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";

  if (code === "ERR_SEMESTER_FINALIZED" || message.toLowerCase().includes("finalized")) {
    return "Semester sudah difinalisasi. Nilai tidak dapat diubah.";
  }
  if (code === "ERR_FORBIDDEN" || message.toLowerCase().includes("forbidden")) {
    return "Anda tidak memiliki otorisasi untuk melakukan aksi ini.";
  }
  if (code === "ERR_PERIOD_LOCKED" || message.toLowerCase().includes("period for editing") || message.toLowerCase().includes("locked")) {
    return "Periode pengisian nilai budaya untuk tanggal ini sudah terkunci (maksimal 7 hari lalu).";
  }
  return message || "Gagal menyimpan skor budaya.";
}

function DailyCulturePageContent() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const requestedClassId = searchParams.get("class_id");
  
  // Selection States
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(requestedClassId || "");
  const [selectedDate, setSelectedDate] = useState(() => isValidDateParam(requestedDate) ? requestedDate : "");
  
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

  // Client-side date lock window (7 days limit check for Teacher role)
  const isLockedByDate = useMemo(() => {
    if (!selectedDate) return false;
    if (user?.role === "administrator") return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse target date based on YYYY-MM-DD local format
    const parts = selectedDate.split("-");
    if (parts.length !== 3) return false;
    const target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
    
    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const limit = user?.role === "admin" ? 30 : 7;
    return diffDays > limit;
  }, [selectedDate, user]);

  const isReadOnly = isSemesterLocked || isLockedByDate;

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
            : "";
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

  // Load roster and scores on class or date change
  const loadRosterAndScores = useCallback(async () => {
    if (!token || !selectedClassId || !selectedDate || !selectedAssignment) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const { academic_year_id, semester_id } = selectedAssignment;
      
      const dateStr = (selectedDate as any) instanceof Date ? getLocalDateString(selectedDate as any) : String(selectedDate);
      if (!dateStr || !selectedClassId) return;

      // 1. Fetch data in parallel
      const [roster, scores, finalization] = await Promise.all([
        listStudentsByClass(selectedClassId, academic_year_id, semester_id, token!),
        listCultureScoresByDate(token!, {
          class_id: selectedClassId,
          score_date: dateStr,
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

        return {
          student,
          scores: { ...itemScores },
          originalScores: { ...itemScores },
        };
      });

      setRows(initialRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data roster budaya.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedClassId, selectedAssignment, selectedDate]);

  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;
    if (selectedClassId && selectedDate && selectedAssignment) {
      setTimeout(() => loadRosterAndScores(), 0);
    } else {
      setLoading(false);
    }
  }, [selectedClassId, selectedAssignment, selectedDate, loadRosterAndScores]);

  // Identify dirty rows
  const dirtyRows = useMemo(() => {
    return rows.filter((row) => {
      return INDICATORS.some(
        (ind) => row.scores[ind.key] !== row.originalScores[ind.key]
      );
    });
  }, [rows]);

  // Completion calculations
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

  // Cancel confirm state
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const executeCancelReset = () => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        scores: { ...row.originalScores },
      }))
    );
    setSaveError(null);
    notify.info("Perubahan skor budaya dibatalkan.");
  };

  const handleCancel = () => {
    if (dirtyRows.length > 0) {
      setConfirmCancelOpen(true);
    } else {
      executeCancelReset();
    }
  };

  const { open: appOpen, setOpen: setAppOpen, message: appMsg, triggerAppreciation } = useAppreciation();

  // Submit batch saves
  const handleSave = async () => {
    if (!token || !selectedAssignment || isReadOnly || dirtyRows.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const { academic_year_id, semester_id } = selectedAssignment;
      
      const dateStr = (selectedDate as any) instanceof Date ? getLocalDateString(selectedDate as any) : String(selectedDate);
      
      const payloadScores: SaveCultureScoreItem[] = dirtyRows.map((row) => {
        return {
          student_id: row.student.id,
          score_date: dateStr,
          sss_score: uiScoreToDb(row.scores.sss),
          am_score: uiScoreToDb(row.scores.am),
          hb_score: uiScoreToDb(row.scores.hb),
          asm_score: uiScoreToDb(row.scores.asm),
          br_score: uiScoreToDb(row.scores.br),
          ak_score: uiScoreToDb(row.scores.ak),
          tm_score: uiScoreToDb(row.scores.tm),
        };
      });

      await saveCultureScores(token!, {
        class_id: selectedClassId,
        academic_year_id,
        semester_id,
        score_date: dateStr,
        scores: payloadScores,
      });

      setLastSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));

      notify.success("Nilai budaya berhasil disimpan");

      // Evaluate 100% weekly culture completion
      const isHundredPercent = completionStats.total > 0 && completionStats.complete === completionStats.total;

      if (isHundredPercent) {
        triggerAppreciation({
          workflowId: "culture_100",
          classId: selectedClassId,
          scoreDate: (selectedDate as any) instanceof Date ? getLocalDateString(selectedDate as any) : String(selectedDate),
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

  // Check roles permissions
  if (!user || user.role !== "teacher") {
    return <ForbiddenState message="Halaman Budaya Harian hanya dapat diakses oleh Guru Wali Kelas." />;
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Budaya Harian (SAHABAT)"
        description="Input dan pantau skor budaya harian karakter siswa."
      />

      {/* Selectors Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white dark:bg-[#171717]/60 p-4 border border-zinc-200 dark:border-zinc-800/80 rounded-[20px] shadow-sm">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
            Kelas
          </label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={loading}
            className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400 mb-1.5">
            Tanggal
          </label>
          <DatePicker
            value={selectedDate}
            onChange={(val) => setSelectedDate(val)}
            disabled={loading}
            maxDate={getLocalDateString()}
            placeholder="Pilih tanggal..."
          />
        </div>

        {selectedAssignment && (
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-end">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-[12px] border border-zinc-150 dark:border-zinc-800/60">
              <span className="font-semibold">Periode:</span> {selectedAssignment.academic_year_name} / Semester {selectedAssignment.semester_name}
            </div>
          </div>
        )}
      </div>

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
          description={`Tanggal ini berada di luar batas pengisian harian (maksimal 7 hari untuk guru, 30 hari untuk admin). Anda hanya dapat melihat data budaya yang sudah diisi.`}
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
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">Total Roster Siswa</div>
            <div className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-50">{completionStats.total}</div>
          </div>
          
          <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              <span>Mulai Diisi (Min. 1)</span>
              <span className="font-bold text-[#468432] dark:text-emerald-450">{completionStats.started} ({completionStats.startedPercentage}%)</span>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${completionStats.startedPercentage}%` }} />
            </div>
          </div>

          <div className="rounded-[20px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              <span>Lengkap (7/7)</span>
              <span className="font-bold text-blue-600 dark:text-blue-450">{completionStats.complete} ({completionStats.completePercentage}%)</span>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${completionStats.completePercentage}%` }} />
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      {loading && <LoadingState message="Memuat roster & nilai budaya harian..." />}

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
              title="Rekap Nilai Budaya"
              description="Pilih kelas dan tanggal untuk melihat rekap"
            />
          )}

          {classes.length > 0 && selectedClassId && selectedDate && rows.length === 0 && (
            <EmptyState
              title="Roster Kosong"
              description="Tidak ada siswa aktif yang terdaftar di kelas ini untuk semester berjalan."
            />
          )}

          {selectedClassId && selectedDate && rows.length > 0 && (
            <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
              {/* Header status bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#171717]/10">
                <div>
                  <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">Daftar Input Skor</h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Klik atau ketuk emoji untuk memilih skor (1-4). Klik kembali untuk mengosongkan.
                  </p>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {dirtyRows.length > 0 ? (
                    <span className="font-semibold text-[#468432] dark:text-emerald-450">{dirtyRows.length} perubahan siap disimpan</span>
                  ) : lastSavedAt ? (
                    `Tersimpan ${lastSavedAt}`
                  ) : (
                    "Semua data sesuai server"
                  )}
                </div>
              </div>

              {/* Roster Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-150 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4 min-w-[200px]">Nama Siswa</th>
                      {INDICATORS.map((ind) => (
                        <th key={ind.key} className="py-3 px-3 text-center min-w-[130px]" title={ind.description}>
                          {ind.code}
                          <span className="block text-[9px] font-normal lowercase text-zinc-400 dark:text-zinc-650 truncate max-w-[110px] mt-0.5">
                            {ind.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                    {rows.map((row, index) => {
                      return (
                        <tr key={row.student.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm font-semibold text-zinc-400 dark:text-zinc-650">
                            {index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm text-zinc-950 dark:text-zinc-50 leading-tight">
                              {row.student.full_name}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                              NISN: {row.student.nisn}
                            </div>
                          </td>
                          {INDICATORS.map((ind) => {
                            const val = row.scores[ind.key];
                            return (
                              <td key={ind.key} className="py-3.5 px-3">
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Roster Mobile Card List (Accordion) */}
              <div className="block md:hidden divide-y divide-zinc-150 dark:divide-zinc-800">
                {rows.map((row, index) => {
                  const isExpanded = expandedStudentId === row.student.id;
                  const filledCount = INDICATORS.filter((ind) => row.scores[ind.key] !== null).length;
                  const isRowDirty = INDICATORS.some((ind) => row.scores[ind.key] !== row.originalScores[ind.key]);
                  
                  return (
                    <div key={row.student.id} className="bg-white dark:bg-[#171717] transition-colors">
                      {/* Accordion trigger card */}
                      <button
                        type="button"
                        onClick={() => setExpandedStudentId(isExpanded ? null : row.student.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-950/20 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-450 flex items-center justify-center text-xs font-bold shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-zinc-950 dark:text-zinc-50 truncate">
                              {row.student.full_name}
                            </div>
                            <div className="text-xs text-zinc-550 dark:text-zinc-400 mt-0.5">
                              NISN: {row.student.nisn}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                              filledCount === 7
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                : filledCount > 0
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {filledCount}/7 diisi
                            </span>
                            {isRowDirty && (
                              <span className="text-[10px] text-[#468432] font-semibold">
                                Belum disimpan
                              </span>
                            )}
                          </div>
                          <svg
                            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Accordion panel content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 bg-zinc-50/50 dark:bg-zinc-950/20 border-t border-zinc-100 dark:border-zinc-850 space-y-4 animate-in slide-in-from-top duration-200">
                          {INDICATORS.map((ind) => {
                            const val = row.scores[ind.key];
                            return (
                              <div key={ind.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3.5 border-b border-zinc-100 dark:border-zinc-850/60 last:border-b-0 last:pb-0">
                                <div>
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase mr-2">
                                    {ind.code}
                                  </span>
                                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                    {ind.name}
                                  </span>
                                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sticky Bottom Save Action Bar */}
          {!isReadOnly && (
            <div className="sticky bottom-16 md:bottom-4 z-30 rounded-[20px] bg-white/95 dark:bg-[#171717]/95 backdrop-blur border border-zinc-200 dark:border-zinc-800 shadow-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in duration-200">
              <div className="text-sm text-zinc-650 dark:text-zinc-400">
                {dirtyRows.length > 0 ? (
                  <span>Terdapat <span className="font-bold text-[#468432] dark:text-emerald-450">{dirtyRows.length}</span> perubahan nilai belum disimpan.</span>
                ) : (
                  "Tidak ada perubahan nilai harian."
                )}
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
                  disabled={saving || dirtyRows.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 min-w-[120px] cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Skor"
                  )}
                </button>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={confirmCancelOpen}
            onOpenChange={setConfirmCancelOpen}
            title="Batalkan Perubahan Skor Budaya?"
            description={`Terdapat ${dirtyRows.length} perubahan skor budaya yang belum disimpan. Semua perubahan akan dibatalkan.`}
            confirmLabel="Ya, Batalkan"
            cancelLabel="Tidak, Lanjutkan Pengisian"
            variant="destructive"
            onConfirm={executeCancelReset}
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
    <Suspense fallback={<LoadingState message="Memuat halaman budaya harian..." />}>
      <DailyCulturePageContent />
    </Suspense>
  );
}
