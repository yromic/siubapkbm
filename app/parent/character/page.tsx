"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getParentCharacterSummaryApi, ParentCharacterData } from "@/lib/api/parent";
import { UtsmanRadarChart } from "@/components/character/utsman-radar-chart";
import { ResponsiveContainer } from "@/components/ui-states";
import { ParentNavbar } from "@/components/parent/ParentNavbar";
import {
  Loader2,
  AlertTriangle,
  Award,
  Sparkles,
  CheckCircle2,
  Info,
} from "lucide-react";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentCharacterPage() {
  const { token, clearSession } = useParentAuth();
  const [data, setData] = useState<ParentCharacterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharacterData = useCallback(
    async (sessionToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await getParentCharacterSummaryApi(sessionToken);
        setData(response);
      } catch (err) {
        console.error("Failed to load character summary data:", err);
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_UNAUTHORIZED") {
          clearSession();
        } else {
          setError(UX_COPY.error.default);
        }
      } finally {
        setLoading(false);
      }
    },
    [clearSession]
  );

  useEffect(() => {
    if (token) {
      const timer = setTimeout(() => {
        fetchCharacterData(token);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, fetchCharacterData]);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <div className="text-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-[#468432] mx-auto mb-4" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Memuat profil karakter UTSMAN...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-fadeIn">
        <ResponsiveContainer className="max-w-md px-4">
          <div className="bg-white dark:bg-[#171717] p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold mb-2 text-zinc-900 dark:text-zinc-100">Terjadi Kesalahan</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error}</p>
            <button
              onClick={() => token && fetchCharacterData(token)}
              className="px-5 py-2.5 w-full bg-[#468432] hover:bg-[#3A6F2B] text-white text-sm font-semibold rounded-[12px] transition-colors cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </ResponsiveContainer>
      </div>
    );
  }

  const student = data?.student;
  const utsman = data?.utsman;
  const period = data?.period;
  const hasData = data?.interpretation?.has_data ?? false;

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f4] dark:bg-[#0c0c0d] text-zinc-900 dark:text-zinc-50 animate-fadeIn pb-24 md:pb-12">
      {/* Unified Desktop & Mobile Navigation Bar */}
      <ParentNavbar
        studentName={student?.full_name}
        studentClass={student?.class_name || undefined}
        nisn={student?.nisn}
        title="Karakter UTSMAN"
        showBack={true}
      />

      {/* Main Content — Responsive Desktop Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Top Summary Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-fredoka text-zinc-900 dark:text-zinc-100">
              Rapor Karakter UTSMAN
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Evaluasi pembiasaan budaya dan 6 dimensi karakter ananda semester ini.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {period?.label || "Semester Aktif"}
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Desktop Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ─── LEFT COLUMN (lg:col-span-4) ─── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Metrics */}
            {data && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                    Rata-Rata UTSMAN
                  </span>
                  <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block font-data">
                    {utsman?.overall_average !== null && utsman?.overall_average !== undefined
                      ? Number(utsman.overall_average).toFixed(2)
                      : "-"}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                    Skala 1.00 – 4.00
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                    Observasi Dimensi
                  </span>
                  <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block font-data">
                    {data.interpretation.available_count} / 6
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                    Dimensi Terisi
                  </span>
                </div>
              </div>
            )}

            {/* Understanding UTSMAN Reference Card */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider">
                <Info className="w-4 h-4 text-emerald-600" />
                <span>Mengenal 6 Dimensi UTSMAN</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-plus-jakarta">
                Karakter santri dievaluasi secara berkala ke dalam 6 pilar pembiasaan:
              </p>
              <div className="space-y-2 text-xs">
                <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">U — Ulet & Unggul</span>
                  <span className="text-[11px] text-zinc-500">Kegigihan belajar, tekad berprestasi, dan tidak mudah menyerah.</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">T — Ta&apos;at & Tangguh</span>
                  <span className="text-[11px] text-zinc-500">Ketaatan ibadah, kedisiplinan shalat berjamaah, dan ketangguhan sikap.</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">S — Santun & Empati</span>
                  <span className="text-[11px] text-zinc-500">Adab bertutur kata, menghormati guru, dan kepedulian sesama santri.</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">M — Mandiri & Rapi</span>
                  <span className="text-[11px] text-zinc-500">Kemandirian mengelola barang pribadi dan keteraturan diri di asrama.</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">A — Amanah & Jujur</span>
                  <span className="text-[11px] text-zinc-500">Integritas diri, berkata jujur, dan bertanggung jawab atas tugas.</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">N — Nalar & Inisiatif</span>
                  <span className="text-[11px] text-zinc-500">Berpikir kritis, kreatif memecahkan masalah, dan inisiatif beramal kebaikan.</span>
                </div>
              </div>
            </div>

          </div>

          {/* ─── RIGHT COLUMN (lg:col-span-8) ─── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Radar Chart Card */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-fredoka flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Radar Visual Karakter UTSMAN
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Grafik keseimbangan 6 dimensi karakter ananda semester ini.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full shrink-0">
                  6 Dimensi
                </span>
              </div>

              {!hasData ? (
                <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <Award className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Belum ada penilaian karakter semester ini.</p>
                </div>
              ) : (
                <div className="bg-zinc-50/60 dark:bg-zinc-950/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center">
                  <UtsmanRadarChart
                    data={{
                      student_id: student?.id || "",
                      semester_id: period?.semester_id || "",
                      u_score: utsman?.u ?? null,
                      t_score: utsman?.t ?? null,
                      s_score: utsman?.s ?? null,
                      m_score: utsman?.m ?? null,
                      a_score: utsman?.a ?? null,
                      n_score: utsman?.n ?? null,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Highlights: Strongest & Strengthening Area (Desktop 2-Col Grid) */}
            {hasData && data && (data.interpretation.strongest_dimension || data.interpretation.strengthening_area) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.interpretation.strongest_dimension && (
                  <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/15 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        Karakter yang Menonjol
                      </span>
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 font-data">
                        {Number(data.interpretation.strongest_dimension.score).toFixed(2)}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {data.interpretation.strongest_dimension.name}
                    </h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed font-plus-jakarta">
                      {data.dimensions.find((d) => d.code === data.interpretation.strongest_dimension?.code)
                        ?.parent_explanation || ""}
                    </p>
                  </div>
                )}

                {data.interpretation.strengthening_area && (
                  <div className="bg-gradient-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-950/30 dark:to-amber-950/15 p-5 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        Area Penguatan Bersama
                      </span>
                      <span className="text-xs font-black text-amber-800 dark:text-amber-300 font-data">
                        {Number(data.interpretation.strengthening_area.score).toFixed(2)}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {data.interpretation.strengthening_area.name}
                    </h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed font-plus-jakarta">
                      {data.dimensions.find((d) => d.code === data.interpretation.strengthening_area?.code)
                        ?.parent_explanation || ""}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Individual Dimension Cards — Desktop 2-Column Grid */}
            {hasData && data && (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Rincian Penilaian 6 Dimensi Karakter
                  </h3>
                  <span className="text-xs text-zinc-400">Skala 1.00 – 4.00</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {data.dimensions.map((dim) => {
                    const scoreNum = dim.score !== null ? Number(dim.score) : 0;
                    const pct = Math.min(100, Math.max(0, (scoreNum / 4) * 100));

                    return (
                      <div
                        key={dim.code}
                        className="bg-zinc-50/70 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 space-y-2 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {dim.name}
                          </h4>
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg font-data ${
                              dim.score !== null
                                ? "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800"
                                : "text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                            }`}
                          >
                            {dim.score !== null ? scoreNum.toFixed(2) : "Belum Dinilai"}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-plus-jakarta">
                          {dim.parent_explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completeness Notice */}
            {data?.interpretation.completeness_notice && (
              <div className="flex gap-3 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs leading-relaxed">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-zinc-700 dark:text-zinc-300 font-plus-jakarta">
                  {data.interpretation.completeness_notice}
                </p>
              </div>
            )}

          </div>

        </div>

      </main>
    </div>
  );
}
