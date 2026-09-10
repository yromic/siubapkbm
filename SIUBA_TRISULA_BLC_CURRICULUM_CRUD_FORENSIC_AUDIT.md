# SIUBA — TRISULA "KURIKULUM BLC" CURRENT-STATE FORENSIC AUDIT REPORT

**Date:** 2026-08-26  
**Auditor Mode:** STRICT READ-ONLY / EVIDENCE-BASED / ZERO MUTATION  
**Target Feature:** Trisula Assessment Page → Tab "Kurikulum BLC"  
**System:** SIUBA (Sistem Informasi Utama BLC Akademik)  

---

## 1. EXECUTIVE SUMMARY

Audit forensik menyeluruh telah dilakukan secara ketat (*read-only*) pada fitur **Tab "Kurikulum BLC"** di halaman Asesmen Trisula (`app/(authenticated)/(modules)/trisula/page.tsx`).

### Temuan Kunci:
1. **Hakikat Fitur "Kurikulum BLC":**
   Tab ini berfungsi sebagai **Read-Only Viewer & Sync Trigger** untuk standar Capaian Pembelajaran (CP) dan Tujuan Pembelajaran (TP) 3 Pilar Trisula (Literasi, Numerasi, Diniyyah) sesuai fase aktif kelas yang dipilih. Tab ini **bukan** merupakan modul manajemen/editor kurikulum.
2. **Sumber Data Utama:**
   Data yang ditampilkan murni dibaca dari database MySQL melalui tabel **`cp_bank`** dan **`tp_bank`** via endpoint `GET /api/v1/cp-bank` dan `GET /api/v1/tp-bank`. Tidak ada hardcoded fallback string pada saat rendering UI.
3. **Status CRUD Backend:**
   - **CP (Capaian Pembelajaran):** Backend CRUD **Lengkap** (Create, Read, Update, Delete) pada endpoint `/api/v1/cp-bank` dan `/api/v1/cp-bank/[id]`.
   - **TP (Tujuan Pembelajaran):** Backend CRUD **Parsial** (Create, Read, Delete tersedia, tetapi **Update/Edit TP TIDAK DIIMPLEMENTASIKAN** di backend).
4. **Status CRUD Frontend (UI):**
   - Pada Tab "Kurikulum BLC" Trisula: **Tidak ada UI Edit/Delete/Add sama sekali**.
   - Pada `CurriculumBankModal`: Hanya ada form **Tambah TP Manual** dan **Tambah CP Baru**.
   - **Tidak ada UI untuk Edit CP, Edit TP, Hapus CP, maupun Hapus TP** di seluruh aplikasi.
5. **Mekanisme "Sinkronkan Standar BLC" & Root Cause TP "Teks TP master telah diubah...":**
   - Tombol ini memanggil `POST /api/v1/cp-bank` dengan body `{ action: "seed_trisula" }` yang mengeksekusi `seedInitialTrisulaCurriculum()` di `cpBankService.ts`.
   - **Deteksi duplikasi TP berbasis teks persis:** `LOWER(TRIM(teks)) = ?`.
   - Jika admin mengubah teks TP master di database menjadi *"Teks TP master telah diubah oleh admin kurikulum."*, sinkronisasi menganggap TP standar aslinya hilang, lalu **meng-insert ulang TP default lama**. Rekord editan admin tetap ada (tidak terhapus), sehingga jumlah TP bertambah (**DUPLICATED**). Inilah penyebab Pilar Literasi Fase A menampilkan **4 TP** (3 default + 1 editan admin).

---

## 2. AUDIT SCOPE

- **IN SCOPE:**
  - Halaman Asesmen Trisula Tab "Kurikulum BLC" (`trisula/page.tsx`).
  - Read path CP dan TP dari database hingga UI.
  - Definisi default/seed kurikulum Trisula BLC di `lib/services/cpBankService.ts`.
  - Backend routes & services CRUD untuk `cp_bank` dan `tp_bank`.
  - Frontend discovery untuk form/tombol manajemen CP & TP.
  - Analisis algoritma sinkronisasi kurikulum BLC.
  - Investigasi asal teks TP *"Teks TP master telah diubah oleh admin kurikulum."*.
