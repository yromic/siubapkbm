"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Edit2, ToggleLeft, ToggleRight, Eye, Send, Save, Plus, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppreciationDialog } from "@/components/ui/appreciation-dialog";
import { useAppreciation } from "@/hooks/useAppreciation";
import { humanizeError } from "@/lib/utils/ui-error";
import MediaSelectorModal from "./MediaSelectorModal";

interface Asset {
  id: string;
  url: string;
  alt: string;
}

interface SectionItem {
  id?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  badge?: string | null;
  icon?: string | null;
  image_id?: string | null;
  sort_order: number;
  link_url?: string | null;
  link_text?: string | null;
  image?: Asset | null;
  custom_fields?: any;
}

interface Section {
  id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  sort_order: number;
  is_active: boolean;
  is_draft: boolean;
  content?: any;
  draft_content?: any;
  items?: SectionItem[];
}

interface SectionsTabProps {
  config?: any;
  onUpdateConfig?: (data: any) => Promise<void>;
}

interface FieldConfig {
  label: string;
  placeholder?: string;
  type?: "text" | "textarea" | "image";
}

interface SectionConfig {
  name: string;
  header: {
    badge?: FieldConfig;
    title?: FieldConfig;
    subtitle?: FieldConfig;
  };
  content?: {
    cta_text?: FieldConfig;
    cta_url?: FieldConfig;
    secondary_cta_text?: FieldConfig;
    secondary_cta_url?: FieldConfig;
    video_text?: FieldConfig;
    video_url?: FieldConfig;
    main_image?: FieldConfig;
    accreditation_title?: FieldConfig;
    accreditation_subtitle?: FieldConfig;
  };
  repeater?: {
    title?: FieldConfig;
    subtitle?: FieldConfig;
    description?: FieldConfig;
    badge?: FieldConfig;
    icon?: FieldConfig;
    image?: FieldConfig;
    hasThemeAccent?: boolean;
    hasGridWidth?: boolean;
    hasBgGradientTheme?: boolean;
  };
}

