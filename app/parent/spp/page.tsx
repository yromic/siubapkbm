"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getParentSppStatusApi, SppPayment } from "@/lib/api/finance";
import { Loader2, AlertTriangle, ChevronLeft, CheckCircle2, Clock } from "lucide-react";

const MONTHS = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatCurrency(val: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ParentSppPage() {
  const { token } = useParentAuth();
  const [history, setHistory] = useState<SppPayment[]>([]);
  const [totalArrears, setTotalArrears] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSppData = useCallback(async (sessionToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getParentSppStatusApi(sessionToken);
      // history contains all records (paid + unpaid) sorted by month
      const hist = (response as any).history ?? [];
      setHistory(hist);
      setTotalArrears(response.total_arrears_amount ?? 0);
    } catch (err) {
      console.error("Failed to load SPP history:", err);
      setError("Gagal memuat riwayat SPP. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchSppData(token);
    }
  }, [token, fetchSppData]);

  const paidCount = history.filter((p) => p.payment_status === "paid").length;
  const unpaidCount = history.filter((p) => p.payment_status !== "paid").length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-50 animate-fadeIn">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-[#171717]/85 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/parent/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#262626] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Kembali
          </Link>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
            Riwayat SPP
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">

        {/* Summary Card */}
        {!loading && !error && history.length > 0 && (
          <div className="bg-white dark:bg-[#171717] p-5 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
              Ringkasan Tahun Ajaran Ini
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-50 dark:bg-[#262626]/40 rounded-[12px] p-3 text-center">
                <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 block font-data">
                  {history.length}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1 block">
                  Total Bulan
                </span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-[12px] p-3 text-center">
                <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 block font-data">
                  {paidCount}
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1 block">
                  Lunas
                </span>
              </div>
              <div className={`rounded-[12px] p-3 text-center ${unpaidCount > 0 ? 'bg-red-50 dark:bg-red-950/15' : 'bg-zinc-50 dark:bg-[#262626]/40'}`}>
                <span className={`text-2xl font-extrabold block font-data ${unpaidCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-zinc-500'}`}>
                  {unpaidCount}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 block ${unpaidCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                  Belum Lunas
                </span>
              </div>
            </div>

            {totalArrears > 0 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/15 border border-red-200 dark:border-red-900/40 rounded-[12px] flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">Total Tunggakan</span>
                </div>
                <span className="font-extrabold text-red-700 dark:text-red-400 font-mono">
                  {formatCurrency(totalArrears)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* History Table */}
        <div className="bg-white dark:bg-[#171717] rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              Detail Tagihan Per Bulan
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Memuat data SPP...</span>
            </div>
          ) : error ? (
            <div className="p-5">
              <div className="flex gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-4 rounded-[12px] text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{error}</p>
                  <button
                    onClick={() => token && fetchSppData(token)}
                    className="mt-2 underline hover:no-underline transition"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-sm">
              Belum ada data tagihan SPP yang tersedia.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {history.map((p: any) => {
                const isPaid = p.payment_status === "paid";
                const monthLabel = MONTHS[p.payment_month ?? p.month] ?? "-";
                const yearLabel = p.payment_year ?? p.year ?? "-";
                const remaining = Number(p.amount_due) - Number(p.amount_paid);

                return (
                  <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/20'}`}>
                        {isPaid
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          : <Clock className="w-4 h-4 text-red-500 dark:text-red-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {monthLabel} {yearLabel}
                        </div>
                        {isPaid ? (
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Lunas · {formatDate(p.paid_at)}
                          </div>
                        ) : (
                          <div className="text-[11px] text-red-500 dark:text-red-400 mt-0.5">
                            Sisa: {formatCurrency(remaining)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm font-mono text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(Number(p.amount_due))}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : p.payment_status === 'partial'
                          ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                      }`}>
                        {isPaid ? 'Lunas' : p.payment_status === 'partial' ? 'Sebagian' : 'Belum Bayar'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-400 text-center leading-relaxed pb-6">
          Untuk verifikasi pembayaran, hubungi Operator Sekolah PKBM secara langsung.
        </p>
      </main>
    </div>
  );
}
