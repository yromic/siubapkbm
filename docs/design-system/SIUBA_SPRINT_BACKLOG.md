# SIUBA UI Migration — Master Sprint Backlog (Sprints 1–7)

## Executive Summary
This document establishes the comprehensive, multi-sprint implementation backlog for the SIUBA UI Migration project. Each sprint is structured with explicit objectives, scope, out-of-scope boundaries, deliverables, acceptance criteria, regression risks, and exit criteria.

---

## Sprint 1: Foundation, Tokens & Application Shell

### Objective
Establish the semantic token architecture in `globals.css` and migrate the root authenticated application shell (`AuthenticatedLayout`) to comply with design system guidelines.

### Scope
- Add missing semantic surface utilities (`bg-surface-0`, `bg-surface-1`, `bg-surface-2`, `bg-surface-3`) to `globals.css`.
- Standardize dark mode color variables (`#0a0a0a`, `#171717`, `#262626`, `#2d2d2d`).
- Refactor `app/(authenticated)/(modules)/layout.tsx` to utilize semantic surface tokens instead of hardcoded hex values (`#171717`).
- Update Topbar header, Desktop Sidebar shell, and Mobile Bottom Navigation shell styling.

### Out of Scope
- Modifying individual module content pages (`/daily-culture`, `/students`, `/finance`).
- Creating new shared UI components.
- Modifying business logic or route guards.

### Dependencies
- Design system reference documents: `SIUBA_THEME_SYSTEM.md`, `SIUBA_ADMIN_UI_GUIDELINES.md`.

### Deliverables
- Updated `app/globals.css` with clean CSS custom variable registration and Tailwind `@theme inline` surface aliases.
- Refactored `app/(authenticated)/(modules)/layout.tsx`.

### Acceptance Criteria
- [ ] Light mode base background renders `#fdfbf7` (`--surface-0`); card surfaces render `#ffffff` (`--surface-1`).
- [ ] Dark mode base background renders `#0a0a0a` (`--surface-0`); card surfaces render `#171717` (`--surface-1`).
- [ ] Mobile Bottom Navigation bar (`md:hidden`) is correctly styled and visible only on small screens.
- [ ] Application compiles cleanly with zero TypeScript errors or CSS syntax warnings.

### Regression Risks
- Layout shifting or scrollbar clipping on mobile viewports.
- Dark mode visual flash during SSR initial hydration.

### Required Repository Areas
- `app/globals.css`
- `app/(authenticated)/(modules)/layout.tsx`

### Exit Criteria
- Layout shell operates seamlessly across desktop ($>1024\text{px}$) and mobile ($<768\text{px}$) in both Light and Dark modes.

---

## Sprint 2: Shared Component Extraction & Refactoring

### Objective
Extract inline components, eliminate component duplication, and deliver standardized foundational UI controls.

### Scope
- Extract `ScoreSelector` from `daily-culture/page.tsx` into `@/components/ui/score-selector.tsx`.
- Extract `KPIStatCard` from `dashboard/page.tsx` into `@/components/ui/kpi-stat-card.tsx`.
- Merge `AppreciationDialog` and `CelebrationModal` into `@/components/ui/milestone-celebration-modal.tsx`.
- Deprecate legacy `StatusBadge` in favor of accessible `LifecycleBadge`.
- Update `DatePicker` border radius to `rounded-xl` (12px).

### Out of Scope
- Full module page composition migration.
- Complex data table refactoring.

### Dependencies
- Sprint 1 completion (token availability).

### Deliverables
- `@/components/ui/score-selector.tsx`
- `@/components/ui/kpi-stat-card.tsx`
- `@/components/ui/milestone-celebration-modal.tsx`
- Updated `@/components/lifecycle-badge.tsx`

### Acceptance Criteria
- [ ] `ScoreSelector` supports 4 score states (1-PB, 2-C, 3-B, 4-SB) with touch target $\ge 44 \times 44\text{px}$ on mobile.
- [ ] `KPIStatCard` renders primary metric numbers in `font-fredoka` and label copy in `font-plus-jakarta`.
- [ ] Confetti celebration modal triggers cleanly without canvas memory leaks.
- [ ] All components pass keyboard focus ring tests (`focus-visible:ring-2 focus-visible:ring-brand-emerald-500`).

