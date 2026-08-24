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
} from "lucide-react";
import { toast } from "sonner";
import { resolvePhaseByClassLevel, resolvePhaseByClassName, KurikulumFase, TRISULA_DOMAINS } from "@/lib/utils/academicUtils";

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
  title = "Pilih Tujuan Pembelajaran (Bank CP & TP)",
}: CurriculumBankModalProps) {
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

  // Data States
  const [cpList, setCpList] = useState<any[]>([]);
  const [tpList, setTpList] = useState<any[]>([]);
  const [loadingCP, setLoadingCP] = useState<boolean>(false);
  const [loadingTP, setLoadingTP] = useState<boolean>(false);

  // Create Form States
  const [newCpTeks, setNewCpTeks] = useState("");
  const [newCpKode, setNewCpKode] = useState("");
  const [newCpDomain, setNewCpDomain] = useState("Umum");
  const [newTpTeks, setNewTpTeks] = useState("");
  const [newTpCpId, setNewTpCpId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Trisula Tab Domain
  const [trisulaDomain, setTrisulaDomain] = useState<"Literasi" | "Numerasi" | "Diniyyah">("Literasi");

  // Load Real Active Classes from SIUBA Database
  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await fetch("/api/v1/classes?status=active&limit=100");
      const json = await res.json();
      const items = Array.isArray(json.data?.data) ? json.data.data : Array.isArray(json.data) ? json.data : [];
      if (json.success && items.length > 0) {
        setClassList(items);
        // Find matching class from initial props or current state
        const match = items.find((c: any) =>
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
      // silent
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

  // Load CPs
  const fetchCPs = useCallback(async () => {
    setLoadingCP(true);
    try {
      let url = `/api/v1/cp-bank?fase=${encodeURIComponent(resolvedFase)}`;
      if (selectedSubject && selectedSubject !== "Semua") {
        url += `&mata_pelajaran_name=${encodeURIComponent(selectedSubject)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setCpList(json.data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingCP(false);
    }
  }, [resolvedFase, selectedSubject]);

  // Load TPs
  const fetchTPs = useCallback(async () => {
    setLoadingTP(true);
    try {
      let url = `/api/v1/tp-bank?fase=${encodeURIComponent(resolvedFase)}`;
      if (selectedCPId && selectedCPId !== "ALL") {
        url += `&cp_id=${encodeURIComponent(selectedCPId)}`;
      }
      if (selectedSubject && selectedSubject !== "Semua") {
        url += `&mata_pelajaran_name=${encodeURIComponent(selectedSubject)}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setTpList(json.data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingTP(false);
    }
  }, [resolvedFase, selectedCPId, selectedSubject, searchQuery]);

  useEffect(() => {
    if (open) {
      fetchClasses();
      fetchCPs();
      fetchTPs();
    }
  }, [open, fetchClasses, fetchCPs, fetchTPs]);

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
        fetchCPs();
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
        fetchTPs();
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

  // Seed Trisula if empty
  const handleSeedTrisula = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/cp-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_trisula" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Kurikulum Trisula BLC berhasil disinkronkan.");
        fetchCPs();
        fetchTPs();
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
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
              <p className="text-xs text-zinc-500">
                Pilih atau buat Tujuan Pembelajaran Kurikulum Merdeka terintegrasi Trisula BLC.
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
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" /> Memuat kelas...
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
              <div className="flex items-center gap-2 ml-auto">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari teks TP/CP..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs w-44 sm:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
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
          {/* TAB 1: BROWSE CP & TP */}
          {activeTab === "BROWSE" && (
            <div className="space-y-4">
              {/* Filter CP Parent */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
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

              {/* Active CP Card Preview if Selected */}
              {selectedCPId !== "ALL" && (
                <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">
                    Capaian Pembelajaran (CP) Acuan:
                  </span>
                  <p className="text-zinc-700 dark:text-zinc-300 italic">
                    {cpList.find((c) => c.id === selectedCPId)?.teks}
                  </p>
                </div>
              )}

              {/* TP Item List */}
              {loadingTP ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : tpList.length === 0 ? (
                <div className="text-center py-12 space-y-2 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
                  <Layers className="w-8 h-8 mx-auto text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Belum ada Tujuan Pembelajaran yang sesuai pada {resolvedFase}.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setActiveTab("CREATE_TP")}
                    className="text-xs mt-2"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Buat TP Baru
                  </Button>

                </div>
              ) : (
                <div className="space-y-2">
                  {tpList.map((tp) => (
                    <div
                      key={tp.id}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {tp.fase}
                          </span>
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[36px] text-xs shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Gunakan TP
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRISULA BLC CURRICULUM */}
          {activeTab === "TRISULA" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
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

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSeedTrisula}
                  disabled={submitting}
                  className="text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" /> Sinkronkan Kurikulum
                </Button>

              </div>

              {/* Trisula Domain CP & TPs */}
              {(() => {
                const domainCP = cpList.find(
                  (c) =>
                    (c.domain_trisula === trisulaDomain || c.mata_pelajaran_name === trisulaDomain) &&
                    c.fase === resolvedFase
                );
                const domainTPs = tpList.filter(
                  (t) =>
                    (t.cp_domain_trisula === trisulaDomain ||
                     t.mata_pelajaran_name === trisulaDomain ||
                     t.cp_kode?.includes(trisulaDomain.slice(0, 3).toUpperCase())) &&
                    t.fase === resolvedFase
                );

                return (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                        Capaian Pembelajaran ({resolvedFase} — {trisulaDomain}):
                      </span>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                        {domainCP?.teks || `Belum ada CP terdaftar untuk ${trisulaDomain} pada ${resolvedFase}.`}
                      </p>
                    </div>

                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                      Daftar Tujuan Pembelajaran {trisulaDomain}:
                    </h4>

                    {domainTPs.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">
                        Belum ada TP terdaftar. Klik &quot;Sinkronkan Kurikulum&quot; di atas untuk memuat standar BLC.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {domainTPs.map((tp) => (
                          <div
                            key={tp.id}
                            className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3"
                          >
                            <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                              {tp.teks}
                            </p>
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
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Sisip TP
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
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
                      {cp.kode ? `[${cp.kode}] ` : ""}{cp.teks.slice(0, 70)}...
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} Simpan ke Bank CP
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
