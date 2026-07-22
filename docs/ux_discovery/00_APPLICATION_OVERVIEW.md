# SIUBA PKBM Application Overview & Architecture Discovery

## 1. Application Purpose
SIUBA PKBM (Sistem Informasi Penyelenggaraan Pusat Kegiatan Belajar Masyarakat) is an enterprise education management platform built on Next.js 16 (App Router). The system facilitates multi-role administration, student and teacher management, class subject assignments, academic and character grading, SPP financial tracking, CMS landing page management, audit logging, system diagnostics, and parent portal access.

---

## 2. Primary Observable User Groups
Based on code inspection of roles across navigation layouts, middleware, and database schemas:
1. **Administrator (`administrator`)**: Full system access across academic setup, users, master data, audit logs, system diagnostics, and CMS.
2. **Admin Staff (`admin`)**: Operational access to student records, promotion rules, SPP finance, rollover settings, import/export, and CMS.
3. **Teacher (`teacher`)**: Instructional access to personal class assignments (`/my-class`), academic score entry, daily character culture evaluation, and character recaps.
4. **Parent / Student (`parent`)**: Access to dedicated parent portal (`/parent/dashboard`), viewing student academic scores, character evaluations, and SPP payment status.

---

## 3. High-Level Architecture
- **Framework**: Next.js 16 (App Router) with Turbopack.
- **Routing Paradigm**: Grouped routes dividing public (`(public)`), staff module portal (`(authenticated)/(modules)`), public landing layout (`(authenticated)/(portal)`), and parent portal (`app/parent`).
- **State Management**: React Context (`AuthProvider`, `ParentAuthProvider`).
- **Database Layer**: Knex query builder connecting to MySQL (`siuba_dev`).
- **Authentication**: Cookie-based HTTP session tokens (`staff_session_token`, `parent_session_token`), optional TOTP MFA for administrators, and self-hosted ALTCHA proof-of-work bot defense.

---

## 4. Navigation Structure & Philosophy

### 4.1 Grouped Navigation Categories (Staff Portal)
- **Utama (Main)**: Dashboard, Kelas Saya, Nilai Akademik, Budaya Harian, Rekap Karakter.
- **Akademik & Kelas**: Siswa, Guru, Kelas, Mata Pelajaran, Mapel di Kelas, Kenaikan Kelas.
- **Portal & Website CMS**: Kelola Landing Page (`/settings/cms-landing`).
- **Administrasi & Keuangan**: Master Data, Pengguna, Keuangan (SPP), Salin Pengaturan (Rollover), Dokumen, Audit Log, Pemeriksaan Sistem.
- **Data & Integrasi**: Import, Export.

### 4.2 Parent Portal Structure
- Entry via `/parent/login`.
- Sub-pages: `/parent/dashboard`, `/parent/academic`, `/parent/character`, `/parent/spp`.

---

## 5. Observable Layout Hierarchy

```
app/
├── (public)/                 --> Public Landing Page & CMS View
├── login/                    --> Staff Authentication Route
├── parent/                   --> Parent Authentication & Portal Routes
│   ├── login/
│   ├── dashboard/
│   ├── academic/
│   ├── character/
│   └── spp/
└── (authenticated)/
    ├── (portal)/             --> Public-facing Portal Wrapper
    └── (modules)/            --> Main Enterprise Staff Dashboard Wrapper
        ├── dashboard/
        ├── my-class/
        ├── academic-scores/
        ├── daily-culture/
        ├── character-recap/
        ├── students/
        ├── teachers/
        ├── classes/
        ├── subjects/
        ├── master-data/
        ├── users/
        ├── finance/
        ├── settings/
        ├── audit-log/
        ├── health-check/
        ├── import/
        └── export/
```