### Regression Risks
- Breaking imports in `daily-culture/page.tsx` or `dashboard/page.tsx`.

### Required Repository Areas
- `components/ui/`
- `components/lifecycle-badge.tsx`
- `components/status-badge.tsx`

### Exit Criteria
- Zero duplicate celebration components; extracted controls re-exported and validated.

---

## Sprint 3: Standard Data Table & Responsive List Patterns

### Objective
Build standardized responsive table and card list components (`DataTable` and `CardAccordionList`) for enterprise data display.

### Scope
- Create `@/components/ui/data-table.tsx` with standard header styling (`bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wider`), border dividers, and hover feedback (`hidden md:block`).
- Create `@/components/ui/card-accordion-list.tsx` for mobile view data display (`block md:hidden`).
- Support `font-data` (`IBM Plex Sans`) for all numeric, financial, and date cells.

### Out of Scope
- Migrating specific business logic in `/students` or `/finance`.

### Dependencies
- Sprint 1 and Sprint 2 completion.

### Deliverables
- `@/components/ui/data-table.tsx`
- `@/components/ui/card-accordion-list.tsx`

### Acceptance Criteria
- [ ] Tables automatically switch from tabular layout (`md:table`) to stacked card accordion layout on viewports $<768\text{px}$.
- [ ] Table headers enforce `Plus Jakarta Sans` uppercase, and numeric data enforces `IBM Plex Sans`.
- [ ] Empty state and loading state fallbacks render gracefully within the table wrapper.

### Regression Risks
- Horizontal overflow on narrow desktop screens ($768\text{px} - 1024\text{px}$).

### Required Repository Areas
- `components/ui/`
- `components/student-files-panel.tsx`

### Exit Criteria
- Reusable `DataTable` ready for consumption by all data-heavy module pages.

---

## Sprint 4: Feedback, Dialogs & Mobile Action Surfaces

### Objective
Systematize feedback overlays, confirm dialogs, Sonner toast themes, and sticky mobile action bars.

### Scope
- Refactor `ConfirmDialog` to enforce `rounded-2xl` containers, `bg-black/50 backdrop-blur-sm` backdrops, and semantic `--surface-1` colors.
- Create `@/components/ui/sticky-action-bar.tsx` for mobile save/submit footer actions (`md:hidden sticky bottom-16`).
- Standardize `SonnerToaster` theme variables in `globals.css` (`--success-bg`, `--error-bg`, `--warning-bg`, `--info-bg`).
- Refactor `InfoBanner` to utilize design system color feedback tokens.

### Out of Scope
- Full page migrations.

### Dependencies
- Sprint 1–3 completion.

### Deliverables
- `@/components/ui/sticky-action-bar.tsx`
- Updated `@/components/ui/confirm-dialog.tsx`
- Updated `@/components/ui/info-banner.tsx`
- Updated `@/components/ui/sonner.tsx`

### Acceptance Criteria
- [ ] Confirm dialogs render smooth blur backdrops and support keyboard `Escape` closing.
- [ ] Toast notifications trigger cleanly with high-contrast text in both light and dark modes.
- [ ] Mobile sticky action bar floats smoothly above the mobile bottom nav without overlap.

### Regression Risks
- Z-index conflicts between mobile bottom nav, sticky action bar, and modal overlays.

### Required Repository Areas
- `components/ui/`

### Exit Criteria
- All feedback overlays aligned with design system guidelines.

---

## Sprint 5: Pilot Module Migration — Daily Culture (`/daily-culture`)

### Objective
Execute full end-to-end design system migration of the pilot module `app/(authenticated)/(modules)/daily-culture/page.tsx` as defined in `SIUBA_PILOT_MODULE_PLAN.md`.

### Scope
- Replace inline scoring UI with shared `ScoreSelector` component.
- Apply `PageHeader` with title *"Jurnal Adab & Harian"* and subtitle.
- Implement mobile card accordion list and desktop score entry grid.
- Integrate `StickyActionBar` for batch score saving on mobile devices.
- Retain 100% of underlying AFS (Adab Scoring System) mutation logic, cooldown rules, and event triggers.

