"use client";

import React, { useState, useEffect } from "react";
import { X, Upload, Search, Check, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";

interface Asset {
  id: string;
  url: string;
  alt: string;
  title?: string | null;
  caption?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
}

interface MediaSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  selectedAssetId?: string | null;
}

export default function MediaSelectorModal({
  open,
  onClose,
  onSelect,
  selectedAssetId,
}: MediaSelectorModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedAssetId || null);

  useEffect(() => {
    if (open) {
      fetchAssets();
      setLocalSelectedId(selectedAssetId || null);
    }
  }, [open, selectedAssetId]);

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
      notify.error("Terjadi kesalahan koneksi saat mengambil media.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      notify.error("Ukuran file tidak boleh melebihi 5MB.");
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
          setLocalSelectedId(json.data.id);
        } else {
          notify.error(json.message || "Gagal mengunggah gambar.");
        }
      } catch (err) {
        notify.dismiss(toastId);
        notify.error("Terjadi kesalahan saat mengunggah gambar.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelect = () => {
    const chosen = assets.find((a) => a.id === localSelectedId);
    if (chosen) {
      onSelect(chosen);
      onClose();
    } else {
      notify.warning("Silakan pilih salah satu media.");
    }
  };

  const filteredAssets = assets.filter((a) =>
    (a.alt || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.title || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-150 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Pilih Media</h3>
            <p className="text-xs text-zinc-500">Pilih file dari media library atau unggah baru.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#2c2c2e] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari media..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#2c2c2e] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
            />
          </div>

          <label className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-all hover:scale-[1.02]">
            <Upload className="w-4 h-4" />
            Unggah File Baru
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <span className="text-sm text-zinc-500">Memuat berkas media...</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-zinc-400">
              <Upload className="w-12 h-12 mb-3 stroke-1" />
              <p className="text-sm font-medium">Tidak ada berkas media ditemukan.</p>
              <p className="text-xs text-zinc-500 mt-1">Coba kata kunci lain atau unggah media baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => {
                const isSelected = asset.id === localSelectedId;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setLocalSelectedId(asset.id)}
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
                    
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                        <div className="p-1.5 bg-emerald-500 rounded-full text-white shadow">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      </div>
                    )}
                    
                    {/* Hover Info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {asset.alt || "no alt text"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#2c2c2e] text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSelect}
            disabled={!localSelectedId}
            className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            Pilih Media
          </button>
        </div>
      </div>
    </div>
  );
}
