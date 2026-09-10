# SIUBA — SHARED CURRICULUM BANK & TRISULA INTEGRATION FORENSIC AUDIT REPORT

**Date:** 2026-08-26  
**Auditor:** Senior Next.js Architect & Software Forensic Auditor  
**Audit Mode:** STRICT READ-ONLY / EVIDENCE-BASED / ZERO-MUTATION  
**Target System:** SIUBA (Sistem Informasi Utama BLC Akademik)  

---

## 1. EXECUTIVE SUMMARY

Sebuah investigasi forensik read-only telah dilakukan untuk menyelidiki anomali integrasi antara **Bank Tujuan Pembelajaran (Bank TP)**, modul **KKTP (Kriteria Ketercapaian Tujuan Pembelajaran)**, dan modul **Trisula (Penilaian 3 Pilar: Literasi, Numerasi, Diniyyah)**.

### Ringkasan Temuan Utama:
1. **Single Source of Truth DB Terbukti:** Bank TP (`tp_bank`) dan Bank CP (`cp_bank`) adalah satu-satunya tabel sentral kurikulum di MySQL database. Baik KKTP maupun Trisula terbukti membaca tabel yang sama (`tp_bank`). Tidak ada tabel duplikat seperti `kktp_tp_bank` atau `trisula_tp_bank`.
2. **API Contract Shape Standar:** Endpoint `GET /api/v1/tp-bank` dan `GET /api/v1/cp-bank` mengembalikan response terbungkus amplop standar: `{ success: true, message: "...", data: { data: BankTPItem[], pagination: { page, limit, total } } }`.
3. **Compound Root Cause (Multiple Root Causes Terbukti):**
   - **Root Cause A (Historical Contract Unwrap Fragility):** Consumer frontend di masa lalu mengasumsikan properti `.items` atau langsung array `.data`, sementara backend mengembalikan `{ data: { data: [...] } }`. Fix parsial/defensif telah diterapkan oleh agent sebelumnya (`json.data?.data || json.data?.items || json.data || []`), yang secara runtime berhasil mencegah crash/empty array pada unwrap level, namun meninggalkan ambiguitas kontrak.
   - **Root Cause B (Subject vs Trisula Pillar Domain Filtering Mismatch):** TP yang dibuat dari KKTP/RPM memiliki metadata mata pelajaran baku (misal `mata_pelajaran_name = "Matematika"`, `cp_id = NULL`), sedangkan tab kurikulum Trisula dan filter pilar Trisula menyaring secara kaku berdasarkan `domain_trisula = "Numerasi"` atau `mata_pelajaran_name = "Numerasi"`. Akibatnya, TP Matematika yang sah tersimpan di database dan terlihat di KKTP, tetapi **difilter keluar (hilang dari UI)** saat dilihat pada tab kurikulum Trisula BLC.

---

## 2. AUDIT SCOPE

Audit forensik ini mencakup penelusuran read-only terhadap:
- **Working Tree & Git State:** Memverifikasi modifikasi aktual yang dilakukan oleh agent sebelumnya.
- **Database Schema & Migrations:** Tabel `tp_bank`, `cp_bank`, `documents`, `classes`, `trisula_assessments`, `trisula_assessment_curriculum`, `trisula_student_scores`, `trisula_student_summaries`.
- **Write Path:** Alur persistensi TP dari dokumen KKTP/RPM (`documentService.ts`) menuju `tp_bank`.
- **Read Path:** Alur konsumsi data `GET /api/v1/tp-bank` pada KKTP (`kktp/page.tsx`), RPM (`rpm/page.tsx`), Modal Bank (`CurriculumBankModal.tsx`), dan Trisula (`trisula/page.tsx`).
- **Phase Resolution:** Konsistensi derivasi fase kurikulum merdeka (Fase A, B, C) dari rombel/kelas.
- **Subject vs Trisula Pillar Lineage:** Hubungan domain pilar asesmen vs nama mata pelajaran.

---

## 3. READ-ONLY INTEGRITY STATEMENT

