"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Database,
  ArrowUp,
  ArrowDown,
  Check,
  BookOpen,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { fetchBankTPs as fetchBankTPsClient } from "@/lib/api/curriculumBankClient";
import { AIUsageStatus } from "@/components/ai/AIUsageStatus";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface ConfiguredTPItem {
  id?: string;
  tp_id?: string | null;
  tp_code?: string | null;
  tp_text_snapshot: string;
  source_type?: "TP_BANK" | "MANUAL" | "AI_GENERATED" | "LINKED_RPM";
  order_index?: number;
}

interface KKTPConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  fase: string;
  initialTps: ConfiguredTPItem[];
  onTpsSaved: () => void;
}

export function KKTPConfigModal({
  isOpen,
  onClose,
  assessmentId,
  subjectId,
  subjectName,
  className,
  fase,
  initialTps,
  onTpsSaved,
}: KKTPConfigModalProps) {
  // Helper to maintain clean, sequential, continuous TP numbers (TP-01, TP-02, ...)
  const renumberTps = (items: ConfiguredTPItem[]): ConfiguredTPItem[] => {
    return items.map((item, idx) => {
      const isAutoOrBlank = !item.tp_code || /^TP-\d+$/i.test(item.tp_code.trim());
      return {
        ...item,
        tp_code: isAutoOrBlank ? `TP-${String(idx + 1).padStart(2, "0")}` : item.tp_code,
        order_index: idx + 1,
      };
    });
  };

  const [tps, setTps] = useState<ConfiguredTPItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"LIST" | "BANK" | "AI">("LIST");

  // TP Bank state
  const [bankTps, setBankTps] = useState<any[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ teks: string; checked: boolean }>>([]);
  const [aiSource, setAiSource] = useState<"GEMINI" | "FALLBACK" | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // In-app ConfirmDialog states
  const [tpToDeleteIndex, setTpToDeleteIndex] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSafeClose = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setTps(
          initialTps.length > 0
            ? renumberTps(initialTps)
            : []
        );
        setIsDirty(false);
        setActiveTab("LIST");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTps]);

  // Load TP Bank
  const loadBankTPs = async () => {
    setLoadingBank(true);
    try {
      const data = await fetchBankTPsClient({
        mata_pelajaran_id: subjectId || undefined,
        fase: fase || "Fase C",
        limit: 100,
      });
      setBankTps(data.items || []);
      const existingBankTpIds = new Set(
        tps.map((t) => t.tp_id).filter(Boolean) as string[]
      );
      setSelectedBankIds(existingBankTpIds);
    } catch {
      notify.error("Gagal memuat Tujuan Pembelajaran dari Bank TP.");
    } finally {
      setLoadingBank(false);
    }
  };

  const handleOpenBank = () => {
    setActiveTab("BANK");
    loadBankTPs();
  };

  const handleToggleBankItem = (item: any) => {
    const next = new Set(selectedBankIds);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }
    setSelectedBankIds(next);
  };

  const handleApplyBankSelection = () => {
    const selectedItems = bankTps.filter((item) => selectedBankIds.has(item.id));
    const newTps: ConfiguredTPItem[] = selectedItems.map((item, idx) => {
      const existing = tps.find((t) => t.tp_id === item.id);
      return (
        existing || {
          tp_id: item.id,
          tp_code: item.kode || `TP-${String(tps.length + idx + 1).padStart(2, "0")}`,
          tp_text_snapshot: item.teks,
          source_type: "TP_BANK",
          order_index: tps.length + idx + 1,
        }
      );
    });

    // Keep manual TPs not from bank
    const manualTps = tps.filter((t) => !t.tp_id);
    const combined = [...newTps, ...manualTps].map((t, i) => ({
      ...t,
      tp_code: t.tp_code || `TP-${String(i + 1).padStart(2, "0")}`,
      order_index: i + 1,
    }));

    setTps(combined);
    setIsDirty(true);
    setActiveTab("LIST");
    notify.success(`${selectedItems.length} TP dari Bank diterapkan.`);
  };

  // Add Manual TP
  const handleAddManualTP = () => {
    const nextIndex = tps.length + 1;
    setTps((prev) => [
      ...prev,
      {
        tp_id: null,
        tp_code: `TP-${String(nextIndex).padStart(2, "0")}`,
        tp_text_snapshot: "",
        source_type: "MANUAL",
        order_index: nextIndex,
      },
    ]);
    setIsDirty(true);
  };

  const handleUpdateTPText = (index: number, text: string) => {
    setTps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], tp_text_snapshot: text };
      return updated;
    });
    setIsDirty(true);
  };

  const handleUpdateTPCode = (index: number, code: string) => {
    setTps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], tp_code: code };
      return updated;
    });
    setIsDirty(true);
  };

  const handleRemoveTP = (index: number) => {
    const targetTp = tps[index];
    if (!targetTp) return;

    // If it's already saved on the server (has id), prompt with ConfirmDialog
    if (targetTp.id) {
      setTpToDeleteIndex(index);
    } else {
      // Unsaved / draft TP, delete immediately
      setTps((prev) => renumberTps(prev.filter((_, i) => i !== index)));
      setIsDirty(true);
      notify.info("TP dihapus dari daftar.");
    }
  };

  const handleConfirmDelete = () => {
    if (tpToDeleteIndex === null) return;
    const deletedTp = tps[tpToDeleteIndex];
    setTps((prev) => renumberTps(prev.filter((_, i) => i !== tpToDeleteIndex)));
    setIsDirty(true);
    setTpToDeleteIndex(null);
    notify.success(`"${deletedTp?.tp_code || "TP"}" dihapus. Klik "Simpan Konfigurasi TP" untuk menerapkan ke matriks.`);
  };

  const handleMoveTP = (index: number, direction: "UP" | "DOWN") => {
    if (
      (direction === "UP" && index === 0) ||
      (direction === "DOWN" && index === tps.length - 1)
    )
      return;

    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    setTps((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return renumberTps(updated);
    });
    setIsDirty(true);
  };

  // AI Generator
  const handleGenerateAI = async () => {
    setGeneratingAi(true);
    try {
      const res = await fetch("/api/v1/kktp/generate-tp-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mataPelajaran: subjectName,
          tingkatFase: fase,
          topikMateri: aiPrompt.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data?.saranTP)) {
        notify.error(json.message || "Gagal menghasilkan saran TP.");
        return;
      }

      const suggestions: string[] = json.data.saranTP;
      const isAi: boolean = json.data.source === "GEMINI";
      setAiSource(isAi ? "GEMINI" : "FALLBACK");
      setAiSuggestions(suggestions.map((text) => ({ teks: text, checked: true })));
      notify.success(`${suggestions.length} saran TP berhasil dirumuskan oleh AI. Silakan tinjau dan terapkan.`);
    } catch {
      notify.error("Gagal terhubung ke layanan AI.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleToggleAiSuggestion = (index: number) => {
    setAiSuggestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleApplyAiSuggestions = () => {
    const selected = aiSuggestions.filter((t) => t.checked && t.teks.trim().length > 0);
    if (selected.length === 0) {
      notify.error("Pilih minimal 1 saran TP dari AI.");
      return;
    }

    const isAi = aiSource === "GEMINI";
    const newItems: ConfiguredTPItem[] = selected.map((item, idx) => ({
      tp_id: null,
      tp_code: `TP-${String(tps.length + idx + 1).padStart(2, "0")}`,
      tp_text_snapshot: item.teks,
      source_type: isAi ? "AI_GENERATED" : "MANUAL",
      order_index: tps.length + idx + 1,
    }));

    setTps((prev) => [...prev, ...newItems]);
    setIsDirty(true);
    setActiveTab("LIST");
    notify.success(`${newItems.length} saran TP dari AI berhasil diterapkan ke daftar.`);
  };

  // Save to backend
  const handleSave = async (forceEmpty = false) => {
    const validTps = tps.filter((t) => t.tp_text_snapshot.trim().length > 0);
    if (validTps.length === 0 && !forceEmpty) {
      if (tps.length === 0) {
        setShowClearConfirm(true);
        return;
      }
      notify.error("Teks Tujuan Pembelajaran tidak boleh kosong.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/kktp/assessments/${assessmentId}/tps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validTps),
      });
      const json = await res.json();
      if (!json.success) {
        notify.error(json.message || "Gagal menyimpan konfigurasi TP.");
        return;
      }

      setIsDirty(false);
      setShowClearConfirm(false);
      notify.success("Konfigurasi Tujuan Pembelajaran berhasil disimpan!");
      onTpsSaved();
      onClose();
    } catch {
      notify.error("Terjadi kendala saat menyimpan TP.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSafeClose()}>
      <DialogContent
        className="max-w-3xl h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 shadow-2xl"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isDirty) {
            e.preventDefault();
            handleSafeClose();
          }
        }}
      >
        <DialogHeader className="p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Kelola Tujuan Pembelajaran (TP)
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-1">
                {subjectName} • {className} ({fase}) — Dikonfigurasi 1× untuk seluruh murid
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("LIST")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === "LIST"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Daftar TP ({tps.length})
              </button>
              <button
                type="button"
                onClick={handleOpenBank}
                className={`px-3 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                  activeTab === "BANK"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                <Database className="w-3.5 h-3.5 text-blue-500" />
                Bank TP
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("AI")}
                className={`px-3 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                  activeTab === "AI"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Saran AI
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
          {/* TAB 1: LIST */}
          {activeTab === "LIST" && (
            <div className="space-y-3">
              {tps.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
                  <BookOpen className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Belum ada TP yang dikonfigurasi
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                    Gunakan Bank TP untuk mengambil kurikulum resmi, buat manual, atau minta rekomendasi AI.
                  </p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={handleOpenBank}>
                      <Database className="w-3.5 h-3.5 mr-1 text-blue-500" />
                      Pilih dari Bank TP
                    </Button>
                    <Button size="sm" onClick={handleAddManualTP}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Tambah Manual
                    </Button>
                  </div>
                </div>
              ) : (
                tps.map((tp, idx) => (
                  <div
                    key={tp.id || `tp-${idx}`}
                    className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={tp.tp_code || ""}
                          onChange={(e) => handleUpdateTPCode(idx, e.target.value)}
                          placeholder="Kode"
                          className="w-24 h-7 text-xs font-semibold uppercase bg-zinc-50 dark:bg-zinc-800"
                        />
                        <span className="text-[10px] font-medium text-zinc-500 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                          {tp.source_type === "TP_BANK"
                            ? "Bank TP"
                            : tp.source_type === "AI_GENERATED"
                            ? "AI"
                            : "Manual"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleMoveTP(idx, "UP")}
                          disabled={idx === 0}
                          title="Pindah ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleMoveTP(idx, "DOWN")}
                          disabled={idx === tps.length - 1}
                          title="Pindah ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRemoveTP(idx)}
                          title="Hapus TP"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      rows={2}
                      value={tp.tp_text_snapshot}
                      onChange={(e) => handleUpdateTPText(idx, e.target.value)}
                      placeholder="Rumusan Tujuan Pembelajaran..."
                      className="text-xs resize-none"
                    />
                  </div>
                ))
              )}

              {tps.length > 0 && (
                <div className="flex justify-between items-center pt-2">
                  <Button size="sm" variant="outline" onClick={handleAddManualTP}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tambah TP Lain
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleOpenBank}>
                    <Database className="w-3.5 h-3.5 mr-1 text-blue-500" />
                    Ambil dari Bank TP
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BANK TP */}
          {activeTab === "BANK" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900 text-xs">
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-300">
                    Bank Tujuan Pembelajaran Resmi BLC
                  </p>
                  <p className="text-blue-700 dark:text-blue-400 mt-0.5">
                    Memfilter TP untuk mapel: <strong>{subjectName}</strong> ({fase})
                  </p>
                </div>
                <Button size="sm" onClick={handleApplyBankSelection} className="bg-blue-600 hover:bg-blue-700">
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Terapkan ({selectedBankIds.size})
                </Button>
              </div>

              {loadingBank ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : bankTps.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500 border border-dashed rounded-lg">
                  Tidak ada TP di Bank untuk mata pelajaran dan fase ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                  {bankTps.map((item) => {
                    const isSelected = selectedBankIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleBankItem(item)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600"
                        />
                        <div className="flex-1 text-xs">
                          {item.kode && (
                            <span className="font-bold text-blue-700 dark:text-blue-400 mr-2">
                              {item.kode}
                            </span>
                          )}
                          <span className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                            {item.teks}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI GENERATOR */}
          {activeTab === "AI" && (
            <div className="space-y-4">
              {/* AI Quota Status Check */}
              <AIUsageStatus className="mb-1" />

              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
                <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Rekomendasi Tujuan Pembelajaran Berbasis AI (Gemini)
                </div>
                <p className="text-amber-700 dark:text-amber-400">
                  AI akan merumuskan TP sesuai Taksonomi Marzano dan Capaian Pembelajaran Kurikulum Merdeka untuk {fase}.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 block">
                  Fokus Topik / Bab Materi (Opsional)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !generatingAi) {
                        e.preventDefault();
                        handleGenerateAI();
                      }
                    }}
                    placeholder="Contoh: Operasi hitung pecahan campuran dan soal cerita"
                    className="text-xs flex-1"
                  />
                  <Button
                    onClick={handleGenerateAI}
                    disabled={generatingAi}
                    className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs"
                  >
                    {generatingAi ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Merumuskan...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        Rumuskan TP
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* AI Suggestions Checklist */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-amber-600" />
                      Rekomendasi AI ({aiSuggestions.filter((s) => s.checked).length} dari {aiSuggestions.length} terpilih)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = aiSuggestions.every((s) => s.checked);
                        setAiSuggestions((prev) => prev.map((s) => ({ ...s, checked: !allChecked })));
                      }}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium"
                    >
                      {aiSuggestions.every((s) => s.checked) ? "Batal Pilih Semua" : "Pilih Semua"}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {aiSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleAiSuggestion(idx)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                          item.checked
                            ? "bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed flex-1">
                          {item.teks}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiSuggestions((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-zinc-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                          title="Hapus saran ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleApplyAiSuggestions}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Terapkan TP Terpilih ({aiSuggestions.filter((s) => s.checked).length}) ke Daftar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center sm:justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={handleSafeClose} disabled={saving}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Konfigurasi TP"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog: Delete TP */}
      <ConfirmDialog
        open={tpToDeleteIndex !== null}
        onOpenChange={(open) => !open && setTpToDeleteIndex(null)}
        title="Hapus Tujuan Pembelajaran?"
        description={`Apakah Anda yakin ingin menghapus "${tps[tpToDeleteIndex ?? 0]?.tp_code || "TP ini"}"? Menghapus TP yang telah tersimpan dapat menghapus data nilai murid yang telah diinput pada TP ini saat konfigurasi disimpan.`}
        confirmLabel="Ya, Hapus TP"
        cancelLabel="Batal"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      {/* Confirmation Dialog: Unsaved changes on modal close */}
      <ConfirmDialog
        open={showCloseConfirm}
        onOpenChange={setShowCloseConfirm}
        title="Batalkan Perubahan?"
        description="Perubahan konfigurasi TP yang belum disimpan akan hilang. Apakah Anda yakin ingin keluar?"
        confirmLabel="Ya, Batalkan"
        cancelLabel="Lanjut Mengedit"
        variant="destructive"
        onConfirm={() => {
          setIsDirty(false);
          setShowCloseConfirm(false);
          onClose();
        }}
      />

      {/* Confirmation Dialog: Clear All TPs */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Kosongkan Seluruh TP?"
        description="Menyimpan dengan 0 TP akan menghapus seluruh Tujuan Pembelajaran pada asesmen kelas ini dan mereset nilai murid ke status DRAFT. Apakah Anda yakin ingin melanjutkan?"
        confirmLabel="Ya, Kosongkan & Reset"
        cancelLabel="Batal"
        variant="destructive"
        onConfirm={() => handleSave(true)}
      />
    </Dialog>
  );
}
