"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Edit2, ToggleLeft, ToggleRight, Eye, Send, Save, Plus, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
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

export default function SectionsTab() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Editor Modal states
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [secTitle, setSecTitle] = useState("");
  const [secSubtitle, setSecSubtitle] = useState("");
  const [secBadge, setSecBadge] = useState("");
  const [secItems, setSecItems] = useState<SectionItem[]>([]);
  const [secContent, setSecContent] = useState<Record<string, any>>({});

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

  // Media selector helper
  const [mediaTarget, setMediaTarget] = useState<"item" | null>(null);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    setLoading(true);
    try {
      // In admin view, we want to fetch sections (includeDrafts=true for admin editing)
      const res = await fetch("/api/v1/sections?preview=true");
      const json = await res.json();
      if (res.ok && json.data) {
        setSections(json.data);
      } else {
        notify.error("Gagal mengambil data section.");
      }
    } catch (err) {
      notify.error("Terjadi kesalahan saat memuat section.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (section: Section) => {
    const targetStatus = !section.is_active;
    const toastId = notify.loading("Memperbarui status...");
    try {
      // Update is_active directly
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
      notify.error("Terjadi kesalahan koneksi.");
    }
  };

  const handleMoveSection = async (index: number, direction: "up" | "down") => {
    const nextIdx = direction === "up" ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= sections.length) return;

    const list = [...sections];
    const temp = list[index];
    list[index] = list[nextIdx];
    list[nextIdx] = temp;

    // re-assign sort_orders
    const updatedList = list.map((sec, idx) => ({
      ...sec,
      sort_order: idx + 1
    }));

    setSections(updatedList);
    setSavingOrder(true);

    try {
      // Send updates for order
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
      notify.error("Gagal menyimpan urutan baru.");
    } finally {
      setSavingOrder(false);
      fetchSections();
    }
  };

  // Open Section Editor Panel
  const handleOpenEditor = (sec: Section) => {
    setEditSection(sec);
    // Use draft content if draft exists
    const activeContent = sec.is_draft ? (sec.draft_content || sec.content || {}) : (sec.content || {});
    setSecTitle(sec.title || activeContent.title || "");
    setSecSubtitle(sec.subtitle || activeContent.subtitle || "");
    setSecBadge(sec.badge || activeContent.badge || "");
    setSecContent(activeContent);
    setSecItems(sec.items || []);
    setShowItemForm(false);
    setSelectedItemIndex(null);
  };

  // Section Items (Repeater) Helpers
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
    setShowItemForm(true);
  };

  const handleSaveItem = () => {
    if (!itemTitle.trim() && !itemDescription.trim()) {
      notify.error("Judul atau Deskripsi item wajib diisi.");
      return;
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
      sort_order: selectedItemIndex !== null ? secItems[selectedItemIndex].sort_order : secItems.length + 1
    };

    const updated = [...secItems];
    if (selectedItemIndex !== null) {
      updated[selectedItemIndex] = newItem;
    } else {
      updated.push(newItem);
    }

    // sort
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

  // Submit Draft to server
  const handleSaveDraft = async () => {
    if (!editSection) return;
    const toastId = notify.loading("Menyimpan draft section...");

    try {
      // 1. Save Content Draft
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

      // 2. Save Items
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
      notify.error("Terjadi kesalahan koneksi.");
    }
  };

  // Publish Section
  const handlePublish = async () => {
    if (!editSection) return;
    const confirmed = window.confirm("Apakah Anda yakin ingin mempublikasikan perubahan ini ke situs publik secara instan?");
    if (!confirmed) return;

    const toastId = notify.loading("Mempublikasikan section...");
    try {
      // Ensure current values are saved as draft first
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

      // Then publish
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
        notify.success("Perubahan berhasil dipublikasikan secara langsung!");
        setEditSection(null);
        fetchSections();
      } else {
        notify.error("Gagal mempublikasikan.");
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error("Terjadi kesalahan koneksi.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Sections Table/List */}
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
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  {/* Ordering Index Badge */}
                  <span className="font-mono text-xs text-zinc-400 bg-white dark:bg-[#171717] px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    {idx + 1}
                  </span>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                        {sec.type.replace(/-/g, " ")}
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

                <div className="flex items-center gap-2">
                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleActive(sec)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-650 transition-colors"
                    title={sec.is_active ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {sec.is_active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-zinc-400" />
                    )}
                  </button>

                  {/* Ordering */}
                  <button
                    onClick={() => handleMoveSection(idx, "up")}
                    disabled={idx === 0 || savingOrder}
                    className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMoveSection(idx, "down")}
                    disabled={idx === sections.length - 1 || savingOrder}
                    className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenEditor(sec)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#333] text-zinc-700 dark:text-zinc-300"
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

      {/* Slide-over / Editor Dialog */}
      {editSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-zinc-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl h-full bg-white dark:bg-[#1c1c1e] border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 capitalize">
                  Edit Section: {editSection.type.replace(/-/g, " ")}
                </h3>
                <p className="text-xs text-zinc-500">Sesuaikan data dan item repeater dalam section ini.</p>
              </div>
              <button
                onClick={() => setEditSection(null)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50"
              >
                Tutup
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section Slogan Details */}
              <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/10 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Header Konten
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Badge Text</label>
                    <input
                      type="text"
                      value={secBadge}
                      onChange={(e) => setSecBadge(e.target.value)}
                      placeholder="e.g. FAQ, Keunggulan..."
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Judul Utama</label>
                    <input
                      type="text"
                      value={secTitle}
                      onChange={(e) => setSecTitle(e.target.value)}
                      placeholder="Judul Section..."
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Sub-judul / Deskripsi</label>
                  <textarea
                    value={secSubtitle}
                    onChange={(e) => setSecSubtitle(e.target.value)}
                    placeholder="Kalimat penjelas..."
                    rows={2}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100 resize-none"
                  />
                </div>
              </div>

              {/* Section Items Repeater */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Daftar Item Repeater ({secItems.length})
                  </h4>
                  <button
                    onClick={handleOpenItemAdd}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Item Baru
                  </button>
                </div>

                {/* Sub-item Form (Inline/Expandable) */}
                {showItemForm && (
                  <div className="p-4 border border-emerald-100 dark:border-emerald-950/20 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-2xl space-y-4">
                    <h5 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {selectedItemIndex !== null ? "Edit Item" : "Tambah Item"}
                    </h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Judul Item</label>
                        <input
                          type="text"
                          value={itemTitle}
                          onChange={(e) => setItemTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Sub-judul / Badge</label>
                        <input
                          type="text"
                          value={itemSubtitle}
                          onChange={(e) => setItemSubtitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Deskripsi Detail</label>
                      <textarea
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Nama Icon (Lucide)</label>
                        <input
                          type="text"
                          value={itemIcon}
                          onChange={(e) => setItemIcon(e.target.value)}
                          placeholder="e.g. Heart, Award..."
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Teks Link</label>
                        <input
                          type="text"
                          value={itemLinkText}
                          onChange={(e) => setItemLinkText(e.target.value)}
                          placeholder="e.g. Hubungi Kami..."
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">URL Link</label>
                        <input
                          type="text"
                          value={itemLinkUrl}
                          onChange={(e) => setItemLinkUrl(e.target.value)}
                          placeholder="e.g. /#contact..."
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    {/* Image selector */}
                    <div className="space-y-2">
                      <span className="block text-[11px] font-semibold text-zinc-500">Gambar Item</span>
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
                          className="px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-white dark:hover:bg-[#262626] transition-colors"
                        >
                          Pilih Gambar
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowItemForm(false)}
                        className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-white"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveItem}
                        className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                      >
                        Simpan ke Daftar
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-items list */}
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
                          className="p-1.5 text-zinc-500 hover:bg-white dark:hover:bg-[#333] rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-55/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex items-center justify-between">
              <button
                onClick={() => setEditSection(null)}
                className="px-4 py-2.5 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100"
              >
                Batal
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1 px-4 py-2.5 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-[#262626] rounded-xl text-zinc-700 dark:text-zinc-350"
                >
                  <Save className="w-4 h-4" />
                  Simpan sebagai Draf
                </button>
                <button
                  onClick={handlePublish}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl shadow"
                >
                  <Send className="w-4 h-4" />
                  Publikasikan Live
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-item Media selector modal */}
      <MediaSelectorModal
        open={mediaTarget !== null}
        onClose={() => setMediaTarget(null)}
        onSelect={setItemImage}
        selectedAssetId={itemImage?.id}
      />
    </div>
  );
}