Audit ini dijalankan dengan kepatuhan penuh pada **STRICT READ-ONLY RULE**:
- Tidak ada file source code (`.ts`, `.tsx`, `.js`, `.json`) yang dimodifikasi atau dibuat selain dokumen laporan audit ini.
- Tidak ada query mutasi database (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE TABLE`) yang dieksekusi.
- Tidak ada migrasi database yang dijalankan.
- Tidak ada dependensi yang diinstall atau diubah.
- Tidak ada git commit, reset, stash, atau modifikasi working tree.

---

## 4. WORKING TREE & PREVIOUS AGENT DIFF VERIFICATION

Berdasarkan penelusuran source code pada repository saat audit dimulai:

### 4.1. File yang Mengalami Perubahan oleh Agent Sebelumnya:
1. `components/curriculum/CurriculumBankModal.tsx`
2. `app/(authenticated)/(modules)/trisula/page.tsx`
3. `app/(authenticated)/(modules)/rpm/page.tsx`

### 4.2. Detail Modifikasi Agent Sebelumnya:
- **Pada `CurriculumBankModal.tsx` (Lines 135-141 & 168-174):**
  Mengubah parser unwrap `fetchCPs` dan `fetchTPs` menjadi parsing defensif bertingkat:
  ```typescript
  const items = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data?.items)
    ? json.data.items
    : Array.isArray(json.data)
    ? json.data
    : [];
  ```
- **Pada `app/(authenticated)/(modules)/trisula/page.tsx` (Lines 201-207, 231-237, 293-311):**
  Menerapkan unwrap defensif serupa pada `fetchClassSummaries`, `fetchClasses`, dan `fetchCurriculumBank`.
- **Pada `app/(authenticated)/(modules)/rpm/page.tsx` (Lines 2060-2078):**
  Mengintegrasikan `CurriculumBankModal` menggantikan selector manual lokal.

### 4.3. Scope Audit Verdict:
- **Klaim Agent Sebelumnya:** `PROVEN`. Modifikasi defensif unwrap memang telah ditulis ke file tersebut.
- **Status Scope:** `OUTSIDE SCOPE OF AUDIT-ONLY PROMPT` (agent sebelumnya melakukan intervensi kode secara langsung tanpa persetujuan perencanaan).

---

## 5. CURRENT ARCHITECTURE MAP

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          DATABASE (MySQL / Knex)                      │
│                                                                        │
│   ┌───────────────────────────┐         ┌──────────────────────────┐   │
│   │          cp_bank          │ 1     N │         tp_bank          │   │
│   │ id, kode, teks, fase,     │◄────────┤ id, cp_id, teks, fase,   │   │
│   │ domain_trisula, mapel     │         │ mata_pelajaran_name, ... │   │
│   └─────────────┬─────────────┘         └─────────────┬────────────┘   │
└─────────────────┼─────────────────────────────────────┼────────────────┘
                  │                                     │
                  ▼                                     ▼
        GET /api/v1/cp-bank                   GET /api/v1/tp-bank
   { data: { data: [], pag... } }        { data: { data: [], pag... } }
                  │                                     │
         ┌────────┴──────────────────────────┬──────────┴────────┐
         ▼                                   ▼                   ▼
┌──────────────────┐               ┌──────────────────┐ ┌──────────────────┐
│   KKTP Module    │               │  CurriculumBank  │ │  Trisula Module  │
│  (kktp/page.tsx) │               │      Modal       │ │(trisula/page.tsx)│
│ Reads:           │               │ Reads:           │ │ Reads:           │
│ json.data.data   │               │ Defensive unwrap │ │ Tab 4: Filter by │
│ Filters by:      │               │ Tab 1: All TPs   │ │ mapel === domain │
│ mapel & fase     │               │ Tab 2: Filter by │ │ or cp_kode       │
│                  │               │ cp_domain_trisula│ │                  │
└──────────────────┘               └──────────────────┘ └──────────────────┘
```

---

## 6. DATABASE SCHEMA EVIDENCE

### 6.1. Schema Tabel `tp_bank`
Dibuktikan dari file migrasi `database/migrations/20260820100000_create_tp_bank_table.ts` dan service `lib/services/tpBankService.ts`:

| Column Name | Data Type | Nullable | Default | Constraints / Indexes | Keterangan |
|---|---|---|---|---|---|
| `id` | CHAR(36) | NO | - | PRIMARY KEY | UUID v4 |
| `cp_id` | CHAR(36) | YES | NULL | INDEX `idx_tp_bank_cp_id`, FK `cp_bank(id)` ON DELETE SET NULL | Relasi ke parent CP |
| `teks` | TEXT | NO | - | - | Rumusan Tujuan Pembelajaran |
| `mata_pelajaran_id` | CHAR(36) | YES | NULL | INDEX `idx_tp_bank_mapel_fase`, FK `subjects(id)` | ID mata pelajaran master |
| `mata_pelajaran_name`| VARCHAR(255)| YES | NULL | - | Nama mapel string / domain |
| `fase` | VARCHAR(50) | NO | 'Fase C' | INDEX `idx_tp_bank_fase` | 'Fase A', 'Fase B', 'Fase C' |
| `sumber` | ENUM | NO | 'manual' | - | 'dari_rpm', 'manual', 'ai_generated' |
| `created_by` | CHAR(36) | NO | - | INDEX `idx_tp_bank_created_by`, FK `users(id)` | Pembuat record |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | - | Waktu pembuatan |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | - | Waktu update |

### 6.2. Schema Tabel `cp_bank`
Dibuktikan dari `database/migrations/20260821100000_create_cp_bank_and_link_tp.ts` dan `lib/services/cpBankService.ts`:

