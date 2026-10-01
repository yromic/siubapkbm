# SIUBA Production Database Bootstrap

File ini (`siuba_production_bootstrap.sql`) adalah **canonical database bootstrap script** untuk SIUBA pada lingkungan produksi (MariaDB 10.11 LTS).

Script ini dirancang untuk **provisioning database baru langsung ke kondisi schema final**, sehingga deployment awal ke server production **tidak perlu menjalankan seluruh 35 historical Knex migrations satu per satu**.

---

## 1. Spesifikasi Target

- **Database Engine:** MariaDB `10.11.x` (kompatibel penuh dengan `10.11.19-MariaDB-cll-lve` CloudLinux / cPanel)
- **Storage Engine:** `InnoDB`
- **Default Charset:** `utf8mb4`
- **Default Collation:** `utf8mb4_unicode_ci`
- **Schema State:** Merepresentasikan schema final setelah seluruh 35 migration hingga `20260925150000_create_kktp_assessment_tables.ts`
- **Total Tabel:** 58 tabel aplikasi aktif + 2 tabel metadata Knex (`knex_migrations`, `knex_migrations_lock`) = 60 tabel total.

---

## 2. Invarian & Kompatibilitas Kunci

1. **Foreign Key Precision (Pencegahan Errno 150):**
   - Seluruh primary key UUID dan seluruh kolom foreign key yang mereferensikannya diseragamkan bertipe `CHAR(36)` dengan collation `utf8mb4_unicode_ci`.
   - Menghilangkan ketidaksesuaian tipe (seperti `VARCHAR(36)` ke `CHAR(36)`) yang memicu error `errno: 150 Foreign key constraint is incorrectly formed` di MariaDB.

2. **Single Active Enrollment Invariant:**
   - Kolom virtual pada `student_enrollments`:
     ```sql
     active_enrollment_check VARCHAR(150) GENERATED ALWAYS AS (
       IF(status = 'active', CONCAT(RTRIM(student_id), '_', RTRIM(academic_year_id), '_', RTRIM(semester_id)), NULL)
     ) VIRTUAL
     ```
   - Diindeks unik dengan `UNIQUE KEY uq_active_enrollment (active_enrollment_check)`.
   - Menggunakan `RTRIM()` eksplisit untuk mematuhi determinisme engine MariaDB 10.5+ dan menghilangkan dependensi terhadap mode `PAD_CHAR_TO_FULL_LENGTH` (Error 1901).
   - Memanfaatkan semantik `NULL` pada indeks unik InnoDB sehingga riwayat pendaftaran non-aktif (*historical enrollments*) dapat tersimpan tanpa batas untuk siswa dan semester yang sama.

3. **Pembersihan Tabel Legacy:**
   - Tabel transisional migrasi lama (`legacy_culture_scores`, `legacy_character_*_summaries`) **tidak dimasukkan** ke dalam schema bootstrap. Tabel aktif yang digunakan adalah `culture_scores` (dengan score check 0–4) dan `character_utsman_semester_summary`.

4. **Knex Baseline Strategy:**
   - Bootstrap menyertakan tabel `knex_migrations` yang telah terisi 35 baris registrasi migrasi historis pada `batch = 1`.
   - Hasilnya, perintah `npx knex migrate:list` akan melaporkan seluruh 35 migrasi telah selesai (*Already applied*), dan `npx knex migrate:latest` akan langsung berstatus *Already up to date*.
   - Saat ada migrasi baru di masa depan (migrasi ke-36 dst.), Knex akan mendeteksi hanya file baru tersebut dan menjalankannya sebagai `batch = 2`.

5. **Keamanan Kredensial:**
   - Bootstrap SQL **TIDAK** memuat data akun admin default berpassword plaintext. Akun administrator pertama dibuat menggunakan mekanisme resmi `npm run seed:admin` yang membaca kredensial dari environment variable server dan menghasilkan hash bcrypt aman.

---

## 3. Langkah Instalasi di Server Production

### Langkah 1: Persiapan Database
Pastikan database production (misal `bqafeomm_siuba`) sudah dibuat di cPanel / MariaDB.

### Langkah 2: Import Bootstrap SQL
Eksekusi import via terminal shell server atau fitur Import di phpMyAdmin:

```bash
mysql -u <DB_USER> -p <DB_NAME> < database/bootstrap/siuba_production_bootstrap.sql
```
*(Ganti `<DB_USER>` dan `<DB_NAME>` sesuai credential cPanel Anda).*

### Langkah 3: Konfigurasi Environment Variable
Pastikan file `.env` di production memiliki variabel wajib berikut:

```env
NODE_ENV=production
DB_HOST=127.0.0.1
DB_USER=<DB_USER>
DB_PASSWORD=<DB_PASSWORD>
DB_NAME=<DB_NAME>

# Kredensial Admin Awal (Wajib saat seed:admin pertama kali)
FIRST_ADMIN_EMAIL=admin@siuba.sch.id
FIRST_ADMIN_USERNAME=admin
FIRST_ADMIN_PASSWORD=<PasswordKuatDanAman!>
FIRST_ADMIN_NAME="Administrator SIUBA"
```

### Langkah 4: Buat Akun Administrator Pertama
Jalankan perintah seed admin resmi:

```bash
npm run seed:admin
```

### Langkah 5: Verifikasi Status Migrasi
Jalankan verifikasi untuk memastikan Knex mengenali seluruh schema:

```bash
npx knex migrate:list --knexfile knexfile.ts
```
*Output yang diharapkan:*
- `Already applied migrations: 35`
- `Pending migrations: None`

Jalankan juga:
```bash
npx knex migrate:latest --knexfile knexfile.ts
```
*Output yang diharapkan:*
- `Already up to date`

---

## 4. Prosedur Rollback / Reset

Jika diperlukan reset ulang database ke kondisi kosong:

```bash
mysql -u <DB_USER> -p -e "DROP DATABASE IF EXISTS <DB_NAME>; CREATE DATABASE <DB_NAME> DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
Lalu ulangi Langkah 2 di atas untuk mengimpor ulang bootstrap SQL secara bersih.
