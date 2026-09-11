"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { UX_COPY } from "@/lib/ux-copy";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PrintRenderer } from "@/components/print/print-renderer";
import { PageContainer, PageSection } from "@/components/ui/page-framework";
import { AIUsageStatus, getAIErrorMessageByReason } from "@/components/ai/AIUsageStatus";
import {
  Loader2, Plus, Sparkles, ArrowLeft, Printer, CheckCircle,
  WifiOff, Clock, RefreshCw, Trash2, Share2, ShieldCheck, PenSquare,
  BookOpen, Calculator, HeartHandshake, Database, Layers, FileText,
  Search, X, School, Users, CheckCircle2, ChevronRight, Bookmark, Tag
} from "lucide-react";
import { toast } from "sonner";
import {
  RPMActivityItem,
  RPMActivityInput,
  normalizeActivityItem,
  formatActivityItemWithTags
} from "@/lib/utils/rpmUtils";
import { resolvePhaseByClassName } from "@/lib/utils/academicUtils";
import { CurriculumBankModal, SelectedTPPayload } from "@/components/curriculum/CurriculumBankModal";

interface RPMItem {
  id: string;
  title: string;
  type: 'RPM' | 'KKTP' | 'TRISULA' | 'BLC_PACKAGE' | 'TABAYYUN';
  status: 'DRAFT' | 'PUBLISHED' | 'APPROVED' | 'ARCHIVED';
  version: number;
  author_id: string;
  author_name?: string;
  author_nip?: string | null;
  author_nuptk?: string | null;
  signer_name?: string;
  signer_nip?: string | null;
  signer_nuptk?: string | null;
  signed_at?: string | null;
  blc_shared_at?: string | null;
  updated_at: string;
  content: {
    identitas: {
      mataPelajaran: string;
      kelasRombel: string;
      tingkatFase: string;
      alokasiWaktu: number;
      modulTopik: string;
      namaTutorPengampu?: string;
      trisulaKompetensi?: string[];
      deskripsiTrisula?: { literasi?: string; numerasi?: string; diniyyah?: string };
      karakterFitrah?: string[];
      budayaSahabat?: string[];
      dplUtsman?: string[];
      dplKurnas?: string[];
    };
    desainPembelajaran: {
      capaianPembelajaran: string;
      pemahamanBermakna?: string;
      tujuanPembelajaran: string[];
      kegiatanPembelajaran: { awal: RPMActivityInput[]; inti: RPMActivityInput[]; akhir: RPMActivityInput[] };
      asesmen: { awal: string; formatif: string; sumatif: string; pesanEdukasiOrangTua?: string };
    };
  };
}

/**
 * Editor komponen terpisah untuk poin-poin aktivitas pembelajaran.
 * Guru bisa mengedit teks aktivitas dan memilih/mengubah tagBudaya & tagKarakter secara independen.
 */
interface ActivityListEditorProps {
  label: string;
  items: RPMActivityItem[];
  onChange: (newItems: RPMActivityItem[]) => void;
  availableBudayaTags: string[];
  availableKarakterTags: string[];
}

