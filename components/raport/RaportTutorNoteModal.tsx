"use client";

import React, { useState, useEffect } from "react";
import { X, Save, MessageSquare } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                Catatan Tutor Pendamping
              </h3>
              <p className="text-xs text-gray-500">
                Santri: <span className="font-semibold text-gray-700">{studentName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Catatan Evaluasi / Narasi Perkembangan Umum Semester
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tuliskan catatan apresiasi, evaluasi, dan rekomendasi bimbingan untuk peserta didik selama satu semester ini..."
              rows={6}
              className="w-full text-xs p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Catatan ini akan dicetak pada Lembar 1 Raport Terpadu peserta didik.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Menyimpan..." : "Simpan Catatan"}
          </button>
        </div>
      </div>
    </div>
  );
}