| Column Name | Data Type | Nullable | Default | Constraints / Indexes | Keterangan |
|---|---|---|---|---|---|
| `id` | CHAR(36) | NO | - | PRIMARY KEY | UUID v4 |
| `kode` | VARCHAR(100) | YES | NULL | - | Misal: 'CP-LIT-FA', 'CP-NUM-FB' |
| `teks` | TEXT | NO | - | - | Rumusan Capaian Pembelajaran |
| `fase` | VARCHAR(50) | NO | 'Fase C' | INDEX `idx_cp_bank_fase` | Fase Kurikulum Merdeka |
| `mata_pelajaran_id` | CHAR(36) | YES | NULL | INDEX `idx_cp_bank_mapel_fase` | Link ke subjects table |
| `mata_pelajaran_name`| VARCHAR(255)| YES | NULL | - | Nama mapel string |
| `domain_trisula` | VARCHAR(50) | YES | NULL | INDEX `idx_cp_bank_domain_trisula` | 'Literasi', 'Numerasi', 'Diniyyah' |
| `sumber` | ENUM | NO | 'INTERNAL_BLC' | INDEX `idx_cp_bank_sumber` | 'OFFICIAL', 'INTERNAL_BLC', 'MANUAL', 'AI_ASSISTED' |
| `status` | ENUM | NO | 'active' | - | 'active', 'inactive' |
| `created_by` | CHAR(36) | YES | NULL | FK `users(id)` | Pembuat record |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | - | Waktu pembuatan |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP | - | Waktu update |

---

## 7. BANK CP CURRENT STATE

- Tabel `cp_bank` berisi capaian pembelajaran Kurikulum Merdeka dan standar Trisula BLC.
- Memiliki fungsi sinkronisasi idempotent: `seedInitialTrisulaCurriculum()` di `lib/services/cpBankService.ts` (Lines 358-535) yang secara otomatis membuat 9 master CP (3 Pilar x 3 Fase A/B/C) beserta child TP standarnya.
- Kolom `domain_trisula` terisi eksplisit dengan `'Literasi'`, `'Numerasi'`, atau `'Diniyyah'` untuk kurikulum standar BLC.

---

## 8. BANK TP CURRENT STATE

- Tabel `tp_bank` menyimpan seluruh TP baik yang dihasilkan dari dokumen KKTP, dokumen RPM, generator AI, maupun input manual guru.
- Tabel ini memiliki relasi opsional `cp_id` ke `cp_bank`.
- Query `listBankTPs()` di `lib/services/tpBankService.ts` (Lines 77-143) melakukan `LEFT JOIN` ke `cp_bank` untuk menyertakan `cp_kode`, `cp_teks`, dan `cp_domain_trisula`.

---

## 9. KKTP → BANK TP WRITE PATH

Alur penulisan dari KKTP ke Bank TP telah ditelusuri pada `lib/services/documentService.ts`:
1. Guru membuat/mengubah dokumen KKTP di wizard/editor.
2. Endpoint `POST /api/v1/documents` atau `PUT /api/v1/documents` dipanggil.
3. Function `createDocument()` / `updateDocument()` menyimpan dokumen ke tabel `documents`.
4. Pada blok background save (Lines 456-487 & Lines 548-579):
   - Fase di-resolve secara kanonikal: `resolveCanonicalPhaseForDocument(classId, className, tingkatFase)`.
   - `autoSaveTPsToBank()` dipanggil dengan payload:
     - `tps`: daftar TP dari `content.tpItems`
     - `mata_pelajaran_id`: `subject_id`
     - `mata_pelajaran_name`: `content.identitas?.mataPelajaran` (misal: "Matematika", "Bahasa Indonesia", "IPAS")
     - `fase`: fase kanonikal (misal: "Fase B")
     - `userId`: ID guru
5. Di dalam `autoSaveTPsToBank()` (`lib/services/tpBankService.ts` Lines 150-248):
   - Dilakukan pengecekan duplikasi: `LOWER(TRIM(teks)) = ?` AND `fase = ?` AND `mata_pelajaran_name = ?`.
   - Jika belum ada, record baru diinsert ke `tp_bank` dengan `sumber = 'dari_rpm' | 'manual' | 'ai_generated'`.
   - **Catatan Kritis:** Pada jalur ini, `cp_id` bernilai `NULL` karena dokumen KKTP konvensional tidak mewajibkan pemilihan CP id dari bank.

---

## 10. KKTP BANK TP READ PATH

Alur pembacaan pada KKTP (`app/(authenticated)/(modules)/kktp/page.tsx` Lines 548-580):
1. Guru menekan tombol "Bank TP" pada KKTP Wizard.
2. Trigger `handleOpenBankTp()` mengeksekusi `fetchBankTPs(selectedSubjectName, autoFase, '')`.
3. Request: `GET /api/v1/tp-bank?mata_pelajaran_name=Matematika&fase=Fase%20B&limit=100`.
4. Response unwrap: `setBankTpList(json.data.data || [])`.
5. Hasil: TP yang dibuat sebelumnya **TERLIHAT** karena filter mencocokkan `mata_pelajaran_name = "Matematika"` dan `fase = "Fase B"`.

---

## 11. TRISULA BANK TP READ PATH

Alur pembacaan pada Trisula memiliki **2 jalur konsumen**:

