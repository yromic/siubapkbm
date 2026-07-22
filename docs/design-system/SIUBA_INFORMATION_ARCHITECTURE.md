# SIUBA Information Architecture & Navigation Blueprint

## 1. System Navigation Hierarchy

```mermaid
flowchart TD
    Root["/ (Public Landing Page)"] --> AuthCheck{"Authenticated?"}
    AuthCheck -- No --> Login["/login (Staff / Parent Login)"]
    AuthCheck -- Yes --> Portal["/portal (Role Dispatcher)"]

    Portal --> TeacherView["Teacher Portal (/daily-culture, /my-class, /academic-scores)"]
    Portal --> AdminView["Admin Dashboard (/dashboard, /students, /finance)"]
    Portal --> SuperAdminView["Administrator Control (/users, /teachers, /audit-log)"]

    subgraph MobileNav ["Mobile Bottom Navigation (md:hidden)"]
        Nav1["/dashboard"]
        Nav2["/my-class"]
        Nav3["/academic-scores"]
        Nav4["/daily-culture"]
    end

    subgraph DesktopSidebar ["Desktop Collapsible Sidebar (md:flex)"]
        Cat1["Utama (Dashboard, Kelas Saya, Nilai, Budaya, Rekap)"]
        Cat2["Akademik (Siswa, Guru, Kelas, Mapel, Kenaikan)"]
        Cat3["Website (Kelola Landing Page)"]
        Cat4["Administrasi & Keuangan (Master, Pengguna, SPP, Audit)"]
        Cat5["Data & Integrasi (Import, Export)"]
    end
```

---

## 2. Module Dependency Matrix

```mermaid
graph TD
    MasterData["/master-data (Academic Years, Semesters)"] --> Classes["/classes (Class Configurations)"]
    Teachers["/teachers (Teacher Profiles)"] --> Classes
    Classes --> Enrollments["/students (Student Enrollments)"]
    Classes --> Subjects["/classes/subjects (Class Subject Mapping)"]
    
    Subjects --> AcademicScores["/academic-scores (Academic Assessments)"]
    Enrollments --> DailyCulture["/daily-culture (Daily Culture Scores)"]
    Enrollments --> Finance["/finance (SPP Payment Records)"]

    AcademicScores --> Finalization["/settings/rollover & Semester Snapshots"]
    DailyCulture --> CharacterRecap["/character-recap (Character Summaries)"]
```

---

## 3. Task Flow Diagrams

### 3.1 Daily Culture Input Task Flow
```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Guru Wali Kelas
    participant App as /daily-culture Page
    participant API as REST API (/api/v1/culture-scores)

    Teacher->>App: Open /daily-culture (via Bottom Nav)
    App->>API: Fetch active class & student roster
    API-->>App: Return Roster & Existing Scores
    Teacher->>App: Tap Student Card Accordion
    Teacher->>App: Tap Emoji Score (1-4)
    App->>App: Mark Row Dirty & Enable Sticky Save Bar
    Teacher->>App: Tap "Simpan Skor"
    App->>API: POST /api/v1/culture-scores
    API-->>App: 200 OK Confirmation
    App-->>Teacher: Show Sonner Toast & Appreciation Modal (if 100%)
```

---

## 4. Comprehensive Module Routing Reference

### 4.1 Module: Dashboard (`/dashboard`)
- **Purpose:** Executive status overview, health metrics, shortcut links, and watchlist notifications.
- **Entry Points:** Login redirect, Topbar logo tap, Mobile bottom nav item 1.
- **Exit Points:** Direct links to `/students`, `/finance`, `/daily-culture`, `/health-check`.
- **Dependencies:** Requires active session via `AuthProvider`.

### 4.2 Module: Students (`/students`)
- **Purpose:** Student registration, profile management, status changes, and parent PIN resets.
- **Entry Points:** Sidebar "Akademik" $\rightarrow$ "Siswa", Dashboard metric click.
- **Exit Points:** `/students/new`, `/students/[id]`, `/export`.
- **Dependencies:** Requires `administrator` or `admin` role.

### 4.3 Module: Daily Culture (`/daily-culture`)
- **Purpose:** Daily mobile input of student character indicators (*Budaya Harian SAHABAT*).
- **Entry Points:** Mobile bottom nav item 4, Sidebar "Utama" $\rightarrow$ "Budaya Harian".
- **Exit Points:** Return to `/dashboard` or `/character-recap`.
- **Dependencies:** Requires active `teacher` role and assigned class.

### 4.4 Module: Finance SPP (`/finance`)
- **Purpose:** Tuition fee tracking, payment entry, arrears report, and bulk verification.
- **Entry Points:** Sidebar "Administrasi" $\rightarrow$ "Keuangan (SPP)".
- **Exit Points:** Return to `/dashboard`.
- **Dependencies:** Requires `administrator` or `admin` role.

---

## 5. Architectural Recommendations

1. **Category Accordion State Persistence:**
   - *Current Behavior:* Sidebar categories (`openCategories`) reset to default on page load.
   - *Recommendation:* Persist accordion toggle state in `localStorage` or URL query params to preserve user context during multi-page administrative work.

2. **Unified Search Entry Point:**
   - *Current Behavior:* Search is localized within individual list views (`/students`, `/users`).
   - *Recommendation:* Introduce a global `Cmd + K` modal search in the Topbar to quickly jump to students, teachers, or classes from any screen.
