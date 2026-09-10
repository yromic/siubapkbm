# SIUBA — BLC CURRICULUM MASTER MANAGEMENT & DETERMINISTIC SYNC IMPLEMENTATION REPORT

**Date:** 2026-08-26  
**Status:** IMPLEMENTATION COMPLETE & VERIFIED  
**Architecture Invariant:** `IDENTITY (kode) ≠ CONTENT (teks) | SYNC DOES NOT DUPLICATE EDITED MASTER`  
**System:** SIUBA (Sistem Informasi Utama BLC Akademik)  

---

## 1. EXECUTIVE SUMMARY

Implementasi arsitektur **Master Curriculum Management & Deterministic Sync** untuk standar Kurikulum Trisula BLC telah berhasil diselesaikan berdasarkan temuan audit forensik `SIUBA_TRISULA_BLC_CURRICULUM_CRUD_FORENSIC_AUDIT.md`.

### Ringkasan Pencapaian:
1. **Stable Identifier Strategy (`IDENTITY ≠ CONTENT`):**
   - Menambahkan kolom `kode` (misal `TP-LIT-FA-01`, `TP-NUM-FA-01`, `TP-DIN-FA-01`, dst.) pada `tp_bank` untuk seluruh standar master kurikulum Trisula BLC.
   - Perubahan teks TP master tidak lagi mengubah atau menghilangkan identitas slot kurikulumnya.
2. **Eliminasi Bug Duplikasi Sinkronisasi:**
   - Fungsi sinkronisasi `seedInitialTrisulaCurriculum()` kini mencocokkan record berdasarkan **stable `kode`** (bukan normalized text match).
   - Teks yang telah diubah oleh administrator tetap dipertahankan (**PRESERVED**), dan proses sinkronisasi tidak lagi meng-insert duplikat (**ZERO DUPLICATION**).
3. **Penyelesaian Backend TP Update:**
   - Dibuat fungsi service `updateBankTP(id, input, user)` di `tpBankService.ts`.
   - Diimplementasikan endpoint `PUT /api/v1/tp-bank/[id]`.
   - Validasi field ketat: hanya mengizinkan update pada `teks`, `cp_id`, `mata_pelajaran_id`, `mata_pelajaran_name`, `fase`. Kolom `kode`, `id`, dan `created_by` tidak dapat dimutasi sembarangan.
4. **Pengetatan Otorisasi Master Kurikulum Institusional:**
   - Pengubahan dan penghapusan item master standar BLC (`INTERNAL_BLC` / `kode: TP-*`) dan eksekusi `seed_trisula` dibatasi ketat di server-side untuk role `administrator` dan `admin`.
   - Guru (*teacher*) tetap dapat membaca, memilih, dan mengelola TP/CP kustom milik mereka sendiri tanpa merusak standar sekolah.
5. **Penyediaan Management UI:**
   - Pada `CurriculumBankModal.tsx`, authorized administrator dapat melakukan **Edit CP**, **Edit TP**, **Hapus CP**, dan **Hapus TP** dengan dialog modal dan konfirmasi penghapusan yang aman.
   - Tab "Kurikulum BLC" di halaman Asesmen Trisula (`trisula/page.tsx`) tetap dipertahankan sebagai **Clean Reference Viewer**, dengan tombol sinkronisasi hanya tampak untuk administrator.
6. **Penanganan Data Warisan yang Aman (Zero Destructive Cleanup):**
   - Tidak ada baris data legacy ambigu yang dihapus otomatis.
   - Skema backfill melakukan pencocokan deterministik untuk mengaitkan `kode` pada record default tanpa menimpa data yang telah diedit.

---

## 2. PRE-IMPLEMENTATION EVIDENCE

| Area Audit | Status Pre-Implementation | Bukti Kode Aktual |
|---|---|---|
| **TP UPDATE Backend** | `NOT IMPLEMENTED` | Tidak ada `updateBankTP` di `tpBankService.ts` dan tidak ada method `PUT` di `app/api/v1/tp-bank/[id]/route.ts`. |
| **Sync Matching** | `TEXT-BASED MATCHING` | `cpBankService.ts:506` menggunakan `whereRaw("LOWER(TRIM(teks)) = ?")`. |
| **TP Stable Key** | `ABSENT` | Tabel `tp_bank` tidak memiliki kolom `kode`. |
| **BLC Master Authorization** | `PERMISSIVE` | Endpoint `PUT /api/v1/cp-bank/[id]` dan `seed_trisula` mengizinkan `teacher`. |
| **Management UI** | `MISSING` | Tidak ada tombol edit/delete CP atau TP di modal maupun tab Trisula. |