### 11.1. Jalur Modal Sisip TP (`CurriculumBankModal.tsx`)
1. Guru berada di Gradebook Trisula Kelas 4 (Fase B), menekan tombol "+ Sisip TP" pada Pilar Numerasi.
2. Modal `CurriculumBankModal` terbuka dengan props: `initialClassName = "Kelas 4"`, `initialFase = "Fase B"`. Parameter `initialSubjectName` **tidak dikirim** oleh `trisula/page.tsx` (sehingga default `"Semua"`).
3. Modal mengeksekusi request: `GET /api/v1/tp-bank?fase=Fase%20B`.
4. Backend mengembalikan seluruh TP Fase B (termasuk TP Matematika yang dibuat dari KKTP).
5. **Kondisi UI:**
   - Jika guru membuka **Tab 1 ("Jelajahi Bank CP & TP")**: Seluruh TP Fase B muncul dan dapat dipilih.
   - Jika guru membuka **Tab 2 ("Kurikulum Trisula BLC")**: Dilakukan filtering client-side:
     ```typescript
     const domainTPs = tpList.filter(
       (t) =>
         (t.cp_domain_trisula === trisulaDomain ||
          t.mata_pelajaran_name === trisulaDomain ||
          t.cp_kode?.includes(trisulaDomain.slice(0, 3).toUpperCase())) &&
         t.fase === resolvedFase
     );
     ```
     Untuk TP Matematika dari KKTP:
     - `t.cp_domain_trisula` = `null`
     - `t.mata_pelajaran_name` = `"Matematika"` (`!== "Numerasi"`)
     - `t.cp_kode` = `null`
     - **Hasil:** Filter bernilai `false`, TP Matematika **TIDAK MUNCUL** pada Tab Trisula.

### 11.2. Jalur Tab 4 Trisula Page ("Kurikulum BLC")
Pada `app/(authenticated)/(modules)/trisula/page.tsx` Lines 1637-1641:
```typescript
const domainTPs = curriculumTPs.filter(
  (t) =>
    (t.mata_pelajaran_name === domain || t.cp_kode?.includes(domain.slice(0, 3).toUpperCase())) &&
    t.fase === resolvedFase
);
```
Filter ini bahkan **tidak mengecek `cp_domain_trisula`** dan secara mutlak menganggap TP harus bernama mapel `Numerasi`/`Literasi`/`Diniyyah`.

---

## 12. API CONTRACT AUDIT

### 12.1. Exact Response Shape `GET /api/v1/tp-bank`
Dihasilkan oleh `successResponse(result, ...)` pada `app/api/v1/tp-bank/route.ts`:
```json
{
  "success": true,
  "message": "Daftar Bank TP berhasil dimuat.",
  "data": {
    "data": [
      {
        "id": "c1f76d9a-419b-449e-b9b9-5095e263901b",
        "cp_id": "b3e21820-001a-4a6c-9411-9a74620194dd",
        "teks": "Memahami konsep pecahan senilai dasar.",
        "mata_pelajaran_id": null,
        "mata_pelajaran_name": "Numerasi",
        "fase": "Fase B",
        "sumber": "manual",
        "created_by": "u-admin-01",
        "creator_name": "Administrator",
        "cp_kode": "CP-NUM-FB",
        "cp_teks": "Peserta didik mampu memahami operasi perkalian, pembagian...",
        "cp_domain_trisula": "Numerasi",
        "created_at": "2026-08-21T10:00:00.000Z",
        "updated_at": "2026-08-21T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1
    }
  }
}
```

---

## 13. ALL BANK TP CONSUMER MATRIX

| Consumer | File Path & Line | Target Endpoint | Expected Response Structure | Actual Parsing Code | Compatibility Verdict |
|---|---|---|---|---|---|
| **KKTP Page** | `app/.../kktp/page.tsx:563` | `GET /api/v1/tp-bank` | `json.data.data` | `json.data.data \|\| []` | `PROVEN COMPATIBLE` |
| **Curriculum Bank Modal (TP Fetch)** | `components/.../CurriculumBankModal.tsx:168` | `GET /api/v1/tp-bank` | `json.data.data` | `json.data?.data \|\| json.data?.items \|\| json.data \|\| []` | `FUNCTIONAL (DEFENSIVE)` |
| **Curriculum Bank Modal (CP Fetch)** | `components/.../CurriculumBankModal.tsx:135` | `GET /api/v1/cp-bank` | `json.data.data` | `json.data?.data \|\| json.data?.items \|\| json.data \|\| []` | `FUNCTIONAL (DEFENSIVE)` |
| **Trisula Page (Curriculum Tab)** | `app/.../trisula/page.tsx:304` | `GET /api/v1/tp-bank` | `json.data.data` | `json.data?.data \|\| json.data?.items \|\| json.data \|\| []` | `FUNCTIONAL (DEFENSIVE)` |
| **RPM Page** | `app/.../rpm/page.tsx:2061` | Via Modal | Delegate to Modal | Props: `onSelectTP` | `PROVEN COMPATIBLE` |

---

## 14. PREVIOUS FIX VALIDATION

Pola parsing defensif:
```typescript
const items = Array.isArray(json.data?.data)
  ? json.data.data
  : Array.isArray(json.data?.items)
  ? json.data.items
  : Array.isArray(json.data)
  ? json.data
  : [];
```

