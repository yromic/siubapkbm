/**
 * Centralized UX Copy System for SIUBA
 * Provides human-centered, clear, and professional Indonesian feedback.
 */

export const UX_COPY = {
  // --- AUTHENTICATION ---
  auth: {
    loginSuccess: "Selamat datang kembali.",
    logoutSuccess: "Anda telah keluar dari sistem secara aman.",
    sessionExpired: "Sesi Anda telah berakhir demi keamanan. Silakan masuk kembali.",
    incorrectPassword: "Kata sandi yang Anda masukkan tidak sesuai. Silakan coba kembali.",
    userNotFound: "Nama pengguna atau email tidak terdaftar di sistem.",
    accountInactive: "Akun Anda saat ini tidak aktif. Silakan hubungi Administrator.",
  },

  // --- GENERAL ERRORS ---
  error: {
    default: "Sistem tidak dapat memproses permintaan saat ini. Silakan coba beberapa saat lagi.",
    network: "Koneksi internet terputus atau tidak stabil. Periksa koneksi Anda lalu coba kembali.",
    unauthorized: "Sesi Anda telah berakhir. Silakan masuk kembali.",
    forbidden: "Anda tidak memiliki hak akses untuk melakukan tindakan ini.",
    validation: "Ada beberapa data yang belum diisi dengan benar. Mohon periksa kembali formulir Anda.",
    notFound: "Data yang Anda cari tidak ditemukan atau telah dihapus.",
    serverError: "Terjadi kendala pada server kami. Mohon coba beberapa saat lagi.",
    timeout: "Waktu permintaan habis karena server terlalu sibuk. Silakan coba kembali.",
  },

  // --- GENERAL LOADERS ---
  loading: {
    fetch: "Memuat data...",
    save: "Menyimpan perubahan...",
    delete: "Menghapus data permanen...",
    process: "Memproses data...",
    upload: "Mengunggah dokumen...",
    download: "Mengunduh file...",
    import: "Memproses impor data...",
    export: "Membuat laporan...",
    students: "Memproses data siswa...",
  },

  // --- CRUD ACTIONS ---
  crud: {
    create: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Data siswa berhasil ditambahkan.";
      if (lower.includes("guru")) return "Data guru berhasil ditambahkan.";
      if (lower.includes("mata pelajaran") || lower.includes("subjek")) return "Mata pelajaran baru berhasil ditambahkan.";
      if (lower.includes("kelas")) return "Kelas baru berhasil dibuat.";
      return `Data ${entityName} berhasil ditambahkan.`;
    },
    update: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Perubahan data siswa berhasil disimpan.";
      if (lower.includes("guru")) return "Perubahan data guru berhasil disimpan.";
      if (lower.includes("mata pelajaran") || lower.includes("subjek")) return "Perubahan mata pelajaran berhasil disimpan.";
      if (lower.includes("kelas")) return "Perubahan data kelas berhasil disimpan.";
      return `Perubahan data ${entityName} berhasil disimpan.`;
    },
    delete: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Data siswa berhasil dihapus permanen.";
      if (lower.includes("guru")) return "Data guru berhasil dihapus permanen.";
      if (lower.includes("mata pelajaran") || lower.includes("subjek")) return "Mata pelajaran berhasil dihapus permanen.";
      if (lower.includes("kelas")) return "Kelas berhasil dihapus permanen.";
      return `Data ${entityName} berhasil dihapus permanen.`;
    },
    resetPassword: (userName: string) => `Kata sandi untuk ${userName} berhasil disetel ulang.`,
  },

  // --- LIFECYCLE MUTATIONS ---
  lifecycle: {
    active: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Data siswa berhasil diaktifkan kembali.";
      if (lower.includes("guru")) return "Akun guru berhasil diaktifkan kembali.";
      if (lower.includes("kelas")) return "Kelas berhasil diaktifkan kembali.";
      if (lower.includes("pengguna") || lower.includes("user")) return "Akun pengguna berhasil diaktifkan kembali.";
      if (lower.includes("tahun ajaran")) return "Tahun ajaran berhasil diaktifkan.";
      if (lower.includes("semester")) return "Semester berhasil diaktifkan.";
      return `Data ${entityName} berhasil diaktifkan kembali.`;
    },
    inactive: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Akun siswa berhasil dinonaktifkan sementara.";
      if (lower.includes("guru")) return "Akun guru berhasil dinonaktifkan.";
      if (lower.includes("mata pelajaran") || lower.includes("subjek")) return "Mata pelajaran berhasil dinonaktifkan.";
      if (lower.includes("kelas")) return "Kelas berhasil dinonaktifkan.";
      if (lower.includes("pengguna") || lower.includes("user")) return "Akun pengguna berhasil dinonaktifkan.";
      return `Data ${entityName} berhasil dinonaktifkan.`;
    },
    archived: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Siswa berhasil diarsipkan.";
      if (lower.includes("guru")) return "Guru berhasil diarsipkan.";
      if (lower.includes("mata pelajaran") || lower.includes("subjek")) return "Mata pelajaran berhasil dipindahkan ke arsip.";
      if (lower.includes("kelas")) return "Kelas berhasil diarsipkan.";
      if (lower.includes("pengguna") || lower.includes("user")) return "Akun pengguna berhasil diarsipkan.";
      return `Data ${entityName} berhasil diarsipkan.`;
    },
    restored: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Siswa berhasil dipulihkan.";
      if (lower.includes("guru")) return "Guru berhasil dipulihkan.";
      if (lower.includes("mata pelajaran") || lower.includes("subjek")) return "Mata pelajaran berhasil dipulihkan.";
      if (lower.includes("kelas")) return "Kelas berhasil dipulihkan.";
      if (lower.includes("penilaian") || lower.includes("nilai")) return "Hasil penilaian berhasil dipulihkan.";
      if (lower.includes("pengguna") || lower.includes("user")) return "Akun pengguna berhasil dipulihkan.";
      return `Data ${entityName} berhasil dipulihkan.`;
    },
    softDeleted: (entityName: string) => {
      const lower = entityName.toLowerCase();
      if (lower.includes("siswa")) return "Data siswa berhasil dipindahkan ke tempat sampah.";
      if (lower.includes("guru")) return "Data guru berhasil dipindahkan ke tempat sampah.";
      if (lower.includes("pengguna") || lower.includes("user")) return "Akun pengguna berhasil dipindahkan ke tempat sampah.";
      return `Data ${entityName} berhasil dipindahkan ke tempat sampah.`;
    },
  },

  // --- IMPORT & EXPORT ---
  dataExchange: {
    importSuccess: (added: number, skipped: number) => 
      `Data berhasil diimpor. ${added} data ditambahkan. ${skipped} data dilewati karena duplikasi.`,
    exportSuccess: "Laporan berhasil dibuat dan siap diunduh.",
    exportFailed: "Gagal membuat laporan. Silakan coba kembali.",
    importFailed: "Proses impor data gagal. Mohon periksa format file template Anda.",
  },

  // --- EMPTY STATES ---
  emptyState: {
    default: "Tidak ada data aktif yang dapat ditampilkan.",
    search: "Tidak ditemukan hasil yang sesuai dengan pencarian.",
    students: "Belum ada siswa yang terdaftar.",
    teachers: "Belum ada data guru yang terdaftar.",
    classes: "Belum ada kelas yang terdaftar.",
    subjects: "Belum ada mata pelajaran kurikulum yang terdaftar.",
    assignments: "Belum ada penugasan wali kelas yang terdaftar pada periode ini.",
    finance: "Belum ada data pembayaran pada periode ini.",
    scores: "Belum ada data nilai akademik yang diinput.",
  },

  // --- CLASSES MODULE ---
  classes: {
    unassignSubjectSuccess: "Mata pelajaran berhasil dilepas dari kelas.",
    unassignSubjectConfirmTitle: "Lepaskan mata pelajaran dari kelas?",
    unassignSubjectConfirmDescription: "Mata pelajaran ini tidak akan lagi diajarkan di kelas tersebut, namun riwayat nilai sebelumnya tetap tersimpan secara historis.",
    unassignSubjectConfirmLabel: "Ya, Lepaskan",
  },

  // --- FINANCE MODULE ---
  finance: {
    verifySuccess: "Pembayaran SPP berhasil diverifikasi.",
    bulkVerifySuccess: "Pembayaran SPP massal berhasil diverifikasi.",
    revertSuccess: "Verifikasi SPP berhasil dibatalkan.",
    invalidAmount: "Jumlah pembayaran harus lebih dari Rp 0.",
  },

  // --- ACADEMIC SCORES MODULE ---
  scores: {
    saveSuccess: "Hasil penilaian berhasil disimpan.",
    cancelChanges: "Perubahan data nilai berhasil dibatalkan.",
    publishSuccess: "Hasil penilaian berhasil dipublikasikan.",
  }
};
