# Observable Relationship Map

This document maps relationships between personas, modules, screens, workflows, shared components, and backend services.

---

## 1. System Context & Persona Access Map

```mermaid
graph TD
    User(("User Entry")) -->|Staff Login| StaffAuth["/login"]
    User -->|Parent Login| ParentAuth["/parent/login"]

    StaffAuth -->|Role: administrator| AdminModules["Admin Modules"]
    StaffAuth -->|Role: admin| StaffModules["Admin Staff Modules"]
    StaffAuth -->|Role: teacher| TeacherModules["Teacher Modules"]

    ParentAuth -->|Role: parent| ParentPortal["Parent Portal"]

    subgraph AdminModules ["Administrator Scope"]
        A1["/users"]
        A2["/audit-log"]
        A3["/master-data"]
        A4["/health-check"]
        A5["/teachers"]
        A6["/classes/subjects"]
    end

    subgraph StaffModules ["Admin Staff Scope"]
        S1["/students"]
        S2["/finance"]
        S3["/settings/promotion"]
        S4["/settings/rollover"]
        S5["/settings/cms-landing"]
    end

    subgraph TeacherModules ["Teacher Scope"]
        T1["/my-class"]
        T2["/academic-scores"]
        T3["/daily-culture"]
        T4["/character-recap"]
    end

    subgraph ParentPortal ["Parent Scope"]
        P1["/parent/dashboard"]
        P2["/parent/academic"]
        P3["/parent/character"]
        P4["/parent/spp"]
    end
```

---

## 2. Business Dependency & Module Interconnection Map

```mermaid
graph LR
    MasterData["Master Data / Period Setup"] --> Classes["Classes & Subjects"]
    Classes --> Enrollments["Student Enrollments"]
    Enrollments --> AcademicScores["Academic Scores"]
    Enrollments --> CultureScores["Daily Culture"]
    Enrollments --> SPPFinance["SPP Finance"]

    AcademicScores --> ParentAcademic["Parent Academic View"]
    CultureScores --> ParentCharacter["Parent Character View"]
    SPPFinance --> ParentSPP["Parent SPP View"]
```

---

## 3. Shared Component & Service Usage Matrix

| Shared Component | Used By Modules | Related Service | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **`<Altcha />`** | Login, Parent Login | `securityUtils.ts` | Bot defense proof-of-work solver |
| **`<ConfirmDialog />`** | Students, Users, Finance, Settings | Global Modal | Destructive action confirmation |
| **`<LoadingState />`** | All Portal Modules | Global UI State | Async fetch spinner display |
| **`<ForbiddenState />`**| All Portal Modules | Global UI State | Role mismatch warning view |
| **`<DataTable />`** | Students, Users, SPP, Audit Logs | Global UI Component | Paginated grid data renderer |
| **`<SectionsTab />`** | CMS Landing Page | `websiteConfigService.ts` | Section configuration manager |
| **`<FitrahRadarChart />`**| Dashboard, Character, Parent Portal | `characterSummaryService.ts`| Character score visualization |
