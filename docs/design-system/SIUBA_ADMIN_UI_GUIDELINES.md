# SIUBA Admin UI Guidelines

## 1. Engineering Standards Overview
This document defines normative implementation rules for developers and AI agents building enterprise Admin Panel components within the SIUBA repository. All implementation code must strictly comply with these rules to prevent visual, functional, and accessibility regressions.

## 2. Typography Rules
- **Rule 1.1 (Display Font Scope):** `font-fredoka` is strictly restricted to primary page headers (`h1`) and metric KPI stat cards.
- **Rule 1.2 (Interface Font Scope):** All form labels, buttons, navigation items, dialog titles, table headers, and body copy MUST use `font-plus-jakarta`.
- **Rule 1.3 (Tabular Data Font Scope):** All numeric table cells, financial amounts, timestamps, dates, and ID codes MUST use `font-data` (`IBM Plex Sans`).

```tsx
// DO
<td className="font-data text-sm text-zinc-900 dark:text-zinc-150">1,250,000 IDR</td>

// DON'T
<td className="font-fredoka text-sm text-zinc-900">1,250,000 IDR</td>
```

## 3. Spacing & Information Density Rules
- **Rule 2.1 (Admin Card Padding):** Admin cards MUST use `p-4` or `p-5` (16px to 20px). Do NOT use landing page marketing padding (`p-8`).
- **Rule 2.2 (Section Margins):** Section bottom margins MUST NOT exceed `mb-6` (24px).
- **Rule 2.3 (Table Cell Padding):** Table cells MUST use `py-3 px-4` for standard density or `py-2 px-3` for compact density.

```tsx
// DO
<div className="p-5 rounded-2xl bg-surface-1 border border-zinc-200 dark:border-zinc-800">

// DON'T
<div className="p-8 rounded-[24px] bg-white border border-zinc-200/50">
```

## 4. Radius & Geometry Rules
- **Rule 3.1 (Admin Cards):** Maximum border radius for admin cards is `rounded-2xl` (16px) or `rounded-xl` (12px).
- **Rule 3.2 (Inputs & Buttons):** Form inputs and action buttons MUST use `rounded-xl` (12px).
- **Rule 3.3 (Status Badges):** Status tags and table badges MUST use `rounded-full` (Pill) or `rounded-lg` (8px).

## 5. Color & Theme Rules
- **Rule 4.1 (Semantic Surface Tokens):** Card backgrounds must use `--surface-1` (`bg-white dark:bg-zinc-900` or `bg-surface-1`). Primary page background must use `--surface-0` (`bg-zinc-50 dark:bg-zinc-950`).
- **Rule 4.2 (Primary Actions):** Primary admin buttons must use `bg-brand-emerald-600 hover:bg-brand-emerald-700 active:bg-brand-emerald-700 text-white`.
- **Rule 4.3 (Status Indicators):** Use exact brand feedback tokens:
  - Success: `bg-brand-emerald-50 text-brand-emerald-700 border-brand-emerald-200`
  - Danger: `bg-red-50 text-red-700 border-red-200`
  - Warning: `bg-amber-50 text-amber-700 border-amber-200`
  - Info: `bg-blue-50 text-blue-700 border-blue-200`

## 6. Motion & Animation Rules
- **Rule 5.1 (No Background Motion):** Admin dashboards MUST NOT contain continuous Framer Motion background loops or SVG wave masks.
- **Rule 5.2 (Functional Transitions Only):** Limit Framer Motion to functional UI transitions (modal open/close `duration: 0.2`, dropdown popovers, tab switching).

## 7. Component Specific Implementation Rules

### Data Tables
- **Rule 6.1 (Header Styling):** Table headers MUST use `bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-xs font-semibold uppercase tracking-wider`.
- **Rule 6.2 (Border Dividers):** Rows MUST be separated by `border-b border-zinc-100 dark:border-zinc-800`.
- **Rule 6.3 (Row Hover):** Interactive rows MUST feature hover feedback `hover:bg-zinc-50/80 dark:hover:bg-zinc-850/50`.

### Modals & Dialogs
- **Rule 7.1 (Backdrop):** Dialog overlays MUST use `bg-black/50 backdrop-blur-sm`.
- **Rule 7.2 (Container):** Dialog containers MUST use `rounded-2xl max-w-lg p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl`.

### Form Controls
- **Rule 8.1 (Input Style):** Form fields MUST use `px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-emerald-500/20 focus:border-brand-emerald-500`.

## 8. Accessibility Rules
- **Rule 9.1 (Keyboard Focus):** Every interactive control (buttons, inputs, dropdown items, tabs) MUST include visible focus rings: `focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2`.
- **Rule 9.2 (Icon Buttons):** All icon-only buttons MUST include an explicit `aria-label` attribute.

## 9. Implementation & Regression Checklist
- [ ] Are primary page titles rendered in `Fredoka` and body/table copy in `Plus Jakarta Sans` / `IBM Plex Sans`?
- [ ] Are admin card paddings set to `p-4` or `p-5` instead of `p-8`?
- [ ] Are form inputs and primary buttons using `rounded-xl` (12px)?
- [ ] Do all interactive elements support both Light mode and Dark mode via `dark:*` or CSS variables?
- [ ] Are drop shadows restrained to `shadow-sm` or `shadow-md` for admin cards?
- [ ] Are keyboard focus rings (`focus-visible:ring-2`) present on all custom controls?
- [ ] Have continuous background animations and organic wave masks been excluded from admin pages?
