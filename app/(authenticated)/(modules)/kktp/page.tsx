"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { UX_COPY } from "@/lib/ux-copy";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Plus, FileText, ArrowLeft, Printer, CheckCircle,
  WifiOff, Trash2, Edit, User, BookOpen, School, ChevronRight,
  Link2, RefreshCw, Check, AlertTriangle, Sparkles, Database,
  Search, Filter, X, Bookmark, Tag
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AIUsageStatus, getAIErrorMessageByReason } from "@/components/ai/AIUsageStatus";
import { resolvePhaseByClassName } from "@/lib/utils/academicUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'SELECT_CLASS' | 'SELECT_SUBJECT' | 'SELECT_STUDENT' | 'FORM_KKTP';
type PageView = 'LIST' | 'WIZARD' | 'PRINT';

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

interface BankTPItem {
  id: string;
  teks: string;
  mata_pelajaran_id: string | null;
  mata_pelajaran_name: string | null;
  fase: string;
  sumber: "dari_rpm" | "manual";
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export type KKTPEvidenceStatus = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';

interface TPItem {
  id: string;
  teks: string;
  sourceType: 'LINKED_RPM' | 'INDEPENDENT_MANUAL' | 'AI_GENERATED';
  rpmRefId?: string;
  fromBank?: boolean;
  nilai: number | null; // 0-100 atau null jika belum dinilai / partial / insufficient
  deskripsi?: string; // Saran AI atau manual
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
    };
    tpItems: TPItem[];
    catatanTutor: string;
    pesanKemitraan: string;
    // Legacy KKTP fields — keep for backward compat
    sumberCPTP?: any;
    metodologi?: string;
    kriteria?: any;
    thresholdConfig?: any;
  };
}

interface AppSettings {
  school_name?: string;
  school_sub_header?: string;
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
  if (nilai === null || nilai === undefined) return "Belum ada penilaian.";
  if (nilai >= 90) return `Murid menunjukkan penguasaan sangat baik pada: "${teks.slice(0, 60)}…". Siap pengayaan.`;
  if (nilai >= 76) return `Murid mencapai ketuntasan minimal pada: "${teks.slice(0, 60)}…".`;
  if (nilai >= 60) return `Murid cukup memahami "${teks.slice(0, 50)}…", namun perlu penguatan.`;
  return `Murid memerlukan bimbingan intensif pada: "${teks.slice(0, 60)}…".`;
}

// ─── Slider + Number Input ─────────────────────────────────────────────────