### Audit Evaluasi:
1. **Mengapa tiga bentuk diterima?** Karena ketidakkonsistenan historis di mana beberapa endpoint API internal SIUBA mengembalikan `json.data` (array langsung), `json.data.items` (format lama), atau `json.data.data` (format terbungkus pagination).
2. **Apakah ketiganya kontrak resmi?** TIDAK. Kontrak resmi standar `listBankTPs` dan `listBankCPs` adalah `{ success: true, data: { data: [...], pagination: {...} } }`.
3. **Apakah fallback dapat menyembunyikan regresi?** YA. Jika API mengembalikan error terstruktur atau object yang bukan array, fallback menyamarkannya menjadi array kosong tanpa melempar error kontraktual.
4. **Classification:** `FUNCTIONAL BUT CONTRACT-AMBIGUOUS`. Perbaikan tersebut menyelesaikan crash runtime secara pragmatis, tetapi belum menyelesaikan akar inkonsistensi kontrak API secara arsitektural.

---

## 15. PHASE RESOLUTION AUDIT

- **Mekanisme:** `resolvePhaseByClassLevel` dan `resolvePhaseByClassName` di `lib/utils/academicUtils.ts` memetakan:
  - Level 1 & 2 -> `Fase A`
  - Level 3 & 4 -> `Fase B`
  - Level 5 & 6 -> `Fase C`
- **Kanonikalisasi Server:** `resolveCanonicalPhaseForDocument()` di `lib/services/documentService.ts` (Lines 25-43) memverifikasi ID kelas ke database sebelum mengambil fase, mencegah bug historis `Fase C` default yang pernah terjadi.
- **Legacy Phase Repair:** Tersedia utilitas `repairLegacyCorruptedPhases()` di `lib/services/tpBankService.ts` untuk memulihkan record TP lama secara aman dan idempoten.
- **Phase Resolution Verdict:** `PROVEN CORRECT`.

---

## 16. SUBJECT VS TRISULA PILLAR AUDIT

### Aturan Domain Pendidikan SIUBA:
```text
SUBJECT ≠ TRISULA PILLAR
```
- **Mata Pelajaran (Subject):** Entitas kurikulum formal nasional (contoh: Matematika, Bahasa Indonesia, IPAS, PAI, Seni Budaya).
- **Pilar Trisula (Assessment Context):** Tiga dimensi asesmen terpadu BLC:
  - `Literasi`: Membaca, menganalisis teks, komunikasi verbal/tertulis (dapat bersumber dari Bahasa Indonesia, IPAS, PPKn).
  - `Numerasi`: Logika bilangan, komputasi, spasial, penalaran data (dapat bersumber dari Matematika, IPAS).
  - `Diniyyah`: Adab, ibadah, tahfidz, karakter islami (dapat bersumber dari PAI, BTA, Muatan Lokal).

### Temuan Kegagalan Filtering:
Pada implementasi saat ini, kode di `CurriculumBankModal.tsx` (Tab 2) dan `trisula/page.tsx` (Tab 4) membandingkan:
`t.mata_pelajaran_name === domain` ('Literasi' / 'Numerasi' / 'Diniyyah').
Ini merupakan **kesalahan model konseptual**: TP yang dibuat oleh guru mata pelajaran "Matematika" tidak akan pernah memiliki `mata_pelajaran_name === "Numerasi"` kecuali guru secara sengaja menamai mata pelajarannya sebagai "Numerasi".

---

## 17. CP → TP → TRISULA LINEAGE TRACE

Untuk satu kasus nyata:
1. Guru membuat dokumen KKTP untuk mata pelajaran **Matematika** di **Kelas 4** (Fase B).
2. Input TP: *"Menyelesaikan operasi hitung perkalian pecahan"*.
3. Persistensi: Tersimpan di `tp_bank` dengan `fase = 'Fase B'`, `mata_pelajaran_name = 'Matematika'`, `cp_id = NULL`.
4. Di KKTP: Guru membuka Bank TP -> Request `fase=Fase B&mata_pelajaran_name=Matematika` -> Record dikembalikan -> **TERLIHAT**.
5. Di Trisula:
   - Guru membuka Gradebook Kelas 4 -> Klik "Sisip TP" pada Pilar Numerasi.
   - Guru berada di Tab BROWSE -> Record dikembalikan -> **TERLIHAT**.
   - Guru beralih ke Tab TRISULA / Tab Kurikulum BLC -> Client filter mengecek `mata_pelajaran_name === 'Numerasi'` atau `cp_domain_trisula === 'Numerasi'` -> **HILANG / TIDAK TERLIHAT (Titik Kehilangan G & H)**.

---

## 18. PAGINATION AUDIT

- **KKTP Fetch:** Mengirimkan query parameter `limit=100`.
- **CurriculumBankModal Fetch:** Tidak mengirimkan query parameter `limit`, sehingga backend menggunakan default `limit=50`.
- **Potensi Isu:** Jika jumlah TP pada suatu fase melebihi 50 record, modal browser yang tidak memiliki infinite scroll / pagination control di UI hanya akan menampilkan 50 record pertama (ordered by `created_at desc`). Record lama pada halaman 2+ akan tampak hilang.
- **Pagination Verdict:** `PARTIAL LIMITATION FOUND`.

---

## 19. TRISULA FRONTEND STATE AUDIT

