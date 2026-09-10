"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurriculumBankModal, SelectedTPPayload } from "@/components/curriculum/CurriculumBankModal";
import {
  TrisulaStudentReportSheet,
  TrisulaStudentReportData,
} from "@/components/trisula/TrisulaStudentReportSheet";
import { PageContainer, PageSection } from "@/components/ui/page-framework";
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
  School,
  ArrowLeft,
  BarChart3,
  Search,
  CheckCircle2,
  Users,
  Clock,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { resolvePhaseByClassLevel, getScoreCategory } from "@/lib/utils/academicUtils";
import { filterTrisulaNativeCPs, filterTrisulaNativeTPs } from "@/lib/utils/curriculumFilterUtils";
import { fetchBankCPs, fetchBankTPs } from "@/lib/api/curriculumBankClient";
import { useAuth } from "@/hooks/useAuth";

interface ClassOption {
  id: string;
  name: string;
  level?: number;
}

interface TrisulaClassSummary {
  class_id: string;
  class_name: string;
  class_code: string;
  class_level: number;
  fase: string;
  student_count: number;
  assessment_id: string | null;
  literasi_count: number;
  numerasi_count: number;
  diniyyah_count: number;
  complete_count: number;
  has_assessment: boolean;
}

export default function TrisulaPage() {
  const { user } = useAuth();

  // CLASS_LIST landing state
  const [trisulaView, setTrisulaView] = useState<'CLASS_LIST' | 'CLASS_DETAIL'>('CLASS_LIST');
  const [classSummaries, setClassSummaries] = useState<TrisulaClassSummary[]>([]);
  const [classSummaryLoading, setClassSummaryLoading] = useState(true);
  const [classSearch, setClassSearch] = useState('');

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"GRADEBOOK" | "MATRIX" | "REPORT" | "CURRICULUM">("GRADEBOOK");

  // Gradebook View Mode: 'CARD' (Mobile First default) vs 'TABLE' (Desktop Tabular)
  const [viewMode, setViewMode] = useState<"CARD" | "TABLE">("TABLE");

  // Master Data
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedClassName, setSelectedClassName] = useState<string>("Kelas 4");
  const [selectedClassLevel, setSelectedClassLevel] = useState<number>(4);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(false);
  const [loadingContext, setLoadingContext] = useState<boolean>(false);

  // Assessment & Gradebook State
  const [assessment, setAssessment] = useState<any>(null);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [gradebook, setGradebook] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [savingGradebook, setSavingGradebook] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

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

  // Filtered Class Summaries on landing
  const displayedClassSummaries = useMemo(() => {
    if (!classSearch.trim()) return classSummaries;
    const q = classSearch.toLowerCase();
    return classSummaries.filter(
      (c) => c.class_name.toLowerCase().includes(q) || (c.class_code && c.class_code.toLowerCase().includes(q))
    );
  }, [classSummaries, classSearch]);

  // Filtered Gradebook Students
  const displayedGradebook = useMemo(() => {
    if (!studentSearch.trim()) return gradebook;
    const q = studentSearch.toLowerCase();
    return gradebook.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        (s.student_nisn && s.student_nisn.toLowerCase().includes(q))
    );
  }, [gradebook, studentSearch]);

  // Desktop Aggregate Statistics on Landing (cheap client calculation)
  const desktopStats = useMemo(() => {
    const totalClasses = classSummaries.length;
    let totalStudents = 0;
    let totalComplete = 0;
    let totalLiterasi = 0;
    let totalNumerasi = 0;
    let totalDiniyyah = 0;

    classSummaries.forEach((c) => {
      totalStudents += c.student_count || 0;
      totalComplete += c.complete_count || 0;
      totalLiterasi += c.literasi_count || 0;
      totalNumerasi += c.numerasi_count || 0;
      totalDiniyyah += c.diniyyah_count || 0;
    });

    const completionRate = totalStudents > 0 ? Math.round((totalComplete / totalStudents) * 100) : 0;

    return {
      totalClasses,
      totalStudents,
      totalComplete,
      completionRate,
      totalLiterasi,
      totalNumerasi,
      totalDiniyyah,
    };
  }, [classSummaries]);

  // Load Class Summaries for CLASS_LIST landing (role-scoped)
  const fetchClassSummaries = useCallback(async () => {
    setClassSummaryLoading(true);
    try {
      const res = await fetch('/api/v1/trisula/classes-summary');
      const json = await res.json();
      if (json.success) {
        const items = Array.isArray(json.data?.items)
          ? json.data.items
          : Array.isArray(json.data?.data)
          ? json.data.data
          : Array.isArray(json.data)
          ? json.data
          : [];
        setClassSummaries(items);
      } else {
        toast.error(json.message || 'Gagal memuat daftar kelas.');
      }
    } catch {
      toast.error('Terjadi kendala saat memuat kelas.');
    } finally {
      setClassSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClassSummaries();
  }, [fetchClassSummaries]);

  // Load Master Classes
  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        const res = await fetch("/api/v1/classes");
        const json = await res.json();
        if (json.success) {
          const items = Array.isArray(json.data?.data)
            ? json.data.data
            : Array.isArray(json.data?.items)
            ? json.data.items
            : Array.isArray(json.data)
            ? json.data
            : [];
          setClasses(items);
          if (items.length > 0 && !selectedClassId) {
            setSelectedClassId(items[0].id);
            setSelectedClassName(items[0].name);
            setSelectedClassLevel(items[0].level || 1);
          }
        }
      } catch {
        toast.error("Gagal memuat master kelas.");
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  // Fetch Assessment Session & Students for Selected Class
  const fetchAssessmentSession = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoadingContext(true);
    setHasUnsavedChanges(false);
    try {
      const res = await fetch(`/api/v1/trisula/session?class_id=${classId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setAssessment(json.data.assessment || null);
        setCurriculum(Array.isArray(json.data.curriculum) ? json.data.curriculum : []);
        setGradebook(Array.isArray(json.data.gradebook) ? json.data.gradebook : []);
      } else {
        toast.error(json.message || "Gagal memuat sesi penilaian kelas.");
      }
    } catch {
      toast.error("Terjadi kendala saat memuat data penilaian.");
    } finally {
      setLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId && trisulaView === 'CLASS_DETAIL') {
      fetchAssessmentSession(selectedClassId);
    }
  }, [selectedClassId, trisulaView, fetchAssessmentSession]);

  // Fetch Full Curriculum Bank for Phase & Class
  const fetchCurriculumBank = useCallback(async () => {
    try {
      const [cpRes, tpRes] = await Promise.all([
        fetchBankCPs({ fase: resolvedFase, limit: 100 }),
        fetchBankTPs({ fase: resolvedFase, limit: 100 }),
      ]);
      setCurriculumCPs(cpRes.items);
      setCurriculumTPs(tpRes.items);
    } catch (err) {
      console.error("Gagal memuat kurikulum:", err);
    }
  }, [resolvedFase]);

  useEffect(() => {
    if (activeTab === "CURRICULUM") {
      fetchCurriculumBank();
    }
  }, [activeTab, fetchCurriculumBank]);

  // Handle Score Input Change in Gradebook
  const handleScoreChange = (
    studentId: string,
    pillar: "literasi" | "numerasi" | "diniyyah",
    valStr: string
  ) => {
    setHasUnsavedChanges(true);
    const num = valStr === "" ? null : Math.min(100, Math.max(0, Number(valStr)));
    setGradebook((prev) =>
      prev.map((row) => {
        if (row.student_id === studentId) {
          const updated = {
            ...row,
            [pillar === "literasi"
              ? "literasi_score"
              : pillar === "numerasi"
              ? "numerasi_score"
              : "diniyyah_score"]: num,
          };
          // Recalculate average on-the-fly
          const lit =
            pillar === "literasi" ? num : updated.literasi_score;
          const numS =
            pillar === "numerasi" ? num : updated.numerasi_score;
          const din =
            pillar === "diniyyah" ? num : updated.diniyyah_score;

          if (lit !== null && numS !== null && din !== null) {
            updated.overall_score = Number(((lit + numS + din) / 3).toFixed(1));
          } else {
            updated.overall_score = null;
          }
          return updated;
        }
        return row;
      })
    );
  };

  // Save All Gradebook Scores
  const handleSaveGradebook = async () => {
    if (!assessment) {
      toast.error("Sesi penilaian belum siap.");
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
        toast.success("Nilai Trisula berhasil disimpan ke database.");
        setHasUnsavedChanges(false);
        fetchAssessmentSession(selectedClassId);
      } else {
        toast.error(json.message || "Gagal menyimpan nilai.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyimpan nilai.");
    } finally {
      setSavingGradebook(false);
    }
  };

  // Handle Insert TP from Curriculum Bank Modal
  const handleCurriculumSelected = async (selected: SelectedTPPayload) => {
    if (!assessment) {
      toast.error("Sesi penilaian belum tersedia.");
      return;
    }

    try {
      const existingCurriculum = curriculum.map((c) => ({
        pillar: c.pillar,
        cp_id: c.cp_id || null,
        tp_id: c.tp_id || "custom",
        cp_text_snapshot: c.cp_text_snapshot || null,
        tp_text_snapshot: c.tp_text_snapshot,
      }));

      const newCurriculum = [
        ...existingCurriculum,
        {
          pillar: bankModalPillar,
          cp_id: selected.cpId || null,
          tp_id: selected.tpId || "custom",
          cp_text_snapshot: selected.cpTeks || null,
          tp_text_snapshot: selected.teks,
        },
      ];

      const res = await fetch("/api/v1/trisula/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          curriculum: newCurriculum,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`TP berhasil disisipkan untuk Pilar ${bankModalPillar}.`);
        fetchAssessmentSession(selectedClassId);
      } else {
        toast.error(json.message || "Gagal menyisipkan TP.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyisipkan TP.");
    }
  };

  // Evaluate Teacher Observation Note using AI
  const handleEvaluateObservationAI = async () => {
    if (!observationText.trim()) {
      toast.error("Silakan tuliskan catatan observasi terlebih dahulu.");
      return;
    }

    setAiLoading(true);
    try {
      const pilarTPs = curriculum.filter((c) => c.pillar === observationPillar);
      const res = await fetch("/api/v1/trisula/ai/evaluate-observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: activeStudentDetail?.student_name || "Santri",
          className: selectedClassName,
          fase: resolvedFase,
          pillar: observationPillar,
          observationText: observationText.trim(),
          tps: pilarTPs.map((t) => t.tp_text_snapshot),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAiResult(json.data);
        toast.success("Catatan observasi berhasil dievaluasi AI.");
      } else {
        toast.error(json.message || "Gagal menganalisis catatan observasi.");
      }
    } catch {
      toast.error("Terjadi kendala saat menghubungi AI.");
    } finally {
      setAiLoading(false);
    }
  };

  // Apply AI Evaluation Result to Student Score
  const handleApplyAiResult = () => {
    if (!aiResult || !activeStudentDetail) return;
    const { nilai, deskripsi } = aiResult;

    const pKey =
      observationPillar === "LITERASI"
        ? "literasi"
        : observationPillar === "NUMERASI"
        ? "numerasi"
        : "diniyyah";

    handleScoreChange(activeStudentDetail.student_id, pKey, String(nilai));
    toast.success(`Skor ${nilai} dan deskripsi berhasil diterapkan ke ${activeStudentDetail.student_name}.`);
    setActiveStudentDetail(null);
  };

  // Sync / Initialize Trisula Standard Curriculum
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
        toast.success("Standar Kurikulum Trisula BLC berhasil disinkronkan.");
        fetchCurriculumBank();
        fetchAssessmentSession(selectedClassId);
      } else {
        toast.error(json.message || "Gagal menyinkronkan kurikulum.");
      }
    } catch {
      toast.error("Terjadi kendala saat sinkronisasi kurikulum.");
    } finally {
      setSyncingCurriculum(false);
    }
  };

  // Open Individual Student Report Sheet Modal (Primary UX)
  const openStudentReportModal = async (studentId: string) => {
    if (!assessment) return;
    setSelectedReportStudentId(studentId);
    setIndividualReportOpen(true);
    setLoadingReport(true);
    setReportActiveTab("PREVIEW");

    try {
      const res = await fetch(
        `/api/v1/trisula/report?assessment_id=${assessment.id}&student_id=${studentId}`
      );
      const json = await res.json();
      if (json.success) {
        setReportData(json.data);
        setReportCatatan(json.data.summary?.catatan_rangkuman || "");
        setReportPesan(json.data.summary?.pesan_orang_tua || "");
        setReportLitDesc(json.data.summary?.literasi_description || "");
        setReportNumDesc(json.data.summary?.numerasi_description || "");
        setReportDinDesc(json.data.summary?.diniyyah_description || "");
      } else {
        toast.error(json.message || "Gagal memuat raport santri.");
      }
    } catch {
      toast.error("Terjadi kendala saat memuat raport.");
    } finally {
      setLoadingReport(false);
    }
  };

  // Synthesize Report Narrative with AI
  const handleSynthesizeReportAI = async () => {
    if (!reportData) return;
    setAiReportLoading(true);
    try {
      const res = await fetch("/api/v1/trisula/ai/synthesize-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: reportData.student.full_name,
          scores: {
            literasi: reportData.summary?.literasi_score,
            numerasi: reportData.summary?.numerasi_score,
            diniyyah: reportData.summary?.diniyyah_score,
          },
          curriculumSnapshot: curriculum.map((c) => c.tp_text_snapshot),
        }),
      });
      const json = await res.json();
      if (json.success) {
        const { catatan, pesan, literasiDesc, numerasiDesc, diniyyahDesc } = json.data;
        if (catatan) setReportCatatan(catatan);
        if (pesan) setReportPesan(pesan);
        if (literasiDesc) setReportLitDesc(literasiDesc);
        if (numerasiDesc) setReportNumDesc(numerasiDesc);
        if (diniyyahDesc) setReportDinDesc(diniyyahDesc);
        toast.success("Narasi raport berhasil dirumuskan AI.");
      } else {
        toast.error(json.message || "Gagal merumuskan narasi raport.");
      }
    } catch {
      toast.error("Terjadi kendala saat menghubungi AI.");
    } finally {
      setAiReportLoading(false);
    }
  };

  // Save Report Narrative
  const handleSaveReport = async () => {
    if (!assessment || !selectedReportStudentId) return;
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
        toast.success("Narasi raport santri berhasil disimpan.");
        // Refresh local summary in gradebook state
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
        toast.error(json.message || "Gagal menyimpan narasi raport.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyimpan narasi raport.");
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: CLASS_LIST (Primary Landing)
  // ═══════════════════════════════════════════════════════════════════════════
  if (trisulaView === 'CLASS_LIST') {
    return (
      <PageContainer maxWidth="7xl" className="space-y-6">
        {/* Header matching SIUBA Dashboard */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Asesmen 3 Pilar
              </span>
              <span className="text-xs text-gray-400">&bull;</span>
              <span className="text-xs text-gray-500 font-medium">Kurikulum Merdeka</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
              Trisula Akademik / Penilaian Terpadu
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Penilaian terpadu 3 Pilar (Literasi, Numerasi, Diniyyah) dan penerbitan raport per rombongan belajar.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => handleSyncTrisula()}
              variant="secondary"
              size="sm"
              className="min-h-[38px] text-xs border-purple-200 text-purple-700 hover:bg-purple-50 shadow-xs"
              disabled={syncingCurriculum}
            >
              {syncingCurriculum ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />}
              Sinkronkan Standar BLC
            </Button>
          </div>
        </div>

        {/* Desktop Aggregate KPI Strip */}
        {!classSummaryLoading && classSummaries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Total Kelas</span>
                <School className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalClasses}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Rombongan belajar aktif</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Total Murid</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalStudents}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Santri terdaftar</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Nilai Lengkap</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700 font-fredoka">{desktopStats.totalComplete}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{desktopStats.completionRate}% dari total murid</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Pilar Asesmen</span>
                <Layers className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-purple-700 font-fredoka">3 Pilar</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Literasi, Numerasi, Diniyyah</p>
            </div>
          </div>
        )}

        {/* Class Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/60 p-2.5 rounded-xl border border-gray-200/70">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 px-2">
            <School className="w-4 h-4 text-emerald-600" />
            <span>Pilih Kelas untuk Penilaian ({displayedClassSummaries.length} Kelas)</span>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau kode kelas..."
              value={classSearch}
              onChange={(e) => setClassSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {classSearch && (
              <button onClick={() => setClassSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {classSummaryLoading ? (
          <div className="flex flex-col justify-center items-center p-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs text-gray-500 font-medium">Memuat daftar rombongan belajar...</p>
          </div>
        ) : displayedClassSummaries.length === 0 ? (
          <Card className="text-center p-12 bg-white">
            <div className="space-y-3 py-6 max-w-md mx-auto">
              <School className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="font-bold text-base text-gray-800">
                {classSearch ? 'Kelas Tidak Ditemukan' : 'Belum Ada Kelas'}
              </h3>
              <p className="text-xs text-gray-500">
                {classSearch
                  ? `Tidak ada rombongan belajar yang cocok dengan kata kunci "${classSearch}".`
                  : 'Anda belum ditugaskan ke kelas manapun atau belum ada rombongan belajar aktif.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedClassSummaries.map((cls) => {
              const pct = cls.student_count > 0 ? Math.round((cls.complete_count / cls.student_count) * 100) : 0;
              return (
                <div
                  key={cls.class_id}
                  className="bg-white rounded-2xl border border-gray-200/90 shadow-xs flex flex-col hover:shadow-md hover:border-emerald-300 transition-all duration-150 group"
                >
                  <div className="p-5 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                            {cls.fase}
                          </span>
                          {cls.class_code && <span className="text-[10px] text-gray-400 font-semibold">{cls.class_code}</span>}
                        </div>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-700 transition-colors font-plus-jakarta">
                          {cls.class_name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">{cls.student_count} Santri Terdaftar</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <School className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Per-pillar progress bars */}
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      {[
                        { label: 'Literasi', count: cls.literasi_count, color: 'bg-blue-500' },
                        { label: 'Numerasi', count: cls.numerasi_count, color: 'bg-violet-500' },
                        { label: 'Diniyyah', count: cls.diniyyah_count, color: 'bg-amber-500' },
                      ].map(({ label, count, color }) => {
                        const p = cls.student_count > 0 ? Math.round((count / cls.student_count) * 100) : 0;
                        return (
                          <div key={label}>
                            <div className="flex items-center justify-between text-[11px] text-gray-600 mb-0.5 font-medium">
                              <span>{label}</span>
                              <span className="font-bold text-gray-800">{count}/{cls.student_count}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${p}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        ✓ {cls.complete_count} Lengkap ({pct}%)
                      </span>
                      {cls.student_count - cls.complete_count > 0 && (
                        <span className="text-[10px] text-amber-700 font-semibold">
                          {cls.student_count - cls.complete_count} Belum Selesai
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-3 bg-gray-50/40">
                    <Button
                      className="w-full min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                      onClick={() => {
                        setSelectedClassId(cls.class_id);
                        setSelectedClassName(cls.class_name);
                        setSelectedClassLevel(cls.class_level);
                        setTrisulaView('CLASS_DETAIL');
                        fetchAssessmentSession(cls.class_id);
                      }}
                    >
                      Buka Gradebook <ChevronRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: CLASS_DETAIL (Desktop Gradebook & Assessment Workspace)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <PageContainer maxWidth="7xl" className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <button
          onClick={() => {
            setTrisulaView('CLASS_LIST');
            fetchClassSummaries();
          }}
          className="hover:text-emerald-700 font-semibold transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Daftar Kelas
        </button>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="font-bold text-gray-900">{selectedClassName}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
          {resolvedFase}
        </span>
      </div>

      {/* Header Context matching SIUBA standard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Gradebook {resolvedFase}
            </span>
            <span className="text-xs text-gray-400">&bull;</span>
            <span className="text-xs text-gray-500 font-medium">{gradebook.length} Santri Terdaftar</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
            {selectedClassName} &mdash; Penilaian 3 Pilar
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Input nilai Literasi, Numerasi, Diniyyah, analisis pengamatan AI, dan terbitkan raport santri.
          </p>
        </div>

        {/* Global Class & Phase Selector */}
        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 text-xs">
          <span className="font-bold text-gray-600 pl-1 text-xs">Ganti Kelas:</span>
          {loadingClasses ? (
            <span className="text-xs text-gray-400 flex items-center gap-1 px-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Memuat...
            </span>
          ) : (
            <select
              value={selectedClassId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedClassId(cid);
                const found = (Array.isArray(classes) ? classes : []).find((c) => c.id === cid);
                if (found) {
                  setSelectedClassName(found.name);
                  setSelectedClassLevel(found.level || 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500"
            >
              {(Array.isArray(classes) ? classes : []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
            {resolvedFase}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200 gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("GRADEBOOK")}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "GRADEBOOK"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <TableIcon className="w-4 h-4" /> Penilaian Kelas (Gradebook)
        </button>
        <button
          onClick={() => setActiveTab("MATRIX")}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "MATRIX"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Matriks Nilai
        </button>
        <button
          onClick={() => {
            setActiveTab("REPORT");
            if (gradebook.length > 0 && !selectedReportStudentId) {
              openStudentReportModal(gradebook[0].student_id);
            }
          }}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "REPORT"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileText className="w-4 h-4" /> Raport & Cetak
        </button>
        <button
          onClick={() => setActiveTab("CURRICULUM")}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "CURRICULUM"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Kurikulum BLC
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CLASS GRADEBOOK (HIGH PRODUCTIVITY WORKSPACE) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === "GRADEBOOK" && (
        <div className="space-y-6">
          {/* Selected Curriculum Cards per Pillar (Desktop 3-Col, Mobile Stacked) */}
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
                  className="p-4 rounded-2xl border border-gray-200/90 bg-white shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Pilar {p}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setBankModalPillar(p);
                        setBankModalOpen(true);
                      }}
                      className="h-7 text-[11px] px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Sisip TP
                    </Button>
                  </div>

                  {pilarItems.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">Belum ada TP yang disisipkan untuk pilar ini.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {pilarItems.map((ci, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-700 leading-snug"
                          title={ci.tp_text_snapshot}
                        >
                          <span className="font-bold text-gray-400 mr-1">{idx + 1}.</span>
                          {ci.tp_text_snapshot}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gradebook Header with Live Search, Actions & View Mode Toggle */}
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/40">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                  Daftar Nilai Santri ({gradebook.length} Murid)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {completedStudentsCount}/{gradebook.length} Lengkap
                </span>
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    ● Perubahan belum disimpan
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Live Student Search */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari santri / NISN..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {studentSearch && (
                    <button onClick={() => setStudentSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* View Mode Toggle (Card vs Table) */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-xs">
                  <button
                    onClick={() => setViewMode("TABLE")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      viewMode === "TABLE"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <TableIcon className="w-3 h-3" /> Tabel
                  </button>
                  <button
                    onClick={() => setViewMode("CARD")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      viewMode === "CARD"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" /> Kartu
                  </button>
                </div>

                {/* Bulk Class Print Action */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkPrintModalOpen(true)}
                  disabled={loadingContext || gradebook.length === 0}
                  className="h-8 text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50"
                  title="Cetak semua lembar raport santri di kelas ini"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Raport ({completedStudentsCount})
                </Button>

                {/* Save All Scores Action */}
                <Button
                  onClick={handleSaveGradebook}
                  disabled={savingGradebook || loadingContext}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs text-white font-bold shadow-xs"
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
              <div className="py-24 flex flex-col justify-center items-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs text-gray-500">Memuat lembar nilai santri...</p>
              </div>
            ) : displayedGradebook.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <User className="w-10 h-10 mx-auto text-gray-300" />
                <p className="text-xs font-semibold text-gray-600">
                  {studentSearch ? `Tidak ada santri yang cocok dengan "${studentSearch}".` : `Tidak ada santri aktif di ${selectedClassName}.`}
                </p>
              </div>
            ) : viewMode === "TABLE" ? (
              /* ──────────────────────────────────────────────────────── */
              /* A. DESKTOP TABULAR GRADEBOOK WORKSPACE */
              /* ──────────────────────────────────────────────────────── */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 min-w-[200px]">Nama Santri & NISN</th>
                      <th className="py-3 px-4 w-32 text-center">
                        <span className="inline-flex items-center gap-1 text-blue-900 font-bold">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Literasi
                        </span>
                      </th>
                      <th className="py-3 px-4 w-32 text-center">
                        <span className="inline-flex items-center gap-1 text-emerald-900 font-bold">
                          <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Numerasi
                        </span>
                      </th>
                      <th className="py-3 px-4 w-32 text-center">
                        <span className="inline-flex items-center gap-1 text-amber-900 font-bold">
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-600" /> Diniyyah
                        </span>
                      </th>
                      <th className="py-3 px-4 w-24 text-center">Rata-rata</th>
                      <th className="py-3 px-4 w-28 text-center">Status</th>
                      <th className="py-3 px-4 w-44 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedGradebook.map((row, idx) => {
                      const isComplete =
                        row.literasi_score !== null &&
                        row.numerasi_score !== null &&
                        row.diniyyah_score !== null;

                      const ovCat = getScoreCategory(row.overall_score);

                      return (
                        <tr key={row.student_id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3 px-4 text-gray-400 font-bold text-center">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                                {row.student_name.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block text-xs">{row.student_name}</span>
                                <span className="text-[10px] text-gray-400">NISN: {row.student_nisn || "-"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Literasi Score Cell */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.literasi_score ?? ""}
                              onChange={(e) => handleScoreChange(row.student_id, "literasi", e.target.value)}
                              placeholder="—"
                              className="h-8 w-20 text-xs text-center font-bold border border-blue-200 rounded-lg bg-blue-50/30 text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>

                          {/* Numerasi Score Cell */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.numerasi_score ?? ""}
                              onChange={(e) => handleScoreChange(row.student_id, "numerasi", e.target.value)}
                              placeholder="—"
                              className="h-8 w-20 text-xs text-center font-bold border border-emerald-200 rounded-lg bg-emerald-50/30 text-emerald-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </td>

                          {/* Diniyyah Score Cell */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.diniyyah_score ?? ""}
                              onChange={(e) => handleScoreChange(row.student_id, "diniyyah", e.target.value)}
                              placeholder="—"
                              className="h-8 w-20 text-xs text-center font-bold border border-amber-200 rounded-lg bg-amber-50/30 text-amber-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                          </td>

                          {/* Overall Average */}
                          <td className="py-3 px-4 text-center">
                            <span className="font-bold text-xs text-emerald-700">
                              {row.overall_score !== null ? row.overall_score : "—"}
                            </span>
                            {ovCat && (
                              <span className={`block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${ovCat.colorClass}`}>
                                {ovCat.label}
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4 text-center">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3" /> Lengkap
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                Sebagian
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setActiveStudentDetail(row);
                                  setObservationText("");
                                  setAiResult(null);
                                }}
                                className="h-7 text-[11px] px-2 border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold"
                                title="Bantu evaluasi observasi murid dengan AI"
                              >
                                <Sparkles className="w-3 h-3 mr-1 text-purple-600" /> AI
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openStudentReportModal(row.student_id)}
                                className="h-7 text-[11px] px-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold"
                                title="Buka dan cetak lembar raport santri"
                              >
                                <FileText className="w-3 h-3 mr-1 text-emerald-400" /> Raport
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ──────────────────────────────────────────────────────── */
              /* B. MOBILE-FIRST STUDENT CARDS VIEW */
              /* ──────────────────────────────────────────────────────── */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedGradebook.map((row, idx) => {
                  const isComplete =
                    row.literasi_score !== null &&
                    row.numerasi_score !== null &&
                    row.diniyyah_score !== null;

                  const ovCat = getScoreCategory(row.overall_score);

                  return (
                    <div
                      key={row.student_id}
                      className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-gray-400">#{idx + 1}</span>
                            <h4 className="text-sm font-bold text-gray-900 truncate">
                              {row.student_name}
                            </h4>
                          </div>
                          <span className="text-[11px] text-gray-500 block">
                            NISN: {row.student_nisn || "-"}
                          </span>
                        </div>

                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-2.5 h-2.5" /> Lengkap
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            Sebagian
                          </span>
                        )}
                      </div>

                      {/* 3 Pillars Score Input Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                          <span className="text-[10px] font-bold text-blue-900 flex items-center justify-center gap-1">
                            <BookOpen className="w-3 h-3 text-blue-600" /> Literasi
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={row.literasi_score ?? ""}
                            onChange={(e) => handleScoreChange(row.student_id, "literasi", e.target.value)}
                            placeholder="—"
                            className="h-8 text-xs text-center font-bold bg-white"
                          />
                        </div>

                        <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                          <span className="text-[10px] font-bold text-emerald-900 flex items-center justify-center gap-1">
                            <Calculator className="w-3 h-3 text-emerald-600" /> Numerasi
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={row.numerasi_score ?? ""}
                            onChange={(e) => handleScoreChange(row.student_id, "numerasi", e.target.value)}
                            placeholder="—"
                            className="h-8 text-xs text-center font-bold bg-white"
                          />
                        </div>

                        <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100 space-y-1">
                          <span className="text-[10px] font-bold text-amber-900 flex items-center justify-center gap-1">
                            <HeartHandshake className="w-3 h-3 text-amber-600" /> Diniyyah
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={row.diniyyah_score ?? ""}
                            onChange={(e) => handleScoreChange(row.student_id, "diniyyah", e.target.value)}
                            placeholder="—"
                            className="h-8 text-xs text-center font-bold bg-white"
                          />
                        </div>
                      </div>

                      {/* Average */}
                      <div className="flex items-center justify-between text-xs px-1 py-0.5 border-t border-gray-100 pt-2">
                        <span className="text-[11px] text-gray-500 font-medium">Rata-rata:</span>
                        <span className="font-bold text-emerald-700">
                          {row.overall_score !== null ? row.overall_score : "—"}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setActiveStudentDetail(row);
                            setObservationText("");
                            setAiResult(null);
                          }}
                          className="h-8 text-[11px] font-semibold border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600 mr-1" /> Bantu AI
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openStudentReportModal(row.student_id)}
                          className="h-8 text-[11px] bg-gray-900 hover:bg-gray-800 text-white font-bold"
                        >
                          <FileText className="w-3 h-3 mr-1 text-emerald-400" /> Raport
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/40">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                  Matriks Evaluasi Trisula &mdash; {selectedClassName}
                </h3>
                <p className="text-xs text-gray-500">
                  Rekapitulasi pencapaian 3 Pilar seluruh santri yang tersimpan di database.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="text-xs h-8 font-semibold"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Matriks
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 min-w-[200px]">Nama Santri</th>
                    <th className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-blue-900 font-bold">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Literasi
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-emerald-900 font-bold">
                        <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Numerasi
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-amber-900 font-bold">
                        <HeartHandshake className="w-3.5 h-3.5 text-amber-600" /> Diniyyah
                      </span>
                    </th>
                    <th className="py-3 px-4 text-center">Rata-rata</th>
                    <th className="py-3 px-4 text-center">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gradebook.map((row, idx) => {
                    const avg = row.overall_score;
                    const cat = getScoreCategory(avg);

                    return (
                      <tr key={row.student_id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-gray-400 font-bold text-center">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-gray-900">{row.student_name}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-950">
                          {row.literasi_score !== null ? row.literasi_score : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-950">
                          {row.numerasi_score !== null ? row.numerasi_score : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-amber-950">
                          {row.diniyyah_score !== null ? row.diniyyah_score : "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">
                          {avg !== null ? avg : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cat ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.colorClass}`}>
                              {cat.label}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
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
          <div className="p-4 rounded-2xl bg-white border border-gray-200/90 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-gray-700">Pilih Santri:</span>
              <select
                value={selectedReportStudentId}
                onChange={(e) => openStudentReportModal(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800"
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
                className="text-xs h-8 font-semibold border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Cetak Semua Kelas ({completedStudentsCount})
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
            <div className="border border-gray-200 rounded-2xl p-6 bg-gray-100/60 flex justify-center">
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
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                Standar Kurikulum Trisula BLC ({resolvedFase})
              </h3>
              <p className="text-xs text-gray-500">
                Pondasi Capaian Pembelajaran (CP) dan Tujuan Pembelajaran (TP) terpadu untuk {selectedClassName}.
              </p>
            </div>
            {["administrator", "admin"].includes(user?.role || "") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncTrisula}
                disabled={syncingCurriculum}
                className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                title="Menambahkan standar bawaan yang belum tersedia tanpa menimpa perubahan yang ada."
              >
                {syncingCurriculum ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" />
                )}
                Sinkronkan Standar BLC
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(["Literasi", "Numerasi", "Diniyyah"] as const).map((domain) => {
              const domainCP = filterTrisulaNativeCPs(curriculumCPs, {
                fase: resolvedFase,
                domain,
              })[0] || null;
              const domainTPs = filterTrisulaNativeTPs(curriculumTPs, {
                fase: resolvedFase,
                domain,
              });

              return (
                <div
                  key={domain}
                  className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3 shadow-xs"
                >
                  <h4 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                    Pilar {domain} ({domainTPs.length} TP)
                  </h4>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Capaian Pembelajaran:
                    </span>
                    <p className="text-gray-800 italic leading-relaxed">
                      {domainCP?.teks || `Belum ada CP terdaftar untuk ${domain}.`}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1 text-xs max-h-72 overflow-y-auto pr-1">
                    <span className="font-bold text-gray-600 block text-[11px]">
                      Daftar Tujuan Pembelajaran:
                    </span>
                    {domainTPs.map((tp, idx) => (
                      <div
                        key={tp.id}
                        className="p-2 rounded-lg border border-gray-100 bg-gray-50/50 leading-snug"
                      >
                        <span className="font-bold text-gray-400 mr-1">{idx + 1}.</span>
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
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 shadow-lg flex items-center justify-between gap-2 print:hidden">
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-gray-500 block">Status Kelas</span>
          <span className="text-xs font-bold text-emerald-700 truncate block">
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
            Simpan
          </Button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: INDIVIDUAL STUDENT REPORT & A4 PREVIEW (PRIMARY FLOW) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {individualReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto animate-fadeIn print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                    Raport Trisula: {reportData?.student?.full_name || "Memuat..."}
                  </h3>
                </div>
                <p className="text-[11px] text-gray-500">
                  {selectedClassName} &bull; {assessment?.semester_name || "Semester Ganjil"} {assessment?.academic_year_name || "2026/2027"}
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
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-tabs: Pratinjau A4 vs Edit Narasi Raport */}
            <div className="px-4 sm:px-6 border-b border-gray-200 flex gap-2 pt-2 bg-gray-50/30">
              <button
                onClick={() => setReportActiveTab("PREVIEW")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  reportActiveTab === "PREVIEW"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Lembar Raport A4
              </button>
              <button
                onClick={() => setReportActiveTab("EDIT_NARRATIVE")}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  reportActiveTab === "EDIT_NARRATIVE"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Edit Narasi & Catatan
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gray-100/60">
              {loadingReport ? (
                <div className="py-24 flex justify-center items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : reportData ? (
                reportActiveTab === "PREVIEW" ? (
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
                  <div className="max-w-2xl mx-auto space-y-4 bg-white p-5 rounded-2xl border border-gray-200 text-xs">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">
                          Pengaturan Narasi Raport
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Sesuaikan deskripsi capaian 3 pilar dan pesan kemitraan orang tua murid.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSynthesizeReportAI}
                        disabled={aiReportLoading}
                        className="text-xs h-8 border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold"
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
                        <label className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
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
                        <label className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
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
                        <label className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
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
                        <label className="font-bold text-gray-800 block mb-1">
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
                        <label className="font-bold text-gray-800 block mb-1">
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
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-plus-jakarta">
                    Cetak Semua Raport Kelas
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedClassName} &bull; {gradebook.length} Santri Terdaftar
                  </p>
                </div>
              </div>

              {incompleteStudentsCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    Perhatian: <strong>{incompleteStudentsCount} santri</strong> belum memiliki nilai 3 pilar lengkap. Lanjutkan cetak dengan data yang ada?
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-600 leading-relaxed">
                Sistem akan menyusun lembar raport resmi A4 untuk setiap santri secara berurutan dengan pemisah halaman otomatis (1 santri per halaman).
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
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
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                  Bantu Evaluasi AI: {activeStudentDetail.student_name}
                </h3>
                <p className="text-[11px] text-gray-500">
                  Evaluasi catatan observasi guru secara otomatis terhadap TP Kurikulum.
                </p>
              </div>
              <button
                onClick={() => setActiveStudentDetail(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Pilih Pilar Observasi:
                </label>
                <div className="flex gap-2">
                  {(["LITERASI", "NUMERASI", "DINIYYAH"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setObservationPillar(p)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                        observationPillar === p
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Catatan Pengamatan / Bukti Belajar Guru:
                </label>
                <Textarea
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  placeholder="Contoh: Ananda mampu membaca teks modul dengan lancar, memahami pesan cerita, dan menunjukkan adab yang sangat tenang..."
                  rows={4}
                  className="text-xs bg-white"
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
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900">
                      Hasil Evaluasi AI ({aiResult.evidenceStatus}):
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900">
                      Skor Rekomendasi: {aiResult.nilai !== null ? aiResult.nilai : "Null"}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed italic">
                    &quot;{aiResult.deskripsi}&quot;
                  </p>
                  <p className="text-[11px] text-gray-500">
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
        activePillar={bankModalPillar}
        title={`Sisip Tujuan Pembelajaran (Pilar ${bankModalPillar})`}
        onSelectTP={(selected) => {
          handleCurriculumSelected(selected);
          setBankModalOpen(false);
        }}
      />

      {/* Print-Only Single Student Report Container */}
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

      {/* Print-Only Bulk Class Reports Container */}
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
    </PageContainer>
  );
}
