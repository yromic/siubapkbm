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
import { toast } from "sonner";
import { fetchBankTPs as fetchBankTPsClient } from "@/lib/api/curriculumBankClient";

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

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setTps(
          initialTps.length > 0
            ? initialTps.map((t, idx) => ({
                ...t,
                tp_code: t.tp_code || `TP-${String(idx + 1).padStart(2, "0")}`,
                order_index: t.order_index ?? idx + 1,
              }))
            : []
        );
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
      toast.error("Gagal memuat Tujuan Pembelajaran dari Bank TP.");
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
    setActiveTab("LIST");
    toast.success(`${selectedItems.length} TP dari Bank diterapkan.`);
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
  };

  const handleUpdateTPText = (index: number, text: string) => {
    setTps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], tp_text_snapshot: text };
      return updated;
    });
  };

  const handleUpdateTPCode = (index: number, code: string) => {
    setTps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], tp_code: code };
      return updated;
    });
  };

  const handleRemoveTP = (index: number) => {
    setTps((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((t, i) => ({
        ...t,
        tp_code: t.tp_code || `TP-${String(i + 1).padStart(2, "0")}`,
        order_index: i + 1,
      }));
    });
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
      return updated.map((t, i) => ({ ...t, order_index: i + 1 }));
    });
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
        toast.error(json.message || "Gagal menghasilkan saran TP.");
        return;
      }

      const suggestions: string[] = json.data.saranTP;
      const isAi: boolean = json.data.source === "GEMINI";
      const newItems: ConfiguredTPItem[] = suggestions.map((text, idx) => ({
        tp_id: null,
        tp_code: `TP-${String(tps.length + idx + 1).padStart(2, "0")}`,
        tp_text_snapshot: text,
        source_type: isAi ? "AI_GENERATED" : "MANUAL",
        order_index: tps.length + idx + 1,
      }));

      setTps((prev) => [...prev, ...newItems]);
      setActiveTab("LIST");
      toast.success(`${newItems.length} rekomendasi TP ditambahkan${isAi ? " oleh AI" : " (kurikulum nasional)"}.`);
    } catch {
      toast.error("Gagal terhubung ke layanan AI.");
    } finally {
      setGeneratingAi(false);
    }
  };

  // Save to backend
  const handleSave = async () => {
    const validTps = tps.filter((t) => t.tp_text_snapshot.trim().length > 0);
    if (validTps.length === 0) {
      toast.error("Minimal tambahkan 1 Tujuan Pembelajaran (TP) untuk kelas ini.");
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
        toast.error(json.message || "Gagal menyimpan konfigurasi TP.");
        return;
      }

      toast.success("Konfigurasi Tujuan Pembelajaran berhasil disimpan!");
      onTpsSaved();
      onClose();
    } catch {
      toast.error("Terjadi kendala saat menyimpan TP.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b border-zinc-100 dark:border-zinc-800">
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                <div className="space-y-2">
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
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Contoh: Operasi hitung pecahan campuran dan soal cerita"
                  className="text-xs"
                />
              </div>

              <Button
                onClick={handleGenerateAI}
                disabled={generatingAi}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {generatingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Merumuskan TP...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Rumuskan Rekomendasi TP
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || tps.length === 0}
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
    </Dialog>
  );
}
