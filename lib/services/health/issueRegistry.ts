/**
 * Issue Registry — Centralized metadata for all Health Check v2 issue codes.
 *
 * Each entry maps a HEALTH_CODE to its operational context:
 *   - impact:                 What breaks when this issue occurs.
 *   - recommendation:         Actionable steps for the administrator.
 *   - auto_repair_supported:  Whether a future sprint could auto-repair this.
 *   - repair_action:          Future repair action identifier (null in Sprint 6).
 *   - documentation_url:      Link to internal documentation (null = not available).
 *
 * RULE: Never add remediation metadata inside individual checkers.
 *       All metadata lives here and is applied centrally in aggregation.ts.
 *
 * Sprint 6 note: auto-repair is metadata-only. No repair logic is implemented.
 */

import { HealthCode } from "./codes";
import { OperationalPriority } from "./types";

export interface IssueRegistryEntry {
  impact: string;
  recommendation: string;
  auto_repair_supported: boolean;
  repair_action: string | null;
  documentation_url: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const ISSUE_REGISTRY: Partial<Record<HealthCode, IssueRegistryEntry>> = {

  // ── Infrastructure ─────────────────────────────────────────────────────────

  DB_CONNECTIVITY_FAILED: {
    impact:
      "Seluruh modul yang bergantung pada database tidak dapat digunakan, " +
      "termasuk login, dashboard, data siswa, keuangan, dan laporan.",
    recommendation:
      "1. Periksa status server database (MySQL/MariaDB) berjalan. " +
      "2. Verifikasi kredensial di file .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME). " +
      "3. Pastikan firewall tidak memblokir port database. " +
      "4. Jalankan perintah: mysql -u <user> -p -h <host> untuk mengetes koneksi manual.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  DB_ACCESSIBILITY_FAILED: {
    impact:
      "Kueri ke tabel inti gagal. Fitur yang bergantung pada data pengguna, siswa, " +
      "dan kelas tidak dapat dioperasikan.",
    recommendation:
      "1. Pastikan database sudah diinisialisasi dengan migration terbaru (npm run migrate). " +
      "2. Periksa hak akses pengguna database terhadap tabel-tabel yang diperlukan. " +
      "3. Periksa apakah skema database konsisten dengan versi aplikasi saat ini.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  STORAGE_MISSING: {
    impact:
      "Berkas yang diupload (foto siswa, dokumen) tidak dapat disimpan atau diakses. " +
      "Fitur upload akan gagal.",
    recommendation:
      "1. Buat direktori storage di root project: mkdir storage. " +
      "2. Pastikan direktori memiliki izin tulis oleh proses Node.js. " +
      "3. Jalankan kembali aplikasi setelah direktori dibuat.",
    auto_repair_supported: true,
    repair_action: "create_storage_directory",
    documentation_url: null,
  },

  STORAGE_UNREADABLE: {
    impact:
      "Berkas yang sudah tersimpan tidak dapat dibaca oleh sistem. " +
      "Tampilan berkas dan unduhan akan gagal.",
    recommendation:
      "1. Periksa izin direktori storage: ls -la storage/. " +
      "2. Pastikan proses Node.js memiliki hak baca (chmod 755 storage).",
    auto_repair_supported: true,
    repair_action: "fix_storage_permissions",
    documentation_url: null,
  },

  STORAGE_UNWRITABLE: {
    impact:
      "Upload berkas baru tidak dapat dilakukan. Semua proses yang membutuhkan " +
      "penulisan ke disk akan gagal.",
    recommendation:
      "1. Periksa izin direktori storage: ls -la storage/. " +
      "2. Berikan izin tulis: chmod 775 storage. " +
      "3. Pastikan disk tidak penuh: df -h.",
    auto_repair_supported: true,
    repair_action: "fix_storage_permissions",
    documentation_url: null,
  },

  STORAGE_CLEANUP_FAILED: {
    impact:
      "Berkas sementara uji pemeriksaan sistem tidak terhapus. " +
      "Tidak ada dampak operasional langsung, namun disk dapat penuh seiring waktu.",
    recommendation:
      "1. Hapus berkas .health_test_*.tmp secara manual di direktori storage. " +
      "2. Periksa izin hapus (delete) pada direktori storage.",
    auto_repair_supported: true,
    repair_action: "cleanup_temp_files",
    documentation_url: null,
  },

  RUNTIME_CHECK_FAILED: {
    impact:
      "Statistik runtime Node.js tidak dapat dibaca. " +
      "Ini dapat mengindikasikan masalah pada izin sistem atau konfigurasi proses.",
    recommendation:
      "1. Pastikan proses berjalan dengan izin yang memadai. " +
      "2. Periksa log sistem untuk error terkait proses Node.js.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Configuration ──────────────────────────────────────────────────────────

  CONFIG_ACADEMIC_YEAR_NOT_FOUND: {
    impact:
      "Tidak ada tahun ajaran aktif. Fitur yang bergantung pada periode akademik " +
      "(nilai, absensi, laporan) tidak dapat digunakan.",
    recommendation:
      "1. Buka menu Master Data > Tahun Ajaran. " +
      "2. Buat atau aktifkan tahun ajaran yang sesuai dengan periode berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_MULTIPLE_ACTIVE_ACADEMIC_YEARS: {
    impact:
      "Sistem tidak dapat menentukan periode aktif yang benar. " +
      "Laporan dan sinkronisasi data menjadi tidak konsisten.",
    recommendation:
      "1. Buka menu Master Data > Tahun Ajaran. " +
      "2. Pastikan hanya satu tahun ajaran yang berstatus aktif. " +
      "3. Non-aktifkan tahun ajaran yang tidak sesuai dengan periode berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_SEMESTER_NOT_FOUND: {
    impact:
      "Tidak ada semester aktif. Input nilai, absensi, dan jadwal semester " +
      "tidak dapat berjalan.",
    recommendation:
      "1. Buka menu Master Data > Semester. " +
      "2. Buat atau aktifkan semester yang sesuai dengan tahun ajaran aktif.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_MULTIPLE_ACTIVE_SEMESTERS: {
    impact:
      "Periode aktif bersifat ambigu. Pencatatan nilai dan absensi dapat salah " +
      "dikaitkan ke semester yang tidak tepat.",
    recommendation:
      "1. Buka menu Master Data > Semester. " +
      "2. Pastikan hanya satu semester yang berstatus aktif. " +
      "3. Non-aktifkan semester yang tidak lagi berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_SCHOOL_PROFILE_INCOMPLETE: {
    impact:
      "Informasi sekolah tidak lengkap. Laporan resmi dan dokumen yang " +
      "memerlukan nama atau alamat sekolah akan menggunakan nilai kosong.",
    recommendation:
      "1. Buka menu Pengaturan > Profil Sekolah. " +
      "2. Lengkapi seluruh kolom wajib (nama sekolah, alamat, NPSN).",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_BRANDING_INCOMPLETE: {
    impact:
      "Logo atau identitas visual sekolah tidak dikonfigurasi. " +
      "Portal dan laporan akan tampil tanpa branding.",
    recommendation:
      "1. Buka menu Pengaturan > Profil Sekolah. " +
      "2. Upload logo sekolah dan lengkapi informasi branding.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_STORAGE_NOT_CONFIGURED: {
    impact:
      "Konfigurasi direktori penyimpanan tidak ditemukan di environment variables. " +
      "Berkas yang diupload mungkin tidak diarahkan ke lokasi yang benar.",
    recommendation:
      "1. Periksa file .env dan pastikan variabel penyimpanan sudah terdefinisi. " +
      "2. Restart server setelah mengubah .env.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_AUDIT_NOT_CONFIGURED: {
    impact:
      "Layanan audit log tidak dikonfigurasi dengan benar. " +
      "Rekam jejak aktivitas administrator mungkin tidak tercatat.",
    recommendation:
      "1. Periksa konfigurasi audit log di file .env. " +
      "2. Pastikan tabel audit_logs sudah tersedia di database.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CONFIG_ENV_MISSING: {
    impact:
      "Variabel environment yang diperlukan tidak terdefinisi. " +
      "Fitur yang bergantung pada variabel tersebut akan gagal atau menggunakan nilai default yang tidak aman.",
    recommendation:
      "1. Salin file .env.example ke .env: cp .env.example .env. " +
      "2. Isi seluruh variabel yang diperlukan. " +
      "3. Restart server setelah mengubah .env.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Operations ─────────────────────────────────────────────────────────────

  AUDIT_SERVICE_UNAVAILABLE: {
    impact:
      "Sistem tidak dapat mencatat aktivitas administrator. " +
      "Jejak audit untuk keperluan keamanan dan kepatuhan tidak tersedia.",
    recommendation:
      "1. Periksa apakah tabel audit_logs ada di database. " +
      "2. Pastikan layanan audit log tidak dinonaktifkan di konfigurasi. " +
      "3. Periksa error log server untuk detail lebih lanjut.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  JOB_QUEUE_WORKER_UNVERIFIED: {
    impact:
      "Status worker antrian pekerjaan tidak dapat diverifikasi. " +
      "Pekerjaan latar belakang mungkin tidak berjalan sesuai jadwal.",
    recommendation:
      "1. Periksa status proses worker. " +
      "2. Tinjau tabel job_queue di database untuk melihat antrean yang tertunggak.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  BACKGROUND_WORKER_NOT_FOUND: {
    impact:
      "Proses worker latar belakang tidak ditemukan atau tidak aktif. " +
      "Tugas terjadwal seperti notifikasi dan pembersihan data mungkin tidak berjalan.",
    recommendation:
      "1. Periksa apakah proses worker sudah dijalankan. " +
      "2. Tinjau konfigurasi jadwal di sistem.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  CACHE_SERVICE_UNAVAILABLE: {
    impact:
      "Layanan cache tidak tersedia. Performa sistem akan menurun karena setiap " +
      "permintaan harus mengambil data langsung dari database.",
    recommendation:
      "1. Tidak ada cache eksternal yang dikonfigurasi (sistem menggunakan in-memory cache). " +
      "2. Pastikan server tidak mengalami tekanan memori yang berlebihan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  BACKUP_SERVICE_NOT_IMPLEMENTED: {
    impact:
      "Layanan backup otomatis belum diimplementasikan. " +
      "Data tidak memiliki cadangan otomatis dan rentan terhadap kehilangan data permanen.",
    recommendation:
      "1. Lakukan backup manual secara berkala menggunakan mysqldump atau alat sejenisnya. " +
      "2. Pertimbangkan mengimplementasikan backup terjadwal pada iterasi pengembangan berikutnya.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  DIAGNOSTICS_ENDPOINT_UNAVAILABLE: {
    impact:
      "Endpoint diagnostik sistem tidak tersedia. " +
      "Pemantauan dan debugging lanjutan terbatas.",
    recommendation:
      "1. Periksa apakah route /api/v1/system/diagnostics telah terdaftar. " +
      "2. Pastikan server berjalan tanpa error.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Academic Year ───────────────────────────────────────────────

  INTEGRITY_ACADEMIC_YEAR_NO_ACTIVE: {
    impact:
      "Tidak ada tahun ajaran aktif terdeteksi di level integritas data. " +
      "Seluruh fitur yang bergantung pada periode akademik aktif tidak dapat berjalan.",
    recommendation:
      "1. Buka menu Master Data > Tahun Ajaran. " +
      "2. Aktifkan tahun ajaran yang sesuai.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ACADEMIC_YEAR_MULTIPLE_ACTIVE: {
    impact:
      "Data tahun ajaran tidak konsisten. Laporan dan kueri periode aktif " +
      "akan menghasilkan data yang tidak dapat diprediksi.",
    recommendation:
      "1. Buka menu Master Data > Tahun Ajaran. " +
      "2. Non-aktifkan semua tahun ajaran kecuali satu yang sedang berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ACADEMIC_YEAR_NO_SEMESTERS: {
    impact:
      "Tahun ajaran aktif tidak memiliki semester. Input nilai dan absensi " +
      "tidak dapat diproses.",
    recommendation:
      "1. Buka menu Master Data > Semester. " +
      "2. Buat semester untuk tahun ajaran yang aktif.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_SEMESTER_ACTIVE_IN_INACTIVE_YEAR: {
    impact:
      "Semester aktif terhubung ke tahun ajaran yang tidak aktif. " +
      "Konsistensi data periode akademik tidak terjamin.",
    recommendation:
      "1. Periksa relasi semester dan tahun ajaran di menu Master Data. " +
      "2. Pastikan semester aktif hanya terhubung ke tahun ajaran yang juga aktif.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Semester ───────────────────────────────────────────────────

  INTEGRITY_SEMESTER_NO_ACTIVE: {
    impact:
      "Tidak ada semester aktif. Input nilai, absensi, dan keuangan periode " +
      "berjalan tidak dapat diproses.",
    recommendation:
      "1. Buka menu Master Data > Semester. " +
      "2. Aktifkan semester yang sesuai dengan periode berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_SEMESTER_MULTIPLE_ACTIVE: {
    impact:
      "Terdapat lebih dari satu semester aktif. Data yang diinput akan " +
      "terkait ke semester yang salah secara acak.",
    recommendation:
      "1. Buka menu Master Data > Semester. " +
      "2. Non-aktifkan semua semester kecuali satu yang sedang berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_SEMESTER_YEAR_MISMATCH: {
    impact:
      "Semester aktif tidak sesuai dengan tahun ajaran aktif. " +
      "Kueri berbasis periode akan menghasilkan data yang salah.",
    recommendation:
      "1. Periksa konfigurasi tahun ajaran dan semester di menu Master Data. " +
      "2. Pastikan semester aktif adalah bagian dari tahun ajaran yang aktif.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Enrollment ─────────────────────────────────────────────────

  INTEGRITY_ENROLLMENT_STUDENT_UNENROLLED: {
    impact:
      "Terdapat siswa aktif tanpa data enrollment (pendaftaran kelas). " +
      "Siswa tersebut tidak akan muncul di kelas manapun dan tidak dapat menerima nilai.",
    recommendation:
      "1. Identifikasi siswa yang tidak terdaftar di kelas manapun. " +
      "2. Daftarkan siswa tersebut ke kelas yang sesuai melalui menu Siswa > Pendaftaran Kelas.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ENROLLMENT_ORPHANED_STUDENT: {
    impact:
      "Data enrollment mereferensikan siswa yang sudah tidak ada. " +
      "Laporan kelas akan memuat referensi data yang tidak valid.",
    recommendation:
      "1. Identifikasi enrollment yang mereferensikan student_id yang tidak ada. " +
      "2. Hapus atau perbaiki enrollment yang tidak valid melalui panel administrator.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ENROLLMENT_ORPHANED_CLASS: {
    impact:
      "Data enrollment mereferensikan kelas yang sudah tidak ada. " +
      "Siswa dalam enrollment tersebut secara efektif tidak terdaftar di kelas manapun.",
    recommendation:
      "1. Identifikasi enrollment yang mereferensikan class_id yang tidak ada. " +
      "2. Perbaiki atau hapus enrollment tersebut dan daftarkan ulang siswa ke kelas yang valid.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Assessment ─────────────────────────────────────────────────

  INTEGRITY_ASSESSMENT_INVALID_SCORE_RANGE: {
    impact:
      "Terdapat penilaian dengan rentang nilai yang tidak valid (misalnya nilai maksimum " +
      "lebih kecil dari nilai minimum). Kalkulasi nilai akhir akan menghasilkan data yang salah.",
    recommendation:
      "1. Identifikasi penilaian dengan score_min > score_max. " +
      "2. Perbaiki konfigurasi rentang nilai di menu Penilaian Akademik.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ASSESSMENT_ORPHANED_TEACHER: {
    impact:
      "Terdapat penilaian yang dibuat oleh guru yang sudah tidak ada di sistem. " +
      "Kepemilikan penilaian tersebut tidak dapat diverifikasi.",
    recommendation:
      "1. Identifikasi penilaian dengan created_by yang merujuk ke user yang sudah dihapus. " +
      "2. Perbarui kepemilikan penilaian tersebut ke guru yang aktif.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ASSESSMENT_ORPHANED_SUBJECT: {
    impact:
      "Terdapat penilaian yang terhubung ke mata pelajaran yang sudah tidak aktif atau dihapus. " +
      "Laporan nilai per mata pelajaran akan memiliki gap data.",
    recommendation:
      "1. Identifikasi penilaian dengan subject_id yang tidak valid. " +
      "2. Perbaiki atau arsipkan penilaian tersebut.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Score ──────────────────────────────────────────────────────

  INTEGRITY_SCORE_OUT_OF_RANGE: {
    impact:
      "Terdapat nilai siswa yang berada di luar rentang yang ditetapkan oleh penilaian. " +
      "Rata-rata dan peringkat kelas akan terdistorsi.",
    recommendation:
      "1. Identifikasi nilai yang berada di luar rentang score_min dan score_max. " +
      "2. Koreksi nilai tersebut di menu Penilaian Akademik > Input Nilai.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_SCORE_ORPHANED_STUDENT: {
    impact:
      "Terdapat nilai yang merujuk ke siswa yang tidak ada. " +
      "Laporan nilai akan memiliki entri yang tidak dapat dikaitkan ke siswa manapun.",
    recommendation:
      "1. Identifikasi nilai dengan student_id yang tidak valid. " +
      "2. Hapus nilai orphan tersebut.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_SCORE_ORPHANED_ENROLLMENT: {
    impact:
      "Terdapat nilai yang terhubung ke enrollment yang sudah tidak ada. " +
      "Nilai tersebut tidak dapat dikaitkan ke kelas manapun.",
    recommendation:
      "1. Identifikasi nilai dengan enrollment_id yang tidak valid. " +
      "2. Perbaiki atau hapus entri nilai tersebut.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Attendance ─────────────────────────────────────────────────

  INTEGRITY_ATTENDANCE_ORPHANED_TEACHER: {
    impact:
      "Terdapat rekaman absensi yang dicatat oleh guru yang sudah tidak ada di sistem. " +
      "Keabsahan rekaman absensi tersebut tidak dapat diverifikasi.",
    recommendation:
      "1. Identifikasi rekaman absensi dengan recorded_by yang tidak valid. " +
      "2. Perbarui referensi tersebut ke pengguna yang aktif jika diperlukan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_ATTENDANCE_FUTURE_DATE: {
    impact:
      "Terdapat rekaman absensi dengan tanggal di masa depan. " +
      "Laporan kehadiran hari ini dan historis akan tidak akurat.",
    recommendation:
      "1. Identifikasi rekaman absensi dengan attendance_date > hari ini. " +
      "2. Koreksi tanggal atau hapus rekaman yang tidak valid.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Finance ────────────────────────────────────────────────────

  INTEGRITY_FINANCE_OVERPAYMENT: {
    impact:
      "Terdapat pembayaran SPP dengan jumlah yang melebihi tagihan. " +
      "Laporan keuangan akan menampilkan nilai yang tidak konsisten.",
    recommendation:
      "1. Identifikasi pembayaran dengan amount_paid > amount_due. " +
      "2. Koreksi data pembayaran melalui menu Keuangan > SPP.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_FINANCE_PAID_ZERO_AMOUNT: {
    impact:
      "Terdapat pembayaran dengan status lunas tetapi nominal Rp 0. " +
      "Rekonsiliasi keuangan akan menghasilkan selisih yang tidak dapat dijelaskan.",
    recommendation:
      "1. Identifikasi pembayaran dengan status 'paid' dan amount_paid = 0. " +
      "2. Koreksi nominal atau status pembayaran tersebut.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_FINANCE_ORPHANED_STUDENT: {
    impact:
      "Terdapat tagihan atau pembayaran SPP yang terhubung ke siswa yang sudah tidak ada. " +
      "Laporan keuangan akan memiliki entri yang tidak dapat direkonsiliasi.",
    recommendation:
      "1. Identifikasi rekaman keuangan dengan student_id yang tidak valid. " +
      "2. Arsipkan atau hapus entri tersebut setelah rekonsiliasi manual.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Audit Log ──────────────────────────────────────────────────

  INTEGRITY_AUDIT_MISSING_ACTION: {
    impact:
      "Terdapat entri audit log tanpa field 'action'. " +
      "Log tersebut tidak dapat digunakan untuk investigasi keamanan.",
    recommendation:
      "1. Tinjau entri audit log yang tidak memiliki action. " +
      "2. Periksa implementasi audit log di sistem untuk memastikan field wajib selalu diisi.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_AUDIT_MISSING_ENTITY_TYPE: {
    impact:
      "Terdapat entri audit log tanpa field 'entity_type'. " +
      "Log tersebut tidak dapat difilter berdasarkan jenis entitas.",
    recommendation:
      "1. Tinjau entri audit log yang tidak memiliki entity_type. " +
      "2. Periksa semua titik pencatatan audit dan pastikan entity_type selalu disertakan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Integrity — Dashboard Dependencies ───────────────────────────────────

  INTEGRITY_DASHBOARD_NO_ACTIVE_CLASS: {
    impact:
      "Dashboard utama tidak dapat menampilkan data kelas karena tidak ada kelas aktif. " +
      "Widget statistik kelas akan kosong.",
    recommendation:
      "1. Buka menu Akademik > Kelas. " +
      "2. Buat atau aktifkan kelas yang sesuai dengan tahun ajaran berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_DASHBOARD_NO_ACTIVE_SUBJECT: {
    impact:
      "Dashboard akademik tidak dapat menampilkan data mata pelajaran. " +
      "Laporan nilai dan rekap per mata pelajaran tidak tersedia.",
    recommendation:
      "1. Buka menu Akademik > Mata Pelajaran. " +
      "2. Aktifkan mata pelajaran yang diperlukan untuk semester berjalan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  INTEGRITY_DASHBOARD_NO_ACTIVE_STAFF: {
    impact:
      "Tidak ada staf aktif di sistem. Akses ke fitur-fitur yang memerlukan " +
      "pengguna aktif akan terbatas.",
    recommendation:
      "1. Buka menu Administrasi > Pengguna. " +
      "2. Aktifkan akun staf yang diperlukan.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },

  // ── Generic ────────────────────────────────────────────────────────────────

  CHECKER_EXECUTION_FAILED: {
    impact:
      "Salah satu modul pemeriksaan sistem gagal dieksekusi. " +
      "Status komponen yang gagal diperiksa tidak diketahui.",
    recommendation:
      "1. Periksa log server untuk detail error. " +
      "2. Pastikan semua dependensi (database, filesystem) tersedia. " +
      "3. Jalankan ulang pemeriksaan sistem.",
    auto_repair_supported: false,
    repair_action: null,
    documentation_url: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Priority Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function severityToPriority(
  severity: string
): OperationalPriority {
  if (severity === "critical") return "P1";
  if (severity === "warning") return "P2";
  if (severity === "unknown") return "P3";
  return null; // healthy issues have no priority
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the registry entry for a given issue code, or undefined if not found.
 */
export function getIssueMetadata(
  code: string
): IssueRegistryEntry | undefined {
  return ISSUE_REGISTRY[code as HealthCode];
}
