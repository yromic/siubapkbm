"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Settings,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
} from "lucide-react";
import { notify } from "@/lib/notify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { calculateSubjectScore, getKKTPPredicate } from "@/lib/utils/kktpCalculationUtils";
import { KKTPConfigModal, ConfiguredTPItem } from "./KKTPConfigModal";
import { KKTPStudentReportSheet, StudentKKTPReportData } from "./KKTPStudentReportSheet";
import { PrintBrowserHint } from "@/components/print/PrintBrowserHint";
import { AIUsageStatus } from "@/components/ai/AIUsageStatus";

export interface KKTPMatrixStudentRow {
  student_id: string;
  student_name: string;
  student_nisn: string | null;
  gender?: string | null;
  scores: Record<
    string,
    {
      score: number | null;
      evidence_status?: string | null;
      reflection?: string | null;
    }
  >;
  summary: {
    average_score: number | null;
    predicate: string | null;
    predicate_code?: string;
    predicate_color?: string;
    competency_description?: string | null;
    catatan_tutor?: string | null;
  };
}

interface KKTPMatrixGradebookProps {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  onBack: () => void;
}

export function KKTPMatrixGradebook({
  classId,
  className,
  subjectId,
  subjectName,
  onBack,
}: KKTPMatrixGradebookProps) {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<any>(null);
  const [tps, setTps] = useState<ConfiguredTPItem[]>([]);
  const [students, setStudents] = useState<KKTPMatrixStudentRow[]>([]);

  // Editing state for scores: studentId -> tpId -> numeric score string
  const [scoreInputs, setScoreInputs] = useState<Record<string, Record<string, string>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false);

  // Browser beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Modals & Print
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [printData, setPrintData] = useState<StudentKKTPReportData | null>(null);
  const [batchPrintData, setBatchPrintData] = useState<StudentKKTPReportData[] | null>(null);
  const [tpToDeleteFromMatrix, setTpToDeleteFromMatrix] = useState<ConfiguredTPItem | null>(null);
  const [deletingMatrixTp, setDeletingMatrixTp] = useState(false);

  // Institutional Settings & Letterhead State
  const [schoolSettings, setSchoolSettings] = useState<Record<string, any>>({});
  const [letterheadVersions, setLetterheadVersions] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/v1/app-settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setSchoolSettings(json.data);
          if (json.data.letterhead_versions) {
            try {
              const parsed = JSON.parse(json.data.letterhead_versions);
              if (Array.isArray(parsed)) setLetterheadVersions(parsed);
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, []);

  const resolvedLetterheadUrl = useMemo(() => {
    if (assessment?.letterhead_version_id && letterheadVersions.length > 0) {
      const matched = letterheadVersions.find((v) => v.id === assessment.letterhead_version_id);
      if (matched?.url) return matched.url;
    }
    return schoolSettings?.active_letterhead_url || "/branding/school-letterhead.png";
  }, [assessment?.letterhead_version_id, letterheadVersions, schoolSettings]);

  // Load matrix from API
  const loadMatrixData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get or create assessment
      const assRes = await fetch("/api/v1/kktp/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, subject_id: subjectId }),
      });
      const assJson = await assRes.json();
      if (!assJson.success || !assJson.data) {
        notify.error(assJson.message || "Gagal memuat sesi asesmen KKTP.");
        setLoading(false);
        return;
      }

      const activeAssessment = assJson.data;
      setAssessment(activeAssessment);

      // 2. Fetch full matrix
      const matrixRes = await fetch(`/api/v1/kktp/assessments/${activeAssessment.id}/matrix`);
      const matrixJson = await matrixRes.json();
      if (matrixJson.success && matrixJson.data) {
        const { tps: matrixTps, matrix: matrixStudents } = matrixJson.data;
        setTps(matrixTps || []);
        setStudents(matrixStudents || []);

        // Initialize scoreInputs
        const initialInputs: Record<string, Record<string, string>> = {};
        for (const s of matrixStudents || []) {
          initialInputs[s.student_id] = {};
          for (const tp of matrixTps || []) {
            const rawScore = s.scores?.[tp.id]?.score;
            initialInputs[s.student_id][tp.id] =
              rawScore !== null && rawScore !== undefined ? String(rawScore) : "";
          }
        }
        setScoreInputs(initialInputs);
        setIsDirty(false);
        setSaveStatus("idle");
      }
    } catch {
      notify.error("Terjadi kendala saat memuat matriks KKTP.");
    } finally {
      setLoading(false);
    }
  }, [classId, subjectId]);

  const handleDeleteTpFromMatrix = async () => {
    if (!tpToDeleteFromMatrix || !assessment?.id) return;
    setDeletingMatrixTp(true);
    try {
      const remaining = tps
        .filter((t) => t.id !== tpToDeleteFromMatrix.id)
        .map((t, idx) => {
          const isAuto = !t.tp_code || /^TP-\d+$/i.test(t.tp_code.trim());
          return {
            ...t,
            tp_code: isAuto ? `TP-${String(idx + 1).padStart(2, "0")}` : t.tp_code,
            order_index: idx + 1,
          };
        });

      const res = await fetch(`/api/v1/kktp/assessments/${assessment.id}/tps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remaining),
      });
      const json = await res.json();
      if (!json.success) {
        notify.error(json.message || "Gagal menghapus TP dari asesmen.");
        return;
      }

      notify.success(`TP "${tpToDeleteFromMatrix.tp_code || "TP"}" berhasil dihapus dari asesmen.`);
      setTpToDeleteFromMatrix(null);
      await loadMatrixData();
    } catch {
      notify.error("Terjadi kendala saat menghapus TP.");
    } finally {
      setDeletingMatrixTp(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        loadMatrixData();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadMatrixData]);

  // Handle score change in matrix cell
  const handleScoreChange = (studentId: string, tpId: string, value: string) => {
    // Sanitize: allow empty or numbers 0-100
    if (value !== "") {
      const num = Number(value);
      if (isNaN(num) || num < 0 || num > 100) return;
    }

    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [tpId]: value,
      },
    }));
    setIsDirty(true);
    setSaveStatus("idle");
  };

  // Keyboard navigation for spreadsheet-like efficiency (Enter / ArrowDown to next student)
  const handleScoreKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIdx: number,
    tpIdx: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextInput = document.getElementById(`score-cell-${studentIdx + 1}-${tpIdx}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevInput = document.getElementById(`score-cell-${studentIdx - 1}-${tpIdx}`);
      if (prevInput) (prevInput as HTMLInputElement).focus();
    }
  };

  // Safe back navigation handler
  const handleSafeBack = () => {
    if (isDirty) {
      setShowLeaveConfirmDialog(true);
    } else {
      onBack();
    }
  };

  // Compute live averages & predicates for rows
  const computedRows = useMemo(() => {
    return students.map((s) => {
      const studentScores = scoreInputs[s.student_id] || {};
      const numericScores = tps.map((tp) => {
        const strVal = studentScores[tp.id!];
        return strVal !== "" && strVal !== undefined ? Number(strVal) : null;
      });

      const calculatedAvg = calculateSubjectScore(numericScores);
      const predicate = getKKTPPredicate(calculatedAvg);

      return {
        ...s,
        calculatedAvg,
        predicate,
      };
    });
  }, [students, scoreInputs, tps]);

  // Save scores to API
  const handleSaveScores = async () => {
    if (!assessment) return;
    setSaveStatus("saving");

    try {
      const payload = students.map((s) => {
        const studentScoresMap = scoreInputs[s.student_id] || {};
        const scorePayloadObj: Record<string, { score: number | null; evidence_status: string | null }> = {};

        tps.forEach((tp) => {
          const raw = studentScoresMap[tp.id!];
          const scoreVal = raw !== "" && raw !== undefined ? Number(raw) : null;
          scorePayloadObj[tp.id!] = {
            score: scoreVal,
            evidence_status: scoreVal !== null ? (scoreVal >= 76 ? "SUFFICIENT" : "PARTIAL") : null,
          };
        });

        return {
          student_id: s.student_id,
          scores: scorePayloadObj,
        };
      });

      const res = await fetch(`/api/v1/kktp/assessments/${assessment.id}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentScores: payload }),
      });

      const json = await res.json();
      if (!json.success) {
        setSaveStatus("error");
        notify.error(json.message || "Gagal menyimpan nilai matriks KKTP.");
        return;
      }

      setSaveStatus("saved");
      setIsDirty(false);
      notify.success("Seluruh nilai KKTP kelas berhasil disimpan!");
      loadMatrixData();
    } catch {
      setSaveStatus("error");
      notify.error("Terjadi kendala saat menyimpan nilai.");
    }
  };

  // Individual student print preview
  const handlePreviewStudent = async (studentId: string) => {
    if (!assessment) return;
    try {
      const res = await fetch(
        `/api/v1/kktp/assessments/${assessment.id}/students/${studentId}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setPrintData(json.data);
      } else {
        notify.error(json.message || "Gagal memuat laporan murid.");
      }
    } catch {
      notify.error("Gagal memuat data cetak murid.");
    }
  };

  // Batch print all students
  const handleBatchPrint = async () => {
    if (!assessment || students.length === 0) return;
    const toastId = notify.loading("Menyiapkan dokumen cetak massal...");
    try {
      const reports: StudentKKTPReportData[] = [];
      for (const s of students) {
        const res = await fetch(
          `/api/v1/kktp/assessments/${assessment.id}/students/${s.student_id}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          reports.push(json.data);
        }
      }

      notify.dismiss(toastId);
      if (reports.length > 0) {
        setBatchPrintData(reports);
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        notify.error("Tidak ada data murid untuk dicetak.");
      }
    } catch {
      notify.dismiss(toastId);
      notify.error("Gagal menyiapkan cetak massal.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs text-zinc-500 font-medium">Memuat Matriks Penilaian KKTP...</p>
      </div>
    );
  }

  // Print view modes
  if (printData) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg print:hidden max-w-[210mm] mx-auto w-full">
          <Button variant="outline" size="sm" onClick={() => setPrintData(null)}>
            ← Kembali ke Matriks
          </Button>
          <Button size="sm" onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Cetak Dokumen
          </Button>
        </div>
        <PrintBrowserHint className="w-full max-w-[210mm] mx-auto print:hidden" />
        <KKTPStudentReportSheet
          data={printData}
          letterheadUrl={resolvedLetterheadUrl}
          schoolSettings={schoolSettings}
        />
      </div>
    );
  }

  if (batchPrintData) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg print:hidden max-w-[210mm] mx-auto w-full">
          <Button variant="outline" size="sm" onClick={() => setBatchPrintData(null)}>
            ← Kembali ke Matriks
          </Button>
          <Button size="sm" onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Cetak {batchPrintData.length} Dokumen
          </Button>
        </div>
        <PrintBrowserHint className="w-full max-w-[210mm] mx-auto print:hidden" />
        {batchPrintData.map((doc, idx) => (
          <KKTPStudentReportSheet
            key={doc.student.id}
            data={doc}
            letterheadUrl={resolvedLetterheadUrl}
            schoolSettings={schoolSettings}
            isPrintBreak={idx < batchPrintData.length - 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Context Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleSafeBack} className="h-7 w-7 p-0 -ml-1">
              ←
            </Button>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Gradebook KKTP: {subjectName}
            </h2>
            <Badge variant="neutral" className="text-[10px] uppercase font-semibold">
              {assessment?.fase || "Fase C"}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 ml-6">
            Kelas {className} • {assessment?.semester_name} {assessment?.academic_year_name} • {students.length} Murid
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <AIUsageStatus compact />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfigModalOpen(true)}
            className="text-xs font-medium"
          >
            <Settings className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
            Kelola TP ({tps.length})
          </Button>

          {tps.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchPrint}
              className="text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
              Cetak Kelas
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSaveScores}
            disabled={saveStatus === "saving" || tps.length === 0}
            className={`text-xs font-semibold ${
              isDirty
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Menyimpan...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-200" />
                Tersimpan
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Simpan Nilai {isDirty && "•"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Warning banner if no TPs configured */}
      {tps.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Tujuan Pembelajaran (TP) belum dikonfigurasi</p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                Konfigurasikan TP sekali untuk seluruh kelas agar kolom penilaian murid tampil di matriks.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setConfigModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Konfigurasi TP Sekarang
          </Button>
        </div>
      )}

      {/* Main Gradebook Matrix Card */}
      <Card className="p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12 border-r border-zinc-200 dark:border-zinc-800">
                  No
                </th>
                <th className="py-3 px-4 min-w-[200px] border-r border-zinc-200 dark:border-zinc-800">
                  Nama Murid
                </th>

                {/* TP Columns */}
                {tps.map((tp, idx) => (
                  <th
                    key={tp.id}
                    className="py-3 px-2 text-center min-w-[110px] max-w-[140px] border-r border-zinc-200 dark:border-zinc-800 relative group"
                    title={tp.tp_text_snapshot}
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1 justify-center w-full">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {tp.tp_code || `TP-${String(idx + 1).padStart(2, "0")}`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTpToDeleteFromMatrix(tp);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-opacity"
                          title={`Hapus ${tp.tp_code || "TP ini"} dari asesmen`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-normal truncate max-w-[110px]">
                        {tp.tp_text_snapshot}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Subject Summary Columns */}
                <th className="py-3 px-3 text-center w-24 border-r border-zinc-200 dark:border-zinc-800 text-emerald-800 dark:text-emerald-400">
                  Rata-Rata
                </th>
                <th className="py-3 px-3 text-center w-28 border-r border-zinc-200 dark:border-zinc-800">
                  Predikat
                </th>
                <th className="py-3 px-3 text-center w-20">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {computedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tps.length + 5}
                    className="py-8 text-center text-zinc-500 font-medium"
                  >
                    Tidak ada murid aktif yang terdaftar di kelas ini.
                  </td>
                </tr>
              ) : (
                computedRows.map((row, idx) => (
                  <tr
                    key={row.student_id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-medium text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-800">
                      <div>
                        {row.student_name}
                        {row.student_nisn && (
                          <span className="block text-[10px] text-zinc-400 font-normal">
                            NISN: {row.student_nisn}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* TP Score Input Cells */}
                    {tps.map((tp, tpIdx) => {
                      const currentVal = scoreInputs[row.student_id]?.[tp.id!] ?? "";
                      const numVal = currentVal !== "" ? Number(currentVal) : null;
                      const isComplete = numVal !== null && numVal >= 76;

                      return (
                        <td
                          key={tp.id}
                          className="py-2 px-2 text-center border-r border-zinc-200 dark:border-zinc-800"
                        >
                          <div className="flex items-center justify-center">
                            <Input
                              id={`score-cell-${idx}-${tpIdx}`}
                              type="number"
                              min={0}
                              max={100}
                              value={currentVal}
                              onChange={(e) =>
                                handleScoreChange(row.student_id, tp.id!, e.target.value)
                              }
                              onKeyDown={(e) => handleScoreKeyDown(e, idx, tpIdx)}
                              placeholder="-"
                              className={`h-8 w-16 text-center text-xs font-bold transition-all ${
                                currentVal === ""
                                  ? "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400"
                                  : isComplete
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                              }`}
                            />
                          </div>
                        </td>
                      );
                    })}

                    {/* Subject Average Column */}
                    <td className="py-2.5 px-3 text-center font-bold text-sm text-emerald-700 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-800">
                      {row.calculatedAvg !== null ? row.calculatedAvg : "-"}
                    </td>

                    {/* Predicate Badge */}
                    <td className="py-2.5 px-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${row.predicate.colorClass}`}
                      >
                        {row.predicate.label}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-2 px-2 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-zinc-600 hover:text-zinc-900"
                        onClick={() => handlePreviewStudent(row.student_id)}
                        title="Lihat / Cetak KKTP Murid"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* TP Configuration Modal */}
      {assessment && (
        <KKTPConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          assessmentId={assessment.id}
          subjectId={subjectId}
          subjectName={subjectName}
          className={className}
          fase={assessment.fase}
          initialTps={tps}
          onTpsSaved={loadMatrixData}
        />
      )}

      {/* Direct Delete TP from Matrix Confirmation */}
      <ConfirmDialog
        open={tpToDeleteFromMatrix !== null}
        onOpenChange={(open) => !open && setTpToDeleteFromMatrix(null)}
        title="Hapus TP dari Asesmen?"
        description={`Apakah Anda yakin ingin menghapus "${tpToDeleteFromMatrix?.tp_code || "TP ini"}" dari asesmen ini? Menghapus TP ini akan menghapus seluruh data nilai murid pada kolom ini secara permanen.`}
        confirmLabel="Ya, Hapus TP"
        cancelLabel="Batal"
        variant="destructive"
        loading={deletingMatrixTp}
        onConfirm={handleDeleteTpFromMatrix}
      />

      {/* Unsaved Changes In-App Navigation Guard */}
      <Dialog open={showLeaveConfirmDialog} onOpenChange={setShowLeaveConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <DialogTitle className="text-base font-bold">Simpan Perubahan Nilai?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-500 pt-1 leading-relaxed">
              Terdapat perubahan nilai murid yang belum disimpan ke database. Jika keluar sekarang, nilai yang baru saja Anda ubah akan hilang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLeaveConfirmDialog(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowLeaveConfirmDialog(false);
                onBack();
              }}
            >
              Keluar Tanpa Menyimpan
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={async () => {
                await handleSaveScores();
                setShowLeaveConfirmDialog(false);
                onBack();
              }}
            >
              Simpan & Keluar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
