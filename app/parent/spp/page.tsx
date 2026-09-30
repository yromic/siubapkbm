"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getParentSppStatusApi, SppPayment } from "@/lib/api/finance";
import { ParentNavbar } from "@/components/parent/ParentNavbar";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Printer,
  Info,
} from "lucide-react";

const MONTHS: Record<number, string> = {
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

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
      setHistory(response.history || []);
      setTotalArrears(response.total_arrears_amount || 0);
    } catch (err: unknown) {
      console.error("Gagal memuat riwayat SPP:", err);
      setError("Gagal memuat data riwayat SPP.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      const timer = setTimeout(() => {
        fetchSppData(token);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [token, fetchSppData]);

  const paidCount = history.filter((p) => p.payment_status === "paid").length;
  const unpaidCount = history.filter((p) => p.payment_status !== "paid").length;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f4] dark:bg-[#0c0c0d] text-zinc-900 dark:text-zinc-50 animate-fadeIn pb-24 md:pb-12">
      {/* Unified Desktop & Mobile Navigation Bar */}
      <ParentNavbar title="Riwayat SPP" showBack={true} />

      {/* Main Container — Desktop/Windows Screen */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Top Header & Metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-fredoka text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Riwayat Pembayaran SPP Santri
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-plus-jakarta">
              Pantau status administrasi iuran sekolah dan catatan setoran bulanan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors shadow-2xs shrink-0"
          >
            <Printer className="w-4 h-4 text-zinc-500" />
            Cetak Rekap
          </button>
        </div>

        {/* Summary Metric Cards */}
        {!loading && !error && history.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Total Bulan Tagihan
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 block font-data">
                {history.length}
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block">Tahun Ajaran Aktif</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block">
                Sudah Lunas
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 block font-data">
                {paidCount} <span className="text-xs font-normal text-zinc-400">Bulan</span>
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block">Telah Diverifikasi</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
              <span className={`text-[10px] uppercase font-bold tracking-wider block ${unpaidCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-400"}`}>
                Belum Lunas
              </span>
              <span className={`text-2xl sm:text-3xl font-extrabold mt-1 block font-data ${unpaidCount > 0 ? "text-rose-700 dark:text-rose-400" : "text-zinc-400"}`}>
                {unpaidCount} <span className="text-xs font-normal text-zinc-400">Bulan</span>
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block">Perlu Dituntaskan</span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Total Tunggakan
              </span>
              <span className={`text-xl sm:text-2xl font-extrabold mt-1 block font-mono ${totalArrears > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {formatCurrency(totalArrears)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block">
                {totalArrears > 0 ? "Kewajiban berjalan" : "Semua tagihan bersih"}
              </span>
            </div>
          </div>
        )}

        {/* SPP Ledger Section (Desktop Table + Mobile Cards) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-fredoka">
              Buku Mutasi & Rekap Tagihan SPP
            </h2>
            <span className="text-xs text-zinc-400 font-data">
              {history.length} Catatan
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-sm">Memuat buku mutasi SPP...</span>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="flex gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-4 rounded-xl text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{error}</p>
                  <button
                    onClick={() => token && fetchSppData(token)}
                    className="mt-2 underline hover:no-underline transition cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 text-sm">
              Belum ada data tagihan SPP yang tersedia.
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW (hidden on mobile, visible on md and up) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4">Bulan / Periode</th>
                      <th className="py-3 px-4">Nominal Tagihan</th>
                      <th className="py-3 px-4">Jumlah Terbayar</th>
                      <th className="py-3 px-4">Sisa Tagihan</th>
                      <th className="py-3 px-4">Tanggal Pembayaran</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-plus-jakarta">
                    {history.map((p: any, idx: number) => {
                      const isPaid = p.payment_status === "paid";
                      const isPartial = p.payment_status === "partial";
                      const monthLabel = MONTHS[p.payment_month ?? p.month] ?? "-";
                      const yearLabel = p.payment_year ?? p.year ?? "-";
                      const remaining = Math.max(0, Number(p.amount_due || 0) - Number(p.amount_paid || 0));

                      return (
                        <tr key={p.id || idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4 text-center text-zinc-400 font-data">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                            {monthLabel} {yearLabel}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                            {formatCurrency(Number(p.amount_due || 0))}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                            {formatCurrency(Number(p.amount_paid || 0))}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-300">
                            {remaining > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(remaining)}</span>
                            ) : (
                              <span className="text-zinc-400 font-normal">Rp 0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-500 font-data">
                            {p.paid_at ? formatDate(p.paid_at) : "-"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : isPartial
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              }`}
                            >
                              {isPaid && <CheckCircle2 className="w-3 h-3" />}
                              {!isPaid && <Clock className="w-3 h-3" />}
                              {isPaid ? "Lunas" : isPartial ? "Sebagian" : "Belum Bayar"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS VIEW (visible on mobile, hidden on md and up) */}
              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {history.map((p: any) => {
                  const isPaid = p.payment_status === "paid";
                  const monthLabel = MONTHS[p.payment_month ?? p.month] ?? "-";
                  const yearLabel = p.payment_year ?? p.year ?? "-";
                  const remaining = Number(p.amount_due) - Number(p.amount_paid);

                  return (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                            {monthLabel} {yearLabel}
                          </div>
                          {isPaid ? (
                            <div className="text-[10px] text-zinc-400 mt-0.5 font-data">
                              Lunas · {formatDate(p.paid_at)}
                            </div>
                          ) : (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-data">
                              Sisa: {formatCurrency(remaining)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-xs font-mono text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(Number(p.amount_due))}
                        </div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : p.payment_status === "partial"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}
                        >
                          {isPaid ? "Lunas" : p.payment_status === "partial" ? "Sebagian" : "Belum Bayar"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Verification Note Box */}
        <div className="bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-plus-jakarta leading-relaxed">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-0.5">
              Konfirmasi & Bukti Pembayaran
            </span>
            <span>
              Pembayaran SPP yang dilakukan melalui transfer bank atau tunai di kantor yayasan akan diproses dan diverifikasi oleh bendahara PKBM Baitusyukur Learning Center dalam 1×24 jam kerja.
            </span>
          </div>
        </div>

      </main>
    </div>
  );
}
