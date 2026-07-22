# SIUBA Shared Component Library Architecture & Planning

## 1. Architectural Taxonomy

Components across the SIUBA repository are categorized into 9 foundational layers:

1. **Foundation Layer:** Icons (`lucide-react`), Typography wrappers, Color tokens, Surface containers.
2. **Layout Layer:** `ResponsiveContainer`, `PageHeader`, Sidebar drawer shell, Topbar header shell, Sticky Action Bar.
3. **Navigation Layer:** Mobile Bottom Nav, Desktop Sidebar Menu, Accordion Category Header, Breadcrumbs.
4. **Data Display Layer:** Data Table (`hidden md:block`), Card Accordion List (`block md:hidden`), Statistic KPI Card, Status Badges (`rounded-full`).
5. **Form Controls Layer:** Input, Select, DatePicker, Checkbox, RadioGroup (`ScoreSelector`), Search Bar.
6. **Feedback Layer:** `LoadingState`, `EmptyState`, `ErrorState`, `ForbiddenState`, `InfoBanner`, Sonner Toast.
7. **Charts Layer:** SPP Status Chart, Fitrah Radar Chart, Academic Score Bar Chart.
8. **Overlay Layer:** `ConfirmDialog`, `AppreciationDialog`, Mobile Menu Drawer, Dropdown Menu.
9. **Utilities Layer:** Score Mappers (`dbScoreToUi`), Error Humanizers (`humanizeError`), Notification helpers (`notify`).

---

## 2. Component Specification Registry

### 2.1 Component: `PageHeader`
- **Owner:** UI System Team
- **Purpose:** Standardized title and description header for all admin modules.
- **Props:** `title: string`, `description?: string`, `action?: React.ReactNode`.
- **Theme Adaptation:** Light text `text-zinc-950` / Dark text `text-zinc-50`.
- **Accessibility:** Renders structural `<h1>` tag with proper hierarchy.

### 2.2 Component: `ScoreSelector`
- **Owner:** Academic & Culture Team ([daily-culture/page.tsx:L82](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/daily-culture/page.tsx#L82))
- **Purpose:** Touch-optimized 4-option radio selector for daily culture scoring (1-PB, 2-C, 3-B, 4-SB).
- **Props:** `value: number | null`, `onChange: (val: number | null) => void`, `disabled?: boolean`, `isMobile?: boolean`.
- **Variants:** Desktop Compact (`w-7 h-7`), Mobile Expanded (`w-full flex-1 py-1.5`).
- **Accessibility:** Full `role="radiogroup"` and `role="radio"` with keyboard arrow navigation and explicit `aria-checked` states.

### 2.3 Component: `ConfirmDialog`
- **Owner:** UI System Team ([components/ui/confirm-dialog.tsx](file:///d:/w/siubapkbm/components/ui/confirm-dialog.tsx))
- **Purpose:** Destructive and warning confirmation modal for critical actions (Logout, Delete, Cancel).
- **Props:** `open: boolean`, `onClose: () => void`, `title: string`, `description: string`, `confirmText?: string`, `cancelText?: string`, `variant?: "default" | "destructive"`.
- **Theme Adaptation:** Backdrop `bg-black/50 backdrop-blur-sm`, container `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800`.

---

## 3. Consolidation & Refactoring Opportunities

### 3.1 Components to Merge
1. **`AppreciationDialog` and `CelebrationModal`:**
   - *Finding:* `components/ui/appreciation-dialog.tsx` and `components/ui/celebration-modal.tsx` perform redundant celebration animation triggers.
   - *Recommendation:* Merge into a single `MilestoneCelebrationModal` component managed via `useAppreciation` hook.

### 3.2 Duplicated Patterns to Extract
1. **Score Selection Buttons:**
   - *Finding:* `ScoreSelector` in `daily-culture/page.tsx` contains inline score options.
   - *Recommendation:* Extract `ScoreSelector` into `@/components/ui/score-selector.tsx` for shared reuse across `daily-culture` and `academic-scores`.

### 3.3 Components to Remain Isolated
1. **`Navbar.tsx` (Landing Page):**
   - *Justification:* Marketing floating glass navbar contains specialized landing scroll listeners and CTA links. Keep isolated from admin topbar navigation.
