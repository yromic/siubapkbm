import { AppreciationMessage, RoleType } from "./types";

const MESSAGE_LIBRARY: Record<string, AppreciationMessage[]> = {
  academic_100_teacher: [
    {
      title: "Alhamdulillah! 100% Nilai Kelas Selesai",
      body: "Terima kasih Ustadz/Ustadzah. Seluruh nilai siswa pada penilaian ini telah lengkap diisi. Dedikasi Anda sangat berharga bagi pemantauan belajar siswa.",
    },
    {
      title: "MasyaAllah! Pengisian Nilai Tuntas",
      body: "Seluruh roster siswa telah berhasil dinilai. Penginputan yang lengkap ini memudahkan evaluasi akademik secara utuh.",
    },
    {
      title: "Barakallahu Fiikum! Nilai Kelas Lengkap",
      body: "Seluruh siswa telah memiliki catatan nilai akademik. Terima kasih atas kerja keras dan pengabdian Anda.",
    },
  ],
  culture_100_teacher: [
    {
      title: "Alhamdulillah! Observasi Pekan Ini Tuntas",
      body: "Seluruh 7 Indikator Karakter SAHABAT siswa pekan ini telah selesai diamati. Terima kasih atas bimbingan dan perhatian harian Anda.",
    },
    {
      title: "MasyaAllah! Catatan Karakter Lengkap",
      body: "Observasi harian pekan ini telah lengkap untuk seluruh siswa di kelas Anda. Kerja keras Anda membina karakter siswa sangat berarti.",
    },
    {
      title: "Barakallahu Fiikum! Pembiasaan Budaya Tuntas",
      body: "Pencatatan budaya harian pekan ini selesai 100%. Semoga pembiasaan baik ini menjadi amal jariyah bagi Ustadz/Ustadzah.",
    },
  ],
  cms_publish_admin: [
    {
      title: "Landing Page Sekolah Berhasil Live!",
      body: "Pembaruan visual dan tata letak landing page PKBM telah dipublikasikan dan siap diakses publik.",
    },
    {
      title: "Publikasi Konten Berhasil!",
      body: "Perubahan halaman depan sekolah telah aktif secara langsung pada situs web resmi.",
    },
    {
      title: "Landing Page Resmi Diperbarui",
      body: "Seluruh penyesuaian navigasi, seksi, dan identitas visual sekolah telah live.",
    },
  ],
  semester_finalize_admin: [
    {
      title: "Selamat! Semester Berhasil Difinalisasi",
      body: "Seluruh data akademik, kehadiran, dan penilaian budaya periode ini telah dikunci dengan aman. Terima kasih atas pengelolaan operasional sekolah yang tertib dan berintegritas.",
    },
    {
      title: "Penutupan Semester Selesai",
      body: "Periode akademik telah resmi difinalisasi. Seluruh catatan nilai dan rapor siswa siap diterbitkan.",
    },
    {
      title: "Finalisasi Periode Akademik Sukses",
      body: "Seluruh tahapan administrasi semester ini telah tuntas diproses dengan aman.",
    },
  ],
  class_promotion_admin: [
    {
      title: "Kenaikan Kelas Berhasil Diperbarui!",
      body: "Proses kenaikan kelas dan penempatan rombel siswa untuk tahun ajaran baru telah selesai diproses.",
    },
    {
      title: "Pembaruan Rombel Kelas Tuntas",
      body: "Seluruh siswa telah berhasil dipromosikan ke tingkat kelas berikutnya.",
    },
    {
      title: "Tahun Ajaran Baru Siap!",
      body: "Kenaikan kelas dan pembagian rombongan belajar baru telah dikonfigurasi dengan aman.",
    },
  ],
};

export function getAppreciationMessage(
  workflowId: string,
  role: RoleType
): AppreciationMessage {
  const key = `${workflowId}_${role}`;
  const list = MESSAGE_LIBRARY[key] || [
    {
      title: "Pekerjaan Luar Biasa!",
      body: "Terima kasih atas dedikasi dan kerja keras Anda dalam menyelesaikan tahapan ini.",
    },
  ];
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}
