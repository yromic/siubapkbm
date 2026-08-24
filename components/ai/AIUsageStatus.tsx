"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export interface AIUsageData {
  provider: string;
  model: string;
  scope: string;
  rpm: {
    used: number;
    limit: number | null;
    remaining: number | null;
    limited: boolean;
  };
  rpd: {
    used: number;
    limit: number | null;
    remaining: number | null;
    limited: boolean;
    resetAt?: string;
  };
}

interface AIUsageStatusProps {
  compact?: boolean;
  className?: string;
  onRefresh?: () => void;
}

export function AIUsageStatus({ compact = false, className = "" }: AIUsageStatusProps) {
  const [data, setData] = useState<AIUsageData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/usage");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch {
      // Non-blocking for UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (!data) return null;

  const rpdUsed = data.rpd.used;
  const rpdLimit = data.rpd.limit;
  const rpdPercent = rpdLimit && rpdLimit > 0 ? Math.min(100, Math.round((rpdUsed / rpdLimit) * 100)) : 0;

  // Threshold status
  let statusBadgeColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
  let progressBarColor = "bg-emerald-500";
  let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />;

  if (rpdPercent >= 100 || data.rpd.limited) {
    statusBadgeColor = "text-red-700 bg-red-50 border-red-200";
    progressBarColor = "bg-red-500";
    statusIcon = <ShieldAlert className="w-3.5 h-3.5 text-red-600 inline mr-1" />;
  } else if (rpdPercent >= 80) {
    statusBadgeColor = "text-amber-700 bg-amber-50 border-amber-200";
    progressBarColor = "bg-amber-500";
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600 inline mr-1" />;
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${statusBadgeColor} ${className}`}>
        <Sparkles className="w-3.5 h-3.5" />
        <span className="font-semibold">AI ({data.model}):</span>
        <span>
          Hari ini {rpdUsed}{rpdLimit ? `/${rpdLimit}` : ""}
        </span>
        <button
          type="button"
          onClick={fetchUsage}
          disabled={loading}
          className="ml-1 opacity-60 hover:opacity-100"
          title="Perbarui data kuota"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-xl border bg-white shadow-xs text-xs space-y-2 ${className}`}>
      <div className="flex items-center justify-between border-b pb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-gray-800">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Penggunaan AI (Tercatat SIUBA)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border">
            {data.model}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchUsage}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          title="Perbarui estimasi kuota"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-0.5">
        {/* RPD Box */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-600 font-medium">
            <span>Kuota Harian (RPD)</span>
            <span className="font-bold text-gray-800">
              {rpdUsed} {rpdLimit ? `/ ${rpdLimit}` : ""}
            </span>
          </div>
          {rpdLimit ? (
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${progressBarColor}`}
                style={{ width: `${rpdPercent}%` }}
              />
            </div>
          ) : (
            <span className="text-[10px] text-gray-400">Limit lokal belum disetel di .env</span>
          )}
        </div>

        {/* RPM Box */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-600 font-medium">
            <span>Menit Ini (RPM)</span>
            <span className="font-bold text-gray-800">
              {data.rpm.used} {data.rpm.limit ? `/ ${data.rpm.limit}` : ""}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">
            {data.rpm.limited ? (
              <span className="text-amber-600 font-semibold">Mendekati / batas menit aktif</span>
            ) : (
              <span>Laju stabil</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t pt-1.5">
        <div>
          {statusIcon}
          <span>{rpdPercent >= 100 ? "Batas kuota harian tercapai" : rpdPercent >= 80 ? "Mendekati limit harian" : "Kuota normal"}</span>
        </div>
        <span className="italic">Berdasarkan pencatatan request SIUBA</span>
      </div>
    </div>
  );
}

/**
 * getAIErrorMessageByReason
 *
 * Helper untuk menyajikan pesan toast UX yang jujur dan kontekstual sesuai alasan fallback.
 */
export function getAIErrorMessageByReason(reason?: string, defaultMsg = "Layanan AI sedang tidak tersedia."): string {
  switch (reason) {
    case "LOCAL_RPM_LIMIT":
    case "RATE_LIMIT":
      return "AI sedang menerima banyak permintaan dalam 1 menit. Mohon tunggu beberapa saat sebelum mencoba lagi.";
    case "LOCAL_RPD_LIMIT":
    case "DAILY_QUOTA":
      return "Estimasi kuota AI harian telah tercapai. Template lokal digunakan agar pekerjaan Anda tetap berlanjut.";
    case "NO_API_KEY":
      return "Kunci API Gemini belum dikonfigurasi di server.";
    case "TIMEOUT":
      return "Permintaan ke AI melebihi batas waktu (timeout). Coba lagi beberapa saat.";
    default:
      return defaultMsg;
  }
}
