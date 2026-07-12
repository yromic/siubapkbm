"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { IndividualCharacterSummary } from "@/lib/api/character";
import { INDONESIAN_MONTHS } from "@/lib/utils/character-period";
import { analyzeStudentGrowth } from "@/lib/utils/student-growth-analysis";

interface StudentGrowthProps {
  historicalData: {
    month: number;
    year: number;
    data: IndividualCharacterSummary;
  }[];
}

const FITRAH_DIMENSIONS = [
  { key: "f", name: "Fathonah", color: "#3b82f6" }, // Blue
  { key: "i", name: "Istiqamah", color: "#10b981" }, // Emerald
  { key: "t", name: "Tanggung Jawab", color: "#f59e0b" }, // Amber
  { key: "r", name: "Ramah", color: "#ec4899" }, // Pink
  { key: "a", name: "Amanah", color: "#8b5cf6" }, // Purple
  { key: "h", name: "Harmonis", color: "#06b6d4" }, // Cyan
] as const;

export function StudentGrowth({ historicalData }: StudentGrowthProps) {
  const analysis = useMemo(() => {
    return analyzeStudentGrowth(historicalData);
  }, [historicalData]);

  // Sort chronologically (earliest to latest) for charts
  const chronologicalData = useMemo(() => {
    return [...historicalData]
      .reverse()
      .map((item) => {
        const monthName = INDONESIAN_MONTHS[item.month - 1].substring(0, 3);
        const label = `${monthName} ${item.year}`;
        
        const f = item.data.f !== null && item.data.f !== undefined ? parseFloat(item.data.f as any) : null;
        const i = item.data.i !== null && item.data.i !== undefined ? parseFloat(item.data.i as any) : null;
        const t = item.data.t !== null && item.data.t !== undefined ? parseFloat(item.data.t as any) : null;
        const r = item.data.r !== null && item.data.r !== undefined ? parseFloat(item.data.r as any) : null;
        const a = item.data.a !== null && item.data.a !== undefined ? parseFloat(item.data.a as any) : null;
        const h = item.data.h !== null && item.data.h !== undefined ? parseFloat(item.data.h as any) : null;

        const values = [f, i, t, r, a, h].filter((val): val is number => val !== null && !isNaN(val));
        
        const overall =
          values.length > 0
            ? Number((values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2))
            : null;

        return {
          label,
          month: item.month,
          year: item.year,
          f: f !== null ? f : undefined,
          i: i !== null ? i : undefined,
          t: t !== null ? t : undefined,
          r: r !== null ? r : undefined,
          a: a !== null ? a : undefined,
          h: h !== null ? h : undefined,
          overall: overall !== null ? overall : undefined,
          days_counted: item.data.days_counted,
          hasData: values.length > 0 || item.data.days_counted > 0,
        };
      });
  }, [historicalData]);

  // Case A: No history
  if (!analysis.hasHistory) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-50/50 dark:bg-zinc-955/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center min-h-[220px]">
        <svg
          className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mb-3 shrink-0"
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
        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
          Belum ada data perkembangan.
        </span>
        <span className="text-xs text-zinc-500 mt-1 max-w-[280px]">
          Data akan muncul setelah nilai budaya tersimpan pada beberapa periode.
        </span>
      </div>
    );
  }

  // Get status card properties
  const statusConfig = {
    Meningkat: {
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      borderColor: "border-emerald-250 dark:border-emerald-900/60",
      textColor: "text-emerald-800 dark:text-emerald-350",
      iconColor: "text-emerald-600 dark:text-emerald-450",
      badgeColor: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-250",
      meaning: "Siswa menunjukkan peningkatan karakter FITRAH secara keseluruhan dibandingkan periode awal.",
      icon: (
        <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    Stabil: {
      bgColor: "bg-zinc-50 dark:bg-zinc-950/20",
      borderColor: "border-zinc-200 dark:border-zinc-800/80",
      textColor: "text-zinc-800 dark:text-zinc-350",
      iconColor: "text-zinc-500 dark:text-zinc-400",
      badgeColor: "bg-zinc-150 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-250",
      meaning: "Karakter FITRAH siswa secara keseluruhan relatif stabil dan konsisten.",
      icon: (
        <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
        </svg>
      ),
    },
    "Perlu Perhatian": {
      bgColor: "bg-rose-50/70 dark:bg-rose-955/20",
      borderColor: "border-rose-250 dark:border-rose-900/60",
      textColor: "text-rose-800 dark:text-rose-350",
      iconColor: "text-rose-600 dark:text-rose-450",
      badgeColor: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-250",
      meaning: "Siswa menunjukkan penurunan karakter FITRAH secara keseluruhan dan memerlukan pendampingan.",
      icon: (
        <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
    },
    "Data Belum Cukup": {
      bgColor: "bg-amber-50 dark:bg-amber-955/20",
      borderColor: "border-amber-200 dark:border-amber-900/60",
      textColor: "text-amber-800 dark:text-amber-350",
      iconColor: "text-amber-600 dark:text-amber-450",
      badgeColor: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-250",
      meaning: "Minimal diperlukan dua periode valid untuk melihat arah perkembangan.",
      icon: (
        <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  }[analysis.status];

  return (
    <div className="space-y-6">
      {/* 1. Growth Status Card */}
      <section
        className={`p-5 rounded-2xl border ${statusConfig.borderColor} ${statusConfig.bgColor} flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`${statusConfig.iconColor} shrink-0 p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150/40 dark:border-zinc-800/40 shadow-xs`}>
            {statusConfig.icon}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              Status Perkembangan
            </span>
            <h4 className={`text-base font-black tracking-tight ${statusConfig.textColor} mt-0.5`}>
              {analysis.status}
            </h4>
            <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1 leading-relaxed">
              {statusConfig.meaning}
            </p>
          </div>
        </div>
        
        {analysis.status !== "Data Belum Cukup" && analysis.delta !== null && (
          <div className="flex sm:flex-col items-center sm:items-end shrink-0 gap-2 sm:gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-550">
              Delta Total
            </span>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black leading-none ${statusConfig.badgeColor}`}>
              {isNaN(analysis.delta ?? NaN) ? 0 : (analysis.delta! > 0 ? `+${analysis.delta}` : analysis.delta)}
            </span>
          </div>
        )}
      </section>

      {/* 2. Growth Summary */}
      <section className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3.5">
        <div>
          <h5 className="text-xs font-extrabold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">
            Analisis Perkembangan Karakter
          </h5>
          <p className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-0.5">
            Perbandingan deterministik performa karakter antara periode paling awal dan paling akhir.
          </p>
        </div>

        {analysis.status === "Data Belum Cukup" ? (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-955/20 border border-amber-200/50 dark:border-amber-900/50 text-xs font-semibold text-amber-800 dark:text-amber-350 leading-relaxed">
            Data perkembangan belum cukup untuk dibandingkan. Minimal diperlukan dua periode valid untuk melihat arah perkembangan.
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-955/40 border border-zinc-150 dark:border-zinc-850/80 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold">
            {analysis.growthSummaryText}
          </div>
        )}
      </section>

      {/* 3. Strongest & Area Penguatan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Strongest */}
        <section className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
          <div>
            <h5 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
              Karakter Terkuat Saat Ini
            </h5>
            <p className="text-[9px] text-zinc-500 mt-0.5">
              Dimensi dengan nilai tertinggi di periode valid terakhir.
            </p>
          </div>
          {analysis.strongestDimension ? (
            <div className="flex items-baseline justify-between mt-4">
              <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                {analysis.strongestDimension.name}
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450">
                {analysis.strongestDimension.score.toFixed(1)}
              </span>
            </div>
          ) : (
            <div className="mt-4 py-2 border border-dashed border-zinc-150 dark:border-zinc-850 rounded-xl text-center text-xs text-zinc-400 dark:text-zinc-650">
              Belum ada data
            </div>
          )}
        </section>

        {/* Area Penguatan */}
        <section className="bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
          <div>
            <h5 className="text-xs font-extrabold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
              Area Penguatan
            </h5>
            <p className="text-[9px] text-zinc-500 mt-0.5">
              Dimensi dengan nilai terendah di periode valid terakhir.
            </p>
          </div>
          {analysis.weakestDimension ? (
            <div className="flex items-baseline justify-between mt-4">
              <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                {analysis.weakestDimension.name}
              </span>
              <span className="text-2xl font-black text-amber-500 dark:text-amber-450">
                {analysis.weakestDimension.score.toFixed(1)}
              </span>
            </div>
          ) : (
            <div className="mt-4 py-2 border border-dashed border-zinc-150 dark:border-zinc-850 rounded-xl text-center text-xs text-zinc-400 dark:text-zinc-650">
              Belum ada data
            </div>
          )}
        </section>
      </div>

      {/* 4. Data Completeness Warning */}
      {analysis.isLowCompleteness && (
        <section className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-350 flex items-start gap-2.5 shadow-xs leading-relaxed font-semibold">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-450 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            Data bulan terakhir masih terbatas ({analysis.latestDaysCounted} hari terisi). Interpretasi perkembangan perlu dilakukan dengan hati-hati.
          </div>
        </section>
      )}

      {/* 5. Overall FITRAH Trend Chart */}
      <section className="bg-surface-2 border border-zinc-150 dark:border-zinc-850 rounded-2xl p-4 sm:p-5">
        <div className="mb-4">
          <h5 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
            Trend FITRAH Keseluruhan
          </h5>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
            Rata-rata kumulatif dari seluruh dimensi yang aktif per bulan.
          </p>
        </div>
        <div className="w-full" style={{ height: "220px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chronologicalData}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" className="dark:stroke-zinc-800/60" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[1, 4]}
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickCount={4}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(9, 9, 11, 0.9)",
                  borderColor: "rgba(39, 39, 42, 0.8)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "11px",
                }}
              />
              <Line
                type="monotone"
                dataKey="overall"
                name="FITRAH Rata-rata"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-3 text-center">
          Grafik menunjukkan rata-rata FITRAH berdasarkan dimensi yang memiliki data pada tiap bulan.
        </p>
      </section>

      {/* 6. FITRAH Dimension Trend Chart */}
      <section className="bg-surface-2 border border-zinc-150 dark:border-zinc-850 rounded-2xl p-4 sm:p-5">
        <div className="mb-4">
          <h5 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">
            Trend Dimensi FITRAH (6 Bulan)
          </h5>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
            Perkembangan detail dari masing-masing 6 dimensi FITRAH.
          </p>
        </div>
        <div className="w-full" style={{ height: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chronologicalData}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" className="dark:stroke-zinc-800/60" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[1, 4]}
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickCount={4}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(9, 9, 11, 0.9)",
                  borderColor: "rgba(39, 39, 42, 0.8)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "11px",
                }}
              />
              {FITRAH_DIMENSIONS.map((dim) => (
                <Line
                  key={dim.key}
                  type="monotone"
                  dataKey={dim.key}
                  name={dim.name}
                  stroke={dim.color}
                  strokeWidth={2.5}
                  dot={{ r: 3.5 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Custom Mobile-Friendly Legend (replaces Recharts native legend) */}
        <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-2 mt-4 text-[10px] font-bold text-zinc-650 dark:text-zinc-400 border-t border-zinc-200/40 dark:border-zinc-800/40 pt-3">
          {FITRAH_DIMENSIONS.map((dim) => (
            <div key={dim.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dim.color }} />
              <span>{dim.name}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-3 text-center">
          Nilai kosong tidak dihitung sebagai nol.
        </p>
      </section>

      {/* 7. Days Counted Chart */}
      <section className="bg-surface-2 border border-zinc-150 dark:border-zinc-850 rounded-2xl p-4 sm:p-5">
        <div className="mb-4">
          <h5 className="text-xs font-bold text-zinc-400 dark:text-zinc-550 tracking-wider uppercase">
            Data Completeness (Hari Terisi)
          </h5>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
            Jumlah hari dengan minimal 1 entri budaya karakter untuk validitas interpretasi trend.
          </p>
        </div>
        <div className="w-full" style={{ height: "160px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chronologicalData}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" className="dark:stroke-zinc-800/60" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(9, 9, 11, 0.9)",
                  borderColor: "rgba(39, 39, 42, 0.8)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "11px",
                }}
              />
              <Bar
                dataKey="days_counted"
                name="Hari Terisi"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-3 text-center">
          Days Counted menunjukkan jumlah hari budaya yang tercatat pada periode tersebut.
        </p>
      </section>

      {/* 8. Data Interpretation Notes */}
      <section className="bg-surface-2 border border-zinc-150 dark:border-zinc-850 rounded-2xl p-4 sm:p-5 space-y-2">
        <h5 className="text-xs font-extrabold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">
          Catatan Interpretasi Data
        </h5>
        <ul className="list-disc pl-4 text-[11px] text-zinc-550 dark:text-zinc-400 space-y-1.5">
          <li>
            <strong>Trend FITRAH Keseluruhan:</strong> Grafik menunjukkan rata-rata FITRAH berdasarkan dimensi yang memiliki data pada tiap bulan.
          </li>
          <li>
            <strong>Trend Dimensi FITRAH:</strong> Nilai kosong tidak dihitung sebagai nol.
          </li>
          <li>
            <strong>Data Completeness:</strong> Days Counted menunjukkan jumlah hari budaya yang tercatat pada periode tersebut.
          </li>
        </ul>
      </section>
    </div>
  );
}
