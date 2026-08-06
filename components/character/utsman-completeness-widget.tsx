"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  getCharacterCompletenessApi,
  WeeklyCompletenessRecord,
} from "@/lib/api/character";

interface UtsmanCompletenessWidgetProps {
  token: string;
  studentId: string;
  semesterId: string;
}

export function UtsmanCompletenessWidget({
  token,
  studentId,
  semesterId,
}: UtsmanCompletenessWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeeklyCompletenessRecord | null>(null);

  useEffect(() => {
    if (!token || !studentId || !semesterId) return;

    async function loadCompleteness() {
      setLoading(true);
      setError(null);
      try {
        const res = await getCharacterCompletenessApi(token, { studentId, semesterId });
        setData(res);
      } catch (err: any) {
        setError(err?.message || "Gagal memuat kelancaran pengisian.");
      } finally {
        setLoading(false);
      }
    }

    loadCompleteness();
  }, [token, studentId, semesterId]);

  if (loading) {
    return (
      <Card padding="md" className="flex items-center justify-center p-6">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
        <span className="text-xs text-zinc-500 font-plus-jakarta">Memuat kelancaran pengisian...</span>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card padding="md" className="p-4">
        <span className="text-xs font-bold text-zinc-500 uppercase block">Kelancaran Pengisian Karakter</span>
        <span className="text-xs text-zinc-400 mt-1 block">Belum ada data pengisian mingguan.</span>
      </Card>
    );
  }

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-plus-jakarta block">
            Kelancaran Pengisian Karakter
          </span>
          <span className="text-xs text-zinc-500 font-plus-jakarta mt-0.5 block">
            {data.completed_weeks} dari {data.total_weeks} minggu terisi
          </span>
        </div>
        <span className="text-xl font-bold font-fredoka text-emerald-600 dark:text-emerald-400">
          {data.percentage.toFixed(1)}%
        </span>
      </div>

      <div className="w-full h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, data.percentage))}%` }}
        />
      </div>
    </Card>
  );
}
