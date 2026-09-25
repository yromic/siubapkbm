# SIUBA UI/UX Design Guidelines & System Rules
**Sistem Standar Desain Antarmuka & Pengalaman Pengguna (Design System)**  
*Dokumen Otoritatif — Versi 2.0 (Mobile-First & Dual-Mode Standardized)*

---

## 📌 Daftar Isi
1. [Filosofi Desain](#1-filosofi-desain)
2. [Layout & Sistem Kontainer Desktop](#2-layout--sistem-kontainer-desktop)
3. [Prinsip Ergonomi Mobile-First](#3-prinsip-ergonomi-mobile-first)
4. [Sistem Dual-Mode (Light & Dark Mode)](#4-sistem-dual-mode-light--dark-mode)
5. [Tipografi & Hirarki Font](#5-tipografi--hirarki-font)
6. [Komponen Inti & Micro-Interactions](#6-komponen-inti--micro-interactions)
7. [Visualisasi Data & Grafik (Recharts)](#7-visualisasi-data--grafik-recharts)
8. [Pola Penanganan Status (Loading, Empty, Error, Dirty)](#8-pola-penanganan-status-loading-empty-error-dirty)
9. [Daftar Larangan Keras (Do's and Don'ts)](#9-daftar-larangan-keras-dos-and-donts)

---

## 1. Filosofi Desain

SIUBA (*Sistem Informasi Utsman Bin Affan*) adalah platform akademik dan administrasi sekolah alternatif. Desain SIUBA berpijak pada 3 pilar:
1. **Adab & Ketenangan Visual**: Antarmuka bersih, bersahabat (*friendly*), dan tidak memicu stres kognitif bagi guru, orang tua, maupun murid.
2. **Mobile-First Realitas Lapangan**: Guru sering mencatat presensi dan penilaian langsung di kelas melalui smartphone. Segala aksi kritis harus dapat dioperasikan dengan **satu jempol (*one-thumb zone*)**.
3. **Presisi Desktop**: Saat dibuka di laptop/PC kantor, tata letak harus terpusat, seimbang, dan tidak melebar secara canggung di monitor resolusi tinggi (*ultrawide/1080p*).

---

## 2. Layout & Sistem Kontainer Desktop

### 2.1. Standar Batas Lebar (`maxWidth = "7xl"`)
Semua halaman modul aplikasi **WAJIB** dikunci pada lebar maksimum **1280px** (`max-w-7xl`) dan diposisikan di tengah secara horizontal (`mx-auto`).

```tsx
// ✅ BENAR: Menggunakan PageContainer standar
import { PageContainer } from "@/components/ui/page-framework";

export default function ModulPage() {
  return (
    <PageContainer maxWidth="7xl">
      <PageHeader title="Judul Modul" description="..." />
      {/* Konten Halaman */}
    </PageContainer>
  );
}

// ❌ SALAH: Membiarkan div melebar 100% tanpa batas di monitor lebar
export default function ModulPage() {
  return (
    <div className="space-y-6"> {/* Meledak hingga 1920px+ di desktop */}
      ...
    </div>
  );
}
```

### 2.2. Hirarki Breakpoint & Padding
| Breakpoint | Lebar Layar | Target Perangkat | Padding Horizontal Kontainer |
| :--- | :--- | :--- | :--- |
| **Mobile** (`default`) | `< 768px` | Smartphone (360px – 430px) | `px-4` (16px) |
| **Tablet** (`sm:`) | `≥ 640px` | Tablet vertikal / Phablet | `px-6` (24px) |
| **Desktop** (`lg:`) | `≥ 1024px` | Laptop / Desktop Monitor | `px-8` (32px) |

### 2.3. Eliminasi Double-Padding
Hindari membungkus halaman modul dengan padding luar berlapis jika komponen `PageContainer` sudah menyediakannya. Gutter horizontal di desktop harus konsisten di angka **32px** dari sisi sidebar.

---

## 3. Prinsip Ergonomi Mobile-First

### 3.1. Penempatan Sticky Bottom Bar & Z-Index Layering
Di layar ponsel, aplikasi memiliki navigasi bawah utama (*Bottom Navigation*) setinggi `h-16` (64px) dengan posisi `fixed bottom-0 left-0 right-0 z-40`.
Jika sebuah halaman membutuhkan **Sticky Action Bar** (misalnya tombol simpan form/presensi):
- **Wajib menggunakan offset**: `fixed bottom-16 md:bottom-0 left-0 right-0 z-30`
- **Wajib memberi padding penopang scroll**: `pb-40 md:pb-24` pada kontainer utama agar baris konten paling bawah tidak tertutup.

```tsx
// ✅ BENAR: Melayang persis di atas bottom navigation mobile
<div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 p-3 sm:p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-xl">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
    {/* Counters & Primary Action */}
  </div>
</div>
```

### 3.2. Segmented Controls vs Tombol Penuh di Ponsel
Pada area pemilihan status jamak (seperti kehadiran: Hadir, Sakit, Izin, Alpa, Terlambat):
- Di **Mobile (`md:hidden`)**: Tampilkan inisial singkat huruf tebal (`H`, `S`, `I`, `A`, `T`) dengan target sentuh minimal `36px × 36px`.
- Di **Desktop (`hidden md:inline`)**: Tampilkan label kata lengkap (*Hadir, Sakit, Izin...*).

### 3.3. Degradasi Tampilan Data (Tabel vs Kartu)
- **Desktop (`hidden md:block`)**: Tampilkan tabel data tabular lengkap dengan kolom nomor, nama, indikator, tanggal, dan aksi cepat di sisi kanan.
- **Mobile (`md:hidden`)**: Konversi otomatis menjadi kartu vertikal (*card list*) ber-radius `rounded-2xl` dengan pembatas `border-zinc-200 dark:border-zinc-800`.

---

## 4. Sistem Dual-Mode (Light & Dark Mode)

### 4.1. Hirarki Permukaan Warna (*Surface Levels*)

| Lapisan | Fungsi | Token Tailwind (Light Mode) | Token Tailwind (Dark Mode) |
| :--- | :--- | :--- | :--- |
| **Surface 0** | Latar belakang dasar kanvas | `bg-[#fdfbf7]` atau `bg-zinc-50` | `dark:bg-zinc-950` (`#0a0a0a`) |
| **Surface 1** | Kartu utama, Header, Sidebar | `bg-white` | `dark:bg-zinc-900` (`#171717`) |
| **Surface 2** | Sub-kartu, Input field, Hover item | `bg-zinc-50` atau `bg-zinc-100` | `dark:bg-zinc-800` (`#262626`) |
| **Surface 3** | Garis batas (*Borders*), Garis kisi | `border-zinc-200` | `dark:border-zinc-800` |

> ⚠️ **ATURAN WAJIB**: Dilarang menuliskan kelas arbitrary hex seperti `dark:bg-[#171717]` atau `dark:hover:bg-[#262626]` secara acak di kode JSX. Selalu gunakan utilitas standar: `dark:bg-zinc-900`, `dark:bg-zinc-800`, atau variabel `--surface-*`.

### 4.2. Kontras Tipografi (Sesuai Standar WCAG AA)
- **Teks Utama (Headings, Title)**: `text-zinc-900 dark:text-zinc-50`
- **Teks Sekunder (Subtitle, Label, Data)**: `text-zinc-600 dark:text-zinc-400`
- **Teks Redup (Placeholder, Timestamp)**: `text-zinc-400 dark:text-zinc-500`

### 4.3. Status Semantik Ganda (*Soft Badges*)
Untuk menampilkan status tanpa menyilaukan mata di mode malam:

| Status | Tampilan Light Mode | Tampilan Dark Mode |
| :--- | :--- | :--- |
| **Sukses / Hadir** | `bg-emerald-50 text-emerald-700 border-emerald-200` | `dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800` |
| **Peringatan / Sakit** | `bg-amber-50 text-amber-700 border-amber-200` | `dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800` |
| **Informasi / Izin** | `bg-blue-50 text-blue-700 border-blue-200` | `dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800` |
| **Bahaya / Alpa** | `bg-rose-50 text-rose-700 border-rose-200` | `dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800` |
| **Khusus / Terlambat** | `bg-purple-50 text-purple-700 border-purple-200` | `dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800` |

---

## 5. Tipografi & Hirarki Font

Aplikasi SIUBA mengintegrasikan 4 font spesifik dengan peruntukan tegas:

1. **`font-fredoka` (Headline & Metrik Angka)**:
   - Digunakan **HANYA** untuk angka statistik utama KPI (`<KPICard>`), persentase kelulusan, ringkasan counter presensi, dan judul modul utama.
   - Contoh: `<span className="font-fredoka text-2xl font-bold">98%</span>`
2. **`font-plus-jakarta` (Teks Antarmuka & Kontrol)**:
   - Digunakan untuk seluruh navigasi, label tombol, label form input, sub-header, dan nama santri.
3. **`font-mono` (Data Teknis & Identifikasi)**:
   - Digunakan untuk NISN, NIK, ID Transaksi, kode kelas, dan waktu timestamp.
4. **`font-data` / `font-ibm-plex-sans` (Tabel Nilai & Spreadsheet)**:
   - Digunakan untuk entri nilai rapor, matriks skor asesmen KKTP/Trisula.

---

## 6. Komponen Inti & Micro-Interactions

### 6.1. Aturan Border Radius
- **Wadah Kartu Utama (`Card`)**: Wajib `rounded-2xl` (16px).
- **Elemen Kontrol (`Button`, `Input`, `Select`)**: Wajib `rounded-xl` (12px).
- **Badge & Status Pill**: Wajib `rounded-full` atau `rounded-lg`.
- ❌ **Dilarang**: Menggunakan `rounded-[24px]` atau `rounded-3xl` yang merusak ritme sudut tajam-lembut desain.

### 6.2. Aturan Tombol Aksi (*Buttons*)
- **Tombol Utama (Primary)**:
  `bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white font-semibold rounded-xl min-h-[38px] px-4 shadow-xs`
- **Tombol Sekunder (Secondary)**:
  `bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 font-medium rounded-xl min-h-[38px] px-4`
- **Tombol Bahaya (Destructive)**:
  `bg-red-600 hover:bg-red-700 text-white rounded-xl min-h-[38px] px-4`
- **Focus Rings Aksesibilitas**:
  Seluruh elemen interaktif wajib menyertakan:  
  `focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2`

---

## 7. Visualisasi Data & Grafik (Recharts)

Grafik SVG Recharts di Dashboard **WAJIB** mendukung mode gelap dan terang tanpa menggunakan warna latar atau stroke putih yang menyilaukan:

1. **Garis Kisi (`CartesianGrid`)**:
   ```tsx
   // ✅ Gunakan stroke currentColor + kelas warna adaptif
   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
   ```
2. **Sumbu Koordinat (`XAxis` & `YAxis`)**:
   ```tsx
   <XAxis dataKey="name" fontSize={10} tickLine={false} stroke="currentColor" className="text-zinc-400 dark:text-zinc-500" />
   <YAxis fontSize={10} tickLine={false} stroke="currentColor" className="text-zinc-400 dark:text-zinc-500" />
   ```
3. **Tooltip Melayang Adaptif**:
   Dilarang menggunakan `<Tooltip />` default (kotak putih bawaan). Selalu gunakan custom component berlatar zinc:
   ```tsx
   <Tooltip
     content={({ active, payload, label }) => {
       if (!active || !payload?.length) return null;
       return (
         <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl shadow-lg text-xs">
           <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">{label}</p>
           {payload.map((entry, idx) => (
             <div key={idx} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
               <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
               <span>{entry.name}: <strong className="text-zinc-900 dark:text-zinc-100">{entry.value}</strong></span>
             </div>
           ))}
         </div>
       );
     }}
   />
   ```

---

## 8. Pola Penanganan Status (Loading, Empty, Error, Dirty)

1. **Loading State**:
   - Jika memuat seluruh halaman pertama kali: gunakan skeleton placeholder kotak abu-abu berdenyut (`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-xl`).
   - Jika tombol sedang mengeksekusi request simpan: tampilkan spinner `<Loader2 className="w-4 h-4 animate-spin mr-2" />` dan nonaktifkan tombol (`disabled={loading}`).
2. **Empty State**:
   - Wajib menyertakan ikon kontekstual (bukan kotak kosong), judul deskriptif ("Belum Ada Presensi"), kalimat arahan, dan tombol aksi pembuat data baru.
3. **Perlindungan Kehilangan Data (*Dirty State Guard*)**:
   - Jika pengguna sudah mengetik atau mengubah status nilai/presensi dan mencoba keluar, wajib memunculkan dialog konfirmasi pembatalan agar data tidak hilang tanpa sengaja.
4. **Sistem Notifikasi**:
   - Seluruh pesan sukses, peringatan, atau gagal wajib menggunakan wrapper tunggal `notify` dari `@/lib/notify`:
     ```ts
     import { notify } from "@/lib/notify";
     notify.success("Presensi berhasil disimpan.");
     notify.error(humanizeError(err));
     ```

---

## 9. Daftar Larangan Keras (Do's and Don'ts)

| ❌ DILARANG KERAS | ✅ WAJIB DILAKUKAN |
| :--- | :--- |
| Membiarkan kontainer modul melebar 100% tanpa batas `max-w-7xl` di desktop. | Bungkus seluruh halaman modul dengan `<PageContainer maxWidth="7xl">`. |
| Menempatkan fixed sticky bar di `bottom-0` pada mobile saat bottom nav aktif. | Gunakan offset `bottom-16 md:bottom-0` dengan ruang scroll `pb-40 md:pb-24`. |
| Menggunakan stroke hardcoded terang (misal: `#f3f4f6`) pada grafik Recharts. | Gunakan `stroke="currentColor" className="text-zinc-200 dark:text-zinc-800"`. |
| Menulis teks angka metrik besar dengan font biasa (*inter/arial/sans*). | Gunakan font khusus metrik: `font-fredoka`. |
| Memakai warna arbitrary hex acak (`#171717`, `#262626`) di dalam inline kelas. | Gunakan standar palet Zinc: `zinc-950`, `zinc-900`, `zinc-800`. |
| Memakai pesan error teknis mentah (*"Fetch failed 500"*). | Saring pesan error lewat `humanizeError()` agar ramah manusia. |
