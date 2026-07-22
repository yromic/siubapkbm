# SIUBA Theme System Architecture

## 1. Theme Philosophy
The SIUBA theme system implements a dual-mode adaptive architecture balancing warm organic light surfaces with high-contrast, low-glare dark surfaces.
- **Light Mode:** Reassuring, warm, paper-like surfaces (`#fdfbf7` cream base, `#ffffff` card surface).
- **Dark Mode:** Focused, near-black neutral surfaces (`#0a0a0a` background base, `#171717` card surface).
- **Brand Continuity:** Primary brand colors (`brand-emerald-500` `#10b981`, `brand-lime-500` `#84cc16`) remain identical across both modes.

## 2. Theme Architecture & Switching Strategy
- **CSS Custom Variables:** Surface levels defined in `:root` and overridden in `@media (prefers-color-scheme: dark)` ([globals.css:L3-L93](file:///d:/w/siubapkbm/app/globals.css#L3-L93)).
- **Tailwind v4 Integration:** Theme tokens registered in `@theme inline` mapping variables directly to utility colors (`--color-background: var(--background)`, `--color-surface-1: var(--surface-1)`).
- **Dark Utility Overrides:** Explicit component-level styling handled via Tailwind `dark:*` variants (`dark:bg-zinc-900`, `dark:border-zinc-800`).
- **Viewport Metadata:** Native OS color scheme integration declared in `app/layout.tsx` (`colorScheme: "light dark"`).

## 3. Semantic Token Registry

### Surface Tokens
- `Background Primary`: Light `#fdfbf7` | Dark `#0a0a0a` (`--background`)
- `Surface 0`: Light `#fdfbf7` | Dark `#0a0a0a` (`--surface-0`)
- `Surface 1 (Elevated Cards)`: Light `#ffffff` | Dark `#171717` (`--surface-1`)
- `Surface 2 (Hover / Neutral)`: Light `#f4f4f5` | Dark `#262626` (`--surface-2`)
- `Surface 3 (Borders / Dividers)`: Light `#e4e4e7` | Dark `#2d2d2d` (`--surface-3`)

### Feedback & Status Tokens
- `Success BG / Border / Text`:
  - Light: `#f0fdf4` / `#bbf7d0` / `#166534` ([globals.css:L17-L19](file:///d:/w/siubapkbm/app/globals.css#L17-L19))
  - Dark: `#052e16` / `#14532d` / `#86efac` ([globals.css:L80-L82](file:///d:/w/siubapkbm/app/globals.css#L80-L82))
- `Warning BG / Border / Text`:
  - Light: `#fffbeb` / `#fde68a` / `#92400e` ([globals.css:L23-L25](file:///d:/w/siubapkbm/app/globals.css#L23-L25))
  - Dark: `#422006` / `#78350f` / `#fde68a` ([globals.css:L86-L88](file:///d:/w/siubapkbm/app/globals.css#L86-L88))
- `Danger BG / Border / Text`:
  - Light: `#fef2f2` / `#fecaca` / `#991b1b` ([globals.css:L20-L22](file:///d:/w/siubapkbm/app/globals.css#L20-L22))
  - Dark: `#450a0a` / `#7f1d1d` / `#fca5a5` ([globals.css:L83-L85](file:///d:/w/siubapkbm/app/globals.css#L83-L85))
- `Info BG / Border / Text`:
  - Light: `#eff6ff` / `#bfdbfe` / `#1e40af` ([globals.css:L26-L28](file:///d:/w/siubapkbm/app/globals.css#L26-L28))
  - Dark: `#172554` / `#1e3a8a` / `#93c5fd` ([globals.css:L89-L91](file:///d:/w/siubapkbm/app/globals.css#L89-L91))

### Unverified Semantic Tokens
- `Disabled Surface`: Unable to verify from the available evidence.
- `Chart Colors (Series 1-5)`: Unable to verify from the available evidence.
- `Skeleton Surface`: Unable to verify from the available evidence.
- `Custom Scrollbar Track/Thumb`: Unable to verify from the available evidence.

## 4. Component Theme Matrix

| Component | Light Mode Implementation | Dark Mode Implementation | Evidence |
| :--- | :--- | :--- | :--- |
| **Navbar Header** | `bg-white/90 border-zinc-200/50 backdrop-blur-md` | `dark:bg-zinc-900/90 dark:border-zinc-800/50 backdrop-blur-md` | `Navbar.tsx:L38` |
| **Cards** | `bg-white border-zinc-200/50 shadow-sm` | `dark:bg-zinc-900 dark:border-zinc-800/80` | `Programs.tsx:L74` |
| **Accordions** | `bg-white border-zinc-200/60 shadow-sm` | `dark:bg-zinc-900 dark:border-zinc-800/80` | `FAQ.tsx:L14` |
| **Badges** | `bg-brand-emerald-50 text-brand-emerald-600` | `dark:bg-brand-emerald-950/30 dark:text-brand-emerald-600` | `About.tsx:L97` |
| **Toast Notifications**| `--normal-bg: #ffffff` | `--normal-bg: #18181b` | `globals.css:L14, L77` |
| **Mobile Drawer** | `bg-white/95 border-zinc-200 backdrop-blur-lg` | `dark:bg-zinc-900/95 dark:border-zinc-800 backdrop-blur-lg` | `Navbar.tsx:L107` |
| **Footer Container** | `bg-zinc-900 text-zinc-300` | `bg-zinc-900 text-zinc-300` (Fixed Dark Wrapper) | `Footer.tsx:L58` |

## 5. Glassmorphism & Shadow Adaptation
- **Glassmorphism:** Opacity scale is symmetric across themes (`90%` for scrolled header, `95%` for popover drawers, `15%` for secondary buttons). Backdrop blur is constant (`backdrop-blur-md` 12px blur, `backdrop-blur-lg` 16px blur).
- **Shadow Strategy:** Light mode relies on alpha drop-shadows (`shadow-sm`, `shadow-md`, `shadow-lg`). Dark mode suppresses drop shadows in favor of explicit surface elevation steps (`--surface-0` through `--surface-3`) and contrast borders (`dark:border-zinc-800`).

## 6. Accessibility & Motion Behavior
- Motion timings, curves, and Framer Motion sequence triggers are 100% identical between light and dark themes.
- Contrast meets WCAG AA standards. Focus outline suppression (`focus:outline-none`) requires replacement with explicit visual focus indicators (`focus-visible:ring-2 focus-visible:ring-brand-emerald-500`).

## 7. Migration Strategy & Readiness
- **Readiness:** High structural readiness. Custom property definitions (`--surface-0` to `--surface-3`) provide a reusable foundation.
- **Migration Action:** Eliminate ad-hoc `dark:bg-zinc-900` utility references in admin components in favor of semantic CSS custom variables (`var(--surface-1)`).
