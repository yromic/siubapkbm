"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurriculumBankModal, SelectedTPPayload } from "@/components/curriculum/CurriculumBankModal";
import {
  TrisulaStudentReportSheet,
  TrisulaStudentReportData,
} from "@/components/trisula/TrisulaStudentReportSheet";
import {
  Loader2,
  Plus,
  FileText,
  Printer,
  Sparkles,
  Save,
  BookOpen,
  Calculator,
  HeartHandshake,
  Table as TableIcon,
  Check,
  User,
  SlidersHorizontal,
  LayoutGrid,
  AlertTriangle,
  X,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { resolvePhaseByClassLevel, getScoreCategory } from "@/lib/utils/academicUtils";
import { useAuth } from "@/hooks/useAuth";

interface ClassOption {
  id: string;
  name: string;
  level?: number;
}

export default function TrisulaPage() {
  const { user } = useAuth();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"GRADEBOOK" | "MATRIX" | "REPORT" | "CURRICULUM">("GRADEBOOK");

  // Gradebook View Mode: 'CARD' (Mobile First default) vs 'TABLE' (Desktop Tabular)
  const [viewMode, setViewMode] = useState<"CARD" | "TABLE">("CARD");

  // Master Data
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedClassName, setSelectedClassName] = useState<string>("Kelas 4");
  const [selectedClassLevel, setSelectedClassLevel] = useState<number>(4);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(true);
  const [loadingContext, setLoadingContext] = useState<boolean>(true);

  // Assessment & Gradebook State
  const [assessment, setAssessment] = useState<any>(null);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [gradebook, setGradebook] = useState<any[]>([]);
  const [savingGradebook, setSavingGradebook] = useState<boolean>(false);

  // Modals & Drawers
  const [bankModalOpen, setBankModalOpen] = useState<boolean>(false);
  const [bankModalPillar, setBankModalPillar] = useState<"LITERASI" | "NUMERASI" | "DINIYYAH">("LITERASI");

  // AI Observation & Detail Modal
  const [activeStudentDetail, setActiveStudentDetail] = useState<any | null>(null);
  const [observationPillar, setObservationPillar] = useState<"LITERASI" | "NUMERASI" | "DINIYYAH">("LITERASI");
  const [observationText, setObservationText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<any | null>(null);

  // Individual Report Modal / Sheet State (Primary Flow)
  const [individualReportOpen, setIndividualReportOpen] = useState<boolean>(false);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string>("");
  const [reportData, setReportData] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [savingReport, setSavingReport] = useState<boolean>(false);
  const [aiReportLoading, setAiReportLoading] = useState<boolean>(false);
  const [reportCatatan, setReportCatatan] = useState<string>("");
  const [reportPesan, setReportPesan] = useState<string>("");
  const [reportLitDesc, setReportLitDesc] = useState<string>("");
  const [reportNumDesc, setReportNumDesc] = useState<string>("");
  const [reportDinDesc, setReportDinDesc] = useState<string>("");
  const [reportActiveTab, setReportActiveTab] = useState<"PREVIEW" | "EDIT_NARRATIVE">("PREVIEW");

  // Bulk Print State (Secondary Flow)
  const [bulkPrintModalOpen, setBulkPrintModalOpen] = useState<boolean>(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState<boolean>(false);

  // Curriculum Browser Tab State
  const [curriculumCPs, setCurriculumCPs] = useState<any[]>([]);
  const [curriculumTPs, setCurriculumTPs] = useState<any[]>([]);
  const [syncingCurriculum, setSyncingCurriculum] = useState<boolean>(false);

  // Auto-resolve Fase — uses class level for BLC custom class names
  const resolvedFase = useMemo(() => resolvePhaseByClassLevel(selectedClassLevel), [selectedClassLevel]);

  // Derived Gradebook stats
  const completedStudentsCount = useMemo(() => {
    return gradebook.filter(
      (s) => s.literasi_score !== null && s.numerasi_score !== null && s.diniyyah_score !== null
    ).length;
  }, [gradebook]);

  const incompleteStudentsCount = gradebook.length - completedStudentsCount;

  // Load Real Classes from Database
  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await fetch("/api/v1/classes?status=active&limit=100");
      const json = await res.json();
      const items = Array.isArray(json.data?.data) ? json.data.data : Array.isArray(json.data) ? json.data : [];
      if (json.success && items.length > 0) {
        setClasses(items);
        if (!selectedClassId) {
          setSelectedClassId(items[0].id);
          setSelectedClassName(items[0].name);
          setSelectedClassLevel(items[0].level || 1);
        }
      }
    } catch {
      toast.error("Gagal memuat daftar kelas aktif.");
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedClassId]);

  // Load Assessment Session & Gradebook
  const fetchAssessmentSession = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoadingContext(true);
    try {
      const res = await fetch(`/api/v1/trisula/session?class_id=${encodeURIComponent(classId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setAssessment(json.data.assessment);
        setCurriculum(json.data.curriculum || []);
        setGradebook(json.data.gradebook || []);
      } else {
        toast.error(json.message || "Gagal memuat sesi asesmen Trisula.");
      }
    } catch {
      toast.error("Terjadi kendala saat memuat gradebook.");
    } finally {
      setLoadingContext(false);
    }
  }, []);

  // Load Curriculum for Browser Tab
  const fetchCurriculumTab = useCallback(async () => {
    try {
      const [cpRes, tpRes] = await Promise.all([
        fetch(`/api/v1/cp-bank?fase=${encodeURIComponent(resolvedFase)}`),
        fetch(`/api/v1/tp-bank?fase=${encodeURIComponent(resolvedFase)}`),
      ]);
      const [cpJson, tpJson] = await Promise.all([cpRes.json(), tpRes.json()]);
      if (cpJson.success) setCurriculumCPs(cpJson.data.items || []);
      if (tpJson.success) setCurriculumTPs(tpJson.data.items || []);
    } catch {
      // silent
    }
  }, [resolvedFase]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClassId) {
      fetchAssessmentSession(selectedClassId);
      fetchCurriculumTab();
    }
  }, [selectedClassId, fetchAssessmentSession, fetchCurriculumTab]);

  // Sync Trisula Standard
  const handleSyncTrisula = async () => {
    setSyncingCurriculum(true);
    try {
      const res = await fetch("/api/v1/cp-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_trisula" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Kurikulum standar Trisula BLC berhasil diselaraskan.");
        fetchCurriculumTab();
      }
    } catch {
      toast.error("Gagal menyinkronkan kurikulum.");
    } finally {
      setSyncingCurriculum(false);
    }
  };

  // Gradebook Score Change
  const handleScoreChange = (
    studentId: string,
    pillar: "literasi" | "numerasi" | "diniyyah",
    val: string
  ) => {
    const num = val === "" ? null : parseFloat(val);
    setGradebook((prev) =>
      prev.map((row) => {
        if (row.student_id === studentId) {
          const updated = {
            ...row,
            [`${pillar}_score`]: num,
          };
          const scores = [
            pillar === "literasi" ? num : updated.literasi_score,
            pillar === "numerasi" ? num : updated.numerasi_score,
            pillar === "diniyyah" ? num : updated.diniyyah_score,
          ].filter((s): s is number => typeof s === "number" && !isNaN(s));

          const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
          updated.overall_score = avg;
          return updated;
        }
        return row;
      })
    );
  };

  // Save All Gradebook Scores
  const handleSaveGradebook = async () => {
    if (!assessment?.id) {
      toast.error("Sesi asesmen belum siap.");
      return;
    }
    setSavingGradebook(true);
    try {
      const payload = {
        assessment_id: assessment.id,
        studentScores: gradebook.map((row) => ({
          student_id: row.student_id,
          student_enrollment_id: row.student_enrollment_id,
          scores: {
            literasi: row.literasi_score,
            numerasi: row.numerasi_score,
            diniyyah: row.diniyyah_score,
          },
          descriptions: {
            literasi: row.literasi_description,
            numerasi: row.numerasi_description,
            diniyyah: row.diniyyah_description,
          },
        })),
      };

      const res = await fetch("/api/v1/trisula/gradebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Nilai gradebook berhasil disimpan.");
        if (json.data?.gradebook) {
          setGradebook(json.data.gradebook);
        }
      } else {
        toast.error(json.message || "Gagal menyimpan nilai gradebook.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyimpan nilai.");
    } finally {
      setSavingGradebook(false);
    }
  };

  // Handle Add Curriculum TP to Assessment
  const handleCurriculumSelected = async (item: SelectedTPPayload) => {
    if (!assessment?.id) return;
    try {
      const newCurrItem = {
        pillar: bankModalPillar,
        cp_id: item.cpId || null,
        tp_id: item.tpId || "tp-" + Date.now(),
        cp_text_snapshot: item.cpTeks || null,
        tp_text_snapshot: item.teks,
      };

      const existingForPillar = curriculum.filter((c) => c.pillar !== bankModalPillar);
      const updatedCurriculum = [...existingForPillar, newCurrItem];

      const res = await fetch("/api/v1/trisula/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          curriculum: updatedCurriculum,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`TP untuk pilar ${bankModalPillar} berhasil diselaraskan.`);
        setCurriculum(json.data?.curriculum || updatedCurriculum);
      }
    } catch {
      toast.error("Gagal menyimpan pilihan kurikulum.");
    }
  };

  // AI Mode A: Evaluate Observation
  const handleEvaluateObservationAI = async () => {
    if (!observationText.trim()) {
      toast.error("Tuliskan catatan pengamatan guru terlebih dahulu.");
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    try {
      const pillarTPs = curriculum.filter((c) => c.pillar === observationPillar);
      const activeCP = pillarTPs[0]?.cp_text_snapshot || null;

      const res = await fetch("/api/v1/trisula/ai/evaluate-observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: activeStudentDetail.student_name,
          className: selectedClassName,
          fase: resolvedFase,
          pillar: observationPillar,
          cpText: activeCP,
          tps: pillarTPs.map((t) => ({ id: t.tp_id, teks: t.tp_text_snapshot })),
          observationText: observationText.trim(),
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAiResult(json.data);
        toast.success("Evaluasi pengamatan guru berhasil dirumuskan AI.");
      } else {
        toast.error(json.message || "Gagal memproses evaluasi AI.");
      }
    } catch {
      toast.error("Terjadi kendala jaringan saat menghubungi AI.");
    } finally {
      setAiLoading(false);
    }
  };

  // Apply AI Result to Active Student
  const handleApplyAiResult = () => {
    if (!aiResult || !activeStudentDetail) return;
    const pillarKey = observationPillar.toLowerCase() as "literasi" | "numerasi" | "diniyyah";
    handleScoreChange(
      activeStudentDetail.student_id,
      pillarKey,
      aiResult.nilai !== null ? String(aiResult.nilai) : ""
    );

    setGradebook((prev) =>
      prev.map((row) => {
        if (row.student_id === activeStudentDetail.student_id) {
          return {
            ...row,
            [`${pillarKey}_description`]: aiResult.deskripsi,
          };
        }
        return row;
      })
    );

    toast.success(`Hasil evaluasi AI diterapkan pada ${activeStudentDetail.student_name} (${observationPillar}).`);
    setActiveStudentDetail(null);
    setAiResult(null);
    setObservationText("");
  };

  // Load Report for Single Selected Student (Primary Flow)
  const openStudentReportModal = async (studentId: string) => {
    if (!assessment?.id || !studentId) return;
    setSelectedReportStudentId(studentId);
    setIndividualReportOpen(true);
    setLoadingReport(true);
    try {
      const res = await fetch(
        `/api/v1/trisula/report?assessment_id=${encodeURIComponent(assessment.id)}&student_id=${encodeURIComponent(studentId)}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setReportData(json.data);
        setReportCatatan(json.data.summary?.catatan_rangkuman || "");
        setReportPesan(json.data.summary?.pesan_orang_tua || "");
        setReportLitDesc(json.data.summary?.literasi_description || "");
        setReportNumDesc(json.data.summary?.numerasi_description || "");
        setReportDinDesc(json.data.summary?.diniyyah_description || "");
      }
    } catch {
      toast.error("Gagal memuat raport siswa.");
    } finally {
      setLoadingReport(false);
    }
  };

  // Synthesize Report with AI
  const handleSynthesizeReportAI = async () => {
    if (!reportData) return;
    setAiReportLoading(true);
    try {
      const res = await fetch("/api/v1/trisula/ai/synthesize-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: reportData.student?.full_name,
          className: selectedClassName,
          fase: resolvedFase,
          scores: {
            literasi: reportData.summary?.literasi_score,
            numerasi: reportData.summary?.numerasi_score,
            diniyyah: reportData.summary?.diniyyah_score,
          },
          descriptions: {
            literasi: reportLitDesc,
            numerasi: reportNumDesc,
            diniyyah: reportDinDesc,
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setReportCatatan(json.data.catatanRangkuman);
        setReportPesan(json.data.pesanOrangTua);
        toast.success("Narasi rangkuman dan pesan orang tua berhasil dirumuskan AI.");
      } else {
        toast.error(json.message || "Gagal menyusun narasi AI.");
      }
    } catch {
      toast.error("Gagal menghubungi AI.");
    } finally {
      setAiReportLoading(false);
    }
  };

  // Save Report Narrative Changes
  const handleSaveReport = async () => {
    if (!assessment?.id || !selectedReportStudentId) return;
    setSavingReport(true);
    try {
      const res = await fetch("/api/v1/trisula/report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          student_id: selectedReportStudentId,
          catatan_rangkuman: reportCatatan,
          pesan_orang_tua: reportPesan,
          literasi_description: reportLitDesc,
          numerasi_description: reportNumDesc,
          diniyyah_description: reportDinDesc,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Raport Trisula santri berhasil disimpan.");
        // Refresh local gradebook narrative
        setGradebook((prev) =>
          prev.map((r) => {
            if (r.student_id === selectedReportStudentId) {
              return {
                ...r,
                catatan_rangkuman: reportCatatan,
                pesan_orang_tua: reportPesan,
                literasi_description: reportLitDesc,
                numerasi_description: reportNumDesc,
                diniyyah_description: reportDinDesc,
              };
            }
            return r;
          })
        );
        // Refresh report preview data
        if (reportData) {
          setReportData({
            ...reportData,
            summary: {
              ...reportData.summary,
              catatan_rangkuman: reportCatatan,
              pesan_orang_tua: reportPesan,
              literasi_description: reportLitDesc,
              numerasi_description: reportNumDesc,
              diniyyah_description: reportDinDesc,
            },
          });
        }
      } else {
        toast.error(json.message || "Gagal menyimpan raport.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyimpan raport.");
    } finally {
      setSavingReport(false);
    }
  };

  // Direct Print Single Student Report
  const handlePrintSingleReport = () => {
    window.print();
  };

  // Direct Print Bulk Class Reports
  const handleExecuteBulkPrint = () => {
    setBulkPrintModalOpen(false);
    setIsBulkPrinting(true);
    setTimeout(() => {
      window.print();
      setIsBulkPrinting(false);
    }, 300);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto pb-24 sm:pb-8">
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & MOBILE-FIRST CLASS / CONTEXT SELECTOR */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3 sm:pb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </span>
            Penilaian Trisula Terpadu
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Asesmen 3 Pilar (Literasi, Numerasi, Diniyyah) & Raport Akademik BLC.
          </p>
        </div>

        {/* Global Class & Phase Selector */}
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/90 p-1.5 sm:p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs">
          <span className="font-semibold text-zinc-600 dark:text-zinc-400 pl-1 text-[11px] sm:text-xs">Kelas:</span>
          {loadingClasses ? (
            <span className="text-xs text-zinc-400 flex items-center gap-1 px-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Memuat...
            </span>
          ) : classes.length === 0 ? (
            <span className="text-xs text-amber-600 px-2">Belum ada kelas aktif</span>
          ) : (
            <select
              value={selectedClassId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedClassId(cid);
                const found = classes.find((c) => c.id === cid);
                if (found) {
                  setSelectedClassName(found.name);
                  setSelectedClassLevel(found.level || 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
            {resolvedFase}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 2. MAIN TABS NAVIGATION */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("GRADEBOOK")}
          className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "GRADEBOOK"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <TableIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Penilaian Kelas
        </button>
        <button
          onClick={() => setActiveTab("MATRIX")}
          className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "MATRIX"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Matriks Nilai
        </button>
        <button
          onClick={() => {
            setActiveTab("REPORT");
            if (gradebook.length > 0 && !selectedReportStudentId) {
              openStudentReportModal(gradebook[0].student_id);
            }
          }}
          className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "REPORT"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Raport & Cetak
        </button>
        <button
          onClick={() => setActiveTab("CURRICULUM")}
          className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "CURRICULUM"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Kurikulum BLC
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CLASS GRADEBOOK (MOBILE-FIRST PRIMARY UX) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === "GRADEBOOK" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Selected Curriculum Cards per Pillar (Mobile Stacked, Desktop 3-Col) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {(["LITERASI", "NUMERASI", "DINIYYAH"] as const).map((p) => {
              const isLit = p === "LITERASI";
              const isNum = p === "NUMERASI";
              const icon = isLit ? (
                <BookOpen className="w-4 h-4 text-blue-600" />
              ) : isNum ? (
                <Calculator className="w-4 h-4 text-emerald-600" />
              ) : (
                <HeartHandshake className="w-4 h-4 text-amber-600" />
              );

              const pilarItems = curriculum.filter((c) => c.pillar === p);

              return (
                <div
                  key={p}
                  className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Pilar {p}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setBankModalPillar(p);
                        setBankModalOpen(true);
                      }}
                      className="h-7 text-[11px] px-2 text-emerald-700 dark:text-emerald-400 font-bold"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Sisip TP
                    </Button>
                  </div>

                  {pilarItems.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">Belum ada TP yang disisipkan untuk pilar ini.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pilarItems.map((ci, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug line-clamp-2"
                          title={ci.tp_text_snapshot}
                        >
                          <span className="font-bold text-zinc-400 mr-1">{idx + 1}.</span>
                          {ci.tp_text_snapshot}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gradebook Header with Actions & View Mode Toggle */}
          <div className="bg-white dark:bg-[#171717] rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Daftar Nilai Santri ({gradebook.length} Santri)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {completedStudentsCount}/{gradebook.length} Lengkap
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Input nilai (0–100), gunakan &quot;Bantu AI&quot; untuk catatan observasi, atau klik &quot;Raport&quot; untuk mencetak.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Toggle (Card vs Table) */}
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl text-xs">
                  <button
                    onClick={() => setViewMode("CARD")}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      viewMode === "CARD"
                        ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" /> Kartu
                  </button>
                  <button
                    onClick={() => setViewMode("TABLE")}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      viewMode === "TABLE"
                        ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <TableIcon className="w-3 h-3" /> Tabel
                  </button>
                </div>

                {/* Bulk Class Print Action */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkPrintModalOpen(true)}
                  disabled={loadingContext || gradebook.length === 0}
                  className="h-8 sm:h-9 text-xs"
                  title="Cetak semua lembar raport santri di kelas ini"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Semua Raport
                </Button>

                {/* Save All Scores Action */}
                <Button
                  onClick={handleSaveGradebook}
                  disabled={savingGradebook || loadingContext}
                  className="h-8 sm:h-9 bg-emerald-600 hover:bg-emerald-700 text-xs text-white font-bold"
                >
                  {savingGradebook ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Simpan Nilai
                </Button>
              </div>
            </div>

            {loadingContext ? (
              <div className="py-20 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : gradebook.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <User className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
                <p className="text-xs font-semibold text-zinc-500">
                  Tidak ada santri aktif yang terdaftar pada {selectedClassName}.
                </p>
              </div>
            ) : viewMode === "CARD" ? (
              /* ──────────────────────────────────────────────────────── */
              /* A. MOBILE-FIRST STACKED STUDENT CARDS (PRIMARY UX) */
              /* ──────────────────────────────────────────────────────── */
              <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {gradebook.map((row, idx) => {
                  const isComplete =
                    row.literasi_score !== null &&
                    row.numerasi_score !== null &&
                    row.diniyyah_score !== null;

                  const ovCat = getScoreCategory(row.overall_score);

                  return (
                    <div
                      key={row.student_id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all space-y-3 shadow-2xs"
                    >
                      {/* Card Header: Student Name & NISN */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-zinc-400">#{idx + 1}</span>
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {row.student_name}
                            </h4>
                          </div>
                          <span className="text-[10px] text-zinc-500 block">
                            NISN: {row.student_nisn || "-"} • {selectedClassName}
                          </span>
                        </div>

                        {/* Status Badge */}
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">
                            <Check className="w-2.5 h-2.5" /> Lengkap
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0">
                            Sebagian
                          </span>
                        )}
                      </div>

                      {/* Score Inputs (3 Pillars: Literasi, Numerasi, Diniyyah) */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {/* Literasi */}
                        <div className="p-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-1">
                          <span className="text-[10px] font-bold text-blue-900 dark:text-blue-300 flex items-center justify-center gap-1">
                            <BookOpen className="w-3 h-3 text-blue-600" /> Literasi
                          </span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={row.literasi_score ?? ""}
                            onChange={(e) => handleScoreChange(row.student_id, "literasi", e.target.value)}
                            placeholder="—"
                            className="h-8 text-xs text-center font-bold bg-white dark:bg-zinc-800"
                          />
                        </div>

                        {/* Numerasi */}
                        <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                          <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 flex items-center justify-center gap-1">
                            <Calculator className="w-3 h-3 text-emerald-600" /> Numerasi
                          </span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={row.numerasi_score ?? ""}
                            onChange={(e) => handleScoreChange(row.student_id, "numerasi", e.target.value)}
                            placeholder="—"
                            className="h-8 text-xs text-center font-bold bg-white dark:bg-zinc-800"
                          />
                        </div>

                        {/* Diniyyah */}
                        <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 space-y-1">
                          <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 flex items-center justify-center gap-1">
                            <HeartHandshake className="w-3 h-3 text-amber-600" /> Diniyyah
                          </span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={row.diniyyah_score ?? ""}
                            onChange={(e) => handleScoreChange(row.student_id, "diniyyah", e.target.value)}
                            placeholder="—"
                            className="h-8 text-xs text-center font-bold bg-white dark:bg-zinc-800"
                          />
                        </div>
                      </div>

                      {/* Average & Category Row */}
                      <div className="flex items-center justify-between text-xs px-1 py-0.5 border-t border-zinc-200/60 dark:border-zinc-800 pt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-zinc-500 font-medium">Rata-rata:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {row.overall_score !== null ? row.overall_score : "—"}
                          </span>
                        </div>
                        {ovCat && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ovCat.colorClass}`}>
                            {ovCat.label}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons: [Raport] (Primary!), [Bantu AI], [Detail] */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setActiveStudentDetail(row);
                            setObservationText("");
                            setAiResult(null);
                          }}
                          className="h-8 text-[11px] px-2"
                          title="Bantu evaluasi observasi murid dengan AI"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600 mr-1" /> Bantu AI
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => openStudentReportModal(row.student_id)}
                          className="h-8 text-[11px] px-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 text-white dark:text-zinc-900 font-bold"
                          title="Lihat dan Cetak Raport Trisula Murid Ini"
                        >
                          <FileText className="w-3 h-3 mr-1 text-emerald-400" /> Raport
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ──────────────────────────────────────────────────────── */
              /* B. DESKTOP TABULAR VIEW (SECONDARY ENHANCEMENT) */
              /* ──────────────────────────────────────────────────────── */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 w-10">#</th>
                      <th className="py-3 px-4 min-w-[180px]">Nama Santri</th>
                      <th className="py-3 px-4 w-28">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Literasi
                        </span>
                      </th>
                      <th className="py-3 px-4 w-28">
                        <span className="inline-flex items-center gap-1">
                          <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Numerasi
                        </span>
                      </th>
                      <th className="py-3 px-4 w-28">
                        <span className="inline-flex items-center gap-1">
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-600" /> Diniyyah
                        </span>
                      </th>
                      <th className="py-3 px-4 w-24 text-center">Rata-rata</th>
                      <th className="py-3 px-4 w-28 text-center">Status</th>
                      <th className="py-3 px-4 w-36 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {gradebook.map((row, idx) => {
                      const isComplete =
                        row.literasi_score !== null &&
                        row.numerasi_score !== null &&
                        row.diniyyah_score !== null;

                      return (
                        <tr key={row.student_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                          <td className="py-3 px-4 text-zinc-400 font-medium">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                              {row.student_name}
                            </span>
                            <span className="text-[10px] text-zinc-400">NISN: {row.student_nisn || "-"}</span>
                          </td>

                          {/* Literasi */}
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={row.literasi_score ?? ""}
                              onChange={(e) => handleScoreChange(row.student_id, "literasi", e.target.value)}
                              placeholder="—"
                              className="h-8 text-xs text-center font-bold"
                            />
                          </td>

                          {/* Numerasi */}
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={row.numerasi_score ?? ""}
                              onChange={(e) => handleScoreChange(row.student_id, "numerasi", e.target.value)}
                              placeholder="—"
                              className="h-8 text-xs text-center font-bold"
                            />
                          </td>

                          {/* Diniyyah */}
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              value={row.diniyyah_score ?? ""}
                              onChange={(e) => handleScoreChange(row.student_id, "diniyyah", e.target.value)}
                              placeholder="—"
                              className="h-8 text-xs text-center font-bold"
                            />
                          </td>

                          {/* Overall Average */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                              {row.overall_score !== null ? row.overall_score : "—"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <Check className="w-3 h-3" /> Lengkap
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                Sebagian
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setActiveStudentDetail(row);
                                  setObservationText("");
                                  setAiResult(null);
                                }}
                                className="h-7 text-[11px] px-2"
                                title="Bantu AI"
                              >
                                <Sparkles className="w-3 h-3 text-purple-600" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openStudentReportModal(row.student_id)}
                                className="h-7 text-[11px] px-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                                title="Cetak Raport Murid Ini"
                              >
                                <FileText className="w-3 h-3 mr-1" /> Raport
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: MATRIKS EVALUASI TRISULA */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === "MATRIX" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#171717] rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="p-3.5 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Matriks Evaluasi Trisula ({selectedClassName})</h3>
                <p className="text-xs text-zinc-500">
                  Rekapitulasi pencapaian 3 Pilar seluruh santri yang tersimpan di database.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="text-xs h-8"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Matriks
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4 w-10">#</th>
                    <th className="py-3 px-4 min-w-[180px]">Nama Santri</th>
                    <th className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Literasi
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1">
                        <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Numerasi
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1">
                        <HeartHandshake className="w-3.5 h-3.5 text-amber-600" /> Diniyyah
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center">Rata-rata</th>
                    <th className="py-3 px-4 text-center">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {gradebook.map((row, idx) => {
                    const avg = row.overall_score;
                    const cat = getScoreCategory(avg);

                    return (
                      <tr key={row.student_id} className="hover:bg-zinc-50/50">
                        <td className="py-3 px-4 text-zinc-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold">{row.student_name}</td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {row.literasi_score !== null ? row.literasi_score : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {row.numerasi_score !== null ? row.numerasi_score : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {row.diniyyah_score !== null ? row.diniyyah_score : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700 dark:text-emerald-400">
                          {avg !== null ? avg : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cat ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.colorClass}`}>
                              {cat.label}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: RAPORT TRISULA TAB VIEW */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === "REPORT" && (
        <div className="space-y-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Pilih Santri:</span>
              <select
                value={selectedReportStudentId}
                onChange={(e) => openStudentReportModal(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold"
              >
                {gradebook.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.student_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkPrintModalOpen(true)}
                className="text-xs h-8"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Semua Kelas
              </Button>
              <Button
                size="sm"
                onClick={() => selectedReportStudentId && openStudentReportModal(selectedReportStudentId)}
                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> Buka Lembar Raport A4
              </Button>
            </div>
          </div>

          {reportData && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 bg-zinc-100/50 dark:bg-zinc-900/50 flex justify-center">
              <TrisulaStudentReportSheet
                data={{
                  assessment: {
                    id: assessment?.id || "",
                    class_name: selectedClassName,
                    academic_year_name: assessment?.academic_year_name || "2026/2027",
                    semester_name: assessment?.semester_name || "Semester Ganjil",
                    fase: resolvedFase,
                  },
                  student: reportData.student,
                  summary: reportData.summary,
                  tutorName: user?.name || "Tutor Kelas Trisula",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: KURIKULUM TRISULA BLC */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === "CURRICULUM" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold">Standar Kurikulum Trisula BLC ({resolvedFase})</h3>
              <p className="text-xs text-zinc-500">
                Pondasi CP dan TP terpadu untuk jenjang {selectedClassName}.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncTrisula}
              disabled={syncingCurriculum}
              className="text-xs"
            >
              {syncingCurriculum ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" />
              )}
              Sinkronkan Standar BLC
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(["Literasi", "Numerasi", "Diniyyah"] as const).map((domain) => {
              const domainCP = curriculumCPs.find(
                (c) =>
                  (c.domain_trisula === domain || c.mata_pelajaran_name === domain) &&
                  c.fase === resolvedFase
              );
              const domainTPs = curriculumTPs.filter(
                (t) =>
                  (t.mata_pelajaran_name === domain || t.cp_kode?.includes(domain.slice(0, 3).toUpperCase())) &&
                  t.fase === resolvedFase
              );

              return (
                <div
                  key={domain}
                  className="bg-white dark:bg-[#171717] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 space-y-3 shadow-xs"
                >
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Pilar {domain} ({domainTPs.length} TP)
                  </h4>
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border text-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                      Capaian Pembelajaran:
                    </span>
                    <p className="text-zinc-800 dark:text-zinc-200 italic leading-relaxed">
                      {domainCP?.teks || `Belum ada CP terdaftar untuk ${domain}.`}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1 text-xs">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-400 block text-[11px]">
                      Daftar Tujuan Pembelajaran:
                    </span>
                    {domainTPs.map((tp, idx) => (
                      <div
                        key={tp.id}
                        className="p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 leading-snug"
                      >
                        <span className="font-semibold text-zinc-400 mr-1">{idx + 1}.</span>
                        {tp.teks}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 4. STICKY MOBILE ACTION BAR (STAYS REACHABLE ON SMALL SCREENS) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#171717] border-t border-zinc-200 dark:border-zinc-800 p-3 shadow-lg flex items-center justify-between gap-2 print:hidden">
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-zinc-500 block">Status Kelas</span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate block">
            {completedStudentsCount}/{gradebook.length} Nilai Lengkap
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkPrintModalOpen(true)}
            className="h-10 text-xs px-2.5 font-bold"
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={handleSaveGradebook}
            disabled={savingGradebook || loadingContext}
            className="h-10 text-xs px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {savingGradebook ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Simpan Nilai
          </Button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: INDIVIDUAL STUDENT REPORT & A4 PREVIEW (PRIMARY FLOW) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {individualReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto animate-fadeIn print:hidden">
          <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50 truncate">
                    Raport Trisula: {reportData?.student?.full_name || "Memuat..."}
                  </h3>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {selectedClassName} • {assessment?.semester_name || "Semester Ganjil"} {assessment?.academic_year_name || "2026/2027"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePrintSingleReport}
                  className="h-8 sm:h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Raport
                </Button>
                <button
                  onClick={() => setIndividualReportOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-tabs: Pratinjau A4 vs Edit Narasi Raport */}
            <div className="px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 flex gap-2 pt-2 bg-zinc-50/30 dark:bg-zinc-900/30">
              <button
                onClick={() => setReportActiveTab("PREVIEW")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  reportActiveTab === "PREVIEW"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Lembar Raport A4
              </button>
              <button
                onClick={() => setReportActiveTab("EDIT_NARRATIVE")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  reportActiveTab === "EDIT_NARRATIVE"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Edit Narasi & Catatan
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-zinc-100/60 dark:bg-zinc-950/40">
              {loadingReport ? (
                <div className="py-24 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : reportData ? (
                reportActiveTab === "PREVIEW" ? (
                  /* A4 Paper Preview */
                  <div className="flex justify-center">
                    <TrisulaStudentReportSheet
                      data={{
                        assessment: {
                          id: assessment?.id || "",
                          class_name: selectedClassName,
                          academic_year_name: assessment?.academic_year_name || "2026/2027",
                          semester_name: assessment?.semester_name || "Semester Ganjil",
                          fase: resolvedFase,
                        },
                        student: reportData.student,
                        summary: {
                          ...reportData.summary,
                          catatan_rangkuman: reportCatatan,
                          pesan_orang_tua: reportPesan,
                          literasi_description: reportLitDesc,
                          numerasi_description: reportNumDesc,
                          diniyyah_description: reportDinDesc,
                        },
                        tutorName: user?.name || "Tutor Kelas Trisula",
                      }}
                    />
                  </div>
                ) : (
                  /* Narrative & Synthesis Editor */
                  <div className="max-w-2xl mx-auto space-y-4 bg-white dark:bg-[#171717] p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          Pengaturan Narasi Raport
                        </h4>
                        <p className="text-[11px] text-zinc-500">
                          Sesuaikan deskripsi capaian 3 pilar dan pesan kemitraan orang tua murid.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSynthesizeReportAI}
                        disabled={aiReportLoading}
                        className="text-xs h-8"
                      >
                        {aiReportLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 mr-1" />
                        )}
                        Bantu AI
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="font-bold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Deskripsi Capaian Literasi:</span>
                        </label>
                        <Textarea
                          value={reportLitDesc}
                          onChange={(e) => setReportLitDesc(e.target.value)}
                          placeholder="Deskripsi kemampuan membaca dan pemahaman teks..."
                          rows={3}
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-emerald-900 dark:text-emerald-300 mb-1 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Deskripsi Capaian Numerasi:</span>
                        </label>
                        <Textarea
                          value={reportNumDesc}
                          onChange={(e) => setReportNumDesc(e.target.value)}
                          placeholder="Deskripsi kemampuan berhitung dan penalaran logis..."
                          rows={3}
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                          <span>Deskripsi Capaian Diniyyah:</span>
                        </label>
                        <Textarea
                          value={reportDinDesc}
                          onChange={(e) => setReportDinDesc(e.target.value)}
                          placeholder="Deskripsi adab, ibadah harian, dan karakter fitrah..."
                          rows={3}
                          className="text-xs"
                        />
                      </div>

                      <div className="border-t pt-3">
                        <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                          Catatan & Rekomendasi Perkembangan Murid:
                        </label>
                        <Textarea
                          value={reportCatatan}
                          onChange={(e) => setReportCatatan(e.target.value)}
                          placeholder="Catatan menyeluruh guru terhadap perkembangan anak..."
                          rows={3}
                          className="text-xs"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-zinc-800 dark:text-zinc-200 block mb-1">
                          Pesan Penguatan di Rumah (Kemitraan Orang Tua):
                        </label>
                        <Textarea
                          value={reportPesan}
                          onChange={(e) => setReportPesan(e.target.value)}
                          placeholder="Pesan saran pendampingan Ayah/Bunda di rumah..."
                          rows={3}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-3 flex justify-end gap-2 border-t">
                      <Button
                        size="sm"
                        onClick={handleSaveReport}
                        disabled={savingReport}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
                      >
                        {savingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        Simpan Narasi Raport
                      </Button>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: BULK CLASS PRINT CONFIRMATION (SECONDARY FLOW) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {bulkPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Cetak Semua Raport Kelas
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {selectedClassName} • {gradebook.length} Santri Terdaftar
                  </p>
                </div>
              </div>

              {incompleteStudentsCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    Perhatian: <strong>{incompleteStudentsCount} santri</strong> belum memiliki nilai 3 pilar lengkap. Lanjutkan cetak dengan data yang ada?
                  </p>
                </div>
              )}

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Sistem akan menyusun lembar raport resmi A4 untuk setiap santri secara berurutan dengan pemisah halaman otomatis (1 santri per halaman).
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setBulkPrintModalOpen(false)}
                  className="text-xs h-9"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecuteBulkPrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Ya, Cetak {gradebook.length} Raport
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: BANTU AI EVALUASI PENGAMATAN GURU */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  Bantu Evaluasi AI: {activeStudentDetail.student_name}
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Evaluasi catatan observasi guru secara otomatis terhadap TP Kurikulum.
                </p>
              </div>
              <button
                onClick={() => setActiveStudentDetail(null)}
                className="text-zinc-400 hover:text-zinc-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Pilih Pilar Observasi:
                </label>
                <div className="flex gap-2">
                  {(["LITERASI", "NUMERASI", "DINIYYAH"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setObservationPillar(p)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        observationPillar === p
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Catatan Pengamatan / Bukti Belajar Guru:
                </label>
                <Textarea
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  placeholder="Contoh: Ananda mampu membaca teks modul dengan lancar, memahami pesan cerita, dan menunjukkan adab yang sangat tenang..."
                  rows={4}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleEvaluateObservationAI}
                  disabled={aiLoading || !observationText.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-9"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Analisis dengan AI
                </Button>
              </div>

              {/* AI Result Preview */}
              {aiResult && (
                <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 dark:text-purple-300">
                      Hasil Evaluasi AI ({aiResult.evidenceStatus}):
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100">
                      Skor Rekomendasi: {aiResult.nilai !== null ? aiResult.nilai : "Null"}
                    </span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                    &quot;{aiResult.deskripsi}&quot;
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Alasan: {aiResult.evidenceReason}
                  </p>

                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleApplyAiResult}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Terapkan ke Nilai
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Curriculum Bank Selector Modal */}
      <CurriculumBankModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        initialClassName={selectedClassName}
        initialFase={resolvedFase}
        title={`Sisip Tujuan Pembelajaran (Pilar ${bankModalPillar})`}
        onSelectTP={(selected) => {
          handleCurriculumSelected(selected);
          setBankModalOpen(false);
        }}
      />

      {/* Print-Only Single Student Report Container (Rendered cleanly during single student window.print) */}
      {individualReportOpen && reportData && !isBulkPrinting && (
        <div className="hidden print:block print:w-full print:m-0 print:p-0">
          <TrisulaStudentReportSheet
            data={{
              assessment: {
                id: assessment?.id || "",
                class_name: selectedClassName,
                academic_year_name: assessment?.academic_year_name || "2026/2027",
                semester_name: assessment?.semester_name || "Semester Ganjil",
                fase: resolvedFase,
              },
              student: reportData.student,
              summary: {
                ...reportData.summary,
                catatan_rangkuman: reportCatatan,
                pesan_orang_tua: reportPesan,
                literasi_description: reportLitDesc,
                numerasi_description: reportNumDesc,
                diniyyah_description: reportDinDesc,
              },
              tutorName: user?.name || "Tutor Kelas Trisula",
            }}
          />
        </div>
      )}

      {/* Print-Only Bulk Class Reports Container (Rendered with page breaks during bulk window.print) */}
      {isBulkPrinting && (
        <div className="hidden print:block print:w-full print:m-0 print:p-0">
          {gradebook.map((row) => (
            <TrisulaStudentReportSheet
              key={row.student_id}
              isPrintBreak={true}
              data={{
                assessment: {
                  id: assessment?.id || "",
                  class_name: selectedClassName,
                  academic_year_name: assessment?.academic_year_name || "2026/2027",
                  semester_name: assessment?.semester_name || "Semester Ganjil",
                  fase: resolvedFase,
                },
                student: {
                  id: row.student_id,
                  full_name: row.student_name,
                  nisn: row.student_nisn,
                  gender: row.gender,
                },
                summary: {
                  literasi_score: row.literasi_score,
                  numerasi_score: row.numerasi_score,
                  diniyyah_score: row.diniyyah_score,
                  overall_score: row.overall_score,
                  literasi_description: row.literasi_description,
                  numerasi_description: row.numerasi_description,
                  diniyyah_description: row.diniyyah_description,
                  catatan_rangkuman: row.catatan_rangkuman,
                  pesan_orang_tua: row.pesan_orang_tua,
                },
                tutorName: user?.name || "Tutor Kelas Trisula",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
