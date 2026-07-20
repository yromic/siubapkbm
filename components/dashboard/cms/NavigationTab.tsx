"use client";

import React, { useState, useEffect } from "react";
import { Plus, ArrowUp, ArrowDown, Trash2, Edit2, Save, Loader2, Link as LinkIcon } from "lucide-react";
import { notify } from "@/lib/notify";

interface NavigationLink {
  id?: string;
  label: string;
  url: string;
  sort_order: number;
  target: string;
  parent_id?: string | null;
  children?: NavigationLink[];
}

export default function NavigationTab() {
  const [activeMenu, setActiveMenu] = useState<"navbar" | "footer">("navbar");
  const [menuId, setMenuId] = useState("");
  const [links, setLinks] = useState<NavigationLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for adding/editing a link
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingParentIndex, setEditingParentIndex] = useState<number | null>(null); // For nested child links
  
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("_self");
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    fetchMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/navigation?menu=${activeMenu}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setMenuId(json.data.id);
        setLinks(json.data.links || []);
      } else {
        notify.error("Gagal mengambil data menu navigasi.");
      }
    } catch (err) {
      notify.error("Terjadi kesalahan saat memuat navigasi.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = (parentIdx: number | null = null) => {
    setEditingIndex(null);
    setEditingParentIndex(parentIdx);
    setLabel("");
    setUrl("");
    setTarget("_self");
    setParentId(parentIdx !== null && links[parentIdx] ? links[parentIdx].id || null : null);
    setShowModal(true);
  };

  const handleOpenEdit = (index: number, parentIdx: number | null = null) => {
    setEditingIndex(index);
    setEditingParentIndex(parentIdx);
    
    const targetLink = parentIdx !== null 
      ? links[parentIdx].children?.[index]
      : links[index];

    if (targetLink) {
      setLabel(targetLink.label);
      setUrl(targetLink.url);
      setTarget(targetLink.target);
      setParentId(targetLink.parent_id || null);
      setShowModal(true);
    }
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim()) {
      notify.error("Label dan URL wajib diisi.");
      return;
    }

    const newLink: NavigationLink = {
      label,
      url,
      target,
      sort_order: 0, // Assigned during submission or rendering
      parent_id: parentId,
      children: []
    };

    let updated = [...links];

    if (editingIndex !== null) {
      // Edit mode
      if (editingParentIndex !== null) {
        const parent = updated[editingParentIndex];
        if (parent.children) {
          parent.children[editingIndex] = {
            ...parent.children[editingIndex],
            label,
            url,
            target
          };
        }
      } else {
        updated[editingIndex] = {
          ...updated[editingIndex],
          label,
          url,
          target
        };
      }
    } else {
      // Add mode
      if (editingParentIndex !== null) {
        const parent = updated[editingParentIndex];
        if (!parent.children) parent.children = [];
        parent.children.push(newLink);
      } else {
        updated.push(newLink);
      }
    }

    // Refresh sort orders
    updated = assignSortOrders(updated);
    setLinks(updated);
    setShowModal(false);
    notify.success("Link berhasil diperbarui di daftar sementara.");
  };

  const assignSortOrders = (list: NavigationLink[]): NavigationLink[] => {
    return list.map((item, idx) => {
      const children = item.children ? item.children.map((c, cIdx) => ({
        ...c,
        sort_order: cIdx + 1
      })) : [];
      return {
        ...item,
        sort_order: idx + 1,
        children
      };
    });
  };

  const handleDeleteLink = (index: number, parentIdx: number | null = null) => {
    let updated = [...links];
    if (parentIdx !== null) {
      const parent = updated[parentIdx];
      if (parent.children) {
        parent.children.splice(index, 1);
      }
    } else {
      updated.splice(index, 1);
    }
    updated = assignSortOrders(updated);
    setLinks(updated);
    notify.success("Link dihapus dari daftar sementara.");
  };

  const handleMove = (index: number, direction: "up" | "down", parentIdx: number | null = null) => {
    let updated = [...links];
    if (parentIdx !== null) {
      const parent = updated[parentIdx];
      if (!parent.children) return;
      const targetList = [...parent.children];
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= targetList.length) return;

      const temp = targetList[index];
      targetList[index] = targetList[nextIndex];
      targetList[nextIndex] = temp;
      parent.children = targetList;
    } else {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= updated.length) return;

      const temp = updated[index];
      updated[index] = updated[nextIndex];
      updated[nextIndex] = temp;
    }
    updated = assignSortOrders(updated);
    setLinks(updated);
  };

  const handleSaveMenu = async () => {
    setSaving(true);
    const toastId = notify.loading("Menyimpan susunan menu navigasi...");
    try {
      const res = await fetch("/api/v1/admin/navigation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId,
          links
        })
      });

      const json = await res.json();
      notify.dismiss(toastId);

      if (res.ok) {
        notify.success("Menu navigasi berhasil disimpan.");
        fetchMenu(); // reload to get actual DB IDs
      } else {
        notify.error(json.message || "Gagal menyimpan menu.");
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error("Terjadi kesalahan koneksi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Selector & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveMenu("navbar")}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeMenu === "navbar"
                ? "bg-zinc-900 text-white dark:bg-emerald-600"
                : "border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            }`}
          >
            Navbar Navigation
          </button>
          <button
            onClick={() => setActiveMenu("footer")}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeMenu === "footer"
                ? "bg-zinc-900 text-white dark:bg-emerald-600"
                : "border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            }`}
          >
            Footer Links
          </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleOpenAdd(null)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300"
          >
            <Plus className="w-4 h-4" />
            Tambah Link Utama
          </button>
          <button
            onClick={handleSaveMenu}
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan Menu
          </button>
        </div>
      </div>

      {/* Links List */}
      <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <span>Memuat struktur menu...</span>
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <LinkIcon className="w-12 h-12 mb-3 stroke-1" />
            <p className="text-sm font-medium">Belum ada link navigasi.</p>
            <p className="text-xs text-zinc-500 mt-1">Klik "Tambah Link Utama" untuk membuat navigasi baru.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link, idx) => (
              <div key={idx} className="space-y-2">
                {/* Main Link Bar */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400 bg-white dark:bg-[#171717] px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{link.label}</h4>
                      <p className="text-xs text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-xs">{link.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {activeMenu === "navbar" && (
                      <button
                        onClick={() => handleOpenAdd(idx)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-650 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl"
                        title="Tambah Sub-link"
                      >
                        + Sub-link
                      </button>
                    )}
                    <button
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0}
                      className="p-1.5 text-zinc-450 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === links.length - 1}
                      className="p-1.5 text-zinc-450 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(idx, null)}
                      className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLink(idx, null)}
                      className="p-1.5 text-red-500 hover:bg-red-55/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-links List */}
                {link.children && link.children.length > 0 && (
                  <div className="pl-8 sm:pl-12 space-y-2 border-l-2 border-zinc-200 dark:border-zinc-800 ml-6">
                    {link.children.map((child, childIdx) => (
                      <div
                        key={childIdx}
                        className="flex items-center justify-between p-2.5 bg-zinc-50/50 dark:bg-[#262626]/50 border border-zinc-150 dark:border-zinc-800 rounded-xl"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{child.label}</h5>
                          <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[150px] sm:max-w-xs">{child.url}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMove(childIdx, "up", idx)}
                            disabled={childIdx === 0}
                            className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMove(childIdx, "down", idx)}
                            disabled={childIdx === (link.children?.length ?? 0) - 1}
                            className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(childIdx, idx)}
                            className="p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#333] rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLink(childIdx, idx)}
                            className="p-1 text-red-500 hover:bg-red-55/10 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
                {editingIndex !== null ? "Edit Link" : "Tambah Link Baru"}
              </h3>
            </div>

            <form onSubmit={handleSaveLink} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Label Menu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Contoh: Beranda, Tentang Kami..."
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  URL / Anchor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Contoh: /, #about, https://..."
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Target Window
                </label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                >
                  <option value="_self">Tab Saat Ini (_self)</option>
                  <option value="_blank">Tab Baru (_blank)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#2c2c2e] text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                >
                  Simpan Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
