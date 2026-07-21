"use client";

import React, { useState, useEffect } from "react";
import { Image as ImageIcon, Save, Loader2, RefreshCw } from "lucide-react";
import MediaSelectorModal from "./MediaSelectorModal";

interface Asset {
  id: string;
  url: string;
  alt: string;
}

interface WebsiteConfig {
  school_name: string;
  short_name: string;
  tagline: string;
  logo_id?: string | null;
  favicon_id?: string | null;
  principal_name: string;
  principal_title: string;
  principal_greeting: string;
  principal_photo_id?: string | null;
  theme_branding: any;
  logo?: Asset | null;
  favicon?: Asset | null;
  principal_photo?: Asset | null;
}

interface BrandingTabProps {
  config: WebsiteConfig;
  onUpdate: (data: Partial<WebsiteConfig>) => Promise<void>;
  setIsDirty?: (dirty: boolean) => void;
}

export default function BrandingTab({ config, onUpdate, setIsDirty }: BrandingTabProps) {
  const [schoolName, setSchoolName] = useState(config.school_name || "");
  const [shortName, setShortName] = useState(config.short_name || "");
  const [tagline, setTagline] = useState(config.tagline || "");
  
  // Theme branding
  const theme = config.theme_branding || {};
  const [primaryColor, setPrimaryColor] = useState(theme.primary_color || "#10b981");
  const [secondaryColor, setSecondaryColor] = useState(theme.secondary_color || "#065f46");
  const [brandFont, setBrandFont] = useState(theme.brand_font || "plus-jakarta");

  // Media references
  const [logo, setLogo] = useState<Asset | null>(config.logo || null);
  const [favicon, setFavicon] = useState<Asset | null>(config.favicon || null);

  // Modal control
  const [mediaTarget, setMediaTarget] = useState<"logo" | "favicon" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const isNameChanged = schoolName !== (config.school_name || "");
    const isShortChanged = shortName !== (config.short_name || "");
    const isTaglineChanged = tagline !== (config.tagline || "");
    const isPrimaryChanged = primaryColor !== (theme.primary_color || "#10b981");
    const isSecondaryChanged = secondaryColor !== (theme.secondary_color || "#065f46");
    const isFontChanged = brandFont !== (theme.brand_font || "plus-jakarta");
    const isLogoChanged = (logo?.id || null) !== (config.logo_id || null);
    const isFaviconChanged = (favicon?.id || null) !== (config.favicon_id || null);

    const dirty = isNameChanged || isShortChanged || isTaglineChanged || isPrimaryChanged || isSecondaryChanged || isFontChanged || isLogoChanged || isFaviconChanged;
    
    if (setIsDirty) {
      setIsDirty(dirty);
    }
  }, [schoolName, shortName, tagline, primaryColor, secondaryColor, brandFont, logo, favicon, config, theme.primary_color, theme.secondary_color, theme.brand_font, setIsDirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate({
        school_name: schoolName,
        short_name: shortName,
        tagline: tagline,
        logo_id: logo?.id || null,
        favicon_id: favicon?.id || null,
        theme_branding: {
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          brand_font: brandFont,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMedia = (asset: Asset) => {
    if (mediaTarget === "logo") setLogo(asset);
    if (mediaTarget === "favicon") setFavicon(asset);
    setMediaTarget(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Core Slogan & Identity */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2">
              Identitas Sekolah & Slogan
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-450 mb-1.5">
                  Nama Resmi Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-450 mb-1.5">
                    Nama Singkat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-450 mb-1.5">
                    Font Utama
                  </label>
                  <select
                    value={brandFont}
                    onChange={(e) => setBrandFont(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                  >
                    <option value="plus-jakarta">Plus Jakarta Sans</option>
                    <option value="inter">Inter</option>
                    <option value="outfit">Outfit</option>
                    <option value="roboto">Roboto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-450 mb-1.5">
                  Tagline / Slogan Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Principal Welcome Section */}
        </div>

        {/* Right Column - Media & Theme Colors */}
        <div className="space-y-6">
          {/* Logo & Favicon Picker */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
              Visual & Media
            </h3>

            {/* Main Logo */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455">Logo Sekolah</span>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMediaTarget("logo")}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Pilih Logo
                </button>
              </div>
            </div>

            {/* Favicon */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455">Favicon</span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={favicon.url} alt="Favicon" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMediaTarget("favicon")}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Pilih Favicon
                </button>
              </div>
            </div>
          </div>

          {/* Theme Color Picker */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2">
              Warna Tema Branding
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455">Warna Utama</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer"
                  />
                  <span className="text-xs font-mono">{primaryColor}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455">Warna Sekunder</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer"
                  />
                  <span className="text-xs font-mono">{secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-zinc-950 hover:bg-zinc-850 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Simpan Semua Perubahan
        </button>
      </div>

      <MediaSelectorModal
        open={mediaTarget !== null}
        onClose={() => setMediaTarget(null)}
        onSelect={handleSelectMedia}
        selectedAssetId={
          mediaTarget === "logo"
            ? logo?.id
            : mediaTarget === "favicon"
            ? favicon?.id
            : undefined
        }
      />
    </form>
  );
}
