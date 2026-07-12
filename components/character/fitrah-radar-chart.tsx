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

export type FitrahRadarData = {
  f: number | null;
  i: number | null;
  t: number | null;
  r: number | null;
  a: number | null;
  h: number | null;
  days_counted?: number;
};

interface FitrahRadarChartProps {
  data: FitrahRadarData | null;
}

export function FitrahRadarChart({ data }: FitrahRadarChartProps) {
  // If no data, or days_counted is 0, or all values are null, show empty state
  const isFullyNull =
    !data ||
    data.days_counted === 0 ||
    (data.f === null &&
      data.i === null &&
      data.t === null &&
      data.r === null &&
      data.a === null &&
      data.h === null);

  if (isFullyNull) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center min-h-[220px]">
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
        <span className="text-xs font-medium text-zinc-550 dark:text-zinc-400">
          Rekap karakter belum tersedia karena belum ada input budaya pada periode ini.
        </span>
      </div>
    );
  }

  // Check if there are null values alongside non-null values
  const rawValues = [data.f, data.i, data.t, data.r, data.a, data.h];
  const hasNulls = rawValues.some((v) => v === null);

  const chartData = [
    { subject: "Fathonah", value: data.f ?? undefined },
    { subject: "Istiqamah", value: data.i ?? undefined },
    { subject: "Tanggung Jawab", value: data.t ?? undefined },
    { subject: "Ramah", value: data.r ?? undefined },
    { subject: "Amanah", value: data.a ?? undefined },
    { subject: "Harmonis", value: data.h ?? undefined },
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
            />
            <PolarRadiusAxis
              angle={30}
              domain={[1, 4]}
              tick={{ fill: "#a1a1aa", fontSize: 9 }}
              axisLine={false}
              tickCount={4}
            />
            <Radar
              name="FITRAH"
              dataKey="value"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.25}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 41, 59, 0.9)",
                borderColor: "#334155",
                borderRadius: "12px",
                color: "#f8fafc",
                fontSize: "11px",
              }}
              itemStyle={{ color: "#10b981" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {hasNulls && (
        <div className="mt-2 text-[10px] text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/25 px-2.5 py-1.5 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
          Beberapa dimensi karakter tidak tampil karena belum memiliki data input di periode ini.
        </div>
      )}
    </div>
  );
}