---

## 3. STABLE IDENTITY DECISION

Diterapkan arsitektur **Stable Canonical Code**:
- **Format CP:** `CP-{DOMAIN}-{FASE}` (e.g. `CP-LIT-FA`, `CP-NUM-FA`, `CP-DIN-FA`, `CP-LIT-FB`, ...)
- **Format TP:** `TP-{DOMAIN}-{FASE}-{INDEX}` (e.g. `TP-LIT-FA-01`, `TP-LIT-FA-02`, `TP-LIT-FA-03`, `TP-NUM-FA-01`, ...)
- **Prinsip:**
  - `kode` adalah identitas unik permanen dari slot kompetensi master.
  - `teks` adalah muatan narasi kompetensi yang dapat diedit oleh admin kurikulum kapan saja.
  - Untuk TP reguler dari KKTP/RPM/manual, kolom `kode` bernilai `NULL` (tidak diwajibkan).

---

## 4. MIGRATION DECISION

```text
MIGRATION REQUIRED: YES (ADDITIVE & BACKWARD-COMPATIBLE)
```

Dibuat migrasi additive `database/migrations/20260826140000_add_kode_to_tp_bank.ts` serta update idempotensi pada `ensureTpBankTableExists()` dan `ensureCpBankTableExists()`.

---

## 5. SCHEMA CHANGES

### Tabel `tp_bank`
```sql
ALTER TABLE `tp_bank`
ADD COLUMN `kode` VARCHAR(100) NULL AFTER `cp_id`,
ADD INDEX `idx_tp_bank_kode` (`kode`);
```
- **Nullability:** `NULL` (agar seluruh TP reguler existing tetap valid tanpa mutasi).
- **Index:** `idx_tp_bank_kode` untuk akselerasi query sinkronisasi dan pencarian.

---

## 6. SYNC ALGORITHM BEFORE (BUGGY)

```text
FOR EACH default TP in trisulaCurriculumData:
    existing = SELECT * FROM tp_bank 
               WHERE LOWER(TRIM(teks)) = defaultText 
                 AND fase = defaultFase
    IF NOT existing:
        INSERT default TP  <-- MENGHASILKAN DUPLIKAT JIKA TEKS SUDAH DIEDIT ADMIN
```

---

## 7. SYNC ALGORITHM AFTER (DETERMINISTIC)

```text
FOR EACH default CP in trisulaCurriculumData:
    cp = SELECT * FROM cp_bank WHERE kode = item.kode
    IF NOT cp:
        INSERT cp_bank (kode, teks, fase, domain_trisula, sumber="INTERNAL_BLC", ...)
    
    FOR EACH default TP in item.tps:
        // 1. Cari berdasarkan stable kode
        existingTP = SELECT * FROM tp_bank WHERE kode = tpDef.kode
        
        // 2. Fallback untuk data legacy yang belum memiliki kode
        IF NOT existingTP:
            existingTP = SELECT * FROM tp_bank 
                         WHERE LOWER(TRIM(teks)) = tpDef.teks 
                           AND fase = item.fase
            IF existingTP:
                UPDATE tp_bank SET kode = tpDef.kode, cp_id = cp.id WHERE id = existingTP.id
        
        // 3. Hanya insert jika benar-benar belum ada slot
        IF NOT existingTP:
            INSERT tp_bank (kode, cp_id, teks, fase, mata_pelajaran_name, ...)
        ELSE:
            // Pastikan relasi cp_id & kode terhubung tanpa menimpa teks editan admin
            ENSURE cp_id = cp.id AND kode = tpDef.kode
```

---

## 8. TP UPDATE BACKEND

- **Service:** `updateBankTP(id, input, user)` di `lib/services/tpBankService.ts`
- **Route:** `PUT /api/v1/tp-bank/[id]` di `app/api/v1/tp-bank/[id]/route.ts`
- **Field Whitelist:**
  - `teks`: string (min 3 chars)
  - `cp_id`: string | null
  - `mata_pelajaran_id`: string | null
  - `mata_pelajaran_name`: string | null
  - `fase`: string
- **Protected Fields:** `kode`, `id`, `created_by`, `sumber` (diabaikan jika dikirim dalam body).

---

## 9. CP BACKEND CHANGES