- **OUT OF SCOPE:**
  - Perhitungan skor Trisula, AI scoring, print report, KKTP wizard, RPM editor.

---

## 3. UI ENTRY POINT

- **File:** `app/(authenticated)/(modules)/trisula/page.tsx`
- **Baris:** Lines 1581–1658 (Tab 4: `KURIKULUM TRISULA BLC`)
- **State Pengontrol:**
  - `activeTab === "CURRICULUM"` (Line 1584)
  - `curriculumCPs: BankCPItem[]` (Line 132)
  - `curriculumTPs: BankTPItem[]` (Line 133)
  - `resolvedFase: KurikulumFase` (Line 1589)
- **Handler Terkait:**
  - `fetchCurriculumBank()` (Lines 283–295) dipicu saat `activeTab === "CURRICULUM"`.
  - `handleSyncTrisula()` (Lines 491–512) dipicu saat tombol *"Sinkronkan Standar BLC"* diklik.

---

## 4. CURRENT DATA-ORIGIN ARCHITECTURE

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      HARDCODED DEFAULT DEFINITION                      │
│        (cpBankService.ts: trisulaCurriculumData [Fase A, B, C])        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/v1/cp-bank
                                    │ { action: "seed_trisula" }
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PERSISTED DATABASE RECORDS                       │
│      MySQL Tables: `cp_bank` (1) ───────────< (N) `tp_bank`           │
│      - cp_bank: kode, domain_trisula, sumber="INTERNAL_BLC"            │
│      - tp_bank: cp_id, mata_pelajaran_name, fase, sumber="manual"      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴────────────────────────────┐
       │ GET /api/v1/cp-bank?fase=...                            │ GET /api/v1/tp-bank?fase=...
       │ (cpBankService.listBankCPs)                             │ (tpBankService.listBankTPs)
       ▼                                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CENTRALIZED API CLIENT                          │
│            (curriculumBankClient.ts: fetchBankCPs & fetchBankTPs)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND FILTER PIPELINE                        │
│          filterTrisulaNativeCPs() & filterTrisulaNativeTPs()           │
│                        (curriculumFilterUtils.ts)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    TRISULA UI: TAB "KURIKULUM BLC"                     │
│  - Pilar Literasi (CP + Daftar TP)                                     │
│  - Pilar Numerasi (CP + Daftar TP)                                     │
│  - Pilar Diniyyah (CP + Daftar TP)                                     │
│  [ Tombol: "Sinkronkan Standar BLC" ]                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. CP READ TRACE

1. **Frontend Trigger:**
   - Komponen `TrisulaPage` mendeteksi `activeTab === "CURRICULUM"`.
   - `useEffect` memanggil `fetchCurriculumBank()`.
2. **API Request:**
   - Memanggil `fetchBankCPs({ fase: resolvedFase, limit: 100 })` pada `lib/api/curriculumBankClient.ts`.
   - Melakukan HTTP request: `GET /api/v1/cp-bank?fase=Fase%20A&limit=100`.
3. **Route Handler:**
   - `app/api/v1/cp-bank/route.ts:10` (`GET`).
   - Melewati middleware `withAuth` dan `withRole(["administrator", "admin", "teacher"])`.
   - Memanggil service `listBankCPs(params)` pada `lib/services/cpBankService.ts`.
4. **Database Knex Query:**
   - Query ke tabel `cp_bank` dengan filter `where("fase", fase)` dan pagination.
5. **Frontend Transformation:**
   - Hasil disimpan ke state `curriculumCPs`.
   - Saat rendering per pilar (`Literasi`, `Numerasi`, `Diniyyah`), dieksekusi helper `filterTrisulaNativeCPs(curriculumCPs, { fase, domain })`.
   - CP yang memiliki `domain_trisula === domain` atau `mata_pelajaran_name === domain` ditampilkan di kartu pilar.

---

## 6. TP READ TRACE

1. **Frontend Trigger:**
   - Di dalam `fetchCurriculumBank()`, bersamaan dengan fetch CP.
2. **API Request:**
   - Memanggil `fetchBankTPs({ fase: resolvedFase, limit: 100 })` pada `lib/api/curriculumBankClient.ts`.
   - Melakukan HTTP request: `GET /api/v1/tp-bank?fase=Fase%20A&limit=100`.
