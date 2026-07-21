"use client";

import React, { useState, useEffect } from "react";
import { Image as ImageIcon, Save, Loader2, Globe } from "lucide-react";
import MediaSelectorModal from "./MediaSelectorModal";

interface Asset {
  id: string;
  url: string;
  alt: string;
}

interface WebsiteConfig {
  seo_defaults: any;
}

interface SEOTabProps {
  config: WebsiteConfig;
  onUpdate: (data: Partial<WebsiteConfig>) => Promise<void>;
  setIsDirty?: (dirty: boolean) => void;
}

export default function SEOTab({ config, onUpdate, setIsDirty }: SEOTabProps) {
  const seo = config.seo_defaults || {};
  const [canonicalUrl, setCanonicalUrl] = useState(seo.canonical_base_url || "https://siuba.sch.id");
  const [description, setDescription] = useState(seo.default_description || "");
  const [keywords, setKeywords] = useState(
    Array.isArray(seo.default_keywords) ? seo.default_keywords.join(", ") : ""
  );
  
  // OG Image URL (can be an absolute URL or relative path)
  const [ogImage, setOgImage] = useState(seo.default_og_image || "");
  
  // Robots crawl rules
  const rules = seo.robots_rules || { allowRules: ["/"], disallowRules: [] };
  const [disallowText, setDisallowText] = useState(
    Array.isArray(rules.disallowRules) ? rules.disallowRules.join("\n") : ""
  );

  const [saving, setSaving] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);

  useEffect(() => {
    const defaultKeywordsArray = Array.isArray(seo.default_keywords) ? seo.default_keywords.join(", ") : "";
    const defaultDisallowRules = Array.isArray(rules.disallowRules) ? rules.disallowRules.join("\n") : "";

    const isCanonicalChanged = canonicalUrl !== (seo.canonical_base_url || "https://siuba.sch.id");
    const isDescChanged = description !== (seo.default_description || "");
    const isKeywordsChanged = keywords !== defaultKeywordsArray;
    const isOgImageChanged = ogImage !== (seo.default_og_image || "");
    const isDisallowChanged = disallowText !== defaultDisallowRules;

    const dirty = isCanonicalChanged || isDescChanged || isKeywordsChanged || isOgImageChanged || isDisallowChanged;

    if (setIsDirty) {
      setIsDirty(dirty);
    }
  }, [canonicalUrl, description, keywords, ogImage, disallowText, seo, rules, setIsDirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Parse keywords comma-separated string back to array
    const keywordsArray = keywords
      .split(",")
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0);

    // Parse robots.txt disallow rules line-separated string back to array
    const disallowArray = disallowText
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    try {
      await onUpdate({
        seo_defaults: {
          canonical_base_url: canonicalUrl,
          default_description: description,
          default_keywords: keywordsArray,
          default_og_image: ogImage,
          robots_rules: {
            allowRules: rules.allowRules || ["/"],
            disallowRules: disallowArray
          }
        }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMedia = (asset: Asset) => {
    setOgImage(asset.url);
    setShowMediaModal(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Columns - Meta Configuration */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-500" />
              SEO & Metadata default
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Canonical Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  placeholder="Contoh: https://siuba.sch.id"
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Deskripsi Default (Meta Description) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Isi deskripsi singkat untuk dibaca Google..."
                  required
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Keywords default (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Contoh: siuba, paket a, sekolah alternatif"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Search Crawler Directives (robots.txt rules) */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2">
              Aturan Crawler (robots.txt Disallow Rules)
            </h3>
            <p className="text-xs text-zinc-500">
              Isi jalur folder/halaman (satu per baris) yang dilarang dirayap oleh mesin pencari.
            </p>
            <div>
              <textarea
                value={disallowText}
                onChange={(e) => setDisallowText(e.target.value)}
                placeholder="Contoh:&#10;/dashboard/&#10;/portal/&#10;/api/"
                rows={5}
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100 resize-none font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Right Column - OG Preview Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">
              Social OG Image (Gambar Berbagi)
            </h3>
            <p className="text-xs text-zinc-500">
              Gambar default yang akan muncul saat link sekolah dibagikan di media sosial (WhatsApp, Facebook, Twitter).
            </p>

            <div className="space-y-3">
              <div className="aspect-video w-full rounded-2xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                {ogImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ogImage} alt="OG Default Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-zinc-400" />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1">
                  URL / Path Gambar
                </label>
                <input
                  type="text"
                  value={ogImage}
                  onChange={(e) => setOgImage(e.target.value)}
                  placeholder="URL gambar..."
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMediaModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  Pilih dari Media Library
                </button>
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
          className="flex items-center gap-2 px-6 py-3 bg-zinc-950 hover:bg-zinc-850 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
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
        open={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onSelect={handleSelectMedia}
      />
    </form>
  );
}