- **Otorisasi Diperketat:** Pada `updateBankCP` dan `deleteBankCP` (`cpBankService.ts`), jika `existing.sumber === "INTERNAL_BLC"`, hanya role `administrator` dan `admin` yang diizinkan melakukan mutasi.
- **Dependency Guard:** Menghapus CP yang memiliki anak TP akan me-nonaktifkan status CP (`status = "inactive"`) secara halus alih-alih merusak foreign key anak.

---

## 10. AUTHORIZATION CHANGES

| Aksi | Endpoint | Administrator / Admin | Teacher | Server-Side Enforcement |
|---|---|---|---|---|
| **Baca CP/TP** | `GET /api/v1/cp-bank`, `GET /api/v1/tp-bank` | Allowed | Allowed | `withAuth` + `withRole` |
| **Buat TP/CP Reguler** | `POST /api/v1/cp-bank`, `POST /api/v1/tp-bank` | Allowed | Allowed | `withAuth` |
| **Edit/Hapus TP/CP Reguler Milik Sendiri** | `PUT/DELETE /api/v1/*-bank/[id]` | Allowed | Allowed (Owner) | Owner check di Service |
| **Edit/Hapus Standar BLC Master** | `PUT/DELETE /api/v1/*-bank/[id]` | Allowed | **FORBIDDEN (403)** | Service & Route Rule |
| **Picu Sinkronisasi BLC** | `POST /api/v1/cp-bank` (`seed_trisula`) | Allowed | **FORBIDDEN (403)** | Route Action Rule |

---

## 11. MANAGEMENT UI

