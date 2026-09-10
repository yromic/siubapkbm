"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Plus,
  Search,
  Check,
  Sparkles,
  Loader2,
  X,
  ChevronRight,
  FolderOpen,
  Layers,
  HeartHandshake,
  Calculator,
  AlertCircle,
  RefreshCw,
  Edit2,
  Trash2,
  Lock,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  resolvePhaseByClassLevel,
  resolvePhaseByClassName,
  KurikulumFase,
  TRISULA_DOMAINS,
} from "@/lib/utils/academicUtils";
import {
  filterSharedBankTPs,
  filterTrisulaNativeCPs,
  filterTrisulaNativeTPs,
  BankTPItem,
  BankCPItem,
} from "@/lib/utils/curriculumFilterUtils";
import {
  fetchBankTPs,
  fetchBankCPs,
  updateBankTPClient,
  deleteBankTPClient,
  updateBankCPClient,
  deleteBankCPClient,
} from "@/lib/api/curriculumBankClient";

export interface SelectedTPPayload {
  tpId?: string;
  teks: string;
  cpId?: string | null;
  cpTeks?: string | null;
  fase: string;
  mataPelajaran?: string | null;
}

interface CurriculumBankModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTP: (item: SelectedTPPayload) => void;
  initialClassLevel?: number | string;
  initialClassName?: string;
  initialSubjectName?: string;
  initialFase?: string;
  activePillar?: "LITERASI" | "NUMERASI" | "DINIYYAH";
  title?: string;
}

