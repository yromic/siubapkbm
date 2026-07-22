# SIUBA Phase 4 — Admin UX Research & Usage Pattern Analysis

## 1. User Personas & Role Analysis
Extracted directly from client authentication definitions ([lib/api/client.ts:L1-L14](file:///d:/w/siubapkbm/lib/api/client.ts#L1-L14)) and layout menu access rules ([app/(authenticated)/(modules)/layout.tsx:L57-L205](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L57-L205)).

### 1.1 Role: Guru Wali Kelas (`teacher`)
- **Primary Goal:** Efficient daily mobile input of student character assessments, attendance, academic scores, and monitoring class progress.
- **Common Tasks:**
  1. Record daily culture scores (*Budaya Harian SAHABAT*) for class roster.
  2. Input academic assessment scores (*Nilai Akademik*).
  3. View student character recap (*Rekap Karakter*).
  4. Access class roster & student info (*Kelas Saya*).
  5. Import/Export class evaluation sheets (*Import/Export*).
- **Permissions:** Restricted strictly to active class assignments (`/my-class`, `/academic-scores`, `/daily-culture`, `/character-recap`, `/import`, `/export`, `/dashboard`). Access to master system data or user administration is explicitly forbidden ([layout.tsx:L508](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L508)).
- **Primary Workflows:** Quick daily mobile entry (1-2 minutes per class via bottom navigation bar).

### 1.2 Role: Operator / Admin (`admin`)
- **Primary Goal:** Manage student enrollment lifecycle, tuition (SPP) payments, CMS landing page content, and academic promotions.
- **Common Tasks:**
  1. Register & edit student records (`/students`).
  2. Verify & process SPP tuition payments (`/finance`).
  3. Manage CMS landing page content (`/settings/cms-landing`).
  4. Execute student grade promotions (`/settings/promotion`).
  5. Perform data rollover & system health checks (`/settings/rollover`, `/health-check`).
- **Permissions:** Operational administration (`students`, `finance`, `promotion`, `cms-landing`, `health-check`, `import`, `export`). Restricted from creating root system users, editing teacher profiles, or viewing system audit logs.

### 1.3 Role: Administrator (`administrator`)
- **Primary Goal:** Overall institutional configuration, user management, audit compliance, and system integrity.
- **Common Tasks:**
  1. Manage system staff accounts & password resets (`/users`).
  2. Maintain teacher profiles & class assignments (`/teachers`, `/classes`, `/classes/subjects`).
  3. Maintain master subjects & academic calendar (`/subjects`, `/master-data`).
  4. Inspect system audit logs & security diagnostics (`/audit-log`, `/health-check`).
- **Permissions:** Unrestricted root access across all 21 navigation endpoints.

---

## 2. Workflow Mapping

```
                       GENERAL ADMIN MODULE WORKFLOW
  ┌──────────────┐      ┌─────────────────┐      ┌────────────────────────┐
  │ 1. ENTRY     │ ────>│ 2. NAVIGATION   │ ────>│ 3. TASK EXECUTION      │
  │ Login / Auth │      │ Bottom Nav /    │      │ Roster Selection /     │
  │ Redirect     │      │ Collapsible Menu│      │ Inline Score Inputs    │
  └──────────────┘      └─────────────────┘      └────────────────────────┘
                                                             │
                                                             ▼
  ┌──────────────┐      ┌─────────────────┐      ┌────────────────────────┐
  │ 5. EXIT      │ <────│ 5. FEEDBACK     │ <────│ 4. COMPLETION          │
  │ Return to    │      │ Toast /         │      │ Sticky Bottom Bar Save │
  │ Dashboard    │      │ Appreciation    │      │ Confirmation           │
  └──────────────┘      └─────────────────┘      └────────────────────────┘
```

### 2.1 Workflow: Daily Culture Score Input (`/daily-culture`)
- **Entry:** Teacher logs in $\rightarrow$ Redirected to `/dashboard` $\rightarrow$ Taps "Budaya Harian" icon in fixed bottom mobile navigation bar ([layout.tsx:L515](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L515)).
- **Navigation:** Page loads class selector and date picker (`DatePicker`). System defaults to active class assignment and current date ([daily-culture/page.tsx:L177](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/daily-culture/page.tsx#L177)).
- **Task:** Tap student card accordion to expand 7 indicator rows (SSS, AM, HB, ASM, BR, AK, TM) $\rightarrow$ Tap emoji score selectors (1 to 4).
- **Completion:** Tap "Simpan Skor" on sticky bottom action bar ([daily-culture/page.tsx:L777](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/daily-culture/page.tsx#L777)).
- **Feedback & Exit:** Sonner toast notification ("Nilai budaya berhasil disimpan") + optional appreciation modal trigger on 100% completion $\rightarrow$ Return to dashboard or select next date.

### 2.2 Workflow: Student Registration (`/students/new`)
- **Entry:** Admin navigates to `/students` via sidebar/menu $\rightarrow$ Taps "Tambah Siswa" button.
- **Navigation:** Multi-section form loads (Identity, Parent Info, Academic Enrollment).
- **Task:** Input NIK, NISN, Full Name, Birth Date, Select Class $\rightarrow$ Submit.
- **Completion:** Backend validates duplicate NIK/NISN $\rightarrow$ Redirects to student detail page.
- **Exit:** Return to `/students` list.

---

## 3. Screen Frequency Classification

| Screen / Module | Frequency Class | Target User Roles | Evidence / Justification |
| :--- | :--- | :--- | :--- |
| **`/daily-culture`** | **High Frequency** | Teacher | Daily required task (7 indicators scored per student every school day). |
| **`/dashboard`** | **High Frequency** | All Roles | Default landing route after authentication ([useAuth.tsx:L38](file:///d:/w/siubapkbm/hooks/useAuth.tsx#L38)). |
| **`/academic-scores`**| **Medium Frequency** | Teacher | Periodic task performed during exam/assessment cycles (weekly/monthly). |
| **`/finance` (SPP)** | **Medium Frequency** | Admin, Administrator | Monthly tuition fee collection and payment verification. |
| **`/students`** | **Medium Frequency** | Admin, Administrator | Student profile lookups, status updates, and parent PIN resets. |
| **`/character-recap`**| **Medium Frequency** | Teacher | Weekly/monthly student character summary inspection. |
| **`/teachers`** | **Low Frequency** | Administrator | Teacher profile creation (infrequent administrative setup). |
| **`/classes`** | **Low Frequency** | Administrator | Class configuration (configured once per academic period). |
| **`/settings/promotion`**| **Low Frequency** | Admin, Administrator | Grade promotion executed once per academic year. |
| **`/settings/rollover`**| **Low Frequency** | Admin, Administrator | Period rollover executed once per academic year. |

---

## 4. Mobile Usage & Interaction Analysis

### 4.1 Mobile Ergonomics & Interaction Model
- **Bottom Navigation Bar:** Primary navigation on mobile viewports (`md:hidden`) renders a 4-item bottom bar (`h-16 fixed bottom-0 z-40 bg-white/95 backdrop-blur-md`) containing high-frequency routes (`/dashboard`, `/my-class`, `/academic-scores`, `/daily-culture`, [layout.tsx:L515-L532](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L515-L532)).
- **Thumb Reach Zone:** High-frequency actions (emoji score radio buttons, sticky bottom save bars) are positioned within the lower 60% of the screen.
- **Mobile Accordion Pattern:** In `/daily-culture`, desktop data tables auto-switch to a touch-optimized mobile card accordion list (`block md:hidden`, [daily-culture/page.tsx:663](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/daily-culture/page.tsx#L663)).
- **Sticky Save Action Bar:** Floating bottom action bar (`sticky bottom-16 md:bottom-4 z-30`) remains docked directly above the bottom navigation bar during scroll, providing instant thumb access to "Simpan Skor" ([daily-culture/page.tsx:L760](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/daily-culture/page.tsx#L760)).

### 4.2 Potential Mobile Touch Challenges
- **Dense Inputs:** Multi-column forms (e.g. Master Data or Class Subject Assignment) force horizontal scrolling on viewports `< 380px` if not wrapped in single-column flex layouts.
- **Keyboard Overlay:** Virtual OS keyboard overlay on mobile web browsers can obstruct bottom sticky action bars unless padded with `pb-20 md:pb-6` on main container elements ([layout.tsx:L503](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L503)).

---

## 5. Information Density & Responsive Priority

| Page / Route | Density Level | Responsive Priority | Justification / Evidence |
| :--- | :--- | :--- | :--- |
| **`/daily-culture`** | **Medium** | **Mobile First** | Explicitly features dual rendering: Mobile Collapsible Cards (`block md:hidden`) and Desktop Data Table (`hidden md:block`). Optimized for mobile finger-tapping. |
| **`/dashboard`** | **Medium** | **Mobile First** | Single-column stack on mobile, multi-column metric grid on desktop. |
| **`/my-class`** | **Low-Medium** | **Mobile First** | Simple list of assigned students and quick action triggers. |
| **`/students`** | **High** | **Adaptive** | Multi-column student roster table with search filters and status badges. |
| **`/finance` (SPP)** | **High** | **Adaptive** | Financial ledger grid with status chips and bulk payment verification. |
| **`/audit-log`** | **Very High** | **Desktop First** | Dense system log audit entries, IP addresses, timestamp traces, and JSON payloads. |
| **`/settings/rollover`**| **High** | **Desktop First** | Multi-step administrative configuration preview and execution. |

---

## 6. Existing UX Pain Points Discovered

1. **Pain Point 1: Dual Navigation Stacking on Mobile**
   * *Evidence:* On mobile viewports, the bottom navigation bar (`fixed bottom-0 h-16 z-40`, [layout.tsx:L515](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L515)) overlaps sticky page action bars (such as `/daily-culture` save bar `sticky bottom-16`, [daily-culture/page.tsx:L760](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/daily-culture/page.tsx#L760)). If page content lacks sufficient bottom padding (`pb-20`), action buttons become obscured behind the browser's virtual keyboard or bottom bar.
2. **Pain Point 2: Font Scale Inconsistency Between Mobile Card and Desktop Table**
   * *Evidence:* Mobile accordion indicator labels in `/daily-culture` use `text-[10px]` while desktop table headers use `text-[11px]`. Very small text (`10px`) can lead to accessibility contrast issues on lower-end mobile displays.
3. **Pain Point 3: Category Accordion State Reset on Sidebar Navigation**
   * *Evidence:* In `AuthenticatedLayout` ([layout.tsx:L226-L232](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/layout.tsx#L226-L232)), category accordion collapse states (`openCategories`) reset to default (`utama: true`, others `false`) on page reloads or hard navigation, forcing users to repeatedly tap category headers when switching between sub-menus.

---

## 7. Research Deliverables & Verification Summary

- **Created File:** [docs/design-system/SIUBA_ADMIN_UX_RESEARCH.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_ADMIN_UX_RESEARCH.md)
- **User Roles Analyzed:** 3 (`administrator`, `admin`, `teacher`)
- **Modules Mapped:** 21 navigation items across 5 categories (`utama`, `akademik`, `website`, `sistem`, `data`)
- **Pain Points Documented:** 3 verified repository UX challenges
- **Confidence Level:** Verified from source code and runtime layout logic