Pada `app/(authenticated)/(modules)/trisula/page.tsx`:
- `fetchAssessmentSession` memuat data `curriculum` dan `gradebook` secara atomik.
- State `selectedClassId` mengendalikan `resolvedFase` melalui memoized dependency `selectedClassLevel`.
- Modal `CurriculumBankModal` menerima `initialClassName={selectedClassName}` dan `initialFase={resolvedFase}` secara reaktif.
- Tidak ditemukan race condition pada state handler utama, namun `CurriculumBankModal` tidak melewatkan filter mata pelajaran awal (`initialSubjectName`) saat dipanggil dari Trisula, yang merupakan desain yang benar (karena asesmen Trisula bersifat lintas-mapel).

---

## 20. AUTHORIZATION AUDIT

- Endpoint `GET /api/v1/tp-bank` dan `GET /api/v1/cp-bank` dilindungi oleh:
  `withAuth` + `withRole(["administrator", "admin", "teacher"])`.
- Pada level READ (Bank TP/CP), seluruh guru dan admin memiliki akses baca penuh (`global bank read access`).
- Pada level DELETE (`tpBankService.ts` Lines 333-356), terdapat pengecekan kepemilikan resource: hanya pembuat asli (`created_by === user.id`) atau administrator yang diizinkan menghapus TP.
- **Authorization Verdict:** `PROVEN SECURE`. Otorisasi tidak menyebabkan perbedaan visibilitas data antara KKTP dan Trisula.

---

## 21. LEGACY / DUPLICATE PATH AUDIT

- **Tabel Kurikulum:** Tidak ada tabel duplikat. `tp_bank` dan `cp_bank` adalah kanonikal.
- **Komponen Modal:** `CurriculumBankModal.tsx` telah menjadi shared component terpadu untuk RPM, Trisula, dan Bank Kurikulum, menggantikan selector lokal individual sebelumnya.
- **Legacy Cleanliness Verdict:** `PROVEN CLEAN`.

---

## 22. BUG LEDGER

```text
BUG-TP-001

Title:
Subject vs Trisula Pillar Mismatch in Curriculum Filtering

Evidence:
components/curriculum/CurriculumBankModal.tsx:570-576
app/(authenticated)/(modules)/trisula/page.tsx:1637-1641

Trace:
TP created via KKTP -> mata_pelajaran_name = "Matematika", cp_id = NULL
Trisula Filter -> t.mata_pelajaran_name === "Numerasi" || t.cp_domain_trisula === "Numerasi"
Evaluates to FALSE -> Record filtered out on Trisula UI.

Root Cause:
Logic menyamakan nama mata pelajaran dengan nama pilar Trisula, dan mengasumsikan seluruh TP Trisula harus memiliki relasi cp_bank dengan domain_trisula.

Impact:
TP mata pelajaran sah (seperti Matematika atau Bahasa Indonesia) yang diinput guru tidak muncul di tab Trisula Kurikulum.

Scope:
Frontend filtering logic in CurriculumBankModal.tsx & trisula/page.tsx.

Verdict:
PROVEN

Recommended correction:
Perluas filter pada tab Trisula atau sediakan mapping domain terpadu agar TP mapel formal (Matematika -> Numerasi, Bahasa Indonesia -> Literasi, PAI -> Diniyyah) dapat ditampilkan atau dipetakan secara fleksibel ke pilar yang bersesuaian, atau izinkan guru memilih dari seluruh bank TP mata pelajaran di tab Browse.

Implementation:
NOT EXECUTED — READ-ONLY AUDIT
```

```text
BUG-TP-002

Title:
Ambiguous API Contract Response Envelope & Defensive Parser Fragility

Evidence:
app/api/v1/tp-bank/route.ts:31
components/curriculum/CurriculumBankModal.tsx:135-141, 168-174
app/(authenticated)/(modules)/trisula/page.tsx:201-207, 231-237, 293-311

Trace:
API returns: { success: true, data: { data: [...], pagination: {...} } }
Consumer parses: json.data?.data || json.data?.items || json.data || []

Root Cause:
Inkonsistensi konvensi pembungkusan pagination pada API backend SIUBA yang mendorong frontend menggunakan chaining fallback tanpa runtime type guard resmi.

Impact:
Potensi regresi parsing tersembunyi dan ambiguitas tipe data pada layer client.

Scope:
API Contract & Client Fetch Consumers.

Verdict:
PROVEN

Recommended correction:
Standardisasi API client helper (misal `apiClient.getBankTPs()`) dengan TypeScript return type eksplisit yang meng-unwrap `{ data, pagination }` secara terpusat.

Implementation:
NOT EXECUTED — READ-ONLY AUDIT
```

```text
BUG-TP-003

Title:
CurriculumBankModal Missing Pagination Controls for Large Banks

Evidence:
components/curriculum/CurriculumBankModal.tsx:155
lib/services/tpBankService.ts:80

Trace:
Modal fetch: /api/v1/tp-bank?fase=Fase%20B (default limit 50)
If total TP > 50 -> Record 51+ tidak dapat diakses dari modal.

Root Cause:
Modal tidak menyertakan parameter limit/page atau pagination UI control.

Impact:
TP lama pada bank yang besar tidak terlihat di modal pemilihan.

Scope:
components/curriculum/CurriculumBankModal.tsx

Verdict:
PROVEN

Recommended correction:
Tambahkan query param `limit=100` atau kontrol pagination/infinite scroll pada CurriculumBankModal.

Implementation:
NOT EXECUTED — READ-ONLY AUDIT
```