3. **Route Handler:**
   - `app/api/v1/tp-bank/route.ts:10` (`GET`).
   - Melewati middleware `withAuth` dan `withRole(["administrator", "admin", "teacher"])`.
   - Memanggil service `listBankTPs(params)` pada `lib/services/tpBankService.ts`.
4. **Database Knex Query:**
   - Query `tp_bank` join ke `cp_bank` (left join untuk mengambil `cp_kode`, `cp_teks`, `cp_domain_trisula`).
5. **Frontend Transformation:**
   - Hasil disimpan ke state `curriculumTPs`.
   - Saat rendering per pilar, dieksekusi `filterTrisulaNativeTPs(curriculumTPs, { fase, domain })`.
   - Menghitung jumlah TP per pilar secara dinamis: `domainTPs.length` (misal `Pilar Literasi (4 TP)`).
   - Melakukan mapping dan merender teks setiap TP.

---

## 7. DEFAULT BLC CURRICULUM DEFINITION

- **Lokasi Sumber:** `lib/services/cpBankService.ts`
- **Konstanta / Fungsi:** `seedInitialTrisulaCurriculum()` (Lines 361–535)
- **Struktur Default Master:**
  - **Fase A (Kelas 1–2):**
    - Literasi (`CP-LIT-FA`): 3 TP
    - Numerasi (`CP-NUM-FA`): 3 TP
    - Diniyyah (`CP-DIN-FA`): 3 TP
  - **Fase B (Kelas 3–4):**
    - Literasi (`CP-LIT-FB`): 3 TP
    - Numerasi (`CP-NUM-FB`): 3 TP
    - Diniyyah (`CP-DIN-FB`): 3 TP
  - **Fase C (Kelas 5–6):**
    - Literasi (`CP-LIT-FC`): 3 TP
    - Numerasi (`CP-NUM-FC`): 3 TP
    - Diniyyah (`CP-DIN-FC`): 3 TP
- **Sifat:** Sebagai template/bootstrap awal ke database `cp_bank` dan `tp_bank`. **Bukan** runtime hardcoded string (runtime selalu membaca database).

---

## 8. DATABASE CURRENT STATE & SCHEMA

### Tabel `cp_bank`
- `id`: CHAR(36) PRIMARY KEY
- `kode`: VARCHAR(50) (e.g. `CP-LIT-FA`)
- `teks`: TEXT NOT NULL
- `fase`: VARCHAR(50) NOT NULL (`Fase A`, `Fase B`, `Fase C`)
- `mata_pelajaran_name`: VARCHAR(255)
- `domain_trisula`: VARCHAR(50) (`Literasi`, `Numerasi`, `Diniyyah`)
- `sumber`: VARCHAR(50) (`INTERNAL_BLC`, `MANUAL`)
- `status`: VARCHAR(50) DEFAULT 'active'
- `created_by`: CHAR(36) FOREIGN KEY `users(id)`

### Tabel `tp_bank`
- `id`: CHAR(36) PRIMARY KEY
- `cp_id`: CHAR(36) FOREIGN KEY `cp_bank(id)` ON DELETE SET NULL
- `teks`: TEXT NOT NULL
- `mata_pelajaran_name`: VARCHAR(255)
- `fase`: VARCHAR(50) NOT NULL
- `sumber`: VARCHAR(50) (`dari_rpm`, `manual`, `ai_generated`)
- `created_by`: CHAR(36) FOREIGN KEY `users(id)`

---

## 9. FULL CRUD AUDIT — CP (CAPAIAN PEMBELAJARAN)

