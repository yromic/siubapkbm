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
import { PrintSectionHeader } from "@/components/print/PrintSectionHeader";
import { PrintBrowserHint } from "@/components/print/PrintBrowserHint";
import { PageContainer, PageSection } from "@/components/ui/page-framework";
import { AIUsageStatus, getAIErrorMessageByReason } from "@/components/ai/AIUsageStatus";
import {
  Loader2, Plus, Sparkles, ArrowLeft, Printer, CheckCircle,
  WifiOff, Clock, RefreshCw, Trash2, Share2, ShieldCheck, PenSquare,
  BookOpen, Calculator, HeartHandshake, Database, Layers, FileText,
  Search, X, School, Users, CheckCircle2, ChevronRight, Bookmark, Tag,
  Paperclip, Eye
} from "lucide-react";
import { toast } from "sonner";
import {
  RPMActivityItem,
  RPMActivityInput,
  RPMRubrikItem,
  RPMKegiatanMetadata,
  RPMAwalMetadata,
  RPMIntiMetadata,
  RPMAkhirMetadata,
  normalizeActivityItem,
  formatActivityItemWithTags,
  computeStructuredDuration,
  computeLegacyDurationFromActivities,
  VALID_KURNAS,
} from "@/lib/utils/rpmUtils";
import { resolvePhaseByClassName, resolveAcademicPeriodDisplay, isUuid } from "@/lib/utils/academicUtils";
import { CurriculumBankModal, SelectedTPPayload } from "@/components/curriculum/CurriculumBankModal";
import { RPMAttachmentSection } from "@/components/rpm/RPMAttachmentSection";
import { RPMAttachmentPreviewNotice } from "@/components/rpm/RPMAttachmentPreviewNotice";
import { RPMAttachment } from "@/types/rpmAttachment";
import { fetchRpmAttachments } from "@/lib/api/rpmAttachments";
import {
  AttachmentLoadStatus,
  shouldConfirmAttachmentPrint,
  getAttachmentPrintDecision,
} from "@/lib/utils/attachmentPreview";
import type { AttachmentRenderSummary } from "@/lib/utils/rpmAttachmentRendering";

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
  semester_id?: string | null;
  semester_name?: string | null;
  signer_name?: string;
  signer_nip?: string | null;
  signer_nuptk?: string | null;
  signed_at?: string | null;
  blc_shared_at?: string | null;
  attachment_count?: number;
  created_at?: string;
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
      semesterId?: string;
      semesterTahun?: string;
      tahunAjaran?: string;
      letterhead?: {
        id: string;
        url: string;
        name: string;
        snapped_at?: string;
      };
    };
    desainPembelajaran: {
      capaianPembelajaran: string;
      pemahamanBermakna?: string;
      tujuanPembelajaran: string[];
      pertanyaanPemantik?: string[];
      mediaAjar?: string[];
      sumberBelajar?: string[];
      kegiatanPembelajaran: {
        awal: RPMActivityInput[];
        inti: RPMActivityInput[];
        akhir: RPMActivityInput[];
        metadata?: RPMKegiatanMetadata;
      };
      asesmen: {
        awal: string;
        formatif: string;
        sumatif: string;
        pesanEdukasiOrangTua?: string;
        rubrikKarakterFitrah?: RPMRubrikItem[];
      };
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
  const [returnView, setReturnView] = useState<'LIST' | 'WIZARD'>('LIST');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeDoc, setActiveDoc] = useState<RPMItem | null>(null);
  const [activeDocAttachments, setActiveDocAttachments] = useState<RPMAttachment[]>([]);
  const [attachmentLoadStatus, setAttachmentLoadStatus] = useState<AttachmentLoadStatus>('idle');
  const [attachmentRenderSummary, setAttachmentRenderSummary] = useState<AttachmentRenderSummary>({
    status: 'ready',
    embeddableCount: 0,
    readyCount: 0,
    loadingCount: 0,
    errorCount: 0,
  });
  const attachmentRequestIdRef = useRef(0);
  const [schoolSettings, setSchoolSettings] = useState<any>({});

  const loadRpmAttachments = useCallback(async (documentId: string): Promise<boolean> => {
    const requestId = ++attachmentRequestIdRef.current;
    setAttachmentLoadStatus('loading');
    try {
      const attachments = await fetchRpmAttachments(documentId);
      if (requestId === attachmentRequestIdRef.current) {
        setActiveDocAttachments(attachments);
        setAttachmentLoadStatus('success');
      }
      return true;
    } catch (error) {
      if (requestId === attachmentRequestIdRef.current) {
        setAttachmentLoadStatus('error');
      }
      console.error("RPM attachment fetch failed", {
        module: "RPM",
        documentId,
        operation: "fetch attachments",
        error,
      });
      return false;
    }
  }, []);

  const handlePrint = useCallback(() => {
    if (
      shouldConfirmAttachmentPrint(attachmentLoadStatus) &&
      !window.confirm("Daftar lampiran gagal dimuat. Cetak dokumen tanpa memastikan lampiran termuat?")
    ) {
      return;
    }

    const decision = getAttachmentPrintDecision(attachmentRenderSummary.status);
    if (decision === "wait") {
      toast.info("Lampiran masih dimuat. Harap tunggu hingga semua berkas selesai dimuat.");
      return;
    }
    if (
      decision === "confirm" &&
      !window.confirm("1 atau lebih lampiran gagal dimuat dan tidak akan muncul lengkap pada hasil cetak. Lanjutkan cetak dokumen?")
    ) {
      return;
    }

    window.print();
  }, [attachmentLoadStatus, attachmentRenderSummary.status]);

  const jumpToAttachments = useCallback(() => {
    document.getElementById('rpm-lampiran')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  // ── Semester / TA master data ──────────────────────────────────────────────
  const [masterSemesters, setMasterSemesters] = useState<Array<{
    id: string;
    name: string;
    academic_year_id: string;
    academic_year_name?: string;
    is_active: number | boolean;
  }>>([]);
  const [masterAcademicYears, setMasterAcademicYears] = useState<Array<{ id: string; name: string }>>([]);
  const [semesterId, setSemesterId] = useState<string>("");
  const [semesterNama, setSemesterNama] = useState<string>("");
  const [tahunAjaran, setTahunAjaran] = useState<string>("");

  // ── New design fields ──────────────────────────────────────────────────────
  const [pertanyaanPemantik, setPertanyaanPemantik] = useState<string[]>([]);
  const [mediaAjar, setMediaAjar] = useState<string[]>([]);
  const [sumberBelajar, setSumberBelajar] = useState<string[]>([]);
  const [rubrikKarakterFitrah, setRubrikKarakterFitrah] = useState<RPMRubrikItem[]>([]);

  // ── Activity metadata (structured duration + focus fields) ─────────────────
  const [kegiatanMetadataAwal, setKegiatanMetadataAwal] = useState<RPMAwalMetadata>({ fokus: "", durasiMenit: 10, fokusAdab: "" });
  const [kegiatanMetadataInti, setKegiatanMetadataInti] = useState<RPMIntiMetadata>({ fokus: "", durasiMenit: 50, pendekatanMetode: "" });
  const [kegiatanMetadataAkhir, setKegiatanMetadataAkhir] = useState<RPMAkhirMetadata>({ fokus: "", durasiMenit: 10, fokusRefleksi: "" });

  // Master Data Options
  const [masterSubjects, setMasterSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [masterClasses, setMasterClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [masterTeachers, setMasterTeachers] = useState<Array<{ id: string; full_name: string }>>([]);

  useEffect(() => {
    // Load Master Data including semesters and academic years
    const loadMasterData = async () => {
      try {
        const [subjRes, classRes, usersRes, semRes, ayRes, settingsRes] = await Promise.all([
          fetch("/api/v1/subjects"),
          fetch("/api/v1/classes"),
          fetch("/api/v1/users?role=teacher&limit=100"),
          fetch("/api/v1/semesters?limit=50"),
          fetch("/api/v1/academic-years?limit=50"),
          fetch("/api/v1/app-settings"),
        ]);
        const subjJson = await subjRes.json();
        const classJson = await classRes.json();
        const usersJson = await usersRes.json();
        const semJson = await semRes.json();
        const ayJson = await ayRes.json();
        const settingsJson = await settingsRes.json();
        if (settingsJson.success) setSchoolSettings(settingsJson.data || {});

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

        const semestersData = Array.isArray(semJson.data?.data)
          ? semJson.data.data
          : Array.isArray(semJson.data?.items)
          ? semJson.data.items
          : Array.isArray(semJson.data)
          ? semJson.data
          : [];

        const academicYearsData = Array.isArray(ayJson.data?.data)
          ? ayJson.data.data
          : Array.isArray(ayJson.data?.items)
          ? ayJson.data.items
          : Array.isArray(ayJson.data)
          ? ayJson.data
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
        if (ayJson.success && academicYearsData.length > 0) {
          setMasterAcademicYears(academicYearsData);
        }
        if (semJson.success && semestersData.length > 0) {
          setMasterSemesters(semestersData);
          // Auto-select active semester
          const activeSem = semestersData.find((s: any) => s.is_active === 1 || s.is_active === true);
          const selectedSem = activeSem || semestersData[0];
          if (selectedSem) {
            setSemesterId(selectedSem.id);
            const period = resolveAcademicPeriodDisplay(
              { semesterId: selectedSem.id },
              { semesters: semestersData, academicYears: academicYearsData }
            );
            setSemesterNama(period.semesterName || selectedSem.name || "");
            setTahunAjaran(period.academicYearLabel !== "-" ? period.academicYearLabel : (selectedSem.academic_year_name || ""));
          }
        }
      } catch (err) {
        console.error("Gagal memuat master data RPM:", err);
      }
    };
    loadMasterData();
  }, []);

  // Auto-reconcile legacy UUIDs or missing labels when master data becomes available
  useEffect(() => {
    if (masterSemesters.length > 0 && (isUuid(tahunAjaran) || isUuid(semesterNama) || (semesterId && (!tahunAjaran || !semesterNama)))) {
      const period = resolveAcademicPeriodDisplay(
        { semesterId, semesterName: semesterNama, tahunAjaran },
        { semesters: masterSemesters, academicYears: masterAcademicYears }
      );
      if (period.semesterId && !semesterId) setSemesterId(period.semesterId);
      if (period.semesterName && (!semesterNama || isUuid(semesterNama))) setSemesterNama(period.semesterName);
      if (period.academicYearLabel !== "-" && (!tahunAjaran || isUuid(tahunAjaran))) setTahunAjaran(period.academicYearLabel);
    }
  }, [masterSemesters, masterAcademicYears, semesterId, semesterNama, tahunAjaran]);

  // Duration check — Structured metadata (primary) with legacy text-regex fallback
  const totalDurasi = useMemo(() => {
    // Try structured metadata first
    const structured = computeStructuredDuration({
      awal: kegiatanMetadataAwal,
      inti: kegiatanMetadataInti,
      akhir: kegiatanMetadataAkhir,
    });
    if (structured !== null && structured > 0) return structured;
    // Legacy fallback: parse durations from activity text strings
    return computeLegacyDurationFromActivities(kegiatanAwal, kegiatanInti, kegiatanAkhir);
  }, [kegiatanAwal, kegiatanInti, kegiatanAkhir, kegiatanMetadataAwal, kegiatanMetadataInti, kegiatanMetadataAkhir]);

  const durasiSesuai = totalDurasi === alokasiWaktu;
  const durasiAwal = kegiatanMetadataAwal.durasiMenit || 0;
  const durasiInti = kegiatanMetadataInti.durasiMenit || 0;
  const durasiAkhir = kegiatanMetadataAkhir.durasiMenit || 0;

  // Reconcile rubrikKarakterFitrah with karakterTags: preserve existing, add new for selected, remove unselected
  useEffect(() => {
    if (karakterTags.length === 0) return;
    setRubrikKarakterFitrah((prev) => {
      const existingMap = new Map(prev.map((r) => [r.indikator, r]));
      return karakterTags.map((k) => {
        if (existingMap.has(k)) return existingMap.get(k)!;
        return {
          indikator: k,
          sangatBaik: `Santri secara konsisten menunjukkan sikap ${k.toLowerCase()} yang nyata dalam setiap kegiatan pembelajaran.`,
          perluBimbingan: `Santri belum konsisten menunjukkan sikap ${k.toLowerCase()} dan masih memerlukan bimbingan.`,
        };
      });
    });
  }, [karakterTags]);

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
  const buildPayload = useCallback(() => {
    const period = resolveAcademicPeriodDisplay(
      { semesterId, semesterName: semesterNama, tahunAjaran },
      { semesters: masterSemesters, academicYears: masterAcademicYears }
    );
    const cleanSemName = period.semesterName || (isUuid(semesterNama) ? "" : semesterNama.replace(/^Semester\s*/i, "").trim());
    const cleanSemLabel = period.semesterLabel !== "-" ? period.semesterLabel : (cleanSemName ? `Semester ${cleanSemName}` : "");
    const cleanAyLabel = period.academicYearLabel !== "-" ? period.academicYearLabel : (isUuid(tahunAjaran) ? "" : tahunAjaran);

    const selectedClass = masterClasses.find((c) => c.name === kelasRombel);
    const selectedSubj = masterSubjects.find((s) => s.name === mataPelajaran);

    return {
      type: "RPM" as const,
      title: title.trim() || `RPM ${mataPelajaran} - ${modulTopik || "Topik Baru"}`,
      class_id: selectedClass?.id || null,
      subject_id: selectedSubj?.id || null,
      semester_id: semesterId || null,
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
          // Authoritative semester/TA snapshot — sourced from master data (human-readable)
          semesterId: semesterId || undefined,
          semesterTahun: cleanSemLabel,
          tahunAjaran: cleanAyLabel,
          // Letterhead snapshot: capture active kop at first save — preserved for historical reprint
          letterhead: activeDoc?.content?.identitas?.letterhead ||
            ((schoolSettings as any)?.active_letterhead_id
              ? {
                  id: (schoolSettings as any).active_letterhead_id,
                  url: (schoolSettings as any).active_letterhead_url || "/branding/school-letterhead.png",
                  name: "Kop Resmi Aktif",
                  snapped_at: new Date().toISOString(),
                }
              : undefined),
        },
        desainPembelajaran: {
          capaianPembelajaran,
          pemahamanBermakna,
          tujuanPembelajaran: tujuanPembelajaran.filter((t) => t.trim().length > 0),
          pertanyaanPemantik: pertanyaanPemantik.filter((p) => p.trim().length > 0),
          mediaAjar: mediaAjar.filter((m) => m.trim().length > 0),
          sumberBelajar: sumberBelajar.filter((s) => s.trim().length > 0),
          kegiatanPembelajaran: {
            awal: kegiatanAwal,
            inti: kegiatanInti,
            akhir: kegiatanAkhir,
            metadata: {
              awal: kegiatanMetadataAwal,
              inti: kegiatanMetadataInti,
              akhir: kegiatanMetadataAkhir,
            },
          },
          asesmen: {
            awal: asesmenAwal,
            formatif: asesmenFormatif,
            sumatif: asesmenSumatif,
            pesanEdukasiOrangTua,
            rubrikKarakterFitrah: rubrikKarakterFitrah.length > 0 ? rubrikKarakterFitrah : undefined,
          },
        },
      },
    };
  }, [
    title, mataPelajaran, kelasRombel, tingkatFase, alokasiWaktu, modulTopik,
    namaTutorPengampu, user?.name, trisulaTags, deskripsiTrisula, karakterTags,
    budayaSahabatTags, dplUtsmanTags, dplKurnasTags, capaianPembelajaran,
    pemahamanBermakna, tujuanPembelajaran, kegiatanAwal, kegiatanInti, kegiatanAkhir,
    asesmenAwal, asesmenFormatif, asesmenSumatif, pesanEdukasiOrangTua,
    semesterId, semesterNama, tahunAjaran,
    pertanyaanPemantik, mediaAjar, sumberBelajar, rubrikKarakterFitrah,
    kegiatanMetadataAwal, kegiatanMetadataInti, kegiatanMetadataAkhir,
    masterSemesters, masterAcademicYears, masterClasses, masterSubjects,
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
    setActiveDocAttachments([]);
    setAttachmentLoadStatus('idle');
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
    setPertanyaanPemantik([]);
    setMediaAjar([]);
    setSumberBelajar([]);
    setRubrikKarakterFitrah([]);
    setKegiatanMetadataAwal({ fokus: "", durasiMenit: 10, fokusAdab: "" });
    setKegiatanMetadataInti({ fokus: "", durasiMenit: 50, pendekatanMetode: "" });
    setKegiatanMetadataAkhir({ fokus: "", durasiMenit: 10, fokusRefleksi: "" });
    setStep(1);
    setView('WIZARD');
  };

  type RPMGenerateTarget =
    | "ALL"
    | "PEMAHAMAN_BERMAKNA"
    | "PERTANYAAN_PEMANTIK"
    | "MEDIA_AJAR"
    | "SUMBER_BELAJAR"
    | "PESAN_ORANG_TUA";

  const [generatingField, setGeneratingField] = useState<RPMGenerateTarget | null>(null);

  const applyAiContent = (aiData: any, overwriteTP = false) => {
    if (!aiData) return;
    const content = aiData.content || aiData;
    const dp = content.desainPembelajaran;
    const id = content.identitas;

    // CP is authoritative — never replace teacher/bank selected CP with AI output
    if (!capaianPembelajaran.trim()) {
      setCapaianPembelajaran(dp?.capaianPembelajaran || "");
    }

    setPemahamanBermakna(dp?.pemahamanBermakna || "");

    // TP is preserved if already populated, unless teacher explicitly confirmed overwrite
    const hasValidExistingTP = tujuanPembelajaran.some((t: string) => t && t.trim().length > 0);
    if (!hasValidExistingTP || overwriteTP) {
      setTujuanPembelajaran(dp?.tujuanPembelajaran || [""]);
    }

    // New fields
    if (Array.isArray(dp?.pertanyaanPemantik)) {
      setPertanyaanPemantik(dp.pertanyaanPemantik);
    }
    if (Array.isArray(dp?.mediaAjar)) {
      setMediaAjar(dp.mediaAjar);
    }
    if (Array.isArray(dp?.sumberBelajar)) {
      setSumberBelajar(dp.sumberBelajar);
    }

    if (id?.trisulaKompetensi) setTrisulaTags(id.trisulaKompetensi);
    if (id?.deskripsiTrisula) {
      setDeskripsiTrisula({
        literasi: id.deskripsiTrisula.literasi || "",
        numerasi: id.deskripsiTrisula.numerasi || "",
        diniyyah: id.deskripsiTrisula.diniyyah || "",
      });
    }
    if (id?.karakterFitrah) setKarakterTags(id.karakterFitrah);
    if (id?.budayaSahabat) setBudayaSahabatTags(id.budayaSahabat);
    if (id?.dplUtsman) setDplUtsmanTags(id.dplUtsman);
    if (id?.dplKurnas) setDplKurnasTags(id.dplKurnas);

    if (dp?.kegiatanPembelajaran) {
      setKegiatanAwal((dp.kegiatanPembelajaran.awal || []).map(normalizeActivityItem));
      setKegiatanInti((dp.kegiatanPembelajaran.inti || []).map(normalizeActivityItem));
      setKegiatanAkhir((dp.kegiatanPembelajaran.akhir || []).map(normalizeActivityItem));
      // Activity metadata
      const meta = dp.kegiatanPembelajaran.metadata;
      if (meta?.awal) setKegiatanMetadataAwal({ fokus: meta.awal.fokus || "", durasiMenit: meta.awal.durasiMenit || 10, fokusAdab: meta.awal.fokusAdab || "" });
      if (meta?.inti) setKegiatanMetadataInti({ fokus: meta.inti.fokus || "", durasiMenit: meta.inti.durasiMenit || 50, pendekatanMetode: meta.inti.pendekatanMetode || "" });
      if (meta?.akhir) setKegiatanMetadataAkhir({ fokus: meta.akhir.fokus || "", durasiMenit: meta.akhir.durasiMenit || 10, fokusRefleksi: meta.akhir.fokusRefleksi || "" });
    }

    if (dp?.asesmen) {
      setAsesmenAwal(dp.asesmen.awal || "Tanya Jawab Diagnostik");
      setAsesmenFormatif(dp.asesmen.formatif || "Observasi Diskusi");
      setAsesmenSumatif(dp.asesmen.sumatif || "Evaluasi Tertulis");
      setPesanEdukasiOrangTua(dp.asesmen.pesanEdukasiOrangTua || "");
      if (Array.isArray(dp.asesmen.rubrikKarakterFitrah)) {
        setRubrikKarakterFitrah(dp.asesmen.rubrikKarakterFitrah);
      }
    }
  };

  const handleGenerateFieldAI = async (target: RPMGenerateTarget) => {
    if (!modulTopik.trim()) {
      toast.error("Silakan isi topik/modul terlebih dahulu di Langkah 1.");
      return;
    }

    let hasExisting = false;
    let fieldLabel = "";
    if (target === "PEMAHAMAN_BERMAKNA") {
      hasExisting = pemahamanBermakna.trim().length > 0;
      fieldLabel = "Pemahaman Bermakna";
    } else if (target === "PERTANYAAN_PEMANTIK") {
      hasExisting = pertanyaanPemantik.filter((p) => p.trim()).length > 0;
      fieldLabel = "Pertanyaan Pemantik";
    } else if (target === "MEDIA_AJAR") {
      hasExisting = mediaAjar.filter((m) => m.trim()).length > 0;
      fieldLabel = "Media Ajar";
    } else if (target === "SUMBER_BELAJAR") {
      hasExisting = sumberBelajar.filter((s) => s.trim()).length > 0;
      fieldLabel = "Sumber Belajar";
    } else if (target === "PESAN_ORANG_TUA") {
      hasExisting = pesanEdukasiOrangTua.trim().length > 0;
      fieldLabel = "Pesan Edukasi Orang Tua";
    }

    if (hasExisting) {
      const confirmOverwrite = window.confirm(
        `${fieldLabel} sudah memiliki isian. Ganti dengan hasil rumusan AI baru?`
      );
      if (!confirmOverwrite) return;
    }

    setGeneratingField(target);

    try {
      const period = resolveAcademicPeriodDisplay(
        { semesterId, semesterName: semesterNama, tahunAjaran },
        { semesters: masterSemesters, academicYears: masterAcademicYears }
      );
      const safeSem = period.semesterName || (isUuid(semesterNama) ? undefined : semesterNama) || undefined;
      const safeAy = (period.academicYearLabel !== "-" ? period.academicYearLabel : (isUuid(tahunAjaran) ? undefined : tahunAjaran)) || undefined;

      const payload = {
        target,
        mataPelajaran,
        kelasRombel,
        tingkatFase,
        alokasiWaktu,
        modulTopik,
        semester: safeSem,
        academicYear: safeAy,
        capaianPembelajaran: capaianPembelajaran.trim() || undefined,
        tujuanPembelajaran: tujuanPembelajaran.filter((t) => t.trim()).length > 0 ? tujuanPembelajaran.filter((t) => t.trim()) : undefined,
        karakterFitrah: karakterTags.length > 0 ? karakterTags : undefined,
      };

      const res = await fetch("/api/v1/rpm/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || `Gagal merumuskan ${fieldLabel}.`);
        return;
      }

      const resData = json.data;
      const isFallback = resData?.source === 'FALLBACK';
      if (isFallback) {
        toast.warning(getAIErrorMessageByReason(resData?.fallbackReason, "Saran lokal digunakan karena AI tidak tersedia."));
      } else {
        toast.success(`${fieldLabel} berhasil dirumuskan oleh AI.`);
      }

      const rawData = resData?.data;
      const content = resData?.content;
      const dp = content?.desainPembelajaran;

      if (target === "PEMAHAMAN_BERMAKNA") {
        const val = typeof rawData === "string" ? rawData : dp?.pemahamanBermakna || "";
        if (val) setPemahamanBermakna(val);
      } else if (target === "PERTANYAAN_PEMANTIK") {
        const list = Array.isArray(rawData) ? rawData : dp?.pertanyaanPemantik || [];
        if (list.length > 0) setPertanyaanPemantik(list);
      } else if (target === "MEDIA_AJAR") {
        const list = Array.isArray(rawData) ? rawData : dp?.mediaAjar || [];
        if (list.length > 0) setMediaAjar(list);
      } else if (target === "SUMBER_BELAJAR") {
        const list = Array.isArray(rawData) ? rawData : dp?.sumberBelajar || [];
        if (list.length > 0) setSumberBelajar(list);
      } else if (target === "PESAN_ORANG_TUA") {
        const val = typeof rawData === "string" ? rawData : dp?.asesmen?.pesanEdukasiOrangTua || "";
        if (val) setPesanEdukasiOrangTua(val);
      }
    } catch {
      toast.error(`Terjadi kendala jaringan saat merumuskan ${fieldLabel}.`);
    } finally {
      setGeneratingField(null);
    }
  };

  const handleGenerateAI = async (customPayload?: any) => {
    if (!modulTopik.trim() && !customPayload?.modulTopik) {
      toast.error("Silakan isi topik/modul terlebih dahulu.");
      return;
    }

    setAiLoading(true);
    setAiError(null);

    const period = resolveAcademicPeriodDisplay(
      { semesterId, semesterName: semesterNama, tahunAjaran },
      { semesters: masterSemesters, academicYears: masterAcademicYears }
    );
    const safeSem = period.semesterName || (isUuid(semesterNama) ? undefined : semesterNama) || undefined;
    const safeAy = (period.academicYearLabel !== "-" ? period.academicYearLabel : (isUuid(tahunAjaran) ? undefined : tahunAjaran)) || undefined;

    const payload = customPayload || {
      mataPelajaran,
      kelasRombel,
      tingkatFase,
      alokasiWaktu,
      modulTopik,
      // Pass authoritative context so AI doesn't override them (human-readable labels only)
      semester: safeSem,
      academicYear: safeAy,
      capaianPembelajaran: capaianPembelajaran.trim() || undefined,
      tujuanPembelajaran: tujuanPembelajaran.filter(t => t.trim()).length > 0 ? tujuanPembelajaran.filter(t => t.trim()) : undefined,
      karakterFitrah: karakterTags.length > 0 ? karakterTags : undefined,
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
        toast.warning(getAIErrorMessageByReason(json.data?.fallbackReason, "Saran lokal digunakan karena AI tidak tersedia."));
      } else {
        toast.success("Rancangan RPM berhasil dirumuskan oleh AI.");
      }

      const hasExistingContent = capaianPembelajaran.trim().length > 0
        || (tujuanPembelajaran.length > 0 && tujuanPembelajaran[0].trim().length > 0)
        || pertanyaanPemantik.length > 0
        || mediaAjar.length > 0;
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

    // Curriculum integrity check: verify subject & phase compatibility before applying
    const mismatchedItem = selectedList.find((s) => {
      const subjMismatch = s.mataPelajaran && s.mataPelajaran.trim().toLowerCase() !== mataPelajaran.trim().toLowerCase();
      const phaseMismatch = s.fase && s.fase.trim().toLowerCase() !== tingkatFase.trim().toLowerCase();
      return subjMismatch || phaseMismatch;
    });

    if (mismatchedItem) {
      toast.warning(
        `TP terpilih berasal dari ${mismatchedItem.mataPelajaran || "Mapel lain"} (${mismatchedItem.fase || "Fase lain"}), berbeda dengan konteks aktif (${mataPelajaran} - ${tingkatFase}). Pastikan keselarasan kurikulum.`
      );
    }

    // Set CP hanya jika capaianPembelajaran saat ini masih kosong DAN mapel/fase sesuai
    const firstWithCP = selectedList.find((s) => s.cpTeks && s.cpTeks.trim().length > 0);
    if (firstWithCP?.cpTeks && !capaianPembelajaran.trim()) {
      const subjectMatches = !firstWithCP.mataPelajaran || firstWithCP.mataPelajaran.trim().toLowerCase() === mataPelajaran.trim().toLowerCase();
      const phaseMatches = !firstWithCP.fase || firstWithCP.fase.trim().toLowerCase() === tingkatFase.trim().toLowerCase();

      if (subjectMatches && phaseMatches) {
        setCapaianPembelajaran(firstWithCP.cpTeks);
      } else {
        toast.warning("CP dari bank tidak diinjeksi otomatis karena berasal dari mata pelajaran/fase yang berbeda.");
      }
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
    if (totalDurasi !== null && totalDurasi !== alokasiWaktu) {
      toast.warning(
        `Perhatian: Total durasi aktivitas (${totalDurasi} menit) berselisih ${Math.abs(totalDurasi - alokasiWaktu)} menit dari alokasi waktu (${alokasiWaktu} menit). Dokumen tetap disimpan.`
      );
    }
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

  const handleSaveDraftAndOpenAttachments = async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Gagal menyimpan draf RPM.");
        return;
      }
      const newDoc = json.data;
      autoSaveDraftIdRef.current = newDoc.id;
      setActiveDoc(newDoc);
      fetchRPMDocuments();
      toast.success("RPM berhasil disimpan. Silakan tambahkan lampiran pendukung.");
    } catch {
      toast.error("Gagal memproses penyimpanan RPM.");
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

  const handleOpenPrint = async (doc: RPMItem) => {
    setActiveDoc(doc);
    setActiveDocAttachments([]);
    setAttachmentLoadStatus('idle');
    setAttachmentRenderSummary({
      status: 'ready',
      embeddableCount: 0,
      readyCount: 0,
      loadingCount: 0,
      errorCount: 0,
    });
    setReturnView('LIST');
    try {
      const [settingsRes] = await Promise.allSettled([
        fetch('/api/v1/app-settings').then((r) => r.json()),
        loadRpmAttachments(doc.id),
      ]);
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.success && settingsRes.value.data) {
        setSchoolSettings(settingsRes.value.data);
      }
    } catch (error) {
      setAttachmentLoadStatus('error');
      console.error("RPM print preview preparation failed", {
        module: "RPM",
        documentId: doc.id,
        operation: "prepare print preview",
        error,
      });
    }
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
    const identitas = activeDoc.content?.identitas;
    const dp = activeDoc.content?.desainPembelajaran;
    const kp = dp?.kegiatanPembelajaran;
    const metaAwal = kp?.metadata?.awal;
    const metaInti = kp?.metadata?.inti;
    const metaAkhir = kp?.metadata?.akhir;
    const asesmen = dp?.asesmen;

    const printPeriod = resolveAcademicPeriodDisplay(
      {
        semesterId: activeDoc.semester_id || identitas?.semesterId,
        semesterName: activeDoc.semester_name,
        semesterTahun: identitas?.semesterTahun,
        tahunAjaran: identitas?.tahunAjaran,
      },
      { semesters: masterSemesters, academicYears: masterAcademicYears }
    );

    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 print:p-0">
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <Button variant="secondary" onClick={() => setView(returnView)} className="min-h-[38px] text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" /> {returnView === 'WIZARD' ? 'Kembali ke Editor' : 'Kembali ke Daftar'}
          </Button>
          <Button onClick={handlePrint} className="min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold">
            <Printer className="w-4 h-4 mr-2" /> Cetak Dokumen
          </Button>
        </div>

        <PrintBrowserHint />

        <RPMAttachmentPreviewNotice
          count={activeDocAttachments.length}
          status={attachmentLoadStatus}
          onJump={jumpToAttachments}
          onRetry={() => void loadRpmAttachments(activeDoc.id)}
        />

        <PrintRenderer
          document={activeDoc}
          attachments={activeDocAttachments}
          onAttachmentReadinessChange={setAttachmentRenderSummary}
          schoolSettings={schoolSettings}
          semesters={masterSemesters}
          academicYears={masterAcademicYears}
        >
          <div className="space-y-4 text-gray-900">
            {/* 1. INTEGRASI PEMBELAJARAN */}
            <div className="space-y-2">
              <PrintSectionHeader
                title="Integrasi Pembelajaran"
                variant="primary"
                icon={<Layers className="w-3.5 h-3.5" />}
              />
              <div className="border border-emerald-100 rounded-lg p-3 bg-emerald-50/20 text-xs space-y-2.5 print:border-gray-300 print:p-2.5 print:bg-transparent print-break-inside-avoid">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="font-bold text-emerald-900 block mb-1 text-[11px] uppercase tracking-wide">
                      Trisula Kompetensi:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(identitas?.trisulaKompetensi && identitas.trisulaKompetensi.length > 0
                        ? identitas.trisulaKompetensi
                        : ["Literasi", "Numerasi", "Diniyyah"]
                      ).map((t: string) => (
                        <span key={t} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-blue-900 block mb-1 text-[11px] uppercase tracking-wide">
                      Karakter FITRAH:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(identitas?.karakterFitrah && identitas.karakterFitrah.length > 0) ? (
                        identitas.karakterFitrah.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-medium">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">-</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-emerald-100/60 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 print:border-gray-200">
                  <div>
                    <span className="font-bold text-purple-900 block mb-1 text-[11px] uppercase tracking-wide">
                      Budaya SAHABAT:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(identitas?.budayaSahabat && identitas.budayaSahabat.length > 0) ? (
                        identitas.budayaSahabat.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[10px] font-medium">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[10px]">-</span>
                      )}
                    </div>
                  </div>

                  {identitas?.dplUtsman && identitas.dplUtsman.length > 0 && (
                    <div>
                      <span className="font-bold text-teal-900 block mb-1 text-[11px] uppercase tracking-wide">
                        DPL Utsman:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {identitas.dplUtsman.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[10px] font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {identitas?.dplKurnas && identitas.dplKurnas.length > 0 && (
                    <div>
                      <span className="font-bold text-indigo-900 block mb-1 text-[11px] uppercase tracking-wide">
                        DPL Kurikulum Nasional:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {identitas.dplKurnas.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded text-[10px] font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. RINCIAN TRISULA KOMPETENSI */}
            {identitas?.deskripsiTrisula &&
              (identitas.deskripsiTrisula.literasi?.trim() ||
               identitas.deskripsiTrisula.numerasi?.trim() ||
               identitas.deskripsiTrisula.diniyyah?.trim()) && (
              <div className="space-y-2">
                <PrintSectionHeader
                  title="Rincian Trisula Kompetensi"
                  variant="secondary"
                  icon={<BookOpen className="w-3.5 h-3.5" />}
                />
                <div className="space-y-2 text-xs">
                  {identitas.deskripsiTrisula.literasi?.trim() && (
                    <div className="border-l-4 border-blue-500 bg-blue-50/30 p-2.5 rounded-r-lg print:bg-transparent print-break-inside-avoid">
                      <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1 text-[11px]">
                        <BookOpen className="w-3 h-3 text-blue-700" />
                        <span>1. Kegiatan Literasi</span>
                      </div>
                      <p className="text-gray-800 leading-relaxed text-justify pl-4">
                        {identitas.deskripsiTrisula.literasi.trim()}
                      </p>
                    </div>
                  )}
                  {identitas.deskripsiTrisula.numerasi?.trim() && (
                    <div className="border-l-4 border-teal-500 bg-teal-50/30 p-2.5 rounded-r-lg print:bg-transparent print-break-inside-avoid">
                      <div className="flex items-center gap-1.5 font-bold text-teal-900 mb-1 text-[11px]">
                        <Calculator className="w-3 h-3 text-teal-700" />
                        <span>2. Kegiatan Numerasi</span>
                      </div>
                      <p className="text-gray-800 leading-relaxed text-justify pl-4">
                        {identitas.deskripsiTrisula.numerasi.trim()}
                      </p>
                    </div>
                  )}
                  {identitas.deskripsiTrisula.diniyyah?.trim() && (
                    <div className="border-l-4 border-amber-500 bg-amber-50/30 p-2.5 rounded-r-lg print:bg-transparent print-break-inside-avoid">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1 text-[11px]">
                        <HeartHandshake className="w-3 h-3 text-amber-700" />
                        <span>3. Diniyyah & Adab</span>
                      </div>
                      <p className="text-gray-800 leading-relaxed text-justify pl-4">
                        {identitas.deskripsiTrisula.diniyyah.trim()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. DESAIN PEMBELAJARAN */}
            <div className="space-y-2">
              <PrintSectionHeader
                title="Desain Pembelajaran"
                variant="primary"
                icon={<FileText className="w-3.5 h-3.5" />}
              />
              <div className="space-y-2.5 text-xs">
                {/* Capaian Pembelajaran */}
                <div className="border-l-4 border-slate-400 bg-slate-50/40 p-2.5 rounded-r-lg print:bg-transparent print-break-inside-avoid">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">Capaian Pembelajaran (CP)</h4>
                  <p className="text-gray-800 leading-relaxed text-justify">{dp?.capaianPembelajaran || "-"}</p>
                </div>

                {/* Tujuan Pembelajaran (TP) */}
                {dp?.tujuanPembelajaran &&
                  dp.tujuanPembelajaran.filter((t: string) => t && t.trim().length > 0).length > 0 && (
                  <div className="border-l-4 border-emerald-500 bg-emerald-50/30 p-2.5 rounded-r-lg print:bg-transparent">
                    <h4 className="font-bold text-emerald-900 uppercase text-[11px] mb-1.5">Tujuan Pembelajaran (TP)</h4>
                    <ol className="space-y-1.5 text-xs list-decimal list-inside text-gray-900 leading-relaxed">
                      {dp.tujuanPembelajaran
                        .filter((t: string) => t && t.trim().length > 0)
                        .map((tp: string, i: number) => (
                          <li key={i} className="pl-1 font-medium">
                            {tp.trim()}
                          </li>
                        ))}
                    </ol>
                  </div>
                )}

                {/* Pemahaman Bermakna */}
                {dp?.pemahamanBermakna?.trim() && (
                  <div className="border-l-4 border-teal-500 bg-teal-50/30 p-2.5 rounded-r-lg print:bg-transparent print-break-inside-avoid">
                    <h4 className="font-bold text-teal-900 uppercase text-[11px] mb-1">Pemahaman Bermakna (Deep Insight)</h4>
                    <p className="text-gray-800 leading-relaxed text-justify">{dp.pemahamanBermakna.trim()}</p>
                  </div>
                )}

                {/* Pertanyaan Pemantik */}
                {dp?.pertanyaanPemantik &&
                  dp.pertanyaanPemantik.filter((p: string) => p && p.trim()).length > 0 && (
                  <div className="border-l-4 border-amber-500 bg-amber-50/30 p-2.5 rounded-r-lg print:bg-transparent print-break-inside-avoid">
                    <h4 className="font-bold text-amber-900 uppercase text-[11px] mb-1">Pertanyaan Pemantik</h4>
                    <ol className="space-y-1 text-xs list-decimal list-inside text-gray-900 leading-relaxed">
                      {dp.pertanyaanPemantik
                        .filter((p: string) => p && p.trim())
                        .map((p: string, i: number) => (
                          <li key={i} className="pl-1 italic">"{p.trim()}"</li>
                        ))}
                    </ol>
                  </div>
                )}

                {/* Media Ajar & Sumber Belajar */}
                {(((dp?.mediaAjar?.filter((m: string) => m?.trim()).length || 0) > 0) ||
                  ((dp?.sumberBelajar?.filter((s: string) => s?.trim()).length || 0) > 0)) && (
                  <div className="grid grid-cols-2 gap-3 print-break-inside-avoid">
                    {((dp?.mediaAjar?.filter((m: string) => m?.trim()).length || 0) > 0) && (
                      <div className="border-l-4 border-blue-400 bg-blue-50/30 p-2.5 rounded-r-lg print:bg-transparent text-xs">
                        <h5 className="font-bold text-blue-900 uppercase text-[10px] mb-1">Media Ajar</h5>
                        <ul className="space-y-1 list-disc list-inside text-gray-800">
                          {dp?.mediaAjar?.filter((m: string) => m?.trim()).map((m: string, i: number) => (
                            <li key={i}>{m.trim()}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {((dp?.sumberBelajar?.filter((s: string) => s?.trim()).length || 0) > 0) && (
                      <div className="border-l-4 border-emerald-400 bg-emerald-50/30 p-2.5 rounded-r-lg print:bg-transparent text-xs">
                        <h5 className="font-bold text-emerald-900 uppercase text-[10px] mb-1">Sumber Belajar</h5>
                        <ul className="space-y-1 list-disc list-inside text-gray-800">
                          {dp?.sumberBelajar?.filter((s: string) => s?.trim()).map((s: string, i: number) => (
                            <li key={i}>{s.trim()}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4. PENGALAMAN BELAJAR (SKENARIO AKTIVITAS) */}
            <div className="space-y-2">
              <PrintSectionHeader
                title="Pengalaman Belajar"
                subtitle="Skenario Alur Pembelajaran Aktif"
                variant="primary"
                icon={<Clock className="w-3.5 h-3.5" />}
              />

              <div className="space-y-3 text-xs">
                {/* 01 Kegiatan Awal */}
                <div className="border border-emerald-200/80 rounded-lg bg-white overflow-hidden print:border-gray-300">
                  <div className="bg-emerald-50/70 border-b border-emerald-100 px-3 py-1.5 flex justify-between items-center print-break-inside-avoid print:bg-gray-100 print:border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-emerald-800">01</span>
                      <h4 className="font-bold text-emerald-950 text-xs uppercase">Kegiatan Awal (Pendahuluan)</h4>
                    </div>
                    {metaAwal?.durasiMenit && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {metaAwal.durasiMenit} Menit
                      </span>
                    )}
                  </div>
                  {metaAwal && (metaAwal.fokus || metaAwal.fokusAdab) && (
                    <div className="text-[11px] text-gray-600 bg-gray-50/60 px-3 py-1.5 border-b border-gray-100 space-y-0.5 print:bg-white print:border-gray-200 print-break-inside-avoid">
                      {metaAwal.fokus && (
                        <p><span className="font-semibold text-gray-700">Fokus:</span> {metaAwal.fokus}</p>
                      )}
                      {metaAwal.fokusAdab && (
                        <p><span className="font-semibold text-gray-700">Fokus Adab:</span> {metaAwal.fokusAdab}</p>
                      )}
                    </div>
                  )}
                  <ul className="p-3 space-y-2">
                    {(kp?.awal || []).map((act: RPMActivityInput, i: number) => {
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

                {/* 02 Kegiatan Inti */}
                <div className="border border-emerald-200/80 rounded-lg bg-white overflow-hidden print:border-gray-300">
                  <div className="bg-emerald-50/70 border-b border-emerald-100 px-3 py-1.5 flex justify-between items-center print-break-inside-avoid print:bg-gray-100 print:border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-emerald-800">02</span>
                      <h4 className="font-bold text-emerald-950 text-xs uppercase">Kegiatan Inti (Eksplorasi & Kolaborasi)</h4>
                    </div>
                    {metaInti?.durasiMenit && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {metaInti.durasiMenit} Menit
                      </span>
                    )}
                  </div>
                  {metaInti && (metaInti.fokus || metaInti.pendekatanMetode) && (
                    <div className="text-[11px] text-gray-600 bg-gray-50/60 px-3 py-1.5 border-b border-gray-100 space-y-0.5 print:bg-white print:border-gray-200 print-break-inside-avoid">
                      {metaInti.fokus && (
                        <p><span className="font-semibold text-gray-700">Fokus:</span> {metaInti.fokus}</p>
                      )}
                      {metaInti.pendekatanMetode && (
                        <p><span className="font-semibold text-gray-700">Pendekatan / Metode:</span> {metaInti.pendekatanMetode}</p>
                      )}
                    </div>
                  )}
                  <ul className="p-3 space-y-2">
                    {(kp?.inti || []).map((act: RPMActivityInput, i: number) => {
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

                {/* 03 Kegiatan Penutup */}
                <div className="border border-emerald-200/80 rounded-lg bg-white overflow-hidden print:border-gray-300">
                  <div className="bg-emerald-50/70 border-b border-emerald-100 px-3 py-1.5 flex justify-between items-center print-break-inside-avoid print:bg-gray-100 print:border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-emerald-800">03</span>
                      <h4 className="font-bold text-emerald-950 text-xs uppercase">Kegiatan Penutup (Refleksi & Doa)</h4>
                    </div>
                    {metaAkhir?.durasiMenit && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {metaAkhir.durasiMenit} Menit
                      </span>
                    )}
                  </div>
                  {metaAkhir && (metaAkhir.fokus || metaAkhir.fokusRefleksi) && (
                    <div className="text-[11px] text-gray-600 bg-gray-50/60 px-3 py-1.5 border-b border-gray-100 space-y-0.5 print:bg-white print:border-gray-200 print-break-inside-avoid">
                      {metaAkhir.fokus && (
                        <p><span className="font-semibold text-gray-700">Fokus:</span> {metaAkhir.fokus}</p>
                      )}
                      {metaAkhir.fokusRefleksi && (
                        <p><span className="font-semibold text-gray-700">Fokus Refleksi:</span> {metaAkhir.fokusRefleksi}</p>
                      )}
                    </div>
                  )}
                  <ul className="p-3 space-y-2">
                    {(kp?.akhir || []).map((act: RPMActivityInput, i: number) => {
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

            {/* 5. ASESMEN PEMBELAJARAN */}
            <div className="space-y-3">
              <PrintSectionHeader
                title="Asesmen Pembelajaran"
                variant="primary"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              />

              {/* 3 Asesmen Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs print-break-inside-avoid">
                <div className="border-l-4 border-blue-500 bg-blue-50/30 p-2.5 rounded-r-lg print:border-blue-500 print:bg-transparent">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-0.5">Asesmen Awal</div>
                  <h5 className="font-bold text-gray-900 mb-1">Diagnostik</h5>
                  <p className="text-gray-700 text-[11px] leading-relaxed">{asesmen?.awal || "-"}</p>
                </div>

                <div className="border-l-4 border-teal-500 bg-teal-50/30 p-2.5 rounded-r-lg print:border-teal-500 print:bg-transparent">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800 mb-0.5">Asesmen Proses</div>
                  <h5 className="font-bold text-gray-900 mb-1">Formatif & Rubrik Karakter</h5>
                  <p className="text-gray-700 text-[11px] leading-relaxed">{asesmen?.formatif || "-"}</p>
                </div>

                <div className="border-l-4 border-emerald-500 bg-emerald-50/30 p-2.5 rounded-r-lg print:border-emerald-500 print:bg-transparent">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">Asesmen Akhir</div>
                  <h5 className="font-bold text-gray-900 mb-1">Sumatif Karya</h5>
                  <p className="text-gray-700 text-[11px] leading-relaxed">{asesmen?.sumatif || "-"}</p>
                </div>
              </div>

              {/* Rubrik Karakter FITRAH */}
              {asesmen?.rubrikKarakterFitrah && asesmen.rubrikKarakterFitrah.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <h4 className="font-bold text-xs text-slate-800 uppercase print-break-after-avoid">
                    Rubrik Karakter FITRAH (Observasi Perilaku Formatif)
                  </h4>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-emerald-50/60 print:bg-gray-100 text-emerald-950 print:text-gray-900">
                        <tr>
                          <th className="border border-gray-300 p-2 text-left font-bold w-1/4">Indikator Karakter</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Sangat Baik (SB)</th>
                          <th className="border border-gray-300 p-2 text-left font-bold">Perlu Bimbingan (PB)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asesmen.rubrikKarakterFitrah.map((row: { indikator: string; sangatBaik: string; perluBimbingan: string }, i: number) => (
                          <tr key={i} className={`print-break-inside-avoid ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40 print:bg-transparent"}`}>
                            <td className="border border-gray-300 p-2 font-semibold text-slate-800">{row.indikator}</td>
                            <td className="border border-gray-300 p-2 text-gray-900 leading-relaxed">{row.sangatBaik}</td>
                            <td className="border border-gray-300 p-2 text-gray-900 leading-relaxed">{row.perluBimbingan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pesan Edukasi Orang Tua (Madrasatul Ula) */}
              {asesmen?.pesanEdukasiOrangTua?.trim() && (
                <div className="border-l-4 border-amber-500 bg-amber-50/40 p-3 rounded-r-lg print:border-amber-500 print:bg-transparent print-break-inside-avoid mt-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 uppercase mb-1">
                    <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pesan Edukasi Orang Tua (Madrasatul Ula)</span>
                  </div>
                  <p className="text-xs italic leading-relaxed text-amber-950 pl-5">
                    "{asesmen.pesanEdukasiOrangTua.trim()}"
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
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next !== mataPelajaran && (capaianPembelajaran.trim() || tujuanPembelajaran.some(t => t.trim()))) {
                              toast.warning("Mata pelajaran diubah. Harap periksa kembali CP dan TP di Langkah 2 agar tetap selaras.");
                            }
                            setMataPelajaran(next);
                          }}
                          className="w-full min-h-[40px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200"
                        >
                          {masterSubjects.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={mataPelajaran}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next !== mataPelajaran && (capaianPembelajaran.trim() || tujuanPembelajaran.some(t => t.trim()))) {
                              toast.warning("Mata pelajaran diubah. Harap periksa kembali CP dan TP di Langkah 2 agar tetap selaras.");
                            }
                            setMataPelajaran(next);
                          }}
                          className="text-xs"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Kelas / Rombel (Master Data)</label>
                      {masterClasses.length > 0 ? (
                        <select
                          value={kelasRombel}
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextFase = resolvePhaseByClassName(val);
                            if (nextFase !== tingkatFase && (capaianPembelajaran.trim() || tujuanPembelajaran.some(t => t.trim()))) {
                              toast.warning("Kelas/fase diubah. Harap tinjau kembali keselarasan CP & TP di Langkah 2.");
                            }
                            setKelasRombel(val);
                            setTingkatFase(nextFase);
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
                            const nextFase = resolvePhaseByClassName(val);
                            if (nextFase !== tingkatFase && (capaianPembelajaran.trim() || tujuanPembelajaran.some(t => t.trim()))) {
                              toast.warning("Kelas/fase diubah. Harap tinjau kembali keselarasan CP & TP di Langkah 2.");
                            }
                            setKelasRombel(val);
                            setTingkatFase(nextFase);
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

                  {/* Semester & Tahun Ajaran */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Semester (Master Data)</label>
                      {masterSemesters.length > 0 ? (
                        <select
                          value={semesterId}
                          onChange={(e) => {
                            const selId = e.target.value;
                            setSemesterId(selId);
                            if (selId) {
                              const period = resolveAcademicPeriodDisplay(
                                { semesterId: selId },
                                { semesters: masterSemesters, academicYears: masterAcademicYears }
                              );
                              setSemesterNama(period.semesterName);
                              setTahunAjaran(period.academicYearLabel !== "-" ? period.academicYearLabel : "");
                            } else {
                              setSemesterNama("");
                              setTahunAjaran("");
                            }
                          }}
                          className="w-full min-h-[40px] px-3 py-2 text-xs border rounded-xl bg-white border-gray-200"
                        >
                          <option value="">Pilih Semester...</option>
                          {masterSemesters.map((s) => {
                            const period = resolveAcademicPeriodDisplay(
                              { semesterId: s.id },
                              { semesters: masterSemesters, academicYears: masterAcademicYears }
                            );
                            const semDisplay = period.semesterLabel !== "-" ? period.semesterLabel : s.name;
                            const ayDisplay = period.academicYearLabel !== "-" ? period.academicYearLabel : (s.academic_year_name || "");
                            const fullLabel = ayDisplay ? `${semDisplay} — ${ayDisplay}` : semDisplay;
                            return (
                              <option key={s.id} value={s.id}>
                                {fullLabel}{s.is_active ? " (Aktif)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <Input
                          placeholder="Semester Ganjil / Genap"
                          value={semesterNama}
                          onChange={(e) => setSemesterNama(e.target.value)}
                          className="text-xs"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tahun Ajaran</label>
                      <Input
                        placeholder="Contoh: 2026/2027"
                        value={tahunAjaran}
                        onChange={(e) => setTahunAjaran(e.target.value)}
                        className="text-xs"
                        readOnly={masterSemesters.length > 0 && !!semesterId}
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
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Pemahaman Bermakna (Deep Insight)
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={generatingField !== null}
                        onClick={() => handleGenerateFieldAI("PEMAHAMAN_BERMAKNA")}
                        className="text-xs h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      >
                        {generatingField === "PEMAHAMAN_BERMAKNA" ? (
                          <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Merumuskan...</>
                        ) : (
                          <><Sparkles className="w-3 h-3 mr-1 text-emerald-600" /> Bantu Buat dengan AI</>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Manfaat praktikal & hikmah konsep yang dipelajari siswa..."
                      value={pemahamanBermakna}
                      onChange={(e) => setPemahamanBermakna(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  {/* Pertanyaan Pemantik */}
                  <div className="p-4 border rounded-xl bg-amber-50/30 border-amber-200/70 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-bold text-amber-900 uppercase">
                          Pertanyaan Pemantik (Curiosity Triggers)
                        </label>
                        <p className="text-[11px] text-amber-700/80">
                          2–3 pertanyaan terbuka untuk memantik rasa ingin tahu santri secara kontekstual.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={generatingField !== null}
                          onClick={() => handleGenerateFieldAI("PERTANYAAN_PEMANTIK")}
                          className="text-xs h-7 border-amber-300 text-amber-800 hover:bg-amber-100"
                        >
                          {generatingField === "PERTANYAAN_PEMANTIK" ? (
                            <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Merumuskan...</>
                          ) : (
                            <><Sparkles className="w-3 h-3 mr-1 text-amber-600" /> Bantu Buat dengan AI</>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setPertanyaanPemantik([...pertanyaanPemantik, ""])}
                          className="text-xs h-7 border-amber-300 text-amber-800 hover:bg-amber-100"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                        </Button>
                      </div>
                    </div>
                    {pertanyaanPemantik.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Belum ada pertanyaan pemantik. Klik Tambah atau gunakan Bantu Buat dengan AI.</p>
                    ) : (
                      <div className="space-y-2">
                        {pertanyaanPemantik.map((p, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <span className="text-xs font-bold text-amber-700 w-5">{idx + 1}.</span>
                            <Input
                              value={p}
                              onChange={(e) => {
                                const next = [...pertanyaanPemantik];
                                next[idx] = e.target.value;
                                setPertanyaanPemantik(next);
                              }}
                              placeholder="Contoh: Mengapa kita perlu menghitung secara cermat dalam kehidupan sehari-hari?"
                              className="text-xs bg-white flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPertanyaanPemantik(pertanyaanPemantik.filter((_, i) => i !== idx))}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Media Ajar & Sumber Belajar (2-column layout) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Media Ajar */}
                    <div className="p-4 border rounded-xl bg-blue-50/30 border-blue-200/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-bold text-blue-900 uppercase">
                            Media Ajar / Sarana
                          </label>
                          <p className="text-[11px] text-blue-700/80">
                            3–5 media konkret & praktis.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={generatingField !== null}
                            onClick={() => handleGenerateFieldAI("MEDIA_AJAR")}
                            className="text-xs h-7 border-blue-300 text-blue-800 hover:bg-blue-100"
                          >
                            {generatingField === "MEDIA_AJAR" ? (
                              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Merumuskan...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1 text-blue-600" /> Bantu Buat dengan AI</>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setMediaAjar([...mediaAjar, ""])}
                            className="text-xs h-7 border-blue-300 text-blue-800 hover:bg-blue-100"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                          </Button>
                        </div>
                      </div>
                      {mediaAjar.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Belum ada media ajar. Klik Tambah atau gunakan Bantu Buat dengan AI.</p>
                      ) : (
                        <div className="space-y-2">
                          {mediaAjar.map((m, idx) => (
                            <div key={idx} className="flex gap-1.5 items-center">
                              <Input
                                value={m}
                                onChange={(e) => {
                                  const next = [...mediaAjar];
                                  next[idx] = e.target.value;
                                  setMediaAjar(next);
                                }}
                                placeholder="Contoh: Modul/LKPD, Papan Tulis, Flashcard..."
                                className="text-xs bg-white flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setMediaAjar(mediaAjar.filter((_, i) => i !== idx))}
                                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sumber Belajar */}
                    <div className="p-4 border rounded-xl bg-green-50/30 border-green-200/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-bold text-green-900 uppercase">
                            Sumber Belajar / Rujukan
                          </label>
                          <p className="text-[11px] text-green-700/80">
                            3–5 sumber belajar realistis.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={generatingField !== null}
                            onClick={() => handleGenerateFieldAI("SUMBER_BELAJAR")}
                            className="text-xs h-7 border-green-300 text-green-800 hover:bg-green-100"
                          >
                            {generatingField === "SUMBER_BELAJAR" ? (
                              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Merumuskan...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1 text-green-600" /> Bantu Buat dengan AI</>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setSumberBelajar([...sumberBelajar, ""])}
                            className="text-xs h-7 border-green-300 text-green-800 hover:bg-green-100"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                          </Button>
                        </div>
                      </div>
                      {sumberBelajar.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Belum ada sumber belajar. Klik Tambah atau gunakan Bantu Buat dengan AI.</p>
                      ) : (
                        <div className="space-y-2">
                          {sumberBelajar.map((s, idx) => (
                            <div key={idx} className="flex gap-1.5 items-center">
                              <Input
                                value={s}
                                onChange={(e) => {
                                  const next = [...sumberBelajar];
                                  next[idx] = e.target.value;
                                  setSumberBelajar(next);
                                }}
                                placeholder="Contoh: Buku Paket Siswa, Modul SIUBA..."
                                className="text-xs bg-white flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setSumberBelajar(sumberBelajar.filter((_, i) => i !== idx))}
                                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

                      <div>
                        <span className="font-bold text-gray-700 block mb-1">DPL Kurikulum Nasional:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {VALID_KURNAS.map((tag) => (
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

                  {/* Activity Phase 1: Awal */}
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl bg-emerald-50/20 border-emerald-200/60 space-y-2">
                      <span className="text-[11px] font-bold text-emerald-900 uppercase block">
                        Metadata Skenario: Kegiatan Awal
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Durasi (Menit)</label>
                          <Input
                            type="number"
                            value={kegiatanMetadataAwal.durasiMenit || 0}
                            onChange={(e) => setKegiatanMetadataAwal({ ...kegiatanMetadataAwal, durasiMenit: Number(e.target.value) })}
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Fokus Tahap</label>
                          <Input
                            value={kegiatanMetadataAwal.fokus || ""}
                            onChange={(e) => setKegiatanMetadataAwal({ ...kegiatanMetadataAwal, fokus: e.target.value })}
                            placeholder="Pembukaan & apersepsi..."
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Fokus Adab</label>
                          <Input
                            value={kegiatanMetadataAwal.fokusAdab || ""}
                            onChange={(e) => setKegiatanMetadataAwal({ ...kegiatanMetadataAwal, fokusAdab: e.target.value })}
                            placeholder="Adab berdoa & menghormati guru..."
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                    <ActivityListEditor
                      label="1. Butir Aktivitas: Kegiatan Awal (Pendahuluan)"
                      items={kegiatanAwal}
                      onChange={setKegiatanAwal}
                      availableBudayaTags={budayaSahabatTags}
                      availableKarakterTags={combinedKarakterOptions}
                    />
                  </div>

                  {/* Activity Phase 2: Inti */}
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl bg-blue-50/20 border-blue-200/60 space-y-2">
                      <span className="text-[11px] font-bold text-blue-900 uppercase block">
                        Metadata Skenario: Kegiatan Inti
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Durasi (Menit)</label>
                          <Input
                            type="number"
                            value={kegiatanMetadataInti.durasiMenit || 0}
                            onChange={(e) => setKegiatanMetadataInti({ ...kegiatanMetadataInti, durasiMenit: Number(e.target.value) })}
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Fokus Tahap</label>
                          <Input
                            value={kegiatanMetadataInti.fokus || ""}
                            onChange={(e) => setKegiatanMetadataInti({ ...kegiatanMetadataInti, fokus: e.target.value })}
                            placeholder="Eksplorasi & kolaborasi..."
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Pendekatan / Metode</label>
                          <Input
                            value={kegiatanMetadataInti.pendekatanMetode || ""}
                            onChange={(e) => setKegiatanMetadataInti({ ...kegiatanMetadataInti, pendekatanMetode: e.target.value })}
                            placeholder="Pembelajaran kooperatif kontekstual..."
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                    <ActivityListEditor
                      label="2. Butir Aktivitas: Kegiatan Inti (Eksplorasi & Kolaborasi)"
                      items={kegiatanInti}
                      onChange={setKegiatanInti}
                      availableBudayaTags={budayaSahabatTags}
                      availableKarakterTags={combinedKarakterOptions}
                    />
                  </div>

                  {/* Activity Phase 3: Penutup */}
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl bg-amber-50/20 border-amber-200/60 space-y-2">
                      <span className="text-[11px] font-bold text-amber-900 uppercase block">
                        Metadata Skenario: Kegiatan Penutup
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Durasi (Menit)</label>
                          <Input
                            type="number"
                            value={kegiatanMetadataAkhir.durasiMenit || 0}
                            onChange={(e) => setKegiatanMetadataAkhir({ ...kegiatanMetadataAkhir, durasiMenit: Number(e.target.value) })}
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Fokus Tahap</label>
                          <Input
                            value={kegiatanMetadataAkhir.fokus || ""}
                            onChange={(e) => setKegiatanMetadataAkhir({ ...kegiatanMetadataAkhir, fokus: e.target.value })}
                            placeholder="Refleksi pembelajaran..."
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">Fokus Refleksi / Adab</label>
                          <Input
                            value={kegiatanMetadataAkhir.fokusRefleksi || ""}
                            onChange={(e) => setKegiatanMetadataAkhir({ ...kegiatanMetadataAkhir, fokusRefleksi: e.target.value })}
                            placeholder="Hikmah pembelajaran & doa penutup..."
                            className="text-xs h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                    <ActivityListEditor
                      label="3. Butir Aktivitas: Kegiatan Penutup (Refleksi & Doa)"
                      items={kegiatanAkhir}
                      onChange={setKegiatanAkhir}
                      availableBudayaTags={budayaSahabatTags}
                      availableKarakterTags={combinedKarakterOptions}
                    />
                  </div>

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
                      <label className="block font-bold mb-1 text-gray-700">Asesmen Proses (Formatif - Observasi Guru)</label>
                      <Textarea value={asesmenFormatif} onChange={(e) => setAsesmenFormatif(e.target.value)} rows={2} className="text-xs bg-white" />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-gray-700">Asesmen Akhir (Sumatif Karya)</label>
                      <Textarea value={asesmenSumatif} onChange={(e) => setAsesmenSumatif(e.target.value)} rows={2} className="text-xs bg-white" />
                    </div>
                  </div>

                  {/* Rubrik Karakter FITRAH (Perencanaan Observasi Guru) */}
                  <div className="p-4 border rounded-xl bg-slate-50/70 border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-slate-900 uppercase">
                          Rubrik Karakter FITRAH (Deskriptor Observasi Guru)
                        </label>
                        <p className="text-[11px] text-gray-500">
                          Deskriptor observasi perilaku konkret untuk karakter: {karakterTags.join(", ") || "(pilih di bagian Karakter FITRAH)"}.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRubrikKarakterFitrah([
                            ...rubrikKarakterFitrah,
                            { indikator: "Indikator Baru", sangatBaik: "", perluBimbingan: "" },
                          ]);
                        }}
                        className="text-xs h-7 border-slate-300 text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Baris
                      </Button>
                    </div>

                    {rubrikKarakterFitrah.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Pilih Karakter FITRAH di atas untuk mengisi rubrik otomatis atau klik Tambah Baris.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse bg-white rounded-lg overflow-hidden border border-gray-200">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-gray-200 text-[11px]">
                              <th className="p-2 text-left font-bold w-1/4">Indikator</th>
                              <th className="p-2 text-left font-bold">Kriteria Sangat Baik (SB)</th>
                              <th className="p-2 text-left font-bold">Kriteria Perlu Bimbingan (PB)</th>
                              <th className="p-2 text-center w-10">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {rubrikKarakterFitrah.map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="p-2 align-top font-semibold text-slate-800">
                                  <Input
                                    value={row.indikator}
                                    onChange={(e) => {
                                      const next = [...rubrikKarakterFitrah];
                                      next[idx] = { ...next[idx], indikator: e.target.value };
                                      setRubrikKarakterFitrah(next);
                                    }}
                                    className="text-xs h-8 font-semibold bg-white"
                                  />
                                </td>
                                <td className="p-2 align-top">
                                  <Textarea
                                    value={row.sangatBaik}
                                    onChange={(e) => {
                                      const next = [...rubrikKarakterFitrah];
                                      next[idx] = { ...next[idx], sangatBaik: e.target.value };
                                      setRubrikKarakterFitrah(next);
                                    }}
                                    rows={2}
                                    placeholder="Deskriptor perilaku sangat baik..."
                                    className="text-xs bg-white"
                                  />
                                </td>
                                <td className="p-2 align-top">
                                  <Textarea
                                    value={row.perluBimbingan}
                                    onChange={(e) => {
                                      const next = [...rubrikKarakterFitrah];
                                      next[idx] = { ...next[idx], perluBimbingan: e.target.value };
                                      setRubrikKarakterFitrah(next);
                                    }}
                                    rows={2}
                                    placeholder="Deskriptor perilaku perlu bimbingan..."
                                    className="text-xs bg-white"
                                  />
                                </td>
                                <td className="p-2 align-top text-center">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRubrikKarakterFitrah(rubrikKarakterFitrah.filter((_, i) => i !== idx))}
                                    className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                                    title="Hapus baris rubrik ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Pesan Edukasi Orang Tua (Madrasatul Ula)
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={generatingField !== null}
                        onClick={() => handleGenerateFieldAI("PESAN_ORANG_TUA")}
                        className="text-xs h-7 border-purple-300 text-purple-800 hover:bg-purple-50"
                      >
                        {generatingField === "PESAN_ORANG_TUA" ? (
                          <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Merumuskan...</>
                        ) : (
                          <><Sparkles className="w-3 h-3 mr-1 text-purple-600" /> Bantu Buat dengan AI</>
                        )}
                      </Button>
                    </div>
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

              {/* Card Lampiran RPM */}
              <RPMAttachmentSection
                documentId={activeDoc?.id || autoSaveDraftIdRef.current || null}
                initialAttachments={activeDocAttachments}
                onSaveAndOpenAttachments={handleSaveDraftAndOpenAttachments}
                onAttachmentsChange={setActiveDocAttachments}
              />
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
                    <p className="flex items-center justify-between text-[11px] opacity-80 mt-0.5">
                      <span>Rincian:</span>
                      <span>Awal: {durasiAwal}m &bull; Inti: {durasiInti}m &bull; Akhir: {durasiAkhir}m</span>
                    </p>
                    <p className="flex items-center justify-between mt-1 text-[11px] opacity-80">
                      <span>Target Alokasi:</span>
                      <span>{alokasiWaktu} Menit</span>
                    </p>
                    <p className="mt-2 pt-2 border-t text-[11px]">
                      {durasiSesuai ? '✓ Durasi tepat sesuai target alokasi' : `Selisih ${Math.abs(totalDurasi - alokasiWaktu)} menit dari target (${totalDurasi > alokasiWaktu ? '+' : '-'}${Math.abs(totalDurasi - alokasiWaktu)}m)`}
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

                {/* Lampiran RPM Section on Step 3 */}
                <RPMAttachmentSection
                  documentId={activeDoc?.id || autoSaveDraftIdRef.current || null}
                  initialAttachments={activeDocAttachments}
                  onSaveAndOpenAttachments={handleSaveDraftAndOpenAttachments}
                  onAttachmentsChange={setActiveDocAttachments}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 justify-end border-t border-gray-100 p-4 bg-gray-50/40">
                <Button variant="secondary" onClick={() => setStep(2)} disabled={submitting} className="min-h-[38px] text-xs">
                  &larr; Kembali Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    const docId = activeDoc?.id || autoSaveDraftIdRef.current;
                    if (docId && docId !== 'preview-temp') {
                      await loadRpmAttachments(docId);
                    }
                    const payload = buildPayload();
                    const previewDoc: any = {
                      id: docId || 'preview-temp',
                      title: payload.title,
                      type: 'RPM',
                      status: activeDoc?.status || 'DRAFT',
                      version: activeDoc?.version || 1,
                      author_name: user?.name || 'Tutor Pengampu',
                      author_id: user?.id || '',
                      created_at: activeDoc?.created_at || new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      content: payload.content,
                      semester_id: payload.semester_id,
                    };
                    setActiveDoc(previewDoc);
                    setReturnView('WIZARD');
                    setView('PRINT');
                  }}
                  disabled={submitting}
                  className="min-h-[38px] text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Pratinjau Dokumen
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
                    applyAiContent(pendingAiContent, true);
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
                    applyAiContent(pendingAiContent, true);
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm truncate max-w-xs">{doc.title}</p>
                            {Number(doc.attachment_count || 0) > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0" title={`${doc.attachment_count} Lampiran`}>
                                <Paperclip className="w-2.5 h-2.5" /> {doc.attachment_count}
                              </span>
                            )}
                          </div>
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
                                  setActiveDocAttachments([]);
                                  setAttachmentLoadStatus('idle');
                                  if (doc.id) {
                                    void loadRpmAttachments(doc.id);
                                  }
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
                                  // Semester/TA resolution on edit
                                  const editPeriod = resolveAcademicPeriodDisplay(
                                    {
                                      semesterId: doc.content?.identitas?.semesterId || doc.semester_id,
                                      semesterTahun: doc.content?.identitas?.semesterTahun,
                                      tahunAjaran: doc.content?.identitas?.tahunAjaran,
                                    },
                                    { semesters: masterSemesters, academicYears: masterAcademicYears }
                                  );
                                  setSemesterId(editPeriod.semesterId || doc.content?.identitas?.semesterId || doc.semester_id || "");
                                  setSemesterNama(editPeriod.semesterName || (doc.content?.identitas?.semesterTahun && !isUuid(doc.content.identitas.semesterTahun) ? doc.content.identitas.semesterTahun.replace(/^Semester\s*/i, "") : ""));
                                  setTahunAjaran(editPeriod.academicYearLabel !== "-" ? editPeriod.academicYearLabel : (doc.content?.identitas?.tahunAjaran && !isUuid(doc.content.identitas.tahunAjaran) ? doc.content.identitas.tahunAjaran : ""));
                                  setCapaianPembelajaran(doc.content?.desainPembelajaran?.capaianPembelajaran || "");
                                  setPemahamanBermakna(doc.content?.desainPembelajaran?.pemahamanBermakna || "");
                                  setTujuanPembelajaran(doc.content?.desainPembelajaran?.tujuanPembelajaran || [""]);
                                  // New fields
                                  setPertanyaanPemantik(doc.content?.desainPembelajaran?.pertanyaanPemantik || []);
                                  setMediaAjar(doc.content?.desainPembelajaran?.mediaAjar || []);
                                  setSumberBelajar(doc.content?.desainPembelajaran?.sumberBelajar || []);
                                  setRubrikKarakterFitrah(doc.content?.desainPembelajaran?.asesmen?.rubrikKarakterFitrah || []);
                                  setKegiatanAwal((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.awal || []).map(normalizeActivityItem));
                                  setKegiatanInti((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.inti || []).map(normalizeActivityItem));
                                  setKegiatanAkhir((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.akhir || []).map(normalizeActivityItem));
                                  // Activity metadata
                                  const meta = doc.content?.desainPembelajaran?.kegiatanPembelajaran?.metadata;
                                  setKegiatanMetadataAwal({ fokus: meta?.awal?.fokus || "", durasiMenit: meta?.awal?.durasiMenit || 10, fokusAdab: meta?.awal?.fokusAdab || "" });
                                  setKegiatanMetadataInti({ fokus: meta?.inti?.fokus || "", durasiMenit: meta?.inti?.durasiMenit || 50, pendekatanMetode: meta?.inti?.pendekatanMetode || "" });
                                  setKegiatanMetadataAkhir({ fokus: meta?.akhir?.fokus || "", durasiMenit: meta?.akhir?.durasiMenit || 10, fokusRefleksi: meta?.akhir?.fokusRefleksi || "" });
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
                        {Number(doc.attachment_count || 0) > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-blue-50 text-blue-700 border-blue-200 inline-flex items-center gap-1">
                            <Paperclip className="w-2.5 h-2.5" /> {doc.attachment_count}
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
                          setActiveDocAttachments([]);
                          setAttachmentLoadStatus('idle');
                          if (doc.id) {
                            void loadRpmAttachments(doc.id);
                          }
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
                          // Semester/TA resolution on edit
                          const editPeriodMob = resolveAcademicPeriodDisplay(
                            {
                              semesterId: doc.content?.identitas?.semesterId || doc.semester_id,
                              semesterTahun: doc.content?.identitas?.semesterTahun,
                              tahunAjaran: doc.content?.identitas?.tahunAjaran,
                            },
                            { semesters: masterSemesters, academicYears: masterAcademicYears }
                          );
                          setSemesterId(editPeriodMob.semesterId || doc.content?.identitas?.semesterId || doc.semester_id || "");
                          setSemesterNama(editPeriodMob.semesterName || (doc.content?.identitas?.semesterTahun && !isUuid(doc.content.identitas.semesterTahun) ? doc.content.identitas.semesterTahun.replace(/^Semester\s*/i, "") : ""));
                          setTahunAjaran(editPeriodMob.academicYearLabel !== "-" ? editPeriodMob.academicYearLabel : (doc.content?.identitas?.tahunAjaran && !isUuid(doc.content.identitas.tahunAjaran) ? doc.content.identitas.tahunAjaran : ""));
                          setCapaianPembelajaran(doc.content?.desainPembelajaran?.capaianPembelajaran || "");
                          setPemahamanBermakna(doc.content?.desainPembelajaran?.pemahamanBermakna || "");
                          setTujuanPembelajaran(doc.content?.desainPembelajaran?.tujuanPembelajaran || [""]);
                          // New fields
                          setPertanyaanPemantik(doc.content?.desainPembelajaran?.pertanyaanPemantik || []);
                          setMediaAjar(doc.content?.desainPembelajaran?.mediaAjar || []);
                          setSumberBelajar(doc.content?.desainPembelajaran?.sumberBelajar || []);
                          setRubrikKarakterFitrah(doc.content?.desainPembelajaran?.asesmen?.rubrikKarakterFitrah || []);
                          setKegiatanAwal((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.awal || []).map(normalizeActivityItem));
                          setKegiatanInti((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.inti || []).map(normalizeActivityItem));
                          setKegiatanAkhir((doc.content?.desainPembelajaran?.kegiatanPembelajaran?.akhir || []).map(normalizeActivityItem));
                          // Activity metadata
                          const metaMob = doc.content?.desainPembelajaran?.kegiatanPembelajaran?.metadata;
                          setKegiatanMetadataAwal({ fokus: metaMob?.awal?.fokus || "", durasiMenit: metaMob?.awal?.durasiMenit || 10, fokusAdab: metaMob?.awal?.fokusAdab || "" });
                          setKegiatanMetadataInti({ fokus: metaMob?.inti?.fokus || "", durasiMenit: metaMob?.inti?.durasiMenit || 50, pendekatanMetode: metaMob?.inti?.pendekatanMetode || "" });
                          setKegiatanMetadataAkhir({ fokus: metaMob?.akhir?.fokus || "", durasiMenit: metaMob?.akhir?.durasiMenit || 10, fokusRefleksi: metaMob?.akhir?.fokusRefleksi || "" });
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
