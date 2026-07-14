import { ApiError } from "@/lib/api/client";
import { UX_COPY } from "@/lib/ux-copy";

const ERROR_MESSAGES: Record<string, string> = {
  ERR_FORBIDDEN: UX_COPY.error.forbidden,
  ERR_UNAUTHORIZED: UX_COPY.error.unauthorized,
  ERR_NOT_FOUND: UX_COPY.error.notFound,
  ERR_PERIOD_LOCKED: "Periode ini sudah dikunci dan tidak dapat diubah.",
  ERR_SEMESTER_FINALIZED: "Semester ini sudah diselesaikan dan tidak dapat diubah.",
  INVALID_SETTING_REFERENCE: "Konfigurasi periode aktif perlu diperiksa kembali.",
  NETWORK_ERROR: UX_COPY.error.network,
  MALFORMED_RESPONSE: "Respons sistem tidak dapat dibaca. Silakan coba lagi.",
};

export function userFacingError(error: unknown, fallback = UX_COPY.error.default) {
  if (error && typeof error === "object" && "code" in error) {
    return ERROR_MESSAGES[(error as { code: string }).code] || fallback;
  }
  return fallback;
}

export function humanizeError(error: unknown): string {
  if (!error) return "Terjadi kesalahan sistem. Coba lagi.";

  // Handle Geolocation PositionError
  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.code === "number") {
      if (errObj.code === 1) { // GeolocationPositionError.PERMISSION_DENIED
        return "Akses lokasi ditolak. Silakan izinkan akses lokasi pada pengaturan browser Anda.";
      }
      if (errObj.code === 2 || errObj.code === 3) { // POSITION_UNAVAILABLE or TIMEOUT
        return "Sinyal GPS tidak stabil atau tidak aktif. Pastikan Anda berada di area terbuka dan GPS perangkat menyala, lalu coba lagi.";
      }
    }
  }

  if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "LOCKED") {
    const details = (error as any).details;
    const lockedUntil = details?.locked_until;
    if (lockedUntil && typeof lockedUntil === "string") {
      try {
        const dateObj = new Date(lockedUntil);
        if (!isNaN(dateObj.getTime())) {
          const hours = String(dateObj.getHours()).padStart(2, "0");
          const minutes = String(dateObj.getMinutes()).padStart(2, "0");
          return `Terlalu banyak percobaan. Akun dikunci demi keamanan. Silakan coba login kembali pada pukul ${hours}:${minutes}.`;
        }
      } catch (e) {
        console.error("Gagal mem-parsing locked_until:", e);
      }
    }
    return "Terlalu banyak percobaan masuk. Demi keamanan, silakan coba lagi dalam 15 menit.";
  }
  
  let message = "";
  if (error && typeof error === "object" && "code" in error) {
    const apiErr = error as { code: string; message: string };
    if (ERROR_MESSAGES[apiErr.code]) {
      return ERROR_MESSAGES[apiErr.code];
    }
    message = apiErr.message;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    message = String(error);
  }

  const msg = (message || "").toLowerCase();
  if (msg.includes("cannot deactivate/delete subject")) {
    return "Mata pelajaran tidak dapat dinonaktifkan atau dihapus karena masih terhubung dengan penilaian yang sedang berjalan. Silakan selesaikan atau hapus penilaian terkait terlebih dahulu.";
  }
  if (msg.includes("cannot deactivate/delete class")) {
    return "Kelas tidak dapat dinonaktifkan atau dihapus karena masih memiliki siswa aktif. Pindahkan siswa di kelas ini ke kelas lain terlebih dahulu.";
  }
  if (msg.includes("cannot deactivate/suspend user")) {
    return "Akun tidak dapat dinonaktifkan karena guru ini masih ditugaskan sebagai wali kelas aktif. Bebaskan tugas guru ini dari kelas terkait terlebih dahulu.";
  }
  if (msg.includes("cannot restore student")) {
    const match = message.match(/previous class \(([^)]+)\) is inactive/i);
    const className = match ? match[1] : "";
    return `Siswa tidak dapat dipulihkan karena kelas sebelumnya${className ? ` (${className})` : ""} berstatus tidak aktif. Silakan perbarui penugasan kelas siswa terlebih dahulu.`;
  }
  if (msg.includes("cannot restore subject") && msg.includes("semester is locked")) {
    return "Mata pelajaran tidak dapat dipulihkan karena semester aktif saat ini sudah dikunci.";
  }

  if (msg.includes("invalid credentials") || msg.includes("not found") || msg.includes("not_found") || msg.includes("credentials") || msg.includes("cocok")) {
    return "NISN, Tanggal Lahir, atau PIN tidak cocok. Silakan periksa kembali.";
  }
  if (msg.includes("rate limit") || msg.includes("rate_limit") || msg.includes("locked") || msg.includes("too many requests") || msg.includes("percobaan") || msg.includes("429")) {
    return "Terlalu banyak percobaan masuk. Demi keamanan, silakan coba lagi dalam 15 menit.";
  }
  if (msg.includes("failed to fetch") || msg.includes("timeout") || msg.includes("network") || msg.includes("offline") || msg.includes("koneksi")) {
    return UX_COPY.error.network;
  }
  
  return message || UX_COPY.error.default;
}
