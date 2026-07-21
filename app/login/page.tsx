"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Loader2 } from "lucide-react";
import { Altcha } from "@/components/Altcha";

export default function LoginPage() {
  const { refreshCurrentUser } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExpiredAlert, setShowExpiredAlert] = useState(false);

  // ALTCHA state
  const [altchaChallenge, setAltchaChallenge] = useState<any>(null);
  const [altchaPayload, setAltchaPayload] = useState("");

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

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

    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      setError("Username / email dan password tidak boleh kosong.");
      return;
    }

    setLoading(true);
    try {
      // Call the API route directly to orchestrate captcha and MFA flows
      const res = await apiRequest<{
        mfaRequired?: boolean;
        tempToken?: string;
        token?: string;
        user?: any;
      }>("login", {
        identifier: trimmedIdentifier,
        password: trimmedPassword,
        altchaPayload
      });

      if (res.mfaRequired && res.tempToken) {
        setMfaRequired(true);
        setTempToken(res.tempToken);
        setError(null);
      } else {
        // Successful login, refresh context and redirect
        await refreshCurrentUser();
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === "ERR_INVALID_CREDENTIALS") {
          setError("Email atau password salah");
        } else if (err.code === "ERR_ACCOUNT_LOCKED") {
          const match = (err.message || "").match(/\d+/);
          const minutes = match ? match[0] : "15";
          setError(`Akun terkunci, coba lagi dalam ${minutes} menit`);
        } else if (err.code === "ERR_INACTIVE_ACCOUNT") {
          setError("Akun tidak aktif, hubungi administrator");
        } else if (err.code === "ERR_ALTCHA_REQUIRED") {
          setError("Verifikasi keamanan diperlukan.");
          if (err.details && typeof err.details.challenge === "object") {
            setAltchaChallenge(err.details.challenge);
          }
        } else {
          setError(err.message);
        }
      } else {
        setError("Terjadi kesalahan sistem saat mencoba login. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = mfaCode.trim();
    const trimmedBackup = backupCode.trim();

    if (useBackupCode && !trimmedBackup) {
      setError("Kode pemulihan tidak boleh kosong.");
      return;
    }
    if (!useBackupCode && !trimmedCode) {
      setError("Kode verifikasi tidak boleh kosong.");
      return;
    }

    setLoading(true);
    try {
      // Custom endpoint call using fetch to avoid registering "mfa" in ACTION_MAP if not present
      const mfaRes = await fetch("/api/v1/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempToken,
          code: useBackupCode ? undefined : trimmedCode,
          backupCode: useBackupCode ? trimmedBackup : undefined
        })
      });

      const mfaData = await mfaRes.json();
      if (!mfaRes.ok || mfaData.status === "error") {
        const errMsg = mfaData.error?.message || mfaData.message || "Kode verifikasi salah.";
        if (mfaData.error?.code === "ERR_ACCOUNT_LOCKED") {
          setError("Akun terkunci karena terlalu banyak kesalahan.");
        } else {
          setError(errMsg);
        }
        return;
      }

      // Successful MFA validation, update user context
      await refreshCurrentUser();
    } catch (err: any) {
      setError("Gagal memverifikasi kode keamanan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-850 shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            {mfaRequired ? "Verifikasi Dua Faktor" : "Login Staff"}
          </h2>
          <p className="mt-2 text-sm text-zinc-650 dark:text-zinc-400">
            {mfaRequired 
              ? "Masukkan kode keamanan dari aplikasi authenticator Anda."
              : "Sistem Monitoring Akademik & Karakter PKBM"
            }
          </p>
        </div>

        {showExpiredAlert && !error && !mfaRequired && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/30 text-sm font-medium text-amber-700 dark:text-amber-400">
            Sesi Anda telah berakhir. Silakan masuk kembali.
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-sm font-medium text-red-650 dark:text-red-400">
            {error}
          </div>
        )}

        {!mfaRequired ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Username / Email
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  disabled={loading}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:focus:border-emerald-500 outline-none transition-all"
                  placeholder="Masukkan username atau email"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:focus:border-emerald-500 outline-none transition-all"
                  placeholder="Masukkan password Anda"
                />
              </div>
            </div>

            {altchaChallenge && (
              <Altcha challenge={altchaChallenge} onVerify={setAltchaPayload} />
            )}

            <div>
              <button
                type="submit"
                disabled={loading || (altchaChallenge !== null && !altchaPayload)}
                className="flex w-full justify-center items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memproses Login...</span>
                  </>
                ) : (
                  <span>Masuk Ke Sistem</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleMfaSubmit}>
            <div className="space-y-4">
              {!useBackupCode ? (
                <div>
                  <label
                    htmlFor="mfaCode"
                    className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Kode Authenticator (6 Digit)
                  </label>
                  <input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    disabled={loading}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="block w-full text-center tracking-widest text-lg font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:focus:border-emerald-500 outline-none transition-all"
                    placeholder="000000"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="backupCode"
                    className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Kode Pemulihan Cadangan (Backup Code)
                  </label>
                  <input
                    id="backupCode"
                    name="backupCode"
                    type="text"
                    disabled={loading}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    className="block w-full text-center font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:focus:border-emerald-500 outline-none transition-all"
                    placeholder="Masukkan kode pemulihan"
                  />
                </div>
              )}
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setUseBackupCode(!useBackupCode);
                }}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-450 transition-colors"
              >
                {useBackupCode 
                  ? "Gunakan Kode Authenticator" 
                  : "Gunakan Kode Pemulihan Cadangan"
                }
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Verifikasi & Masuk</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