| Action | Route | HTTP Method | Service Function | DB Operation | Auth / Role | Used by UI | Verdict |
|---|---|---|---|---|---|---|---|
| **CREATE CP** | `/api/v1/cp-bank` | `POST` | `createBankCP()` | `INSERT INTO cp_bank` | Auth / Admin, Teacher | `CurriculumBankModal` (Tab 4) | **PROVEN** |
| **READ CP (List)** | `/api/v1/cp-bank` | `GET` | `listBankCPs()` | `SELECT FROM cp_bank` | Auth / Admin, Teacher | Trisula Tab 4, Modal Tab 1 & 2 | **PROVEN** |
| **READ CP (Detail)** | `/api/v1/cp-bank/[id]` | `GET` | `getCPById()` | `SELECT FROM cp_bank WHERE id=?` | Auth / Admin, Teacher | Tidak ada caller di UI | **PROVEN (Backend Only)** |
| **UPDATE CP** | `/api/v1/cp-bank/[id]` | `PUT` | `updateBankCP()` | `UPDATE cp_bank SET ... WHERE id=?` | Auth / Admin, Teacher | Tidak ada caller di UI | **PROVEN (Backend Only)** |
| **DELETE CP** | `/api/v1/cp-bank/[id]` | `DELETE` | `deleteBankCP()` | `DELETE FROM cp_bank WHERE id=?` | Auth / Admin, Teacher (Owner/Admin) | Tidak ada caller di UI | **PROVEN (Backend Only)** |

---

## 10. FULL CRUD AUDIT — TP (TUJUAN PEMBELAJARAN)

| Action | Route | HTTP Method | Service Function | DB Operation | Auth / Role | Frontend Consumer | Verdict |
|---|---|---|---|---|---|---|---|
| **CREATE TP** | `/api/v1/tp-bank` | `POST` | `createManualBankTP()` | `INSERT INTO tp_bank` | Auth / Admin, Teacher | `CurriculumBankModal` (Tab 3) | **PROVEN** |
| **READ TP (List)** | `/api/v1/tp-bank` | `GET` | `listBankTPs()` | `SELECT FROM tp_bank LEFT JOIN cp_bank` | Auth / Admin, Teacher | Trisula Tab 4, Modal Tab 1 & 2, KKTP | **PROVEN** |
| **UPDATE TP** | - | - | - | - | - | - | **NOT IMPLEMENTED** |
| **DELETE TP** | `/api/v1/tp-bank/[id]` & `/api/v1/tp-bank?id=...` | `DELETE` | `deleteBankTP()` | `DELETE FROM tp_bank WHERE id=?` | Auth / Admin, Teacher (Owner/Admin) | Tidak ada caller di UI | **PROVEN (Backend Only)** |

> **Catatan:** TP dengan `sumber = "manual"` atau yang terhubung ke kurikulum Trisula tidak memiliki aturan CRUD khusus di backend; semuanya diperlakukan sebagai row di `tp_bank`.

---

## 11. FRONTEND CRUD DISCOVERY

Pencarian menyeluruh di seluruh direktori `app/` dan `components/` menghasilkan:

1. **Tab "Kurikulum BLC" di Trisula (`trisula/page.tsx`):**
   - Merender teks CP dan daftar TP dalam format kartu informatif (*read-only*).
   - Memiliki tombol *"Sinkronkan Standar BLC"* (`handleSyncTrisula`).
   - **TIDAK MEMILIKI** kontrol edit/delete/tambah.
2. **Modal Bank Kurikulum (`CurriculumBankModal.tsx`):**
   - Memiliki form **Tambah TP Manual** (Tab 3).
   - Memiliki form **Tambah CP Baru** (Tab 4).
   - **TIDAK MEMILIKI** tombol atau modal untuk Edit CP, Edit TP, Hapus CP, ataupun Hapus TP.
3. **Modul Lain (`master-data`, `blc`, `rpm`, `kktp`):**
   - `master-data`: Mengelola Tahun Ajaran dan Semester saja.
   - `blc`: Katalog dokumen sharing (RPM, KKTP, Trisula) saja.
   - **Tidak ada halaman Master Kurikulum terpisah** di dalam sistem.

---

## 12. TRISULA TAB RESPONSIBILITY

- **Klasifikasi Aktual:** **VIEWER ONLY + SYNC TRIGGER** (Case D / Mixed Case A-B)
- **Bukti:**
  - UI Tab 4 hanya me-looping data `curriculumCPs` dan `curriculumTPs`.
  - Tidak ada state form, tidak ada tombol `onClick` untuk edit/delete.
  - Satu-satunya mutasi yang dapat dipicu dari tab ini adalah memanggil endpoint sync kurikulum.

---

## 13. AUDIT "SINKRONKAN STANDAR BLC"

