# RFC/ADR: CMS Traceability & Production-Grade Realization Contract
**Dokumen Desain, Architectural Decision Record (ADR), & Kontrak Implementasi CMS Landing Page SIUBA**

- **Status**: PROPOSED / UNDER REVIEW
- **Author**: Software Architect & Technical Reviewer Team
- **File Contract**: [CMS_TRACEABILITY_IMPLEMENTATION_PLAN.md](file:///d:/w/siubapkbm/CMS_TRACEABILITY_IMPLEMENTATION_PLAN.md)
- **Database References**: [20260720170001_create_website_cms_tables.js](file:///d:/w/siubapkbm/database/migrations/20260720170001_create_website_cms_tables.js), [20260721000000_create_structured_content_tables.js](file:///d:/w/siubapkbm/database/migrations/20260721000000_create_structured_content_tables.js)

---

## BAB 0 — CMS Architecture Validation (Fase 0)

Sebelum melakukan implementasi teknis pada fase apa pun, arsitektur CMS harus divalidasi terlebih dahulu terhadap prinsip-prinsip fondasi sistem berikut. Kegagalan memenuhi kriteria validasi ini berarti arsitektur dinilai tidak layak untuk diimplementasikan.

### 1. UX Berorientasi Administrator (Administrator-Oriented UX)
CMS dibangun untuk digunakan oleh administrator sekolah (staf administrasi/kepala sekolah), bukan oleh tim developer. Antarmuka input data harus dirancang menggunakan terminologi operasional sekolah yang ramah pengguna, bebas dari jargon teknis database (seperti serialisasi JSON, UUID, atau id relasional mentah).

### 2. Satu Ruang Kerja = Satu Domain Bisnis (One Workspace = One Business Domain)
Setiap modul administrasi di CMS harus terisolasi secara logis dan merepresentasikan satu domain bisnis yang utuh. Hal ini mencegah terjadinya tumpang tindih visual (overlap) dan inkonsistensi data ketika satu parameter diubah di satu tempat namun merusak layout di bagian lain.

### 3. Eksposur Objek Bisnis, Bukan Entitas Teknis (Business Object Exposure)
CMS harus mengekspos konsep-konsep bisnis (misal: "Testimoni Wali Murid", "Pertanyaan Populer") dalam bentuk antarmuka visual form yang nyata. Kita tidak boleh memaksa administrator memahami struktur penyimpanan data teknis seperti "Tabel Section Items" dengan kolom-kolom string generik.

### 4. Nol Konten Bisnis yang Keras (Zero Hardcoded Business Content)
Seluruh konten bisnis, baik berupa nama instansi, visi-misi, program kerja, kutipan, data kontak, gambar kegiatan, hingga tautan tombol pendaftaran, wajib bersumber dari database CMS. Menyimpan teks statis di dalam kode komponen React adalah pelanggaran arsitektur berat.

### 5. Pemisahan Struktur Layout dan Konten (Separation of Layout and Content)
Sistem CMS bertugas memasok konten dinamis (data semantik), sedangkan komponen React di sisi publik bertugas menentukan struktur tata letak (layout), gaya visual (Tailwind CSS/CSS Vanilla), perilaku responsif, serta efek animasi (Framer Motion). Administrator tidak boleh diberikan kontrol untuk memodifikasi struktur layout yang dapat merusak estetika desain premium.

### 6. Keterlacakan Komponen Publik (Public Component Traceability)
Setiap elemen visual yang dirender pada Landing Page publik wajib memiliki jalur data (*traceability chain*) yang jelas kembali ke form input di CMS Admin Panel. Hal ini mempermudah pelacakan jika terjadi kesalahan ketik atau pembaruan informasi.

### 7. Validasi Arsitektur Informasi (Information Architecture Validation)
Struktur pengelompokan menu dan navigasi pada Admin Panel harus divalidasi secara berkala untuk memastikan alur kerja administrasi minim klik dan bersifat intuitif (workflow-centric).

---

## BAB 1 — Administrator Mental Model

Untuk membangun CMS yang sukses, arsitektur aplikasi harus menyelaraskan antarmuka pengguna dengan **Model Mental Administrator**, bukan model database internal.

```
+-----------------------------------------------------------------------------------+
|                           MODEL MENTAL ADMINISTRATOR                              |
|   (Berpikir dalam Domain Bisnis, Struktur Halaman, & Konten Visual Sekolah)       |
+-----------------------------------------------------------------------------------+
|  [Hero Banner]  [Diferensiasi]  [Tentang Kami]  [Kompetensi]  [Sambutan Kepala]   |
|  [Keseharian]   [Galeri Foto]   [Testimoni]     [FAQ]         [Link PPDB / WA]    |
+-----------------------------------------------------------------------------------+
                                         VS
+-----------------------------------------------------------------------------------+
|                            MODEL DATABASE INTERNAL                                |
|          (Berpikir dalam Struktur Penyimpanan Teknis & Relasi Tabel)              |
+-----------------------------------------------------------------------------------+
|  - sections (id, type, title, subtitle, badge, sort_order, is_active)             |
|  - section_items (id, section_id, title, description, custom_fields)              |
|  - repeaters & JSON Serialization                                                 |
|  - assets & media join relationship queries                                       |
+-----------------------------------------------------------------------------------+
```

### Aturan Model Mental:
1. **CMS Melarang Keras** penayangan nama-nama teknis seperti `sections`, `section_items`, `repeaters`, atau `custom_fields` pada antarmuka admin.
2. Form pengisian data harus menggunakan judul seksi yang mencerminkan nama visualnya di situs publik (misal: "Sambutan Kepala Sekolah" dan bukan "Edit Section: Principal").
3. Pengaturan field tambahan (seperti warna aksen bento grid atau grid span) harus dikemas dalam bentuk selektor visual (Dropdown/Color Picker) dan dilarang keras meminta administrator menulis format mentah JSON.

---

## BAB 2 — CMS Design Principles

Arsitektur CMS Landing Page harus mematuhi sepuluh prinsip desain berikut secara konsisten:

1. **Single Responsibility Workspace**: Satu tab form hanya bertanggung jawab mengelola satu area konfigurasi logis.
2. **Explicit Business Domains**: Setiap form input disajikan secara eksplisit mewakili domain bisnis sekolah (FAQ, Testimonials, Profil Lulusan).
3. **Progressive Disclosure**: Antarmuka hanya menampilkan opsi pengisian utama secara default. Opsi lanjutan atau detail teknis (seperti pengisian metadata SEO kanonis) disembunyikan di dalam menu kolaps agar tidak membebani pengguna.
4. **Predictable CRUD**: Setiap aksi Create, Read, Update, dan Delete pada admin panel harus memberikan umpan balik instan yang konsisten (Toast Notification sukses/gagal).
5. **Minimal Clicks**: Struktur navigasi editor dirancang agar administrator dapat mencapai form pengisian konten utama dalam maksimal 2 kali klik dari dashboard utama.
6. **Consistent Editing Experience**: Seluruh modal edit untuk seksi halaman menggunakan pola layout yang seragam (Header Konten di atas, daftar Repeater di tengah, tombol aksi Simpan/Batal di bawah).
7. **Draft before Publish**: Setiap perubahan wajib disimpan terlebih dahulu sebagai "Draf" (tidak memengaruhi halaman live) sebelum secara sadar dipublikasikan oleh administrator ke publik.
8. **Media Reuse**: Gambar atau dokumen yang telah diunggah ke Media Library dapat digunakan kembali di berbagai komponen tanpa perlu mengunggah ulang file yang sama.
9. **Separation of Layout and Content**: Administrator mengendalikan data teks dan gambar; kode program mengendalikan spasi, transisi, animasi, dan responsivitas.
10. **Mobile-First Admin Panel Design**: Antarmuka halaman administrator CMS harus diupayakan secara optimal untuk dapat diakses dan dioperasikan dengan nyaman melalui perangkat mobile/smartphone. Seluruh modal edit, form input, dan Media Library harus responsif, menggunakan tata letak single-column yang mengalir pada layar kecil, serta ukuran touch target minimal 44x44 piksel agar operasional sekolah dapat dilakukan langsung dari ponsel pintar administrator.

---

## BAB 3 — UX Acceptance Criteria

Untuk setiap seksi halaman yang dapat dikelola melalui CMS, kriteria penyelesaian (*UX Acceptance Criteria*) diatur secara absolut di bawah ini.

### Matriks UX Acceptance Criteria per Seksi

#### 1. Navigasi Atas (Navbar)
*   [ ] ✓ Teks Logo/Nama Singkat sekolah dapat diubah secara dinamis.
*   [ ] ✓ Gambar logo sekolah dapat diunggah, ditinjau, dan dinonaktifkan (kembali ke fallback teks).
*   [ ] ✓ Menu tautan (link menu) dapat ditambah, diurutkan (*sorting*), diedit labelnya, dan dihapus.
*   [ ] ✓ Status draf, pratinjau (`?preview=true`), dan publikasi live berjalan selaras.
*   [ ] ✓ Landing page publik memuat navbar dinamis secara instan setelah dipublikasikan.

#### 2. Hero Banner (Hero)
*   [ ] ✓ Teks judul slogan utama (`h1`) dapat diubah.
*   [ ] ✓ Sub-judul penjelasan slogan dapat diubah.
*   [ ] ✓ Teks badge kampanye kecil di atas judul utama dapat diubah.
*   [ ] ✓ Tombol aksi utama (PPDB) & tombol sekunder dapat diubah teks dan alamat tautannya (URL).
*   [ ] ✓ Gambar-gambar slide latar belakang (*background slideshow carousel*) dapat diunggah, diurutkan, dan dihapus.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live berjalan sukses tanpa ada gambar lokal statis yang tersisa.

#### 3. Diferensiasi Kami (Why Choose Us)
*   [ ] ✓ Judul utama seksi, sub-judul, dan badge seksi dapat diubah.
*   [ ] ✓ Bento cards dapat ditambah, diubah isinya (judul, sub-label, deskripsi), dan diurutkan.
*   [ ] ✓ Pilihan ikon Lucide untuk setiap card dapat ditentukan via dropdown pencarian nama ikon.
*   [ ] ✓ Lebar kolom bento grid (lebar tunggal vs. lebar ganda `col-span-2`) dan aksen warna tema (emerald, red, amber, blue, purple) dapat diubah melalui form visual.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live terefleksi sempurna di bento grid publik.

#### 4. Kredibilitas Resmi (About)
*   [ ] ✓ Judul utama, paragraf deskripsi detail, dan badge kredibilitas dapat diubah.
*   [ ] ✓ Gambar utama kegiatan (sisi kiri) dan teks akreditasi melayang di atas gambar dapat diganti.
*   [ ] ✓ Daftar *Trust Metrics* (angka pencapaian seperti rasio tutor, tingkat kelulusan) dapat ditambah, diedit, diurutkan, dan dihapus.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live berjalan lancar.

#### 5. Trisula Kompetensi (Programs)
*   [ ] ✓ Judul utama seksi, sub-judul, dan badge kurikulum dapat diubah.
*   [ ] ✓ Kartu pilar kompetensi dapat ditambah, diubah (judul, deskripsi, badge esensial), dan diurutkan.
*   [ ] ✓ Warna gradasi latar belakang kartu pilar kompetensi dapat diubah.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live berjalan sukses.

#### 6. Alur Aktivitas (School Life)
*   [ ] ✓ Judul utama seksi dan sub-judul dapat diubah.
*   [ ] ✓ Alur aktivitas harian (timeline) dapat ditambah, diedit (waktu/jam, penjelasan kegiatan, kategori waktu), dan diurutkan.
*   [ ] ✓ Gambar pendukung untuk masing-masing aktivitas harian dapat diunggah atau dipilih dari media center.
*   [ ] ✓ Layout visual zig-zag di publik otomatis terbentuk berdasarkan indeks ganjil/genap item secara dinamis.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live tervalidasi.

#### 7. Galeri Kegiatan (Gallery)
*   [ ] ✓ Judul utama seksi dan sub-judul dapat diubah.
*   [ ] ✓ Gambar dokumentasi baru dapat diunggah, diberi judul, dan dikategorikan (misal: "Keagamaan", "Olahraga").
*   [ ] ✓ Kategori filter tabs di halaman depan secara otomatis diekstrak dari database tanpa ada kategori hardcoded.
*   [ ] ✓ Efek visual masonry Pinterest tetap terjaga dengan variasi rasio aspek dinamis.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live terverifikasi.

#### 8. Testimoni Orang Tua (Testimonials)
*   [ ] ✓ Judul utama seksi dan badge testimoni dapat diubah.
*   [ ] ✓ Item review baru dapat ditambah, diedit (nama orang tua, peran/kelas anak, kutipan review), diurutkan, dan dihapus.
*   [ ] ✓ Foto profil orang tua dapat diunggah dan diganti.
*   [ ] ✓ Komponen carousel publik dapat melakukan navigasi panah kiri/kanan dengan mulus.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live tervalidasi.

#### 9. Sambutan Kepala Sekolah (Principal)
*   [ ] ✓ Judul seksi, sub-judul sambutan, dan teks isi surat sambutan (greeting) dapat diubah.
*   [ ] ✓ Identitas Kepala Sekolah (Nama lengkap, jabatan/gelar) dapat diubah.
*   [ ] ✓ Foto profil Kepala Sekolah dapat diunggah atau diganti.
*   [ ] ✓ Keberadaan komponen identitas (nama & foto) di situs publik dikendalikan secara dinamis berdasarkan data input (jika kolom nama kosong, identitas disembunyikan secara otomatis).
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live berjalan sukses.

#### 10. Tanya Jawab (FAQ)
*   [ ] ✓ Judul utama seksi dan sub-judul FAQ dapat diubah.
*   [ ] ✓ Daftar tanya jawab dapat ditambah, diubah (pertanyaan & jawaban detail), diurutkan, dan dihapus.
*   [ ] ✓ Akordeon buka-tutup di situs publik beroperasi secara interaktif dan dinamis.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live berjalan sukses.

#### 11. Banner Pendaftaran (CTA)
*   [ ] ✓ Judul ajakan pendaftaran utama dan paragraf deskripsi banner dapat diubah.
*   [ ] ✓ Teks tombol utama (WhatsApp) dan tombol sekunder beserta link tautannya dapat diubah.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live berjalan sukses.

#### 12. Footer Navigasi & Informasi (Footer)
*   [ ] ✓ Deskripsi singkat (tagline footer) sekolah dapat diubah.
*   [ ] ✓ Informasi kontak resmi (telepon display, telepon raw link WA, email) dan alamat fisik lengkap dapat diedit.
*   [ ] ✓ Link peta Google Maps embed dapat diganti dengan URL baru.
*   [ ] ✓ Tautan tautan sosial media (Instagram, Facebook, YouTube, WhatsApp) dapat dikonfigurasi.
*   [ ] ✓ Menu navigasi tautan bawah diurutkan dan ditarik dinamis dari tabel database navigasi footer.
*   [ ] ✓ Draf, Pratinjau, dan Publikasi live tervalidasi.

---

## BAB 4 — Public Traceability Requirement

Untuk memastikan tidak ada bagian sistem yang terputus (*disconnected*), setiap fitur pengeditan Landing Page wajib memenuhi **Rantai Keterlacakan Publik** (*Public Traceability Chain*):

```
[ Form Input CMS Admin ]
           ↓
[ API Endpoint (PATCH/POST) ] ──> [ Validasi Skema & Data ]
           ↓
[ Penyimpanan Database ] ───> [ Kolom draft_content & content ]
           ↓
[ API Publik / Service Layer ] ──> [ getActiveSections(isPreview) ]
           ↓
[ React Component Publik ] ──> [ Props Binding & Default Fallbacks ]
           ↓
[ Visual Landing Page Publik ] ──> [ Elemen HTML Ter-render ]
```

> [!IMPORTANT]
> Jika salah satu mata rantai di atas terputus (misalnya: form input ada di admin dan tersimpan di database, tetapi komponen React di publik mengabaikan props tersebut dan merender data lokal dummy), maka fitur CMS tersebut **wajib diklasifikasikan sebagai cacat/belum selesai (Incomplete)**.

---

## BAB 5 — Component Traceability Matrix

Berikut adalah matriks keterlacakan (*traceability matrix*) resmi untuk komponen Landing Page publik SIUBA. Status dalam matriks ini didasarkan pada audit *source code* secara nyata dan dilarang diisi berdasarkan asumsi.

| Component | CMS Workspace (UI Form) | API Endpoint | Service Layer Method | React Component File | Landing Page Section | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Navbar** | `BrandingTab.tsx` / `NavigationMenu` | `/api/v1/admin/config` | `getWebsiteConfig`, `getNavigationMenu` | [Navbar.tsx](file:///d:/w/siubapkbm/components/landing/Navbar.tsx) | Header Header Navigasi | **VERIFIED** |
| **Hero** | `SectionsTab.tsx` (Tipe: `hero`) | `/api/v1/admin/sections` | `getActiveSections` | [Hero.tsx](file:///d:/w/siubapkbm/components/landing/Hero.tsx) | Hero Banner | **VERIFIED** |
| **Hero Carousel** | `SectionsTab.tsx` (Repeater: `hero`) | `/api/v1/admin/sections` | `getActiveSections` | [Hero.tsx](file:///d:/w/siubapkbm/components/landing/Hero.tsx) | Background Slideshow | **VERIFIED** |
| **Why Choose Us** | `SectionsTab.tsx` (Tipe: `why-choose-us`) | `/api/v1/admin/sections` | `getActiveSections` | [WhyChooseUs.tsx](file:///d:/w/siubapkbm/components/landing/WhyChooseUs.tsx) | Keunggulan Sekolah | **VERIFIED** |
| **About** | `SectionsTab.tsx` (Tipe: `about`) | `/api/v1/admin/sections` | `getActiveSections` | [About.tsx](file:///d:/w/siubapkbm/components/landing/About.tsx) | Profil & Akreditasi | **VERIFIED** |
| **Programs** | `SectionsTab.tsx` (Tipe: `programs`) | `/api/v1/admin/sections` | `getActiveSections` | [Programs.tsx](file:///d:/w/siubapkbm/components/landing/Programs.tsx) | Trisula Kompetensi | **VERIFIED** |
| **School Life** | `SectionsTab.tsx` (Tipe: `school-life`) | `/api/v1/admin/sections` | `getActiveSections` | [SchoolLife.tsx](file:///d:/w/siubapkbm/components/landing/SchoolLife.tsx) | Keseharian Siswa | **VERIFIED** |
| **Gallery** | `SectionsTab.tsx` (Tipe: `gallery`) | `/api/v1/admin/sections` | `getActiveSections` | [Gallery.tsx](file:///d:/w/siubapkbm/components/landing/Gallery.tsx) | Masonry Galeri Foto | **VERIFIED** |
| **Testimonials** | `SectionsTab.tsx` (Tipe: `testimonials`) | `/api/v1/admin/sections` | `getActiveSections` | [Testimonials.tsx](file:///d:/w/siubapkbm/components/landing/Testimonials.tsx) | Review Wali Murid | **VERIFIED** |
| **Principal** | `SectionsTab.tsx` (Tipe: `principal`) | `/api/v1/admin/sections` & `/api/v1/admin/config` | `getActiveSections` & `getWebsiteConfig` | [Principal.tsx](file:///d:/w/siubapkbm/components/landing/Principal.tsx) | Sambutan Kepala Sekolah | **VERIFIED** |
| **FAQ** | `SectionsTab.tsx` (Tipe: `faq`) | `/api/v1/admin/sections` | `getActiveSections` | [FAQ.tsx](file:///d:/w/siubapkbm/components/landing/FAQ.tsx) | Accordion Tanya Jawab | **VERIFIED** |
| **CTA** | `SectionsTab.tsx` (Tipe: `cta`) | `/api/v1/admin/sections` | `getActiveSections` | [CTA.tsx](file:///d:/w/siubapkbm/components/landing/CTA.tsx) | Banner Pendaftaran | **VERIFIED** |
| **Footer** | `ContactTab.tsx` / `NavigationMenu` | `/api/v1/admin/config` | `getWebsiteConfig`, `getNavigationMenu` | [Footer.tsx](file:///d:/w/siubapkbm/components/landing/Footer.tsx) | Kaki Halaman & Kontak | **VERIFIED** |

---

## BAB 6 — Developer Definition of Done (DoD)

Sebuah seksi halaman **BELUM** dianggap selesai hanya karena fungsionalitas CRUD di admin panel sudah berjalan. Developer wajib memenuhi seluruh kriteria penyelesaian teknis (*Developer Definition of Done*) berikut:

1.  **Zero Hardcoded Business Content**: Tidak ada satu pun teks berbau informasi sekolah (nama sekolah, alamat, visi-misi) yang keras-tertulis (*hardcoded*) di komponen publik.
2.  **No Dummy Arrays**: Seluruh inisialisasi data array dummy lokal (seperti `const localFAQ = [...]`) telah dihapus secara bersih.
3.  **No Mock Data**: Seluruh data visual berasal dari props API yang valid.
4.  **Props From API**: Komponen React publik hanya menerima data melalui props yang dipasok dari server/database.
5.  **CRUD from Database**: Fungsionalitas pembuatan, pembacaan, pembaruan, dan penghapusan data seksi di admin panel memengaruhi tabel database secara valid.
6.  **Preview Works**: Tombol atau parameter pratinjau (`?preview=true`) memuat isi dari kolom `draft_content` dengan akurat secara terisolasi.
7.  **Publish Works**: Aksi publikasi mentransfer draf ke kolom `content` secara aman serta memicu invalidasi cache.
8.  **Rollback Works**: Jika terjadi kegagalan atau pembatalan draf, data kembali ke draf terakhir tanpa merusak konten publik aktif.
9.  **Safe DB Fallback**: Apabila database dalam keadaan kosong, komponen React wajib merender fallback default yang aman secara visual tanpa menyebabkan *runtime crash*.
10. **TypeScript Error-Free**: Seluruh berkas kode bebas dari kesalahan ketik atau peringatan dari compiler TypeScript.
11. **Production Build Success**: Proses kompilasi produksi (`npm run build`) harus selesai dengan status sukses 100%.

---

## BAB 7 — Regression Protection Rules

Setiap kali melakukan pembaruan atau implementasi fitur baru pada CMS, developer atau AI Agent **WAJIB** menjalankan pengujian regresi (*regression validation*) secara menyeluruh pada komponen-komponen kritis berikut:

*   **Navbar**: Navigasi dan link menu atas aktif.
*   **Hero**: Render slide latar belakang dan tautan tombol utama.
*   **Gallery**: Penyaringan kategori dinamis dan pemuatan asset media.
*   **FAQ**: Mekanisme interaksi akordeon buka-tutup.
*   **Footer**: Peta Google Maps embed, nomor WhatsApp raw link, dan tautan footer menu navigasi bawah.
*   **SEO**: Ketersediaan meta tag dasar dan struktur JSON-LD.
*   **Preview, Publish, & Rollback**: Aliran draf konten.

> [!WARNING]
> Jika salah satu dari item regresi di atas mengalami kerusakan atau kegagalan fungsi, maka fase implementasi saat itu **dinyatakan GAGAL**. AI Agent dilarang berpindah ke seksi berikutnya sebelum masalah regresi diselesaikan hingga tuntas.

---

## BAB 8 — Evidence-Based Development

Kontrak ini menuntut **Pola Pembangunan Berbasis Bukti** (*Evidence-Based Development*) dan melarang keras asumsi tak terverifikasi.

*   AI Agent **DILARANG** mengasumsikan komponen sudah selesai hanya karena kodenya terlihat benar secara statis.
*   AI Agent **DILARANG** mengklaim CRUD sudah terhubung atau API sudah digunakan tanpa membuktikannya.
*   Setiap klaim penyelesaian wajib dibuktikan melalui penelusuran rantai data:
    `Form CMS Admin → Payload API Endpoint → Kueri Database → Return Service Layer → Props React Component → Hasil Rendered HTML di Browser`.
*   Jika salah satu mata rantai di atas belum terbukti mengalirkan data asli secara nyata, status seksi tersebut wajib ditulis sebagai **UNKNOWN** atau **NOT VERIFIED** (Bukan *DONE*).

---

## BAB 9 — Section-by-Section Completion Workflow

Urutan pengerjaan integrasi landing page wajib mengikuti urutan beruntun di bawah ini. AI Agent dilarang melompati urutan atau mengerjakan seksi secara paralel sebelum seksi sebelumnya lolos seluruh kriteria *Developer DoD*:

1.  **Navbar** (Navigasi Atas)
2.  **Hero** (Banner Utama)
3.  **Hero Carousel** (Slideshow Latar)
4.  **Why Choose Us** (Bento Grid)
5.  **About** (Kredibilitas)
6.  **Programs** (Trisula Kompetensi)
7.  **School Life** (Timeline Keseharian)
8.  **Gallery** (Masonry Dokumentasi)
9.  **Testimonials** (Review Wali Murid)
10. **Principal** (Profil & Sambutan Kepala Sekolah)
11. **FAQ** (Tanya Jawab)
12. **CTA** (Banner Ajakan Pendaftaran)
13. **Footer** (Kaki Halaman & Peta)

---

## BAB 10 — Implementation Review Gate

Sebelum sebuah fase implementasi dinyatakan selesai secara formal, developer wajib menjawab gerbang evaluasi (*review gate*) berikut dengan objektif:

*   *Apakah masih ada konten bisnis sekolah yang tertulis keras (hardcoded) di komponen publik?* **[Ya / Tidak]**
*   *Apakah seluruh gambar visual di situs publik bersumber dari Media Library CMS?* **[Ya / Tidak]**
*   *Apakah semua tombol aksi di situs publik dapat dikonfigurasi melalui form CMS?* **[Ya / Tidak]**
*   *Apakah semua alamat URL di situs publik berasal dari database?* **[Ya / Tidak]**
*   *Apakah fitur Pratinjau Draf (`?preview=true`) berhasil?* **[Ya / Tidak]**
*   *Apakah fitur Publikasi Draf berhasil?* **[Ya / Tidak]**
*   *Apakah fitur fallback berjalan tanpa crash saat data kosong?* **[Ya / Tidak]**
*   *Apakah kompilasi build produksi berhasil 100%?* **[Ya / Tidak]**

> [!IMPORTANT]
> Jika salah satu jawaban di atas adalah **Tidak** (atau masih menyisakan keraguan), maka fase implementasi **TIDAK BOLEH** ditandai sebagai selesai.

---

## BAB 11 — Zero Hardcoded Business Content Rule

Sistem CMS Landing Page SIUBA menegakkan aturan mutlak mengenai pembagian antara data dinamis dan kode program statis.

### Yang Wajib Berasal dari CMS (Dilarang Keras Hardcoded):
*   Seluruh teks judul seksi, sub-judul, deskripsi paragraf, badge teks, nama orang, jabatan, dan kutipan.
*   Seluruh berkas gambar, ikon ilustrasi, foto profil, dan logo instansi.
*   Seluruh alamat URL eksternal, nomor telepon WhatsApp, email resmi, dan link Google Maps embed.
*   Teks label tombol menu navigasi atas (Navbar) dan menu bawah (Footer).

### Yang Boleh Hardcoded di File `.tsx`:
*   Nama-nama kelas styling CSS (Tailwind CSS classes untuk spasi, warna border default, transisi hover, tata letak grid, dan responsivitas).
*   Logika animasi masuk dan keluar (Framer Motion properties seperti `initial`, `whileInView`, `transition`).
*   Ikon default pembantu navigasi (seperti ikon Chevron panah, Plus/Minus akordeon, ikon pembuka laci menu).
*   Struktur HTML semantik (`<section>`, `<header>`, `<h1>`, `<div>`, `<p>`).

---

## BAB 12 — Architecture Validation Checklist

Sebelum memulai fase implementasi teknis apa pun, developer atau AI Agent wajib menjawab daftar pertanyaan validasi arsitektur berikut:

1.  **Complexity Reduction**: Apakah implementasi ini mengurangi kompleksitas kode dan membuat data mengalir lebih sederhana?
2.  **Administrator Clarity**: Apakah penempatan form input baru ini sudah logis dan tidak membingungkan bagi administrator sekolah?
3.  **Encapsulation of Details**: Apakah antarmuka admin telah menyembunyikan detail teknis penyimpanan database (seperti serialisasi string JSON) dan menyajikannya dalam bentuk komponen UI yang bersih?
4.  **Maintenance Cost**: Apakah pemisahan file komponen dan pemetaan props ini meminimalkan biaya pemeliharaan kode di masa depan?
5.  **Scalability**: Apakah penambahan item repeater baru (seperti bento card atau galeri baru) dapat ditampung secara dinamis tanpa perlu mengubah struktur tabel database di kemudian hari?
6.  **Administrator Need**: Apakah fitur ini benar-benar dibutuhkan oleh administrator untuk mengelola sekolah?
7.  **Terminology**: Apakah administrator memahami istilah operasional yang disajikan di panel admin?
8.  **Dead Fields**: Apakah ada field input yang sebenarnya tidak pernah digunakan atau ditampilkan pada landing page publik?
9.  **Hardcoded React Fields**: Apakah masih ada bagian field yang nilainya terpaksa di-hardcoded di komponen React?
10. **Data Source Redundancy**: Apakah ada duplikasi sumber data (misal: data kontak yang disimpan di dua tabel berbeda)?
11. **Traceability Path**: Apakah field ini memiliki alur keterlacakan yang jelas sampai ke elemen HTML publik?

---

## BAB 13 — Production Readiness Checklist

Berikut adalah daftar centang kesiapan produksi (*Production Readiness Checklist*) akhir sebelum sistem dinyatakan production-grade:

### 1. Kriteria Fungsional (Functional)
*   [ ] Semua seksi landing page publik dapat disunting (*fully editable*).
*   [ ] Semua aset gambar visual dapat disunting/diganti via Media Library.
*   [ ] Semua tombol aksi dapat diubah label dan tautannya.
*   [ ] Semua link eksternal dan navigasi dapat dilihat/diedit.

### 2. Kriteria Teknis (Technical)
*   [ ] Tidak ada konten bisnis yang masih keras-tertulis (hardcoded) di komponen React.
*   [ ] Tidak ada data dummy atau mock array yang tersisa.
*   [ ] Tidak ada komponen visual publik yang mengabaikan props masukan dari CMS.
*   [ ] Seluruh aset media ditarik secara terelasi dari Media Library.

### 3. Kriteria Operasional (Operational)
*   [ ] Fitur pratinjau draf (`?preview=true`) beroperasi normal tanpa memengaruhi halaman live.
*   [ ] Fitur publikasi draf instan berjalan lancar.
*   [ ] Penanganan fallback berjalan aman saat database kosong.
*   [ ] Sistem audit log mencatat aktivitas penting administrator.

### 4. Kriteria Kualitas (Quality)
*   [ ] Lulus seluruh pengujian regresi komponen kritis.
*   [ ] Kompilasi Next.js sukses tanpa error.
*   [ ] Tidak ada error dari compiler TypeScript.
*   [ ] Bersih dari error ESLint/formatting.

---

## BAB 14 — Implementation Roadmap

Roadmap implementasi disusun berdasarkan hasil **Landing Page CMS Traceability Audit**. Prioritas kerja didasarkan pada *business outcome*, keterlacakan data (*traceability*), nilai bisnis (*business value*), kesiapan produksi (*production readiness*), serta keselamatan regresi (*regression safety*), bukan lagi berdasarkan lapisan teknis semata.

### Phase 1 — End-to-End Traceability Foundation
*   **Objective**: Memastikan seluruh rantai data benar-benar terhubung dari hulu ke hilir: `CMS` → `API` → `Service` → `Database` → `React Component` → `Landing Page`. Fokus utama fase ini adalah validasi keterlacakan data (*traceability*), bukan melakukan desain ulang antarmuka (redesign UI).
*   **Deliverables**:
    *   Seluruh field memiliki jalur data (*traceability chain*) yang jelas dan terbukti mengalir.
    *   Tidak ada mata rantai yang terputus di tengah jalan.
    *   Seluruh parameter masukan (props) komponen publik dipasok dari Service Layer.
    *   Seluruh data visual publik bersumber dari database CMS.
    *   Sistem fallback tetap bekerja secara aman tanpa crash visual jika database dalam keadaan kosong.
*   **Exit Criteria**:
    > [!IMPORTANT]
    > Phase 1 dinyatakan **BELUM SELESAI** jika masih ditemukan:
    > 1. Konten bisnis yang tertulis keras (*hardcoded*) di komponen publik.
    > 2. Props kiriman API/Service yang diabaikan atau ditimpa oleh data dummy lokal di React.
    > 3. Endpoint API yang tidak digunakan atau tidak terhubung ke frontend.
    > 4. Method Service Layer yang tidak dipanggil.
    > 5. Field input CMS yang datanya tidak pernah muncul di landing page.

### Phase 2 — Public Landing Page Migration
*   **Objective**: Menghilangkan seluruh konten bisnis statis (*hardcoded business content*) dari Landing Page publik. Implementasi wajib dilakukan secara bertahap per seksi (*section-by-section*), dilarang keras memigrasi semua komponen sekaligus.
*   **Urutan Implementasi Seksi**:
    1.  **Navbar** (Header Navigasi)
    2.  **Hero** (Banner Utama)
    3.  **Hero Carousel** (Slideshow Latar)
    4.  **Why Choose Us** (Bento Grid)
    5.  **About** (Kredibilitas)
    6.  **Programs** (Trisula Kompetensi)
    7.  **School Life** (Timeline Keseharian)
    8.  **Gallery** (Masonry Dokumentasi)
    9.  **Testimonials** (Review Wali Murid)
    10. **Principal** (Profil & Sambutan Kepala Sekolah)
    11. **FAQ** (Tanya Jawab)
    12. **CTA** (Banner Ajakan Pendaftaran)
    13. **Footer** (Kaki Halaman & Peta)
*   **Aturan Migrasi**:
    > [!WARNING]
    > AI Agent dilarang keras melanjutkan ke seksi berikutnya sebelum seksi sebelumnya memenuhi seluruh kriteria **Definition of Done (DoD)** dan lolos pengujian regresi (*regression validation*).
*   **DoD per Seksi (Gate Kriteria)**:
    *   [ ] **CRUD selesai**: Data seksi tersimpan dan dapat dimodifikasi di database via Admin Panel.
    *   [ ] **Preview selesai**: Perubahan draf dapat ditinjau via `?preview=true` tanpa merusak situs publik aktif.
    *   [ ] **Publish selesai**: Aksi publikasi mentransfer draf ke data live.
    *   [ ] **Traceability selesai**: Seluruh field terbukti mengalir dari CMS ke HTML publik.
    *   [ ] **Regression selesai**: Komponen kritis lainnya dipastikan tidak mengalami kerusakan fungsi.

### Phase 3 — CMS Workspace Refinement
*   **Objective**: Menyempurnakan pengalaman administrator sekolah saat mengelola konten di Admin Panel.
*   **Aturan Prasyarat**:
    > [!CAUTION]
    > Menyempurnakan UX Administrator **HANYA BOLEH dilakukan setelah seluruh Landing Page publik 100% dikendalikan oleh CMS** (bebas dari konten hardcoded). Fokus publik harus diutamakan sebelum merapikan panel belakang.
*   **Aktivitas**:
    *   Penyederhanaan tata letak formulir (UX simplification).
    *   Integrasi dropdown / selektor pencarian ikon (icon picker).
    *   Integrasi pustaka media terpadu (media library picker).
    *   Penyempurnaan alur kerja pengulangan data (repeater UX).
    *   Penyelarasan alur kerja Pratinjau (preview workflow), Publikasi (publish workflow), dan penyimpanan Draf (draft workflow).
    *   Penyesuaian istilah operasional ramah administrator (terminology refinement).
    *   Validasi arsitektur informasi menu admin (information architecture refinement).

### Phase 4 — Production Hardening & Release Readiness
*   **Objective**: Memperkuat sistem CMS dan memastikan kesiapan rilis penuh menuju lingkungan produksi (*production-grade*).
*   **Aktivitas**:
    *   Pengujian regresi menyeluruh (regression testing).
    *   Pemeriksaan aksesibilitas elemen interaktif (accessibility review).
    *   Validasi metadata SEO dinamis dan struktur JSON-LD (SEO validation).
    *   Pemeriksaan integritas catatan riwayat perubahan (audit log verification).
    *   Uji coba pemulihan ke versi cadangan sebelumnya (rollback verification).
    *   Optimasi kecepatan muat aset dan query database (performance review).
    *   Pembersihan file komponen tidak terpakai (dead code cleanup).
    *   Pemeriksaan ketat compiler TypeScript dan aturan linter ESLint (TypeScript & ESLint validation).
    *   Uji coba kompilasi produksi Next.js (production build verification).
*   **Exit Criteria**:
    *   Sistem dinyatakan **Production-Ready** hanya jika seluruh kriteria pada *Production Readiness Checklist* (BAB 13) terpenuhi 100%.

---

### Roadmap Summary Table

| Phase | Goal | Success Criteria |
| :--- | :--- | :--- |
| **Phase 1** | End-to-End Traceability | Seluruh alur CMS $\rightarrow$ Landing Page tervalidasi dan terhubung tanpa mata rantai terputus. |
| **Phase 2** | Public Component Migration | Tidak ada lagi konten bisnis sekolah yang keras-tertulis (*hardcoded*) di komponen publik. |
| **Phase 3** | CMS Workspace Refinement | Administrator sekolah dapat mengelola konten dengan nyaman melalui UI visual tanpa memahami detail database teknis. |
| **Phase 4** | Production Hardening | Seluruh pengujian regresi, audit log, rollback, SEO, TypeScript, dan Next.js build lulus 100%. |

---

## BAB 15 — Stop Condition & Exit Protocol

Dokumen ini berfungsi sebagai kontrak kerja mutlak antara sistem dengan AI Agent. 

> [!CAUTION]
> **PROTOKOL BERHENTI (STOP CONDITION)**:
> 1. AI Agent **WAJIB SEGERA BERHENTI** menulis kode, mengubah berkas proyek, atau memanggil perintah terminal setelah revisi dokumen desain markdown `CMS_TRACEABILITY_IMPLEMENTATION_PLAN.md` ini berhasil disimpan.
> 2. AI Agent **DILARANG KERAS** melanjutkan ke tahap eksekusi kode, melakukan migrasi database, atau memodifikasi file komponen secara otomatis tanpa persetujuan eksplisit dari pengguna.
> 3. AI Agent harus menunggu pengguna memberikan umpan balik (feedback) atau menekan tombol **Proceed** pada sistem antarmuka sebelum mengambil tindakan lebih lanjut.
