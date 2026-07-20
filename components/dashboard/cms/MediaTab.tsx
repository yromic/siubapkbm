"use client";

import React, { useState, useEffect } from "react";
import { Upload, Search, Trash2, Save, Loader2, Image as ImageIcon } from "lucide-react";
import { notify } from "@/lib/notify";

interface Asset {
  id: string;
  url: string;
  alt: string;
  title?: string | null;
  caption?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at?: string;
}

export default function MediaTab() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form states for metadata editor
  const [alt, setAlt] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/assets");
      const json = await res.json();
      if (res.ok && json.data) {
        setAssets(json.data);
      } else {
        notify.error(json.message || "Gagal mengambil data media.");
      }
    } catch (err) {
      notify.error("Terjadi kesalahan saat menghubungi API media.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (asset: Asset) => {
    setSelectedAsset(asset);
    setAlt(asset.alt || "");
    setTitle(asset.title || "");
    setCaption(asset.caption || "");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify.error("Ukuran file melebihi 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setUploading(true);
      const toastId = notify.loading("Mengunggah gambar...");

      try {
        const res = await fetch("/api/v1/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            base64,
            alt: file.name.split(".")[0],
          }),
        });

        const json = await res.json();
        notify.dismiss(toastId);

        if (res.ok && json.data) {
          notify.success("Gambar berhasil diunggah.");
          setAssets((prev) => [json.data, ...prev]);
          handleSelect(json.data);
        } else {
          notify.error(json.message || "Gagal mengunggah gambar.");
        }
      } catch (err) {
        notify.dismiss(toastId);
        notify.error("Terjadi kesalahan koneksi saat mengunggah.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    if (!alt.trim()) {
      notify.error("Alt Text wajib diisi untuk optimalisasi SEO.");
      return;
    }

    setSavingMeta(true);
    try {
      const res = await fetch("/api/v1/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedAsset.id,
          alt,
          title: title || null,
          caption: caption || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        notify.success("Metadata berhasil disimpan.");
        setAssets((prev) =>
          prev.map((a) => (a.id === selectedAsset.id ? json.data : a))
        );
        setSelectedAsset(json.data);
      } else {
        notify.error(json.message || "Gagal menyimpan metadata.");
      }
    } catch (err) {
      notify.error("Terjadi kesalahan saat menyimpan metadata.");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;

    const confirmed = window.confirm(
      "Apakah Anda yakin ingin menghapus media ini secara permanen? Tindakan ini tidak dapat dibatalkan."
    );
    if (!confirmed) return;

    const toastId = notify.loading("Menghapus media...");
    try {
      const res = await fetch(`/api/v1/assets?id=${selectedAsset.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      notify.dismiss(toastId);

      if (res.ok) {
        notify.success("Media berhasil dihapus.");
        setAssets((prev) => prev.filter((a) => a.id !== selectedAsset.id));
        setSelectedAsset(null);
      } else {
        notify.error(json.message || "Gagal menghapus media. Media mungkin masih digunakan pada landing page.");
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error("Terjadi kesalahan saat menghapus media.");
    }
  };

  const filteredAssets = assets.filter((a) =>
    (a.alt || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-210px)] overflow-hidden">
      {/* Library Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center mb-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari media..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
            />
          </div>

          <label className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50">
            <Upload className="w-4 h-4" />
            Unggah File
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Media Grid Wrapper */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <span className="text-sm text-zinc-500">Memuat media library...</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-zinc-400">
              <ImageIcon className="w-12 h-12 mb-3 stroke-1" />
              <p className="text-sm font-medium">Katalog media kosong.</p>
              <p className="text-xs text-zinc-500 mt-1">Gunakan tombol "Unggah File" untuk menambahkan media baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => handleSelect(asset)}
                    className={`group relative aspect-square border-2 rounded-2xl overflow-hidden cursor-pointer bg-zinc-50 dark:bg-zinc-900 transition-all ${
                      isSelected
                        ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.alt || "media image"}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {asset.alt || "no alt text"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 overflow-y-auto">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-4">
          Detail Media
        </h4>

        {selectedAsset ? (
          <div className="space-y-5">
            {/* Visual Preview */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedAsset.url}
                alt={selectedAsset.alt || "preview"}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Read-Only Stats */}
            <div className="space-y-1 bg-zinc-50 dark:bg-[#262626] p-3 rounded-2xl text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Format:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-250 truncate max-w-[150px]">
                  {selectedAsset.mime_type || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ukuran:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-250">
                  {formatBytes(selectedAsset.size_bytes)}
                </span>
              </div>
              <div className="flex justify-between truncate">
                <span>Path URL:</span>
                <a
                  href={selectedAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-600 hover:underline truncate max-w-[150px]"
                >
                  {selectedAsset.url}
                </a>
              </div>
            </div>

            {/* Editable Fields */}
            <form onSubmit={handleSaveMetadata} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Alt Text (SEO) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Keterangan gambar untuk dibaca Google..."
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-150"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Judul Aset
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Opsional judul media..."
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-150"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Keterangan (Caption)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Opsional deskripsi/keterangan..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-150 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingMeta}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-all disabled:opacity-50"
                >
                  {savingMeta ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Simpan Meta
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2.5 text-red-500 border border-red-200 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/20 rounded-xl transition-all"
                  title="Hapus Media"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 py-12">
            <ImageIcon className="w-10 h-10 mb-2 stroke-1" />
            <p className="text-xs">Klik salah satu media di pustaka untuk mengedit detailnya.</p>
          </div>
        )}
      </div>
    </div>
  );
}