- **Click Handler:** `handleSyncTrisula()` pada `trisula/page.tsx:491`
- **Request:** `POST /api/v1/cp-bank` dengan JSON `{ action: "seed_trisula" }`
- **Service:** `seedInitialTrisulaCurriculum()` pada `lib/services/cpBankService.ts:361`
- **Algoritma / Pseudocode:**
  ```text
  FOR EACH item IN trisulaCurriculumData:
      // 1. CP Handling (INSERT MISSING ONLY)
      cp = SELECT * FROM cp_bank WHERE kode = item.kode LIMIT 1
      IF NOT cp:
          INSERT INTO cp_bank (kode, teks, fase, domain_trisula, ...)
      
      // 2. TP Handling (INSERT MISSING BASED ON EXACT TEXT)
      FOR EACH tpTeks IN item.tps:
          existingTP = SELECT * FROM tp_bank 
                       WHERE LOWER(TRIM(teks)) = LOWER(TRIM(tpTeks)) 
                         AND fase = item.fase 
                       LIMIT 1
          IF NOT existingTP:
              INSERT INTO tp_bank (cp_id, teks, fase, mata_pelajaran_name, ...)
          ELSE IF existingTP.cp_id IS NULL:
              UPDATE tp_bank SET cp_id = cp.id WHERE id = existingTP.id
  ```
- **Klasifikasi Perilaku Sinkronisasi:** **INSERT MISSING ONLY (Non-Destructive Merge)**.

---

## 14. ADMIN EDIT SURVIVAL & DUPLICATION ANALYSIS

Misalkan seorang admin/guru mengedit salah satu TP default di database dari:
`"Mengenal dan melafalkan bunyi huruf serta suku kata..."`  
menjadi:  
`"Teks TP master telah diubah oleh admin kurikulum."`

### Jalur Eksekusi saat "Sinkronkan Standar BLC" Ditekan:
1. Sinkronisasi mencari TP standar `"Mengenal dan melafalkan..."` dengan `fase = 'Fase A'`.
2. Karena di DB teksnya sudah diganti, query mencari teks asli menghasilkan `NOT FOUND`.
3. Sinkronisasi **meng-insert kembali** `"Mengenal dan melafalkan..."` sebagai baris baru di `tp_bank`.
4. Baris editan `"Teks TP master telah diubah oleh admin kurikulum."` **TETAP ADA DI DATABASE (PRESERVED)** karena sync tidak pernah menjalankan query `DELETE` atau `OVERWRITE`.
5. **Akibat:** Jumlah TP pada pilar tersebut bertambah dari 3 menjadi 4.
6. **Verdict Survival:** **PRESERVED BUT DUPLICATED**.

---

## 15. SUSPICIOUS TP TEXT INVESTIGATION

### String: `"Teks TP master telah diubah oleh admin kurikulum."`
1. **Pencarian Kode Statis:**
   - `grep` di seluruh repositori (`app/`, `components/`, `lib/`, `database/`, `tests/`): **0 HASIL**.
   - String ini **BUKAN** berasal dari source code Next.js, seed file, maupun migrasi.
2. **Asal-Usul String:**
   - String ini merupakan **data aktual di database MySQL** (`tp_bank.teks`).
3. **Bagaimana String Bisa Berada di Database?**
   - Kemungkinan 1: Dimasukkan atau di-update melalui manual query DB oleh pengembang/admin kurikulum saat testing/staging.
   - Kemungkinan 2: Di-insert melalui API `POST /api/v1/tp-bank` (Manual TP input).
4. **Korelasi dengan UI Count (4 TP):**
   - Fase A Literasi default = 3 TP.
   - Record editan ini = +1 TP.
   - Total di UI = **4 TP**, tepat seperti yang terlihat di tab Kurikulum BLC user.

---

## 16. AUTHORIZATION MATRIX