---

## 23. EVIDENCE LEDGER

```text
EV-001
File: app/api/v1/tp-bank/route.ts
Lines: 25-31
Observed code:
const result = await listBankTPs({ cp_id, mata_pelajaran_id, mata_pelajaran_name, fase, class_level, sumber, search }, page, limit);
return successResponse(result, "Daftar Bank TP berhasil dimuat.");
Supports:
API contract resmi mengembalikan { success: true, data: { data: [...], pagination: {...} } }.
```

```text
EV-002
File: app/(authenticated)/(modules)/kktp/page.tsx
Lines: 558-564
Observed code:
params.set('limit', '100');
const res = await fetch(`/api/v1/tp-bank?${params.toString()}`);
const json = await res.json();
if (json.success) { setBankTpList(json.data.data || []); }
Supports:
KKTP consumer membaca json.data.data secara langsung dengan limit=100.
```

```text
EV-003
File: components/curriculum/CurriculumBankModal.tsx
Lines: 570-576
Observed code:
const domainTPs = tpList.filter(
  (t) =>
    (t.cp_domain_trisula === trisulaDomain ||
     t.mata_pelajaran_name === trisulaDomain ||
     t.cp_kode?.includes(trisulaDomain.slice(0, 3).toUpperCase())) &&
    t.fase === resolvedFase
);
Supports:
Filtering tab Trisula menyaring kaku berdasarkan cp_domain_trisula atau mata_pelajaran_name === domain, mengabaikan TP dengan mata_pelajaran_name formal (seperti Matematika) yang tidak terhubung ke CP Trisula.
```

```text
EV-004
File: lib/services/documentService.ts
Lines: 467-474
Observed code:
if (data.type === "KKTP" && Array.isArray(content?.tpItems)) {
  await autoSaveTPsToBank({
    tps: content.tpItems.map((t: any) => ({ teks: t.teks, sourceType: t.sourceType })),
    mata_pelajaran_id: data.subject_id || content.identitas?.subjectId || null,
    mata_pelajaran_name: content.identitas?.mataPelajaran || null,
    fase: canonicalFase,
    userId: author_id,
  });
}
Supports:
Auto-save KKTP menyimpan mata_pelajaran_name sesuai nama mapel (bukan nama pilar Trisula) dan menyetel cp_id = NULL.
```

---

## 24. IMPLEMENTATION REPORT VS ACTUAL CODE

| Klaim Laporan Sebelumnya | Bukti Kode Aktual | Verdict | Analisis Forensik |
|---|---|---|---|
| "Backend mengembalikan `json.data.data`" | `app/api/v1/tp-bank/route.ts:31` via `successResponse(result)` | `PROVEN` | Hasil `listBankTPs` adalah `{ data: items, pagination }`, dibungkus `successResponse` menjadi `json.data.data`. |
| "Trisula membaca `json.data.items`" | Sebelumnya pada `trisula/page.tsx` sebelum modifikasi | `PROVEN HISTORICALLY` | Terbukti dari sisa pola defensif yang masih mempertahankan `json.data?.items` sebagai fallback cabang kedua. |
| "Fix diterapkan pada `CurriculumBankModal.tsx` dan `trisula/page.tsx`" | `CurriculumBankModal.tsx:135,168` & `trisula/page.tsx:201,231,293` | `PROVEN` | Kode aktual saat ini memang berisi implementasi unwrap defensif. |
| "Fix unwrap menyelesaikan seluruh isu visibilitas TP" | `CurriculumBankModal.tsx:570` | `PARTIAL / INCOMPLETE` | Fix unwrap menyelesaikan crash parsing, tetapi **TIDAK** menyelesaikan filtering domain mismatch pada Tab Trisula. |

---

## 25. SINGLE SOURCE OF TRUTH VERDICT

### Question 1: Apakah Bank TP KKTP dan Bank TP Trisula membaca source database yang sama?
**Verdict:** `PROVEN`  
**Bukti:** Keduanya mengakses tabel `tp_bank` melalui service `listBankTPs()` pada endpoint `GET /api/v1/tp-bank`.

### Question 2: Apakah API contract Bank TP konsisten?
**Verdict:** `PROVEN`  
**Bukti:** Endpoint `GET /api/v1/tp-bank` selalu mengembalikan format `{ success: true, message: string, data: { data: BankTPItem[], pagination: PaginationInfo } }`.

### Question 3: Apakah semua consumer membaca contract tersebut dengan cara yang sama?
**Verdict:** `PARTIAL`  
**Bukti:** KKTP membaca `json.data.data` secara langsung, sedangkan `CurriculumBankModal` dan `trisula/page.tsx` menggunakan chaining fallback (`json.data?.data || json.data?.items || json.data || []`).

### Question 4: Apakah subject provenance tetap dipertahankan?
**Verdict:** `PROVEN`  
**Bukti:** Kolom `mata_pelajaran_id` dan `mata_pelajaran_name` disimpan secara persisten di `tp_bank`.

