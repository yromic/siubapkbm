"use client";

import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { UtsmanSummaryRecord } from "@/lib/api/character";

export type UtsmanDimensionCode = "U" | "T" | "S" | "M" | "A" | "N";

export interface UtsmanDimensionInfo {
  code: UtsmanDimensionCode;
  label: string;
  shortDescription: string;
  score: number;
}

export const UTSMAN_DIMENSIONS_CONFIG: Record<UtsmanDimensionCode, { label: string; description: string; indicators: string }> = {
  U: { label: "Ulet & Unggul", description: "Kegigihan dan semangat keunggulan belajar", indicators: "AM (Asyik Mengaji) + AK (Aktif Berkarya)" },
  T: { label: "Ta'at & Tangguh", description: "Ketaatan ibadah dan ketangguhan pribadi", indicators: "AK (Aktif Berkarya)" },
  S: { label: "Santun & Empati", description: "Kepribadian santun, empati, dan adab", indicators: "SSS (Senyum Sapa Salam) + HB (Hormat Berbakti)" },
  M: { label: "Mandiri & Rapi", description: "Kemandirian, kerapian, dan kebersihan diri", indicators: "BR (Bersih & Rapi)" },
  A: { label: "Amanah & Jujur", description: "Integritas, kejujuran, dan keandalan", indicators: "AM (Asyik Mengaji) + ASM (Aku Suka Membaca)" },
  N: { label: "Nalar & Inisiatif", description: "Kemampuan bernalar kritis dan inisiatif sosial", indicators: "HB (Hormat Berbakti) + TM (Tolong Menolong)" },
};

interface UtsmanRadarChartProps {
  data: UtsmanSummaryRecord | null;
  onSelectDimension?: (dimension: UtsmanDimensionCode) => void;
}

export function UtsmanRadarChart({ data, onSelectDimension }: UtsmanRadarChartProps) {
  const scores = [
    { code: "U" as const, subject: "U (Ulet)", fullLabel: UTSMAN_DIMENSIONS_CONFIG.U.label, value: data?.u_score !== null && data?.u_score !== undefined ? Number(data.u_score) : null },
    { code: "T" as const, subject: "T (Ta'at)", fullLabel: UTSMAN_DIMENSIONS_CONFIG.T.label, value: data?.t_score !== null && data?.t_score !== undefined ? Number(data.t_score) : null },
    { code: "S" as const, subject: "S (Santun)", fullLabel: UTSMAN_DIMENSIONS_CONFIG.S.label, value: data?.s_score !== null && data?.s_score !== undefined ? Number(data.s_score) : null },
    { code: "M" as const, subject: "M (Mandiri)", fullLabel: UTSMAN_DIMENSIONS_CONFIG.M.label, value: data?.m_score !== null && data?.m_score !== undefined ? Number(data.m_score) : null },
    { code: "A" as const, subject: "A (Amanah)", fullLabel: UTSMAN_DIMENSIONS_CONFIG.A.label, value: data?.a_score !== null && data?.a_score !== undefined ? Number(data.a_score) : null },
    { code: "N" as const, subject: "N (Nalar)", fullLabel: UTSMAN_DIMENSIONS_CONFIG.N.label, value: data?.n_score !== null && data?.n_score !== undefined ? Number(data.n_score) : null },
  ];

  const observedScores = scores.filter((s) => s.value !== null);

  // 1. NO OBSERVATIONS: Clean empty state
  if (observedScores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center min-h-[260px] w-full">
        <svg
          className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mb-2 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 font-plus-jakarta">
          Belum ada observasi karakter semester ini.
        </span>
        <span className="text-[11px] text-zinc-400 mt-1">
          Data radar profil UTSMAN akan otomatis terbentuk setelah asesmen indikator budaya diisi.
        </span>
      </div>
    );
  }

  // 2. INSUFFICIENT DIMENSIONS (< 3 observed): Truthful card presentation rather than deceptive zero-polygon
  if (observedScores.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center p-5 bg-zinc-50/60 dark:bg-zinc-950/30 border border-emerald-100 dark:border-emerald-950/40 rounded-xl w-full min-h-[260px]">
        <div className="text-center mb-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Observasi Parsial ({observedScores.length} dari 6 Dimensi)
          </span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-sm mx-auto">
            Radar spider chart memerlukan minimal 3 dimensi terobservasi untuk membentuk polygon. Dimensi yang telah terobservasi:
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-3">
          {scores.map((s) => (
            <div
              key={s.code}
              onClick={() => onSelectDimension && onSelectDimension(s.code)}
              className={`p-2.5 rounded-lg border text-center cursor-pointer transition-all ${
                s.value !== null
                  ? "bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-800 shadow-sm"
                  : "bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-60"
              }`}
            >
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {s.code} — {s.fullLabel}
              </div>
              <div className="text-sm font-extrabold mt-1">
                {s.value !== null ? (
                  <span className="text-emerald-600 dark:text-emerald-400">{s.value.toFixed(2)}</span>
                ) : (
                  <span className="text-[11px] font-normal text-zinc-400">Belum ada data</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-zinc-400 text-center">
          Dimensi lainnya akan otomatis terisi saat indikator terkait diobservasi.
        </p>
      </div>
    );
  }

  // 3. FULL OR SUFFICIENT (>= 3 observed): Render Radar Chart
  const chartData = scores.map((s) => ({
    code: s.code,
    subject: s.subject,
    value: s.value !== null ? s.value : 0,
    isObserved: s.value !== null,
    displayValue: s.value !== null ? `${s.value.toFixed(2)} / 4.00` : "Belum ada data",
    fullLabel: s.fullLabel,
  }));

  const hasUnobserved = observedScores.length < 6;

  return (
    <div className="relative w-full flex flex-col items-center justify-center p-2">
      <div className="w-full flex items-center justify-center max-w-[420px]" style={{ minHeight: "280px" }}>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart cx="50%" cy="50%" outerRadius="68%" data={chartData}>
            <PolarGrid stroke="#e4e4e7" className="dark:stroke-zinc-800" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#71717a", fontSize: 10, fontWeight: 600 }}
              onClick={(e) => {
                if (e && e.value && onSelectDimension) {
                  const code = e.value.substring(0, 1) as UtsmanDimensionCode;
                  if (UTSMAN_DIMENSIONS_CONFIG[code]) {
                    onSelectDimension(code);
                  }
                }
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 4]}
              tick={{ fill: "#a1a1aa", fontSize: 9 }}
              axisLine={false}
              tickCount={5}
            />
            <Radar
              name="Profil UTSMAN"
              dataKey="value"
              stroke="#059669"
              fill="#10b981"
              fillOpacity={0.3}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "#334155",
                borderRadius: "12px",
                color: "#f8fafc",
                fontSize: "11px",
              }}
              formatter={(_value: any, _name: any, item: any) => [
                item?.payload?.displayValue || `${_value} / 4.00`,
                "Skor Dimensi",
              ]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {hasUnobserved && (
        <div className="mb-2 text-center">
          <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            {6 - observedScores.length} dimensi belum diobservasi
          </span>
        </div>
      )}

      <p className="mt-1 text-[10px] text-zinc-400 text-center font-plus-jakarta">
        Tip: Klik nama dimensi di atas atau kartu di bawah untuk membuka drill-down breakdown indikator SAHABAT & FITRAH.
      </p>
    </div>
  );
}