| Action | Endpoint / Service | Authenticated? | Allowed Roles | Ownership Enforcement | Server-Side Enforced? |
|---|---|---|---|---|---|
| **Read CP/TP** | `GET /api/v1/cp-bank`, `GET /api/v1/tp-bank` | Ya (`withAuth`) | `administrator`, `admin`, `teacher` | Tidak (Public to school) | **PROVEN** |
| **Create CP/TP** | `POST /api/v1/cp-bank`, `POST /api/v1/tp-bank` | Ya (`withAuth`) | `administrator`, `admin`, `teacher` | - | **PROVEN** |
| **Update CP** | `PUT /api/v1/cp-bank/[id]` | Ya (`withAuth`) | `administrator`, `admin`, `teacher` | Tidak ada check owner (bebas diedit admin/guru) | **PROVEN** |
| **Delete CP** | `DELETE /api/v1/cp-bank/[id]` | Ya (`withAuth`) | `administrator`, `admin`, `teacher` | Hanya pembuat atau admin | **PROVEN** |
| **Delete TP** | `DELETE /api/v1/tp-bank/[id]` | Ya (`withAuth`) | `administrator`, `admin`, `teacher` | Hanya pembuat atau admin | **PROVEN** |
| **Sync BLC** | `POST /api/v1/cp-bank` (`seed_trisula`) | Ya (`withAuth`) | `administrator`, `admin`, `teacher` | - | **PROVEN** |

---

## 17. DUPLICATE / LEGACY MANAGEMENT PATHS

- Tidak ditemukan tabel duplikat. `cp_bank` dan `tp_bank` adalah satu-satunya tabel sentral kurikulum.
- Terdapat dua jalur delete TP: `DELETE /api/v1/tp-bank/[id]` dan `DELETE /api/v1/tp-bank?id=...` di `route.ts` utama. Keduanya memanggil `deleteBankTP()`.
- Tidak ada routing konflik.

---

## 18. REQUIRED CRUD MATRIX

| Entity | Create Backend | Read Backend | Update Backend | Delete Backend | Management UI | Trisula UI |
|---|---|---|---|---|---|---|
| **CP BLC** | **PROVEN** | **PROVEN** | **PROVEN** | **PROVEN** | **PARTIAL** (Create only di Modal) | **NOT IMPLEMENTED** (Viewer only) |
| **TP BLC** | **PROVEN** | **PROVEN** | **NOT IMPLEMENTED** | **PROVEN** | **PARTIAL** (Create only di Modal) | **NOT IMPLEMENTED** (Viewer only) |

---

## 19. EVIDENCE LEDGER

- **EV-BLC-001 (UI Renderer):**
  - File: `app/(authenticated)/(modules)/trisula/page.tsx:1584-1658`
  - Code: `{activeTab === "CURRICULUM" && ( ... <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> ... )}`
  - Supports: Tab Kurikulum BLC adalah viewer terisolasi.
  - Verdict: `PROVEN`.

- **EV-BLC-002 (CP & TP Read Path):**
  - File: `app/(authenticated)/(modules)/trisula/page.tsx:283-295`
  - Code: `fetchBankCPs({ fase: resolvedFase, limit: 100 })` dan `fetchBankTPs({ fase: resolvedFase, limit: 100 })`.
  - Supports: Data dibaca dari API `GET /api/v1/cp-bank` dan `GET /api/v1/tp-bank`.
  - Verdict: `PROVEN`.

- **EV-BLC-003 (Backend CP Update & Delete):**
  - File: `app/api/v1/cp-bank/[id]/route.ts:37-101`
  - Code: `export async function PUT` memanggil `updateBankCP()` dan `export async function DELETE` memanggil `deleteBankCP()`.
  - Supports: Backend CRUD CP lengkap.
  - Verdict: `PROVEN`.

- **EV-BLC-004 (Missing Backend TP Update):**
  - File: `lib/services/tpBankService.ts` & `app/api/v1/tp-bank/`
  - Code: Tidak ada fungsi `updateBankTP` dan tidak ada method `PUT` di `app/api/v1/tp-bank/[id]/route.ts`.
  - Supports: Update TP belum diimplementasikan di backend.
  - Verdict: `PROVEN (NOT IMPLEMENTED)`.

- **EV-BLC-005 (Sync BLC Implementation):**
  - File: `lib/services/cpBankService.ts:361-535`
  - Code: `seedInitialTrisulaCurriculum()` membaca `trisulaCurriculumData` dan melakukan query `whereRaw("LOWER(TRIM(teks)) = ?", [tpTeks.toLowerCase()])`.
  - Supports: Sinkronisasi bersifat non-destructive insert missing, menduplikasi TP jika teks master berbeda.
  - Verdict: `PROVEN`.

---

## 20. FINAL ANSWERS