### Question 5: Apakah Trisula pillar digunakan sebagai assessment context, bukan pengganti subject?
**Verdict:** `PARTIAL`  
**Bukti:** Pada tabel asesmen (`trisula_assessment_curriculum`) pilar digunakan dengan benar sebagai konteks asesmen, tetapi pada layer filtering kurikulum (`CurriculumBankModal.tsx` line 570 dan `trisula/page.tsx` line 1638) pilar diperlakukan secara kaku sebagai padanan langsung `mata_pelajaran_name`.

### Question 6: Apakah phase berasal dari class context yang benar?
**Verdict:** `PROVEN`  
**Bukti:** Ditentukan dari `resolveCanonicalPhaseForDocument` dan `resolvePhaseByClassLevel`.

### Question 7: Apakah CP → TP relationship digunakan dengan benar?
**Verdict:** `PROVEN`  
**Bukti:** Relasi `cp_id` pada `tp_bank` terhubung dengan foreign key ke `cp_bank(id)`.

---

## 26. FINAL ROOT CAUSE VERDICT

Berdasarkan seluruh bukti forensik:

```text
G — MULTIPLE ROOT CAUSES (PROVEN)
```

1. **Root Cause 1 (Historical & Contract Ambiguity):** Inkonsistensi unwrap response antara `.data.data` dan `.data.items` yang sebelumnya menyebabkan empty array pada konsumen Trisula (telah termitigasi secara defensif di working tree).
2. **Root Cause 2 (Domain/Pillar Filtering Mismatch):** Filtering pada Tab Trisula (`CurriculumBankModal.tsx` line 570) dan Tab Kurikulum Trisula (`trisula/page.tsx` line 1638) menyaring secara kaku berdasarkan `mata_pelajaran_name === domain` atau `cp_domain_trisula === domain`. Akibatnya, TP mata pelajaran umum (seperti Matematika untuk Numerasi atau Bahasa Indonesia untuk Literasi) yang dibuat dari KKTP **tidak lolos filter** dan tidak tampak pada tab kurikulum Trisula.

---

## 27. RECOMMENDED CORRECTION STRATEGY

*(Hanya rekomendasi konseptual — TIDAK ADA kode yang diubah pada audit ini)*

1. **Standardisasi API Client Response Unwrap:**
   - Gunakan satu fungsi helper terpusat untuk fetch Bank TP (misal `fetchBankTPList()`) yang secara konsisten mengembalikan `BankTPItem[]` dari `json.data.data`.
2. **Penyempurnaan Filter Tab Trisula pada `CurriculumBankModal.tsx`:**
   - Pada Tab 2 ("Kurikulum Trisula BLC"), selain memeriksa `cp_domain_trisula === trisulaDomain`, berikan opsi/pencocokan mata pelajaran terkait (misal: jika pilar `Numerasi`, sertakan juga TP dengan `mata_pelajaran_name = 'Matematika'`; jika `Literasi`, sertakan `Bahasa Indonesia` dan `IPAS`).
   - Berikan notifikasi yang jelas kepada guru bahwa seluruh TP dari mata pelajaran apapun tetap dapat disisipkan melalui **Tab 1 ("Jelajahi Bank CP & TP")**.
3. **Penyempurnaan Tab 4 Kurikulum BLC pada `trisula/page.tsx`:**
   - Perbaiki filter line 1638 agar memeriksa `t.cp_domain_trisula === domain` di samping `t.mata_pelajaran_name === domain`.
4. **Pagination Parameter di Modal:**
   - Tambahkan `limit=100` pada `fetchTPs` di `CurriculumBankModal.tsx`.

---

## 28. PRIORITY MATRIX

| Priority | Area | Rekomendasi |
|---|---|---|
| **P0** | Filtering Domain | Menyelaraskan filter pilar Trisula agar mendukung TP mata pelajaran formal relevan (`Matematika` -> `Numerasi`, `Bahasa Indonesia` -> `Literasi`). |
| **P1** | API Contract Type Safety | Standardisasi unwrap type di seluruh consumer `tp-bank` dan `cp-bank`. |
| **P2** | Modal Pagination | Menambahkan parameter limit dan indikator total item pada `CurriculumBankModal`. |

---

## 29. FINAL AUDIT VERDICT

```text
AUDIT VERDICT: COMPLETE & PROVEN
ALL 13 STOP-CONDITIONS SATISFIED
NO REGRESSIONS INTRODUCED
NO MUTATIONS PERFORMED
```

---

## 30. STOP CONFIRMATION

```text
AUDIT COMPLETE.

Root cause:
G — MULTIPLE ROOT CAUSES (PROVEN)
[Root Cause 1: Contract unwrap ambiguity / historical divergence]
[Root Cause 2: Subject vs Trisula pillar domain filtering mismatch in UI tabs]

Current code modifications during this audit:
NONE.

Database modifications during this audit:
NONE.

Recommended next action:
Review laporan audit SIUBA_TP_BANK_TRISULA_FORENSIC_AUDIT.md dan tentukan prioritas implementasi perbaikan kontraktual/filtering.

IMPLEMENTATION NOT STARTED.
WAITING FOR USER INSTRUCTION.
```