const SECTION_FIELD_CONFIG: Record<string, SectionConfig> = {
  hero: {
    name: "Hero Banner",
    header: {
      badge: { label: "Badge", placeholder: "e.g. PENERIMAAN SISWA BARU" },
      title: { label: "Hero Title", placeholder: "Judul Utama Hero..." },
      subtitle: { label: "Hero Description", type: "textarea", placeholder: "Deskripsi singkat di bawah judul..." }
    },
    content: {
      cta_text: { label: "CTA Button Text", placeholder: "e.g. Daftar Sekarang" },
      cta_url: { label: "CTA Button URL", placeholder: "e.g. /daftar" },
      video_text: { label: "Video Button Text", placeholder: "e.g. Video Profil" },
      video_url: { label: "Video Button URL", placeholder: "e.g. https://youtube.com/..." }
    },
    repeater: {
      title: { label: "Label Slide (Internal)", placeholder: "e.g. Slide Utama" },
      image: { label: "Background Image", type: "image" }
    }
  },
  "why-choose-us": {
    name: "Why Choose Us",
    header: {
      title: { label: "Judul Utama", placeholder: "e.g. Mengapa Memilih Kami" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Deskripsi singkat..." }
    },
    repeater: {
      title: { label: "Judul Item", placeholder: "e.g. Kurikulum Nasional" },
      subtitle: { label: "Sub-judul", placeholder: "e.g. Standar Unggul" },
      description: { label: "Deskripsi Detail", type: "textarea", placeholder: "Penjelasan keunggulan..." },
      icon: { label: "Ikon (Lucide)" },
      hasThemeAccent: true,
      hasGridWidth: true
    }
  },
  programs: {
    name: "Programs",
    header: {
      title: { label: "Judul Utama", placeholder: "e.g. Program Pembelajaran" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Deskripsi program..." }
    },
    repeater: {
      badge: { label: "Category", placeholder: "e.g. Kesetaraan Paket A" },
      title: { label: "Judul Item", placeholder: "e.g. SD / Paket A" },
      description: { label: "Deskripsi Detail", type: "textarea", placeholder: "Deskripsi program..." },
      icon: { label: "Ikon (Lucide)" },
      hasBgGradientTheme: true
    }
  },
  gallery: {
    name: "Gallery",
    header: {
      title: { label: "Judul Utama", placeholder: "e.g. Galeri Foto" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Dokumentasi kegiatan..." }
    },
    repeater: {
      image: { label: "Gambar Foto", type: "image" },
      title: { label: "Photo Title", placeholder: "e.g. Kegiatan Belajar Mandiri" },
      subtitle: { label: "Photo Category", placeholder: "e.g. Kategori Foto" }
    }
  },
  testimonials: {
    name: "Testimonials",
    header: {
      title: { label: "Judul Utama", placeholder: "e.g. Apa Kata Orang Tua" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Ulasan jujur..." }
    },
    repeater: {
      image: { label: "Avatar Wali Murid", type: "image" },
      title: { label: "Parent Name", placeholder: "e.g. Bpk. Budi" },
      subtitle: { label: "Parent Role", placeholder: "e.g. Wali Murid Kelas VII" },
      description: { label: "Testimonial", type: "textarea", placeholder: "Isi kutipan review..." }
    }
  },
  faq: {
    name: "FAQ",
    header: {
      title: { label: "Judul Utama", placeholder: "e.g. Pertanyaan Umum (FAQ)" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Temukan jawaban Anda..." }
    },
    repeater: {
      title: { label: "Question", placeholder: "e.g. Apakah sekolah ini gratis?" },
      description: { label: "Answer", type: "textarea", placeholder: "Tuliskan jawabannya di sini..." }
    }
  },
  "school-life": {
    name: "School Life",
    header: {
      title: { label: "Judul Utama", placeholder: "e.g. Kehidupan Sekolah" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Aktivitas harian..." }
    },
    repeater: {
      image: { label: "Gambar Kegiatan", type: "image" },
      title: { label: "Judul Kegiatan", placeholder: "e.g. Upacara Bendera" },
      subtitle: { label: "Time Label", placeholder: "e.g. Senin, 07:30" },
      description: { label: "Deskripsi Kegiatan", type: "textarea", placeholder: "Detail kegiatan..." }
    }
  },
  principal: {
    name: "Principal Speech",
    header: {
      badge: { label: "Badge", placeholder: "e.g. SAMBUTAN" },
      title: { label: "Judul Utama", placeholder: "e.g. Selamat Datang" },
      subtitle: { label: "Sub-judul", type: "textarea", placeholder: "Salam pembuka..." }
    }
  },
  cta: {
    name: "Call to Action (CTA)",
    header: {
      badge: { label: "Badge", placeholder: "e.g. GABUNG SEKARANG" },
      title: { label: "Judul Utama", placeholder: "e.g. Siap Menjadi Bagian dari Kami?" },
      subtitle: { label: "Deskripsi", type: "textarea", placeholder: "Ayo daftar sekarang juga..." }
    },
    content: {
      cta_text: { label: "Teks Tombol Utama", placeholder: "e.g. Daftar Sekarang" },
      cta_url: { label: "URL Tombol Utama", placeholder: "e.g. /daftar" },
      secondary_cta_text: { label: "Teks Tombol Sekunder", placeholder: "e.g. Hubungi Kami" },
      secondary_cta_url: { label: "URL Tombol Sekunder", placeholder: "e.g. /kontak" }
    }
  },
  about: {
    name: "About School",
    header: {
      badge: { label: "Badge", placeholder: "e.g. TENTANG KAMI" },
      title: { label: "Judul Utama", placeholder: "e.g. PKBM Baitusyukur" },
      subtitle: { label: "Sub-judul / Deskripsi", type: "textarea", placeholder: "Sejarah singkat..." }
    },
    content: {
      main_image: { label: "Main Image", type: "image" },
      accreditation_title: { label: "Accreditation Title (Floating Badge Title)", placeholder: "e.g. Akreditasi A" },
      accreditation_subtitle: { label: "Accreditation Subtitle (Floating Badge Subtitle)", placeholder: "e.g. Terakreditasi Unggul" }
    },
    repeater: {
      title: { label: "Angka / Metrik (e.g. 99%)", placeholder: "e.g. 99%" },
      subtitle: { label: "Label Pencapaian (e.g. Kelulusan)", placeholder: "e.g. Kelulusan Alumni" },
      description: { label: "Deskripsi Detail", type: "textarea", placeholder: "Penjelasan pencapaian..." }
    }
  }
};

export default function SectionsTab({ config, onUpdateConfig }: SectionsTabProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Editor Modal states
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [secTitle, setSecTitle] = useState("");
  const [secSubtitle, setSecSubtitle] = useState("");
  const [secBadge, setSecBadge] = useState("");
  const [secItems, setSecItems] = useState<SectionItem[]>([]);
  const [secContent, setSecContent] = useState<Record<string, any>>({});

  // Principal profile inputs (synced from global config)
  const [pName, setPName] = useState("");
  const [pTitle, setPTitle] = useState("");
  const [pGreeting, setPGreet] = useState("");
  const [pPhoto, setPPhoto] = useState<Asset | null>(null);

  // Sub-item form states (inside section editor)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemBadge, setItemBadge] = useState("");
  const [itemIcon, setItemIcon] = useState("");
  const [itemImage, setItemImage] = useState<Asset | null>(null);
  const [itemLinkText, setItemLinkText] = useState("");
  const [itemLinkUrl, setItemLinkUrl] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);

  // Custom visual parameters state
  const [itemTheme, setItemTheme] = useState("emerald");
  const [itemGridWidth, setItemGridWidth] = useState("col-span-1");
  const [itemProgColor, setItemProgColor] = useState("emerald");
  const [itemCustomFields, setItemCustomFields] = useState<any>({});

  // Media selector helper
  const [mediaTarget, setMediaTarget] = useState<"item" | "principal_photo" | "about_main_image" | null>(null);

  const COMMON_ICONS = [
    { value: "BookOpen", label: "Buku / Belajar (BookOpen)" },
    { value: "HelpCircle", label: "Tanya Jawab (HelpCircle)" },
    { value: "Activity", label: "Aktivitas / Grafik (Activity)" },
    { value: "Shield", label: "Perisai / Keamanan (Shield)" },
    { value: "Heart", label: "Hati / Kasih Sayang (Heart)" },
    { value: "Calculator", label: "Kalkulator / Numerasi (Calculator)" },
    { value: "Bookmark", label: "Bookmark / Karakter (Bookmark)" },
    { value: "Zap", label: "Petir / Unggul (Zap)" },
    { value: "Award", label: "Medali / Penghargaan (Award)" },
    { value: "User", label: "User / Mandiri (User)" },
    { value: "HeartHandshake", label: "Salaman / Sosial (HeartHandshake)" },
    { value: "Star", label: "Bintang / Akreditasi (Star)" },
  ];

  useEffect(() => {
    fetchSections();
  }, []);

  const handleSelectMedia = (asset: Asset) => {
    if (mediaTarget === "principal_photo") {
      setPPhoto(asset);
    } else if (mediaTarget === "about_main_image") {
      setSecContent((prev) => ({
        ...prev,
        image: asset,
        image_url: asset.url
      }));
    } else {
      setItemImage(asset);
    }
    setMediaTarget(null);
  };

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/sections?preview=true");
      const json = await res.json();
      if (res.ok && json.data) {
        setSections(json.data);
      } else {
        notify.error("Gagal mengambil data section.");
      }
    } catch (err) {
      notify.error(humanizeError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (section: Section) => {
    const targetStatus = !section.is_active;
    const toastId = notify.loading("Memperbarui status...");
    try {
      const res = await fetch("/api/v1/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: section.id,
          action: "draft",
          draftContent: {
            ...(section.draft_content || section.content || {}),
            is_active: targetStatus
          }
        })
      });

      notify.dismiss(toastId);
      if (res.ok) {
        notify.success(`Section ${section.type} berhasil ${targetStatus ? "diaktifkan" : "dinonaktifkan"}.`);
        fetchSections();
      } else {
        notify.error("Gagal memperbarui status.");
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(humanizeError(err));
    }
  };

  const handleMoveSection = async (index: number, direction: "up" | "down") => {
    const nextIdx = direction === "up" ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= sections.length) return;

    const list = [...sections];
    const temp = list[index];
    list[index] = list[nextIdx];
    list[nextIdx] = temp;

    const updatedList = list.map((sec, idx) => ({
      ...sec,
      sort_order: idx + 1
    }));

    setSections(updatedList);
    setSavingOrder(true);

    try {
      for (const sec of updatedList) {
        await fetch("/api/v1/admin/sections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: sec.id,
            action: "draft",
            draftContent: {
              ...(sec.draft_content || sec.content || {}),
              sort_order: sec.sort_order
            }
          })
        });
      }
      notify.success("Urutan section berhasil diubah.");
    } catch (err) {
      notify.error(humanizeError(err));
    } finally {
      setSavingOrder(false);
      fetchSections();
    }
  };

  const handleOpenEditor = (sec: Section) => {
    setEditSection(sec);
    const activeContent = sec.is_draft ? (sec.draft_content || sec.content || {}) : (sec.content || {});
    setSecTitle(sec.title || activeContent.title || "");
    setSecSubtitle(sec.subtitle || activeContent.subtitle || "");
    setSecBadge(sec.badge || activeContent.badge || "");
    setSecContent(activeContent);
    setSecItems(sec.items || []);

    if (sec.type === "principal") {
      setPName(config?.principal_name || "");
      setPTitle(config?.principal_title || "");
      setPGreet(config?.principal_greeting || "");
      setPPhoto(config?.principal_photo || null);
    }
    setShowItemForm(false);
    setSelectedItemIndex(null);
  };

  const handleOpenItemAdd = () => {
    setSelectedItemIndex(null);
    setItemTitle("");
    setItemSubtitle("");
    setItemDescription("");
    setItemBadge("");
    setItemIcon("");
    setItemImage(null);
    setItemLinkText("");
    setItemLinkUrl("");
    setItemTheme("emerald");
    setItemGridWidth("col-span-1");
    setItemProgColor("emerald");
    setItemCustomFields({});
    setShowItemForm(true);
  };

  const handleOpenItemEdit = (index: number) => {
    const item = secItems[index];
    setSelectedItemIndex(index);
    setItemTitle(item.title || "");
    setItemSubtitle(item.subtitle || "");
    setItemDescription(item.description || "");
    setItemBadge(item.badge || "");
    setItemIcon(item.icon || "");
    setItemImage(item.image || null);
    setItemLinkText(item.link_text || "");
    setItemLinkUrl(item.link_url || "");
    
    const custom = item.custom_fields || {};
    setItemCustomFields(custom);
    setItemTheme(custom.theme || "emerald");
    setItemGridWidth(custom.gridWidth || "col-span-1");
    
    let colorName = "emerald";
    if (custom.color) {
      if (custom.color.includes("amber")) colorName = "amber";
      else if (custom.color.includes("blue")) colorName = "blue";
    }
    setItemProgColor(colorName);
    
    setShowItemForm(true);
  };

  const handleSaveItem = () => {
    const configData = editSection ? SECTION_FIELD_CONFIG[editSection.type] : null;
    const isHero = editSection?.type === "hero";
    
    // Validation fallback
    if (!isHero && configData?.repeater) {
      if (configData.repeater.title && !itemTitle.trim() && configData.repeater.description && !itemDescription.trim()) {
        notify.error("Judul atau Deskripsi item wajib diisi.");
        return;
      }
    }

    let custom_fields: any = {};
    if (editSection?.type === "why-choose-us") {
      custom_fields = {
        theme: itemTheme,
        gridWidth: itemGridWidth
      };
    } else if (editSection?.type === "programs") {
      const colorMap: Record<string, string> = {
        emerald: "from-brand-emerald-500 to-emerald-600",
        amber: "from-amber-500 to-orange-600",
        blue: "from-blue-500 to-cyan-600"
      };
      const shadowMap: Record<string, string> = {
        emerald: "shadow-brand-emerald-500/10",
        amber: "shadow-amber-500/10",
        blue: "shadow-blue-500/10"
      };
      custom_fields = {
        color: colorMap[itemProgColor] || colorMap.emerald,
        shadow: shadowMap[itemProgColor] || shadowMap.emerald
      };
    } else {
      custom_fields = itemCustomFields;
    }

    const newItem: SectionItem = {
      title: itemTitle || null,
      subtitle: itemSubtitle || null,
      description: itemDescription || null,
      badge: itemBadge || null,
      icon: itemIcon || null,
      image_id: itemImage?.id || null,
      image: itemImage,
      link_text: itemLinkText || null,
      link_url: itemLinkUrl || null,
      custom_fields,
      sort_order: selectedItemIndex !== null ? secItems[selectedItemIndex].sort_order : secItems.length + 1
    };

    const updated = [...secItems];
    if (selectedItemIndex !== null) {
      updated[selectedItemIndex] = newItem;
    } else {
      updated.push(newItem);
    }

    const sorted = updated.map((item, idx) => ({
      ...item,
      sort_order: idx + 1
    }));

    setSecItems(sorted);
    setShowItemForm(false);
    notify.success("Item berhasil disimpan di draf lokal.");
  };

  const handleDeleteItem = (index: number) => {
    const updated = [...secItems];
    updated.splice(index, 1);
    const sorted = updated.map((item, idx) => ({
      ...item,
      sort_order: idx + 1
    }));
    setSecItems(sorted);
    notify.success("Item dihapus.");
  };

  const handleSaveDraft = async () => {
    if (!editSection) return;
    const toastId = notify.loading("Menyimpan draft section...");

    try {
      const draftContent = {
        ...secContent,
        title: secTitle,
        subtitle: secSubtitle,
        badge: secBadge
      };

      const resContent = await fetch("/api/v1/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSection.id,
          action: "draft",
          draftContent
        })
      });

      const cleanItems = secItems.map(({ image, ...rest }) => rest);
      const resItems = await fetch("/api/v1/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSection.id,
          action: "items",
          items: cleanItems
        })
      });

      if (editSection.type === "principal" && onUpdateConfig) {
        await onUpdateConfig({
          principal_name: pName,
          principal_title: pTitle,
          principal_greeting: pGreeting,
          principal_photo_id: pPhoto?.id || null
        });
      }

      notify.dismiss(toastId);

      if (resContent.ok && resItems.ok) {
        notify.success("Draft section berhasil disimpan.");
        setEditSection(null);
        fetchSections();
      } else {
        notify.error("Terjadi kesalahan saat menyimpan draft.");
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(humanizeError(err));
    }
  };

  const handlePublishClick = () => {
    if (!editSection) return;
    setPublishConfirmOpen(true);
  };

  const { open: appOpen, setOpen: setAppOpen, message: appMsg, triggerAppreciation } = useAppreciation();

  const handleConfirmPublish = async () => {
    if (!editSection) return;

    setPublishing(true);
    const toastId = notify.loading("Mempublikasikan section...");
    try {
      const draftContent = {
        ...secContent,
        title: secTitle,
        subtitle: secSubtitle,
        badge: secBadge
      };

      await fetch("/api/v1/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editSection.id, action: "draft", draftContent })
      });

      const cleanItems = secItems.map(({ image, ...rest }) => rest);
      await fetch("/api/v1/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editSection.id, action: "items", items: cleanItems })
      });

      if (editSection.type === "principal" && onUpdateConfig) {
        await onUpdateConfig({
          principal_name: pName,
          principal_title: pTitle,
          principal_greeting: pGreeting,
          principal_photo_id: pPhoto?.id || null
        });
      }

      const res = await fetch("/api/v1/admin/sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSection.id,
          action: "publish"
        })
      });

      notify.dismiss(toastId);
      if (res.ok) {
        setEditSection(null);
        fetchSections();
        notify.success("Perubahan berhasil dipublikasikan secara langsung!");
        triggerAppreciation({
          workflowId: "cms_publish",
          sectionId: editSection.id,
          revision: String(Date.now()),
          role: "admin",
          level: 4,
        });
      } else {
        notify.error("Gagal mempublikasikan.");
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(humanizeError(err));
    } finally {
      setPublishing(false);
      setPublishConfirmOpen(false);
    }
  };

  const currentConfig = editSection ? SECTION_FIELD_CONFIG[editSection.type] : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
              Tata Letak Landing Page
            </h3>
            <p className="text-xs text-zinc-500">Urutkan dan kelola blok-blok konten visual pada website.</p>
          </div>

          <a
            href="/?preview=true"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300"
          >
            <Eye className="w-3.5 h-3.5" />
            Pratinjau Draf Situs
          </a>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <span>Memuat susunan section...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-2xl"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="font-mono text-xs text-zinc-400 bg-white dark:bg-[#171717] px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-lg mt-0.5">
                    {idx + 1}
                  </span>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 capitalize truncate">
                        {SECTION_FIELD_CONFIG[sec.type]?.name || sec.type.replace(/-/g, " ")}
                      </h4>
                      {sec.is_draft && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                          Draf
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate max-w-xs sm:max-w-md">
                      {sec.title || "Tidak ada judul section."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t border-zinc-150 dark:border-zinc-800/80 pt-3 sm:pt-0 sm:border-0">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(sec)}
                      className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100/50 dark:hover:bg-[#333]/50 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      title={sec.is_active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      {sec.is_active ? (
                        <ToggleRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-zinc-400" />
                      )}
                    </button>

                    <button
                      onClick={() => handleMoveSection(idx, "up")}
                      disabled={idx === 0 || savingOrder}
                      className="p-3 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-xl disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveSection(idx, "down")}
                      disabled={idx === sections.length - 1 || savingOrder}
                      className="p-3 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-xl disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenEditor(sec)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#333] text-zinc-700 dark:text-zinc-300 min-h-[44px] flex items-center justify-center cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Isi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editSection && currentConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-zinc-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl h-full bg-white dark:bg-[#1c1c1e] border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 capitalize">
                  Edit Section: {currentConfig.name}
                </h3>
                <p className="text-xs text-zinc-500">Sesuaikan data dan item repeater dalam section ini.</p>
              </div>
              <button
                onClick={() => setEditSection(null)}
                className="px-4 py-2.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300 min-h-[40px] flex items-center justify-center cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Section Header Content Editor */}
              {(currentConfig.header.badge || currentConfig.header.title || currentConfig.header.subtitle) && (
                <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/10 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Header Konten
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {currentConfig.header.badge && (
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                          {currentConfig.header.badge.label}
                        </label>
                        <input
                          type="text"
                          value={secBadge}
                          onChange={(e) => setSecBadge(e.target.value)}
                          placeholder={currentConfig.header.badge.placeholder}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                    )}
                    {currentConfig.header.title && (
                      <div className={currentConfig.header.badge ? "sm:col-span-2" : "sm:col-span-3"}>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                          {currentConfig.header.title.label}
                        </label>
                        <input
                          type="text"
                          value={secTitle}
                          onChange={(e) => setSecTitle(e.target.value)}
                          placeholder={currentConfig.header.title.placeholder}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                    )}
                  </div>
                  {currentConfig.header.subtitle && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                        {currentConfig.header.subtitle.label}
                      </label>
                      <textarea
                        value={secSubtitle}
                        onChange={(e) => setSecSubtitle(e.target.value)}
                        placeholder={currentConfig.header.subtitle.placeholder}
                        rows={currentConfig.header.subtitle.type === "textarea" ? 3 : 1}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100 resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Section Content Fields */}
              {currentConfig.content && (
                <div className="space-y-4 pt-3 border-t border-zinc-100 dark:border-zinc-850">
                  <h5 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Konten Visual & Tombol</h5>
                  
                  {/* Hero & CTA Button Fields */}
                  {((currentConfig.content.cta_text && currentConfig.content.cta_url) || 
                    (currentConfig.content.video_text && currentConfig.content.video_url) ||
                    (currentConfig.content.secondary_cta_text && currentConfig.content.secondary_cta_url)) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentConfig.content.cta_text && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.cta_text.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.cta_text || secContent.primary_cta_text || ""}
                            onChange={(e) => setSecContent({ ...secContent, cta_text: e.target.value, primary_cta_text: e.target.value })}
                            placeholder={currentConfig.content.cta_text.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                      {currentConfig.content.cta_url && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.cta_url.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.cta_url || secContent.primary_cta_url || ""}
                            onChange={(e) => setSecContent({ ...secContent, cta_url: e.target.value, primary_cta_url: e.target.value })}
                            placeholder={currentConfig.content.cta_url.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                      {currentConfig.content.video_text && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.video_text.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.video_text || ""}
                            onChange={(e) => setSecContent({ ...secContent, video_text: e.target.value })}
                            placeholder={currentConfig.content.video_text.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                      {currentConfig.content.video_url && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.video_url.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.video_url || ""}
                            onChange={(e) => setSecContent({ ...secContent, video_url: e.target.value })}
                            placeholder={currentConfig.content.video_url.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                      {currentConfig.content.secondary_cta_text && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.secondary_cta_text.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.secondary_cta_text || ""}
                            onChange={(e) => setSecContent({ ...secContent, secondary_cta_text: e.target.value })}
                            placeholder={currentConfig.content.secondary_cta_text.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                      {currentConfig.content.secondary_cta_url && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.secondary_cta_url.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.secondary_cta_url || ""}
                            onChange={(e) => setSecContent({ ...secContent, secondary_cta_url: e.target.value })}
                            placeholder={currentConfig.content.secondary_cta_url.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* About Main Image Selection */}
                  {currentConfig.content.main_image && (
                    <div className="space-y-2 pt-2">
                      <span className="block text-xs font-semibold text-zinc-500">
                        {currentConfig.content.main_image.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                          {secContent.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={secContent.image.url} alt="Main Image Preview" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-zinc-400" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMediaTarget("about_main_image")}
                          className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                        >
                          Pilih Gambar Utama
                        </button>
                      </div>
                    </div>
                  )}

                  {/* About Accreditation Fields */}
                  {(currentConfig.content.accreditation_title || currentConfig.content.accreditation_subtitle) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {currentConfig.content.accreditation_title && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.accreditation_title.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.accreditation_title || ""}
                            onChange={(e) => setSecContent({ ...secContent, accreditation_title: e.target.value })}
                            placeholder={currentConfig.content.accreditation_title.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                      {currentConfig.content.accreditation_subtitle && (
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                            {currentConfig.content.accreditation_subtitle.label}
                          </label>
                          <input
                            type="text"
                            value={secContent.accreditation_subtitle || ""}
                            onChange={(e) => setSecContent({ ...secContent, accreditation_subtitle: e.target.value })}
                            placeholder={currentConfig.content.accreditation_subtitle.placeholder}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Principal Section Profile & Greeting Speech */}
              {editSection.type === "principal" ? (
                <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/10 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Profil & Sambutan Kepala Sekolah
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Nama Kepala Sekolah <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="Nama Kepala Sekolah..."
                        required
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Jabatan / Gelar <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={pTitle}
                        onChange={(e) => setPTitle(e.target.value)}
                        placeholder="Jabatan..."
                        required
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Greeting Sambutan <span className="text-red-500">*</span></label>
                    <textarea
                      value={pGreeting}
                      onChange={(e) => setPGreet(e.target.value)}
                      placeholder="Surat Sambutan..."
                      rows={5}
                      required
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100 resize-none whitespace-pre-line"
                    />
                  </div>
                  <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-850">
                    <span className="block text-xs font-semibold text-zinc-500">Foto Kepala Sekolah</span>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                        {pPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pPhoto.url} alt="Principal Photo" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMediaTarget("principal_photo")}
                        className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                      >
                        Pilih Foto
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                currentConfig.repeater && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {editSection.type === "hero" ? "Daftar Slide Background Carousel" : `Daftar Item Repeater (${secItems.length})`}
                      </h4>
                      <button
                        onClick={handleOpenItemAdd}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Item Baru
                      </button>
                    </div>

                    {showItemForm && (
                      <div className="p-4 border border-emerald-100 dark:border-emerald-950/20 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-2xl space-y-4">
                        <h5 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {selectedItemIndex !== null ? "Edit Item" : "Tambah Item"}
                        </h5>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {currentConfig.repeater.title && (
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                                {currentConfig.repeater.title.label}
                              </label>
                              <input
                                type="text"
                                value={itemTitle}
                                onChange={(e) => setItemTitle(e.target.value)}
                                placeholder={currentConfig.repeater.title.placeholder}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                              />
                            </div>
                          )}
                          
                          {currentConfig.repeater.subtitle && (
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                                {currentConfig.repeater.subtitle.label}
                              </label>
                              <input
                                type="text"
                                value={itemSubtitle}
                                onChange={(e) => setItemSubtitle(e.target.value)}
                                placeholder={currentConfig.repeater.subtitle.placeholder}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                              />
                            </div>
                          )}

                          {currentConfig.repeater.badge && (
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                                {currentConfig.repeater.badge.label}
                              </label>
                              <input
                                type="text"
                                value={itemBadge}
                                onChange={(e) => setItemBadge(e.target.value)}
                                placeholder={currentConfig.repeater.badge.placeholder}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                              />
                            </div>
                          )}
                        </div>

                        {currentConfig.repeater.description && (
                          <div>
                            <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                              {currentConfig.repeater.description.label}
                            </label>
                            <textarea
                              value={itemDescription}
                              onChange={(e) => setItemDescription(e.target.value)}
                              placeholder={currentConfig.repeater.description.placeholder}
                              rows={3}
                              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100 resize-none"
                            />
                          </div>
                        )}

                        {currentConfig.repeater.icon && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                                {currentConfig.repeater.icon.label}
                              </label>
                              <select
                                value={itemIcon}
                                onChange={(e) => setItemIcon(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                              >
                                <option value="">Pilih Ikon...</option>
                                {COMMON_ICONS.map(icon => (
                                  <option key={icon.value} value={icon.value}>{icon.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {currentConfig.repeater.hasThemeAccent && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/80">
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Warna Aksen Bento Card</label>
                              <select
                                value={itemTheme}
                                onChange={(e) => setItemTheme(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                              >
                                <option value="emerald">Emerald (Default)</option>
                                <option value="red">Red</option>
                                <option value="amber">Amber</option>
                                <option value="blue">Blue</option>
                                <option value="purple">Purple</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Lebar Bento Grid</label>
                              <select
                                value={itemGridWidth}
                                onChange={(e) => setItemGridWidth(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                              >
                                <option value="col-span-1">Lebar Tunggal (col-span-1)</option>
                                <option value="col-span-2">Lebar Ganda (col-span-2)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {currentConfig.repeater.hasBgGradientTheme && (
                          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/80">
                            <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Tema Gradasi Latar Belakang</label>
                            <select
                              value={itemProgColor}
                              onChange={(e) => setItemProgColor(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                            >
                              <option value="emerald">Emerald / Green Gradient</option>
                              <option value="amber">Amber / Orange Gradient</option>
                              <option value="blue">Blue / Cyan Gradient</option>
                            </select>
                          </div>
                        )}

                        {currentConfig.repeater.image && (
                          <div className="space-y-2">
                            <span className="block text-[11px] font-semibold text-zinc-500">
                              {currentConfig.repeater.image.label}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                                {itemImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={itemImage.url} alt="Item Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-zinc-400" />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setMediaTarget("item")}
                                className="px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-white dark:hover:bg-[#262626] transition-colors cursor-pointer"
                              >
                                Pilih Gambar
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowItemForm(false)}
                            className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-white cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveItem}
                            className="px-4 py-1.5 text-xs font-semibold bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl cursor-pointer"
                          >
                            Simpan ke Daftar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {secItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-[#262626]/50 border border-zinc-150 dark:border-zinc-800 rounded-2xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.image && (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-850 shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image.url} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="truncate">
                              <h5 className="text-xs font-bold text-zinc-800 dark:text-zinc-250 truncate">
                                {item.title || item.description || `Item #${idx + 1}`}
                              </h5>
                              <p className="text-[10px] text-zinc-450 truncate">
                                {item.subtitle || item.description || ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenItemEdit(idx)}
                              className="p-1.5 text-zinc-500 hover:bg-white dark:hover:bg-[#333] rounded-lg cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-55/10 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => setEditSection(null)}
                className="w-full sm:w-auto px-4 py-3 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#262626] text-zinc-750 dark:text-zinc-300 min-h-[44px] flex items-center justify-center cursor-pointer"
              >
                Batal
              </button>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSaveDraft}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-[#262626] rounded-xl text-zinc-700 dark:text-zinc-350 min-h-[44px] cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Simpan sebagai Draf
                </button>
                <button
                  onClick={handlePublishClick}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl shadow min-h-[44px] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Publikasikan Live
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        onConfirm={handleConfirmPublish}
        title="Publikasikan Perubahan Section?"
        description="Perubahan ini akan langsung diperbarui pada situs web publik."
        confirmLabel="Publikasikan"
        cancelLabel="Batal"
        variant="default"
        loading={publishing}
      />

      <MediaSelectorModal
        open={mediaTarget !== null}
        onClose={() => setMediaTarget(null)}
        onSelect={handleSelectMedia}
        selectedAssetId={
          mediaTarget === "principal_photo" 
            ? pPhoto?.id 
            : mediaTarget === "about_main_image" 
              ? secContent?.image?.id 
              : itemImage?.id
        }
      />

      <AppreciationDialog
        open={appOpen}
        onOpenChange={setAppOpen}
        title={appMsg.title}
        description={appMsg.body}
      />
    </div>
  );
}
