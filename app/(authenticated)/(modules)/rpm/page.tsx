"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UX_COPY } from "@/lib/ux-copy";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PrintRenderer } from "@/components/print/print-renderer";
import { AIUsageStatus, getAIErrorMessageByReason } from "@/components/ai/AIUsageStatus";
import {
  Loader2, Plus, Sparkles, ArrowLeft, Printer, CheckCircle,
  WifiOff, Clock, RefreshCw, Trash2, Share2, ShieldCheck, PenSquare,
  BookOpen, Calculator, HeartHandshake
} from "lucide-react";
import { toast } from "sonner";
import {
  RPMActivityItem,
  RPMActivityInput,
  normalizeActivityItem,
  formatActivityItemWithTags
} from "@/lib/utils/rpmUtils";
import { resolvePhaseByClassName } from "@/lib/utils/academicUtils";
import { CurriculumBankModal } from "@/components/curriculum/CurriculumBankModal";

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
    <div className="space-y-2 border p-3 rounded-xl bg-white shadow-xs">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-bold text-gray-800 uppercase">{label}</label>
        <Button size="sm" variant="ghost" onClick={handleAddItem} className="h-7 text-xs text-emerald-700 hover:bg-emerald-50">
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Poin
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => {
          const norm = normalizeActivityItem(item);
          return (
            <div key={idx} className="p-3 border rounded-lg bg-gray-50/70 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-500 mt-2">{idx + 1}.</span>
                <Textarea
                  value={norm.teks}
                  onChange={(e) => handleUpdateItemText(idx, e.target.value)}
                  placeholder="Deskripsi langkah aktivitas (N Menit)..."
                  rows={2}
                  className="flex-1 text-xs min-h-[50px] bg-white"
                />
                {items.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveItem(idx)}
                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Pemilihan Anotasi Tag Budaya & Karakter per Poin Aktivitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200/80">
                <div>
                  <span className="text-[11px] font-semibold text-purple-900 block mb-1">Tag Budaya SAHABAT:</span>
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
                  <span className="text-[11px] font-semibold text-emerald-900 block mb-1">Tag Karakter (Fitrah / DPL):</span>
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
  const [view, setView] = useState<'LIST' | 'WIZARD' | 'PRINT'>('LIST');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeDoc, setActiveDoc] = useState<RPMItem | null>(null);

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
    const fetchMasterData = async () => {
      try {
        const [resSubj, resClass, resTeach] = await Promise.all([
          fetch("/api/v1/subjects?limit=50"),
          fetch("/api/v1/classes?limit=50"),
          fetch("/api/v1/teachers?limit=50"),
        ]);
        const jsonSubj = await resSubj.json();
        const jsonClass = await resClass.json();
        const jsonTeach = await resTeach.json();

        const subjects = jsonSubj.data?.data || jsonSubj.data?.items || (Array.isArray(jsonSubj.data) ? jsonSubj.data : []);
        const classes = jsonClass.data?.data || jsonClass.data?.items || (Array.isArray(jsonClass.data) ? jsonClass.data : []);
        const teachers = jsonTeach.data?.data || jsonTeach.data?.items || (Array.isArray(jsonTeach.data) ? jsonTeach.data : []);

        if (jsonSubj.success && Array.isArray(subjects)) {
          setMasterSubjects(subjects);
        }
        if (jsonClass.success && Array.isArray(classes)) {
          setMasterClasses(classes);
        }
        if (jsonTeach.success && Array.isArray(teachers)) {
          setMasterTeachers(teachers);
        }
      } catch {
        // Fallback jika API master data gagal
      }
    };
    fetchMasterData();
  }, []);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAiPayload, setLastAiPayload] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingAiContent, setPendingAiContent] = useState<any>(null);

  // Auto-save state
  type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [autoSaveLastTime, setAutoSaveLastTime] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveDraftIdRef = useRef<string | undefined>(undefined);

  const fetchRPMDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/documents?type=RPM");
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.items || []);
      } else {
        toast.error(json.message || "Gagal memuat daftar RPM.");
      }
    } catch {
      toast.error("Terjadi kendala saat memuat data RPM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRPMDocuments();
  }, [fetchRPMDocuments]);

  // ── Auto-Save Logic ─────────────────────────────────────────────────────────
  const buildRPMPayload = useCallback(() => ({
    type: 'RPM' as const,
    title: title.trim() || `RPM ${mataPelajaran} - ${modulTopik}`,
    content: {
      identitas: {
        mataPelajaran,
        kelasRombel,
        tingkatFase,
        alokasiWaktu,
        modulTopik,
        namaTutorPengampu,
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
        tujuanPembelajaran,
        kegiatanPembelajaran: { awal: kegiatanAwal, inti: kegiatanInti, akhir: kegiatanAkhir },
        asesmen: {
          awal: asesmenAwal,
          formatif: asesmenFormatif,
          sumatif: asesmenSumatif,
          pesanEdukasiOrangTua,
        },
      },
    },
  }), [title, mataPelajaran, kelasRombel, tingkatFase, alokasiWaktu, modulTopik, namaTutorPengampu,
       trisulaTags, deskripsiTrisula, karakterTags, budayaSahabatTags, dplUtsmanTags, dplKurnasTags,
       capaianPembelajaran, pemahamanBermakna, tujuanPembelajaran,
       kegiatanAwal, kegiatanInti, kegiatanAkhir, asesmenAwal, asesmenFormatif, asesmenSumatif, pesanEdukasiOrangTua]);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!modulTopik.trim()) return;
      const docId = autoSaveDraftIdRef.current || activeDoc?.id;

      setAutoSaveStatus('saving');
      try {
        const payload = buildRPMPayload();
        let res;
        if (docId) {
          res = await fetch(`/api/v1/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          res = await fetch('/api/v1/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
        const json = await res.json();
        if (json.success) {
          autoSaveDraftIdRef.current = json.data.id;
          setAutoSaveStatus('saved');
          setAutoSaveLastTime(new Date());
          if (json.data?.signatureResetWarning) {
            toast.info(UX_COPY.rpm.messages.signatureReset);
          }
        } else {
          setAutoSaveStatus('error');
        }
      } catch {
        setAutoSaveStatus('error');
      }
    }, 4000);
  }, [modulTopik, activeDoc, buildRPMPayload]);

  useEffect(() => {
    if (view !== 'WIZARD') return;
    triggerAutoSave();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [view, triggerAutoSave, title, mataPelajaran, kelasRombel, tingkatFase, alokasiWaktu,
      modulTopik, capaianPembelajaran, tujuanPembelajaran, kegiatanAwal, kegiatanInti,
      kegiatanAkhir, asesmenAwal, asesmenFormatif, asesmenSumatif, deskripsiTrisula]);

  // Hitung total durasi real-time untuk indikator BR-RPM-03
  const hitungTotalDurasi = useCallback(() => {
    const semua = [...kegiatanAwal, ...kegiatanInti, ...kegiatanAkhir];
    let total = 0;
    let semuaAdaMenit = semua.length > 0;
    for (const item of semua) {
      const norm = normalizeActivityItem(item);
      const m = norm.teks.match(/(\d+)\s*[Mm]enit/i);
      if (m) { total += parseInt(m[1], 10); } else { semuaAdaMenit = false; }
    }
    return semuaAdaMenit ? total : null;
  }, [kegiatanAwal, kegiatanInti, kegiatanAkhir]);

  const totalDurasi = hitungTotalDurasi();
  const durasiSesuai = totalDurasi !== null && totalDurasi === alokasiWaktu;

  const handleCreateNew = () => {
    setActiveDoc(null);
    autoSaveDraftIdRef.current = undefined;
    setAutoSaveStatus('idle');
    setTitle("");
    setModulTopik("");
    setCapaianPembelajaran("");
    setPemahamanBermakna("");
    setTujuanPembelajaran([""]);
    setDeskripsiTrisula({ literasi: "", numerasi: "", diniyyah: "" });
    setKegiatanAwal([{ teks: "Pembukaan, doa bersama, dan apersepsi kontekstual (10 Menit)", tagBudaya: ["Disiplin"], tagKarakter: ["Adab & Akhlak"] }]);
    setKegiatanInti([{ teks: "Eksplorasi materi dasar dan diskusi kelompok terbimbing (50 Menit)", tagBudaya: ["Jujur", "Empati"], tagKarakter: ["Kemandirian", "Penalaran Kritis"] }]);
    setKegiatanAkhir([{ teks: "Refleksi pembelajaran, penarikan hikmah, dan doa penutup (10 Menit)", tagBudaya: ["Jujur"], tagKarakter: ["Keimanan"] }]);
    setStep(1);
    setView('WIZARD');
  };

  const handleGenerateAI = async (customPayload?: any) => {
    const payload = customPayload || { mataPelajaran, kelasRombel, tingkatFase, alokasiWaktu, modulTopik };

    if (!payload.mataPelajaran || !payload.modulTopik || !payload.alokasiWaktu) {
      toast.error("Mata pelajaran, topik/modul, dan alokasi waktu wajib diisi.");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setLastAiPayload(payload);
    try {
      const res = await fetch("/api/v1/rpm/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        const errMsg = json.message || "Gagal terhubung ke AI. Coba lagi atau isi manual.";
        setAiError(errMsg);
        toast.error(errMsg);
        return;
      }

      const resultData = json.data;
      const source: 'GEMINI' | 'FALLBACK' = resultData?.source || 'GEMINI';
      const actualContent = resultData?.content || resultData;
      setAiError(null);

      if (capaianPembelajaran || (tujuanPembelajaran.length > 0 && tujuanPembelajaran[0])) {
        setPendingAiContent(actualContent);
        setShowOverwriteModal(true);
        return;
      }

      applyAiContent(actualContent);
      if (source === 'FALLBACK') {
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, "Template RPM lokal digunakan karena layanan AI sedang tidak tersedia. Silakan tinjau dan sesuaikan."));
      } else {
        toast.success("Rancangan RPM berhasil dibuat oleh AI. Silakan tinjau dan sesuaikan.");
      }
      setStep(2);
    } catch {
      const errMsg = "Gagal terhubung ke AI. Silakan periksa koneksi Anda.";
      setAiError(errMsg);
      toast.error(errMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiContent = (content: any) => {
    if (!title) setTitle(`RPM ${mataPelajaran} - ${modulTopik}`);
    if (content.identitas) {
      if (Array.isArray(content.identitas.trisulaKompetensi) && content.identitas.trisulaKompetensi.length > 0) {
        setTrisulaTags(content.identitas.trisulaKompetensi);
      }
      if (content.identitas.deskripsiTrisula) {
        setDeskripsiTrisula({
          literasi: content.identitas.deskripsiTrisula.literasi || "",
          numerasi: content.identitas.deskripsiTrisula.numerasi || "",
          diniyyah: content.identitas.deskripsiTrisula.diniyyah || "",
        });
      }
      if (Array.isArray(content.identitas.karakterFitrah) && content.identitas.karakterFitrah.length > 0) {
        setKarakterTags(content.identitas.karakterFitrah);
      }
      if (Array.isArray(content.identitas.budayaSahabat) && content.identitas.budayaSahabat.length > 0) {
        setBudayaSahabatTags(content.identitas.budayaSahabat);
      }
      if (Array.isArray(content.identitas.dplUtsman) && content.identitas.dplUtsman.length > 0) {
        setDplUtsmanTags(content.identitas.dplUtsman);
      }
      if (Array.isArray(content.identitas.dplKurnas) && content.identitas.dplKurnas.length > 0) {
        setDplKurnasTags(content.identitas.dplKurnas);
      }
    }
    if (content.desainPembelajaran) {
      setCapaianPembelajaran(content.desainPembelajaran.capaianPembelajaran || "");
      if (content.desainPembelajaran.pemahamanBermakna) {
        setPemahamanBermakna(content.desainPembelajaran.pemahamanBermakna);
      }
      setTujuanPembelajaran(content.desainPembelajaran.tujuanPembelajaran || [""]);
      setKegiatanAwal((content.desainPembelajaran.kegiatanPembelajaran?.awal || []).map(normalizeActivityItem));
      setKegiatanInti((content.desainPembelajaran.kegiatanPembelajaran?.inti || []).map(normalizeActivityItem));
      setKegiatanAkhir((content.desainPembelajaran.kegiatanPembelajaran?.akhir || []).map(normalizeActivityItem));
      setAsesmenAwal(content.desainPembelajaran.asesmen?.awal || "");
      setAsesmenFormatif(content.desainPembelajaran.asesmen?.formatif || "");
      setAsesmenSumatif(content.desainPembelajaran.asesmen?.sumatif || "");
      if (content.desainPembelajaran.asesmen?.pesanEdukasiOrangTua) {
        setPesanEdukasiOrangTua(content.desainPembelajaran.asesmen.pesanEdukasiOrangTua);
      }
    }
  };

  const handleSaveRPM = async (createNewDraftVersion = false) => {
    if (!title.trim() || !modulTopik.trim()) {
      toast.error("Judul dokumen dan topik/modul wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildRPMPayload();

      let docId = createNewDraftVersion ? undefined : (autoSaveDraftIdRef.current || activeDoc?.id);
      let res;

      if (docId) {
        res = await fetch(`/api/v1/documents/${docId}`, {
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

  if (view === 'PRINT' && activeDoc) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 print:p-0">
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <Button variant="secondary" onClick={() => setView('LIST')} className="min-h-[44px]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Daftar
          </Button>
          <Button onClick={() => window.print()} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
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

              {/* Integrasi Tag & Karakter - Dipisah Per Kategori dengan Label Jelas */}
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
                        <span className="text-gray-400 italic text-[11px]">-</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-purple-900 block mb-0.5">Fokus Budaya SAHABAT:</span>
                    <div className="flex flex-wrap gap-1">
                      {(activeDoc.content?.identitas?.budayaSahabat && activeDoc.content.identitas.budayaSahabat.length > 0) ? (
                        activeDoc.content.identitas.budayaSahabat.map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[11px]">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">-</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-amber-900 block mb-0.5">Dimensi Profil Lulusan UTSMAN:</span>
                    <div className="flex flex-wrap gap-1">
                      {(activeDoc.content?.identitas?.dplUtsman && activeDoc.content.identitas.dplUtsman.length > 0) ? (
                        activeDoc.content.identitas.dplUtsman.map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px]">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">-</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-indigo-900 block mb-0.5">Profil Lulusan Kurikulum Nasional:</span>
                    <div className="flex flex-wrap gap-1">
                      {(activeDoc.content?.identitas?.dplKurnas && activeDoc.content.identitas.dplKurnas.length > 0) ? (
                        activeDoc.content.identitas.dplKurnas.map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded text-[11px]">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">-</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Blok Rincian Kegiatan Trisula Kompetensi (Ikon + Judul + Paragraf 3 Pilar) */}
              <div className="border p-4 rounded-xl bg-white space-y-3 text-xs shadow-xs">
                <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wide border-b pb-1 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" /> Rincian Kegiatan Trisula Kompetensi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs border-b border-blue-200 pb-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Kegiatan Literasi
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-950">
                      {activeDoc.content?.identitas?.deskripsiTrisula?.literasi || "Membaca dan memahami teks serta informasi kontekstual materi."}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs border-b border-emerald-200 pb-1">
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" /> Kegiatan Numerasi
                    </div>
                    <p className="text-[11px] leading-relaxed text-emerald-950">
                      {activeDoc.content?.identitas?.deskripsiTrisula?.numerasi || "Mengolah angka, data, dan logika pemecahan masalah secara terstruktur."}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs border-b border-amber-200 pb-1">
                      <HeartHandshake className="w-3.5 h-3.5 text-amber-600" /> Diniyyah & Adab
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-950">
                      {activeDoc.content?.identitas?.deskripsiTrisula?.diniyyah || "Menanamkan nilai-nilai keimanan, adab Islamiah, dan keteladanan akhlak."}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Page break untuk cetak / PDF */}
            <div className="hidden print:block print:break-before-page" />

            {/* HALAMAN 2: Skenario Kegiatan Pembelajaran dengan Anotasi Tag */}
            <div className="print:min-h-[850px] space-y-4 pt-4 print:pt-0">
              <h3 className="font-bold text-sm text-gray-700 uppercase border-b pb-1">Halaman 2 — Skenario Kegiatan Pembelajaran</h3>
              <div className="space-y-3 text-xs">

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

  if (view === 'WIZARD') {
    return (
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        {/* Indikator auto-save */}
        <div className="flex justify-between items-center border-b pb-4">
          <Button variant="ghost" onClick={() => setView('LIST')} className="min-h-[44px]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Batal
          </Button>
          <div className="flex items-center gap-3">
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...
              </span>
            )}
            {autoSaveStatus === 'saved' && autoSaveLastTime && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                <CheckCircle className="w-3 h-3" /> Tersimpan otomatis
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                <WifiOff className="w-3 h-3" /> Belum tersimpan — periksa koneksi
              </span>
            )}
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={`px-2.5 py-1 rounded-full ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                1. Topik & Kelas
              </span>
              <span>&rarr;</span>
              <span className={`px-2.5 py-1 rounded-full ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                2. Tinjau & Edit
              </span>
              <span>&rarr;</span>
              <span className={`px-2.5 py-1 rounded-full ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                3. Simpan & Siap
              </span>
            </div>
          </div>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader title="Langkah 1: Tentukan Topik & Alokasi Waktu" subtitle="Auto-Save Aktif" />
            <div className="space-y-4 p-5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Judul Dokumen RPM</label>
                <Input
                  placeholder="Contoh: RPM Matematika - Perkalian Dasar Kelas 5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Mata Pelajaran (Master Data)</label>
                  {masterSubjects.length > 0 ? (
                    <select
                      value={mataPelajaran}
                      onChange={(e) => setMataPelajaran(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-sm border rounded-xl bg-white"
                    >
                      {masterSubjects.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} className="min-h-[44px]" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Kelas / Rombel (Master Data)</label>
                  {masterClasses.length > 0 ? (
                    <select
                      value={kelasRombel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setKelasRombel(val);
                        setTingkatFase(resolvePhaseByClassName(val));
                      }}
                      className="w-full min-h-[44px] px-3 py-2 text-sm border rounded-xl bg-white"
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
                      className="min-h-[44px]"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Tutor Pengampu / Guru</label>
                  {masterTeachers.length > 0 ? (
                    <select
                      value={namaTutorPengampu}
                      onChange={(e) => setNamaTutorPengampu(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-sm border rounded-xl bg-white"
                    >
                      <option value="">Pilih Tutor Pengampu...</option>
                      {masterTeachers.map((t) => (
                        <option key={t.id} value={t.full_name}>{t.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input placeholder="Nama Tutor Pengampu" value={namaTutorPengampu} onChange={(e) => setNamaTutorPengampu(e.target.value)} className="min-h-[44px]" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700">Alokasi Waktu (Menit)</label>
                  <Input
                    type="number"
                    value={alokasiWaktu}
                    onChange={(e) => setAlokasiWaktu(Number(e.target.value))}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Topik / Modul Pembelajaran</label>
                <Textarea
                  placeholder="Deskripsikan topik yang ingin diajarkan..."
                  value={modulTopik}
                  onChange={(e) => setModulTopik(e.target.value)}
                  rows={3}
                />
              </div>

              <AIUsageStatus />
            </div>
            <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between border-t pt-4">
              <Button
                variant="secondary"
                onClick={() => handleGenerateAI()}
                disabled={aiLoading}
                className="w-full sm:w-auto min-h-[44px] border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Bantu Buat dengan AI (Gemini)
              </Button>
              {aiError && !aiLoading && lastAiPayload && (
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateAI(lastAiPayload)}
                  className="w-full sm:w-auto min-h-[44px] border-amber-500 text-amber-700 hover:bg-amber-50 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Coba Lagi
                  <span className="ml-1 text-[10px] opacity-70">({aiError.slice(0, 30)}...)</span>
                </Button>
              )}
              <Button onClick={() => setStep(2)} className="w-full sm:w-auto min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
                Isi Manual & Lanjut &rarr;
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <CardHeader title="Langkah 2: Tinjau & Edit Desain & Integrasi Tag Pembelajaran" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setBankModalOpen(true)}
                className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1" /> Sisip dari Bank TP / CP
              </Button>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Capaian Pembelajaran (CP)</label>
                <Textarea
                  value={capaianPembelajaran}
                  onChange={(e) => setCapaianPembelajaran(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Tujuan Pembelajaran (TP)</label>
                <div className="space-y-2">
                  {tujuanPembelajaran.map((tp, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={tp}
                        onChange={(e) => {
                          const updated = [...tujuanPembelajaran];
                          updated[idx] = e.target.value;
                          setTujuanPembelajaran(updated);
                        }}
                        placeholder={`Tujuan Pembelajaran butir ${idx + 1}...`}
                        className="text-xs min-h-[38px]"
                      />
                      {tujuanPembelajaran.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTujuanPembelajaran(tujuanPembelajaran.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setTujuanPembelajaran([...tujuanPembelajaran, ""])}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Butir TP
                  </Button>
                </div>
              </div>


              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Pemahaman Bermakna (Deep Insight)</label>
                <Textarea
                  placeholder="Manfaat praktikal & hikmah konsep yang dipelajari siswa..."
                  value={pemahamanBermakna}
                  onChange={(e) => setPemahamanBermakna(e.target.value)}
                  rows={2}
                />
              </div>


              {/* Tag / Checkbox Rekomendasi 5 Kategori Baku */}
              <div className="p-4 border rounded-xl bg-emerald-50/30 space-y-3">
                <label className="block text-xs font-bold text-emerald-900 uppercase">Integrasi Rekomendasi Tag AI (5 Kategori Baku)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-700 block mb-1">Trisula Kompetensi:</span>
                    <div className="flex flex-wrap gap-2">
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
                    <span className="font-semibold text-gray-700 block mb-1">Karakter FITRAH:</span>
                    <div className="flex flex-wrap gap-2">
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
                    <span className="font-semibold text-gray-700 block mb-1">Budaya SAHABAT:</span>
                    <div className="flex flex-wrap gap-2">
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
                    <span className="font-semibold text-gray-700 block mb-1">DPL UTSMAN:</span>
                    <div className="flex flex-wrap gap-2">
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

                  <div className="sm:col-span-2">
                    <span className="font-semibold text-gray-700 block mb-1">Profil Lulusan Kurikulum Nasional (dplKurnas):</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Keimanan dan Ketakwaan kepada Tuhan YME",
                        "Kewargaan",
                        "Penalaran Kritis",
                        "Kreativitas",
                        "Kolaborasi",
                        "Kemandirian",
                        "Kesehatan",
                        "Komunikasi",
                      ].map((tag) => (
                        <label key={tag} className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border text-xs">
                          <input
                            type="checkbox"
                            checked={dplKurnasTags.includes(tag)}
                            onChange={(e) => {
                              if (e.target.checked) setDplKurnasTags([...dplKurnasTags, tag]);
                              else setDplKurnasTags(dplKurnasTags.filter((t) => t !== tag));
                            }}
                          />
                          {tag}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rincian Paragraf Trisula Kompetensi (1 Paragraf Per Pilar) */}
              <div className="p-4 border rounded-xl bg-slate-50 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase">Rincian Paragraf Trisula Kompetensi (1 Paragraf Per Pilar)</label>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Kegiatan Literasi:</span>
                    </span>
                    <Textarea
                      value={deskripsiTrisula.literasi}
                      onChange={(e) => setDeskripsiTrisula({ ...deskripsiTrisula, literasi: e.target.value })}
                      rows={3}
                      placeholder="Paragraf penjelasan kegiatan literasi terintegrasi topik..."
                    />
                  </div>
                  <div>
                    <span className="font-semibold text-emerald-900 mb-1 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kegiatan Numerasi:</span>
                    </span>
                    <Textarea
                      value={deskripsiTrisula.numerasi}
                      onChange={(e) => setDeskripsiTrisula({ ...deskripsiTrisula, numerasi: e.target.value })}
                      rows={3}
                      placeholder="Paragraf penjelasan kegiatan numerasi terintegrasi topik..."
                    />
                  </div>
                  <div>
                    <span className="font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                      <span>Diniyyah & Adab:</span>
                    </span>
                    <Textarea
                      value={deskripsiTrisula.diniyyah}
                      onChange={(e) => setDeskripsiTrisula({ ...deskripsiTrisula, diniyyah: e.target.value })}
                      rows={3}
                      placeholder="Paragraf penjelasan kegiatan diniyyah & adab terintegrasi topik..."
                    />
                  </div>
                </div>
              </div>

              {/* Activity Editors with Tag Selection Per Item */}
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

              {/* Rencana Asesmen Spesifik Topik */}
              <div className="p-4 border rounded-xl bg-gray-50/50 space-y-3 text-xs">
                <label className="block text-xs font-bold text-gray-800 uppercase">Rencana Evaluasi & Asesmen Spesifik Topik</label>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700">Asesmen Awal (Diagnostik)</label>
                  <Textarea value={asesmenAwal} onChange={(e) => setAsesmenAwal(e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700">Asesmen Proses (Formatif - Rubrik Karakter Fitrah)</label>
                  <Textarea value={asesmenFormatif} onChange={(e) => setAsesmenFormatif(e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-700">Asesmen Akhir (Sumatif Karya)</label>
                  <Textarea value={asesmenSumatif} onChange={(e) => setAsesmenSumatif(e.target.value)} rows={2} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Pesan Edukasi Orang Tua (Madrasatul Ula)</label>
                <Textarea
                  placeholder="Catatan/panduan pembiasaan harian siswa untuk orang tua di rumah..."
                  value={pesanEdukasiOrangTua}
                  onChange={(e) => setPesanEdukasiOrangTua(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Indikator durasi real-time BR-RPM-03 */}
              {totalDurasi !== null && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
                  durasiSesuai
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  Total {totalDurasi} Menit / Target {alokasiWaktu} Menit
                  {durasiSesuai ? ' ✓' : ` — ${totalDurasi > alokasiWaktu ? 'lebih' : 'kurang'} ${Math.abs(totalDurasi - alokasiWaktu)} menit`}
                </div>
              )}
            </div>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="secondary" onClick={() => setStep(1)} className="min-h-[44px]">
                &larr; Kembali
              </Button>
              <Button onClick={() => setStep(3)} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
                Lanjut ke Simpan &rarr;
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader title="Langkah 3: Simpan — RPM Langsung Siap Dipakai" subtitle="Tidak perlu menunggu persetujuan apapun" />
            <div className="space-y-4 p-5">
              <div className="p-4 border rounded-xl bg-emerald-50/50 text-xs space-y-2">
                <p className="font-bold text-emerald-900">Ringkasan Rencana Pemelajaran:</p>
                <p><span className="font-semibold">Judul:</span> {title}</p>
                <p><span className="font-semibold">Mapel & Topik:</span> {mataPelajaran} - {modulTopik}</p>
                <p><span className="font-semibold">Durasi Target:</span> {alokasiWaktu} Menit</p>
                <p><span className="font-semibold">Tag Terpilih:</span> Trisula ({trisulaTags.length}), Fitrah ({karakterTags.length}), Budaya ({budayaSahabatTags.length}), DPL Utsman ({dplUtsmanTags.length}), Kurnas ({dplKurnasTags.length})</p>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-xl bg-blue-50/50 border-blue-200 text-xs text-blue-800">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <p className="font-semibold">RPM langsung berstatus "Siap Dipakai" setelah disimpan.</p>
                  <p className="mt-0.5 text-blue-600">Tanda tangan kepala sekolah adalah opsional dan bisa dilakukan kapan saja tanpa menghalangi pemakaian RPM.</p>
                </div>
              </div>
            </div>
            <CardFooter className="flex flex-col sm:flex-row gap-3 justify-end border-t pt-4">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={submitting} className="w-full sm:w-auto min-h-[44px]">
                &larr; Kembali Edit
              </Button>
              <Button
                onClick={() => handleSaveRPM()}
                disabled={submitting}
                className="w-full sm:w-auto min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {UX_COPY.rpm.actions.saveReady}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Modal Overwrite / Save Draft Baru */}
        {showOverwriteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Tentukan Pilihan Regenerate AI</h3>
              <p className="text-xs text-gray-600">
                Anda sudah memiliki isian draf sebelumnya. Pilih salah satu:
              </p>
              <div className="space-y-2">
                <Button
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-sm"
                  onClick={() => {
                    applyAiContent(pendingAiContent);
                    setShowOverwriteModal(false);
                    setPendingAiContent(null);
                    setStep(2);
                  }}
                >
                  Timpa yang Lama
                  <span className="block text-[10px] font-normal opacity-80">Ganti isi dokumen ini dengan hasil AI baru</span>
                </Button>
                <Button
                  variant="secondary"
                  className="w-full min-h-[44px] border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm"
                  onClick={async () => {
                    setShowOverwriteModal(false);
                    applyAiContent(pendingAiContent);
                    setPendingAiContent(null);
                    await handleSaveRPM(true);
                    toast.success("Draf AI baru berhasil dibuat. Draf lama tetap tersimpan di daftar.");
                  }}
                >
                  Simpan Draf Baru
                  <span className="block text-[10px] font-normal opacity-80">Draf lama tetap ada, buat dokumen AI baru terpisah</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full min-h-[44px] text-gray-500 text-xs"
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
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Modal konfirmasi hapus */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">{UX_COPY.rpm.messages.deleteConfirm}</h3>
            <p className="text-xs text-gray-600">Dokumen yang dihapus tidak dapat dikembalikan.</p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-700"
                onClick={() => handleDeleteRPM(confirmDeleteId)}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rencana Pemelajaran (RPM)</h1>
          <p className="text-xs text-gray-500">
            Susun rencana pemelajaran mandiri atau dibantu AI (Gemini). RPM langsung siap dipakai setelah disimpan.
          </p>
        </div>
        <Button onClick={handleCreateNew} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Buat RPM Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="text-center p-8">
          <div className="space-y-3 pt-6 p-5">
            <Sparkles className="w-12 h-12 mx-auto text-emerald-500" />
            <h3 className="font-semibold text-sm">Belum Ada Dokumen RPM</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Buat dokumen Rencana Pemelajaran (RPM) pertama Anda dengan bantuan AI atau pengisian manual terstruktur.
            </p>
            <Button onClick={handleCreateNew} className="min-h-[44px] mt-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Buat RPM Pertama
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isOwner = user && doc.author_id === user.id;
            const canDelete = isOwner || isAdmin;
            const canShare = isOwner;

            return (
              <Card key={doc.id} className="flex flex-col justify-between">
                <div className="p-5">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">
                        {UX_COPY.rpm.status.ready}
                      </span>
                      {doc.blc_shared_at && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-purple-100 text-purple-800 border-purple-200">
                          BLC
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      v{doc.version}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold line-clamp-2">{doc.title}</h3>
                  <div className="text-xs text-gray-600 space-y-1 mt-3">
                    <p><span className="font-semibold">Topik:</span> {doc.content?.identitas?.modulTopik || "-"}</p>
                    <p><span className="font-semibold">Durasi:</span> {doc.content?.identitas?.alokasiWaktu || 0} Menit</p>
                    <p><span className="font-semibold">Penyusun:</span> {doc.author_name || "-"}</p>
                  </div>
                </div>
                <CardFooter className="border-t pt-3 flex flex-wrap gap-2 justify-between">
                  <Button variant="secondary" size="sm" onClick={() => handleOpenPrint(doc)} className="min-h-[36px] text-xs" id={`btn-print-${doc.id}`}>
                    <Printer className="w-3.5 h-3.5 mr-1" /> Lihat / Cetak
                  </Button>
                  <div className="flex gap-1.5">
                    {canShare && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className={`min-h-[36px] text-xs ${doc.blc_shared_at ? 'border-purple-400 text-purple-700 hover:bg-purple-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        onClick={() => handleToggleBLC(doc)}
                        disabled={sharingId === doc.id}
                        title={doc.blc_shared_at ? UX_COPY.rpm.actions.unshareToBLC : UX_COPY.rpm.actions.shareToBLC}
                        id={`btn-blc-${doc.id}`}
                      >
                        {sharingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-[36px] text-xs"
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
                        id={`btn-edit-${doc.id}`}
                      >
                        <PenSquare className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-[36px] text-xs border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(doc.id)}
                        id={`btn-delete-${doc.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Sisip TP & CP dari Bank */}
      <CurriculumBankModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        initialClassName={kelasRombel}
        initialSubjectName={mataPelajaran}
        initialFase={tingkatFase}
        onSelectTP={(selected) => {
          if (selected.cpTeks && !capaianPembelajaran) {
            setCapaianPembelajaran(selected.cpTeks);
          }
          if (tujuanPembelajaran.length === 1 && !tujuanPembelajaran[0]) {
            setTujuanPembelajaran([selected.teks]);
          } else {
            setTujuanPembelajaran([...tujuanPembelajaran, selected.teks]);
          }
          toast.success("TP berhasil disisipkan dari Bank.");
        }}
      />
    </div>
  );
}