### Out of Scope
- Modifying `lib/afs/*` business logic or server actions.
- Modifying other module pages.

### Dependencies
- Completion of Sprints 1 through 4.

### Deliverables
- Fully migrated `app/(authenticated)/(modules)/daily-culture/page.tsx`.

### Acceptance Criteria
- [ ] `/daily-culture` page visual appearance matches `SIUBA_PILOT_MODULE_PLAN.md` specification.
- [ ] Daily score recording, batch save, and celebration triggers execute without errors.
- [ ] Zero business logic regressions; offline/cooldown managers remain fully operational.

### Regression Risks
- Loss of daily score state during touch interactions on mobile browsers.

### Required Repository Areas
- `app/(authenticated)/(modules)/daily-culture/page.tsx`
- `lib/afs/`

### Exit Criteria
- Pilot module fully migrated, verified on mobile & desktop, and approved as the benchmark for subsequent module migrations.

---

## Sprint 6: Core Module Migration — Dashboard, Students & Finance

### Objective
Migrate remaining core admin modules (`/dashboard`, `/students`, `/finance`, `/academic-scores`, `/settings`) to the design system.

### Scope
- Migrate `/dashboard` to use `KPIStatCard`, `PageHeader`, and compact card padding (`p-5`, `rounded-2xl`).
- Migrate `/students` to use `DataTable` desktop view and `CardAccordionList` mobile view.
- Migrate `/finance` to use standardized currency data formatting (`IBM Plex Sans`) and `LifecycleBadge` status indicators.
- Migrate `/academic-scores` and `/settings` pages.

### Out of Scope
- Altering database schemas or backend server functions.

### Dependencies
- Sprint 5 pilot migration success.

### Deliverables
- Migrated `app/(authenticated)/(modules)/dashboard/page.tsx`
- Migrated `app/(authenticated)/(modules)/students/page.tsx`
- Migrated `app/(authenticated)/(modules)/finance/page.tsx`
- Migrated `app/(authenticated)/(modules)/academic-scores/page.tsx`
- Migrated `app/(authenticated)/(modules)/settings/page.tsx`

### Acceptance Criteria
- [ ] All admin module pages strictly comply with `SIUBA_ADMIN_UI_GUIDELINES.md`.
- [ ] Typography strictly enforces `Fredoka` for headers/KPIs, `Plus Jakarta Sans` for body/labels, and `IBM Plex Sans` for data/tables.
- [ ] All screens pass responsive testing on Mobile ($375\text{px}$), Tablet ($768\text{px}$), and Desktop ($1440\text{px}$).

### Regression Risks
- Form input state reset on filter changes in `/students` table.

### Required Repository Areas
- `app/(authenticated)/(modules)/`

### Exit Criteria
- 100% of admin modules migrated to design system baseline.

---

## Sprint 7: System QA, Accessibility & Verification Baseline

### Objective
Perform end-to-end quality assurance, visual regression checks, dark mode audits, and accessibility validation across the entire migrated codebase.

### Scope
- Conduct cross-browser responsive testing (Chrome, Safari, Mobile WebKit).
- Audit WCAG 2.1 AA color contrast compliance in Light and Dark modes.
- Verify screen reader accessibility (`aria-label`, `role="radiogroup"`, `aria-checked`).
- Execute full production build validation (`npm run build`).

### Out of Scope
- New feature additions or architectural shifts.

### Dependencies
- Sprints 1–6 completion.

### Deliverables
- Final QA report artifact `walkthrough.md`.
- Production-ready codebase.

### Acceptance Criteria
- [ ] Production build (`npm run build`) completes cleanly with zero errors.
- [ ] Zero WCAG AA contrast violations in Light or Dark mode.
- [ ] All interactive elements feature visible focus rings.

### Regression Risks
- Unnoticed CSS specificity conflicts in production build CSS output.

### Required Repository Areas
- Entire codebase.

### Exit Criteria
- Full UI Migration officially signed off and ready for deployment.
