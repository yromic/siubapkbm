"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getParentCharacterSummaryApi, ParentCharacterData } from "@/lib/api/parent";
import { UtsmanRadarChart } from "@/components/character/utsman-radar-chart";
import { ResponsiveContainer } from "@/components/ui-states";
import { Loader2, AlertTriangle, LogOut, ChevronLeft, ChevronDown, Award, Sparkles, CheckCircle2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UX_COPY } from "@/lib/ux-copy";

export default function ParentCharacterPage() {
  const { token, logout, clearSession } = useParentAuth();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
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
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-50 animate-fadeIn">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-[#171717]/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center text-xs font-bold text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1.5" />
            Kembali
          </Link>
          <span className="text-sm font-bold bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
            Profil Karakter UTSMAN
          </span>
          <button
            onClick={() => setShowConfirmLogout(true)}
            className="inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#262626] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            Keluar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        {/* Student Header Card */}
        {student && (
          <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                Nama Santri / Murid
              </span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {student.full_name}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 font-data">NISN {student.nisn}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-850">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Kelas
                </span>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mt-0.5">
                  {student.class_name || "Belum terdaftar"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Periode Penilaian
                </span>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mt-0.5 truncate font-data">
                  {period?.label || "Semester Aktif"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* UTSMAN Overview Stats */}
        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#171717] p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Rata-rata UTSMAN
                </span>
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1 block font-data">
                  {utsman?.overall_average !== null && utsman?.overall_average !== undefined
                    ? Number(utsman.overall_average).toFixed(2)
                    : "-"}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 block">
                  Skala 1.00 - 4.00
                </span>
              </div>
              <div className="bg-white dark:bg-[#171717] p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                  Dimensi Terobservasi
                </span>
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1 block font-data">
                  {data.interpretation.available_count} / 6
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 block">
                  Dimensi Karakter Aktif
                </span>
              </div>
            </div>

            {/* Informative Banner */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 rounded-[16px] p-3.5 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-300 font-medium">
              <Sparkles className="w-5 h-5 text-[#468432] dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Profil UTSMAN</strong> menggambarkan 6 pilar karakter utama santri di PKBM Imam Syafi&apos;i yang dihitung secara berkala dari pembiasaan mingguan.
              </span>
            </div>

            {/* UTSMAN Radar Chart or Empty State */}
            {!hasData ? (
              <div className="bg-white dark:bg-[#171717] p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center text-center py-10 min-h-[250px]">
                <Award className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3 shrink-0" />
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  Belum ada data karakter yang tersedia.
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                  Data akan tampil setelah guru mencatat pembiasaan budaya mingguan pada semester ini.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Radar Profil Karakter
                  </h3>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    6 Dimensi UTSMAN
                  </span>
                </div>
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

            {/* Understanding UTSMAN Accordion */}
            {hasData && (
              <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                <details className="group cursor-pointer">
                  <summary className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider select-none list-none">
                    <span>💡 Memahami 6 Dimensi UTSMAN</span>
                    <span className="transition-transform group-open:rotate-180">
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    </span>
                  </summary>
                  <div className="mt-3 text-xs text-zinc-650 dark:text-zinc-400 space-y-2.5 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/80 pt-3 group-open:animate-in group-open:fade-in duration-200">
                    <p>
                      Karakter santri dievaluasi secara holistik ke dalam 6 pilar:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-zinc-50/50 dark:bg-[#262626]/45 border border-zinc-100 dark:border-zinc-800/20 p-2 rounded-[12px]">
                        <span className="font-bold text-[#468432] block">U — Ulet & Unggul</span>
                        Kegigihan belajar dan tekad berprestasi.
                      </div>
                      <div className="bg-zinc-50/50 dark:bg-[#262626]/45 border border-zinc-100 dark:border-zinc-800/20 p-2 rounded-[12px]">
                        <span className="font-bold text-[#468432] block">T — Ta&apos;at & Tangguh</span>
                        Ketaatan ibadah dan ketangguhan sikap.
                      </div>
                      <div className="bg-zinc-50/50 dark:bg-[#262626]/45 border border-zinc-100 dark:border-zinc-800/20 p-2 rounded-[12px]">
                        <span className="font-bold text-[#468432] block">S — Santun & Empati</span>
                        Adab bertutur kata dan kepedulian sosial.
                      </div>
                      <div className="bg-zinc-50/50 dark:bg-[#262626]/45 border border-zinc-100 dark:border-zinc-800/20 p-2 rounded-[12px]">
                        <span className="font-bold text-[#468432] block">M — Mandiri & Rapi</span>
                        Kemandirian diri dan keteraturan pribadi.
                      </div>
                      <div className="bg-zinc-50/50 dark:bg-[#262626]/45 border border-zinc-100 dark:border-zinc-800/20 p-2 rounded-[12px]">
                        <span className="font-bold text-[#468432] block">A — Amanah & Jujur</span>
                        Integritas diri dan kejujuran berbuat.
                      </div>
                      <div className="bg-zinc-50/50 dark:bg-[#262626]/45 border border-zinc-100 dark:border-zinc-800/20 p-2 rounded-[12px]">
                        <span className="font-bold text-[#468432] block">N — Nalar & Inisiatif</span>
                        Berpikir kritis dan suka menolong sesama.
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Highlights: Strongest & Strengthening Areas */}
            {hasData &&
              (data.interpretation.strongest_dimension ||
                data.interpretation.strengthening_area) && (
                <div className="space-y-4">
                  {data.interpretation.strongest_dimension && (
                    <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/20 dark:from-emerald-950/20 dark:to-teal-950/10 p-5 rounded-[20px] border border-emerald-100 dark:border-emerald-900/30 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#3A6F2B] dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-lg">
                          Karakter yang Menonjol
                        </span>
                        <span className="text-xs font-black text-[#3A6F2B] dark:text-emerald-400 font-data">
                          {Number(data.interpretation.strongest_dimension.score).toFixed(2)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {data.interpretation.strongest_dimension.name}
                      </h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-350 leading-relaxed">
                        {data.dimensions.find(
                          (d) => d.code === data.interpretation.strongest_dimension?.code
                        )?.parent_explanation || ""}
                      </p>
                    </div>
                  )}

                  {data.interpretation.strengthening_area && (
                    <div className="bg-gradient-to-br from-amber-50/70 to-amber-50/20 dark:from-amber-950/15 dark:to-amber-950/5 p-5 rounded-[20px] border border-amber-100 dark:border-amber-900/20 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg">
                          Area yang Dapat Dikuatkan Bersama
                        </span>
                        <span className="text-xs font-black text-amber-800 dark:text-amber-400 font-data">
                          {Number(data.interpretation.strengthening_area.score).toFixed(2)}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {data.interpretation.strengthening_area.name}
                      </h4>
                      <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed">
                        {data.dimensions.find(
                          (d) => d.code === data.interpretation.strengthening_area?.code
                        )?.parent_explanation || ""}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {/* Individual Dimension Cards */}
            {hasData && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Rincian 6 Dimensi Karakter
                </h3>
                <div className="space-y-3">
                  {data.dimensions.map((dim) => (
                    <div
                      key={dim.code}
                      className="bg-white dark:bg-[#171717] p-4.5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                          {dim.name}
                        </h4>
                        <span
                          className={`text-sm font-black px-2.5 py-1 rounded-[12px] font-data ${
                            dim.score !== null
                              ? "text-zinc-900 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800"
                              : "text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
                          }`}
                        >
                          {dim.score !== null ? Number(dim.score).toFixed(2) : "Belum ada data"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {dim.parent_explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completeness Notice */}
            {data.interpretation.completeness_notice && (
              <div className="flex gap-3 bg-zinc-100/70 dark:bg-[#1a1a1a] border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] text-xs leading-relaxed">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#468432] dark:text-emerald-400" />
                <p className="text-zinc-700 dark:text-zinc-300">{data.interpretation.completeness_notice}</p>
              </div>
            )}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={showConfirmLogout}
        onOpenChange={setShowConfirmLogout}
        title="Keluar dari Portal?"
        description="Apakah Anda yakin ingin keluar dari portal monitoring wali murid?"
        confirmLabel="Ya, Keluar"
        variant="destructive"
        onConfirm={logout}
      />
    </div>
  );
}
