"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParentAuth } from "@/hooks/useParentAuth";
import { humanizeError } from "@/lib/utils/ui-error";
import { InfoBanner } from "@/components/ui/info-banner";
import Link from "next/link";
import {
  Loader2,
  Lock,
  User,
  School,
  Eye,
  EyeOff,
  ChevronDown,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  HeartHandshake,
} from "lucide-react";
import {
  getParentPublicClassStudentsApi,
  ParentPublicClassItem,
  ParentPublicClassStudentItem,
} from "@/lib/api/parent";
import { Altcha } from "@/components/Altcha";

export default function ParentLoginPage() {
  const { loginByStudent, login } = useParentAuth();

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
        setShowExpiredAlert(true);
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
    <div className="min-h-screen flex flex-col justify-between bg-[#fdfbf7] dark:bg-zinc-950 px-4 py-6 sm:py-8 lg:py-12">
      {/* Top logo/home link */}
      <header className="w-full max-w-5xl mx-auto mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="font-fredoka text-2xl font-bold text-[#468432] dark:text-emerald-400 hover:opacity-85 transition-opacity flex items-center gap-2"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-fredoka font-bold text-base shadow-xs">
            S
          </div>
          <span className="tracking-tight">SIUBA PKBM</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
            PKBM Baitusyukur Learning Center
          </span>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Portal Wali Murid
          </span>
        </div>
      </header>

      {/* Main Container - Split View on Desktop */}
      <main className="w-full max-w-5xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left Side: Desktop Branding & Institutional Highlights (hidden on mobile, visible lg:block) */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 rounded-[28px] bg-gradient-to-br from-emerald-800 via-emerald-900 to-zinc-900 text-white shadow-xl shadow-emerald-950/20 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/50 border border-emerald-500/30 text-emerald-200 text-xs font-semibold mb-6 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              Sistem Informasi Terpadu Wali Murid
            </div>
            <h2 className="text-3xl font-extrabold font-fredoka tracking-tight leading-tight text-white mb-3">
              Pantau Tumbuh Kembang Ananda Bersama SIUBA
            </h2>
            <p className="text-sm text-emerald-100/90 leading-relaxed font-plus-jakarta mb-8">
              Akses cepat, transparan, dan terpercaya bagi ayah dan bunda untuk mendampingi pendidikan holistik ananda.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Karakter Unggulan UTSMAN</h4>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Ulet, Tanggung Jawab, Santun, Mandiri, Amanah, dan Nalar Kritis yang terpantau berkala.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">KKTP & Asesmen Kurikulum Merdeka</h4>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Evaluasi capaian Tujuan Pembelajaran secara objektif dan terukur tiap mata pelajaran.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Presensi Harian & Tagihan SPP</h4>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Cek kedisiplinan kehadiran di kelas dan unduh struk resmi riwayat administrasi iuran.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-emerald-700/50 flex items-center justify-between text-[11px] text-emerald-200/80 font-medium">
            <span>Paket A (Setara SD) PKBM Baitusyukur</span>
            <span>Aman & Terenkripsi</span>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-200/90 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="text-center lg:text-left mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto lg:mx-0 mb-3 border border-emerald-100 dark:border-emerald-900">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 font-fredoka">
                Selamat Datang, Bapak/Ibu
              </h1>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-plus-jakarta leading-relaxed">
                Pantau perkembangan belajar, karakter budaya, dan kehadiran ananda secara langsung.
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
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <b>Petunjuk PIN:</b> Masukkan 2 digit tanggal + 2 digit bulan lahir anak (contoh: lahir <b>5 Mei</b> masukkan <b>0505</b>).
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
                      <span>Buka Profil Anak</span>
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
          </div>

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
                ← Kembali ke cara mudah (Pilih Kelas & Nama Anak)
              </button>
            )}

            <div className="pt-1">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span>Butuh bantuan akses? Hubungi Wali Kelas atau Admin PKBM.</span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full max-w-5xl mx-auto text-center py-4 text-[10px] font-medium tracking-wider uppercase text-zinc-400">
        © {new Date().getFullYear()} PKBM SIUBA Baitusyukur Learning Center. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}
