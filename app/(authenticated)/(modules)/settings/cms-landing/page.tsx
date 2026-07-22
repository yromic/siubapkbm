"use client";

import React, { useState, useEffect } from "react";
import { Layout, Globe, PhoneCall, ListCollapse, Layers, FolderHeart, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { humanizeError } from "@/lib/utils/ui-error";

type TabType = "branding" | "contact" | "navigation" | "sections" | "media" | "seo";

// Sub-components
import BrandingTab from "@/components/dashboard/cms/BrandingTab";
import ContactTab from "@/components/dashboard/cms/ContactTab";
import NavigationTab from "@/components/dashboard/cms/NavigationTab";
import SectionsTab from "@/components/dashboard/cms/SectionsTab";
import MediaTab from "@/components/dashboard/cms/MediaTab";
import SEOTab from "@/components/dashboard/cms/SEOTab";

export default function CMSLandingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("branding");
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const handleTabChange = (tab: TabType) => {
    if (isDirty) {
      setPendingTab(tab);
      setUnsavedModalOpen(true);
      return;
    }
    setActiveTab(tab);
    setIsDirty(false);
  };

  const handleConfirmTabSwitch = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    setIsDirty(false);
    setUnsavedModalOpen(false);
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/v1/config");
      const json = await res.json();
      if (res.ok && json.data) {
        setConfig(json.data);
      } else {
        notify.error("Gagal memuat konfigurasi website.");
      }
    } catch (err) {
      notify.error(humanizeError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (updatedData: any) => {
    const toastId = notify.loading("Menyimpan konfigurasi...");
    try {
      const res = await fetch("/api/v1/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      const json = await res.json();
      notify.dismiss(toastId);

      if (res.ok && json.data) {
        notify.success("Konfigurasi website berhasil disimpan.");
        setConfig(json.data);
        setIsDirty(false);
      } else {
        notify.error(humanizeError(json.message || "Gagal menyimpan konfigurasi."));
      }
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(humanizeError(err));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <span className="text-sm font-medium text-zinc-550 dark:text-zinc-400">
          Memuat Workspace CMS...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-[#468432] dark:text-emerald-450 rounded-xl">
            <Layout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Kelola Landing Page
          </h1>
        </div>
        <p className="text-sm text-zinc-500 pl-1">
          Pusat konfigurasi visual, menu navigasi, identitas sekolah, tata letak seksi, dan katalog media website.
        </p>
      </div>

      {/* Workspace Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-850 pb-px overflow-x-auto select-none no-scrollbar">
        <button
          onClick={() => handleTabChange("branding")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "branding"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Globe className="w-4 h-4" />
          Branding & Identitas
        </button>

        <button
          onClick={() => handleTabChange("contact")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "contact"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          Kontak & Lokasi
        </button>

        <button
          onClick={() => handleTabChange("navigation")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "navigation"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <ListCollapse className="w-4 h-4" />
          Menu Navigasi
        </button>

        <button
          onClick={() => handleTabChange("sections")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "sections"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          Page Sections
        </button>

        <button
          onClick={() => handleTabChange("media")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "media"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <FolderHeart className="w-4 h-4" />
          Media Library
        </button>

        <button
          onClick={() => handleTabChange("seo")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "seo"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Globe className="w-4 h-4" />
          SEO & Metadata
        </button>
      </div>

      {/* Tab Workspaces */}
      <div className="flex-1 min-h-0 pt-2">
        {activeTab === "branding" && config && (
          <BrandingTab config={config} onUpdate={handleUpdateConfig} setIsDirty={setIsDirty} />
        )}
        {activeTab === "contact" && config && (
          <ContactTab config={config} onUpdate={handleUpdateConfig} setIsDirty={setIsDirty} />
        )}
        {activeTab === "navigation" && (
          <NavigationTab />
        )}
        {activeTab === "sections" && config && (
          <SectionsTab config={config} onUpdateConfig={handleUpdateConfig} />
        )}
        {activeTab === "media" && (
          <MediaTab />
        )}
        {activeTab === "seo" && config && (
          <SEOTab config={config} onUpdate={handleUpdateConfig} setIsDirty={setIsDirty} />
        )}
      </div>

      <ConfirmDialog
        open={unsavedModalOpen}
        onClose={() => {
          setUnsavedModalOpen(false);
          setPendingTab(null);
        }}
        onConfirm={handleConfirmTabSwitch}
        title="Tinggalkan Halaman dengan Perubahan Belum Disimpan?"
        description="Perubahan pada tab ini akan hilang jika Anda berpindah tab tanpa menyimpan."
        confirmText="Tetap Pindah"
        cancelText="Batal"
        variant="warning"
      />
    </div>
  );
}