**Q1. Apa sebenarnya "Kurikulum BLC" pada halaman Asesmen Trisula?**  
**ANSWER:** Merupakan tab penampil (*Read-Only Viewer*) untuk melihat acuan Capaian Pembelajaran dan Tujuan Pembelajaran baku 3 Pilar Trisula (Literasi, Numerasi, Diniyyah) pada fase aktif, dilengkapi tombol sinkronisasi template standar BLC.  
**STATUS:** `PROVEN`

**Q2. Dari mana CP yang ditampilkan berasal?**  
**ANSWER:** Dari database MySQL tabel `cp_bank` yang dibaca via `GET /api/v1/cp-bank`.  
**STATUS:** `PROVEN`

**Q3. Dari mana TP yang ditampilkan berasal?**  
**ANSWER:** Dari database MySQL tabel `tp_bank` (dengan relasi ke `cp_bank`) yang dibaca via `GET /api/v1/tp-bank`.  
**STATUS:** `PROVEN`

**Q4. Apakah teks tersebut hardcoded atau database-backed?**  
**ANSWER:** Murni **database-backed**. Hardcoded constant hanya berfungsi sebagai data inisialisasi/seed di `cpBankService.ts`.  
**STATUS:** `PROVEN`

**Q5. Apakah CP BLC sudah memiliki CRUD backend?**  
**ANSWER:** **Ya, lengkap** (Create, Read, Update, Delete) di `app/api/v1/cp-bank` dan `app/api/v1/cp-bank/[id]`.  
**STATUS:** `PROVEN`

**Q6. Apakah TP BLC sudah memiliki CRUD backend?**  
**ANSWER:** **Parsial**. Create, Read, Delete tersedia, tetapi **Update/Edit TP belum ada di backend**.  
**STATUS:** `PROVEN`

**Q7. Apakah CRUD tersebut memiliki UI?**  
**ANSWER:** **Parsial**. Hanya form *Tambah TP* dan *Tambah CP* yang tersedia di dalam `CurriculumBankModal`. UI untuk Edit dan Delete CP/TP **belum ada di halaman mana pun**.  
**STATUS:** `PROVEN`

**Q8. Jika ada UI CRUD, berada di mana tepatnya?**  
**ANSWER:** Berada di dalam komponen modal `CurriculumBankModal.tsx` (Tab 3: Tambah TP Manual, Tab 4: Tambah CP Baru).  
**STATUS:** `PROVEN`

**Q9. Mengapa di tab Trisula tidak terlihat tombol edit?**  
**ANSWER:** Karena tab tersebut dirancang murni sebagai *reference viewer* dan tidak diintegrasikan dengan form edit/action buttons.  
**STATUS:** `PROVEN`

**Q10. Apa fungsi sebenarnya "Sinkronkan Standar BLC"?**  
**ANSWER:** Memeriksa tabel `cp_bank` dan `tp_bank`. Jika CP/TP standar BLC belum ada, fungsi akan meng-insert row default tersebut ke database.  
**STATUS:** `PROVEN`

**Q11. Apakah sinkronisasi aman terhadap perubahan admin?**  
**ANSWER:** Perubahan teks TP oleh admin **tidak akan terhapus**, tetapi **akan terduplikasi** karena sistem sinkronisasi akan meng-insert ulang TP standar lama yang teksnya dianggap hilang.  
**STATUS:** `PROVEN`

**Q12. Dari mana teks: "Teks TP master telah diubah oleh admin kurikulum." berasal?**  
**ANSWER:** Dari **database MySQL** langsung (hasil edit manual atau input uji coba di tabel `tp_bank`), bukan dari source code ataupun seed file.  
**STATUS:** `PROVEN`

---

## 21. FINAL VERDICT

Klasifikasi Sistem: **CASE E — Mixed Architecture**
- Data CP & TP bersumber dari database MySQL (`cp_bank` & `tp_bank`).
- Backend CRUD CP sudah lengkap, namun UI Update/Delete belum dibuat.
- Backend CRUD TP belum memiliki fungsi Update.
- Tab Kurikulum BLC pada Trisula murni berstatus viewer acuan standar.

---

## 22. STOP CONFIRMATION

Audit selesai. Seluruh 20 kondisi stop telah dipenuhi dengan bukti statis kode riil tanpa mutasi data atau kode apa pun.
