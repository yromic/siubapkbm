"use client";

import React, { useState, useEffect } from "react";
import { X, Save, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/notify";

interface RaportTutorNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  academicYearId: string;
  semesterId: string;
  initialContent?: string;
  onSaved: (newContent: string) => void;
}

export function RaportTutorNoteModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  academicYearId,
  semesterId,
  initialContent = "",
  onSaved,
}: RaportTutorNoteModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(initialContent || "");
  }, [initialContent, isOpen]);

  if (!isOpen) return null;

  const handleSafeClose = () => {
    if (content !== (initialContent || "")) {
      if (window.confirm("Batalkan perubahan catatan? Catatan yang belum disimpan akan hilang.")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/v1/raport/tutor-note", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          academic_year_id: academicYearId,
          semester_id: semesterId,
          content,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Gagal menyimpan catatan tutor.");
      }

      notify.success("Catatan tutor pendamping berhasil disimpan.");
      onSaved(content);
      onClose();
    } catch (err: any) {
      notify.error(err.message || "Terjadi kesalahan saat menyimpan catatan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Catatan Tutor Pendamping
              </h3>
              <p className="text-xs text-zinc-500">
                Santri: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{studentName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Catatan Evaluasi / Narasi Perkembangan Umum Semester
              </label>
              <span className="text-[11px] text-zinc-400">
                {content.length} karakter
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tuliskan catatan apresiasi, evaluasi, dan rekomendasi bimbingan untuk peserta didik selama satu semester ini..."
              rows={6}
              className="text-xs leading-relaxed"
            />
            <p className="text-[11px] text-zinc-400 mt-1.5">
              Catatan ini akan dicetak pada Lembar 1 Raport Terpadu santri.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSafeClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {isSaving ? "Menyimpan..." : "Simpan Catatan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
