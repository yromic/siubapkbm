"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { UX_COPY } from "@/lib/ux-copy";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Plus, FileText, ArrowLeft, Printer, CheckCircle,
  WifiOff, Trash2, Edit, User, BookOpen, School, ChevronRight,
  Link2, RefreshCw, Check, AlertTriangle, Sparkles, Database,
  Search, Filter, X, Bookmark, Tag, Users, BarChart3, ClipboardList,
  GraduationCap, CheckCircle2, Clock, HeartHandshake
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PageContainer, PageSection } from "@/components/ui/page-framework";
import { KPICard } from "@/components/ui/kpi-card";
import { AIUsageStatus, getAIErrorMessageByReason } from "@/components/ai/AIUsageStatus";
import { resolvePhaseByClassName } from "@/lib/utils/academicUtils";
import { fetchBankTPs as fetchBankTPsClient } from "@/lib/api/curriculumBankClient";
import { BankTPItem } from "@/lib/utils/curriculumFilterUtils";
import { deriveKKTPStatusFromDoc, getKKTPStatusBadge, type KKTPDocStatus } from "@/lib/utils/kktpStatusUtils";

import { OfficialSchoolLetterhead } from "@/components/print/OfficialSchoolLetterhead";
import { PrintBrowserHint } from "@/components/print/PrintBrowserHint";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'SELECT_CLASS' | 'SELECT_SUBJECT' | 'SELECT_STUDENT' | 'FORM_KKTP';
type PageView = 'CLASS_LIST' | 'SUBJECT_LIST' | 'STUDENT_LIST' | 'LIST' | 'WIZARD' | 'PRINT';

interface KKTPClassSubjectSummary {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  created_count: number;
  student_count: number;
}

interface KKTPClassCard {
  class_id: string;
  class_name: string;
  class_code: string;
  class_level: number;
  student_count: number;
  subjects: KKTPClassSubjectSummary[];
  total_kktp_count: number;
}

interface KKTPStudentSummary {
  student_id: string;
  student_name: string;
  nisn: string | null;
  status: KKTPDocStatus;
  status_label: string;
  status_color: string;
  kktp_doc_id: string | null;
  kktp_doc_title: string | null;
  kktp_updated_at: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  code?: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  nisn?: string;
}

export type KKTPEvidenceStatus = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';

interface TPItem {
  id: string;
  teks: string;
  sourceType: 'LINKED_RPM' | 'INDEPENDENT_MANUAL' | 'AI_GENERATED';
  rpmRefId?: string;
  fromBank?: boolean;
  nilai: number | null;
  deskripsi?: string;
  evidenceStatus?: KKTPEvidenceStatus;
  aiSuggested?: boolean;
}

interface RPMRef {
  id: string;
  title: string;
  content: any;
}

interface KKTPItem {
  id: string;
  title: string;
  type: 'KKTP';
  status: 'DRAFT' | 'PUBLISHED' | 'APPROVED' | 'ARCHIVED';
  version: number;
  class_id?: string;
  subject_id?: string;
  author_id?: string;
  author_name?: string;
  author_nip?: string | null;
  author_nuptk?: string | null;
  class_name?: string;
  subject_name?: string;
  updated_at: string;
  content: {
    identitas: {
      kelasRombel: string;
      classId?: string;
      mataPelajaran: string;
      subjectId?: string;
      namaMurid: string;
      studentId?: string;
      nisn?: string | null;
      tingkatFase?: string;
      letterhead?: {
        id: string;
        url: string;
        name: string;
        snapped_at?: string;
      };
    };
    tpItems: TPItem[];
    catatanTutor: string;
    pesanKemitraan: string;
    sumberCPTP?: any;
    metodologi?: string;
    kriteria?: any;
    thresholdConfig?: any;
  };
}

interface AppSettings {
  school_name?: string;
  school_sub_header?: string;
  school_headmaster_name?: string;
  school_headmaster_nip?: string;
  active_letterhead_id?: string;
  active_letterhead_url?: string;
}

// ─── Score helpers ─────────────────────────────────────────────────────────

