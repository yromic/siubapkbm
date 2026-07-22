# Observable Persona Matrix

This matrix details all user personas discovered in the SIUBA PKBM codebase.

---

## 1. Persona 1: Administrator (`administrator`)

- **Role Identifier**: `administrator`
- **Primary Responsibilities**: System-wide administration, academic term setup, user account management, teacher subject mapping, period rollover, system diagnostics, and audit log inspection.
- **Accessible Modules**:
  - Dashboard (`/dashboard`)
  - Student Management (`/students`)
  - Teacher Management (`/teachers`)
  - Class Management (`/classes`)
  - Subject Management (`/subjects`)
  - Class-Subject Mapping (`/classes/subjects`)
  - Promotion Rules (`/settings/promotion`)
  - Master Data (`/master-data`)
  - User Management (`/users`)
  - Finance / SPP (`/finance`)
  - Rollover Settings (`/settings/rollover`)
  - Website CMS (`/settings/cms-landing`)
  - Audit Log (`/audit-log`)
  - Health Check (`/health-check`)
  - Import / Export (`/import`, `/export`)
- **Typical Workflows**:
  - Period Rollover & Academic Year Setup
  - System Diagnostics & Snapshot Backup
  - Audit Log Investigation
  - User Role & Status Administration
- **Navigation Entry Point**: `/login` $\rightarrow$ `/dashboard`
- **Observed Permissions**: Full unrestricted access across all categories (`utama`, `akademik`, `website`, `sistem`, `data`).
- **Restrictions**: Cannot access teacher-specific `/my-class` route unless explicitly assigned.
- **Verification Status**: Verified from source code (`MENU_ITEMS` roles array).

---

## 2. Persona 2: Admin Staff (`admin`)

- **Role Identifier**: `admin`
- **Primary Responsibilities**: Operational administration, student registration, SPP payment verification, promotion rule configuration, document management, and website CMS updates.
- **Accessible Modules**:
  - Dashboard (`/dashboard`)
  - Student Management (`/students`)
  - Kenaikan Kelas (`/settings/promotion`)
  - Finance / SPP (`/finance`)
  - Rollover Settings (`/settings/rollover`)
  - Website CMS (`/settings/cms-landing`)
  - Document Management (`/documents`)
  - Health Check (`/health-check`)
  - Import / Export (`/import`, `/export`)
- **Typical Workflows**:
  - Student Enrollment & Profile Edits
  - SPP Payment Verification & Arrears Tracking
  - Landing Page CMS Section Edits
  - CSV Data Import/Export
- **Navigation Entry Point**: `/login` $\rightarrow$ `/dashboard`
- **Observed Permissions**: Access to operational modules in `akademik`, `website`, `sistem`, and `data`.
- **Restrictions**: No access to Teacher Management (`/teachers`), User Management (`/users`), Master Data (`/master-data`), or Audit Logs (`/audit-log`).
- **Verification Status**: Verified from source code (`MENU_ITEMS` roles array).

---

## 3. Persona 3: Teacher (`teacher`)

- **Role Identifier**: `teacher`
- **Primary Responsibilities**: Managing assigned class roster, recording academic assessment scores, evaluating daily character culture habits, and tracking student watchlist items.
- **Accessible Modules**:
  - Dashboard (`/dashboard`)
  - Kelas Saya (`/my-class`)
  - Nilai Akademik (`/academic-scores`)
  - Budaya Harian (`/daily-culture`)
  - Rekap Karakter (`/character-recap`)
  - Import / Export (`/import`, `/export`)
- **Typical Workflows**:
  - Academic Grade Entry & Publishing
  - Daily Character Habit Evaluation
  - Class Roster Review
- **Navigation Entry Point**: `/login` $\rightarrow$ `/dashboard`
- **Observed Permissions**: Access to instructional modules in `utama` and `data`.
- **Restrictions**: No access to system administration, user management, financial tracking, or CMS settings.
- **Verification Status**: Verified from source code (`MENU_ITEMS` roles array).

---

## 4. Persona 4: Parent / Student (`parent`)

- **Role Identifier**: `parent` (Session token: `parent_session_token`)
- **Primary Responsibilities**: Monitoring student academic performance, reviewing character development assessments, and checking SPP payment statuses.
- **Accessible Modules**:
  - Parent Dashboard (`/parent/dashboard`)
  - Academic Scores View (`/parent/academic`)
  - Character Development View (`/parent/character`)
  - SPP Payment Status View (`/parent/spp`)
- **Typical Workflows**:
  - Parent Login (via NISN, Birth Date, PIN)
  - View Child Report Card & Character Radar
  - Check Monthly SPP Payment Status
- **Navigation Entry Point**: `/parent/login` $\rightarrow$ `/parent/dashboard`
- **Observed Permissions**: Read-only access restricted strictly to their authenticated child's data.
- **Restrictions**: Completely isolated from the main staff portal (`(authenticated)/(modules)`).
- **Verification Status**: Verified from source code (`withParentAuth.ts` and `/app/parent`).
