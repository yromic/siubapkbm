/**
 * SIUBA Notification Service
 * ===========================
 * Satu-satunya sumber notifikasi di seluruh aplikasi.
 * Semua halaman wajib menggunakan `notify.*` daripada toast custom.
 *
 * API:
 *   notify.success(message, options?)
 *   notify.error(message, options?)
 *   notify.warning(message, options?)
 *   notify.info(message, options?)
 *   notify.loading(message, options?)
 *   notify.promise(promise, messages)
 *   notify.dismiss(toastId?)
 */

import { toast, type ExternalToast } from "sonner";

type NotifyOptions = ExternalToast;

export const notify = {
  /** Notifikasi sukses — aksi berhasil diselesaikan */
  success(message: string, options?: NotifyOptions) {
    return toast.success(message, options);
  },

  /** Notifikasi error — aksi gagal, perlu perhatian pengguna */
  error(message: string, options?: NotifyOptions) {
    return toast.error(message, {
      duration: 6000, // Error lebih lama agar pengguna sempat membaca
      ...options,
    });
  },

  /** Notifikasi peringatan — kondisi tidak ideal, bukan error kritis */
  warning(message: string, options?: NotifyOptions) {
    return toast.warning(message, options);
  },

  /** Notifikasi informasi — konteks atau panduan tambahan */
  info(message: string, options?: NotifyOptions) {
    return toast.info(message, options);
  },

  /**
   * Notifikasi loading — untuk proses async singkat.
   * Kembalikan toast ID untuk dismiss manual.
   */
  loading(message: string, options?: NotifyOptions) {
    return toast.loading(message, options);
  },

  /**
   * Notifikasi promise — otomatis update dari loading → success/error.
   * Rekomendasi untuk operasi simpan/submit yang memerlukan feedback real-time.
   *
   * @example
   * notify.promise(saveData(), {
   *   loading: "Menyimpan data...",
   *   success: "Data berhasil disimpan",
   *   error: "Gagal menyimpan data",
   * });
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) {
    return toast.promise(promise, messages);
  },

  /**
   * Tutup toast secara manual.
   * Tanpa argumen = tutup semua toast.
   */
  dismiss(toastId?: string | number) {
    return toast.dismiss(toastId);
  },
} as const;