function ActivityListEditor({
  label,
  items,
  onChange,
  availableBudayaTags,
  availableKarakterTags,
}: ActivityListEditorProps) {
  const handleUpdateItemText = (idx: number, teks: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], teks };
    onChange(updated);
  };

  const handleToggleBudayaTag = (idx: number, tag: string) => {
    const updated = [...items];
    const item = { ...updated[idx] };
    const current = item.tagBudaya || [];
    if (current.includes(tag)) {
      item.tagBudaya = current.filter((t) => t !== tag);
    } else {
      item.tagBudaya = [...current, tag];
    }
    updated[idx] = item;
    onChange(updated);
  };

  const handleToggleKarakterTag = (idx: number, tag: string) => {
    const updated = [...items];
    const item = { ...updated[idx] };
    const current = item.tagKarakter || [];
    if (current.includes(tag)) {
      item.tagKarakter = current.filter((t) => t !== tag);
    } else {
      item.tagKarakter = [...current, tag];
    }
    updated[idx] = item;
    onChange(updated);
  };

  const handleAddItem = () => {
    onChange([...items, { teks: "Aktivitas baru (10 Menit)", tagBudaya: [], tagKarakter: [] }]);
  };

  const handleRemoveItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2.5 border border-gray-200/90 p-4 rounded-xl bg-white shadow-2xs">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">{label}</label>
        <Button size="sm" variant="ghost" onClick={handleAddItem} className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 font-semibold">
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Poin
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => {
          const norm = normalizeActivityItem(item);
          return (
            <div key={idx} className="p-3.5 border border-gray-200 rounded-lg bg-gray-50/70 space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-bold text-gray-400 mt-2">{idx + 1}.</span>
                <Textarea
                  value={norm.teks}
                  onChange={(e) => handleUpdateItemText(idx, e.target.value)}
                  placeholder="Deskripsi langkah aktivitas (N Menit)..."
                  rows={2}
                  className="flex-1 text-xs min-h-[52px] bg-white border-gray-200"
                />
                {items.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveItem(idx)}
                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Pemilihan Anotasi Tag Budaya & Karakter per Poin Aktivitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-200/80">
                <div>
                  <span className="text-[11px] font-bold text-purple-900 block mb-1">Tag Budaya SAHABAT:</span>
                  <div className="flex flex-wrap gap-1">
                    {availableBudayaTags.length === 0 && (
                      <span className="text-[10px] italic text-gray-400">Pilih tag Budaya SAHABAT di atas dahulu</span>
                    )}
                    {availableBudayaTags.map((tag) => {
                      const selected = (norm.tagBudaya || []).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleBudayaTag(idx, tag)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                            selected
                              ? "bg-purple-600 text-white border-purple-700 font-semibold shadow-xs"
                              : "bg-white text-gray-600 border-gray-300 hover:bg-purple-50"
                          }`}
                        >
                          {selected ? `✓ ${tag}` : `+ ${tag}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-emerald-900 block mb-1">Tag Karakter (Fitrah / DPL):</span>
                  <div className="flex flex-wrap gap-1">
                    {availableKarakterTags.length === 0 && (
                      <span className="text-[10px] italic text-gray-400">Pilih tag Karakter/DPL di atas dahulu</span>
                    )}
                    {availableKarakterTags.map((tag) => {
                      const selected = (norm.tagKarakter || []).includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleKarakterTag(idx, tag)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                            selected
                              ? "bg-emerald-600 text-white border-emerald-700 font-semibold shadow-xs"
                              : "bg-white text-gray-600 border-gray-300 hover:bg-emerald-50"
                          }`}
                        >
                          {selected ? `✓ ${tag}` : `+ ${tag}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RPMPage() {
  const { user } = useAuth();
  const isAdmin = user && ['administrator', 'admin'].includes(user.role);

  const [documents, setDocuments] = useState<RPMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'MY_ACTIVE' | 'ALL'>('MY_ACTIVE');
  const [rpmSearch, setRpmSearch] = useState('');
  const [view, setView] = useState<'LIST' | 'WIZARD' | 'PRINT'>('LIST');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeDoc, setActiveDoc] = useState<RPMItem | null>(null);

  // Filter documents: MY_ACTIVE prioritizes current user's active work
  const displayedDocs = useMemo(() => {
    let docs = documents;
    if (filterTab === 'MY_ACTIVE' && user) {
      const myDocs = documents.filter(doc => doc.author_id === user.id);
      docs = myDocs.length > 0 ? myDocs : documents;
    }

    if (!rpmSearch.trim()) return docs;
    const q = rpmSearch.toLowerCase();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.content?.identitas?.modulTopik && d.content.identitas.modulTopik.toLowerCase().includes(q)) ||
        (d.content?.identitas?.mataPelajaran && d.content.identitas.mataPelajaran.toLowerCase().includes(q)) ||
        (d.content?.identitas?.kelasRombel && d.content.identitas.kelasRombel.toLowerCase().includes(q))
    );
  }, [documents, filterTab, user, rpmSearch]);

  // Desktop Stats (Cheap client computation)
  const desktopStats = useMemo(() => {
    const totalRpm = documents.length;
    const myRpm = user ? documents.filter(d => d.author_id === user.id).length : totalRpm;
    const subjects = new Set<string>();
    const classes = new Set<string>();
    let sharedCount = 0;

    documents.forEach((d) => {
      if (d.content?.identitas?.mataPelajaran) subjects.add(d.content.identitas.mataPelajaran);
      if (d.content?.identitas?.kelasRombel) classes.add(d.content.identitas.kelasRombel);
      if (d.blc_shared_at) sharedCount++;
    });

    return {
      myRpm,
      totalRpm,
      totalSubjects: subjects.size,
      totalClasses: classes.size,
      sharedCount,
    };
  }, [documents, user]);

  // Konfirmasi hapus
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Berbagi BLC
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [mataPelajaran, setMataPelajaran] = useState("Matematika");
  const [kelasRombel, setKelasRombel] = useState("Kelas 5 Rombel A");
  const [tingkatFase, setTingkatFase] = useState("Fase C");
  const [alokasiWaktu, setAlokasiWaktu] = useState(70);
  const [modulTopik, setModulTopik] = useState("");
  const [namaTutorPengampu, setNamaTutorPengampu] = useState("");
  const [bankModalOpen, setBankModalOpen] = useState(false);

  const [capaianPembelajaran, setCapaianPembelajaran] = useState("");
  const [pemahamanBermakna, setPemahamanBermakna] = useState("");
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState<string[]>([""]);
  
  // Trisula 1-Paragraf Per Pilar State
  const [deskripsiTrisula, setDeskripsiTrisula] = useState<{ literasi: string; numerasi: string; diniyyah: string }>({
    literasi: "",
    numerasi: "",
    diniyyah: "",
  });

  // Kegiatan Pembelajaran Object State
  const [kegiatanAwal, setKegiatanAwal] = useState<RPMActivityItem[]>([
    { teks: "Pembukaan, doa bersama, dan apersepsi kontekstual (10 Menit)", tagBudaya: ["Disiplin"], tagKarakter: ["Adab & Akhlak"] }
  ]);
  const [kegiatanInti, setKegiatanInti] = useState<RPMActivityItem[]>([
    { teks: "Eksplorasi materi dasar dan diskusi kelompok terbimbing (50 Menit)", tagBudaya: ["Jujur", "Empati"], tagKarakter: ["Kemandirian", "Penalaran Kritis"] }
  ]);
  const [kegiatanAkhir, setKegiatanAkhir] = useState<RPMActivityItem[]>([
    { teks: "Refleksi pembelajaran, penarikan hikmah, dan doa penutup (10 Menit)", tagBudaya: ["Jujur"], tagKarakter: ["Keimanan"] }
  ]);

  const [asesmenAwal, setAsesmenAwal] = useState("Tanya Jawab Diagnostik");
  const [asesmenFormatif, setAsesmenFormatif] = useState("Observasi Diskusi & Rubrik Sikap");
  const [asesmenSumatif, setAsesmenSumatif] = useState("Evaluasi Tertulis & Unjuk Kerja");
  const [pesanEdukasiOrangTua, setPesanEdukasiOrangTua] = useState("");

  // Tag & Checkbox state (5 Kategori Baku)
  const [trisulaTags, setTrisulaTags] = useState<string[]>(["Literasi", "Numerasi", "Diniyyah"]);
  const [karakterTags, setKarakterTags] = useState<string[]>(["Keimanan", "Kemandirian", "Adab & Akhlak", "Kreativitas"]);
  const [budayaSahabatTags, setBudayaSahabatTags] = useState<string[]>(["Disiplin", "Jujur", "Empati", "Tanggung Jawab"]);
  const [dplUtsmanTags, setDplUtsmanTags] = useState<string[]>(["Keberanian", "Kedermawanan", "Kejujuran"]);
  const [dplKurnasTags, setDplKurnasTags] = useState<string[]>(["Penalaran Kritis", "Kemandirian", "Kreativitas", "Kolaborasi"]);

  // Master Data Options
  const [masterSubjects, setMasterSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [masterClasses, setMasterClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [masterTeachers, setMasterTeachers] = useState<Array<{ id: string; full_name: string }>>([]);

  useEffect(() => {
    // Load Master Data
    const loadMasterData = async () => {
      try {
        const [subjRes, classRes, usersRes] = await Promise.all([
          fetch("/api/v1/subjects"),
          fetch("/api/v1/classes"),
          fetch("/api/v1/users?role=teacher&limit=100")
        ]);
        const subjJson = await subjRes.json();
        const classJson = await classRes.json();
        const usersJson = await usersRes.json();

        const subjectsData = Array.isArray(subjJson.data?.data)
          ? subjJson.data.data
          : Array.isArray(subjJson.data?.items)
          ? subjJson.data.items
          : Array.isArray(subjJson.data)
          ? subjJson.data
          : [];

        const classesData = Array.isArray(classJson.data?.data)
          ? classJson.data.data
          : Array.isArray(classJson.data?.items)
          ? classJson.data.items
          : Array.isArray(classJson.data)
          ? classJson.data
          : [];

        const teachersData = Array.isArray(usersJson.data?.data)
          ? usersJson.data.data
          : Array.isArray(usersJson.data?.items)
          ? usersJson.data.items
          : Array.isArray(usersJson.data)
          ? usersJson.data
          : [];

        if (subjJson.success) setMasterSubjects(subjectsData);
        if (classJson.success) setMasterClasses(classesData);
        if (usersJson.success) {
          setMasterTeachers(
            teachersData.map((u: any) => ({
              id: u.id,
              full_name: u.full_name || u.name || "Guru",
            }))
          );
        }
      } catch (err) {
        console.error("Gagal memuat master data RPM:", err);
      }
    };
    loadMasterData();
  }, []);

  // Duration check
  const totalDurasi = useMemo(() => {
    let total = 0;
    const allActivities = [...kegiatanAwal, ...kegiatanInti, ...kegiatanAkhir];
    for (const act of allActivities) {
      const match = act.teks.match(/\((\d+)\s*Menit\)/i);
      if (match && match[1]) {
        total += parseInt(match[1], 10);
      }
    }
    return total > 0 ? total : null;
  }, [kegiatanAwal, kegiatanInti, kegiatanAkhir]);

  const durasiSesuai = totalDurasi === alokasiWaktu;

  // AI & Form Submission
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // P1-C: TP-specific AI loading state for Step 2
  const [rpmTpAiLoading, setRpmTpAiLoading] = useState(false);

  // Auto-Save State
  type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [autoSaveLastTime, setAutoSaveLastTime] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveDraftIdRef = useRef<string | undefined>(undefined);

  // Modal State untuk Regenerate AI
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingAiContent, setPendingAiContent] = useState<any>(null);
  const [lastAiPayload, setLastAiPayload] = useState<any>(null);

  // Trisula Paragraph AI State
  const [trisulaAiLoading, setTrisulaAiLoading] = useState(false);
  const [showTrisulaOverwriteModal, setShowTrisulaOverwriteModal] = useState(false);
  const [pendingTrisulaContent, setPendingTrisulaContent] = useState<{ literasi: string; numerasi: string; diniyyah: string } | null>(null);

  const fetchRPMDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/documents?type=RPM");
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.items || []);
      }
    } catch {
      toast.error("Gagal memuat daftar dokumen RPM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRPMDocuments();
  }, [fetchRPMDocuments]);

  // Build Payload
  const buildPayload = useCallback(() => ({
    type: "RPM" as const,
    title: title.trim() || `RPM ${mataPelajaran} - ${modulTopik || "Topik Baru"}`,
    content: {
      identitas: {
        mataPelajaran,
        kelasRombel,
        tingkatFase,
        alokasiWaktu,
        modulTopik,
        namaTutorPengampu: namaTutorPengampu || user?.name,
        trisulaKompetensi: trisulaTags,
        deskripsiTrisula,
        karakterFitrah: karakterTags,
        budayaSahabat: budayaSahabatTags,
        dplUtsman: dplUtsmanTags,
        dplKurnas: dplKurnasTags,
      },
      desainPembelajaran: {
        capaianPembelajaran,
        pemahamanBermakna,
        tujuanPembelajaran: tujuanPembelajaran.filter((t) => t.trim().length > 0),
        kegiatanPembelajaran: {
          awal: kegiatanAwal,
          inti: kegiatanInti,
          akhir: kegiatanAkhir,
        },
        asesmen: {
          awal: asesmenAwal,
          formatif: asesmenFormatif,
          sumatif: asesmenSumatif,
          pesanEdukasiOrangTua,
        },
      },
    },
  }), [
    title, mataPelajaran, kelasRombel, tingkatFase, alokasiWaktu, modulTopik,
    namaTutorPengampu, user?.name, trisulaTags, deskripsiTrisula, karakterTags,
    budayaSahabatTags, dplUtsmanTags, dplKurnasTags, capaianPembelajaran,
    pemahamanBermakna, tujuanPembelajaran, kegiatanAwal, kegiatanInti, kegiatanAkhir,
    asesmenAwal, asesmenFormatif, asesmenSumatif, pesanEdukasiOrangTua,
  ]);

  // Auto-Save Trigger
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!modulTopik.trim() && !capaianPembelajaran.trim()) return;
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
          setAutoSaveLastTime(new Date());
        } else {
          setAutoSaveStatus('error');
        }
      } catch {
        setAutoSaveStatus('error');
      }
    }, 4000);
  }, [modulTopik, capaianPembelajaran, activeDoc, buildPayload]);

  useEffect(() => {
    if (view !== 'WIZARD') return;
    triggerAutoSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [view, triggerAutoSave, title, modulTopik, capaianPembelajaran, pemahamanBermakna, tujuanPembelajaran, kegiatanAwal, kegiatanInti, kegiatanAkhir, deskripsiTrisula]);

  const handleCreateNew = () => {
    setActiveDoc(null);
    autoSaveDraftIdRef.current = undefined;
    setAutoSaveStatus('idle');
    setAutoSaveLastTime(null);
    setTitle("");
    setMataPelajaran(masterSubjects[0]?.name || "Matematika");
    setKelasRombel(masterClasses[0]?.name || "Kelas 5 Rombel A");
    setTingkatFase("Fase C");
    setAlokasiWaktu(70);
    setModulTopik("");
    setNamaTutorPengampu(user?.name || "");
    setCapaianPembelajaran("");
    setPemahamanBermakna("");
    setTujuanPembelajaran([""]);
    setDeskripsiTrisula({ literasi: "", numerasi: "", diniyyah: "" });
    setKegiatanAwal([{ teks: "Pembukaan, doa bersama, dan apersepsi kontekstual (10 Menit)", tagBudaya: ["Disiplin"], tagKarakter: ["Adab & Akhlak"] }]);
    setKegiatanInti([{ teks: "Eksplorasi materi dasar dan diskusi kelompok terbimbing (50 Menit)", tagBudaya: ["Jujur", "Empati"], tagKarakter: ["Kemandirian", "Penalaran Kritis"] }]);
    setKegiatanAkhir([{ teks: "Refleksi pembelajaran, penarikan hikmah, dan doa penutup (10 Menit)", tagBudaya: ["Jujur"], tagKarakter: ["Keimanan"] }]);
    setAsesmenAwal("Tanya Jawab Diagnostik");
    setAsesmenFormatif("Observasi Diskusi & Rubrik Sikap");
    setAsesmenSumatif("Evaluasi Tertulis & Unjuk Kerja");
    setPesanEdukasiOrangTua("");
    setStep(1);
    setView('WIZARD');
  };

  const applyAiContent = (aiData: any) => {
    if (!aiData) return;
    setCapaianPembelajaran(aiData.desainPembelajaran?.capaianPembelajaran || "");
    setPemahamanBermakna(aiData.desainPembelajaran?.pemahamanBermakna || "");
    setTujuanPembelajaran(aiData.desainPembelajaran?.tujuanPembelajaran || [""]);
    
    if (aiData.identitas?.trisulaKompetensi) setTrisulaTags(aiData.identitas.trisulaKompetensi);
    if (aiData.identitas?.deskripsiTrisula) {
      setDeskripsiTrisula({
        literasi: aiData.identitas.deskripsiTrisula.literasi || "",
        numerasi: aiData.identitas.deskripsiTrisula.numerasi || "",
        diniyyah: aiData.identitas.deskripsiTrisula.diniyyah || "",
      });
    }
    if (aiData.identitas?.karakterFitrah) setKarakterTags(aiData.identitas.karakterFitrah);
    if (aiData.identitas?.budayaSahabat) setBudayaSahabatTags(aiData.identitas.budayaSahabat);
    if (aiData.identitas?.dplUtsman) setDplUtsmanTags(aiData.identitas.dplUtsman);
    if (aiData.identitas?.dplKurnas) setDplKurnasTags(aiData.identitas.dplKurnas);

    if (aiData.desainPembelajaran?.kegiatanPembelajaran) {
      setKegiatanAwal((aiData.desainPembelajaran.kegiatanPembelajaran.awal || []).map(normalizeActivityItem));
      setKegiatanInti((aiData.desainPembelajaran.kegiatanPembelajaran.inti || []).map(normalizeActivityItem));
      setKegiatanAkhir((aiData.desainPembelajaran.kegiatanPembelajaran.akhir || []).map(normalizeActivityItem));
    }

    if (aiData.desainPembelajaran?.asesmen) {
      setAsesmenAwal(aiData.desainPembelajaran.asesmen.awal || "Tanya Jawab Diagnostik");
      setAsesmenFormatif(aiData.desainPembelajaran.asesmen.formatif || "Observasi Diskusi");
      setAsesmenSumatif(aiData.desainPembelajaran.asesmen.sumatif || "Evaluasi Tertulis");
      setPesanEdukasiOrangTua(aiData.desainPembelajaran.asesmen.pesanEdukasiOrangTua || "");
    }
  };

  const handleGenerateAI = async (customPayload?: any) => {
    if (!modulTopik.trim() && !customPayload?.modulTopik) {
      toast.error("Silakan isi topik/modul terlebih dahulu.");
      return;
    }

    setAiLoading(true);
    setAiError(null);

    const payload = customPayload || {
      mataPelajaran,
      kelasRombel,
      tingkatFase,
      alokasiWaktu,
      modulTopik,
    };
    setLastAiPayload(payload);

    try {
      const res = await fetch("/api/v1/rpm/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setAiError(json.message || "Gagal menghasilkan dokumen.");
        toast.error(json.message || "Gagal menghasilkan dokumen.");
        return;
      }

      if (json.data?.source === 'FALLBACK') {
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, "Menggunakan template kurikulum nasional standar."));
      } else {
        toast.success("Rancangan RPM berhasil dirumuskan oleh AI.");
      }

      const hasExistingContent = capaianPembelajaran.trim().length > 0 || (tujuanPembelajaran.length > 0 && tujuanPembelajaran[0].trim().length > 0);
      if (hasExistingContent) {
        setPendingAiContent(json.data);
        setShowOverwriteModal(true);
      } else {
        applyAiContent(json.data);
        setStep(2);
      }
    } catch {
      setAiError("Terjadi kendala jaringan saat menghubungi AI.");
      toast.error("Terjadi kendala jaringan saat menghubungi AI.");
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * P1-C: Generate TP suggestions for the current RPM context using AI.
   * Reuses the shared /api/v1/kktp/generate-tp-ai endpoint (canonical contract).
   * Appends AI-generated TPs to tujuanPembelajaran without overwriting existing ones.
   */
  const handleGenerateRPMTPWithAI = async () => {
    if (!modulTopik.trim()) {
      toast.error('Isi topik/modul terlebih dahulu di Langkah 1.');
      return;
    }
    setRpmTpAiLoading(true);
    try {
      const res = await fetch('/api/v1/kktp/generate-tp-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topikMateri: modulTopik.trim(),
          mataPelajaran,
          tingkatFase,
        }),
      });
      let json: any;
      try { json = await res.json(); } catch {
        toast.error('Respons server tidak valid.');
        return;
      }
      if (!res.ok || !json.success) {
        toast.error(json?.message || 'Gagal menghasilkan saran TP.');
        return;
      }
      const saranTP: string[] = json.data?.saranTP || [];
      if (saranTP.length === 0) {
        toast.warning('AI tidak menghasilkan saran TP. Coba topik yang lebih spesifik.');
        return;
      }
      // Append to existing list; remove trailing empty placeholder if only 1 empty entry
      setTujuanPembelajaran((prev) => {
        const filtered = prev.filter((t) => t.trim().length > 0);
        return [...filtered, ...saranTP];
      });
      const source = json.data?.source;
      if (source === 'FALLBACK') {
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, 'Menggunakan TP kurikulum nasional standar.'));
      } else {
        toast.success(`${saranTP.length} saran TP berhasil dibuat oleh AI.`);
      }
    } catch {
      toast.error('Terjadi kendala jaringan saat menghubungi AI.');
    } finally {
      setRpmTpAiLoading(false);
    }
  };

  /**
   * P1-A: Apply selected TPs from CurriculumBankModal into tujuanPembelajaran.
   * Deduplicates using normalized text comparison, appends without replacing existing entries,
   * and preserves full editability.
   */
  const handleApplyBankTPs = (selectedList: SelectedTPPayload[]) => {
    if (!selectedList || selectedList.length === 0) return;

    // Set CP jika capaianPembelajaran saat ini masih kosong dan ada CP teks di salah satu TP
    const firstWithCP = selectedList.find((s) => s.cpTeks && s.cpTeks.trim().length > 0);
    if (firstWithCP?.cpTeks && !capaianPembelajaran.trim()) {
      setCapaianPembelajaran(firstWithCP.cpTeks);
    }

    const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

    // TP yang valid saat ini
    const currentValid = tujuanPembelajaran.filter((t) => t.trim().length > 0);
    const existingNormalized = new Set(currentValid.map(normalize));

    const toAdd: string[] = [];
    let duplicateCount = 0;

    for (const item of selectedList) {
      const rawTeks = (item.teks || "").trim();
      if (!rawTeks) continue;
      const norm = normalize(rawTeks);
      if (existingNormalized.has(norm)) {
        duplicateCount++;
      } else {
        existingNormalized.add(norm);
        toAdd.push(rawTeks);
      }
    }

    if (toAdd.length === 0) {
      toast.info(duplicateCount > 0 ? "Semua TP terpilih sudah ada dalam daftar." : "Tidak ada TP yang dipilih.");
      return;
    }

    setTujuanPembelajaran([...currentValid, ...toAdd]);

    if (duplicateCount > 0) {
      toast.success(`${toAdd.length} TP dari Bank berhasil ditambahkan (${duplicateCount} duplikat diabaikan).`);
    } else {
      toast.success(`${toAdd.length} TP dari Bank berhasil ditambahkan.`);
    }
  };

  /**
   * P1-B: Generate 1-paragraph descriptions for Trisula (Literasi, Numerasi, Diniyyah & Adab)
   * based on the current RPM context. Protects manual work if existing paragraphs are present.
   */
  const handleGenerateTrisulaAI = async () => {
    if (!modulTopik.trim()) {
      toast.error("Isi topik/modul terlebih dahulu di Langkah 1.");
      return;
    }

    setTrisulaAiLoading(true);
    try {
      const res = await fetch("/api/v1/rpm/generate-trisula-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mataPelajaran,
          tingkatFase,
          kelasRombel,
          modulTopik: modulTopik.trim(),
          tujuanPembelajaran: tujuanPembelajaran.filter((t) => t.trim().length > 0),
          kegiatanPembelajaran: {
            awal: kegiatanAwal,
            inti: kegiatanInti,
            akhir: kegiatanAkhir,
          },
          alokasiWaktu,
        }),
      });

      let json: any;
      try {
        json = await res.json();
      } catch {
        toast.error("Respons server tidak valid.");
        return;
      }

      if (!res.ok || !json.success) {
        toast.error(json?.message || "Gagal menghasilkan rincian Trisula.");
        return;
      }

      const resultData = json.data?.data || json.data;
      if (!resultData?.literasi || !resultData?.numerasi || !resultData?.diniyyah) {
        toast.error("Format rincian Trisula dari AI tidak lengkap.");
        return;
      }

      const newTrisula = {
        literasi: resultData.literasi,
        numerasi: resultData.numerasi,
        diniyyah: resultData.diniyyah,
      };

      const hasExistingTrisula =
        deskripsiTrisula.literasi.trim().length > 0 ||
        deskripsiTrisula.numerasi.trim().length > 0 ||
        deskripsiTrisula.diniyyah.trim().length > 0;

      if (hasExistingTrisula) {
        setPendingTrisulaContent(newTrisula);
        setShowTrisulaOverwriteModal(true);
      } else {
        setDeskripsiTrisula(newTrisula);
        if (json.data?.source === "FALLBACK" || resultData?.source === "FALLBACK") {
          toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason || resultData?.fallbackReason, "Menggunakan draft standar kontekstual."));
        } else {
          toast.success("Rincian paragraf Trisula berhasil dibuat oleh AI.");
        }
      }
    } catch {
      toast.error("Terjadi kendala jaringan saat menghubungi AI.");
    } finally {
      setTrisulaAiLoading(false);
    }
  };

  const handleSaveRPM = async (createNewDraftVersion = false) => {
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let res;
      const targetDocId = createNewDraftVersion ? undefined : (autoSaveDraftIdRef.current || activeDoc?.id);

      if (targetDocId) {
        res = await fetch(`/api/v1/documents/${targetDocId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/v1/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Gagal menyimpan RPM.");
        return;
      }

      if (json.data?.signatureResetWarning) {
        toast.info(UX_COPY.rpm.messages.signatureReset);
      }

      toast.success(createNewDraftVersion ? "Draf versi baru berhasil dibuat. RPM langsung siap dipakai." : "RPM berhasil disimpan dan siap dipakai.");

      autoSaveDraftIdRef.current = undefined;
      setAutoSaveStatus('idle');
      setView('LIST');
      fetchRPMDocuments();
    } catch {
      toast.error("Gagal memproses dokumen RPM.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRPM = async (docId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success(UX_COPY.rpm.messages.deleteSuccess);
        setConfirmDeleteId(null);
        fetchRPMDocuments();
      } else {
        toast.error(json.message || "Gagal menghapus RPM.");
      }
    } catch {
      toast.error("Terjadi kendala saat menghapus RPM.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleBLC = async (doc: RPMItem) => {
    setSharingId(doc.id);
    const action = doc.blc_shared_at ? "UNSHARE_FROM_BLC" : "SHARE_TO_BLC";
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(action === "SHARE_TO_BLC" ? UX_COPY.rpm.messages.shareSuccess : UX_COPY.rpm.messages.unshareSuccess);
        fetchRPMDocuments();
      } else {
        toast.error(json.message || "Gagal mengubah status berbagi.");
      }
    } catch {
      toast.error("Terjadi kendala saat mengubah status berbagi.");
    } finally {
      setSharingId(null);
    }
  };

  const handleOpenPrint = (doc: RPMItem) => {
    setActiveDoc(doc);
    setView('PRINT');
  };

  // List gabungan tag Karakter untuk selector per poin aktivitas
  const combinedKarakterOptions = Array.from(
    new Set([...karakterTags, ...dplUtsmanTags, ...dplKurnasTags])
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PRINT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'PRINT' && activeDoc) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 print:p-0">
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <Button variant="secondary" onClick={() => setView('LIST')} className="min-h-[38px] text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar
          </Button>
          <Button onClick={() => window.print()} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold">
            <Printer className="w-4 h-4 mr-2" /> Cetak Dokumen
          </Button>
        </div>

        <PrintRenderer document={activeDoc}>
          <div className="space-y-6">

            {/* HALAMAN 1: Identitas & Rancangan Dasar */}
            <div className="print:min-h-[850px] space-y-4">
              <div className="border p-4 rounded-xl bg-gray-50/50 space-y-2">
                <h3 className="font-bold text-sm text-gray-700 uppercase border-b pb-1">Halaman 1 — Identitas & Rancangan Dasar</h3>
                <div className="grid grid-cols-2 text-xs gap-2 pt-1">
                  <p><span className="font-semibold">Topik / Modul:</span> {activeDoc.content?.identitas?.modulTopik || "-"}</p>
                  <p><span className="font-semibold">Mata Pelajaran:</span> {activeDoc.content?.identitas?.mataPelajaran || "-"}</p>
                  <p><span className="font-semibold">Fase / Kelas:</span> {activeDoc.content?.identitas?.tingkatFase || "-"} ({activeDoc.content?.identitas?.kelasRombel || "-"})</p>
                  <p><span className="font-semibold">Tutor Pengampu:</span> {activeDoc.content?.identitas?.namaTutorPengampu || activeDoc.author_name || "-"}</p>
                  <p><span className="font-semibold">Alokasi Waktu:</span> {activeDoc.content?.identitas?.alokasiWaktu || 0} Menit</p>
                </div>
              </div>

              <div className="border p-4 rounded-xl bg-gray-50/50">
                <h3 className="font-bold text-sm text-gray-700 uppercase mb-1">Capaian Pembelajaran (CP)</h3>
                <p className="text-xs leading-relaxed">{activeDoc.content?.desainPembelajaran?.capaianPembelajaran || "-"}</p>
              </div>

              {activeDoc.content?.desainPembelajaran?.pemahamanBermakna && (
                <div className="border p-4 rounded-xl bg-emerald-50/30">
                  <h3 className="font-bold text-sm text-emerald-900 uppercase mb-1">Pemahaman Bermakna (Deep Insight)</h3>
                  <p className="text-xs leading-relaxed">{activeDoc.content.desainPembelajaran.pemahamanBermakna}</p>
                </div>
              )}

              {/* Integrasi Tag & Karakter */}
              <div className="border p-4 rounded-xl bg-slate-50 space-y-3 text-xs">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide border-b pb-1">
                  Integrasi Tag & Karakter
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-bold text-emerald-900 block mb-0.5">Trisula Kompetensi:</span>
                    <div className="flex flex-wrap gap-1">
                      {(activeDoc.content?.identitas?.trisulaKompetensi && activeDoc.content.identitas.trisulaKompetensi.length > 0
                        ? activeDoc.content.identitas.trisulaKompetensi
                        : ["Literasi", "Numerasi", "Diniyyah"]
                      ).map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-blue-900 block mb-0.5">Karakter FITRAH:</span>
                    <div className="flex flex-wrap gap-1">
                      {(activeDoc.content?.identitas?.karakterFitrah && activeDoc.content.identitas.karakterFitrah.length > 0) ? (
                        activeDoc.content.identitas.karakterFitrah.map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px]">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">Belum ada tag karakter fitrah</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-purple-900 block mb-0.5">Budaya SAHABAT:</span>
                    <div className="flex flex-wrap gap-1">
                      {(activeDoc.content?.identitas?.budayaSahabat && activeDoc.content.identitas.budayaSahabat.length > 0) ? (
                        activeDoc.content.identitas.budayaSahabat.map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[11px]">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">Belum ada tag budaya sahabat</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Page break untuk cetak / PDF */}
            <div className="hidden print:block print:break-before-page" />

            {/* HALAMAN 2: Rincian Kegiatan Pembelajaran */}
            <div className="print:min-h-[850px] space-y-4 pt-4 print:pt-0">
              <h3 className="font-bold text-sm text-gray-700 uppercase border-b pb-1">Halaman 2 — Skenario Aktivitas Pembelajaran</h3>

              <div className="space-y-4 text-xs">
                <div className="p-3 border rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-emerald-800 border-b pb-1">1. Kegiatan Awal (Pendahuluan)</h4>
                  <ul className="space-y-2">
                    {(activeDoc.content?.desainPembelajaran?.kegiatanPembelajaran?.awal || []).map((act, i) => {
                      const norm = normalizeActivityItem(act);
                      return (
                        <li key={i} className="leading-relaxed flex items-start gap-2">
                          <span className="font-semibold text-emerald-700 mt-0.5">•</span>
                          <div className="flex-1">
                            <span>{norm.teks}</span>
                            {(norm.tagBudaya?.length || 0) > 0 || (norm.tagKarakter?.length || 0) > 0 ? (
                              <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
                                {norm.tagBudaya && norm.tagBudaya.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-900 font-semibold rounded text-[10px] border border-purple-200">
                                    Budaya: {norm.tagBudaya.join(", ")}
                                  </span>
                                )}
                                {norm.tagKarakter && norm.tagKarakter.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded text-[10px] border border-emerald-200">
                                    Karakter: {norm.tagKarakter.join(", ")}
                                  </span>
                                )}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="p-3 border rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-emerald-800 border-b pb-1">2. Kegiatan Inti (Eksplorasi & Kolaborasi)</h4>
                  <ul className="space-y-2">
                    {(activeDoc.content?.desainPembelajaran?.kegiatanPembelajaran?.inti || []).map((act, i) => {
                      const norm = normalizeActivityItem(act);
                      return (
                        <li key={i} className="leading-relaxed flex items-start gap-2">
                          <span className="font-semibold text-emerald-700 mt-0.5">•</span>
                          <div className="flex-1">
                            <span>{norm.teks}</span>
                            {(norm.tagBudaya?.length || 0) > 0 || (norm.tagKarakter?.length || 0) > 0 ? (
                              <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
                                {norm.tagBudaya && norm.tagBudaya.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-900 font-semibold rounded text-[10px] border border-purple-200">
                                    Budaya: {norm.tagBudaya.join(", ")}
                                  </span>
                                )}
                                {norm.tagKarakter && norm.tagKarakter.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded text-[10px] border border-emerald-200">
                                    Karakter: {norm.tagKarakter.join(", ")}
                                  </span>
                                )}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="p-3 border rounded-xl bg-white space-y-2">
                  <h4 className="font-bold text-emerald-800 border-b pb-1">3. Kegiatan Penutup (Refleksi & Doa)</h4>
                  <ul className="space-y-2">
                    {(activeDoc.content?.desainPembelajaran?.kegiatanPembelajaran?.akhir || []).map((act, i) => {
                      const norm = normalizeActivityItem(act);
                      return (
                        <li key={i} className="leading-relaxed flex items-start gap-2">
                          <span className="font-semibold text-emerald-700 mt-0.5">•</span>
                          <div className="flex-1">
                            <span>{norm.teks}</span>
                            {(norm.tagBudaya?.length || 0) > 0 || (norm.tagKarakter?.length || 0) > 0 ? (
                              <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
                                {norm.tagBudaya && norm.tagBudaya.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-900 font-semibold rounded text-[10px] border border-purple-200">
                                    Budaya: {norm.tagBudaya.join(", ")}
                                  </span>
                                )}
                                {norm.tagKarakter && norm.tagKarakter.length > 0 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded text-[10px] border border-emerald-200">
                                    Karakter: {norm.tagKarakter.join(", ")}
                                  </span>
                                )}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Page break untuk cetak / PDF */}
            <div className="hidden print:block print:break-before-page" />

            {/* HALAMAN 3: Asesmen & Madrasatul Ula */}
            <div className="print:min-h-[600px] space-y-4 pt-4 print:pt-0">
              <h3 className="font-bold text-sm text-gray-700 uppercase border-b pb-1">Halaman 3 — Asesmen & Edukasi Orang Tua (Madrasatul Ula)</h3>
              <div className="border p-4 rounded-xl bg-gray-50/50 space-y-2 text-xs">
                <h4 className="font-bold text-emerald-900 uppercase">Rencana Evaluasi & Asesmen Spesifik Topik</h4>
                <p><span className="font-semibold">Asesmen Awal (Diagnostik):</span> {activeDoc.content?.desainPembelajaran?.asesmen?.awal || "-"}</p>
                <p><span className="font-semibold">Asesmen Proses (Formatif - Rubrik Karakter):</span> {activeDoc.content?.desainPembelajaran?.asesmen?.formatif || "-"}</p>
                <p><span className="font-semibold">Asesmen Akhir (Sumatif Karya):</span> {activeDoc.content?.desainPembelajaran?.asesmen?.sumatif || "-"}</p>
              </div>

              {activeDoc.content?.desainPembelajaran?.asesmen?.pesanEdukasiOrangTua && (
                <div className="border p-4 rounded-xl bg-amber-50/40 border-amber-200">
                  <h4 className="font-bold text-xs text-amber-900 uppercase mb-1">Pesan Edukasi Orang Tua (Madrasatul Ula)</h4>
                  <p className="text-xs italic leading-relaxed text-amber-950">
                    "{activeDoc.content.desainPembelajaran.asesmen.pesanEdukasiOrangTua}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </PrintRenderer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: WIZARD / EDITOR (Responsive 2-Column Desktop Planning Workspace)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'WIZARD') {
    return (
      <PageContainer maxWidth="7xl" className="space-y-6">
        {/* Indikator auto-save & Step Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setView('LIST')} className="min-h-[36px] text-xs font-semibold">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Batal
            </Button>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <span className={`px-2.5 py-1 rounded-full ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                1. Topik & Identitas
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <span className={`px-2.5 py-1 rounded-full ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                2. Desain & Aktivitas
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              <span className={`px-2.5 py-1 rounded-full ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                3. Simpan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-emerald-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan draf...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" /> Draf tersimpan otomatis
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="flex items-center gap-1 text-amber-600">
                <WifiOff className="w-3.5 h-3.5" /> Belum tersinkronisasi
              </span>
            )}
          </div>
        </div>

        {/* STEP 1: Topik, Identitas & AI Prompting */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── Main Form (8 cols) ── */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="bg-white shadow-xs">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900 font-plus-jakarta">
                    Langkah 1: Tentukan Topik & Alokasi Waktu
                  </h2>
                  <p className="text-xs text-gray-500">
                    Isi informasi mata pelajaran dan topik pembelajaran yang akan dirancang.
                  </p>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Judul Dokumen RPM</label>
                    <Input
                      placeholder="Contoh: RPM Matematika - Perkalian Dasar Kelas 5"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-xs sm:text-sm bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Mata Pelajaran (Master Data)</label>
                      {masterSubjects.length > 0 ? (
                        <select
                          value={mataPelajaran}
                          onChange={(e) => setMataPelajaran(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200"
                        >
                          {masterSubjects.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <Input value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} className="text-xs" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Kelas / Rombel (Master Data)</label>
                      {masterClasses.length > 0 ? (
                        <select
                          value={kelasRombel}
                          onChange={(e) => {
                            const val = e.target.value;
                            setKelasRombel(val);
                            setTingkatFase(resolvePhaseByClassName(val));
                          }}
                          className="w-full min-h-[40px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200"
                        >
                          {masterClasses.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={kelasRombel}
                          onChange={(e) => {
                            const val = e.target.value;
                            setKelasRombel(val);
                            setTingkatFase(resolvePhaseByClassName(val));
                          }}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tutor Pengampu / Guru</label>
                      {masterTeachers.length > 0 ? (
                        <select
                          value={namaTutorPengampu}
                          onChange={(e) => setNamaTutorPengampu(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200"
                        >
                          <option value="">Pilih Tutor Pengampu...</option>
                          {masterTeachers.map((t) => (
                            <option key={t.id} value={t.full_name}>{t.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <Input placeholder="Nama Tutor Pengampu" value={namaTutorPengampu} onChange={(e) => setNamaTutorPengampu(e.target.value)} className="text-xs" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Alokasi Waktu (Menit)</label>
                      <Input
                        type="number"
                        value={alokasiWaktu}
                        onChange={(e) => setAlokasiWaktu(Number(e.target.value))}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Topik / Modul Pembelajaran</label>
                    <Textarea
                      placeholder="Deskripsikan topik pembelajaran yang ingin diajarkan secara kontekstual..."
                      value={modulTopik}
                      onChange={(e) => setModulTopik(e.target.value)}
                      rows={3}
                      className="text-xs"
                    />
                  </div>

                  <AIUsageStatus />
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/40 flex flex-col sm:flex-row gap-2.5 justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => handleGenerateAI()}
                    disabled={aiLoading}
                    className="min-h-[38px] border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold"
                  >
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                    Bantu Buat dengan AI (Gemini)
                  </Button>
                  <Button onClick={() => setStep(2)} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                    Isi Manual & Lanjut &rarr;
                  </Button>
                </div>
              </Card>
            </div>

            {/* ── Sticky Context & AI Panel (4 cols) ── */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
              <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Konteks Modul</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Mapel:</span>
                    <span className="font-bold text-gray-900">{mataPelajaran}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Kelas:</span>
                    <span className="font-bold text-gray-800">{kelasRombel}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500 font-medium">Fase:</span>
                    <span className="font-bold text-emerald-700">{tingkatFase}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 font-medium">Durasi:</span>
                    <span className="font-bold text-gray-900">{alokasiWaktu} Menit</span>
                  </div>
                </div>
              </div>

              {aiError && !aiLoading && lastAiPayload && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs space-y-2">
                  <p className="text-amber-800 font-semibold">{aiError}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleGenerateAI(lastAiPayload)}
                    className="w-full text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Coba Generate Ulang
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Desain Pembelajaran, Tag & Aktivitas */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── Main Form Column (8 cols) ── */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="bg-white shadow-xs">
                <div className="border-b px-5 py-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-plus-jakarta">
                      Langkah 2: Tinjau & Edit Desain Pembelajaran
                    </h2>
                    <p className="text-xs text-gray-500">
                      Rincian Capaian Pembelajaran, Trisula, Tag Karakter, dan Skenario Aktivitas.
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Capaian Pembelajaran */}
                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-700">Capaian Pembelajaran (CP)</label>
                    <Textarea
                      placeholder="Tuliskan Capaian Pembelajaran (CP) yang menjadi acuan..."
                      value={capaianPembelajaran}
                      onChange={(e) => setCapaianPembelajaran(e.target.value)}
                      rows={3}
                      className="text-xs"
                    />
                  </div>

                  {/* Tujuan Pembelajaran */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">Tujuan Pembelajaran (TP)</label>

                    {/* Empty State */}
                    {tujuanPembelajaran.length === 0 || (tujuanPembelajaran.length === 1 && !tujuanPembelajaran[0].trim()) ? (
                      <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 text-center space-y-1">
                        <p className="text-xs font-semibold text-gray-700">Belum ada Tujuan Pembelajaran.</p>
                        <p className="text-[11px] text-gray-500">
                          Pilih dari Bank, Generate dengan AI, atau Tambahkan secara manual.
                        </p>
                      </div>
                    ) : (
                      tujuanPembelajaran.map((tp, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <span className="text-xs font-bold text-gray-400 mt-2">{idx + 1}.</span>
                          <Input
                            value={tp}
                            onChange={(e) => {
                              const updated = [...tujuanPembelajaran];
                              updated[idx] = e.target.value;
                              setTujuanPembelajaran(updated);
                            }}
                            placeholder={`Tujuan pembelajaran butir ${idx + 1}...`}
                            className="text-xs bg-white flex-1"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const updated = tujuanPembelajaran.filter((_, i) => i !== idx);
                              setTujuanPembelajaran(updated.length > 0 ? updated : [""]);
                            }}
                            className="h-9 w-9 p-0 text-red-500 hover:bg-red-50"
                            title="Hapus butir TP ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}

                    {/* Clustered Action Buttons: [Pilih dari Bank TP] [Generate TP dengan AI] [Tambah TP Manual] */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setBankModalOpen(true)}
                        className="text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
                      >
                        <Database className="w-3.5 h-3.5 mr-1.5" /> Pilih dari Bank TP
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerateRPMTPWithAI}
                        disabled={rpmTpAiLoading || !modulTopik.trim()}
                        className="text-xs h-8 border-violet-300 text-violet-700 hover:bg-violet-50 font-semibold"
                      >
                        {rpmTpAiLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                        Generate TP dengan AI
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const filtered = tujuanPembelajaran.filter((t) => t.trim().length > 0);
                          setTujuanPembelajaran([...filtered, ""]);
                        }}
                        className="text-xs h-8 text-gray-700 hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Tambah TP Manual
                      </Button>
                    </div>
                  </div>

                  {/* Pemahaman Bermakna */}
                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-700">Pemahaman Bermakna (Deep Insight)</label>
                    <Textarea
                      placeholder="Manfaat praktikal & hikmah konsep yang dipelajari siswa..."
                      value={pemahamanBermakna}
                      onChange={(e) => setPemahamanBermakna(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  {/* Tag Rekomendasi 5 Kategori Baku */}
                  <div className="p-4 border rounded-xl bg-emerald-50/30 space-y-3">
                    <label className="block text-xs font-bold text-emerald-900 uppercase">
                      Integrasi Rekomendasi Tag AI (5 Kategori Baku)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-bold text-gray-700 block mb-1">Trisula Kompetensi:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["Literasi", "Numerasi", "Diniyyah"].map((tag) => (
                            <label key={tag} className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border text-xs">
                              <input
                                type="checkbox"
                                checked={trisulaTags.includes(tag)}
                                onChange={(e) => {
                                  if (e.target.checked) setTrisulaTags([...trisulaTags, tag]);
                                  else setTrisulaTags(trisulaTags.filter((t) => t !== tag));
                                }}
                              />
                              {tag}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-gray-700 block mb-1">Karakter FITRAH:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["Keimanan", "Kemandirian", "Adab & Akhlak", "Keberanian", "Kreativitas", "Kepedulian"].map((tag) => (
                            <label key={tag} className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border text-xs">
                              <input
                                type="checkbox"
                                checked={karakterTags.includes(tag)}
                                onChange={(e) => {
                                  if (e.target.checked) setKarakterTags([...karakterTags, tag]);
                                  else setKarakterTags(karakterTags.filter((t) => t !== tag));
                                }}
                              />
                              {tag}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-gray-700 block mb-1">Budaya SAHABAT:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["Disiplin", "Jujur", "Empati", "Tanggung Jawab", "Kerja Keras", "Syukur", "Sabar"].map((tag) => (
                            <label key={tag} className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border text-xs">
                              <input
                                type="checkbox"
                                checked={budayaSahabatTags.includes(tag)}
                                onChange={(e) => {
                                  if (e.target.checked) setBudayaSahabatTags([...budayaSahabatTags, tag]);
                                  else setBudayaSahabatTags(budayaSahabatTags.filter((t) => t !== tag));
                                }}
                              />
                              {tag}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-gray-700 block mb-1">DPL UTSMAN:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["Keberanian", "Kedermawanan", "Keteguhan", "Keadilan", "Kejujuran", "Kepemimpinan"].map((tag) => (
                            <label key={tag} className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border text-xs">
                              <input
                                type="checkbox"
                                checked={dplUtsmanTags.includes(tag)}
                                onChange={(e) => {
                                  if (e.target.checked) setDplUtsmanTags([...dplUtsmanTags, tag]);
                                  else setDplUtsmanTags(dplUtsmanTags.filter((t) => t !== tag));
                                }}
                              />
                              {tag}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rincian Paragraf Trisula (1 Paragraf Per Pilar) */}
                  <div className="p-4 border rounded-xl bg-slate-50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase">
                          Rincian Paragraf Trisula Kompetensi (1 Paragraf Per Pilar)
                        </label>
                        <p className="text-[11px] text-gray-500">
                          Uraian aktivitas terintegrasi untuk pilar Literasi, Numerasi, serta Diniyyah & Adab.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerateTrisulaAI}
                        disabled={trisulaAiLoading || !modulTopik.trim()}
                        className="text-xs h-8 border-violet-300 text-violet-700 hover:bg-violet-50 font-semibold shrink-0"
                      >
                        {trisulaAiLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Buat Rincian Trisula dengan AI
                      </Button>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Kegiatan Literasi:</span>
                        </span>
                        <Textarea
                          value={deskripsiTrisula.literasi}
                          onChange={(e) => setDeskripsiTrisula({ ...deskripsiTrisula, literasi: e.target.value })}
                          rows={3}
                          placeholder="Paragraf penjelasan kegiatan literasi terintegrasi topik..."
                          className="text-xs bg-white"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kegiatan Numerasi:</span>
                        </span>
                        <Textarea
                          value={deskripsiTrisula.numerasi}
                          onChange={(e) => setDeskripsiTrisula({ ...deskripsiTrisula, numerasi: e.target.value })}
                          rows={3}
                          placeholder="Paragraf penjelasan kegiatan numerasi terintegrasi topik..."
                          className="text-xs bg-white"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                          <span>Diniyyah & Adab:</span>
                        </span>
                        <Textarea
                          value={deskripsiTrisula.diniyyah}
                          onChange={(e) => setDeskripsiTrisula({ ...deskripsiTrisula, diniyyah: e.target.value })}
                          rows={3}
                          placeholder="Paragraf penjelasan kegiatan diniyyah & adab terintegrasi topik..."
                          className="text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Activity Editors */}
                  <ActivityListEditor
                    label="1. Kegiatan Pembelajaran (Awal / Pendahuluan)"
                    items={kegiatanAwal}
                    onChange={setKegiatanAwal}
                    availableBudayaTags={budayaSahabatTags}
                    availableKarakterTags={combinedKarakterOptions}
                  />

                  <ActivityListEditor
                    label="2. Kegiatan Pembelajaran (Inti / Eksplorasi)"
                    items={kegiatanInti}
                    onChange={setKegiatanInti}
                    availableBudayaTags={budayaSahabatTags}
                    availableKarakterTags={combinedKarakterOptions}
                  />

                  <ActivityListEditor
                    label="3. Kegiatan Pembelajaran (Penutup / Refleksi)"
                    items={kegiatanAkhir}
                    onChange={setKegiatanAkhir}
                    availableBudayaTags={budayaSahabatTags}
                    availableKarakterTags={combinedKarakterOptions}
                  />

                  {/* Asesmen */}
                  <div className="p-4 border rounded-xl bg-gray-50/50 space-y-3 text-xs">
                    <label className="block text-xs font-bold text-gray-800 uppercase">
                      Rencana Evaluasi & Asesmen Spesifik Topik
                    </label>
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Asesmen Awal (Diagnostik)</label>
                      <Textarea value={asesmenAwal} onChange={(e) => setAsesmenAwal(e.target.value)} rows={2} className="text-xs bg-white" />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Asesmen Proses (Formatif - Rubrik Karakter Fitrah)</label>
                      <Textarea value={asesmenFormatif} onChange={(e) => setAsesmenFormatif(e.target.value)} rows={2} className="text-xs bg-white" />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Asesmen Akhir (Sumatif Karya)</label>
                      <Textarea value={asesmenSumatif} onChange={(e) => setAsesmenSumatif(e.target.value)} rows={2} className="text-xs bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-700">Pesan Edukasi Orang Tua (Madrasatul Ula)</label>
                    <Textarea
                      placeholder="Catatan/panduan pembiasaan harian siswa untuk orang tua di rumah..."
                      value={pesanEdukasiOrangTua}
                      onChange={(e) => setPesanEdukasiOrangTua(e.target.value)}
                      rows={2}
                      className="text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-gray-100 p-4 bg-gray-50/40">
                  <Button variant="secondary" onClick={() => setStep(1)} className="min-h-[38px] text-xs">
                    &larr; Kembali
                  </Button>
                  <Button onClick={() => setStep(3)} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                    Lanjut ke Simpan &rarr;
                  </Button>
                </div>
              </Card>
            </div>

            {/* ── Sticky Sidebar (4 cols) ── */}
            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
              {/* Duration Counter Card */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Durasi Pembelajaran</h3>
                </div>

                {totalDurasi !== null && (
                  <div className={`p-3 rounded-xl text-xs font-semibold border ${
                    durasiSesuai
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <p className="flex items-center justify-between">
                      <span>Total Durasi:</span>
                      <span className="font-bold">{totalDurasi} Menit</span>
                    </p>
                    <p className="flex items-center justify-between mt-1 text-[11px] opacity-80">
                      <span>Target Alokasi:</span>
                      <span>{alokasiWaktu} Menit</span>
                    </p>
                    <p className="mt-2 pt-2 border-t text-[11px]">
                      {durasiSesuai ? '✓ Durasi tepat sesuai target' : `Selisih ${Math.abs(totalDurasi - alokasiWaktu)} menit dari target`}
                    </p>
                  </div>
                )}

                <div className="space-y-1 text-xs pt-1">
                  <p className="text-gray-500"><span className="font-semibold text-gray-700">Topik:</span> {modulTopik || '-'}</p>
                  <p className="text-gray-500"><span className="font-semibold text-gray-700">Mapel:</span> {mataPelajaran}</p>
                  <p className="text-gray-500"><span className="font-semibold text-gray-700">Kelas:</span> {kelasRombel}</p>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                <Button
                  onClick={() => setBankModalOpen(true)}
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Database className="w-3.5 h-3.5 mr-1.5" /> Pilih dari Bank TP
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="w-full text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Lanjut ke Simpan &rarr;
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Simpan & Ringkasan */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white shadow-xs">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900 font-plus-jakarta">
                  Langkah 3: Simpan &mdash; RPM Langsung Siap Dipakai
                </h2>
                <p className="text-xs text-gray-500">
                  RPM langsung aktif dan siap digunakan dalam proses pembelajaran tanpa menunggu approval.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="p-4 border rounded-xl bg-emerald-50/50 text-xs space-y-2">
                  <p className="font-bold text-emerald-900">Ringkasan Rencana Pembelajaran:</p>
                  <p><span className="font-semibold">Judul:</span> {title}</p>
                  <p><span className="font-semibold">Mapel & Topik:</span> {mataPelajaran} &mdash; {modulTopik}</p>
                  <p><span className="font-semibold">Durasi Target:</span> {alokasiWaktu} Menit</p>
                  <p><span className="font-semibold">Tag Terpilih:</span> Trisula ({trisulaTags.length}), Fitrah ({karakterTags.length}), Budaya ({budayaSahabatTags.length}), DPL Utsman ({dplUtsmanTags.length})</p>
                </div>
                <div className="flex items-start gap-3 p-3.5 border rounded-xl bg-blue-50/50 border-blue-200 text-xs text-blue-800">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <div>
                    <p className="font-semibold">RPM langsung berstatus "Siap Dipakai" setelah disimpan.</p>
                    <p className="mt-0.5 text-blue-600">Tanda tangan kepala sekolah bersifat opsional dan dapat dibubuhkan kapan saja.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 justify-end border-t border-gray-100 p-4 bg-gray-50/40">
                <Button variant="secondary" onClick={() => setStep(2)} disabled={submitting} className="min-h-[38px] text-xs">
                  &larr; Kembali Edit
                </Button>
                <Button
                  onClick={() => handleSaveRPM()}
                  disabled={submitting}
                  className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  {UX_COPY.rpm.actions.saveReady}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Modal Overwrite / Save Draft Baru */}
        {showOverwriteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">Tentukan Pilihan Regenerate AI</h3>
              <p className="text-xs text-gray-600">
                Anda sudah memiliki isian draf sebelumnya. Pilih salah satu:
              </p>
              <div className="space-y-2">
                <Button
                  className="w-full min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                  onClick={() => {
                    applyAiContent(pendingAiContent);
                    setShowOverwriteModal(false);
                    setPendingAiContent(null);
                    setStep(2);
                  }}
                >
                  Timpa yang Lama
                </Button>
                <Button
                  variant="secondary"
                  className="w-full min-h-[40px] border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold"
                  onClick={async () => {
                    setShowOverwriteModal(false);
                    applyAiContent(pendingAiContent);
                    setPendingAiContent(null);
                    await handleSaveRPM(true);
                    toast.success("Draf AI baru berhasil dibuat. Draf lama tetap tersimpan.");
                  }}
                >
                  Simpan Draf Baru
                </Button>
                <Button
                  variant="ghost"
                  className="w-full min-h-[36px] text-gray-500 text-xs"
                  onClick={() => {
                    setShowOverwriteModal(false);
                    setPendingAiContent(null);
                  }}
                >
                  Batal
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Overwrite Trisula AI */}
        {showTrisulaOverwriteModal && pendingTrisulaContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">Perbarui Rincian Trisula?</h3>
              <p className="text-xs text-gray-600">
                Kolom rincian Trisula sudah memiliki isian. Apakah Anda ingin menimpa dengan draf baru yang dirumuskan AI?
              </p>
              <div className="space-y-2">
                <Button
                  className="w-full min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                  onClick={() => {
                    setDeskripsiTrisula(pendingTrisulaContent);
                    setShowTrisulaOverwriteModal(false);
                    setPendingTrisulaContent(null);
                    toast.success("Rincian paragraf Trisula berhasil diperbarui.");
                  }}
                >
                  Timpa dengan Draf AI
                </Button>
                <Button
                  variant="ghost"
                  className="w-full min-h-[36px] text-gray-500 text-xs"
                  onClick={() => {
                    setShowTrisulaOverwriteModal(false);
                    setPendingTrisulaContent(null);
                  }}
                >
                  Batal (Pertahankan Isian Saat Ini)
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW (Responsive Desktop Table & Mobile Cards)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <PageContainer maxWidth="7xl" className="space-y-6">
      {/* Modal konfirmasi hapus */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">{UX_COPY.rpm.messages.deleteConfirm}</h3>
            <p className="text-xs text-gray-600">Dokumen yang dihapus tidak dapat dikembalikan lagi.</p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1 min-h-[38px] text-xs"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                className="flex-1 min-h-[38px] bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                onClick={() => handleDeleteRPM(confirmDeleteId)}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header matching SIUBA Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Modul Pembelajaran
            </span>
            <span className="text-xs text-gray-400">&bull;</span>
            <span className="text-xs text-gray-500 font-medium">Kurikulum Merdeka</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-plus-jakarta">
            RPM Saya / Rencana Pembelajaran
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Kelola rancangan pembelajaran aktif semester ini atau temukan modul siap pakai di Bank Modul BLC.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href="/blc">
            <Button variant="secondary" size="sm" className="min-h-[38px] text-xs border-purple-200 text-purple-700 hover:bg-purple-50 shadow-xs">
              <Database className="w-4 h-4 mr-1.5 text-purple-600" /> Bank Modul BLC
            </Button>
          </Link>
          <Button onClick={handleCreateNew} size="sm" className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs">
            <Plus className="w-4 h-4 mr-1.5" /> Buat RPM Baru
          </Button>
        </div>
      </div>

      {/* Desktop Aggregate Strip */}
      {!loading && documents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-semibold">RPM Saya</span>
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.myRpm}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Dokumen aktif</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-semibold">Mata Pelajaran</span>
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalSubjects}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Mapel terpetakan</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-semibold">Kelas / Rombel</span>
              <School className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 font-fredoka">{desktopStats.totalClasses}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Kelas terjangkau</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-semibold">Dibagikan ke BLC</span>
              <Share2 className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-purple-700 font-fredoka">{desktopStats.sharedCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Modul publik</p>
          </div>
        </div>
      )}

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/60 p-2.5 rounded-xl border border-gray-200/70">
        <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-200/70 shrink-0">
          <button
            onClick={() => setFilterTab('MY_ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              filterTab === 'MY_ACTIVE'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> RPM Saya
          </button>
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              filterTab === 'ALL'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Semua RPM ({documents.length})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari topik, judul, atau mapel..."
            value={rpmSearch}
            onChange={(e) => setRpmSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {rpmSearch && (
            <button onClick={() => setRpmSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center p-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-gray-500 font-medium">Memuat dokumen RPM...</p>
        </div>
      ) : displayedDocs.length === 0 ? (
        <Card className="text-center p-12 bg-white">
          <div className="space-y-3 py-6 max-w-md mx-auto">
            <Sparkles className="w-12 h-12 mx-auto text-emerald-600" />
            <h3 className="font-bold text-base text-gray-800">
              {rpmSearch
                ? 'RPM Tidak Ditemukan'
                : filterTab === 'MY_ACTIVE'
                ? 'Belum Ada RPM Semester Ini'
                : 'Belum Ada Dokumen RPM'}
            </h3>
            <p className="text-xs text-gray-500">
              {rpmSearch
                ? `Tidak ada RPM yang cocok dengan kata kunci "${rpmSearch}".`
                : filterTab === 'MY_ACTIVE'
                ? 'Mulai buat rancangan pembelajaran baru dengan bantuan AI atau temukan modul siap pakai di Bank Modul BLC.'
                : 'Buat dokumen Rencana Pembelajaran (RPM) pertama Anda secara terstruktur.'}
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button onClick={handleCreateNew} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white">
                <Plus className="w-4 h-4 mr-1.5" /> Buat RPM Baru
              </Button>
              <Link href="/blc">
                <Button variant="secondary" className="min-h-[38px] text-xs border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Database className="w-3.5 h-3.5 mr-1.5" /> Buka Bank Modul BLC
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* ── DESKTOP VIEW: Tabular List (hidden md:block) ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">No</th>
                    <th className="py-3.5 px-4">Judul & Topik RPM</th>
                    <th className="py-3.5 px-4 w-36">Mata Pelajaran</th>
                    <th className="py-3.5 px-4 w-36">Kelas / Fase</th>
                    <th className="py-3.5 px-4 w-28">Status</th>
                    <th className="py-3.5 px-4 w-36">Penyusun</th>
                    <th className="py-3.5 px-4 w-48 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedDocs.map((doc, idx) => {
                    const isOwner = user && doc.author_id === user.id;
                    const canDelete = isOwner || isAdmin;
                    const canShare = isOwner;

                    return (
                      <tr key={doc.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900 text-sm truncate max-w-xs">{doc.title}</p>
                          <p className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5">
                            {doc.content?.identitas?.modulTopik || 'Topik Umum'} &bull; {doc.content?.identitas?.alokasiWaktu || 0} Menit
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold inline-block">
                            {doc.content?.identitas?.mataPelajaran || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-800">{doc.content?.identitas?.kelasRombel || '-'}</p>
                          <p className="text-[10px] text-gray-400">{doc.content?.identitas?.tingkatFase || '-'}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-emerald-100 text-emerald-800 border-emerald-200">
                              Siap
                            </span>
                            {doc.blc_shared_at && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-purple-100 text-purple-800 border-purple-200">
                                BLC
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 font-medium">
                          {doc.author_name || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs font-semibold"
                              onClick={() => handleOpenPrint(doc)}
                            >
                              <Printer className="w-3.5 h-3.5 mr-1 text-gray-600" /> Cetak
                            </Button>
                            {isOwner && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs font-semibold"
                                onClick={() => {
                                  setActiveDoc(doc);
                                  setTitle(doc.title);
                                  setMataPelajaran(doc.content?.identitas?.mataPelajaran || "");
                                  setKelasRombel(doc.content?.identitas?.kelasRombel || "");
                                  setTingkatFase(doc.content?.identitas?.tingkatFase || "");
                                  setAlokasiWaktu(doc.content?.identitas?.alokasiWaktu || 70);
                                  setModulTopik(doc.content?.identitas?.modulTopik || "");
                                  setNamaTutorPengampu(doc.content?.identitas?.namaTutorPengampu || "");
                                  setTrisulaTags(doc.content?.identitas?.trisulaKompetensi || ["Literasi", "Numerasi", "Diniyyah"]);
                                  setDeskripsiTrisula({
                                    literasi: doc.content?.identitas?.deskripsiTrisula?.literasi || "",
                                    numerasi: doc.content?.identitas?.deskripsiTrisula?.numerasi || "",
                                    diniyyah: doc.content?.identitas?.deskripsiTrisula?.diniyyah || "",
                                  });
                                  setKarakterTags(doc.content?.identitas?.karakterFitrah || []);
                                  setBudayaSahabatTags(doc.content?.identitas?.budayaSahabat || []);
                                  setDplUtsmanTags(doc.content?.identitas?.dplUtsman || []);
                                  setDplKurnasTags(doc.content?.identitas?.dplKurnas || []);
                                  setCapaianPembelajaran(doc.content?.desainPembelajaran?.capaianPembelajaran || "");
                                  setPemahamanBermakna(doc.content?.desainPembelajaran?.pemahamanBermakna || "");
                                  setTujuanPembelajaran(doc.content?.desainPembelajaran?.tujuanPembelajaran || [""]);
                                  setKegiatanAwal((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.awal || []).map(normalizeActivityItem));
                                  setKegiatanInti((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.inti || []).map(normalizeActivityItem));
                                  setKegiatanAkhir((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.akhir || []).map(normalizeActivityItem));
                                  setAsesmenAwal(doc.content?.desainPembelajaran?.asesmen?.awal || "");
                                  setAsesmenFormatif(doc.content?.desainPembelajaran?.asesmen?.formatif || "");
                                  setAsesmenSumatif(doc.content?.desainPembelajaran?.asesmen?.sumatif || "");
                                  setPesanEdukasiOrangTua(doc.content?.desainPembelajaran?.asesmen?.pesanEdukasiOrangTua || "");
                                  autoSaveDraftIdRef.current = doc.id;
                                  setStep(1);
                                  setView('WIZARD');
                                }}
                              >
                                <PenSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Edit
                              </Button>
                            )}
                            {canShare && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className={`h-8 w-8 p-0 ${doc.blc_shared_at ? 'border-purple-400 text-purple-700 hover:bg-purple-50' : 'text-gray-500'}`}
                                onClick={() => handleToggleBLC(doc)}
                                disabled={sharingId === doc.id}
                                title={doc.blc_shared_at ? UX_COPY.rpm.actions.unshareToBLC : UX_COPY.rpm.actions.shareToBLC}
                              >
                                {sharingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => setConfirmDeleteId(doc.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

          {/* ── MOBILE VIEW: Stacked Cards (md:hidden) ── */}
          <div className="md:hidden space-y-3">
            {displayedDocs.map((doc) => {
              const isOwner = user && doc.author_id === user.id;
              const canDelete = isOwner || isAdmin;
              const canShare = isOwner;

              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-emerald-100 text-emerald-800 border-emerald-200">
                          {UX_COPY.rpm.status.ready}
                        </span>
                        {doc.blc_shared_at && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-purple-100 text-purple-800 border-purple-200">
                            BLC
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{doc.title}</h3>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                    <p><span className="font-semibold text-gray-500">Topik:</span> {doc.content?.identitas?.modulTopik || "-"}</p>
                    <p><span className="font-semibold text-gray-500">Mapel:</span> {doc.content?.identitas?.mataPelajaran || "-"}</p>
                    <p><span className="font-semibold text-gray-500">Kelas:</span> {doc.content?.identitas?.kelasRombel || "-"}</p>
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenPrint(doc)}
                      className="flex-1 min-h-[38px] text-xs font-semibold"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" /> Cetak
                    </Button>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 min-h-[38px] text-xs font-semibold"
                        onClick={() => {
                          setActiveDoc(doc);
                          setTitle(doc.title);
                          setMataPelajaran(doc.content?.identitas?.mataPelajaran || "");
                          setKelasRombel(doc.content?.identitas?.kelasRombel || "");
                          setTingkatFase(doc.content?.identitas?.tingkatFase || "");
                          setAlokasiWaktu(doc.content?.identitas?.alokasiWaktu || 70);
                          setModulTopik(doc.content?.identitas?.modulTopik || "");
                          setNamaTutorPengampu(doc.content?.identitas?.namaTutorPengampu || "");
                          setTrisulaTags(doc.content?.identitas?.trisulaKompetensi || ["Literasi", "Numerasi", "Diniyyah"]);
                          setDeskripsiTrisula({
                            literasi: doc.content?.identitas?.deskripsiTrisula?.literasi || "",
                            numerasi: doc.content?.identitas?.deskripsiTrisula?.numerasi || "",
                            diniyyah: doc.content?.identitas?.deskripsiTrisula?.diniyyah || "",
                          });
                          setKarakterTags(doc.content?.identitas?.karakterFitrah || []);
                          setBudayaSahabatTags(doc.content?.identitas?.budayaSahabat || []);
                          setDplUtsmanTags(doc.content?.identitas?.dplUtsman || []);
                          setDplKurnasTags(doc.content?.identitas?.dplKurnas || []);
                          setCapaianPembelajaran(doc.content?.desainPembelajaran?.capaianPembelajaran || "");
                          setPemahamanBermakna(doc.content?.desainPembelajaran?.pemahamanBermakna || "");
                          setTujuanPembelajaran(doc.content?.desainPembelajaran?.tujuanPembelajaran || [""]);
                          setKegiatanAwal((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.awal || []).map(normalizeActivityItem));
                          setKegiatanInti((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.inti || []).map(normalizeActivityItem));
                          setKegiatanAkhir((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.akhir || []).map(normalizeActivityItem));
                          setAsesmenAwal(doc.content?.desainPembelajaran?.asesmen?.awal || "");
                          setAsesmenFormatif(doc.content?.desainPembelajaran?.asesmen?.formatif || "");
                          setAsesmenSumatif(doc.content?.desainPembelajaran?.asesmen?.sumatif || "");
                          setPesanEdukasiOrangTua(doc.content?.desainPembelajaran?.asesmen?.pesanEdukasiOrangTua || "");
                          autoSaveDraftIdRef.current = doc.id;
                          setStep(1);
                          setView('WIZARD');
                        }}
                      >
                        <PenSquare className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    )}
                    {canShare && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-[38px] w-10 p-0 text-xs"
                        onClick={() => handleToggleBLC(doc)}
                        disabled={sharingId === doc.id}
                        title={doc.blc_shared_at ? UX_COPY.rpm.actions.unshareToBLC : UX_COPY.rpm.actions.shareToBLC}
                      >
                        {sharingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-[38px] w-10 p-0 text-xs border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(doc.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Sisip TP & CP dari Bank */}
      <CurriculumBankModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        initialClassName={kelasRombel}
        initialSubjectName={mataPelajaran}
        initialFase={tingkatFase}
        title="Pilih Tujuan Pembelajaran dari Bank Kurikulum"
        onSelectTP={(selected) => {
          handleApplyBankTPs([selected]);
        }}
        onSelectTPs={(selectedList) => {
          handleApplyBankTPs(selectedList);
        }}
      />
    </PageContainer>
  );
}
