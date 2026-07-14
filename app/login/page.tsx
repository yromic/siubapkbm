"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExpiredAlert, setShowExpiredAlert] = useState(false);

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
      await login(trimmedIdentifier, trimmedPassword);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) {
        const apiErr = err as { code: string; message: string };
        if (apiErr.code === "ERR_INVALID_CREDENTIALS") {
          setError("Email atau password salah");
        } else if (apiErr.code === "ERR_ACCOUNT_LOCKED") {
          const match = (apiErr.message || "").match(/\d+/);
          const minutes = match ? match[0] : "15";
          setError(`Akun terkunci, coba lagi dalam ${minutes} menit`);
        } else if (apiErr.code === "ERR_INACTIVE_ACCOUNT") {
          setError("Akun tidak aktif, hubungi administrator");
        } else {
          setError(apiErr.message);
        }
      } else {
        setError("Terjadi kesalahan sistem saat mencoba login. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-850 shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Login Staff
          </h2>
          <p className="mt-2 text-sm text-zinc-650 dark:text-zinc-400">
            Sistem Monitoring Akademik & Karakter PKBM
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {showExpiredAlert && !error && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-100 dark:border-amber-900/30 text-sm font-medium text-amber-700 dark:text-amber-400">
              Sesi Anda telah berakhir. Silakan masuk kembali.
            </div>
          )}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-sm font-medium text-red-650 dark:text-red-400">
              {error}
            </div>
          )}

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

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/10"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Memproses Login...</span>
                </>
              ) : (
                <span>Masuk Ke Sistem</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
