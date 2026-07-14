"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { changeOwnPasswordApi } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer } from "@/components/ui-states";
import { InfoBanner } from "@/components/ui/info-banner";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

export default function ChangePasswordPage() {
  const { token, user, clearSession } = useAuth();
  
  // Form states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility states
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Status states
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Auto redirect countdown on success
  useEffect(() => {
    if (!success) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          clearSession();
          window.location.href = "/login";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [success, clearSession]);

  if (!user) return null;

  const handleManualLogout = () => {
    clearSession();
    window.location.href = "/login";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Frontend Validations
    if (!oldPassword) {
      setFormError("Password lama wajib diisi.");
      return;
    }
    if (!newPassword) {
      setFormError("Password baru wajib diisi.");
      return;
    }
    if (newPassword.length < 8) {
      setFormError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Konfirmasi password tidak sesuai.");
      return;
    }

    if (!token) return;

    setFormLoading(true);

    try {
      await changeOwnPasswordApi(token, oldPassword, newPassword);
      setSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) {
        const apiErr = err as { code: string; message: string };
        if (apiErr.code === "ERR_UNAUTHORIZED") {
          setFormError("Sesi Anda telah berakhir. Silakan login kembali.");
          setTimeout(() => {
            clearSession();
            window.location.href = "/login";
          }, 3000);
        } else if ((apiErr.message || "").includes("Incorrect current password")) {
          setFormError("Password lama tidak sesuai.");
        } else {
          setFormError(apiErr.message);
        }
      } else {
        setFormError("Terjadi kesalahan sistem saat mencoba mengubah password. Silakan coba kembali.");
      }
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ResponsiveContainer className="max-w-lg mx-auto space-y-6">
      <PageHeader
        title="Ganti Password"
        description="Amankan akun Anda dengan memperbarui kata sandi secara berkala."
      />

      <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password Lama */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Password Lama
            </label>
            <div className="relative">
              <input
                type={showOld ? "text" : "password"}
                placeholder="Masukkan password lama"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={formLoading || success}
                className="w-full pl-4 pr-11 py-3 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                disabled={formLoading || success}
                className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showOld ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Password Baru */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Password Baru
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={formLoading || success}
                className="w-full pl-4 pr-11 py-3 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                disabled={formLoading || success}
                className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Konfirmasi Password Baru */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Konfirmasi Password Baru
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={formLoading || success}
                className="w-full pl-4 pr-11 py-3 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-[#468432] focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-zinc-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                disabled={formLoading || success}
                className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {formError && (
            <InfoBanner variant="error" description={formError} />
          )}

          <button
            type="submit"
            disabled={formLoading || success}
            className="w-full flex justify-center items-center gap-2 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] py-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 shadow-md shadow-[#468432]/10"
          >
            {formLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengubah password...</span>
              </>
            ) : (
              <span>Ubah Password</span>
            )}
          </button>
        </form>
      </div>

      {/* Success Modal — Using Radix Dialog for Esc key, focus trap, a11y */}
      <Dialog.Root open={success} onOpenChange={() => {}}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 flex flex-col items-center text-center data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-[#468432] dark:text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Password Berhasil Diubah
            </Dialog.Title>

            <Dialog.Description className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Password berhasil diubah. Silakan login kembali menggunakan password baru Anda.
            </Dialog.Description>

            <button
              onClick={handleManualLogout}
              className="w-full py-3 rounded-[12px] text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors shadow-md cursor-pointer"
            >
              Ke Halaman Login ({countdown}s)
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ResponsiveContainer>
  );
}
