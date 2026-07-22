# SIUBA UI Migration — Layer Migration Matrix

## 1. Layer Architecture Overview

The UI migration is divided into 9 architectural layers. Each layer represents a specific tier of the UI system, ordered by strict implementation dependency.

---

## 2. Layer Migration Matrix

| Layer # | Layer Name | Purpose | Repository Dependency | Design System References | Components Involved | Affected Pages | Migration Wave | Blocking Layers | Deliverable Layers | Regression Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Layer 1** | **Design Tokens Layer** | Define CSS custom properties, Tailwind theme extensions, and global variables | `app/globals.css`, `app/layout.tsx` | `SIUBA_THEME_SYSTEM.md`, `SIUBA_DESIGN_SYSTEM.md` | `globals.css` variable definitions | Entire Application | Wave 1 (Sprint 1) | None | Layer 2, Layer 3 | **Low** (Style baseline addition) |
| **Layer 2** | **Application Shell Layer** | Establish root layout, theme wrappers, drawer structures, and viewport bounds | `app/(authenticated)/(modules)/layout.tsx` | `SIUBA_INFORMATION_ARCHITECTURE.md`, `SIUBA_THEME_SYSTEM.md` | `AuthenticatedLayout`, Mobile Drawer | All `/(authenticated)` modules | Wave 2 (Sprint 1) | Layer 1 | Layer 3, Layer 4 | **Medium** (Layout reflows, dark mode surfaces) |
| **Layer 3** | **Navigation Layer** | Deliver desktop sidebar, topbar header, mobile bottom nav bar, breadcrumbs | `components/landing/Navbar.tsx`, `app/(authenticated)/(modules)/layout.tsx` | `SIUBA_ADMIN_DESIGN_SPECIFICATION.md`, `SIUBA_INFORMATION_ARCHITECTURE.md` | Mobile Bottom Nav, Desktop Sidebar, Topbar Header | All `/(authenticated)` modules | Wave 3 (Sprint 1) | Layer 1, Layer 2 | Layer 4, Layer 5 | **Medium** (Route highlighting, z-index overlays) |
| **Layer 4** | **Foundation Components Layer** | Standardize core state wrappers, badge indicators, icons, and dialog overlays | `components/ui-states.tsx`, `components/lifecycle-badge.tsx`, `components/ui/confirm-dialog.tsx` | `SIUBA_COMPONENT_LIBRARY.md`, `SIUBA_ADMIN_UI_GUIDELINES.md` | `PageHeader`, `ResponsiveContainer`, `LoadingState`, `EmptyState`, `ErrorState`, `LifecycleBadge`, `ConfirmDialog`, `MilestoneCelebrationModal` | All `/(authenticated)` modules | Wave 4 (Sprint 2) | Layer 1, Layer 2 | Layer 5, Layer 6 | **Low-Medium** (Component prop interface breaks) |
| **Layer 5** | **Form Controls Layer** | Deliver standardized input, select, date picker, search bar, and score selectors | `components/ui/date-picker.tsx`, `app/(authenticated)/(modules)/daily-culture/page.tsx` | `SIUBA_ADMIN_UI_GUIDELINES.md`, `SIUBA_COMPONENT_LIBRARY.md` | `Input`, `Select`, `DatePicker`, `ScoreSelector`, `SearchBar` | `/daily-culture`, `/students`, `/finance`, `/settings` | Wave 5 (Sprint 2) | Layer 1, Layer 4 | Layer 6, Layer 7 | **Medium** (Touch targets, validation feedback, keyboard focus) |
| **Layer 6** | **Data Display & Table Layer** | Provide responsive desktop data tables and mobile accordion cards | `components/student-files-panel.tsx`, `app/(authenticated)/(modules)/students/page.tsx` | `SIUBA_ADMIN_UI_GUIDELINES.md` (§6), `SIUBA_ADMIN_DESIGN_SPECIFICATION.md` | `DataTable`, `CardAccordionList`, `KPIStatCard` | `/dashboard`, `/students`, `/finance`, `/academic-scores` | Wave 6 (Sprint 3–4) | Layer 1, Layer 4, Layer 5 | Layer 7, Layer 8 | **High** (Table responsive breakdown, scroll clipping) |
| **Layer 7** | **Feedback & Toast Layer** | Systematize Sonner notifications, inline warning banners, and error callouts | `components/ui/sonner.tsx`, `components/ui/info-banner.tsx` | `SIUBA_THEME_SYSTEM.md` (§3), `SIUBA_ADMIN_UI_GUIDELINES.md` (§5) | `SonnerToaster`, `InfoBanner`, `ErrorState` | Entire Application | Wave 7 (Sprint 4) | Layer 1, Layer 4 | Layer 8 | **Low** (Toast stacking & theme background color) |
| **Layer 8** | **Pilot & Module Composition Layer** | Migrate business screens using standardized UI component composition | `app/(authenticated)/(modules)/daily-culture/page.tsx`, `app/(authenticated)/(modules)/dashboard/page.tsx` | `SIUBA_PILOT_MODULE_PLAN.md`, `SIUBA_ADMIN_DESIGN_SPECIFICATION.md` | Full Page Module Composition | `/daily-culture`, `/dashboard`, `/students`, `/finance`, `/academic-scores`, `/settings` | Wave 8 (Sprint 5–6) | Layer 1 through Layer 7 | Layer 9 | **High** (Business logic regressions, state mutations) |
| **Layer 9** | **QA & Verification Layer** | Conduct automated build checks, visual regression audits, and accessibility tests | Repository workspace root | `SIUBA_IMPLEMENTATION_CONTRACT.md`, `SIUBA_ADMIN_UI_GUIDELINES.md` (§9) | Full UI Suite | All routes | Wave 9 (Sprint 7) | Layer 1 through Layer 8 | Complete UI System Release | **Medium** (Catching latent edge case bugs) |

---

## 3. Dependency Flow Graph

$$\begin{array}{ccccccccc}
\text{Layer 1: Design Tokens} & \longrightarrow & \text{Layer 2: App Shell} & \longrightarrow & \text{Layer 3: Navigation} \\
& & \downarrow & & \downarrow \\
& & \text{Layer 4: Foundation Components} & \longrightarrow & \text{Layer 5: Form Controls} \\
& & \downarrow & & \downarrow \\
& & \text{Layer 6: Data Display} & \longrightarrow & \text{Layer 7: Feedback} \\
& & \downarrow & & \downarrow \\
& & \text{Layer 8: Module Composition} & \longrightarrow & \text{Layer 9: QA & Verification}
\end{array}$$
