"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  UtsmanDimensionCode,
  UTSMAN_DIMENSIONS_CONFIG,
} from "./utsman-radar-chart";
import {
  getSahabatBreakdownApi,
  getFitrahSummaryApi,
  SahabatBreakdownRecord,
  FitrahSummaryRecord,
} from "@/lib/api/character";

interface UtsmanDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  studentId: string;
  studentName: string;
  semesterId: string;
  dimensionCode: UtsmanDimensionCode | null;
  utsmanScore: number | null;
}

export function UtsmanDrilldownModal({
  open,
  onOpenChange,
  token,
  studentId,
  studentName,
  semesterId,
  dimensionCode,
  utsmanScore,
}: UtsmanDrilldownModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sahabatData, setSahabatData] = useState<SahabatBreakdownRecord | null>(null);
  const [fitrahData, setFitrahData] = useState<FitrahSummaryRecord | null>(null);

  useEffect(() => {
    if (!open || !dimensionCode || !studentId || !semesterId || !token) return;

    async function loadDrilldownData() {
      setLoading(true);
      setError(null);
      try {
        const [sahabatRes, fitrahRes] = await Promise.all([
          getSahabatBreakdownApi(token, { studentId, semesterId, profile: dimensionCode! }),
          getFitrahSummaryApi(token, { studentId, semesterId }),
        ]);

        setSahabatData(sahabatRes);
        setFitrahData(fitrahRes);
      } catch (err: any) {
        setError(err?.message || "Gagal memuat detail drill-down dimensi.");
      } finally {
        setLoading(false);
      }
    }

    loadDrilldownData();
  }, [open, dimensionCode, studentId, semesterId, token]);

  if (!dimensionCode) return null;

  const config = UTSMAN_DIMENSIONS_CONFIG[dimensionCode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold font-fredoka flex items-center justify-center text-sm">
              {dimensionCode}
            </span>
            <div>
              <DialogTitle className="text-base font-bold font-plus-jakarta">
                {config.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Detail kontributor untuk {studentName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs text-zinc-500">Memuat breakdown SAHABAT & FITRAH...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>
        ) : (
          <div className="space-y-4 py-2">
            {/* 1. Skor UTSMAN Summary */}
            <div className="p-3.5 rounded-xl bg-surface-2 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Skor UTSMAN Dimensi [{dimensionCode}]</span>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{config.description}</p>
              </div>
              <span className="text-2xl font-bold font-fredoka text-emerald-600 dark:text-emerald-400">
                {utsmanScore !== null ? Number(utsmanScore).toFixed(2) : "0.00"}
              </span>
            </div>

            {/* 2. Kontributor SAHABAT */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-plus-jakarta">
                1. Kontributor Indikator SAHABAT
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sahabatData?.indicators.map((item) => (
                  <div
                    key={item.code}
                    className="p-3 rounded-xl bg-surface-1 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block uppercase">
                        {item.code.replace("_score", "").toUpperCase()}
                      </span>
                      <span className="text-[10px] text-zinc-500">Rata-rata Indikator</span>
                    </div>
                    <span className="text-base font-bold font-fredoka text-zinc-900 dark:text-zinc-100">
                      {item.average.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Akar Karakter FITRAH Terkait */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-plus-jakarta">
                2. Profil Akar Karakter FITRAH Terkait
              </h4>
              {fitrahData && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-surface-2 text-center border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-zinc-500 block">Fathonah</span>
                    <span className="text-sm font-bold font-fredoka text-emerald-600">{fitrahData.fathonah.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2 text-center border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-zinc-500 block">Istiqamah</span>
                    <span className="text-sm font-bold font-fredoka text-emerald-600">{fitrahData.istiqamah.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2 text-center border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-zinc-500 block">Tanggung Jawab</span>
                    <span className="text-sm font-bold font-fredoka text-emerald-600">{fitrahData.tanggungJawab.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2 text-center border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-zinc-500 block">Rahmah</span>
                    <span className="text-sm font-bold font-fredoka text-emerald-600">{fitrahData.rahmah.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2 text-center border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-zinc-500 block">Amanah</span>
                    <span className="text-sm font-bold font-fredoka text-emerald-600">{fitrahData.amanah.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2 text-center border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-semibold text-zinc-500 block">Harmonis</span>
                    <span className="text-sm font-bold font-fredoka text-emerald-600">{fitrahData.harmonis.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