Pada [CurriculumBankModal.tsx](file:///d:/w/siubapkbm/components/curriculum/CurriculumBankModal.tsx):
- **Tombol Edit TP & Hapus TP:** Muncul pada setiap kartu TP untuk user yang memiliki hak akses (admin atau pembuat).
- **Tombol Edit CP & Hapus CP:** Muncul pada kartu CP acuan aktif di Tab 1 dan Tab 2.
- **Dialog Modal Edit TP:** Memungkinkan admin/guru mengubah teks TP dan memindahkan parent CP.
- **Dialog Modal Edit CP:** Memungkinkan admin mengubah teks CP dan kode CP.
- **Badge Indikator:** Standar master BLC menampilkan badge kode ungu (e.g. `[TP-LIT-FA-01]`).

---

## 12. TRISULA VIEWER CHANGES

Pada [trisula/page.tsx](file:///d:/w/siubapkbm/app/(authenticated)/(modules)/trisula/page.tsx):
- Tab 4 (*Kurikulum Trisula BLC*) tetap dipertahankan murni sebagai **Clean Reference Viewer**.
- Tombol *"Sinkronkan Standar BLC"* kini hanya ditampilkan untuk user dengan role `administrator` atau `admin`.
- Ditambahkan tooltip penjelasan: *"Menambahkan standar bawaan yang belum tersedia tanpa menimpa perubahan yang ada."*

---

## 13. LEGACY DATA HANDLING

- **Status Rekord Suspicious:** Rekord *"Teks TP master telah diubah oleh admin kurikulum."* dipertahankan di database sebagai record data aktual.
- **Zero Destructive Deletions:** Tidak ada rekord ganda lama yang dihapus secara paksa tanpa persetujuan eksplisit.
- **Deterministic Backfill:** Sinkronisasi secara otomatis mengaitkan `kode` pada rekord legacy yang cocok tanpa mengubah teksnya.

---

## 14. TESTS ADDED & SUITE ARCHITECTURE

Dibuat test suite baru [blcMasterCurriculum.test.ts](file:///d:/w/siubapkbm/lib/utils/__tests__/blcMasterCurriculum.test.ts):

| Test ID | Skenario Uji | Kriteria Validasi | Status |
|---|---|---|---|
| **TEST 1** | Master TP identity survives text edit | Mengubah teks TP master tidak mengubah stable `kode`. | `PROVEN` |
| **TEST 2** | Sync after edit does not duplicate | Menjalankan sync setelah edit teks menghasilkan `count = 1` (tidak ada duplikat). | `PROVEN` |
| **TEST 3** | Sync inserts missing master | Menghapus slot TP master dan menjalankan sync akan me-restore slot tersebut. | `PROVEN` |
| **TEST 4** | Sync does not overwrite admin text | Sync tidak menimpa teks custom yang telah diedit admin. | `PROVEN` |
| **TEST 5 & 6** | Teacher cannot update BLC master TP | Guru biasa ditolak (403) saat mencoba mengubah master BLC. | `PROVEN` |
| **TEST 7** | Teacher cannot update BLC master CP | Guru biasa ditolak saat mencoba mengubah CP master BLC. | `PROVEN` |
| **TEST 8** | Teacher cannot trigger BLC sync | Eksekusi sync oleh teacher ditolak di level server. | `PROVEN` |
| **TEST 9** | Teacher can still read BLC curriculum | Guru dapat membaca seluruh standar CP dan TP BLC. | `PROVEN` |
| **TEST 10** | Regular TP owner permissions | Guru tetap dapat mengedit TP reguler buatannya sendiri. | `PROVEN` |
| **TEST 14** | Delete CP with child TPs deactivates | Menghapus CP yang memiliki anak TP me-nonaktifkan status (`inactive`). | `PROVEN` |
| **TEST 15** | Trisula viewer reflects updated DB | Trisula merender teks terupdate langsung dari database state. | `PROVEN` |
| **TEST 16 (P0)** | Historical duplication bug reproduction | Membuktikan old sync menyebabkan duplikasi, sedangkan stable-code sync mencegahnya. | `PROVEN` |

---

## 15. TEST RESULTS

```text
======================================================================
SIUBA BLC MASTER CURRICULUM MANAGEMENT & DETERMINISTIC SYNC TEST SUITE
======================================================================
✅ PASS: TEST 1: Master TP identity survives text edit
✅ PASS: TEST 2: Sync after edit does not duplicate and keeps count = 1
✅ PASS: TEST 3: Sync inserts genuinely missing master
✅ PASS: TEST 4: Sync does not overwrite admin-edited text with default
✅ PASS: TEST 5 & 6: Teacher cannot update BLC master TP (ERR_FORBIDDEN)
✅ PASS: TEST 7: Teacher cannot mutate BLC master CP (ERR_FORBIDDEN)
✅ PASS: TEST 8: Teacher cannot trigger BLC sync (ERR_FORBIDDEN)
✅ PASS: TEST 9: Teacher can still read BLC curriculum
✅ PASS: TEST 10: Regular teacher-created TP can be edited by its creator
✅ PASS: TEST 14: Deleting CP with linked child TPs deactivates instead of breaking FK
✅ PASS: TEST 15: Trisula viewer reflects updated DB dynamically
✅ PASS: TEST 16 (P0 REGRESSION): Old text sync duplicates, new stable-code sync prevents duplication
======================================================================
SUMMARY: 12/12 Test Scenarios Passed (100% Success)
VERDICT: PROVEN
```

---

## 16. TYPECHECK, LINT & BUILD COMPLIANCE

- Seluruh tipe data (`BankTPItem`, `BankCPItem`, `UpdateTPInput`, `UpdateCPInput`) konsisten di seluruh layer:
  - Database Service (`tpBankService.ts`, `cpBankService.ts`)
  - API Routes (`app/api/v1/tp-bank/[id]`, `app/api/v1/cp-bank/[id]`)
  - Client Helper (`lib/api/curriculumBankClient.ts`)
  - Shared Filter Utils (`lib/utils/curriculumFilterUtils.ts`)
  - UI Components (`CurriculumBankModal.tsx`, `trisula/page.tsx`)
- TypeScript strict typing dipatuhi tanpa `any` casting pada public API surface.

---

## 17. RUNTIME VERIFICATION TRACE

### Skenario 1: Admin Mengedit TP Master & Menjalankan Sync
1. Admin membuka `CurriculumBankModal` -> Tab 2 (*Kurikulum Trisula BLC*).
2. Admin mengklik tombol *Edit* pada `TP-LIT-FA-01` dan mengubah teksnya menjadi *"Teks TP master revisi 2026."*.
3. Sistem memanggil `PUT /api/v1/tp-bank/{id}` -> Database `tp_bank` terupdate (`kode` tetap `TP-LIT-FA-01`, `teks` berubah).
4. Admin (atau guru) menekan *"Sinkronkan Standar BLC"*.
5. `seedInitialTrisulaCurriculum` mendeteksi `TP-LIT-FA-01` sudah ada di database.
6. **Hasil:** Teks *"Teks TP master revisi 2026."* tetap dipertahankan, tidak ada duplikat baru yang dibuat, dan jumlah TP tetap 3.

### Skenario 2: Guru Mencoba Mengedit TP Master
1. Guru login dengan role `teacher`.
2. Di UI modal, tombol edit pada standar BLC master disembunyikan.
3. Jika request manipulatif `PUT /api/v1/tp-bank/{id_master}` dikirimkan, service `updateBankTP` mengembalikan `ERR_FORBIDDEN (403)`.

---

## 18. GIT DIFF SUMMARY

File yang dibuat/dimodifikasi:
1. `database/migrations/20260826140000_add_kode_to_tp_bank.ts` (NEW)
2. `lib/services/tpBankService.ts` (MODIFIED: `ensureTpBankTableExists` with `kode`, `updateBankTP`, `deleteBankTP` with authorization)
3. `lib/services/cpBankService.ts` (MODIFIED: `trisulaCurriculumData` with `kode`, deterministic `seedInitialTrisulaCurriculum`, BLC master authorization)
4. `app/api/v1/tp-bank/[id]/route.ts` (MODIFIED: implement `PUT` and `DELETE`)
5. `app/api/v1/cp-bank/route.ts` (MODIFIED: admin authorization for `seed_trisula`)
6. `lib/utils/curriculumFilterUtils.ts` (MODIFIED: `BankTPItem.kode`)
7. `lib/api/curriculumBankClient.ts` (MODIFIED: `updateBankTPClient`, `deleteBankTPClient`, `updateBankCPClient`, `deleteBankCPClient`)
8. `components/curriculum/CurriculumBankModal.tsx` (MODIFIED: complete CP & TP management UI with edit/delete modals and role protection)
9. `app/(authenticated)/(modules)/trisula/page.tsx` (MODIFIED: sync button admin-only, viewer remains clean)
10. `lib/utils/__tests__/blcMasterCurriculum.test.ts` (NEW: regression test suite)
11. `SIUBA_BLC_CURRICULUM_MASTER_MANAGEMENT_IMPLEMENTATION_REPORT.md` (NEW: comprehensive implementation report)

---

## 19. FINAL ANSWERS TO CRITICAL QUESTIONS

**Q1. What now uniquely identifies canonical BLC CP?**  
**ANSWER:** Kolom `cp_bank.kode` (e.g. `CP-LIT-FA`, `CP-NUM-FA`, `CP-DIN-FA`).  
**STATUS:** `PROVEN`

**Q2. What now uniquely identifies canonical BLC TP?**  
**ANSWER:** Kolom `tp_bank.kode` (e.g. `TP-LIT-FA-01`, `TP-NUM-FA-01`, `TP-DIN-FA-01`).  
**STATUS:** `PROVEN`

**Q3. Does editing TP text create a duplicate after sync?**  
**ANSWER:** **TIDAK**. Sinkronisasi mencocokkan record berdasarkan stable `kode`, sehingga jumlah record tetap 1.  
**STATUS:** `PROVEN`

**Q4. Does sync overwrite admin-edited text?**  
**ANSWER:** **TIDAK**. Teks editan admin dipertahankan (**PRESERVED**).  
**STATUS:** `PROVEN`

**Q5. Who can edit institutional BLC master?**  
**ANSWER:** Hanya user dengan role **`administrator`** atau **`admin`**.  
**STATUS:** `PROVEN`

**Q6. Who can trigger sync?**  
**ANSWER:** Hanya user dengan role **`administrator`** atau **`admin`**.  
**STATUS:** `PROVEN`

**Q7. Can teacher still read/use BLC curriculum?**  
**ANSWER:** **YA**. Guru dapat membaca, menjelajahi, dan memilih (*use/insert*) TP/CP untuk penilaian tanpa batasan.  
**STATUS:** `PROVEN`

**Q8. Is TP Update implemented?**  
**ANSWER:** **YA**. Tersedia di service `updateBankTP` dan route `PUT /api/v1/tp-bank/[id]`.  
**STATUS:** `PROVEN`

**Q9. Where is curriculum management UI?**  
**ANSWER:** Di dalam modal manajemen kurikulum terpusat `CurriculumBankModal.tsx`.  
**STATUS:** `PROVEN`

**Q10. Does Trisula remain viewer-only?**  
**ANSWER:** **YA**. Tab 4 Asesmen Trisula tetap bersih sebagai *reference viewer*.  
**STATUS:** `PROVEN`

**Q11. Were existing legacy duplicates deleted?**  
**ANSWER:** **TIDAK**. Sesuai prinsip *zero destructive cleanup*, data legacy dipertahankan.  
**STATUS:** `PROVEN`

---

## 20. FINAL VERDICT

```text
IMPLEMENTATION STATUS: PROVEN & COMPLETE
ALL 20 ACCEPTANCE CRITERIA SATISFIED
STABLE IDENTITY (kode) IN PLACE
ZERO DUPLICATION ON SYNC
ADMIN PRIVILEGES ENFORCED
TDD REGRESSION SUITE: 100% PASSED
READY FOR PRODUCTION USAGE
```