export function CurriculumBankModal({
  open,
  onClose,
  onSelectTP,
  initialClassLevel,
  initialClassName,
  initialSubjectName,
  initialFase,
  activePillar,
  title = "Pilih Tujuan Pembelajaran (Bank CP & TP)",
}: CurriculumBankModalProps) {
  const { user } = useAuth();
  const isAdmin = ["administrator", "admin"].includes(user?.role || "");
  const currentUserId = user?.id;

  const [activeTab, setActiveTab] = useState<"BROWSE" | "TRISULA" | "CREATE_CP" | "CREATE_TP">("BROWSE");

  // Selection & Filter States
  const [classList, setClassList] = useState<Array<{ id: string; name: string; level?: number }>>([]);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>(
    initialClassName || (initialClassLevel ? `Kelas ${initialClassLevel}` : "")
  );
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubjectName || "Semua");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCPId, setSelectedCPId] = useState<string | "ALL">("ALL");

  // Data & Pagination States
  const [cpList, setCpList] = useState<BankCPItem[]>([]);
  const [tpList, setTpList] = useState<BankTPItem[]>([]);
  const [loadingCP, setLoadingCP] = useState<boolean>(false);
  const [loadingTP, setLoadingTP] = useState<boolean>(false);
  const [loadingMoreTP, setLoadingMoreTP] = useState<boolean>(false);
  const [tpError, setTpError] = useState<string | null>(null);
  const [cpError, setCpError] = useState<string | null>(null);
  const [tpPage, setTpPage] = useState<number>(1);
  const [tpTotal, setTpTotal] = useState<number>(0);
  const [hasMoreTP, setHasMoreTP] = useState<boolean>(false);

  // Create Form States
  const [newCpTeks, setNewCpTeks] = useState("");
  const [newCpKode, setNewCpKode] = useState("");
  const [newCpDomain, setNewCpDomain] = useState("Umum");
  const [newTpTeks, setNewTpTeks] = useState("");
  const [newTpCpId, setNewTpCpId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Edit TP Modal State
  const [editingTP, setEditingTP] = useState<BankTPItem | null>(null);
  const [editTpTeks, setEditTpTeks] = useState("");
  const [editTpCpId, setEditTpCpId] = useState<string>("");
  const [savingEditTP, setSavingEditTP] = useState(false);

  // Edit CP Modal State
  const [editingCP, setEditingCP] = useState<BankCPItem | null>(null);
  const [editCpTeks, setEditCpTeks] = useState("");
  const [editCpKode, setEditCpKode] = useState("");
  const [savingEditCP, setSavingEditCP] = useState(false);

  // Deleting State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Trisula Tab Domain — sync with activePillar prop if provided
  const initialTrisulaDomain = useMemo<"Literasi" | "Numerasi" | "Diniyyah">(() => {
    if (activePillar === "NUMERASI") return "Numerasi";
    if (activePillar === "DINIYYAH") return "Diniyyah";
    return "Literasi";
  }, [activePillar]);

  const [trisulaDomain, setTrisulaDomain] = useState<"Literasi" | "Numerasi" | "Diniyyah">(initialTrisulaDomain);

  // Update domain if activePillar prop changes
  useEffect(() => {
    if (activePillar === "NUMERASI") setTrisulaDomain("Numerasi");
    else if (activePillar === "DINIYYAH") setTrisulaDomain("Diniyyah");
    else if (activePillar === "LITERASI") setTrisulaDomain("Literasi");
  }, [activePillar]);

  // Load Real Active Classes from SIUBA Database
  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await fetch("/api/v1/classes?status=active&limit=100");
      const json = await res.json();
      const items = Array.isArray(json.data?.data) ? json.data.data : Array.isArray(json.data) ? json.data : [];
      if (json.success && items.length > 0) {
        setClassList(items);
        const match = items.find(
          (c: any) =>
            c.name === initialClassName ||
            c.id === initialClassName ||
            (initialClassLevel && c.level === Number(initialClassLevel)) ||
            c.name === selectedClass
        );
        if (match) {
          setSelectedClass(match.name);
        } else if (!selectedClass) {
          setSelectedClass(items[0].name);
        }
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingClasses(false);
    }
  }, [initialClassName, initialClassLevel, selectedClass]);

  // Auto-resolve Fase from selected class using level or name
  const resolvedFase = useMemo<KurikulumFase>(() => {
    if (initialFase && initialFase.startsWith("Fase")) {
      return initialFase as KurikulumFase;
    }
    const currentClassObj = classList.find((c) => c.name === selectedClass || c.id === selectedClass);
    if (currentClassObj) {
      return resolvePhaseByClassLevel(currentClassObj.level || currentClassObj.name);
    }
    return resolvePhaseByClassName(selectedClass);
  }, [selectedClass, initialFase, classList]);

  // Load CPs using typed client
  const loadCPs = useCallback(async () => {
    setLoadingCP(true);
    setCpError(null);
    try {
      const result = await fetchBankCPs({
        fase: resolvedFase,
        mata_pelajaran_name: selectedSubject !== "Semua" ? selectedSubject : undefined,
        limit: 100,
      });
      setCpList(result.items);
    } catch (err: any) {
      setCpError(err?.message || "Gagal memuat daftar Capaian Pembelajaran (CP).");
    } finally {
      setLoadingCP(false);
    }
  }, [resolvedFase, selectedSubject]);

  // Load TPs using typed client
  const loadTPs = useCallback(
    async (page = 1, append = false) => {
      if (append) {
        setLoadingMoreTP(true);
      } else {
        setLoadingTP(true);
        setTpError(null);
      }

      try {
        const result = await fetchBankTPs({
          fase: resolvedFase,
          cp_id: selectedCPId !== "ALL" ? selectedCPId : undefined,
          mata_pelajaran_name: selectedSubject !== "Semua" ? selectedSubject : undefined,
          search: searchQuery.trim() || undefined,
          page,
          limit: 50,
        });

        if (append) {
          setTpList((prev) => [...prev, ...result.items]);
        } else {
          setTpList(result.items);
        }

        setTpPage(page);
        setTpTotal(result.pagination.total);
        setHasMoreTP(page * result.pagination.limit < result.pagination.total);
      } catch (err: any) {
        setTpError(err?.message || "Gagal memuat Tujuan Pembelajaran dari bank.");
      } finally {
        setLoadingTP(false);
        setLoadingMoreTP(false);
      }
    },
    [resolvedFase, selectedCPId, selectedSubject, searchQuery]
  );

  // Initial & Filter change trigger
  useEffect(() => {
    if (open) {
      fetchClasses();
      loadCPs();
      loadTPs(1, false);
    }
  }, [open, fetchClasses, loadCPs, loadTPs]);

  // Handle Load More
  const handleLoadMore = () => {
    if (!loadingMoreTP && hasMoreTP) {
      loadTPs(tpPage + 1, true);
    }
  };

  // Derive unique subject names for convenience filter
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    tpList.forEach((t) => {
      if (t.mata_pelajaran_name) set.add(t.mata_pelajaran_name);
    });
    cpList.forEach((c) => {
      if (c.mata_pelajaran_name) set.add(c.mata_pelajaran_name);
    });
    return Array.from(set);
  }, [tpList, cpList]);

  // Filtered displayed TPs for Tab 1 (Shared Bank)
  const displayedSharedTPs = useMemo(() => {
    return filterSharedBankTPs(tpList, {
      fase: resolvedFase,
      subjectName: selectedSubject,
      cpId: selectedCPId,
      searchQuery,
    });
  }, [tpList, resolvedFase, selectedSubject, selectedCPId, searchQuery]);

  // Filtered displayed CPs & TPs for Tab 2 (Trisula Native Curriculum)
  const trisulaDomainCP = useMemo(() => {
    const filtered = filterTrisulaNativeCPs(cpList, {
      fase: resolvedFase,
      domain: trisulaDomain,
    });
    return filtered[0] || null;
  }, [cpList, resolvedFase, trisulaDomain]);

  const trisulaDomainTPs = useMemo(() => {
    return filterTrisulaNativeTPs(tpList, {
      fase: resolvedFase,
      domain: trisulaDomain,
    });
  }, [tpList, resolvedFase, trisulaDomain]);

  // Handle Create CP
  const handleCreateCP = async () => {
    if (!newCpTeks.trim() || newCpTeks.trim().length < 5) {
      toast.error("Teks Capaian Pembelajaran minimal 5 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/cp-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teks: newCpTeks.trim(),
          kode: newCpKode.trim() || undefined,
          fase: resolvedFase,
          mata_pelajaran_name: selectedSubject !== "Semua" ? selectedSubject : newCpDomain,
          domain_trisula: TRISULA_DOMAINS.includes(newCpDomain as any) ? newCpDomain : undefined,
          sumber: "MANUAL",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Capaian Pembelajaran (CP) berhasil ditambahkan.");
        setNewCpTeks("");
        setNewCpKode("");
        loadCPs();
        setActiveTab("BROWSE");
      } else {
        toast.error(json.message || "Gagal membuat CP.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyimpan CP.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create TP
  const handleCreateTP = async () => {
    if (!newTpTeks.trim() || newTpTeks.trim().length < 3) {
      toast.error("Teks Tujuan Pembelajaran minimal 3 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/tp-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teks: newTpTeks.trim(),
          cp_id: newTpCpId || undefined,
          fase: resolvedFase,
          mata_pelajaran_name: selectedSubject !== "Semua" ? selectedSubject : "Umum",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Tujuan Pembelajaran (TP) berhasil ditambahkan ke bank.");
        setNewTpTeks("");
        setNewTpCpId("");
        loadTPs(1, false);
        setActiveTab("BROWSE");
      } else {
        toast.error(json.message || "Gagal membuat TP.");
      }
    } catch {
      toast.error("Terjadi kendala saat menyimpan TP.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit TP Modal open
  const handleOpenEditTP = (tp: BankTPItem) => {
    setEditingTP(tp);
    setEditTpTeks(tp.teks);
    setEditTpCpId(tp.cp_id || "");
  };

  // Save Edit TP
  const handleSaveEditTP = async () => {
    if (!editingTP) return;
    if (!editTpTeks.trim() || editTpTeks.trim().length < 3) {
      toast.error("Teks Tujuan Pembelajaran minimal 3 karakter.");
      return;
    }
    setSavingEditTP(true);
    try {
      await updateBankTPClient(editingTP.id, {
        teks: editTpTeks.trim(),
        cp_id: editTpCpId || null,
      });
      toast.success("Tujuan Pembelajaran berhasil diperbarui.");
      setEditingTP(null);
      loadTPs(tpPage, false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui TP.");
    } finally {
      setSavingEditTP(false);
    }
  };

  // Handle Delete TP
  const handleDeleteTP = async (tp: BankTPItem) => {
    const isMaster = Boolean(tp.kode?.startsWith("TP-") || tp.cp_domain_trisula);
    if (isMaster && !isAdmin) {
      toast.error("Hanya administrator yang dapat menghapus standar BLC.");
      return;
    }
    if (!window.confirm(`Hapus Tujuan Pembelajaran ini dari bank?`)) return;

    setDeletingId(tp.id);
    try {
      await deleteBankTPClient(tp.id);
      toast.success("Tujuan Pembelajaran berhasil dihapus dari bank.");
      loadTPs(tpPage, false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus TP.");
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Open Edit CP
  const handleOpenEditCP = (cp: BankCPItem) => {
    setEditingCP(cp);
    setEditCpTeks(cp.teks);
    setEditCpKode(cp.kode || "");
  };

  // Save Edit CP
  const handleSaveEditCP = async () => {
    if (!editingCP) return;
    if (!editCpTeks.trim() || editCpTeks.trim().length < 5) {
      toast.error("Teks Capaian Pembelajaran minimal 5 karakter.");
      return;
    }
    setSavingEditCP(true);
    try {
      await updateBankCPClient(editingCP.id, {
        teks: editCpTeks.trim(),
        kode: editCpKode.trim() || null,
      });
      toast.success("Capaian Pembelajaran berhasil diperbarui.");
      setEditingCP(null);
      loadCPs();
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui CP.");
    } finally {
      setSavingEditCP(false);
    }
  };

  // Handle Delete CP
  const handleDeleteCP = async (cp: BankCPItem) => {
    if (cp.sumber === "INTERNAL_BLC" && !isAdmin) {
      toast.error("Hanya administrator yang dapat menghapus standar BLC.");
      return;
    }
    if (!window.confirm(`Hapus Capaian Pembelajaran "${cp.teks.slice(0, 40)}..."?`)) return;

    setDeletingId(cp.id);
    try {
      const result = await deleteBankCPClient(cp.id);
      toast.success(result.message);
      loadCPs();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus CP.");
    } finally {
      setDeletingId(null);
    }
  };

  // Seed Trisula if empty (Admin only)
  const handleSeedTrisula = async () => {
    if (!isAdmin) {
      toast.error("Hanya administrator yang dapat menyinkronkan kurikulum standar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/cp-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_trisula" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Kurikulum Trisula BLC berhasil diselaraskan ke Bank.");
        loadCPs();
        loadTPs(1, false);
      } else {
        toast.error(json.message || "Gagal sinkronisasi Trisula.");
      }
    } catch {
      toast.error("Gagal sinkronisasi Trisula.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
                {activePillar && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    Target: Pilar {activePillar}
                  </span>
                )}
                {isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Mode Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Pilih atau kelola Tujuan Pembelajaran Kurikulum Merdeka terpadu Trisula BLC.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Smart Filter Bar (Kelas -> Fase Otomatis -> Mapel) */}
        <div className="px-6 py-3 bg-white dark:bg-[#171717] border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">Kelas:</span>
            {loadingClasses ? (
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" /> Memuat...
              </span>
            ) : classList.length === 0 ? (
              <span className="text-xs text-amber-600 font-semibold">Belum ada kelas aktif</span>
            ) : (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {classList.map((c) => {
                  const fase = resolvePhaseByClassLevel(c.level || c.name);
                  return (
                    <option key={c.id} value={c.name}>
                      {c.name} ({fase})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800">
            <span>{resolvedFase}</span>
          </div>

          {activeTab === "BROWSE" && (
            <>
              {/* Optional Subject Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium">Mapel:</span>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Semua">Semua Mapel</option>
                  {availableSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Search */}
              <div className="flex items-center gap-2 ml-auto">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari teks TP/CP..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs w-44 sm:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-200 dark:border-zinc-800 flex gap-2 pt-2 bg-zinc-50/30 dark:bg-zinc-900/30">
          <button
            onClick={() => setActiveTab("BROWSE")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "BROWSE"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Jelajahi Bank CP & TP
          </button>
          <button
            onClick={() => setActiveTab("TRISULA")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "TRISULA"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Kurikulum Trisula BLC
          </button>
          <button
            onClick={() => setActiveTab("CREATE_TP")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "CREATE_TP"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> + Tambah TP Manual
          </button>
          <button
            onClick={() => setActiveTab("CREATE_CP")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "CREATE_CP"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" /> + Tambah CP Baru
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: BROWSE CP & TP (SHARED REUSABLE BANK) */}
          {activeTab === "BROWSE" && (
            <div className="space-y-4">
              {/* Filter CP Parent Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                  onClick={() => setSelectedCPId("ALL")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all ${
                    selectedCPId === "ALL"
                      ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  Semua CP ({cpList.length})
                </button>
                {cpList.map((cp) => (
                  <button
                    key={cp.id}
                    onClick={() => setSelectedCPId(cp.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 max-w-[280px] truncate transition-all ${
                      selectedCPId === cp.id
                        ? "bg-emerald-600 text-white font-bold"
                        : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                    }`}
                    title={cp.teks}
                  >
                    {cp.kode ? `[${cp.kode}] ` : ""}
                    {cp.domain_trisula ? `(${cp.domain_trisula}) ` : ""}
                    {cp.teks}
                  </button>
                ))}
              </div>

              {/* Active CP Card Preview if Selected with Edit/Delete for Admin */}
              {selectedCPId !== "ALL" && (() => {
                const activeCP = cpList.find((c) => c.id === selectedCPId);
                const canManageCP = isAdmin || activeCP?.created_by === currentUserId;
                return (
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs flex items-start justify-between gap-3">
                    <div>
                      <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">
                        Capaian Pembelajaran (CP) Acuan:
                      </span>
                      <p className="text-zinc-700 dark:text-zinc-300 italic">
                        {activeCP?.teks}
                      </p>
                    </div>
                    {canManageCP && activeCP && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditCP(activeCP)}
                          className="h-7 px-2 text-[11px] text-zinc-600 hover:bg-emerald-100"
                          title="Edit CP"
                        >
                          <Edit2 className="w-3 h-3 mr-1 text-emerald-700" /> Edit CP
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCP(activeCP)}
                          disabled={deletingId === activeCP.id}
                          className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-100"
                          title="Hapus CP"
                        >
                          <Trash2 className="w-3 h-3 mr-1 text-rose-600" /> Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Error State with Retry Button */}
              {tpError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{tpError}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => loadTPs(1, false)}
                    className="text-xs h-7 border-rose-300 hover:bg-rose-100 text-rose-900 font-bold"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Coba Lagi
                  </Button>
                </div>
              )}

              {/* TP Item List */}
              {loadingTP ? (
                <div className="py-12 flex flex-col justify-center items-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <p className="text-xs text-zinc-500">Memuat Tujuan Pembelajaran...</p>
                </div>
              ) : displayedSharedTPs.length === 0 ? (
                <div className="text-center py-12 space-y-2 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
                  <Layers className="w-8 h-8 mx-auto text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Belum ada Tujuan Pembelajaran yang sesuai pada {resolvedFase}
                    {selectedSubject !== "Semua" ? ` untuk ${selectedSubject}` : ""}.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setActiveTab("CREATE_TP")}
                    className="text-xs mt-2 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Buat TP Baru
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedSharedTPs.map((tp) => {
                    const isMaster = Boolean(tp.kode?.startsWith("TP-") || tp.cp_domain_trisula);
                    const canEdit = isAdmin || tp.created_by === currentUserId;

                    return (
                      <div
                        key={tp.id}
                        className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all flex items-start justify-between gap-3 group"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {tp.fase}
                            </span>
                            {tp.kode && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200">
                                {tp.kode}
                              </span>
                            )}
                            {tp.mata_pelajaran_name && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                                {tp.mata_pelajaran_name}
                              </span>
                            )}
                            {tp.cp_kode && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300">
                                CP: {tp.cp_kode}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100 leading-relaxed">
                            {tp.teks}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canEdit && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditTP(tp)}
                                className="h-8 px-2 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Edit TP"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteTP(tp)}
                                disabled={deletingId === tp.id}
                                className="h-8 px-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Hapus TP"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              onSelectTP({
                                tpId: tp.id,
                                teks: tp.teks,
                                cpId: tp.cp_id,
                                cpTeks: tp.cp_teks,
                                fase: tp.fase,
                                mataPelajaran: tp.mata_pelajaran_name,
                              });
                              onClose();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[34px] text-xs font-semibold shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Gunakan TP
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination / Load More */}
                  {hasMoreTP && (
                    <div className="pt-2 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loadingMoreTP}
                        className="text-xs px-4 border-zinc-200"
                      >
                        {loadingMoreTP ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Muat Lebih Banyak ({displayedSharedTPs.length} dari {tpTotal})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRISULA BLC CURRICULUM (NATIVE BLC 3-PILLAR CURRICULUM) */}
          {activeTab === "TRISULA" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
                <div className="flex gap-2">
                  {(["Literasi", "Numerasi", "Diniyyah"] as const).map((dom) => (
                    <button
                      key={dom}
                      onClick={() => setTrisulaDomain(dom)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        trisulaDomain === dom
                          ? dom === "Literasi"
                            ? "bg-blue-600 text-white"
                            : dom === "Numerasi"
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {dom === "Literasi" && <BookOpen className="w-3.5 h-3.5" />}
                      {dom === "Numerasi" && <Calculator className="w-3.5 h-3.5" />}
                      {dom === "Diniyyah" && <HeartHandshake className="w-3.5 h-3.5" />}
                      Pilar {dom}
                    </button>
                  ))}
                </div>

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSeedTrisula}
                    disabled={submitting}
                    className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" /> Sinkronkan Standar BLC
                  </Button>
                )}
              </div>

              {/* Context Hint */}
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 text-xs text-purple-900">
                <p>
                  Menampilkan standar Capaian & Tujuan Pembelajaran BLC untuk <strong>Pilar {trisulaDomain} ({resolvedFase})</strong>. Menambahkan standar bawaan yang belum tersedia tanpa menimpa perubahan yang ada.
                </p>
              </div>

              {/* Trisula Domain CP & TPs */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                      Capaian Pembelajaran ({resolvedFase} — {trisulaDomain}):
                    </span>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                      {trisulaDomainCP?.teks || `Belum ada CP terdaftar untuk ${trisulaDomain} pada ${resolvedFase}.`}
                    </p>
                  </div>
                  {isAdmin && trisulaDomainCP && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEditCP(trisulaDomainCP)}
                      className="h-7 px-2 text-[11px] text-zinc-600 hover:bg-purple-100 shrink-0"
                    >
                      <Edit2 className="w-3 h-3 mr-1 text-purple-700" /> Edit CP
                    </Button>
                  )}
                </div>

                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                  Daftar Tujuan Pembelajaran Standar {trisulaDomain}:
                </h4>

                {trisulaDomainTPs.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">
                    Belum ada TP terdaftar untuk pilar ini. Klik &quot;Sinkronkan Standar BLC&quot; di atas untuk memuat kurikulum standar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {trisulaDomainTPs.map((tp) => (
                      <div
                        key={tp.id}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          {tp.kode && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 mr-2">
                              {tp.kode}
                            </span>
                          )}
                          <span className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                            {tp.teks}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditTP(tp)}
                                className="h-8 px-2 text-zinc-500 hover:text-purple-700 hover:bg-purple-50"
                                title="Edit TP Standar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteTP(tp)}
                                disabled={deletingId === tp.id}
                                className="h-8 px-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Hapus TP Standar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              onSelectTP({
                                tpId: tp.id,
                                teks: tp.teks,
                                cpId: tp.cp_id,
                                cpTeks: tp.cp_teks,
                                fase: tp.fase,
                                mataPelajaran: tp.mata_pelajaran_name || trisulaDomain,
                              });
                              onClose();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0 font-semibold"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Sisip TP
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CREATE MANUAL TP */}
          {activeTab === "CREATE_TP" && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Capaian Pembelajaran (CP) Induk (Opsional)
                </label>
                <select
                  value={newTpCpId}
                  onChange={(e) => setNewTpCpId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Tanpa Induk CP (Bebas) --</option>
                  {cpList.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.kode ? `[${cp.kode}] ` : ""}
                      {cp.teks.slice(0, 70)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Teks Tujuan Pembelajaran (TP)
                </label>
                <Textarea
                  value={newTpTeks}
                  onChange={(e) => setNewTpTeks(e.target.value)}
                  placeholder="Contoh: Peserta didik mampu menjelaskan konsep pecahan senilai menggunakan representasi gambar..."
                  rows={4}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("BROWSE")}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateTP}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Simpan ke Bank TP
                </Button>
              </div>
            </div>
          )}

          {/* TAB 4: CREATE MANUAL CP */}
          {activeTab === "CREATE_CP" && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Bidang / Domain
                  </label>
                  <select
                    value={newCpDomain}
                    onChange={(e) => setNewCpDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Umum">Umum / Mata Pelajaran</option>
                    <option value="Literasi">Trisula — Literasi</option>
                    <option value="Numerasi">Trisula — Numerasi</option>
                    <option value="Diniyyah">Trisula — Diniyyah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Kode CP (Opsional)
                  </label>
                  <Input
                    value={newCpKode}
                    onChange={(e) => setNewCpKode(e.target.value)}
                    placeholder="Misal: CP-MAT-01"
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Teks Capaian Pembelajaran (CP)
                </label>
                <Textarea
                  value={newCpTeks}
                  onChange={(e) => setNewCpTeks(e.target.value)}
                  placeholder="Deskripsikan capaian kompetensi akhir fase yang diharapkan..."
                  rows={4}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveTab("BROWSE")}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateCP}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Simpan ke Bank CP
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit TP Modal Dialog */}
      {editingTP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Edit Tujuan Pembelajaran {editingTP.kode ? `(${editingTP.kode})` : ""}
                </h3>
              </div>
              <button onClick={() => setEditingTP(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                Induk Capaian Pembelajaran (CP)
              </label>
              <select
                value={editTpCpId}
                onChange={(e) => setEditTpCpId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
              >
                <option value="">-- Tanpa Induk CP --</option>
                {cpList.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.kode ? `[${cp.kode}] ` : ""}{cp.teks.slice(0, 60)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                Teks Tujuan Pembelajaran (TP)
              </label>
              <Textarea
                value={editTpTeks}
                onChange={(e) => setEditTpTeks(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="secondary" size="sm" onClick={() => setEditingTP(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditTP}
                disabled={savingEditTP}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {savingEditTP && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit CP Modal Dialog */}
      {editingCP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Edit Capaian Pembelajaran {editingCP.kode ? `(${editingCP.kode})` : ""}
                </h3>
              </div>
              <button onClick={() => setEditingCP(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                Kode CP
              </label>
              <Input
                value={editCpKode}
                onChange={(e) => setEditCpKode(e.target.value)}
                placeholder="Misal: CP-LIT-FA"
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                Teks Capaian Pembelajaran (CP)
              </label>
              <Textarea
                value={editCpTeks}
                onChange={(e) => setEditCpTeks(e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="secondary" size="sm" onClick={() => setEditingCP(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditCP}
                disabled={savingEditCP}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {savingEditCP && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