function getKategori(nilai: number | null | undefined): { label: string; color: string } {
  if (nilai === null || nilai === undefined) {
    return { label: "Belum Dinilai", color: "text-gray-600 bg-gray-100 border-gray-200" };
  }
  if (nilai >= 90) return { label: "Sangat Baik", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (nilai >= 76) return { label: "Tuntas", color: "text-blue-700 bg-blue-50 border-blue-200" };
  if (nilai >= 60) return { label: "Cukup", color: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "Perlu Bimbingan", color: "text-red-700 bg-red-50 border-red-200" };
}

function getDeskripsi(nilai: number | null | undefined, teks: string): string {
  if (nilai === null || nilai === undefined) return "Belum dinilai.";
  if (nilai >= 90) return `Murid sangat menguasai tujuan pembelajaran "${teks}" secara mandiri dan konsisten.`;
  if (nilai >= 76) return `Murid mencapai ketuntasan dalam tujuan pembelajaran "${teks}" dengan baik.`;
  if (nilai >= 60) return `Murid cukup menguasai tujuan pembelajaran "${teks}", perlu penguatan pada aspek tertentu.`;
  return `Murid memerlukan bimbingan intensif dan tindak lanjut untuk mencapai tujuan pembelajaran "${teks}".`;
}

export default function KKTPPage() {
  const { user } = useAuth();
  const isAdmin = user && ['administrator', 'admin'].includes(user.role);

  // ── View & Wizard state ──────────────────────────────────────────────────
  const [view, setView] = useState<PageView>('CLASS_LIST');
  const [wizardStep, setWizardStep] = useState<WizardStep>('SELECT_CLASS');
  const [activeDoc, setActiveDoc] = useState<KKTPItem | null>(null);

  // ── Level 1: Class-first navigation state ────────────────────────────────
  const [classSummaries, setClassSummaries] = useState<KKTPClassCard[]>([]);
  const [classSummaryLoading, setClassSummaryLoading] = useState(true);
  const [classSearch, setClassSearch] = useState('');

  // ── Level 2: Subject navigation state ────────────────────────────────────
  const [activeClass, setActiveClass] = useState<{ id: string; name: string; code: string; level: number; student_count?: number } | null>(null);
  const [classSubjects, setClassSubjects] = useState<KKTPClassSubjectSummary[]>([]);
  const [classSubjectsLoading, setClassSubjectsLoading] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');

  // ── Level 3: Student navigation state ────────────────────────────────────
  const [activeSubject, setActiveSubject] = useState<{ id: string; name: string; code: string } | null>(null);
  const [studentSummaries, setStudentSummaries] = useState<KKTPStudentSummary[]>([]);
  const [studentSummariesLoading, setStudentSummariesLoading] = useState(false);
  const [studentSummaryStats, setStudentSummaryStats] = useState<{ total: number; created_count: number; not_created_count: number } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Bulk print state
  const [bulkPrintModalOpen, setBulkPrintModalOpen] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [bulkPrintDocs, setBulkPrintDocs] = useState<KKTPItem[]>([]);

  // ── List state (Flat fallback) ───────────────────────────────────────────
  const [documents, setDocuments] = useState<KKTPItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Wizard step data ─────────────────────────────────────────────────────
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [loadingStep, setLoadingStep] = useState(false);

  // ── Selections ───────────────────────────────────────────────────────────
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [selectedStudentNisn, setSelectedStudentNisn] = useState<string | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [tpItems, setTpItems] = useState<TPItem[]>([]);
  const [catatanTutor, setCatatanTutor] = useState('');
  const [pesanKemitraan, setPesanKemitraan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-save
  type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveDraftIdRef = useRef<string | undefined>(undefined);

  // ── AI Auto-Formulate Assessment state ───────────────────────────────────
  const [catatanPengamatan, setCatatanPengamatan] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCatatanUmum, setAiCatatanUmum] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'GEMINI' | 'FALLBACK' | null>(null);

  // ── AI Generate TP Suggestions state ────────────────────────────────────
  const [showTpAiPanel, setShowTpAiPanel] = useState(false);
  const [tpAiTopik, setTpAiTopik] = useState('');
  const [tpAiLoading, setTpAiLoading] = useState(false);
  const [tpAiError, setTpAiError] = useState<string | null>(null);
  const [tpAiSource, setTpAiSource] = useState<'GEMINI' | 'FALLBACK' | null>(null);
  const [tpAiSuggestions, setTpAiSuggestions] = useState<Array<{ teks: string; checked: boolean }>>([]);

  // ── Bank TP state ────────────────────────────────────────────────────────
  const [showBankTpModal, setShowBankTpModal] = useState(false);
  const [bankTpList, setBankTpList] = useState<BankTPItem[]>([]);
  const [bankTpLoading, setBankTpLoading] = useState(false);
  const [bankTpFilterSubject, setBankTpFilterSubject] = useState('');
  const [bankTpFilterFase, setBankTpFilterFase] = useState('');
  const [bankTpSearch, setBankTpSearch] = useState('');
  const [selectedBankTpIds, setSelectedBankTpIds] = useState<string[]>([]);
  const [deletingBankTpId, setDeletingBankTpId] = useState<string | null>(null);

  // ── RPM selection for TP ─────────────────────────────────────────────────
  const [rpmList, setRpmList] = useState<RPMRef[]>([]);
  const [selectedRpmId, setSelectedRpmId] = useState('');
  const [rpmTpCheckboxes, setRpmTpCheckboxes] = useState<{ teks: string; checked: boolean }[]>([]);

  // ── Print ────────────────────────────────────────────────────────────────
  const [schoolSettings, setSchoolSettings] = useState<AppSettings>({});
  const [loadingSettings, setLoadingSettings] = useState(false);

  // ─── Level 1: Fetch Class Summaries ──────────────────────────────────────
  const fetchClassSummaries = useCallback(async () => {
    setClassSummaryLoading(true);
    try {
      const res = await fetch('/api/v1/kktp/classes-summary');
      const json = await res.json();
      if (json.success) {
        setClassSummaries(json.data.items || []);
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

  // ─── Level 2: Fetch Subjects for a Class ──────────────────────────────────
  const fetchClassSubjects = useCallback(async (classId: string) => {
    setClassSubjectsLoading(true);
    try {
      const res = await fetch(`/api/v1/kktp/classes/${classId}/subjects`);
      const json = await res.json();
      if (json.success && json.data) {
        setClassSubjects(json.data.subjects || []);
        setActiveClass(json.data.class || null);
      } else {
        toast.error(json.message || 'Gagal memuat mata pelajaran kelas.');
      }
    } catch {
      toast.error('Terjadi kendala saat memuat mata pelajaran.');
    } finally {
      setClassSubjectsLoading(false);
    }
  }, []);

  // ─── Level 3: Fetch Students for Class × Subject ──────────────────────────
  const fetchStudentsForSubject = useCallback(async (classId: string, subjectId: string) => {
    setStudentSummariesLoading(true);
    try {
      const res = await fetch(`/api/v1/kktp/classes/${classId}/subjects/${encodeURIComponent(subjectId)}/students`);
      const json = await res.json();
      if (json.success && json.data) {
        setStudentSummaries(json.data.students || []);
        setStudentSummaryStats({
          total: json.data.total,
          created_count: json.data.created_count,
          not_created_count: json.data.not_created_count,
        });
        setActiveClass(json.data.class);
        setActiveSubject(json.data.subject);
      } else {
        toast.error(json.message || 'Gagal memuat data murid.');
      }
    } catch {
      toast.error('Terjadi kendala saat memuat data murid.');
    } finally {
      setStudentSummariesLoading(false);
    }
  }, []);

  // ─── Flat Document List (Fallback) ────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/documents?type=KKTP');
      const json = await res.json();
      if (json.success) setDocuments(json.data.items || []);
    } catch {
      toast.error('Terjadi kendala saat memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ─── Wizard: Load options ────────────────────────────────────────────────
  const loadClassOptions = useCallback(async () => {
    setLoadingStep(true);
    try {
      const res = await fetch('/api/v1/classes/my');
      const json = await res.json();
      const items = Array.isArray(json.data?.items) ? json.data.items
        : Array.isArray(json.data?.data) ? json.data.data
        : Array.isArray(json.data) ? json.data : [];
      setClassOptions(items.map((c: any) => ({ id: c.class_id || c.id, name: c.class_name || c.name, code: c.class_code || c.code })));
    } catch {
      toast.error('Gagal memuat daftar kelas.');
    } finally {
      setLoadingStep(false);
    }
  }, []);

  const loadSubjectOptions = useCallback(async (classId: string) => {
    setLoadingStep(true);
    try {
      const res = await fetch(`/api/v1/kktp/classes/${classId}/subjects`);
      const json = await res.json();
      if (json.success && json.data) {
        setSubjectOptions(json.data.subjects.map((s: any) => ({ id: s.subject_id, name: s.subject_name })));
      }
    } catch {
      toast.error('Gagal memuat mata pelajaran.');
    } finally {
      setLoadingStep(false);
    }
  }, []);

  const loadStudentOptions = useCallback(async (classId: string) => {
    setLoadingStep(true);
    try {
      const res = await fetch(`/api/v1/enrollments?class_id=${classId}&limit=100`);
      const json = await res.json();
      const items: any[] = json.data?.data || json.data?.items || (Array.isArray(json.data) ? json.data : []);
      setStudentOptions(
        items.map((e: any) => ({
          id: e.student_id || e.id,
          full_name: e.full_name || e.student_name || e.name || 'Murid',
          nisn: e.nisn,
        }))
      );
    } catch {
      toast.error('Gagal memuat daftar murid.');
    } finally {
      setLoadingStep(false);
    }
  }, []);

  const loadRpmForContext = useCallback(async (classId: string, subjectName: string) => {
    try {
      const params = new URLSearchParams({ type: 'RPM', class_id: classId });
      const res = await fetch(`/api/v1/documents?${params.toString()}`);
      const json = await res.json();
      const items: any[] = json.data?.items || [];
      const filtered = items.filter(
        (d) => !subjectName || d.content?.identitas?.mataPelajaran === subjectName
      );
      setRpmList(filtered);
    } catch {
      // Non-critical
    }
  }, []);

  // ─── Flow Navigation Handlers ─────────────────────────────────────────────

  const handleSelectClass = (cls: KKTPClassCard | { id: string; name: string; code: string; level: number }) => {
    const classId = 'class_id' in cls ? cls.class_id : cls.id;
    const className = 'class_name' in cls ? cls.class_name : cls.name;
    const classCode = 'class_code' in cls ? cls.class_code : cls.code;
    const classLevel = 'class_level' in cls ? cls.class_level : cls.level;

    setActiveClass({ id: classId, name: className, code: classCode, level: classLevel });
    setSelectedClassId(classId);
    setSelectedClassName(className);
    setSubjectSearch('');
    setView('SUBJECT_LIST');
    fetchClassSubjects(classId);
  };

  const handleSelectSubject = (subj: KKTPClassSubjectSummary | { id: string; name: string; code: string }) => {
    const subjectId = 'subject_id' in subj ? subj.subject_id : subj.id;
    const subjectName = 'subject_name' in subj ? subj.subject_name : subj.name;
    const subjectCode = 'subject_code' in subj ? subj.subject_code : subj.code;

    if (!activeClass) return;
    setActiveSubject({ id: subjectId, name: subjectName, code: subjectCode });
    setSelectedSubjectId(subjectId);
    setSelectedSubjectName(subjectName);
    setStudentSearch('');
    setView('STUDENT_LIST');
    fetchStudentsForSubject(activeClass.id, subjectId);
  };

  const handleStartCreateForStudent = async (student: KKTPStudentSummary) => {
    if (!activeClass || !activeSubject) return;

    setActiveDoc(null);
    autoSaveDraftIdRef.current = undefined;
    setAutoSaveStatus('idle');

    setSelectedClassId(activeClass.id);
    setSelectedClassName(activeClass.name);
    setSelectedSubjectId(activeSubject.id);
    setSelectedSubjectName(activeSubject.name);
    setSelectedStudentId(student.student_id);
    setSelectedStudentName(student.student_name);
    setSelectedStudentNisn(student.nisn || null);
    setTitle(`KKTP ${activeSubject.name} — ${student.student_name}`);

    setTpItems([]);
    setCatatanTutor('');
    setPesanKemitraan('');
    setCatatanPengamatan('');
    setAiCatatanUmum(null);
    setAiError(null);

    await loadRpmForContext(activeClass.id, activeSubject.name);

    setWizardStep('FORM_KKTP');
    setView('WIZARD');
  };

  const handleEditStudentKKTP = async (student: KKTPStudentSummary) => {
    if (!student.kktp_doc_id) return;
    try {
      const res = await fetch(`/api/v1/documents/${student.kktp_doc_id}`);
      const json = await res.json();
      if (json.success && json.data) {
        handleEditKKTP(json.data);
      } else {
        toast.error(json.message || 'Gagal memuat dokumen KKTP.');
      }
    } catch {
      toast.error('Terjadi kendala saat memuat dokumen KKTP.');
    }
  };

  const handleEditKKTP = async (doc: KKTPItem) => {
    setActiveDoc(doc);
    autoSaveDraftIdRef.current = doc.id;
    setAutoSaveStatus('idle');
    setTitle(doc.title);

    const classId = doc.class_id || doc.content?.identitas?.classId || '';
    const className = doc.content?.identitas?.kelasRombel || '';
    const subjectId = doc.subject_id || doc.content?.identitas?.subjectId || '';
    const subjectName = doc.content?.identitas?.mataPelajaran || '';
    const studentId = doc.content?.identitas?.studentId || '';
    const studentName = doc.content?.identitas?.namaMurid || '';

    setSelectedClassId(classId);
    setSelectedClassName(className);
    setSelectedSubjectId(subjectId);
    setSelectedSubjectName(subjectName);
    setSelectedStudentId(studentId);
    setSelectedStudentName(studentName);
    setSelectedStudentNisn(doc.content?.identitas?.nisn || null);

    setTpItems(doc.content?.tpItems || []);
    setCatatanTutor(doc.content?.catatanTutor || '');
    setPesanKemitraan(doc.content?.pesanKemitraan || '');
    setSelectedRpmId('');
    setRpmTpCheckboxes([]);

    if (classId && subjectName) {
      await loadRpmForContext(classId, subjectName);
    }

    setWizardStep('FORM_KKTP');
    setView('WIZARD');
  };

  // ─── Generic Wizard Entry ─────────────────────────────────────────────────
  const handleStartWizard = async () => {
    setWizardStep('SELECT_CLASS');
    setSelectedClassId('');
    setSelectedClassName('');
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setSelectedStudentId('');
    setSelectedStudentName('');
    setSelectedStudentNisn(null);
    setTpItems([]);
    setCatatanTutor('');
    setPesanKemitraan('');
    setTitle('');
    setSelectedRpmId('');
    setRpmTpCheckboxes([]);
    setActiveDoc(null);
    autoSaveDraftIdRef.current = undefined;
    setAutoSaveStatus('idle');
    await loadClassOptions();
    setView('WIZARD');
  };

  // ─── Bank TP Handlers ─────────────────────────────────────────────────────
  const fetchBankTPs = useCallback(async (customSubject?: string, customFase?: string, customSearch?: string) => {
    setBankTpLoading(true);
    try {
      const s = customSubject !== undefined ? customSubject : bankTpFilterSubject;
      const f = customFase !== undefined ? customFase : bankTpFilterFase;
      const q = customSearch !== undefined ? customSearch : bankTpSearch;

      const result = await fetchBankTPsClient({
        mata_pelajaran_name: s !== 'Semua' ? s : undefined,
        fase: f || undefined,
        search: q || undefined,
        limit: 100,
      });
      setBankTpList(result.items);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memuat Bank TP.');
    } finally {
      setBankTpLoading(false);
    }
  }, [bankTpFilterSubject, bankTpFilterFase, bankTpSearch]);

  const handleOpenBankTp = async () => {
    const autoFase = resolvePhaseByClassName(selectedClassName);
    setBankTpFilterSubject(selectedSubjectName);
    setBankTpFilterFase(autoFase);
    setBankTpSearch('');
    setSelectedBankTpIds([]);
    setShowBankTpModal(true);
    await fetchBankTPs(selectedSubjectName, autoFase, '');
  };

  const handleToggleBankTpSelection = (id: string) => {
    setSelectedBankTpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleApplyBankTPs = () => {
    if (selectedBankTpIds.length === 0) {
      toast.error('Pilih minimal 1 TP dari bank.');
      return;
    }
    const selectedItems = bankTpList.filter((b) => selectedBankTpIds.includes(b.id));
    const newItems: TPItem[] = selectedItems.map((b) => ({
      id: crypto.randomUUID(),
      teks: b.teks,
      sourceType: b.sumber === 'dari_rpm' ? 'LINKED_RPM' : 'INDEPENDENT_MANUAL',
      fromBank: true,
      nilai: null,   // P0: unassessed — no fake default score
      deskripsi: '',
    }));
    setTpItems((prev) => [...prev, ...newItems]);
    setShowBankTpModal(false);
    toast.success(`${newItems.length} TP dari Bank berhasil ditambahkan.`);
  };

  // ─── AI Generate TP Suggestions Handlers ──────────────────────────────────
  const handleGenerateTpSuggestions = async () => {
    if (!tpAiTopik.trim()) {
      toast.error('Masukkan topik atau materi pembelajaran.');
      return;
    }
    setTpAiLoading(true);
    setTpAiError(null);
    try {
      // P1-A1: Use canonical backend contract — topikMateri, fase (not topik/kelasRombel)
      const fase = resolvePhaseByClassName(selectedClassName);
      const res = await fetch('/api/v1/kktp/generate-tp-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topikMateri: tpAiTopik.trim(),
          mataPelajaran: selectedSubjectName,
          tingkatFase: fase,
        }),
      });
      let json: any;
      try {
        json = await res.json();
      } catch {
        const msg = 'Respons server tidak valid. Coba lagi.';
        setTpAiError(msg);
        toast.error(msg);
        return;
      }
      if (!res.ok || !json.success) {
        const msg = json?.message || 'Gagal menghasilkan saran TP.';
        setTpAiError(msg);
        toast.error(msg);
        return;
      }
      // P1-A1: Backend returns saranTP (not suggestions)
      const suggestions: string[] = json.data.saranTP || [];
      const source: 'GEMINI' | 'FALLBACK' = json.data.source || 'GEMINI';
      setTpAiSource(source);
      setTpAiSuggestions(suggestions.map((s) => ({ teks: s, checked: true })));
      if (suggestions.length === 0) {
        toast.warning('AI tidak menghasilkan saran TP. Coba topik yang lebih spesifik.');
      } else if (source === 'FALLBACK') {
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, "Menggunakan rekomendasi TP kurikulum nasional."));
      } else {
        toast.success(`${suggestions.length} saran TP berhasil dibuat oleh AI.`);
      }
    } catch {
      const msg = 'Terjadi kendala saat menghubungkan ke AI TP.';
      setTpAiError(msg);
      toast.error(msg);
    } finally {
      setTpAiLoading(false);
    }
  };

  const handleApplyAiSuggestions = () => {
    const selected = tpAiSuggestions.filter((t) => t.checked && t.teks.trim().length > 0);
    if (selected.length === 0) {
      toast.error('Pilih minimal 1 saran Tujuan Pembelajaran.');
      return;
    }
    const isAi = tpAiSource === 'GEMINI';
    const newItems: TPItem[] = selected.map((t) => ({
      id: crypto.randomUUID(),
      teks: t.teks.trim(),
      sourceType: isAi ? 'AI_GENERATED' : 'INDEPENDENT_MANUAL',
      nilai: null,   // P0: curriculum suggestion ≠ assessment result
      deskripsi: '',
    }));
    setTpItems((prev) => [...prev, ...newItems]);
    setShowTpAiPanel(false);
    toast.success(`${newItems.length} saran TP berhasil diterapkan ke formulir.`);
  };

  // ─── AI Auto-Formulate Assessment ─────────────────────────────────────────
  const handleGenerateAI = async () => {
    if (tpItems.length === 0) {
      toast.error('Tambahkan minimal 1 Tujuan Pembelajaran terlebih dahulu.');
      return;
    }
    if (!catatanPengamatan.trim()) {
      toast.error('Isi catatan pengamatan terlebih dahulu.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      // P1-A2: Use canonical backend contract — tpItems (not tujuanPembelajaran)
      const res = await fetch('/api/v1/kktp/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tpItems: tpItems.map((t, idx) => ({ index: idx, id: t.id, teks: t.teks })),
          catatanPengamatan: catatanPengamatan.trim(),
          mataPelajaran: selectedSubjectName,
          kelasRombel: selectedClassName,
          namaMurid: selectedStudentName,
        }),
      });
      let json: any;
      try {
        json = await res.json();
      } catch {
        setAiError('Respons server tidak valid. Coba lagi.');
        return;
      }
      if (!res.ok || !json.success) {
        setAiError(json?.message || 'Gagal menganalisis catatan observasi.');
        return;
      }

      const source: 'GEMINI' | 'FALLBACK' = json.data.source || 'GEMINI';
      setAiSource(source);

      const results: Array<{
        tpIndex: number;
        tpId: string;
        nilai: number | null;
        deskripsi: string;
        evidenceStatus: KKTPEvidenceStatus;
        evidenceReason?: string;
      }> = json.data.tpResults || [];

      setTpItems((prev) =>
        prev.map((item, idx) => {
          const r = results.find((res) => res.tpId === item.id || res.tpIndex === idx);
          if (!r) return item;
          return {
            ...item,
            nilai: r.nilai !== null && r.nilai !== undefined ? r.nilai : item.nilai,
            deskripsi: r.deskripsi || item.deskripsi,
            evidenceStatus: r.evidenceStatus || 'INSUFFICIENT',
            aiSuggested: true,
          };
        })
      );

      if (json.data.catatanTutor) setCatatanTutor(json.data.catatanTutor);
      if (json.data.pesanKemitraan) setPesanKemitraan(json.data.pesanKemitraan);
      if (json.data.catatanUmumAI) setAiCatatanUmum(json.data.catatanUmumAI);

      if (source === 'FALLBACK') {
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, "Analisis observasi menggunakan penilaian rubrik standar."));
      } else {
        toast.success('Analisis observasi berhasil dirumuskan oleh AI.');
      }
    } catch {
      setAiError('Gagal terhubung ke AI. Silakan gunakan penilaian mandiri.');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── TP Items modification handlers ───────────────────────────────────────
  const handleAddManualTP = () => {
    setTpItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        teks: '',
        sourceType: 'INDEPENDENT_MANUAL',
        nilai: null,   // P0: new TP starts unassessed
        deskripsi: '',
      },
    ]);
  };

  const handleUpdateTP = (id: string, field: keyof TPItem, value: any) => {
    setTpItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleRemoveTP = (id: string) => {
    setTpItems((prev) => prev.filter((t) => t.id !== id));
  };

  // ─── Auto-save & Save Document ────────────────────────────────────────────
  const buildPayload = useCallback(() => ({
    type: 'KKTP' as const,
    title: title.trim() || `KKTP ${selectedSubjectName} — ${selectedStudentName}`,
    class_id: selectedClassId || undefined,
    subject_id: selectedSubjectId || undefined,
    content: {
      identitas: {
        kelasRombel: selectedClassName,
        classId: selectedClassId,
        mataPelajaran: selectedSubjectName,
        subjectId: selectedSubjectId,
        tingkatFase: resolvePhaseByClassName(selectedClassName),
        namaMurid: selectedStudentName,
        studentId: selectedStudentId,
        nisn: selectedStudentNisn || undefined,
        // Letterhead snapshot: preserve existing (historical reprint) or capture active on new doc
        letterhead: activeDoc?.content?.identitas?.letterhead ||
          ((schoolSettings as any)?.active_letterhead_id
            ? {
                id: (schoolSettings as any).active_letterhead_id,
                url: (schoolSettings as any).active_letterhead_url || '/branding/school-letterhead.png',
                name: 'Kop Resmi Aktif',
                snapped_at: new Date().toISOString(),
              }
            : undefined),
      },
      tpItems,
      catatanTutor,
      pesanKemitraan,
    },
  }), [title, selectedClassId, selectedClassName, selectedSubjectId, selectedSubjectName,
      selectedStudentId, selectedStudentName, selectedStudentNisn, tpItems, catatanTutor,
      pesanKemitraan, activeDoc, schoolSettings]);


  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (tpItems.length === 0 && !title.trim()) return;
      const docId = autoSaveDraftIdRef.current || activeDoc?.id;
      setAutoSaveStatus('saving');
      try {
        const payload = buildPayload();
        const res = docId
          ? await fetch(`/api/v1/documents/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          : await fetch('/api/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) {
          autoSaveDraftIdRef.current = json.data.id;
          setAutoSaveStatus('saved');
        } else {
          setAutoSaveStatus('error');
        }
      } catch {
        setAutoSaveStatus('error');
      }
    }, 4000);
  }, [tpItems, title, activeDoc, buildPayload]);

  useEffect(() => {
    if (view !== 'WIZARD' || wizardStep !== 'FORM_KKTP') return;
    triggerAutoSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [view, wizardStep, triggerAutoSave, tpItems, catatanTutor, pesanKemitraan, title]);

  const handleSaveDocument = async () => {
    if (tpItems.length === 0) {
      toast.error('Tambahkan minimal 1 Tujuan Pembelajaran sebelum menyimpan.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const docId = autoSaveDraftIdRef.current || activeDoc?.id;
      const res = docId
        ? await fetch(`/api/v1/documents/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/v1/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Gagal menyimpan KKTP.');
        return;
      }

      toast.success(docId ? UX_COPY.crud.update('KKTP') : UX_COPY.crud.create('KKTP'));
      autoSaveDraftIdRef.current = undefined;
      setAutoSaveStatus('idle');

      // Return to Level 3 (Student List) if we have active class & subject
      if (activeClass && activeSubject) {
        setView('STUDENT_LIST');
        fetchStudentsForSubject(activeClass.id, activeSubject.id);
      } else {
        setView('CLASS_LIST');
        fetchClassSummaries();
      }
      fetchDocuments();
    } catch {
      toast.error('Gagal memproses dokumen KKTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKKTP = async (docId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(UX_COPY.crud.delete('KKTP'));
        setConfirmDeleteId(null);
        if (activeClass && activeSubject) {
          fetchStudentsForSubject(activeClass.id, activeSubject.id);
        }
        fetchDocuments();
      } else {
        toast.error(json.message || 'Gagal menghapus KKTP.');
      }
    } catch {
      toast.error('Terjadi kendala saat menghapus KKTP.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Print Handlers ───────────────────────────────────────────────────────
  const handleOpenPrint = async (doc: KKTPItem) => {
    setActiveDoc(doc);
    setBulkPrintDocs([]);
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/v1/app-settings');
      const json = await res.json();
      if (json.success) setSchoolSettings(json.data || {});
    } catch {
      // Fallback
    } finally {
      setLoadingSettings(false);
    }
    setView('PRINT');
  };

  const handleExecuteBulkPrint = async () => {
    setBulkPrintModalOpen(false);
    const createdStudents = studentSummaries.filter((s) => s.status === 'SUDAH_DIBUAT' && s.kktp_doc_id);
    if (createdStudents.length === 0) {
      toast.error('Belum ada KKTP yang dibuat di mata pelajaran ini.');
      return;
    }

    setIsBulkPrinting(true);
    try {
      const fetched: KKTPItem[] = [];
      for (const student of createdStudents) {
        const res = await fetch(`/api/v1/documents/${student.kktp_doc_id}`);
        const json = await res.json();
        if (json.success && json.data) {
          fetched.push(json.data);
        }
      }

      if (fetched.length === 0) {
        toast.error('Gagal memuat dokumen untuk dicetak.');
        return;
      }

      setBulkPrintDocs(fetched);
      setActiveDoc(null);

      // Load school settings
      const setRes = await fetch('/api/v1/app-settings');
      const setJson = await setRes.json();
      if (setJson.success) setSchoolSettings(setJson.data || {});

      setView('PRINT');
      setTimeout(() => {
        window.print();
        setIsBulkPrinting(false);
      }, 500);
    } catch {
      toast.error('Terjadi kendala saat memuat cetak massal.');
      setIsBulkPrinting(false);
    }
  };

  // ─── Aggregates for Desktop Strip (Cheap Client Computations) ─────────────
  const desktopStats = useMemo(() => {
    const totalClasses = classSummaries.length;
    const totalStudents = classSummaries.reduce((sum, c) => sum + (c.student_count || 0), 0);
    const totalKktp = classSummaries.reduce((sum, c) => sum + (c.total_kktp_count || 0), 0);
    const totalSubjects = classSummaries.reduce((sum, c) => sum + (c.subjects?.length || 0), 0);

    return {
      totalClasses,
      totalStudents,
      totalKktp,
      totalSubjects,
    };
  }, [classSummaries]);

  // Filtered Class Summaries
  const filteredClassSummaries = useMemo(() => {
    if (!classSearch.trim()) return classSummaries;
    const q = classSearch.toLowerCase();
    return classSummaries.filter(
      (c) =>
        c.class_name.toLowerCase().includes(q) ||
        (c.class_code && c.class_code.toLowerCase().includes(q))
    );
  }, [classSummaries, classSearch]);

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return classSubjects;
    const q = subjectSearch.toLowerCase();
    return classSubjects.filter(
      (s) =>
        s.subject_name.toLowerCase().includes(q) ||
        (s.subject_code && s.subject_code.toLowerCase().includes(q))
    );
  }, [classSubjects, subjectSearch]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentSummaries;
    const q = studentSearch.toLowerCase();
    return studentSummaries.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.includes(q))
    );
  }, [studentSummaries, studentSearch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 1: CLASS_LIST VIEW (Responsive Desktop Grid & Mobile Cards)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'CLASS_LIST') {
    return (
      <PageContainer maxWidth="7xl" className="space-y-6">
        {/* Page Header matching SIUBA Dashboard */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Modul Asesmen
              </span>
              <span className="text-xs text-gray-400">&bull;</span>
              <span className="text-xs text-gray-500 font-medium">Kurikulum Merdeka</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
              Assessment KKTP
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Kriteria Ketercapaian Tujuan Pembelajaran &mdash; kelola penilaian per kelas, mata pelajaran, dan murid.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={() => setView('LIST')}
              variant="secondary"
              size="sm"
              className="text-xs min-h-[38px] border-gray-200 shadow-xs hover:bg-gray-50"
            >
              <ClipboardList className="w-4 h-4 mr-1.5 text-gray-500" /> Semua Dokumen
            </Button>
            <Button
              onClick={handleStartWizard}
              size="sm"
              className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Buat KKTP
            </Button>
          </div>
        </div>

        {/* Desktop Aggregate Strip (KPIs) */}
        {!classSummaryLoading && classSummaries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Total Kelas</span>
                <School className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalClasses}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Rombel terdaftar</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Total Murid</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalStudents}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Siswa terdaftar</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">KKTP Dibuat</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700 font-fredoka">{desktopStats.totalKktp}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Dokumen selesai</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-semibold">Mata Pelajaran</span>
                <BookOpen className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalSubjects}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Mapel terpetakan</p>
            </div>
          </div>
        )}

        {/* Toolbar with quick search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/60 p-2.5 rounded-xl border border-gray-200/70">
          <div className="relative w-full sm:w-80">
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
          <p className="text-xs text-gray-500 px-1 font-medium w-full sm:w-auto text-right">
            Menampilkan <span className="font-bold text-gray-800">{filteredClassSummaries.length}</span> dari {classSummaries.length} kelas
          </p>
        </div>

        {/* Class Cards Grid */}
        {classSummaryLoading ? (
          <div className="flex flex-col justify-center items-center p-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs text-gray-500 font-medium">Memuat data kelas KKTP...</p>
          </div>
        ) : filteredClassSummaries.length === 0 ? (
          <Card className="text-center p-12 bg-white">
            <div className="space-y-3 py-4 max-w-md mx-auto">
              <School className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="font-bold text-base text-gray-800">
                {classSearch ? 'Kelas tidak ditemukan' : 'Belum Ada Kelas'}
              </h3>
              <p className="text-xs text-gray-500">
                {classSearch
                  ? `Tidak ada kelas yang cocok dengan kata kunci "${classSearch}".`
                  : 'Anda belum ditugaskan ke kelas manapun. Hubungi administrator untuk penugasan kelas.'}
              </p>
              {classSearch && (
                <Button size="sm" variant="secondary" onClick={() => setClassSearch('')} className="mt-2 text-xs">
                  Reset Pencarian
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredClassSummaries.map((cls) => {
              return (
                <div
                  key={cls.class_id}
                  className="bg-white rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 flex-1">
                    {/* Top meta */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            Tingkat {cls.class_level}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">{cls.class_code}</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {cls.class_name}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                        <School className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Enrolled students count */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium mb-3.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{cls.student_count} Murid Terdaftar</span>
                    </div>

                    {/* Mata Pelajaran Breakdown */}
                    <div className="space-y-1.5 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-1">
                        <span>Mata Pelajaran</span>
                        <span>Progress KKTP</span>
                      </div>
                      {cls.subjects && cls.subjects.length > 0 ? (
                        <div className="space-y-1.5">
                          {cls.subjects.slice(0, 3).map((subj) => {
                            const isFull = cls.student_count > 0 && subj.created_count >= cls.student_count;
                            return (
                              <div
                                key={subj.subject_id}
                                className="flex items-center justify-between text-xs text-gray-700 bg-gray-50/80 px-2.5 py-1.5 rounded-lg border border-gray-100"
                              >
                                <span className="truncate pr-2 font-medium">{subj.subject_name}</span>
                                <span className={`text-[11px] font-bold shrink-0 ${isFull ? 'text-emerald-700' : 'text-gray-600'}`}>
                                  {subj.created_count} / {cls.student_count}
                                </span>
                              </div>
                            );
                          })}
                          {cls.subjects.length > 3 && (
                            <p className="text-[10px] text-gray-400 text-right font-medium pr-1">
                              +{cls.subjects.length - 3} mapel lainnya
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic py-1">Belum ada mapel terdaftar</p>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="border-t border-gray-100 p-4 bg-gray-50/40">
                    <Button
                      className="w-full min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                      onClick={() => handleSelectClass(cls)}
                    >
                      Buka Kelas <ChevronRight className="w-4 h-4 ml-1.5" />
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
  // LEVEL 2: SUBJECT_LIST VIEW (Responsive Grid)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'SUBJECT_LIST' && activeClass) {
    return (
      <PageContainer maxWidth="7xl" className="space-y-6">
        {/* Breadcrumb matching SIUBA hierarchy */}
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <button
            onClick={() => {
              setView('CLASS_LIST');
              setActiveClass(null);
            }}
            className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> KKTP
          </button>
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <span className="font-bold text-gray-900">{activeClass.name}</span>
        </div>

        {/* Class Details Banner */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                Tingkat {activeClass.level}
              </span>
              <span className="text-xs text-gray-400">{activeClass.code}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
              {activeClass.name}
            </h1>
            <p className="text-xs text-gray-500">
              {activeClass.student_count || 0} Murid Terdaftar &bull; Pilih mata pelajaran untuk mengelola asesmen KKTP.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setView('CLASS_LIST');
                setActiveClass(null);
              }}
              className="text-xs min-h-[38px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Ganti Kelas
            </Button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/60 p-2.5 rounded-xl border border-gray-200/70">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari mata pelajaran..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {subjectSearch && (
              <button onClick={() => setSubjectSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 px-1 font-medium w-full sm:w-auto text-right">
            Menampilkan <span className="font-bold text-gray-800">{filteredSubjects.length}</span> dari {classSubjects.length} mata pelajaran
          </p>
        </div>

        {/* Subject Cards Grid */}
        {classSubjectsLoading ? (
          <div className="flex flex-col justify-center items-center p-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs text-gray-500 font-medium">Memuat mata pelajaran...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <Card className="text-center p-12 bg-white">
            <div className="space-y-3 py-4 max-w-md mx-auto">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="font-bold text-base text-gray-800">
                {subjectSearch ? 'Mata pelajaran tidak ditemukan' : 'Belum Ada Mata Pelajaran'}
              </h3>
              <p className="text-xs text-gray-500">
                {subjectSearch
                  ? `Tidak ada mata pelajaran yang cocok dengan kata kunci "${subjectSearch}".`
                  : 'Belum ada mata pelajaran yang terdaftar untuk kelas ini.'}
              </p>
              {subjectSearch && (
                <Button size="sm" variant="secondary" onClick={() => setSubjectSearch('')} className="mt-2 text-xs">
                  Reset Pencarian
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredSubjects.map((subj) => {
              const pct = subj.student_count > 0 ? Math.round((subj.created_count / subj.student_count) * 100) : 0;
              const isFull = subj.student_count > 0 && subj.created_count >= subj.student_count;

              return (
                <div
                  key={subj.subject_id}
                  className="bg-white rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold mb-1.5 inline-block">
                          {subj.subject_code || 'Mapel'}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {subj.subject_name}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="mt-4 mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                        <span className={`font-bold ${isFull ? 'text-emerald-700' : 'text-gray-700'}`}>
                          {subj.created_count} / {subj.student_count} KKTP dibuat
                        </span>
                        <span className="text-xs font-bold text-gray-500">{pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isFull ? 'bg-emerald-600' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-4 bg-gray-50/40">
                    <Button
                      className="w-full min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                      onClick={() => handleSelectSubject(subj)}
                    >
                      Buka Mapel <ChevronRight className="w-4 h-4 ml-1.5" />
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
  // LEVEL 3: STUDENT_LIST VIEW (Responsive Dual-Presentation: Table on Desktop, Cards on Mobile)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'STUDENT_LIST' && activeClass && activeSubject) {
    const createdStudents = studentSummaries.filter((s) => s.status === 'SUDAH_DIBUAT');
    const completionPct = studentSummaries.length > 0 ? Math.round((createdStudents.length / studentSummaries.length) * 100) : 0;

    return (
      <PageContainer maxWidth="7xl" className="space-y-6">
        {/* Bulk print modal */}
        {bulkPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Cetak Semua KKTP</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{activeClass.name} &bull; {activeSubject.name}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-3.5 text-xs space-y-2 bg-gray-50">
                <p className="flex items-center gap-2 text-emerald-800 font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><b>{createdStudents.length} murid</b> sudah dibuat (siap dicetak).</span>
                </p>
                {studentSummaries.length - createdStudents.length > 0 && (
                  <p className="flex items-center gap-2 text-gray-500">
                    <X className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>{studentSummaries.length - createdStudents.length} murid belum dibuat (tidak disertakan).</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 min-h-[40px] text-xs"
                  onClick={() => setBulkPrintModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  disabled={isBulkPrinting || createdStudents.length === 0}
                  onClick={handleExecuteBulkPrint}
                >
                  {isBulkPrinting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Printer className="w-4 h-4 mr-1.5" />}
                  Cetak Semua ({createdStudents.length})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium flex-wrap">
          <button
            onClick={() => {
              setView('CLASS_LIST');
              setActiveClass(null);
              setActiveSubject(null);
            }}
            className="hover:text-emerald-600 transition-colors"
          >
            KKTP
          </button>
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <button
            onClick={() => {
              setView('SUBJECT_LIST');
              setActiveSubject(null);
              fetchClassSubjects(activeClass.id);
            }}
            className="hover:text-emerald-600 transition-colors"
          >
            {activeClass.name}
          </button>
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <span className="font-bold text-gray-900">{activeSubject.name}</span>
        </div>

        {/* Header Summary Card */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                  {activeClass.name}
                </span>
                <span className="text-xs text-gray-400">&bull;</span>
                <span className="text-xs text-gray-600 font-semibold">{activeSubject.name}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
                Daftar Asesmen Murid
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {studentSummaries.length} Murid &bull; {createdStudents.length} / {studentSummaries.length} KKTP dibuat ({completionPct}%)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {createdStudents.length > 0 && (
                <Button
                  size="sm"
                  className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                  onClick={() => setBulkPrintModalOpen(true)}
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Cetak Semua ({createdStudents.length})
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="min-h-[38px] text-xs"
                onClick={() => {
                  setView('SUBJECT_LIST');
                  setActiveSubject(null);
                  fetchClassSubjects(activeClass.id);
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Ganti Mapel
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Toolbar & Student Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/60 p-2.5 rounded-xl border border-gray-200/70">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau NISN murid..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {studentSearch && (
              <button onClick={() => setStudentSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 px-1 font-medium w-full sm:w-auto text-right">
            Menampilkan <span className="font-bold text-gray-800">{filteredStudents.length}</span> dari {studentSummaries.length} murid
          </p>
        </div>

        {studentSummariesLoading ? (
          <div className="flex flex-col justify-center items-center p-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs text-gray-500 font-medium">Memuat data murid...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card className="text-center p-12 bg-white">
            <div className="space-y-3 py-4 max-w-md mx-auto">
              <Users className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="font-bold text-base text-gray-800">
                {studentSearch ? 'Murid tidak ditemukan' : 'Belum Ada Murid'}
              </h3>
              <p className="text-xs text-gray-500">
                {studentSearch
                  ? `Tidak ada murid yang cocok dengan kata kunci "${studentSearch}".`
                  : 'Belum ada murid aktif yang terdaftar di kelas ini.'}
              </p>
              {studentSearch && (
                <Button size="sm" variant="secondary" onClick={() => setStudentSearch('')} className="mt-2 text-xs">
                  Reset Pencarian
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* ── DESKTOP VIEW: High-Productivity Tabular List (hidden md:block) ── */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-12 text-center">No</th>
                      <th className="py-3.5 px-4">Nama Murid</th>
                      <th className="py-3.5 px-4 w-36">Status KKTP</th>
                      <th className="py-3.5 px-4">Judul Dokumen</th>
                      <th className="py-3.5 px-4 w-52 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map((student, idx) => {
                      const isCreated = student.status === 'SUDAH_DIBUAT';
                      const badge = getKKTPStatusBadge(student.status);

                      return (
                        <tr key={student.student_id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                                {student.student_name.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{student.student_name}</p>
                                {student.nisn ? (
                                  <p className="text-[11px] text-gray-400">NISN: {student.nisn}</p>
                                ) : (
                                  <p className="text-[11px] text-gray-300">NISN belum diisi</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-bold ${badge.colorClass}`}>
                              {isCreated && <Check className="w-3 h-3" />}
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {student.kktp_doc_title ? (
                              <p className="text-gray-700 font-medium truncate max-w-xs">{student.kktp_doc_title}</p>
                            ) : (
                              <span className="text-gray-300 italic">&mdash;</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isCreated ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 text-xs font-semibold hover:bg-gray-100"
                                    onClick={() => handleEditStudentKKTP(student)}
                                  >
                                    <Edit className="w-3.5 h-3.5 mr-1 text-gray-600" /> Buka / Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={async () => {
                                      if (student.kktp_doc_id) {
                                        const res = await fetch(`/api/v1/documents/${student.kktp_doc_id}`);
                                        const json = await res.json();
                                        if (json.success && json.data) handleOpenPrint(json.data);
                                      }
                                    }}
                                  >
                                    <Printer className="w-3.5 h-3.5 mr-1" /> Cetak
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                  onClick={() => handleStartCreateForStudent(student)}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Buat KKTP
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── MOBILE VIEW: Compact Stacked Cards (md:hidden) ── */}
            <div className="md:hidden space-y-3">
              {filteredStudents.map((student) => {
                const isCreated = student.status === 'SUDAH_DIBUAT';
                const badge = getKKTPStatusBadge(student.status);

                return (
                  <div
                    key={student.student_id}
                    className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{student.student_name}</p>
                        {student.nisn && <p className="text-[11px] text-gray-400">NISN: {student.nisn}</p>}
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold shrink-0 ${badge.colorClass}`}>
                        {badge.label}
                      </span>
                    </div>

                    {student.kktp_doc_title && (
                      <p className="text-xs text-gray-500 truncate bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                        {student.kktp_doc_title}
                      </p>
                    )}

                    <div className="flex gap-2 pt-1 border-t border-gray-100">
                      {isCreated ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 min-h-[38px] text-xs font-semibold"
                            onClick={() => handleEditStudentKKTP(student)}
                          >
                            <Edit className="w-3.5 h-3.5 mr-1 text-gray-600" /> Buka / Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="min-h-[38px] px-3 text-xs font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={async () => {
                              if (student.kktp_doc_id) {
                                const res = await fetch(`/api/v1/documents/${student.kktp_doc_id}`);
                                const json = await res.json();
                                if (json.success && json.data) handleOpenPrint(json.data);
                              }
                            }}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full min-h-[38px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleStartCreateForStudent(student)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Buat KKTP
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PRINT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'PRINT') {
    const docsToPrint = bulkPrintDocs.length > 0 ? bulkPrintDocs : activeDoc ? [activeDoc] : [];

    const handleBackFromPrint = () => {
      if (activeClass && activeSubject) {
        setView('STUDENT_LIST');
      } else {
        setView('CLASS_LIST');
      }
    };

    const schoolName = schoolSettings.school_name || '[Nama PKBM belum dikonfigurasi di Pengaturan Aplikasi]';
    const schoolSub = schoolSettings.school_sub_header || '[Alamat & izin operasional belum dikonfigurasi]';

    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 print:p-0">
        {/* Toolbar */}
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <Button variant="secondary" onClick={handleBackFromPrint} size="sm" className="min-h-[38px] text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar Murid
          </Button>
          <Button onClick={() => window.print()} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold" size="sm">
            <Printer className="w-4 h-4 mr-2" /> Cetak Dokumen ({docsToPrint.length})
          </Button>
        </div>

        {/* Petunjuk Cetak Resmi (Screen Only) */}
        <PrintBrowserHint />

        {/* Dokumen Cetak List */}
        <div className="space-y-8 print:space-y-0">
          {docsToPrint.map((doc, docIdx) => {
            const tps = doc.content?.tpItems || [];
            const scoredTps = tps.filter((t) => typeof t.nilai === 'number');
            const avg = scoredTps.length > 0
              ? Math.round(scoredTps.reduce((s, t) => s + (t.nilai as number), 0) / scoredTps.length)
              : null;
            const avgKategori = avg !== null ? getKategori(avg) : { label: 'Belum Lengkap', color: '' };
            const identitas = doc.content?.identitas || {};
            const docNumber = `KKTP/${doc.id.slice(0, 8).toUpperCase()}`;
            const tutorName = doc.author_name || 'Tutor Pembimbing BLC';

            return (
              <div
                key={doc.id}
                className={`bg-white text-black p-8 print:p-0 print:shadow-none shadow-lg rounded-xl print:rounded-none ${
                  docIdx < docsToPrint.length - 1 ? 'print:break-after-page' : ''
                }`}
              >
                {/* KOP SURAT RESMI */}
                <div className="mb-4">
                  <OfficialSchoolLetterhead
                    src={doc.content?.identitas?.letterhead?.url || (schoolSettings as any)?.active_letterhead_url || "/branding/school-letterhead.png"}
                    schoolSettings={schoolSettings}
                  />
                </div>

                <div className="text-center mb-4 border-t-2 border-emerald-800 pt-2 print:border-emerald-800 print-break-inside-avoid">
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-emerald-950">
                    LEMBAR PENILAIAN KKTP
                  </h2>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">
                    Kriteria Ketercapaian Tujuan Pembelajaran
                  </p>
                </div>

                {/* INFO DOKUMEN / IDENTITAS MURID */}
                <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/30 text-xs mb-4 print:border-gray-300 print:bg-transparent print-break-inside-avoid">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
                      <span className="font-semibold text-gray-600">Nama Murid</span>
                      <span className="font-bold text-gray-900">: {identitas.namaMurid || '-'}</span>
                    </div>
                    <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
                      <span className="font-semibold text-gray-600">Mata Pelajaran</span>
                      <span className="font-bold text-gray-900">: {identitas.mataPelajaran || '-'}</span>
                    </div>
                    <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
                      <span className="font-semibold text-gray-600">NISN</span>
                      <span className="font-bold text-gray-900">: {identitas.nisn || (studentSummaries.find(s => s.student_id === identitas.studentId)?.nisn) || '-'}</span>
                    </div>
                    <div className="flex items-baseline justify-between border-b border-emerald-100/60 pb-1 print:border-gray-200">
                      <span className="font-semibold text-gray-600">Fase / Kelas</span>
                      <span className="font-bold text-gray-900">: {identitas.tingkatFase || resolvePhaseByClassName(identitas.kelasRombel) || '-'} ({identitas.kelasRombel || '-'})</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="font-semibold text-gray-600">Tutor Pengampu</span>
                      <span className="font-bold text-gray-900">: {tutorName}</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="font-semibold text-gray-600">No. Dokumen</span>
                      <span className="font-medium text-gray-700">: {docNumber}</span>
                    </div>
                  </div>
                </div>

                {/* TABEL TP */}
                <div className="mb-4 border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-emerald-50/70 print:bg-gray-100 text-emerald-950 print:text-gray-900 border-b border-gray-300">
                      <tr>
                        <th className="border-r border-gray-300 p-2 text-center w-8 font-bold">No</th>
                        <th className="border-r border-gray-300 p-2 text-left font-bold">Tujuan Pembelajaran (TP)</th>
                        <th className="border-r border-gray-300 p-2 text-center w-16 font-bold">Nilai</th>
                        <th className="border-r border-gray-300 p-2 text-center w-32 font-bold">Kategori KKTP</th>
                        <th className="p-2 text-left font-bold">Deskripsi Ketercapaian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {tps.map((tp, idx) => {
                        const kat = getKategori(tp.nilai);
                        const hasScore = typeof tp.nilai === 'number';
                        return (
                          <tr key={tp.id} className={`print-break-inside-avoid ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40 print:bg-transparent'}`}>
                            <td className="border-r border-gray-300 p-2 text-center font-semibold text-gray-700">{idx + 1}</td>
                            <td className="border-r border-gray-300 p-2 text-gray-900 leading-relaxed font-medium">{tp.teks || '-'}</td>
                            <td className="border-r border-gray-300 p-2 text-center">
                              {hasScore ? (
                                <span className="font-bold text-sm text-gray-900 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 print:border-none print:bg-transparent">
                                  {tp.nilai}
                                </span>
                              ) : (
                                <span className="text-gray-400 font-medium">-</span>
                              )}
                            </td>
                            <td className="border-r border-gray-300 p-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${kat.color} print:border print:bg-transparent`}>
                                {kat.label}
                              </span>
                            </td>
                            <td className="p-2 text-[11px] text-gray-800 leading-relaxed">
                              {tp.deskripsi || (hasScore ? getDeskripsi(tp.nilai, tp.teks) : 'Belum dinilai')}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Rata-Rata Row */}
                      <tr className="bg-emerald-50/50 print:bg-gray-100 font-semibold border-t-2 border-emerald-700 print:border-gray-400 print-break-inside-avoid">
                        <td colSpan={2} className="border-r border-gray-300 p-2 text-right text-xs font-bold text-emerald-950 print:text-black">
                          Rata-Rata Akhir:
                        </td>
                        <td className="border-r border-gray-300 p-2 text-center">
                          <span className="font-black text-sm text-emerald-950 px-1.5 py-0.5 rounded bg-emerald-100/70 border border-emerald-300 print:border-none print:bg-transparent">
                            {avg !== null ? avg : '-'}
                          </span>
                        </td>
                        <td className="border-r border-gray-300 p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${avgKategori.color} print:border print:bg-transparent`}>
                            {avgKategori.label}
                          </span>
                        </td>
                        <td className="p-2 text-xs text-gray-700 leading-snug">
                          {avg !== null
                            ? (avg >= 76 ? 'Murid mencapai ketuntasan minimal secara keseluruhan.' : 'Murid memerlukan bimbingan lanjutan.')
                            : 'Sebagian atau seluruh Tujuan Pembelajaran belum dinilai.'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* CATATAN TUTOR */}
                <div className="mb-3 border-l-4 border-blue-500 bg-blue-50/30 p-3 rounded-r-lg print:border-blue-500 print:bg-transparent print-break-inside-avoid">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900 uppercase mb-1">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Catatan Tutor</span>
                  </div>
                  <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed pl-5">
                    {doc.content?.catatanTutor || '—'}
                  </p>
                </div>

                {/* PESAN KEMITRAAN */}
                <div className="mb-6 border-l-4 border-amber-500 bg-amber-50/40 p-3 rounded-r-lg print:border-amber-500 print:bg-transparent print-break-inside-avoid">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 uppercase mb-1">
                    <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pesan Kemitraan untuk Orang Tua / Wali</span>
                  </div>
                  <p className="text-xs text-gray-800 italic whitespace-pre-wrap leading-relaxed pl-5">
                    {doc.content?.pesanKemitraan || '—'}
                  </p>
                </div>

                {/* 3 BLOK TANDA TANGAN BASAH */}
                <div className="mt-8 pt-4 border-t border-gray-300 print-break-inside-avoid">
                  <div className="flex justify-between items-start text-xs text-center px-2">
                    <div className="w-48">
                      <p className="mb-16 leading-snug">
                        Mengetahui,<br />
                        <span className="font-semibold">Orang Tua / Wali Murid</span>
                      </p>
                      <div className="border-b border-black w-36 mx-auto mb-1" />
                      <p className="text-[11px] text-gray-600">(.................................)</p>
                    </div>

                    <div className="w-52">
                      <p className="mb-16 leading-snug">
                        Disusun oleh,<br />
                        <span className="font-semibold">Tutor Pengampu</span>
                      </p>
                      <p className="font-bold underline">{tutorName}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        ID: {doc.author_nip || doc.author_nuptk || '........................................'}
                      </p>
                    </div>

                    <div className="w-48">
                      <p className="mb-16 leading-snug">
                        Mengetahui,<br />
                        <span className="font-semibold">Kepala PKBM BLC</span>
                      </p>
                      <p className="font-bold underline">
                        {schoolSettings.school_headmaster_name || "......................................"}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        NIP/ID. {schoolSettings.school_headmaster_nip || "........................................"}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-2 print:border-t-0">
                    Dicetak secara otomatis melalui Sistem SIUBA &bull; {docNumber} &bull; {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: WIZARD / FORM_KKTP (Responsive 2-Column Desktop Editor & Mobile Flow)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'WIZARD') {
    const handleBackFromWizard = () => {
      if (wizardStep === 'FORM_KKTP') {
        if (activeClass && activeSubject) {
          setView('STUDENT_LIST');
          fetchStudentsForSubject(activeClass.id, activeSubject.id);
          return;
        }
        setWizardStep('SELECT_STUDENT');
      } else if (wizardStep === 'SELECT_STUDENT') {
        setWizardStep('SELECT_SUBJECT');
      } else if (wizardStep === 'SELECT_SUBJECT') {
        setWizardStep('SELECT_CLASS');
      } else {
        setView('CLASS_LIST');
      }
    };

    return (
      <PageContainer maxWidth="7xl" className="space-y-6">
        {/* ── Modal Bank TP ── */}
        {showBankTpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-50/60 to-teal-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 shadow-xs">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight">Bank Tujuan Pembelajaran (TP)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Pilih dan gunakan kembali TP yang tersimpan.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBankTpModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Bar */}
              <div className="p-4 border-b border-gray-100 bg-gray-50/60 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari teks TP..."
                    value={bankTpSearch}
                    onChange={(e) => {
                      setBankTpSearch(e.target.value);
                      fetchBankTPs(bankTpFilterSubject, bankTpFilterFase, e.target.value);
                    }}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* Body List */}
              <div className="p-4 overflow-y-auto flex-1 space-y-2 max-h-[50vh]">
                {bankTpLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                  </div>
                ) : bankTpList.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Database className="w-10 h-10 mx-auto text-gray-300" />
                    <p className="text-xs font-semibold text-gray-600">Belum ada TP di Bank untuk filter ini.</p>
                  </div>
                ) : (
                  bankTpList.map((item) => {
                    const isSelected = selectedBankTpIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleBankTpSelection(item.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 shadow-xs"
                            : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleBankTpSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 rounded text-emerald-600 focus:ring-emerald-400"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 leading-relaxed">{item.teks}</p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                            {item.mata_pelajaran_name && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                                {item.mata_pelajaran_name}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                              {item.fase || 'Fase C'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500 font-medium">{selectedBankTpIds.length} TP dipilih</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowBankTpModal(false)}>Batal</Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                    onClick={handleApplyBankTPs}
                    disabled={selectedBankTpIds.length === 0}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Gunakan TP Terpilih ({selectedBankTpIds.length})
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header + Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleBackFromWizard} className="min-h-[36px] text-xs">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {wizardStep === 'FORM_KKTP' ? 'Kembali' : 'Batal'}
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 font-plus-jakarta">
                {wizardStep === 'SELECT_CLASS' && 'Langkah 1 — Pilih Kelas'}
                {wizardStep === 'SELECT_SUBJECT' && `Langkah 2 — Pilih Mata Pelajaran`}
                {wizardStep === 'SELECT_STUDENT' && `Langkah 3 — Pilih Murid`}
                {wizardStep === 'FORM_KKTP' && 'Penyusunan Asesmen KKTP'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            {autoSaveStatus === 'saving' && <span className="flex items-center gap-1 text-emerald-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan draf...</span>}
            {autoSaveStatus === 'saved' && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Draf tersimpan otomatis</span>}
            {autoSaveStatus === 'error' && <span className="flex items-center gap-1 text-amber-600"><WifiOff className="w-3.5 h-3.5" /> Draf belum tersinkronisasi</span>}
          </div>
        </div>

        {/* STEP 1: PILIH KELAS (Generic fallback) */}
        {wizardStep === 'SELECT_CLASS' && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Pilih Rombongan Belajar / Kelas</h2>
                <p className="text-xs text-gray-500">Pilih kelas yang akan dinilai kriteria ketercapaian pembelajarannya.</p>
              </div>
              <div className="p-4 space-y-2">
                {loadingStep ? (
                  <div className="flex justify-center p-12"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
                ) : (
                  classOptions.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        setSelectedClassName(cls.name);
                        loadSubjectOptions(cls.id);
                        setWizardStep('SELECT_SUBJECT');
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          <School className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors">{cls.name}</span>
                          {cls.code && <span className="text-xs text-gray-400 ml-2">({cls.code})</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* STEP 2: PILIH MAPEL */}
        {wizardStep === 'SELECT_SUBJECT' && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Pilih Mata Pelajaran</h2>
                <p className="text-xs text-gray-500">Kelas: <span className="font-semibold text-gray-800">{selectedClassName}</span></p>
              </div>
              <div className="p-4 space-y-2">
                {loadingStep ? (
                  <div className="flex justify-center p-12"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
                ) : (
                  subjectOptions.map((subj) => (
                    <button
                      key={subj.id}
                      onClick={() => {
                        setSelectedSubjectId(subj.id);
                        setSelectedSubjectName(subj.name);
                        loadStudentOptions(selectedClassId);
                        loadRpmForContext(selectedClassId, subj.name);
                        setWizardStep('SELECT_STUDENT');
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors">{subj.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* STEP 3: PILIH MURID */}
        {wizardStep === 'SELECT_STUDENT' && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">Pilih Murid</h2>
                <p className="text-xs text-gray-500">
                  {selectedClassName} &bull; <span className="font-semibold text-gray-800">{selectedSubjectName}</span>
                </p>
              </div>
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {loadingStep ? (
                  <div className="flex justify-center p-12"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
                ) : (
                  studentOptions.map((stu) => (
                    <button
                      key={stu.id}
                      onClick={() => {
                        setSelectedStudentId(stu.id);
                        setSelectedStudentName(stu.full_name);
                        setSelectedStudentNisn(stu.nisn || null);
                        setTitle(`KKTP ${selectedSubjectName} — ${stu.full_name}`);
                        setWizardStep('FORM_KKTP');
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          {stu.full_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors">{stu.full_name}</span>
                          {stu.nisn && <span className="text-xs text-gray-400 ml-2">NISN: {stu.nisn}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* STEP 4: FORM KKTP (Responsive 2-Column Grid on Desktop, Single Column on Mobile) */}
        {wizardStep === 'FORM_KKTP' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── Main Editor Column (8 cols on desktop) ── */}
            <div className="lg:col-span-8 space-y-6">
              {/* Document Title */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Judul Dokumen KKTP
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: KKTP IPAS — Muhammad Raihan"
                  className="text-sm font-semibold bg-white"
                />
              </div>

              {/* Tujuan Pembelajaran List */}
              <Card className="bg-white shadow-xs">
                <div className="p-5 flex flex-row items-center justify-between pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">
                      Tujuan Pembelajaran & Kriteria Ketercapaian
                    </h3>
                    <p className="text-xs text-gray-500">
                      Tentukan nilai dan deskripsi ketercapaian untuk masing-masing tujuan pembelajaran.
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={handleOpenBankTp} className="text-xs h-8">
                      <Database className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Bank TP
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowTpAiPanel(!showTpAiPanel)}
                      className="text-xs h-8 text-violet-700 border-violet-200 hover:bg-violet-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Rekomendasi AI
                    </Button>
                    <Button size="sm" onClick={handleAddManualTP} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah TP
                    </Button>
                  </div>
                </div>

                {/* AI TP Recommendations Sub-panel */}
                {showTpAiPanel && (
                  <div className="p-4 bg-violet-50/60 border-b border-violet-100 space-y-3">
                    <p className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" /> Hasilkan Rekomendasi TP dengan AI
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Masukkan materi / topik..."
                        value={tpAiTopik}
                        onChange={(e) => setTpAiTopik(e.target.value)}
                        className="text-xs bg-white"
                      />
                      <Button
                        onClick={handleGenerateTpSuggestions}
                        disabled={tpAiLoading}
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 text-xs"
                      >
                        {tpAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buat Saran'}
                      </Button>
                    </div>
                    {tpAiSuggestions.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        {tpAiSuggestions.map((s, idx) => (
                          <label key={idx} className="flex items-start gap-2 text-xs cursor-pointer p-1.5 hover:bg-white/80 rounded-lg">
                            <input
                              type="checkbox"
                              checked={s.checked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setTpAiSuggestions((prev) => prev.map((item, i) => (i === idx ? { ...item, checked } : item)));
                              }}
                              className="mt-0.5 rounded text-violet-600"
                            />
                            <span className="text-gray-800">{s.teks}</span>
                          </label>
                        ))}
                        <Button onClick={handleApplyAiSuggestions} size="sm" className="w-full mt-2 bg-violet-700 hover:bg-violet-800 text-white text-xs">
                          Terapkan TP Terpilih ({tpAiSuggestions.filter((t) => t.checked).length})
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* TP Items List */}
                <div className="p-5 space-y-4">
                  {tpItems.length === 0 ? (
                    <div className="text-center py-10 space-y-2 border border-dashed rounded-xl">
                      <BookOpen className="w-9 h-9 mx-auto text-gray-300" />
                      <p className="text-xs font-semibold text-gray-600">Belum ada Tujuan Pembelajaran</p>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto">
                        Klik tombol Tambah TP, ambil dari Bank TP, atau gunakan rekomendasi AI.
                      </p>
                    </div>
                  ) : (
                    tpItems.map((tp, idx) => {
                      const kat = getKategori(tp.nilai);
                      return (
                        <div key={tp.id} className="border border-gray-200/90 rounded-xl p-4 space-y-3 bg-gray-50/50 shadow-2xs">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                              TP {idx + 1}
                            </span>
                            <Textarea
                              value={tp.teks}
                              onChange={(e) => handleUpdateTP(tp.id, 'teks', e.target.value)}
                              placeholder="Tulis deskripsi tujuan pembelajaran..."
                              rows={2}
                              className="text-xs bg-white flex-1"
                            />
                            <button
                              onClick={() => handleRemoveTP(tp.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                              title="Hapus TP ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Score section: slider + number input + deskripsi (P0/B restored) */}
                          <div className="space-y-3 pt-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-gray-600">Nilai (0–100)</label>
                              <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-bold ${kat.color}`}>
                                {kat.label}
                              </span>
                            </div>
                            {tp.nilai === null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-gray-200 opacity-50" />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTP(tp.id, 'nilai', 60)}
                                  className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                                >
                                  Mulai Nilai
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={tp.nilai}
                                  onChange={(e) => handleUpdateTP(tp.id, 'nilai', Number(e.target.value))}
                                  className="flex-1 accent-emerald-600 h-2 cursor-pointer"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={tp.nilai}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') return;
                                    handleUpdateTP(tp.id, 'nilai', Math.min(100, Math.max(0, Number(raw))));
                                  }}
                                  className="w-16 text-xs text-center border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-bold focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTP(tp.id, 'nilai', null)}
                                  title="Reset ke belum dinilai"
                                  className="shrink-0 text-[11px] text-gray-400 hover:text-red-500 transition-colors px-1"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                            <div>
                              <label className="block text-[11px] font-bold text-gray-600 mb-1">Deskripsi Ketercapaian</label>
                              <Input
                                value={tp.deskripsi || ''}
                                onChange={(e) => handleUpdateTP(tp.id, 'deskripsi', e.target.value)}
                                placeholder={getDeskripsi(tp.nilai, tp.teks)}
                                className="text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Catatan Tutor & Pesan Kemitraan */}
              <Card className="bg-white shadow-xs">
                <div className="p-5 border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 font-plus-jakarta">Catatan Evaluasi & Kemitraan</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Catatan Tutor / Narasi Evaluasi Perkembangan
                    </label>
                    <Textarea
                      value={catatanTutor}
                      onChange={(e) => setCatatanTutor(e.target.value)}
                      placeholder="Catatan perkembangan belajar murid selama proses pembelajaran..."
                      rows={3}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Pesan Kemitraan untuk Orang Tua / Wali
                    </label>
                    <Textarea
                      value={pesanKemitraan}
                      onChange={(e) => setPesanKemitraan(e.target.value)}
                      placeholder="Pesan kolaborasi pembimbingan di rumah untuk orang tua / wali..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1 min-h-[44px] text-xs font-semibold" onClick={handleBackFromWizard}>
                  Batal
                </Button>
                <Button
                  className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  onClick={handleSaveDocument}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Simpan Dokumen KKTP
                </Button>
              </div>
            </div>

            {/* ── Sticky Context & AI Tools Sidebar (4 cols on desktop) ── */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
              {/* Context Summary Card */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <User className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Identitas Konteks</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Nama Murid:</span>
                    <span className="font-bold text-gray-900">{selectedStudentName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Kelas:</span>
                    <span className="font-bold text-gray-800">{selectedClassName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Mata Pelajaran:</span>
                    <span className="font-bold text-gray-800">{selectedSubjectName}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 font-medium">Fase:</span>
                    <span className="font-bold text-emerald-700">{resolvePhaseByClassName(selectedClassName)}</span>
                  </div>
                </div>
              </div>

              {/* AI Auto-Formulate Assessment Panel */}
              <Card className="border-violet-200 bg-gradient-to-br from-violet-50/50 to-indigo-50/20 shadow-xs">
                <div className="p-4 pb-2 border-b border-violet-100/60">
                  <h3 className="text-xs font-bold text-violet-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-violet-600" /> Analisis Observasi AI
                  </h3>
                  <p className="text-[11px] text-violet-700 mt-0.5">
                    Masukkan catatan pengamatan belajar murid, AI akan merumuskan penilaian ketercapaian secara otomatis.
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  <Textarea
                    value={catatanPengamatan}
                    onChange={(e) => setCatatanPengamatan(e.target.value)}
                    placeholder="Contoh: Raihan sangat aktif saat praktik mandiri, mampu menjelaskan konsep dengan baik..."
                    rows={4}
                    className="text-xs bg-white border-violet-200 placeholder-violet-300"
                  />
                  {aiError && (
                    <p className="text-[11px] text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {aiError}
                    </p>
                  )}
                  {aiCatatanUmum && (
                    <p className="text-xs text-violet-800 italic bg-violet-100/70 p-2.5 rounded-lg border border-violet-200">
                      {aiCatatanUmum}
                    </p>
                  )}
                  <Button
                    onClick={handleGenerateAI}
                    disabled={aiLoading || tpItems.length === 0}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold min-h-[38px] shadow-xs"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                    Rumuskan Penilaian AI
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW (Flat legacy list fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <PageContainer maxWidth="7xl" className="space-y-6">
      {/* Modal konfirmasi hapus */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">Hapus Dokumen KKTP?</h3>
            <p className="text-xs text-gray-600">Dokumen yang dihapus tidak dapat dikembalikan lagi ke sistem.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1 text-xs" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
                Batal
              </Button>
              <Button variant="destructive" className="flex-1 text-xs" onClick={() => handleDeleteKKTP(confirmDeleteId)} loading={deleting}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <button
            onClick={() => setView('CLASS_LIST')}
            className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Tampilan Kelas
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">Semua Dokumen KKTP</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Daftar keseluruhan dokumen KKTP yang tersimpan di sistem PKBM.
          </p>
        </div>
        <Button onClick={handleStartWizard} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold">
          <Plus className="w-4 h-4 mr-1.5" /> Buat KKTP Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center p-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-gray-500 font-medium">Memuat dokumen KKTP...</p>
        </div>
      ) : documents.length === 0 ? (
        <Card className="text-center p-12 bg-white">
          <div className="space-y-3 py-6 max-w-md mx-auto">
            <FileText className="w-12 h-12 mx-auto text-emerald-600" />
            <h3 className="font-bold text-base text-gray-800">Belum Ada Dokumen KKTP</h3>
            <Button onClick={handleStartWizard} className="min-h-[40px] mt-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold">
              <Plus className="w-4 h-4 mr-1.5" /> Buat KKTP Pertama
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {documents.map((doc) => {
            const identitas = doc.content?.identitas || {};
            return (
              <Card key={doc.id} className="flex flex-col justify-between hover:shadow-md transition-shadow bg-white rounded-2xl border border-gray-200/90">
                <div className="p-5">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold border bg-emerald-100 text-emerald-800 border-emerald-200">
                      Sudah Dibuat
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">v{doc.version}</span>
                  </div>
                  <h3 className="text-sm font-bold line-clamp-2 text-gray-900">{doc.title}</h3>
                  <div className="text-xs text-gray-600 space-y-1 mt-3 pt-3 border-t border-gray-100">
                    <p><span className="font-semibold text-gray-500">Murid:</span> {identitas.namaMurid || '-'}</p>
                    <p><span className="font-semibold text-gray-500">Kelas:</span> {identitas.kelasRombel || '-'}</p>
                    <p><span className="font-semibold text-gray-500">Mapel:</span> {identitas.mataPelajaran || '-'}</p>
                  </div>
                </div>
                <CardFooter className="border-t border-gray-100 pt-3 flex gap-2 justify-between bg-gray-50/50 p-4">
                  <Button variant="secondary" size="sm" onClick={() => handleOpenPrint(doc)} className="min-h-[34px] text-xs">
                    <Printer className="w-3.5 h-3.5 mr-1" /> Cetak
                  </Button>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" className="min-h-[34px] text-xs" onClick={() => handleEditKKTP(doc)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" className="min-h-[34px] text-xs" onClick={() => setConfirmDeleteId(doc.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
