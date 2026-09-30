"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { useWebsiteBranding } from "@/hooks/useWebsiteBranding";
import { humanizeError } from "@/lib/utils/ui-error";
import { InfoBanner } from "@/components/ui/info-banner";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Lock,
  User,
  School,
  Eye,
  EyeOff,
  ChevronDown,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import {
  getParentPublicClassStudentsApi,
  ParentPublicClassItem,
  ParentPublicClassStudentItem,
} from "@/lib/api/parent";
import { Altcha } from "@/components/Altcha";

export default function ParentLoginPage() {
  const { loginByStudent, login } = useParentAuth();
  const { branding } = useWebsiteBranding();

  // Mode: 'EASY' (Pilih Kelas > Nama > PIN DDMM) or 'LEGACY' (NISN + Tanggal Lahir)
  const [loginMode, setLoginMode] = useState<"EASY" | "LEGACY">("EASY");

  // Easy mode state
  const [classes, setClasses] = useState<ParentPublicClassItem[]>([]);
  const [students, setStudents] = useState<ParentPublicClassStudentItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Legacy mode state (fallback)
  const [nisn, setNisn] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [legacyPin, setLegacyPin] = useState("");

  // Common UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExpiredAlert, setShowExpiredAlert] = useState(false);

  // ALTCHA state
  const [altchaChallenge, setAltchaChallenge] = useState<any>(null);
  const [altchaPayload, setAltchaPayload] = useState("");

  // Load public classes & students on mount
  useEffect(() => {
    async function loadDirectory() {
      try {
        setLoadingData(true);
        const res = await getParentPublicClassStudentsApi();
        setClasses(res.classes || []);
        setStudents(res.students || []);
      } catch (err) {
        console.error("Failed to load class students directory:", err);
      } finally {
        setLoadingData(false);
      }
    }
    loadDirectory();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "true") {
        const timer = setTimeout(() => setShowExpiredAlert(true), 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Filter students for the selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((s) => s.class_id === selectedClassId);
  }, [students, selectedClassId]);

  const selectedStudentObj = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // Handle Easy Form Submit
  const handleEasySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClassId) {
      setError("Silakan pilih kelas terlebih dahulu.");
      return;
    }
    if (!selectedStudentId) {
      setError("Silakan pilih nama anak Anda.");
      return;
    }
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError("Silakan masukkan PIN 4 digit (tanggal & bulan lahir anak).");
      return;
    }
    if (!/^\d{4,8}$/.test(cleanPin)) {
      setError("PIN harus berupa angka (contoh: 1708 untuk 17 Agustus).");
      return;
    }

    setSubmitting(true);
    try {
      await loginByStudent(selectedStudentId, cleanPin, altchaPayload);
    } catch (err: any) {
      if (err && err.code === "ERR_ALTCHA_REQUIRED") {
        setError("Verifikasi keamanan diperlukan.");
        if (err.details && typeof err.details.challenge === "object") {
          setAltchaChallenge(err.details.challenge);
        }
      } else if (err && typeof err === "object" && "message" in err) {
        setError(err.message || humanizeError(err));
      } else {
        setError("Gagal terhubung dengan server. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Legacy Form Submit
  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNisn = nisn.trim();
    const trimmedBirthDate = birthDate.trim();
    const trimmedPin = legacyPin.trim();

    if (!trimmedNisn || !trimmedBirthDate || !trimmedPin) {
      setError("Semua kolom (NISN, Tanggal Lahir, PIN) wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedNisn, trimmedBirthDate, trimmedPin, altchaPayload);
    } catch (err: any) {
      if (err && typeof err === "object" && "message" in err) {
        setError(err.message || humanizeError(err));
      } else {
        setError("Gagal terhubung dengan server. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#fdfbf7] dark:bg-zinc-950 px-4 py-8 sm:py-12">
      {/* Top Header Branding */}
      <header className="w-full max-w-md mx-auto text-center mb-6">
        <Link href="/" className="inline-flex flex-col items-center gap-2 group" aria-label="Beranda">
          {branding.logo_url ? (
            <div className="relative h-12 w-36">
              <Image
                src={branding.logo_url}
                alt={branding.short_name}
                fill
                sizes="144px"
                priority
                className="object-contain"
              />
            </div>
          ) : (
            <span className="font-fredoka text-3xl font-extrabold bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
              {branding.short_name}
            </span>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Portal Wali Murid
          </span>
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200/90 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold font-fredoka text-zinc-900 dark:text-zinc-50">
            Selamat Datang, Ayah/Bunda
          </h1>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-plus-jakarta leading-relaxed">
            Silakan pilih kelas, nama Ananda, dan masukkan PIN akses.
          </p>
        </div>

            {showExpiredAlert && !error && (
              <div className="mb-4">
                <InfoBanner variant="warning" description="Sesi Anda telah berakhir. Silakan masuk kembali." />
              </div>
            )}
            {error && (
              <div className="mb-4">
                <InfoBanner variant="error" description={error} />
              </div>
            )}

            {loginMode === "EASY" ? (
              /* ========================================================================= */
              /* EASY LOGIN: Pilih Kelas -> Pilih Nama -> PIN DDMM                         */
              /* ========================================================================= */
              <form onSubmit={handleEasySubmit} className="space-y-4">
                {/* Langkah 1: Pilih Kelas */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>1. Pilih Kelas / Rombel</span>
                  </label>
                  <div className="relative">
                    <select
                      disabled={loadingData || submitting}
                      value={selectedClassId}
                      onChange={(e) => {
                        setSelectedClassId(e.target.value);
                        setSelectedStudentId("");
                      }}
                      className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">
                        {loadingData ? "Memuat daftar kelas..." : "— Pilih Kelas / Rombel Anak —"}
                      </option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name.startsWith("Kelas") ? c.name : `Kelas ${c.name}`} (Tingkat {c.level})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Langkah 2: Pilih Nama Anak */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>2. Pilih Nama Anak</span>
                  </label>
                  <div className="relative">
                    <select
                      disabled={!selectedClassId || submitting}
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedClassId
                          ? "Pilih kelas terlebih dahulu..."
                          : classStudents.length === 0
                          ? "Tidak ada murid terdaftar di kelas ini"
                          : "— Sentuh untuk memilih nama anak —"}
                      </option>
                      {classStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {selectedStudentObj && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> {selectedStudentObj.full_name} dipilih
                    </p>
                  )}
                </div>

                {/* Langkah 3: PIN 4 Digit (DDMM Tanggal Lahir) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>3. PIN Akses (4 Digit)</span>
                    </label>
                    <span className="text-[10px] text-zinc-400 font-medium">Format: DDMM</span>
                  </div>
                  <div className="relative">
                    <input
                      id="pin"
                      name="pin"
                      type={showPin ? "text" : "password"}
                      pattern="\d*"
                      inputMode="numeric"
                      maxLength={6}
                      disabled={submitting}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-3 text-sm font-bold tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:tracking-normal placeholder:font-normal placeholder:text-xs placeholder-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                      placeholder="Contoh: 1708 (untuk 17 Agustus)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Hint ramah ortu */}
                  <div className="mt-1.5 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-[11px] text-emerald-900 dark:text-emerald-300 flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <b>Petunjuk PIN:</b> Masukkan 2 digit tanggal + 2 digit bulan lahir ananda (contoh: lahir <b>5 Mei</b> masukkan <b>0505</b>).
                    </span>
                  </div>
                </div>

                {altchaChallenge && (
                  <Altcha challenge={altchaChallenge} onVerify={setAltchaPayload} />
                )}

                {/* Tombol Masuk */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || (altchaChallenge !== null && !altchaPayload)}
                    className="flex w-full justify-center items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 py-3.5 text-sm font-bold text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Membuka Profil...</span>
                      </>
                    ) : (
                      <span>Buka Profil Ananda</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* ========================================================================= */
              /* LEGACY LOGIN FALLBACK: NISN + Tgl Lahir + PIN                             */
              /* ========================================================================= */
              <form onSubmit={handleLegacySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    NISN Siswa
                  </label>
                  <input
                    type="text"
                    pattern="\d*"
                    inputMode="numeric"
                    disabled={submitting}
                    value={nisn}
                    onChange={(e) => setNisn(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100"
                    placeholder="Contoh: 0123456789"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tanggal Lahir (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    disabled={submitting}
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    PIN Akses
                  </label>
                  <input
                    type="password"
                    disabled={submitting}
                    value={legacyPin}
                    onChange={(e) => setLegacyPin(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100"
                    placeholder="Masukkan PIN"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full justify-center items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition-all shadow-md cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Masuk"}
                </button>
              </form>
            )}

          {/* Mode switcher & Help */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center space-y-2">
            {loginMode === "EASY" ? (
              <button
                type="button"
                onClick={() => {
                  setLoginMode("LEGACY");
                  setError(null);
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Gunakan cara lama (login dengan nomor NISN)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLoginMode("EASY");
                  setError(null);
                }}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                ← Kembali ke cara mudah (Pilih Kelas & Nama Ananda)
              </button>
            )}

            <div className="pt-1">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span>Butuh bantuan akses? Hubungi Wali Kelas atau Admin PKBM.</span>
              </p>
            </div>
          </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full max-w-md mx-auto text-center py-4 text-[10px] font-medium tracking-wider uppercase text-zinc-400">
        © {new Date().getFullYear()} {branding.school_name}
      </footer>
    </div>
  );
}
