"use client";

import React, { useState, useEffect } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { humanizeError } from "@/lib/utils/ui-error";
import { InfoBanner } from "@/components/ui/info-banner";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Turnstile } from "@/components/Turnstile";

export default function ParentLoginPage() {
  const { login } = useParentAuth();
  const [nisn, setNisn] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExpiredAlert, setShowExpiredAlert] = useState(false);

  // Turnstile state
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "true") {
        setShowExpiredAlert(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNisn = nisn.trim();
    const trimmedBirthDate = birthDate.trim();
    const trimmedPin = pin.trim();

    if (!trimmedNisn || !trimmedBirthDate || !trimmedPin) {
      setError("Semua field (NISN, Tanggal Lahir, PIN) wajib diisi.");
      return;
    }

    if (!/^\d+$/.test(trimmedNisn)) {
      setError("NISN harus berupa angka.");
      return;
    }

    if (!/^\d{4,8}$/.test(trimmedPin)) {
      setError("PIN harus berupa angka antara 4 sampai 8 digit.");
      return;
    }

    setLoading(true);
    try {
      await login(trimmedNisn, trimmedBirthDate, trimmedPin, turnstileToken);
    } catch (err: any) {
      if (err && err.code === "ERR_TURNSTILE_REQUIRED") {
        setError("Verifikasi keamanan diperlukan.");
        if (err.details && typeof err.details.siteKey === "string") {
          setSiteKey(err.details.siteKey);
        }
      } else if (err && typeof err === "object" && "code" in err) {
        setError(humanizeError(err));
      } else {
        setError("Gagal terhubung dengan server. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-start bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      {/* Top logo/home link */}
      <div className="w-full max-w-md mx-auto mb-6 flex justify-start">
        <Link href="/" className="font-fredoka text-xl font-bold text-[#468432] dark:text-emerald-400 hover:opacity-85 transition-opacity">
          SIUBA
        </Link>
      </div>

      {/* Main card */}
      <main className="w-full max-w-md mx-auto my-auto p-6 sm:p-8 bg-white dark:bg-[#171717] rounded-[24px] border border-zinc-150 dark:border-zinc-850 shadow-xl shadow-zinc-100 dark:shadow-none transition-all duration-300">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Portal Orang Tua
          </h1>
          <p className="mt-1.5 text-xs text-zinc-650 dark:text-zinc-400">
            Gunakan NISN, Tanggal Lahir, & PIN untuk memantau perkembangan anak
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {showExpiredAlert && !error && (
            <InfoBanner variant="warning" description="Sesi Anda telah berakhir. Silakan masuk kembali." />
          )}
          {error && (
            <InfoBanner variant="error" description={error} />
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="nisn" className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                NISN Siswa
              </label>
              <input
                id="nisn"
                name="nisn"
                type="text"
                pattern="\d*"
                inputMode="numeric"
                disabled={loading}
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                className="block w-full rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-405 focus:border-[#468432] focus:ring-1 focus:ring-[#468432] outline-none transition-all font-data"
                placeholder="Contoh: 0123456789"
              />
            </div>

            <div>
              <label htmlFor="birthDate" className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Tanggal Lahir Siswa
              </label>
              <DatePicker
                id="birthDate"
                value={birthDate}
                onChange={(val) => setBirthDate(val)}
                disabled={loading}
                placeholder="Pilih tanggal lahir..."
              />
            </div>

            <div>
              <label htmlFor="pin" className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                PIN Akses Orang Tua
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                pattern="\d*"
                inputMode="numeric"
                maxLength={8}
                disabled={loading}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="block w-full rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-405 focus:border-[#468432] focus:ring-1 focus:ring-[#468432] outline-none transition-all font-data"
                placeholder="Masukkan PIN Anda"
              />
            </div>
          </div>

          {siteKey && (
            <Turnstile siteKey={siteKey} onVerify={setTurnstileToken} />
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || (siteKey !== null && !turnstileToken)}
              className="flex w-full justify-center items-center gap-2 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] px-4 py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-55 disabled:cursor-not-allowed shadow-lg shadow-[#468432]/10 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <span>Masuk Portal</span>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center border-t border-zinc-100 dark:border-zinc-850 pt-5">
          <p className="text-xs text-zinc-550 dark:text-zinc-400">
            Kesulitan masuk? Hubungi Admin Sekolah untuk informasi NISN atau mengatur ulang PIN Anda.
          </p>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full max-w-md mx-auto text-center py-4 text-[10px] font-medium tracking-wider uppercase text-zinc-400">
        © {new Date().getFullYear()} PKBM SIUBA. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}
