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
  const isFullyNull =
    !data ||
    (data.u_score === 0 &&
      data.t_score === 0 &&
      data.s_score === 0 &&
      data.m_score === 0 &&
      data.a_score === 0 &&
      data.n_score === 0);

  if (isFullyNull) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center min-h-[260px]">
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
          Tidak ada penilaian karakter semester ini.
        </span>
        <span className="text-[11px] text-zinc-400 mt-1">
          Data radar profil UTSMAN akan otomatis terbentuk setelah asesmen minggu pertama diisi.
        </span>
      </div>
    );
  }

  const chartData = [
    { code: "U", subject: "U (Ulet & Unggul)", value: Number(data.u_score || 0), fullLabel: UTSMAN_DIMENSIONS_CONFIG.U.label },
    { code: "T", subject: "T (Ta'at & Tangguh)", value: Number(data.t_score || 0), fullLabel: UTSMAN_DIMENSIONS_CONFIG.T.label },
    { code: "S", subject: "S (Santun & Empati)", value: Number(data.s_score || 0), fullLabel: UTSMAN_DIMENSIONS_CONFIG.S.label },
    { code: "M", subject: "M (Mandiri & Rapi)", value: Number(data.m_score || 0), fullLabel: UTSMAN_DIMENSIONS_CONFIG.M.label },
    { code: "A", subject: "A (Amanah & Jujur)", value: Number(data.a_score || 0), fullLabel: UTSMAN_DIMENSIONS_CONFIG.A.label },
    { code: "N", subject: "N (Nalar & Inisiatif)", value: Number(data.n_score || 0), fullLabel: UTSMAN_DIMENSIONS_CONFIG.N.label },
  ];

  return (
    <div className="relative w-full flex flex-col items-center justify-center p-2">
      <div className="w-full flex items-center justify-center" style={{ minHeight: "280px" }}>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
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
              formatter={(value: any) => [`${value} / 4.00`, "Skor Dimensi"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-[10px] text-zinc-400 text-center font-plus-jakarta">
        Tip: Klik nama dimensi di atas atau kartu di bawah untuk membuka drill-down breakdown indikator SAHABAT & FITRAH.
      </p>
    </div>
  );
}
