"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { getParentSppStatusApi, SppPayment } from "@/lib/api/finance";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function SppBanner() {
  const { token } = useParentAuth();
  const [currentBill, setCurrentBill] = useState<SppPayment | null>(null);
  const [arrears, setArrears] = useState<SppPayment[]>([]);
  const [totalArrearsAmount, setTotalArrearsAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSppStatus = useCallback(async (sessionToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getParentSppStatusApi(sessionToken);
      setCurrentBill(response.current_bill);
      setArrears(response.arrears || []);
      setTotalArrearsAmount(response.total_arrears_amount || 0);
    } catch (err: unknown) {
      console.error("Gagal memuat status SPP:", err);
      setError("Gagal memuat info SPP.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    
    // Delay request to prevent concurrent request congestion on GAS backend
    const timer = setTimeout(() => {
      fetchSppStatus(token);
    }, 1500);

    return () => clearTimeout(timer);
  }, [token, fetchSppStatus]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(val);
  };

  if (!token || loading) {
    return (
      <div className="w-full bg-zinc-100 dark:bg-zinc-900 animate-pulse h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center px-4">
        <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
      </div>
    );
  }

  if (error) {
    return null; // Don't block UI if request fails
  }

  const hasArrears = totalArrearsAmount > 0;
  const currentRemaining = currentBill ? currentBill.amount_due - currentBill.amount_paid : 0;
  const totalOutstanding = currentRemaining + totalArrearsAmount;

  const months = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  if (totalOutstanding === 0) {
    return (
      <div className="w-full transition duration-200">
        <div className="flex items-center justify-between p-3 px-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-450" />
            <span className="font-semibold text-emerald-800 dark:text-emerald-400">
              Semua Tagihan SPP Lunas
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 transition duration-200">
      <div className={`p-4 rounded-xl border text-xs space-y-3 shadow-sm transition bg-red-50/75 dark:bg-red-950/15 border-red-200 dark:border-red-900/45 text-red-900 dark:text-red-400`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-650 dark:text-red-400" />
            <span className="font-bold">
              {arrears.length > 1
                ? `Terdapat tunggakan SPP sebanyak ${arrears.length} Bulan (Total: ${formatCurrency(totalOutstanding)})`
                : hasArrears
                ? "Pemberitahuan Tunggakan SPP"
                : "Tagihan SPP Belum Lunas"}
            </span>
          </div>
          <button 
            onClick={() => token && fetchSppStatus(token)}
            className="text-[10px] font-semibold underline hover:no-underline transition focus:outline-none"
          >
            Perbarui
          </button>
        </div>

        <div className="flex justify-between items-center bg-white/50 dark:bg-zinc-950/30 p-2.5 rounded-lg border border-current/10 font-mono">
          <div>
            <span className="text-[10px] block opacity-70">TOTAL KEKURANGAN</span>
            <span className="text-sm font-extrabold">{formatCurrency(totalOutstanding)}</span>
          </div>
          <div className="text-right text-[10px] opacity-80 space-y-0.5">
            {currentRemaining > 0 && currentBill && (
              <div>Bulan ini: {formatCurrency(currentRemaining)} ({months[currentBill.month]})</div>
            )}
            {hasArrears && (
              <div>Tunggakan: {formatCurrency(totalArrearsAmount)} ({arrears.length} bulan)</div>
            )}
          </div>
        </div>

        {hasArrears && (
          <div className="border-t border-current/10 pt-2 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider block opacity-70">Detail Tunggakan:</span>
            <div className="max-h-20 overflow-y-auto space-y-1">
              {arrears.map((item) => (
                <div key={item.id} className="flex justify-between text-[10px] opacity-80">
                  <span>{months[item.month]} {item.year}</span>
                  <span className="font-mono">{formatCurrency(item.amount_due - item.amount_paid)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] opacity-70 text-center leading-normal">
          Harap lakukan pembayaran SPP melalui Operator Sekolah PKBM untuk verifikasi status lunas.
        </p>
      </div>
    </div>
  );
}
