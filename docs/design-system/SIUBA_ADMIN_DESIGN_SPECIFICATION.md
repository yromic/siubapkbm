# SIUBA Admin Design Specification & Mobile-First Blueprint

## 1. Design Philosophy
- **Mobile First:** All layouts, touch targets, and interaction models are engineered first for small viewports ($320\text{px} - 430\text{px}$).
- **Desktop Enhanced:** Desktop viewports ($\ge 1024\text{px}$) expand mobile patterns into multi-column grids, sidebar drawers, and dense data tables.
- **Enterprise Ready:** High contrast, WCAG 2.1 AA accessibility compliance, zero-glare dark mode, and low cognitive load.

---

## 2. Mobile First Foundation Principles

### 2.1 Touch Targets & Thumb Reach Zones
- **Minimum Touch Target:** All interactive controls (buttons, inputs, dropdown items, tabs) MUST maintain a minimum tap target of $44 \times 44\text{px}$ on touch viewports.
- **Natural Thumb Zone:** Primary action triggers (Save, Submit, Filter) MUST be anchored within the lower $40\%$ of the screen viewport.
- **Sticky Action Bar:** Floating action bars are docked above the bottom bar (`sticky bottom-16 md:bottom-4 z-30`).

### 2.2 Keyboard Avoidance & Safe Areas
- **Container Padding:** All main content views MUST enforce `pb-20 md:pb-6` to prevent fixed bottom navigation elements from overlaying focused form fields when the OS virtual keyboard is active.
- **Safe Area Insets:** Account for iOS/Android gesture bars using `env(safe-area-inset-bottom)`.

---

## 3. Core Component Specifications

### 3.1 Sidebar & Navigation Shell
- **Purpose:** Primary application menu navigation across administrative modules.
- **Mobile Behavior:** Hidden by default. Triggers as a full-height left drawer overlay (`w-72 bg-white dark:bg-[#171717] z-50 backdrop-blur-sm`).
- **Desktop Behavior:** Collapsible sticky sidebar (`w-64 sticky top-16 h-[calc(100vh-4rem)] border-r border-zinc-200 dark:border-zinc-800`).
- **Typography & Radius:** Headers `text-[10px] font-bold uppercase tracking-wider`, links `font-plus-jakarta text-sm font-medium rounded-xl` (12px).
- **Themes:** Light surface `#ffffff` / Dark surface `#171717`. Active link uses `bg-emerald-50/60 dark:bg-emerald-950/20 text-[#468432] dark:text-emerald-400`.

### 3.2 Topbar Header
- **Purpose:** Sticky top bar providing system identity, mobile menu trigger, profile status, and logout actions.
- **Hierarchy & Spacing:** Height `h-16 sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6`.
- **Glassmorphism:** `bg-white/90 dark:bg-[#171717]/90 backdrop-blur-md`.

### 3.3 Bottom Navigation Bar
- **Purpose:** Quick-access primary action bar for mobile devices (`md:hidden`).
- **Structure:** `fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#171717]/95 border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-center px-2`.
- **Items:** Max 4 primary routes (`/dashboard`, `/my-class`, `/academic-scores`, `/daily-culture`).

### 3.4 Page Header & Breadcrumbs
- **Purpose:** Contextual page title and structural navigation path.
- **Typography & Spacing:** Page Title in `font-fredoka text-2xl font-bold text-zinc-950 dark:text-zinc-50`. Spacing `mb-6`.
- **Responsive Behavior:** Stacks vertically on mobile; aligns flex-row on tablet/desktop.

### 3.5 Statistic & KPI Cards
- **Purpose:** Display core metrics, health scores, and summary data.
- **Layout & Radius:** `p-5 rounded-2xl bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 shadow-sm`.
- **Typography:** Value in `font-fredoka text-2xl md:text-3xl font-bold`, Label in `font-plus-jakarta text-xs uppercase tracking-wider text-zinc-400`.

### 3.6 Data Tables vs. Mobile Card Lists
- **Desktop Table (`hidden md:block`):** Full data grid with `py-3 px-4` cell padding, `bg-zinc-50 dark:bg-zinc-950` header, and `font-data` for numeric values.
- **Mobile Card Accordion (`block md:hidden`):** Replaces horizontal scrolling tables with a vertical list of touch-friendly cards (`rounded-2xl border border-zinc-200 p-4`). Accordions expand inline to reveal full record detail.

### 3.7 Form Controls (Inputs, Selects, Date Pickers)
- **Structure:** `w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-emerald-500/20 focus:border-brand-emerald-500`.
- **Touch Target:** Minimum height $42\text{px} - 44\text{px}$.

### 3.8 Dialogs, Drawers & Bottom Sheets
- **Modals (Desktop/Tablet):** Centered dialog (`max-w-lg rounded-2xl p-6 bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800`).
- **Bottom Sheets (Mobile):** Action panels slide up from bottom viewport edge (`fixed bottom-0 inset-x-0 rounded-t-2xl p-6 bg-white dark:bg-zinc-900 z-50`).

### 3.9 Toast Notifications & Alert Banners
- **Toast:** Triggered via Sonner provider, positioned `top-right` on desktop and `top-center` on mobile. Uses exact semantic CSS variables (`--success-bg`, `--error-bg`).
- **Info Banners:** `rounded-2xl p-4 border text-sm font-medium` (`variant="error"` $\rightarrow$ red tint, `variant="warning"` $\rightarrow$ amber tint).

### 3.10 Feedback & Empty States
- **Loading State:** Centered spinner + message (`LoadingState`).
- **Empty State:** Centered icon + display title + descriptive subtitle (`EmptyState`).
- **Forbidden State:** Security lock icon + clear role authorization error message (`ForbiddenState`).

---

## 4. Component Rules Summary (Do / Don't)

| Component | DO | DON'T |
| :--- | :--- | :--- |
| **Typography** | Use `Fredoka` ONLY for `h1` titles & KPI values. Use `Plus Jakarta Sans` for body copy and `IBM Plex Sans` for data tables. | Do NOT apply `Fredoka` to table cells or form input labels. |
| **Mobile Tables** | Convert multi-column tables to expandable card accordions on mobile viewports. | Do NOT force horizontal scrolling tables on screen widths $< 640\text{px}$. |
| **Card Radius** | Enforce `rounded-2xl` (16px) or `rounded-xl` (12px) for admin components. | Do NOT copy landing page marketing card radius (`rounded-[24px]`). |
| **Action Bars** | Anchor sticky primary save buttons above mobile bottom navigation bar (`sticky bottom-16 md:bottom-4`). | Do NOT hide primary submit buttons at the bottom of long scrolling pages without sticky wrappers. |