function ScoreSlider({
  nilai,
  onChange,
}: {
  nilai: number | null;
  onChange: (v: number | null) => void;
}) {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const { label, color } = getKategori(nilai);

  return (
    <div className="space-y-2">
      {/* Slider track */}
      <div className="relative pt-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={nilai ?? 0}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
            nilai === null ? "accent-gray-400 bg-gray-200 opacity-60" : "accent-emerald-600"
          }`}
        />
        {/* Threshold labels */}
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 select-none">
          <span>0<br /><span className="text-red-400">Perlu Intervensi</span></span>
          <span className="text-center">76<br /><span className="text-blue-400">Tuntas</span></span>
          <span className="text-right">100<br /><span className="text-emerald-400">Sangat Baik</span></span>
        </div>
      </div>

      {/* Synced number input + category badge + reset button */}
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={100}
          placeholder="—"
          value={nilai ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              onChange(null);
            } else {
              onChange(clamp(Number(val)));
            }
          }}
          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${color}`}>
          {label}
        </span>
        {nilai !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] text-gray-400 hover:text-red-500 underline ml-auto"
            title="Hapus skor / Jadikan Belum Dinilai"
          >
            Hapus Skor
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function KKTPPage() {
  const { user } = useAuth();
  const isAdmin = user && ['administrator', 'admin'].includes(user.role);

  // ── View & Wizard state ──────────────────────────────────────────────────
  const [view, setView] = useState<PageView>('LIST');
  const [wizardStep, setWizardStep] = useState<WizardStep>('SELECT_CLASS');
  const [activeDoc, setActiveDoc] = useState<KKTPItem | null>(null);

  // ── List state ───────────────────────────────────────────────────────────
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

  // ─── Fetch documents ──────────────────────────────────────────────────────
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

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // ─── Wizard: Load Kelas ───────────────────────────────────────────────────
  const loadClassOptions = useCallback(async () => {
    setLoadingStep(true);
    try {
      if (isAdmin) {
        // Admin: ambil semua kelas
        const res = await fetch('/api/v1/classes?limit=50');
        const json = await res.json();
        const items = json.data?.data || json.data?.items || (Array.isArray(json.data) ? json.data : []);
        setClassOptions(items.map((c: any) => ({ id: c.id, name: c.name, code: c.code })));
      } else {
        // Teacher: ambil dari penugasan
        const res = await fetch(`/api/v1/class-teachers?limit=50`);
        const json = await res.json();
        const items = json.data?.data || json.data?.items || (Array.isArray(json.data) ? json.data : []);
        // Deduplicate by class_id
        const seen = new Set<string>();
        const classes: ClassOption[] = [];
        for (const a of items) {
          if (!seen.has(a.class_id)) {
            seen.add(a.class_id);
            classes.push({ id: a.class_id, name: a.class_name || a.class_id, code: a.class_code });
          }
        }
        setClassOptions(classes);
      }
    } catch {
      toast.error('Gagal memuat daftar kelas.');
    } finally {
      setLoadingStep(false);
    }
  }, [isAdmin]);

  // ─── Wizard: Load Mapel setelah Kelas dipilih ─────────────────────────────
  const loadSubjectOptions = useCallback(async (classId: string) => {
    setLoadingStep(true);
    try {
      // Ambil RPM milik guru untuk kelas ini → ekstrak mapel unik
      const params = new URLSearchParams({ type: 'RPM', class_id: classId });
      if (user && !isAdmin) params.set('author_id', user.id);
      const res = await fetch(`/api/v1/documents?${params.toString()}`);
      const json = await res.json();
      const items: any[] = json.data?.items || [];

      const seen = new Set<string>();
      const subjects: SubjectOption[] = [];
      for (const doc of items) {
        const mapel = doc.content?.identitas?.mataPelajaran;
        const subjId = doc.subject_id || mapel;
        if (mapel && !seen.has(mapel)) {
          seen.add(mapel);
          subjects.push({ id: subjId || mapel, name: mapel });
        }
      }

      // Fallback: kalau tidak ada RPM, pakai master subjects
      if (subjects.length === 0) {
        const resMaster = await fetch('/api/v1/subjects?limit=50');
        const jsonMaster = await resMaster.json();
        const masterItems = jsonMaster.data?.data || jsonMaster.data?.items || (Array.isArray(jsonMaster.data) ? jsonMaster.data : []);
        for (const s of masterItems) {
          subjects.push({ id: s.id, name: s.name });
        }
      }

      setSubjectOptions(subjects);
    } catch {
      toast.error('Gagal memuat daftar mata pelajaran.');
    } finally {
      setLoadingStep(false);
    }
  }, [user, isAdmin]);

  // ─── Wizard: Load Murid setelah Kelas dipilih ─────────────────────────────
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

  // ─── Wizard: Load RPM untuk kelas+mapel ──────────────────────────────────
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
      // Non-critical — guru bisa tetap input manual
    }
  }, []);

  // ─── Wizard handlers ──────────────────────────────────────────────────────

  const handleStartWizard = async () => {
    setWizardStep('SELECT_CLASS');
    setSelectedClassId('');
    setSelectedClassName('');
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setSelectedStudentId('');
    setSelectedStudentName('');
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

  const handleSelectClass = async (cls: ClassOption) => {
    setSelectedClassId(cls.id);
    setSelectedClassName(cls.name);
    await loadSubjectOptions(cls.id);

    // Auto-skip kelas jika hanya 1 (sudah di-load sebelumnya)
    // Setelah set subjectOptions → cek di useEffect
    setWizardStep('SELECT_SUBJECT');
  };

  // Auto-skip subject jika hanya 1 pilihan
  useEffect(() => {
    if (wizardStep === 'SELECT_SUBJECT' && subjectOptions.length === 1 && !loadingStep) {
      handleSelectSubject(subjectOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectOptions, wizardStep, loadingStep]);

  const handleSelectSubject = async (subj: SubjectOption) => {
    setSelectedSubjectId(subj.id);
    setSelectedSubjectName(subj.name);
    await loadStudentOptions(selectedClassId);
    await loadRpmForContext(selectedClassId, subj.name);
    setWizardStep('SELECT_STUDENT');
  };

  const handleSelectStudent = (student: StudentOption) => {
    setSelectedStudentId(student.id);
    setSelectedStudentName(student.full_name);
    // Set default title
    setTitle(`KKTP ${selectedSubjectName} — ${student.full_name}`);
    setWizardStep('FORM_KKTP');
  };

  // ─── RPM → TP Checkbox handling ──────────────────────────────────────────

  const handleSelectRpm = (rpmId: string) => {
    setSelectedRpmId(rpmId);
    const rpm = rpmList.find((r) => r.id === rpmId);
    if (rpm) {
      const tps: string[] = rpm.content?.desainPembelajaran?.tujuanPembelajaran || [];
      setRpmTpCheckboxes(tps.map((t) => ({ teks: t, checked: true })));
    }
  };

  const handleApplyRpmTp = () => {
    const selected = rpmTpCheckboxes.filter((t) => t.checked);
    if (selected.length === 0) {
      toast.error('Pilih minimal 1 Tujuan Pembelajaran dari RPM.');
      return;
    }
    const newItems: TPItem[] = selected.map((t) => ({
      id: crypto.randomUUID(),
      teks: t.teks,
      sourceType: 'LINKED_RPM',
      rpmRefId: selectedRpmId,
      nilai: 75,
      deskripsi: '',
    }));
    // Gabung dengan TP manual yang sudah ada (INDEPENDENT_MANUAL)
    setTpItems((prev) => [
      ...prev.filter((t) => t.sourceType === 'INDEPENDENT_MANUAL'),
      ...newItems,
    ]);
    toast.success(`${newItems.length} TP berhasil ditarik dari RPM.`);
  };

  // ─── Bank TP Handlers ─────────────────────────────────────────────────────

  const fetchBankTPs = useCallback(async (customSubject?: string, customFase?: string, customSearch?: string) => {
    setBankTpLoading(true);
    try {
      const params = new URLSearchParams();
      const s = customSubject !== undefined ? customSubject : bankTpFilterSubject;
      const f = customFase !== undefined ? customFase : bankTpFilterFase;
      const q = customSearch !== undefined ? customSearch : bankTpSearch;
      if (s) params.set('mata_pelajaran_name', s);
      if (f) params.set('fase', f);
      if (q) params.set('search', q);
      params.set('limit', '100');

      const res = await fetch(`/api/v1/tp-bank?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setBankTpList(json.data.data || []);
      }
    } catch {
      toast.error('Gagal memuat Bank TP.');
    } finally {
      setBankTpLoading(false);
    }
  }, [bankTpFilterSubject, bankTpFilterFase, bankTpSearch]);

  const handleOpenBankTp = async () => {
    const defaultSubject = selectedSubjectName || '';
    const defaultFase = resolvePhaseByClassName(selectedClassName);
    setBankTpFilterSubject(defaultSubject);
    setBankTpFilterFase(defaultFase);
    setBankTpSearch('');
    setSelectedBankTpIds([]);
    setShowBankTpModal(true);
    await fetchBankTPs(defaultSubject, defaultFase, '');
  };

  const handleToggleSelectBankTp = (id: string) => {
    setSelectedBankTpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleApplyBankTP = () => {
    const chosen = bankTpList.filter((b) => selectedBankTpIds.includes(b.id));
    if (chosen.length === 0) {
      toast.error('Pilih minimal 1 Tujuan Pembelajaran dari bank.');
      return;
    }
    const newItems: TPItem[] = chosen.map((b) => ({
      id: crypto.randomUUID(),
      teks: b.teks,
      sourceType: b.sumber === 'dari_rpm' ? 'LINKED_RPM' : 'INDEPENDENT_MANUAL',
      fromBank: true,
      nilai: 75,
      deskripsi: '',
    }));
    setTpItems((prev) => [...prev, ...newItems]);
    setShowBankTpModal(false);
    toast.success(`${newItems.length} TP dari Bank TP berhasil ditambahkan.`);
  };

  const handleDeleteBankTPItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingBankTpId(id);
    try {
      const res = await fetch(`/api/v1/tp-bank?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('TP berhasil dihapus dari bank.');
        setBankTpList((prev) => prev.filter((item) => item.id !== id));
        setSelectedBankTpIds((prev) => prev.filter((item) => item !== id));
      } else {
        toast.error(json.message || 'Gagal menghapus TP dari bank.');
      }
    } catch {
      toast.error('Gagal menghapus TP dari bank.');
    } finally {
      setDeletingBankTpId(null);
    }
  };

  // ─── AI Generate TP Suggestions Handlers ─────────────────────────────────

  const handleGenerateTPSuggestions = async () => {
    if (!tpAiTopik.trim()) {
      toast.error('Ketik topik atau materi pembelajaran terlebih dahulu.');
      return;
    }
    const autoFase = resolvePhaseByClassName(selectedClassName);
    setTpAiLoading(true);
    setTpAiError(null);
    setTpAiSource(null);
    try {
      const res = await fetch('/api/v1/kktp/generate-tp-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topikMateri: tpAiTopik,
          mataPelajaran: selectedSubjectName || 'Mata Pelajaran Umum',
          tingkatFase: autoFase,
        }),
      });


      const json = await res.json();
      if (!json.success) {
        setTpAiError(json.message || 'Gagal merumuskan saran TP.');
        return;
      }
      const source: 'GEMINI' | 'FALLBACK' = json.data?.source || 'GEMINI';
      setTpAiSource(source);
      const list: string[] = json.data?.saranTP || [];
      if (list.length === 0) {
        setTpAiError('Tidak ada saran TP yang dihasilkan. Coba ubah topik/materi.');
        return;
      }
      setTpAiSuggestions(list.map((s) => ({ teks: s, checked: true })));
      if (source === 'FALLBACK') {
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, 'Saran TP lokal digunakan karena layanan AI sedang tidak tersedia.'));
      } else {
        toast.success(`${list.length} saran TP berhasil dirumuskan oleh AI.`);
      }
    } catch {
      setTpAiError('Koneksi terputus. Silakan coba lagi.');
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
      nilai: 75,
      deskripsi: '',
    }));
    setTpItems((prev) => [...prev, ...newItems]);
    setShowTpAiPanel(false);
    if (isAi) {
      toast.success(`${newItems.length} TP hasil saran AI berhasil ditambahkan.`);
    } else {
      toast.success(`${newItems.length} TP template lokal berhasil ditambahkan.`);
    }
  };

  // ─── AI Auto-Formulate ────────────────────────────────────────────────────

  const handleGenerateAI = async () => {
    if (tpItems.length === 0) {
      toast.error('Pilih TP dulu sebelum melakukan analisis penilaian.');
      return;
    }
    if (!catatanPengamatan.trim()) {
      toast.error('Isi Catatan Pengamatan murid terlebih dahulu.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiCatatanUmum(null);
    setAiSource(null);
    try {
      const res = await fetch('/api/v1/kktp/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catatanPengamatan,
          tpItems: tpItems.map((t) => ({ id: t.id, teks: t.teks, sourceType: t.sourceType })),
          mataPelajaran: selectedSubjectName,
          kelasRombel: selectedClassName,
          namaMurid: selectedStudentName,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setAiError(json.message || 'Gagal menganalisis catatan observasi.');
        return;
      }

      const source: 'GEMINI' | 'FALLBACK' = json.data.source || (json.data.catatanUmumAI?.includes('fallback') ? 'FALLBACK' : 'GEMINI');
      setAiSource(source);

      const results: Array<{
        tpIndex: number;
        tpId: string;
        nilai: number | null;
        deskripsi: string;
        evidenceStatus: KKTPEvidenceStatus;
        evidenceReason?: string;
      }> = json.data.tpResults || [];

      if (source === 'FALLBACK') {
        if (json.data.catatanUmumAI) setAiCatatanUmum(json.data.catatanUmumAI);
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, 'Layanan AI sedang tidak tersedia. Nilai dan deskripsi tidak diisi otomatis.'));
      } else {
        // Source GEMINI
        setTpItems((prev) =>
          prev.map((tp, idx) => {
            const r = results.find((x) => x.tpIndex === idx) || results[idx];
            if (!r) return tp;
            return {
              ...tp,
              nilai: r.nilai,
              deskripsi: r.deskripsi || tp.deskripsi,
              evidenceStatus: r.evidenceStatus,
              aiSuggested: true,
            };
          })
        );
        if (json.data.catatanUmumAI) setAiCatatanUmum(json.data.catatanUmumAI);
        toast.success(`Analisis AI selesai — ${results.length} TP telah dianalisis. Silakan tinjau saran sebelum menyimpan.`);
      }
    } catch {
      setAiError('Koneksi gagal. Periksa jaringan dan coba lagi.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddManualTp = () => {
    setTpItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        teks: '',
        sourceType: 'INDEPENDENT_MANUAL',
        nilai: 75,
        deskripsi: '',
      },
    ]);
  };

  const handleUpdateTp = (id: string, field: 'teks' | 'nilai' | 'deskripsi', val: string | number | null) => {
    setTpItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  const handleRemoveTp = (id: string) => {
    setTpItems((prev) => prev.filter((t) => t.id !== id));
  };

  // ─── Auto-save ────────────────────────────────────────────────────────────

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
      },
      tpItems,
      catatanTutor,
      pesanKemitraan,
    },
  }), [title, selectedClassId, selectedClassName, selectedSubjectId, selectedSubjectName,
      selectedStudentId, selectedStudentName, tpItems, catatanTutor, pesanKemitraan]);

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
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [view, wizardStep, triggerAutoSave, tpItems, catatanTutor, pesanKemitraan, title]);

  // ─── Save ─────────────────────────────────────────────────────────────────

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
      if (!json.success) { toast.error(json.message || 'Gagal menyimpan KKTP.'); return; }
      toast.success(UX_COPY.crud.create('KKTP'));
      autoSaveDraftIdRef.current = undefined;
      setAutoSaveStatus('idle');
      setView('LIST');
      fetchDocuments();
    } catch {
      toast.error('Gagal memproses dokumen KKTP.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────

  const handleEditKKTP = async (doc: KKTPItem) => {
    setActiveDoc(doc);
    autoSaveDraftIdRef.current = doc.id;
    setAutoSaveStatus('idle');
    setTitle(doc.title);
    setSelectedClassId(doc.content?.identitas?.classId || '');
    setSelectedClassName(doc.content?.identitas?.kelasRombel || '');
    setSelectedSubjectId(doc.content?.identitas?.subjectId || '');
    setSelectedSubjectName(doc.content?.identitas?.mataPelajaran || '');
    setSelectedStudentId(doc.content?.identitas?.studentId || '');
    setSelectedStudentName(doc.content?.identitas?.namaMurid || '');
    setTpItems(doc.content?.tpItems || []);
    setCatatanTutor(doc.content?.catatanTutor || '');
    setPesanKemitraan(doc.content?.pesanKemitraan || '');
    setSelectedRpmId('');
    setRpmTpCheckboxes([]);

    // Load RPM list for context
    if (doc.content?.identitas?.classId && doc.content?.identitas?.mataPelajaran) {
      await loadRpmForContext(doc.content.identitas.classId, doc.content.identitas.mataPelajaran);
    }

    setWizardStep('FORM_KKTP');
    setView('WIZARD');
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDeleteKKTP = async (docId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(UX_COPY.crud.delete('KKTP'));
        setConfirmDeleteId(null);
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

  // ─── Print ────────────────────────────────────────────────────────────────

  const handleOpenPrint = async (doc: KKTPItem) => {
    setActiveDoc(doc);
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/v1/app-settings');
      const json = await res.json();
      if (json.success) setSchoolSettings(json.data || {});
    } catch {
      // Fallback ke kosong — print akan tampilkan placeholder
    } finally {
      setLoadingSettings(false);
    }
    setView('PRINT');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PRINT VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'PRINT' && activeDoc) {
    const tps = activeDoc.content?.tpItems || [];
    const scoredTps = tps.filter((t) => typeof t.nilai === 'number');
    const avg = scoredTps.length > 0
      ? Math.round(scoredTps.reduce((s, t) => s + (t.nilai as number), 0) / scoredTps.length)
      : null;
    const avgKategori = avg !== null ? getKategori(avg) : { label: 'Belum Lengkap', color: '' };
    const identitas = activeDoc.content?.identitas || {};
    const docNumber = `KKTP/${activeDoc.id.slice(0, 8).toUpperCase()}`;
    const schoolName = schoolSettings.school_name || '[Nama PKBM belum dikonfigurasi di Pengaturan Aplikasi]';
    const schoolSub = schoolSettings.school_sub_header || '[Alamat & izin operasional belum dikonfigurasi]';
    const tutorName = activeDoc.author_name || 'Tutor Pembimbing BLC';

    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 print:p-0">
        {/* Toolbar — tersembunyi saat cetak */}
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <Button variant="secondary" onClick={() => setView('LIST')} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar
          </Button>
          <Button onClick={() => window.print()} className="min-h-[40px] bg-emerald-600 hover:bg-emerald-700" size="sm">
            <Printer className="w-4 h-4 mr-2" /> Cetak Lembar Asesmen
          </Button>
        </div>

        {/* ── DOKUMEN CETAK ─────────────────────────────────────────── */}
        <div className="bg-white text-black p-8 print:p-0 print:shadow-none shadow-lg rounded-xl print:rounded-none">

          {/* KOP SURAT */}
          <div className="border-b-2 border-black pb-4 mb-4 text-center">
            <h1 className="text-xl font-bold uppercase tracking-wide">{schoolName}</h1>
            <p className="text-sm text-gray-700">{schoolSub}</p>
          </div>
          <div className="text-center mb-4">
            <h2 className="text-base font-bold uppercase underline">LEMBAR PENILAIAN KKTP</h2>
            <p className="text-xs text-gray-500">Kriteria Ketercapaian Tujuan Pembelajaran</p>
          </div>

          {/* INFO DOKUMEN */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-4 border border-gray-300 p-3 rounded">
            <div className="space-y-1">
              <p><span className="font-semibold">No. Dokumen:</span> {docNumber}</p>
              <p><span className="font-semibold">Nama Murid:</span> {identitas.namaMurid || '-'}</p>
              <p><span className="font-semibold">Kelas:</span> {identitas.kelasRombel || '-'}</p>
            </div>
            <div className="space-y-1 text-right">
              <p><span className="font-semibold">Mata Pelajaran:</span> {identitas.mataPelajaran || '-'}</p>
              <p><span className="font-semibold">Tutor:</span> {tutorName}</p>
              <p><span className="font-semibold">Tanggal Cetak:</span> {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          {/* TABEL TP */}
          <table className="w-full border-collapse border border-gray-400 text-xs mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 text-center w-8">No</th>
                <th className="border border-gray-400 p-2 text-left">Tujuan Pembelajaran</th>
                <th className="border border-gray-400 p-2 text-center w-14">Nilai</th>
                <th className="border border-gray-400 p-2 text-center w-28">Kategori KKTP</th>
                <th className="border border-gray-400 p-2 text-left">Deskripsi Ketercapaian</th>
              </tr>
            </thead>
            <tbody>
              {tps.map((tp, idx) => {
                const kat = getKategori(tp.nilai);
                return (
                  <tr key={tp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-400 p-2 text-center font-semibold">{idx + 1}</td>
                    <td className="border border-gray-400 p-2">{tp.teks || '-'}</td>
                    <td className="border border-gray-400 p-2 text-center font-bold">{tp.nilai !== null && tp.nilai !== undefined ? tp.nilai : '-'}</td>
                    <td className="border border-gray-400 p-2 text-center">{kat.label}</td>
                    <td className="border border-gray-400 p-2 text-[11px] text-gray-700">
                      {tp.deskripsi || (tp.nilai !== null && tp.nilai !== undefined ? getDeskripsi(tp.nilai, tp.teks) : 'Belum dinilai')}
                    </td>
                  </tr>
                );
              })}
              {/* Baris rata-rata */}
              <tr className="bg-yellow-50 font-semibold">
                <td colSpan={2} className="border border-gray-400 p-2 text-right text-xs">Rata-Rata Akhir:</td>
                <td className="border border-gray-400 p-2 text-center font-bold text-base">{avg !== null ? avg : '-'}</td>
                <td className="border border-gray-400 p-2 text-center">{avgKategori.label}</td>
                <td className="border border-gray-400 p-2 text-xs text-gray-600">
                  {avg !== null
                    ? (avg >= 76 ? 'Murid mencapai ketuntasan minimal secara keseluruhan.' : 'Murid memerlukan bimbingan lanjutan.')
                    : 'Sebagian atau seluruh Tujuan Pembelajaran belum dinilai.'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* CATATAN TUTOR */}
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1">Catatan Tutor:</p>
            <div className="border border-gray-300 rounded p-3 min-h-[48px] text-xs text-gray-800 whitespace-pre-wrap">
              {activeDoc.content?.catatanTutor || '—'}
            </div>
          </div>

          {/* PESAN KEMITRAAN */}
          <div className="mb-6">
            <p className="text-xs font-semibold mb-1">Pesan Kemitraan untuk Orang Tua/Wali:</p>
            <div className="border border-gray-300 rounded p-3 min-h-[48px] text-xs text-gray-800 italic whitespace-pre-wrap">
              {activeDoc.content?.pesanKemitraan || '—'}
            </div>
          </div>

          {/* 3 BLOK TANDA TANGAN BASAH */}
          <div className="flex justify-between items-start text-xs text-center mt-8 print:break-inside-avoid">
            {/* Orang Tua / Wali */}
            <div className="w-40">
              <p className="mb-16 leading-snug">Mengetahui,<br /><span className="font-semibold">Orang Tua / Wali Murid</span></p>
              <div className="border-b border-black w-32 mx-auto mb-1" />
              <p className="text-[11px] text-gray-600">(.................................)</p>
            </div>

            {/* Tutor Pembimbing BLC */}
            <div className="w-44">
              <p className="mb-16 leading-snug">Disusun oleh,<br /><span className="font-semibold">Tutor Pembimbing BLC</span></p>
              <p className="font-bold underline">{tutorName}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                ID: {activeDoc.author_nip || activeDoc.author_nuptk || '........................................'}
              </p>
            </div>

            {/* Kepala PKBM */}
            <div className="w-40">
              <p className="mb-16 leading-snug">Mengetahui,<br /><span className="font-semibold">Kepala PKBM BLC</span></p>
              <div className="border-b border-black w-32 mx-auto mb-1" />
              <p className="text-[11px] text-gray-600">(.................................)</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-2 print:border-t-0">
            Dicetak secara otomatis melalui Sistem SIUBA · {docNumber}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: WIZARD
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'WIZARD') {
    return (
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        {/* ── Modal Bank TP ── */}
        {showBankTpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-50/60 to-teal-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 shadow-xs">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight">Bank Tujuan Pembelajaran (TP)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Pilih dan gunakan kembali TP yang tersimpan lintas kelas &amp; periode.</p>
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
                    placeholder="Cari teks TP atau kata kunci..."
                    value={bankTpSearch}
                    onChange={(e) => {
                      setBankTpSearch(e.target.value);
                      fetchBankTPs(bankTpFilterSubject, bankTpFilterFase, e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mata Pelajaran</label>
                    <select
                      value={bankTpFilterSubject}
                      onChange={(e) => {
                        setBankTpFilterSubject(e.target.value);
                        fetchBankTPs(e.target.value, bankTpFilterFase, bankTpSearch);
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">— Semua Mata Pelajaran —</option>
                      {subjectOptions.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {selectedSubjectName && !subjectOptions.some(s => s.name === selectedSubjectName) && (
                        <option value={selectedSubjectName}>{selectedSubjectName}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Fase Kurikulum</label>
                    <select
                      value={bankTpFilterFase}
                      onChange={(e) => {
                        setBankTpFilterFase(e.target.value);
                        fetchBankTPs(bankTpFilterSubject, e.target.value, bankTpSearch);
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">— Semua Fase —</option>
                      <option value="Fase A">Fase A (Kelas 1-2)</option>
                      <option value="Fase B">Fase B (Kelas 3-4)</option>
                      <option value="Fase C">Fase C (Kelas 5-6)</option>
                      <option value="Fase D">Fase D (SMP / Paket B)</option>
                      <option value="Fase E">Fase E (SMA 10 / Paket C)</option>
                      <option value="Fase F">Fase F (SMA 11-12 / Paket C)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* List Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {bankTpLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
                    <p className="text-xs">Memuat Tujuan Pembelajaran dari bank...</p>
                  </div>
                ) : bankTpList.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed border-gray-200 rounded-xl">
                    <Bookmark className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Tidak ada TP ditemukan di Bank</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Belum ada TP yang cocok dengan filter di atas. Anda bisa mengubah filter atau menambahkan TP baru di form (akan tersimpan otomatis ke Bank TP).
                    </p>
                  </div>
                ) : (
                  bankTpList.map((item) => {
                    const isSelected = selectedBankTpIds.includes(item.id);
                    const isOwner = user && item.created_by === user.id;
                    const canDelete = isOwner || isAdmin;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleSelectBankTp(item.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/40 shadow-xs"
                            : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectBankTp(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 accent-emerald-600 w-4 h-4 rounded cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-xs text-gray-800 leading-relaxed font-medium">
                              {item.teks}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {item.mata_pelajaran_name && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold inline-flex items-center gap-1">
                                  <BookOpen className="w-3 h-3 text-blue-600" />
                                  <span>{item.mata_pelajaran_name}</span>
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold inline-flex items-center gap-1">
                                <Tag className="w-3 h-3 text-amber-600" />
                                <span>{item.fase || 'Fase C'}</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded-full border font-semibold ${
                                item.sumber === 'dari_rpm'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {item.sumber === 'dari_rpm' ? 'RPM' : 'Manual'}
                              </span>
                              {item.creator_name && (
                                <span className="text-gray-400 ml-1">
                                  Oleh: {item.creator_name}
                                </span>
                              )}
                            </div>
                          </div>
                          {canDelete && (
                            <button
                              onClick={(e) => handleDeleteBankTPItem(item.id, e)}
                              disabled={deletingBankTpId === item.id}
                              className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0"
                              title="Hapus dari Bank TP"
                            >
                              {deletingBankTpId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-600">
                  {selectedBankTpIds.length} TP dipilih
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowBankTpModal(false)}
                  >
                    Tutup
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyBankTP}
                    disabled={selectedBankTpIds.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Gunakan TP Terpilih ({selectedBankTpIds.length})
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header + breadcrumb */}
        <div className="flex items-center justify-between border-b pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (wizardStep === 'FORM_KKTP') {
                if (activeDoc) { setView('LIST'); return; }
                setWizardStep('SELECT_STUDENT');
              } else if (wizardStep === 'SELECT_STUDENT') {
                setWizardStep('SELECT_SUBJECT');
              } else if (wizardStep === 'SELECT_SUBJECT') {
                setWizardStep('SELECT_CLASS');
              } else {
                setView('LIST');
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {wizardStep === 'FORM_KKTP' ? 'Kembali' : 'Batal'}
          </Button>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {autoSaveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...</>}
            {autoSaveStatus === 'saved' && <><CheckCircle className="w-3 h-3 text-emerald-500" /> Tersimpan</>}
            {autoSaveStatus === 'error' && <><WifiOff className="w-3 h-3 text-amber-500" /> Belum tersimpan</>}
            <h1 className="text-base font-bold text-gray-900 ml-2">
              {wizardStep === 'SELECT_CLASS' && 'Langkah 1 — Pilih Kelas'}
              {wizardStep === 'SELECT_SUBJECT' && `Langkah 2 — Pilih Mata Pelajaran (Kelas: ${selectedClassName})`}
              {wizardStep === 'SELECT_STUDENT' && `Langkah 3 — Pilih Murid`}
              {wizardStep === 'FORM_KKTP' && 'Penyusunan KKTP'}
            </h1>
          </div>
        </div>

        {loadingStep && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        )}

        {/* ── STEP A: Pilih Kelas ────────────────────────────────────── */}
        {!loadingStep && wizardStep === 'SELECT_CLASS' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Pilih kelas untuk asesmen KKTP ini.</p>
            {classOptions.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-500">
                Tidak ada penugasan kelas ditemukan. Hubungi administrator.
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {classOptions.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-150 cursor-pointer group"
                  >
                    <School className="w-8 h-8 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    <span className="font-semibold text-sm text-gray-800 text-center leading-tight">{cls.name}</span>
                    {cls.code && <span className="text-[10px] text-gray-400">{cls.code}</span>}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP B: Pilih Mata Pelajaran ───────────────────────────── */}
        {!loadingStep && wizardStep === 'SELECT_SUBJECT' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Pilih mata pelajaran untuk asesmen ini.</p>
            {subjectOptions.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-500">
                Tidak ada mata pelajaran ditemukan.
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {subjectOptions.map((subj) => (
                  <button
                    key={subj.id}
                    onClick={() => handleSelectSubject(subj)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-150 cursor-pointer group"
                  >
                    <BookOpen className="w-8 h-8 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    <span className="font-semibold text-sm text-gray-800 text-center leading-tight">{subj.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP C: Pilih Murid ────────────────────────────────────── */}
        {!loadingStep && wizardStep === 'SELECT_STUDENT' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span>Menampilkan murid yang terdaftar di <strong>{selectedClassName}</strong> — {selectedSubjectName}</span>
            </div>
            {studentOptions.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-500">
                Tidak ada murid terdaftar di kelas ini.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {studentOptions.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-150 text-left cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{student.full_name}</p>
                      {student.nisn && <p className="text-[11px] text-gray-400">NISN: {student.nisn}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FORM KKTP ─────────────────────────────────────────────── */}
        {wizardStep === 'FORM_KKTP' && (
          <div className="space-y-5">
            {/* Context chip */}
            <div className="flex flex-wrap gap-2 text-xs">
              {selectedClassName && (
                <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-semibold inline-flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{selectedClassName}</span>
                </span>
              )}
              {selectedSubjectName && (
                <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full font-semibold inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                  <span>{selectedSubjectName}</span>
                </span>
              )}
              {selectedStudentName && (
                <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-800 rounded-full font-semibold inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-700" />
                  <span>{selectedStudentName}</span>
                </span>
              )}
            </div>

            {/* Judul */}
            <Card padding="md">
              <CardHeader title="Identitas Dokumen" bordered />
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Judul Instrumen KKTP</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: KKTP Matematika — Budi Santoso"
                    className="min-h-[44px]"
                  />
                </div>
              </div>
            </Card>

            {/* Sumber TP */}
            <Card padding="md">
              <CardHeader
                title="Tujuan Pembelajaran (TP)"
                bordered
                subtitle="Generate dengan AI, pilih dari Bank TP, tarik dari RPM, atau tambah manual"
                action={
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowTpAiPanel(!showTpAiPanel)}
                      className="border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
                      Generate dengan AI
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleOpenBankTp}
                      className="border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                    >
                      <Database className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Pilih dari Bank TP
                    </Button>
                  </div>
                }
              />
              <div className="mt-4 space-y-4">
                {/* Opsi tombol cepat sumber TP */}
                <div className="flex flex-wrap gap-2 pt-1 pb-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowTpAiPanel(!showTpAiPanel)}
                    className="border-violet-300 text-violet-700 bg-violet-50/70 hover:bg-violet-100"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
                    Generate TP dengan AI
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleOpenBankTp}
                    className="border-emerald-300 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100"
                  >
                    <Database className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Buka Bank TP
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAddManualTp}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Tambah TP Manual
                  </Button>
                </div>

                {/* ── Panel Generate TP dengan AI ──────────────────────── */}
                {showTpAiPanel && (
                  <div className="bg-gradient-to-br from-violet-50 to-purple-50/60 border border-violet-200 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-violet-900">Generate Tujuan Pembelajaran (TP) dengan AI</p>
                          <p className="text-[11px] text-violet-600">Rumuskan 3-5 butir TP Kurikulum Merdeka otomatis berbasis topik &amp; fase.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AIUsageStatus compact />
                        <button
                          onClick={() => setShowTpAiPanel(false)}
                          className="text-violet-400 hover:text-violet-700 p-1 rounded-md"
                          title="Tutup"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-violet-800">
                        Topik / Materi Pembelajaran
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={tpAiTopik}
                          onChange={(e) => setTpAiTopik(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateTPSuggestions(); }}
                          placeholder='Contoh: "Perkalian bilangan 1-10", "Wudhu dan rukunnya", "Teks Eksplanasi Ilmiah"'
                          className="text-xs bg-white border-violet-300 focus:ring-violet-400 flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleGenerateTPSuggestions}
                          disabled={tpAiLoading || !tpAiTopik.trim()}
                          loading={tpAiLoading}
                          className="bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
                        >
                          {!tpAiLoading && <Sparkles className="w-3.5 h-3.5 mr-1" />}
                          {tpAiLoading ? 'Merumuskan...' : 'Generate Saran TP'}
                        </Button>
                      </div>
                    </div>

                    {/* Error state */}
                    {tpAiError && (
                      <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <p className="text-xs text-red-700 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          {tpAiError}
                        </p>
                        <button
                          onClick={handleGenerateTPSuggestions}
                          className="text-xs text-red-700 font-semibold hover:underline flex items-center gap-1 flex-shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" /> Coba Lagi
                        </button>
                      </div>
                    )}

                    {/* Checkbox saran TP yang bisa diedit */}
                    {tpAiSuggestions.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-violet-200/80">
                        <p className="text-[11px] font-semibold text-violet-900">
                          Pilih dan sesuaikan teks saran TP sebelum digunakan:
                        </p>
                        <div className="space-y-2">
                          {tpAiSuggestions.map((item, idx) => (
                            <div
                              key={idx}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                                item.checked ? 'bg-white border-violet-300 shadow-xs' : 'bg-white/60 border-gray-200 opacity-70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={(e) => {
                                  const updated = [...tpAiSuggestions];
                                  updated[idx].checked = e.target.checked;
                                  setTpAiSuggestions(updated);
                                }}
                                className="mt-1 accent-violet-600 w-4 h-4 rounded cursor-pointer flex-shrink-0"
                              />
                              <Textarea
                                value={item.teks}
                                onChange={(e) => {
                                  const updated = [...tpAiSuggestions];
                                  updated[idx].teks = e.target.value;
                                  setTpAiSuggestions(updated);
                                }}
                                rows={2}
                                className="text-xs flex-1 bg-transparent border-gray-200 focus:bg-white"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setTpAiSuggestions([])}
                          >
                            Batal
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleApplyAiSuggestions}
                            disabled={!tpAiSuggestions.some((t) => t.checked)}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Terapkan Saran TP Terpilih ({tpAiSuggestions.filter((t) => t.checked).length})
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {rpmList.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> Tarik TP dari Dokumen RPM
                    </p>
                    <select
                      value={selectedRpmId}
                      onChange={(e) => handleSelectRpm(e.target.value)}
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">— Pilih dokumen RPM —</option>
                      {rpmList.map((r) => (
                        <option key={r.id} value={r.id}>{r.title}</option>
                      ))}
                    </select>

                    {rpmTpCheckboxes.length > 0 && (
                      <div className="space-y-2">
                        {rpmTpCheckboxes.map((tp, idx) => (
                          <label key={idx} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tp.checked}
                              onChange={(e) => {
                                const updated = [...rpmTpCheckboxes];
                                updated[idx].checked = e.target.checked;
                                setRpmTpCheckboxes(updated);
                              }}
                              className="mt-0.5 accent-emerald-600"
                            />
                            <span className="text-xs text-gray-700">{tp.teks}</span>
                          </label>
                        ))}
                        <Button
                          size="sm"
                          onClick={handleApplyRpmTp}
                          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Terapkan TP Terpilih
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── AI Auto-Formulate Panel ──────────────────────────── */}
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      <p className="text-xs font-semibold text-violet-800">Analisis Catatan Observasi (Saran AI)</p>
                    </div>
                    <AIUsageStatus compact />
                  </div>
                  <p className="text-[11px] text-violet-600">
                    Ketik catatan observasi murid, AI akan menganalisis bukti ketercapaian untuk setiap TP. TP dengan bukti cukup akan disarankan nilai &amp; deskripsi, sedangkan TP tanpa bukti cukup akan dibiarkan belum dinilai.
                  </p>
                  <Textarea
                    value={catatanPengamatan}
                    onChange={(e) => setCatatanPengamatan(e.target.value)}
                    rows={3}
                    placeholder={`Contoh: "${selectedStudentName || 'Murid'} aktif berdiskusi dan mampu menjelaskan konsep gaya dengan bahasa sendiri. Masih perlu bimbingan pada soal aplikatif. Adab di kelas baik."`}
                    className="text-sm bg-white"
                  />

                  {/* Error state */}
                  {aiError && (
                    <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        {aiError}
                      </p>
                      <button
                        onClick={handleGenerateAI}
                        className="text-xs text-red-700 font-semibold hover:underline flex items-center gap-1 flex-shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" /> Coba Lagi
                      </button>
                    </div>
                  )}

                  {/* Fallback Banner */}
                  {aiSource === 'FALLBACK' && aiCatatanUmum && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 space-y-1">
                          <p className="font-bold">Layanan AI Sedang Tidak Tersedia</p>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            {aiCatatanUmum}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleGenerateAI}
                          disabled={aiLoading}
                          className="text-xs h-7 border-amber-300 hover:bg-amber-100"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Coba Lagi
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Gemini Success Catatan Umum */}
                  {aiSource === 'GEMINI' && aiCatatanUmum && (
                    <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-[11px] text-violet-800 italic flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600 flex-shrink-0 mt-0.5" />
                      <span>{aiCatatanUmum}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleGenerateAI}
                    disabled={aiLoading || tpItems.length === 0}
                    loading={aiLoading}
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white w-full"
                    title={tpItems.length === 0 ? 'Pilih TP dulu sebelum analisis catatan' : ''}
                  >
                    {!aiLoading && <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                    {aiLoading
                      ? 'Menganalisis catatan...'
                      : tpItems.length === 0
                      ? 'Pilih TP dulu sebelum Analisis'
                      : `Analisis Catatan & Buat Saran Penilaian (${tpItems.length} TP)`}
                  </Button>
                </div>

                {/* Daftar TP */}
                {tpItems.length > 0 && (
                  <div className="space-y-4">
                    {tpItems.map((tp, idx) => (
                      <div key={tp.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700">TP {idx + 1}</span>
                            {/* Evidence Status Badge */}
                            {tp.evidenceStatus && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                tp.evidenceStatus === 'SUFFICIENT'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : tp.evidenceStatus === 'PARTIAL'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {tp.evidenceStatus === 'SUFFICIENT'
                                  ? 'Evidence Cukup'
                                  : tp.evidenceStatus === 'PARTIAL'
                                  ? 'Evidence Sebagian'
                                  : 'Evidence Belum Cukup'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {tp.fromBank ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                                <Database className="w-3 h-3" /> Dari Bank TP
                              </span>
                            ) : tp.sourceType === 'AI_GENERATED' ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Dari Saran AI
                              </span>
                            ) : tp.sourceType === 'LINKED_RPM' ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold flex items-center gap-1">
                                <Link2 className="w-3 h-3" /> Dari RPM
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 font-semibold">
                                Manual
                              </span>
                            )}
                            <button
                              onClick={() => handleRemoveTp(tp.id)}
                              className="text-red-400 hover:text-red-600 transition-colors p-1"
                              title="Hapus TP"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Teks Tujuan Pembelajaran</label>
                          <Textarea
                            value={tp.teks}
                            onChange={(e) => handleUpdateTp(tp.id, 'teks', e.target.value)}
                            rows={2}
                            placeholder="Deskripsi tujuan pembelajaran..."
                            className="text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-2">
                            <span>Nilai Ketercapaian (0–100)</span>
                            {tp.aiSuggested && tp.evidenceStatus === 'SUFFICIENT' && (
                              <span className="ml-2 text-[10px] text-violet-600 font-medium inline-flex items-center gap-0.5">
                                <Sparkles className="w-3 h-3 text-violet-600" /> Saran Nilai AI
                              </span>
                            )}
                          </label>
                          <ScoreSlider
                            nilai={tp.nilai}
                            onChange={(v) => handleUpdateTp(tp.id, 'nilai', v)}
                          />
                        </div>

                        {/* Deskripsi ketercapaian — diisi AI atau manual */}
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            <span>Deskripsi Ketercapaian</span>
                            {tp.aiSuggested && (
                              <span className="ml-2 text-[10px] text-violet-600 font-medium inline-flex items-center gap-0.5">
                                <Sparkles className="w-3 h-3 text-violet-600" /> Saran AI — bisa diedit
                              </span>
                            )}
                          </label>
                          <Textarea
                            value={tp.deskripsi || ''}
                            onChange={(e) => handleUpdateTp(tp.id, 'deskripsi', e.target.value)}
                            rows={2}
                            placeholder="Deskripsi konkret ketercapaian TP ini berdasarkan observasi..."
                            className="text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddManualTp}
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah TP Manual
                </Button>
              </div>
            </Card>

            {/* Catatan & Pesan Kemitraan */}
            <Card padding="md">
              <CardHeader title="Catatan & Pesan Kemitraan" bordered />
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Catatan Tutor</label>
                  <Textarea
                    value={catatanTutor}
                    onChange={(e) => setCatatanTutor(e.target.value)}
                    rows={3}
                    placeholder="Catatan perkembangan, kendala, atau rekomendasi belajar murid..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Pesan Kemitraan untuk Orang Tua</label>
                  <Textarea
                    value={pesanKemitraan}
                    onChange={(e) => setPesanKemitraan(e.target.value)}
                    rows={3}
                    placeholder="Pesan kepada orang tua/wali tentang perkembangan belajar dan dukungan di rumah..."
                  />
                </div>
              </div>
              <CardFooter className="mt-4 pt-4 border-t flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setView('LIST')} size="sm">
                  Batal
                </Button>
                <Button
                  onClick={handleSaveDocument}
                  disabled={submitting}
                  loading={submitting}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Simpan KKTP
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Modal konfirmasi hapus */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Hapus Dokumen KKTP?</h3>
            <p className="text-xs text-gray-600">Dokumen yang dihapus tidak dapat dikembalikan.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
                Batal
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleDeleteKKTP(confirmDeleteId)} loading={deleting}>
                <Trash2 className="w-4 h-4 mr-2" /> Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Assessment KKTP</h1>
          <p className="text-xs text-gray-500">
            Kriteria Ketercapaian Tujuan Pembelajaran per murid. Langsung siap cetak setelah disimpan.
          </p>
        </div>
        <Button onClick={handleStartWizard} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Buat KKTP Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="text-center p-8">
          <div className="space-y-3 py-6">
            <FileText className="w-12 h-12 mx-auto text-gray-400" />
            <h3 className="font-semibold text-sm">Belum Ada Instrumen KKTP</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Anda belum menyusun Kriteria Ketercapaian Tujuan Pembelajaran. Tekan tombol di bawah untuk membuat instrumen pertama.
            </p>
            <Button onClick={handleStartWizard} className="mt-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Buat KKTP Pertama
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isOwner = user && doc.author_id === user.id;
            const canDelete = isOwner || isAdmin;
            const identitas = doc.content?.identitas || {};
            const tps = doc.content?.tpItems || [];
            const scoredTps = tps.filter((t: TPItem) => typeof t.nilai === 'number');
            const avg = scoredTps.length > 0
              ? Math.round(scoredTps.reduce((s: number, t: TPItem) => s + (t.nilai as number), 0) / scoredTps.length)
              : null;
            const { label: avgLabel, color: avgColor } = avg !== null ? getKategori(avg) : { label: 'Belum Lengkap', color: 'text-gray-400' };

            return (
              <div key={doc.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">
                      Siap Dipakai
                    </span>
                    {avg !== null ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${avgColor}`}>
                        Rata-rata: {avg} — {avgLabel}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold text-gray-500 bg-gray-50 border-gray-200">
                        Penilaian Belum Lengkap
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold line-clamp-2 mb-2">{doc.title}</h3>
                  <div className="text-xs text-gray-600 space-y-1">
                    {identitas.namaMurid && <p><span className="font-semibold">Murid:</span> {identitas.namaMurid}</p>}
                    {identitas.kelasRombel && <p><span className="font-semibold">Kelas:</span> {identitas.kelasRombel}</p>}
                    {identitas.mataPelajaran && <p><span className="font-semibold">Mapel:</span> {identitas.mataPelajaran}</p>}
                    <p><span className="font-semibold">Penyusun:</span> {doc.author_name || '-'}</p>
                    <p><span className="font-semibold">TP:</span> {tps.length} tujuan pembelajaran</p>
                  </div>
                </div>
                <div className="border-t pt-3 pb-3 px-5 flex justify-between items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleOpenPrint(doc)} disabled={loadingSettings}>
                    {loadingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Printer className="w-3.5 h-3.5 mr-1" />}
                    Cetak
                  </Button>
                  <div className="flex gap-1.5">
                    {isOwner && (
                      <Button variant="secondary" size="sm" onClick={() => handleEditKKTP(doc)}>
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(doc.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
